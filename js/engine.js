/*
 * engine.js: the single source of truth for a lesson's repository.
 *
 * Real Git commands (init, add, commit, status, log) run on isomorphic-git over an
 * in-memory file system. Small helper commands (touch, echo, cat, ls, rm) are our own
 * code, because a browser has no real shell. The diagram and the terminal both read
 * the repository through getState(), so they can never disagree.
 */
(function () {
  const DIR = '/project';
  const SHOWN_DIR = '/home/you/project';
  const AUTHOR = { name: 'You', email: 'you@example.com' };
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const GIT_HELP = [
    'These Git commands work in this course:',
    '  git init                    start a repository',
    '  git status                  see what is where',
    '  git add <file>              move a change to the staging area',
    '  git commit -m "message"     save the staged changes as a commit',
    '  git log [--oneline]         list saved commits',
    '  git diff [--staged]         show what changed, line by line',
    '  git branch [name]           list branches, or create one',
    '  git switch [-c] <branch>    move to a branch (-c creates it)',
    '  git merge <branch>          bring a branch into the current one',
    '  git restore [--staged] <f>  undo changes to a file',
    '  git reset [--soft|--hard] <commit>   move the branch back',
    '  git revert HEAD             undo a commit by adding a new one',
    '  git rm [--cached] <file>    stop tracking a file',
    '',
    'Helper commands: touch, echo, cat, ls, rm, clear'
  ].join('\n');

  /* ---------- small helpers ---------- */

  // Split a command line into tokens, keeping quoted text together.
  function tokenize(line) {
    const tokens = [];
    let cur = '';
    let has = false;
    let quote = null;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === quote) quote = null;
        else cur += c;
      } else if (c === '"' || c === "'") {
        quote = c;
        quoted = true;
        has = true;
      } else if (/\s/.test(c)) {
        if (has) tokens.push({ t: cur, q: quoted });
        cur = '';
        has = false;
        quoted = false;
      } else {
        cur += c;
        has = true;
      }
    }
    if (quote) throw new Error('unexpected EOF while looking for matching quote');
    if (has) tokens.push({ t: cur, q: quoted });
    return tokens;
  }

  function toLines(text) {
    if (text === '') return [];
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  // Number of lines kept in common (longest common subsequence), for insertion/deletion counts.
  function commonLines(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  // Turn one statusMatrix row [name, HEAD, WORKDIR, STAGE] into plain facts.
  function describe(row) {
    const [name, h, w, s] = row;
    let staged = null;
    if (h === 0 && s !== 0) staged = 'new';
    else if (h === 1 && s === 0) staged = 'deleted';
    else if (h === 1 && (s === 2 || s === 3)) staged = 'modified';

    let work = null;
    if (s !== 0) {
      if (w === 0) work = 'deleted';
      else if ((s === 1 && w === 2) || s === 3) work = 'modified';
    }
    const untracked = s === 0 && w !== 0;
    return { name, h, w, s, staged, work, untracked };
  }

  function formatDate(author) {
    const off = author.timezoneOffset || 0; // minutes behind UTC, like JS getTimezoneOffset()
    const d = new Date(author.timestamp * 1000 - off * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const sign = off <= 0 ? '+' : '-';
    const abs = Math.abs(off);
    return (
      DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' +
      pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + ' ' +
      d.getUTCFullYear() + ' ' + sign + pad(Math.floor(abs / 60)) + pad(abs % 60)
    );
  }

  // Unified-diff hunks between two arrays of lines, with 3 lines of context (like `git diff`).
  function diffHunks(a, b) {
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { ops.push({ t: ' ', s: a[i] }); i++; j++; }
      else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) { ops.push({ t: '+', s: b[j] }); j++; }
      else { ops.push({ t: '-', s: a[i] }); i++; }
    }

    const ctx = 3;
    const ranges = [];
    ops.forEach((op, k) => {
      if (op.t === ' ') return;
      const lo = Math.max(0, k - ctx);
      const hi = Math.min(ops.length - 1, k + ctx);
      const last = ranges[ranges.length - 1];
      if (last && lo <= last[1] + 1) last[1] = hi;
      else ranges.push([lo, hi]);
    });

    return ranges.map(([lo, hi]) => {
      let oldBefore = 0;
      let newBefore = 0;
      for (let k = 0; k < lo; k++) {
        if (ops[k].t !== '+') oldBefore++;
        if (ops[k].t !== '-') newBefore++;
      }
      const slice = ops.slice(lo, hi + 1);
      const oldCount = slice.filter((o) => o.t !== '+').length;
      const newCount = slice.filter((o) => o.t !== '-').length;
      const oldStart = oldCount === 0 ? oldBefore : oldBefore + 1;
      const newStart = newCount === 0 ? newBefore : newBefore + 1;
      const span = (start, count) => (count === 1 ? String(start) : start + ',' + count);
      const head = '@@ -' + span(oldStart, oldCount) + ' +' + span(newStart, newCount) + ' @@';
      return [head].concat(slice.map((o) => o.t + o.s)).join('\n');
    });
  }

  // Each commit once, newest first, never a parent before its children (like `git log`).
  function orderLog(entries) {
    const byOid = new Map();
    entries.forEach((e) => { if (!byOid.has(e.oid)) byOid.set(e.oid, e); });
    // Discovery order: follow first parents first, so ties favour the main line.
    const order = new Map();
    const visit = (oid) => {
      if (order.has(oid) || !byOid.has(oid)) return;
      order.set(oid, order.size);
      byOid.get(oid).parents.forEach(visit);
    };
    const roots = entries.length ? [entries[0].oid] : [];
    roots.forEach(visit);
    byOid.forEach((e, oid) => visit(oid));
    const waiting = new Map(); // commit -> number of children not yet listed
    byOid.forEach((e) => waiting.set(e.oid, 0));
    byOid.forEach((e) => e.parents.forEach((p) => { if (waiting.has(p)) waiting.set(p, waiting.get(p) + 1); }));
    const out = [];
    const ready = Array.from(byOid.values()).filter((e) => waiting.get(e.oid) === 0);
    while (ready.length) {
      ready.sort((a, b) => b.author.timestamp - a.author.timestamp || order.get(a.oid) - order.get(b.oid));
      const next = ready.shift();
      out.push(next);
      next.parents.forEach((p) => {
        if (!waiting.has(p)) return;
        waiting.set(p, waiting.get(p) - 1);
        if (waiting.get(p) === 0) ready.push(byOid.get(p));
      });
    }
    return out;
  }

  const ok = (kind, out) => ({ ok: true, kind, out: out || '' });
  const fail = (kind, out) => ({ ok: false, kind, out });

  /* ---------- the engine ---------- */

  class Engine {
    constructor() {
      this.fs = null;
      this.pfs = null;
      this.initialized = false;
    }

    // Start over with an empty folder. Await this before running commands.
    async reset() {
      // A fresh database name each time: reusing one name kept old commits across reloads.
      await this.dropOldDatabases();
      this.dbName = 'gitcourse-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      this.fs = new LightningFS(this.dbName);
      this.pfs = this.fs.promises;
      await this.pfs.mkdir(DIR);
      this.initialized = false;
    }

    // Delete every earlier lesson database (ours all start with "gitcourse").
    async dropOldDatabases() {
      if (!window.indexedDB || !indexedDB.databases) return;
      try {
        const dbs = await indexedDB.databases();
        dbs
          .filter((d) => d.name && d.name.indexOf('gitcourse') === 0 && d.name !== this.dbName)
          .forEach((d) => indexedDB.deleteDatabase(d.name));
      } catch (e) {
        /* cleanup is best effort */
      }
    }

    get gitArgs() {
      return { fs: this.fs, dir: DIR };
    }

    async fileExists(name) {
      try {
        await this.pfs.stat(DIR + '/' + name);
        return true;
      } catch (e) {
        return false;
      }
    }

    async readText(name) {
      return dec.decode(await this.pfs.readFile(DIR + '/' + name));
    }

    // Everything the diagram and the practice checks need to know.
    async getState() {
      const state = {
        initialized: this.initialized, branch: 'main', head: 'main',
        files: [], commits: [], branches: [], allCommits: []
      };
      const names = (await this.pfs.readdir(DIR)).filter((n) => n !== '.git');
      if (!this.initialized) {
        state.files = names.sort().map((name) => ({ name, staged: null, work: null, untracked: true, h: 0, w: 2, s: 0 }));
        return state;
      }
      const matrix = await git.statusMatrix(this.gitArgs);
      state.files = matrix.map(describe).sort((a, b) => (a.name < b.name ? -1 : 1));
      state.head = (await git.currentBranch({ ...this.gitArgs, fullname: false })) || 'main';
      state.branch = state.head;
      const entry = (e) => ({
        oid: e.oid,
        short: e.oid.slice(0, 7),
        message: e.commit.message.trim(),
        author: e.commit.author,
        parents: e.commit.parent
      });
      try {
        state.commits = orderLog((await git.log(this.gitArgs)).map(entry));
      } catch (e) {
        state.commits = [];
      }
      // Every branch and every commit reachable from one, for the history lanes.
      const seen = new Map();
      for (const name of (await git.listBranches(this.gitArgs)).sort()) {
        const tip = await git.resolveRef({ ...this.gitArgs, ref: 'refs/heads/' + name });
        state.branches.push({ name, oid: tip });
        for (const e of await git.log({ ...this.gitArgs, ref: name })) {
          if (!seen.has(e.oid)) seen.set(e.oid, entry(e));
        }
      }
      state.allCommits = Array.from(seen.values());
      return state;
    }

    // Run one command line, the way a terminal would. Returns { ok, kind, out }.
    async run(line) {
      line = line.trim();
      if (!line) return ok('noop');
      let toks;
      try {
        toks = tokenize(line);
      } catch (e) {
        return fail('error', 'bash: ' + e.message);
      }

      // Support one trailing redirect for echo: echo text > file, echo text >> file
      let redirect = null;
      const ri = toks.findIndex((x) => !x.q && (x.t === '>' || x.t === '>>'));
      if (ri !== -1) {
        if (toks[0].t !== 'echo') return fail('error', 'bash: redirects only work with echo in this course');
        if (!toks[ri + 1] || toks.length > ri + 2) return fail('error', 'bash: syntax error near unexpected token');
        redirect = { mode: toks[ri].t, file: toks[ri + 1].t };
        toks = toks.slice(0, ri);
      }

      const cmd = toks[0].t;
      const args = toks.slice(1).map((x) => x.t);

      try {
        switch (cmd) {
          case 'git': return await this.git(args);
          case 'touch': return await this.touch(args);
          case 'echo': return await this.echo(args, redirect);
          case 'cat': return await this.cat(args);
          case 'ls': return await this.ls(args);
          case 'rm': return await this.rm(args);
          case 'pwd': return ok('pwd', SHOWN_DIR);
          case 'help': return ok('help', GIT_HELP);
          default: return fail('unknown', 'bash: ' + cmd + ': command not found. Type help to see what works here.');
        }
      } catch (e) {
        return fail('error', 'error: ' + (e && e.message ? e.message : e));
      }
    }

    /* ----- helper commands ----- */

    async touch(files) {
      if (!files.length) return fail('touch', 'touch: missing file operand');
      for (const f of files) {
        if (!(await this.fileExists(f))) await this.pfs.writeFile(DIR + '/' + f, '');
      }
      return ok('touch');
    }

    async echo(args, redirect) {
      const text = args.join(' ');
      if (!redirect) return ok('echo', text);
      const path = DIR + '/' + redirect.file;
      if (redirect.mode === '>>' && (await this.fileExists(redirect.file))) {
        const old = await this.readText(redirect.file);
        await this.pfs.writeFile(path, old + text + '\n');
      } else {
        await this.pfs.writeFile(path, text + '\n');
      }
      return ok('write');
    }

    async cat(files) {
      if (!files.length) return fail('cat', 'cat: missing file operand');
      const out = [];
      for (const f of files) {
        if (!(await this.fileExists(f))) return fail('cat', 'cat: ' + f + ': No such file or directory');
        out.push((await this.readText(f)).replace(/\n$/, ''));
      }
      return ok('cat', out.join('\n'));
    }

    async ls(args) {
      let names = (await this.pfs.readdir(DIR)).filter((n) => n !== '.git').sort();
      if (args.includes('-a')) names = ['.', '..'].concat(this.initialized ? ['.git'] : [], names);
      return ok('ls', names.join('  '));
    }

    async rm(files) {
      if (!files.length) return fail('rm', 'rm: missing operand');
      for (const f of files) {
        if (!(await this.fileExists(f))) return fail('rm', "rm: cannot remove '" + f + "': No such file or directory");
        await this.pfs.unlink(DIR + '/' + f);
      }
      return ok('rm');
    }

    /* ----- git commands ----- */

    async git(args) {
      const sub = args[0];
      if (!sub) return ok('git', 'usage: git <command>. Type help to see the commands used in this course.');
      if (sub === 'init') return this.gitInit();
      const supported = ['status', 'add', 'commit', 'log', 'diff', 'branch', 'switch', 'checkout', 'merge', 'restore', 'reset', 'revert', 'rm'];
      if (supported.indexOf(sub) === -1) {
        return fail('git', "git: '" + sub + "' is not part of this course yet. Type help to see what works.");
      }
      if (!this.initialized) {
        return fail(sub, 'fatal: not a git repository (or any of the parent directories): .git');
      }
      if (sub === 'status') return this.gitStatus();
      if (sub === 'add') return this.gitAdd(args.slice(1));
      if (sub === 'commit') return this.gitCommit(args.slice(1));
      if (sub === 'diff') return this.gitDiff(args.slice(1));
      if (sub === 'branch') return this.gitBranch(args.slice(1));
      if (sub === 'switch' || sub === 'checkout') return this.gitSwitch(args.slice(1), sub);
      if (sub === 'merge') return this.gitMerge(args.slice(1));
      if (sub === 'restore') return this.gitRestore(args.slice(1));
      if (sub === 'reset') return this.gitReset(args.slice(1));
      if (sub === 'revert') return this.gitRevert(args.slice(1));
      if (sub === 'rm') return this.gitRm(args.slice(1));
      return this.gitLog(args.slice(1));
    }

    async gitInit() {
      const again = this.initialized;
      await git.init({ ...this.gitArgs, defaultBranch: 'main' });
      this.initialized = true;
      return ok(
        'init',
        (again ? 'Reinitialized existing' : 'Initialized empty') + ' Git repository in ' + SHOWN_DIR + '/.git/'
      );
    }

    async gitStatus() {
      const state = await this.getState();
      return ok('status', this.statusText(state));
    }

    statusText(state) {
      const lines = ['On branch ' + state.head];
      const noCommits = state.commits.length === 0;
      if (noCommits) lines.push('', 'No commits yet');

      const staged = state.files.filter((f) => f.staged);
      const unstaged = state.files.filter((f) => f.work);
      const untracked = state.files.filter((f) => f.untracked);
      const label = { new: 'new file:   ', modified: 'modified:   ', deleted: 'deleted:    ' };

      if (staged.length) {
        lines.push('', 'Changes to be committed:');
        lines.push(noCommits
          ? '  (use "git rm --cached <file>..." to unstage)'
          : '  (use "git restore --staged <file>..." to unstage)');
        staged.forEach((f) => lines.push('\t' + label[f.staged] + f.name));
      }
      if (unstaged.length) {
        lines.push('', 'Changes not staged for commit:');
        lines.push('  (use "git add <file>..." to update what will be committed)');
        lines.push('  (use "git restore <file>..." to discard changes in working directory)');
        unstaged.forEach((f) => lines.push('\t' + label[f.work] + f.name));
      }
      if (untracked.length) {
        lines.push('', 'Untracked files:');
        lines.push('  (use "git add <file>..." to include in what will be committed)');
        untracked.forEach((f) => lines.push('\t' + f.name));
      }
      if (!staged.length) {
        lines.push('');
        if (unstaged.length) lines.push('no changes added to commit (use "git add" and/or "git commit -a")');
        else if (untracked.length) lines.push('nothing added to commit but untracked files present (use "git add" to track)');
        else if (noCommits) lines.push('nothing to commit (create/copy files and use "git add" to track)');
        else lines.push('nothing to commit, working tree clean');
      }
      return lines.join('\n');
    }

    async gitAdd(paths) {
      if (!paths.length) {
        return fail('add', "Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?");
      }
      const matrix = await git.statusMatrix(this.gitArgs);
      const known = new Set(matrix.map((r) => r[0]));
      const targets = [];
      for (const p of paths) {
        if (p === '.' || p === '-A' || p === '--all') {
          matrix.map(describe).forEach((f) => {
            if (f.untracked || f.work) targets.push(f.name);
          });
        } else if ((await this.fileExists(p)) || known.has(p)) {
          if (!known.has(p) && (await git.isIgnored({ ...this.gitArgs, filepath: p }))) {
            return fail('add',
              'The following paths are ignored by one of your .gitignore files:\n' + p + '\n' +
              'hint: Use -f if you really want to add them.\n' +
              'hint: Turn this message off by running\n' +
              'hint: "git config advice.addIgnoredFile false"');
          }
          targets.push(p);
        } else {
          return fail('add', "fatal: pathspec '" + p + "' did not match any files");
        }
      }
      for (const name of new Set(targets)) {
        if (await this.fileExists(name)) await git.add({ ...this.gitArgs, filepath: name });
        else await git.remove({ ...this.gitArgs, filepath: name });
      }
      return ok('add');
    }

    async gitCommit(args) {
      let message = null;
      let all = false;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-m') {
          if (args[i + 1] === undefined) return fail('commit', "error: switch `m' requires a value");
          message = args[++i];
        } else if (a === '-a') {
          all = true;
        } else if (a === '-am') {
          all = true;
          if (args[i + 1] === undefined) return fail('commit', "error: switch `m' requires a value");
          message = args[++i];
        } else if (a.indexOf('--message=') === 0) {
          message = a.slice(10);
        } else {
          return fail('commit', "error: this course does not support the option '" + a + "' yet");
        }
      }

      if (all) {
        const matrix = await git.statusMatrix(this.gitArgs);
        for (const f of matrix.map(describe)) {
          if (f.untracked) continue;
          if (f.work === 'modified') await git.add({ ...this.gitArgs, filepath: f.name });
          else if (f.work === 'deleted') await git.remove({ ...this.gitArgs, filepath: f.name });
        }
      }

      const state = await this.getState();
      const staged = state.files.filter((f) => f.staged);
      if (!staged.length) {
        // Real Git shows the same text as "git status" and exits with an error.
        return fail('commit', this.statusText(state));
      }
      if (message === null) {
        return fail('commit',
          'This course has no text editor, so Git cannot ask you for a message.\n' +
          'Write it on the same line instead:  git commit -m "your message"');
      }
      if (!message.trim()) return fail('commit', 'Aborting commit due to empty commit message.');

      const parent = state.commits[0] ? state.commits[0].oid : null;
      const oid = await git.commit({ ...this.gitArgs, message, author: AUTHOR });

      const summary = await this.commitSummary(staged, parent, oid);
      const head = '[' + state.head + ' ' + (parent ? '' : '(root-commit) ') + oid.slice(0, 7) + '] ' + message.split('\n')[0];
      return ok('commit', head + '\n' + summary);
    }

    async blobLines(oid, filepath) {
      if (!oid) return [];
      try {
        const { blob } = await git.readBlob({ ...this.gitArgs, oid, filepath });
        return toLines(dec.decode(blob));
      } catch (e) {
        return [];
      }
    }

    // The "1 file changed, 2 insertions(+)" lines that Git prints after a commit.
    async commitSummary(staged, parentOid, newOid) {
      let ins = 0;
      let del = 0;
      const notes = [];
      for (const f of staged) {
        const before = await this.blobLines(parentOid, f.name);
        const after = f.staged === 'deleted' ? [] : await this.blobLines(newOid, f.name);
        const same = commonLines(before, after);
        ins += after.length - same;
        del += before.length - same;
        if (f.staged === 'new') notes.push(' create mode 100644 ' + f.name);
        if (f.staged === 'deleted') notes.push(' delete mode 100644 ' + f.name);
      }
      const parts = [plural(staged.length, 'file') + ' changed'];
      if (ins) parts.push(plural(ins, 'insertion') + '(+)');
      if (del) parts.push(plural(del, 'deletion') + '(-)');
      if (!ins && !del) parts.push('0 insertions(+)', '0 deletions(-)');
      return [' ' + parts.join(', ')].concat(notes).join('\n');
    }

    /* ----- diff ----- */

    async headOid() {
      try {
        return await git.resolveRef({ ...this.gitArgs, ref: 'HEAD' });
      } catch (e) {
        return null;
      }
    }

    // Text of a file as stored in the staging area, or null if it is not there.
    async indexText(filepath) {
      const found = await git.walk({
        ...this.gitArgs,
        trees: [git.STAGE()],
        map: async (fp, entries) => {
          if (fp !== filepath || !entries[0]) return undefined;
          return { oid: await entries[0].oid() };
        }
      });
      const hit = found.find(Boolean);
      if (!hit) return null;
      const { blob } = await git.readBlob({ ...this.gitArgs, oid: hit.oid });
      return dec.decode(blob);
    }

    async headText(filepath) {
      const head = await this.headOid();
      if (!head) return null;
      try {
        const { blob } = await git.readBlob({ ...this.gitArgs, oid: head, filepath });
        return dec.decode(blob);
      } catch (e) {
        return null;
      }
    }

    async shortHash(text) {
      if (text === null) return '0000000';
      const { oid } = await git.hashBlob({ object: enc.encode(text) });
      return oid.slice(0, 7);
    }

    // Header and hunks for one file, in the format of `git diff`.
    async fileDiff(name, before, after) {
      const lines = ['diff --git a/' + name + ' b/' + name];
      if (before === null) lines.push('new file mode 100644');
      if (after === null) lines.push('deleted file mode 100644');
      const a = await this.shortHash(before);
      const b = await this.shortHash(after);
      lines.push('index ' + a + '..' + b + (before !== null && after !== null ? ' 100644' : ''));
      const hunks = diffHunks(toLines(before || ''), toLines(after || ''));
      if (!hunks.length && before !== null && after !== null) return null;
      lines.push('--- ' + (before === null ? '/dev/null' : 'a/' + name));
      lines.push('+++ ' + (after === null ? '/dev/null' : 'b/' + name));
      return lines.concat(hunks).join('\n');
    }

    async gitDiff(flags) {
      const staged = flags.includes('--staged') || flags.includes('--cached');
      const bad = flags.filter((f) => f !== '--staged' && f !== '--cached');
      if (bad.length) return fail('diff', "fatal: this course does not support '" + bad[0] + "' yet");
      const state = await this.getState();
      const out = [];
      for (const f of state.files) {
        let before;
        let after;
        if (staged) {
          if (!f.staged) continue;
          before = await this.headText(f.name);
          after = f.staged === 'deleted' ? null : await this.indexText(f.name);
        } else {
          if (!f.work) continue;
          before = await this.indexText(f.name);
          after = f.work === 'deleted' ? null : await this.readText(f.name);
        }
        const d = await this.fileDiff(f.name, before, after);
        if (d) out.push(d);
      }
      return ok('diff', out.join('\n'));
    }

    async gitLog(flags) {
      const oneline = flags.includes('--oneline');
      const bad = flags.filter((f) => f !== '--oneline');
      if (bad.length) return fail('log', "fatal: this course does not support '" + bad[0] + "' yet");
      const state = await this.getState();
      if (!state.commits.length) {
        return fail('log', "fatal: your current branch '" + state.head + "' does not have any commits yet");
      }
      // Branch names to show next to a commit, current branch first: (HEAD -> main, feature)
      const decorate = (oid) => {
        const names = state.branches.filter((b) => b.oid === oid).map((b) => b.name);
        names.sort((a, b) => (a === state.head ? -1 : b === state.head ? 1 : a < b ? -1 : 1));
        if (!names.length) return '';
        return ' (' + names.map((n) => (n === state.head ? 'HEAD -> ' + n : n)).join(', ') + ')';
      };
      const out = state.commits.map((c) => {
        const deco = decorate(c.oid);
        if (oneline) return c.short + deco + ' ' + c.message.split('\n')[0];
        return [
          'commit ' + c.oid + deco,
          'Author: ' + c.author.name + ' <' + c.author.email + '>',
          'Date:   ' + formatDate(c.author),
          '',
          '    ' + c.message.split('\n').join('\n    ')
        ].join('\n');
      });
      return ok('log', out.join(oneline ? '\n' : '\n\n'));
    }

    /* ----- helpers for branches, merging and undoing ----- */

    // Map of path -> blob id for every file in a commit.
    async snapshot(oid) {
      if (!oid) return new Map();
      const found = await git.walk({
        ...this.gitArgs,
        trees: [git.TREE({ ref: oid })],
        map: async (fp, entries) => {
          if (fp === '.' || !entries[0]) return undefined;
          if ((await entries[0].type()) !== 'blob') return undefined;
          return { path: fp, oid: await entries[0].oid() };
        }
      });
      return new Map(found.filter(Boolean).map((f) => [f.path, f.oid]));
    }

    async blobTextByOid(oid) {
      if (!oid) return '';
      const { blob } = await git.readBlob({ ...this.gitArgs, oid });
      return dec.decode(blob);
    }

    async parentOf(oid) {
      const { commit } = await git.readCommit({ ...this.gitArgs, oid });
      return commit.parent[0] || null;
    }

    // HEAD, HEAD~2, HEAD^, a branch name, or a (short) commit id -> full id, or null.
    async resolveCommit(text) {
      const m = /^([^~^]+)((?:~\d*|\^)*)$/.exec(text);
      if (!m) return null;
      let oid = null;
      try {
        if (m[1] === 'HEAD') oid = await this.headOid();
        else {
          try {
            oid = await git.resolveRef({ ...this.gitArgs, ref: 'refs/heads/' + m[1] });
          } catch (e) {
            oid = await git.expandOid({ ...this.gitArgs, oid: m[1] });
          }
        }
        for (const op of m[2].match(/~\d*|\^/g) || []) {
          const n = op === '^' ? 1 : parseInt(op.slice(1) || '1', 10);
          for (let i = 0; i < n && oid; i++) oid = await this.parentOf(oid);
        }
      } catch (e) {
        return null;
      }
      return oid;
    }

    // Is `ancestor` reachable from `oid`?
    async isAncestor(ancestor, oid) {
      if (ancestor === oid) return true;
      const log = await git.log({ ...this.gitArgs, ref: oid });
      return log.some((e) => e.oid === ancestor);
    }

    // Per-file line counts between two snapshots, plus the text Git prints for them.
    async changeSummary(before, after) {
      const rows = [];
      const paths = Array.from(new Set([...before.keys(), ...after.keys()])).sort();
      for (const p of paths) {
        if (before.get(p) === after.get(p)) continue;
        const a = toLines(await this.blobTextByOid(before.get(p)));
        const b = toLines(await this.blobTextByOid(after.get(p)));
        const same = commonLines(a, b);
        rows.push({ path: p, ins: b.length - same, del: a.length - same, created: !before.has(p), removed: !after.has(p) });
      }
      if (!rows.length) return '';
      const nameW = Math.max(...rows.map((r) => r.path.length));
      const numW = Math.max(...rows.map((r) => String(r.ins + r.del).length));
      const lines = rows.map((r) =>
        ' ' + r.path.padEnd(nameW) + ' | ' + String(r.ins + r.del).padStart(numW) + ' ' + '+'.repeat(r.ins) + '-'.repeat(r.del));
      const ins = rows.reduce((n, r) => n + r.ins, 0);
      const del = rows.reduce((n, r) => n + r.del, 0);
      const parts = [plural(rows.length, 'file') + ' changed'];
      if (ins) parts.push(plural(ins, 'insertion') + '(+)');
      if (del) parts.push(plural(del, 'deletion') + '(-)');
      if (!ins && !del) parts.push('0 insertions(+)', '0 deletions(-)');
      lines.push(' ' + parts.join(', '));
      rows.forEach((r) => {
        if (r.created) lines.push(' create mode 100644 ' + r.path);
        if (r.removed) lines.push(' delete mode 100644 ' + r.path);
      });
      return lines.join('\n');
    }

    // Tracked files with uncommitted changes (staged or not).
    async dirtyFiles() {
      const state = await this.getState();
      return state.files.filter((f) => f.staged || f.work).map((f) => f.name);
    }

    /* ----- branches ----- */

    async gitBranch(args) {
      const state = await this.getState();
      const flags = args.filter((a) => a[0] === '-');
      const names = args.filter((a) => a[0] !== '-');

      if (flags.includes('-d') || flags.includes('-D')) {
        if (!names.length) return fail('branch', 'fatal: branch name required');
        const force = flags.includes('-D');
        const out = [];
        for (const n of names) {
          const b = state.branches.find((x) => x.name === n);
          if (!b) return fail('branch', "error: branch '" + n + "' not found");
          if (n === state.head) return fail('branch', "error: cannot delete branch '" + n + "' used by worktree at '" + SHOWN_DIR + "'");
          const headTip = state.commits[0] && state.commits[0].oid;
          if (!force && !(await this.isAncestor(b.oid, headTip))) {
            return fail('branch',
              "error: the branch '" + n + "' is not fully merged.\n" +
              "hint: If you are sure you want to delete it, run 'git branch -D " + n + "'");
          }
          await git.deleteBranch({ ...this.gitArgs, ref: n });
          out.push('Deleted branch ' + n + ' (was ' + b.oid.slice(0, 7) + ').');
        }
        return ok('branch', out.join('\n'));
      }
      const unknown = flags.filter((f) => f !== '-d' && f !== '-D');
      if (unknown.length) return fail('branch', "error: this course does not support the option '" + unknown[0] + "' yet");

      if (!names.length) {
        const lines = state.branches.map((b) => (b.name === state.head ? '* ' : '  ') + b.name);
        return ok('branch', lines.join('\n'));
      }
      const name = names[0];
      if (!/^[A-Za-z0-9._\/-]+$/.test(name)) return fail('branch', "fatal: '" + name + "' is not a valid branch name");
      if (!state.commits.length) return fail('branch', "fatal: not a valid object name: '" + state.head + "'");
      if (state.branches.some((b) => b.name === name)) return fail('branch', "fatal: a branch named '" + name + "' already exists");
      await git.branch({ ...this.gitArgs, ref: name });
      return ok('branch');
    }

    async gitSwitch(args, cmd) {
      const flags = args.filter((a) => a[0] === '-');
      const names = args.filter((a) => a[0] !== '-');
      const create = flags.includes('-c') || flags.includes('-b');
      const bad = flags.filter((f) => f !== '-c' && f !== '-b');
      if (bad.length) return fail('switch', "error: this course does not support the option '" + bad[0] + "' yet");
      if (!names.length) return fail('switch', cmd === 'switch' ? 'fatal: missing branch or commit argument' : 'fatal: this course needs a branch name after git checkout');
      const target = names[0];
      const state = await this.getState();
      const exists = state.branches.some((b) => b.name === target);

      if (create) {
        if (!/^[A-Za-z0-9._\/-]+$/.test(target)) return fail('switch', "fatal: '" + target + "' is not a valid branch name");
        if (exists) return fail('switch', "fatal: a branch named '" + target + "' already exists");
        if (!state.commits.length) {
          await git.writeRef({ ...this.gitArgs, ref: 'HEAD', value: 'refs/heads/' + target, symbolic: true, force: true });
        } else {
          await git.branch({ ...this.gitArgs, ref: target, checkout: true });
        }
        return ok('switch', "Switched to a new branch '" + target + "'");
      }
      if (!exists) {
        return fail('switch', cmd === 'switch'
          ? "fatal: invalid reference: " + target
          : "error: pathspec '" + target + "' did not match any file(s) known to git");
      }
      if (target === state.head) return ok('switch', "Already on '" + target + "'");

      // Refuse if uncommitted work would be overwritten, like Git does.
      const dirty = await this.dirtyFiles();
      if (dirty.length) {
        const here = await this.snapshot(state.commits[0] && state.commits[0].oid);
        const there = await this.snapshot(state.branches.find((b) => b.name === target).oid);
        const clash = dirty.filter((f) => here.get(f) !== there.get(f));
        if (clash.length) {
          return fail('switch',
            'error: Your local changes to the following files would be overwritten by checkout:\n' +
            clash.map((f) => '\t' + f).join('\n') + '\n' +
            'Please commit your changes or stash them before you switch branches.\nAborting');
        }
      }
      await git.checkout({ ...this.gitArgs, ref: target });
      return ok('switch', "Switched to branch '" + target + "'");
    }

    /* ----- merging ----- */

    async gitMerge(args) {
      const names = args.filter((a) => a[0] !== '-');
      const flags = args.filter((a) => a[0] === '-');
      if (flags.length) return fail('merge', "error: this course does not support the option '" + flags[0] + "' yet");
      if (!names.length) return fail('merge', 'fatal: specify a branch to merge');
      const target = names[0];
      const state = await this.getState();
      const theirs = state.branches.find((b) => b.name === target);
      if (!theirs) return fail('merge', 'merge: ' + target + ' - not something we can merge');
      const oursOid = state.commits[0] && state.commits[0].oid;
      if (!oursOid) return fail('merge', 'fatal: there is nothing to merge into yet');
      if (await this.isAncestor(theirs.oid, oursOid)) return ok('merge', 'Already up to date.');

      const before = await this.snapshot(oursOid);
      const after = await this.snapshot(theirs.oid);
      const touched = Array.from(new Set([...before.keys(), ...after.keys()])).filter((p) => before.get(p) !== after.get(p));
      const dirty = (await this.dirtyFiles()).filter((f) => touched.includes(f));
      if (dirty.length) {
        return fail('merge',
          'error: Your local changes to the following files would be overwritten by merge:\n' +
          dirty.map((f) => '\t' + f).join('\n') + '\n' +
          'Please commit your changes or stash them before you merge.\nAborting');
      }

      const fastForward = await this.isAncestor(oursOid, theirs.oid);
      try {
        await git.merge({
          ...this.gitArgs, ours: state.head, theirs: target,
          author: AUTHOR, message: "Merge branch '" + target + "'", fastForwardOnly: false
        });
      } catch (e) {
        const files = (e && e.data && e.data.filepaths) || [];
        return fail('merge',
          files.map((f) => 'CONFLICT (content): Merge conflict in ' + f).join('\n') +
          '\nAutomatic merge failed; fix conflicts and then commit the result.');
      }
      await git.checkout({ ...this.gitArgs, ref: state.head });
      const newTip = await this.headOid();
      const stat = await this.changeSummary(before, await this.snapshot(newTip));
      const head = fastForward
        ? 'Updating ' + oursOid.slice(0, 7) + '..' + newTip.slice(0, 7) + '\nFast-forward'
        : "Merge made by the 'ort' strategy.";
      return ok('merge', head + (stat ? '\n' + stat : ''));
    }

    /* ----- undoing ----- */

    async gitRestore(args) {
      const flags = args.filter((a) => a[0] === '-');
      const paths = args.filter((a) => a[0] !== '-');
      const staged = flags.includes('--staged') || flags.includes('-S');
      const bad = flags.filter((f) => !['--staged', '-S', '--worktree', '-W'].includes(f));
      if (bad.length) return fail('restore', "error: this course does not support the option '" + bad[0] + "' yet");
      if (!paths.length) return fail('restore', 'fatal: you must specify path(s) to restore');
      const state = await this.getState();
      const known = new Set(state.files.filter((f) => !f.untracked || f.staged).map((f) => f.name));
      let targets = paths;
      if (paths.includes('.')) targets = Array.from(known);
      for (const p of targets) {
        if (!known.has(p)) return fail('restore', "error: pathspec '" + p + "' did not match any file(s) known to git");
      }
      for (const p of targets) {
        if (staged) {
          if (state.commits.length) await git.resetIndex({ ...this.gitArgs, filepath: p });
          else await git.remove({ ...this.gitArgs, filepath: p });
        } else {
          const text = await this.indexText(p);
          if (text !== null) await this.pfs.writeFile(DIR + '/' + p, text);
        }
      }
      return ok('restore');
    }

    async gitReset(args) {
      const flags = args.filter((a) => a[0] === '-');
      const rest = args.filter((a) => a[0] !== '-');
      const modes = ['--soft', '--mixed', '--hard'];
      const bad = flags.filter((f) => !modes.includes(f));
      if (bad.length) return fail('reset', "error: this course does not support the option '" + bad[0] + "' yet");
      const mode = (flags.find((f) => modes.includes(f)) || '--mixed').slice(2);
      const state = await this.getState();
      if (!state.commits.length) return fail('reset', "fatal: Failed to resolve 'HEAD' as a valid ref.");

      // "git reset <file>" unstages a file; "git reset <commit>" moves the branch.
      let target = null;
      let pathArgs = [];
      if (rest.length) {
        target = await this.resolveCommit(rest[0]);
        if (!target) pathArgs = rest;
      }
      if (pathArgs.length) {
        if (mode !== 'mixed') return fail('reset', 'fatal: Cannot do ' + mode + ' reset with paths.');
        const known = new Set(state.files.map((f) => f.name));
        for (const p of pathArgs) {
          if (!known.has(p)) return fail('reset', "fatal: ambiguous argument '" + p + "': unknown revision or path not in the working tree.");
        }
        for (const p of pathArgs) await git.resetIndex({ ...this.gitArgs, filepath: p });
        return ok('reset');
      }
      if (!target) target = state.commits[0].oid;

      const oldSnap = await this.snapshot(state.commits[0].oid);
      await git.writeRef({ ...this.gitArgs, ref: 'refs/heads/' + state.head, value: target, force: true });
      const newSnap = await this.snapshot(target);
      const everyPath = Array.from(new Set([...state.files.map((f) => f.name), ...oldSnap.keys(), ...newSnap.keys()]));

      if (mode === 'hard') {
        for (const p of everyPath) {
          const tracked = state.files.some((f) => f.name === p && !f.untracked) || oldSnap.has(p);
          if (newSnap.has(p)) {
            await this.pfs.writeFile(DIR + '/' + p, await this.blobTextByOid(newSnap.get(p)));
            await git.resetIndex({ ...this.gitArgs, filepath: p });
          } else if (tracked) {
            if (await this.fileExists(p)) await this.pfs.unlink(DIR + '/' + p);
            await git.remove({ ...this.gitArgs, filepath: p });
          }
        }
        const { commit } = await git.readCommit({ ...this.gitArgs, oid: target });
        return ok('reset', 'HEAD is now at ' + target.slice(0, 7) + ' ' + commit.message.trim().split('\n')[0]);
      }
      if (mode === 'mixed') {
        for (const p of everyPath) {
          const isNewUntracked = state.files.some((f) => f.name === p && f.untracked);
          if (!isNewUntracked) await git.resetIndex({ ...this.gitArgs, filepath: p });
        }
        const after = await this.getState();
        const left = after.files.filter((f) => f.work);
        if (left.length) {
          return ok('reset', 'Unstaged changes after reset:\n' + left.map((f) => (f.work === 'deleted' ? 'D' : 'M') + '\t' + f.name).join('\n'));
        }
      }
      return ok('reset');
    }

    async gitRevert(args) {
      const names = args.filter((a) => a[0] !== '-');
      const flags = args.filter((a) => a[0] !== '-' ? false : a !== '--no-edit');
      if (flags.length) return fail('revert', "error: this course does not support the option '" + flags[0] + "' yet");
      if (!names.length) return fail('revert', 'fatal: revert needs a commit, for example: git revert HEAD');
      const state = await this.getState();
      if (!state.commits.length) return fail('revert', "fatal: bad revision '" + names[0] + "'");
      const target = await this.resolveCommit(names[0]);
      if (!target) return fail('revert', "fatal: bad revision '" + names[0] + "'");
      if (target !== state.commits[0].oid) {
        return fail('revert', 'This course can only revert the latest commit: git revert HEAD');
      }
      const dirty = await this.dirtyFiles();
      if (dirty.length) {
        return fail('revert', 'error: your local changes would be overwritten by revert.\nhint: commit your changes or stash them to proceed.\nfatal: revert failed');
      }
      const before = await this.snapshot(target);
      const parent = await this.parentOf(target);
      const parentSnap = await this.snapshot(parent);
      for (const p of new Set([...before.keys(), ...parentSnap.keys()])) {
        if (before.get(p) === parentSnap.get(p)) continue;
        if (parentSnap.has(p)) {
          await this.pfs.writeFile(DIR + '/' + p, await this.blobTextByOid(parentSnap.get(p)));
          await git.add({ ...this.gitArgs, filepath: p });
        } else {
          if (await this.fileExists(p)) await this.pfs.unlink(DIR + '/' + p);
          await git.remove({ ...this.gitArgs, filepath: p });
        }
      }
      const subject = state.commits[0].message.split('\n')[0];
      const oid = await git.commit({
        ...this.gitArgs, author: AUTHOR,
        message: 'Revert "' + subject + '"\n\nThis reverts commit ' + target + '.\n'
      });
      const stat = await this.changeSummary(before, await this.snapshot(oid));
      const summary = stat.split('\n').filter((l) => /changed|mode/.test(l)).join('\n');
      return ok('revert', '[' + state.head + ' ' + oid.slice(0, 7) + '] Revert "' + subject + '"\n' + summary);
    }

    async gitRm(args) {
      const flags = args.filter((a) => a[0] === '-');
      const paths = args.filter((a) => a[0] !== '-');
      const cached = flags.includes('--cached');
      if (flags.some((f) => f !== '--cached')) return fail('rm', "error: this course does not support the option '" + flags.find((f) => f !== '--cached') + "' yet");
      if (!paths.length) return fail('rm', 'fatal: No pathspec was given. Which files should I remove?');
      const state = await this.getState();
      const tracked = new Set(state.files.filter((f) => f.s !== 0).map((f) => f.name));
      for (const p of paths) {
        if (!tracked.has(p)) return fail('rm', "fatal: pathspec '" + p + "' did not match any files");
      }
      const out = [];
      for (const p of paths) {
        await git.remove({ ...this.gitArgs, filepath: p });
        if (!cached && (await this.fileExists(p))) await this.pfs.unlink(DIR + '/' + p);
        out.push("rm '" + p + "'");
      }
      return ok('rm', out.join('\n'));
    }
  }

  window.GitEngine = Engine;
})();
