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
      const state = { initialized: this.initialized, branch: 'main', files: [], commits: [] };
      const names = (await this.pfs.readdir(DIR)).filter((n) => n !== '.git');
      if (!this.initialized) {
        state.files = names.sort().map((name) => ({ name, staged: null, work: null, untracked: true, h: 0, w: 2, s: 0 }));
        return state;
      }
      const matrix = await git.statusMatrix(this.gitArgs);
      state.files = matrix.map(describe).sort((a, b) => (a.name < b.name ? -1 : 1));
      try {
        const log = await git.log(this.gitArgs);
        state.commits = log.map((e) => ({
          oid: e.oid,
          short: e.oid.slice(0, 7),
          message: e.commit.message.trim(),
          author: e.commit.author
        }));
      } catch (e) {
        state.commits = [];
      }
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
      if (['status', 'add', 'commit', 'log', 'diff'].indexOf(sub) === -1) {
        return fail('git', "git: '" + sub + "' is not part of this course yet. Type help to see what works.");
      }
      if (!this.initialized) {
        return fail(sub, 'fatal: not a git repository (or any of the parent directories): .git');
      }
      if (sub === 'status') return this.gitStatus();
      if (sub === 'add') return this.gitAdd(args.slice(1));
      if (sub === 'commit') return this.gitCommit(args.slice(1));
      if (sub === 'diff') return this.gitDiff(args.slice(1));
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
      const lines = ['On branch main'];
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
      const head = '[main ' + (parent ? '' : '(root-commit) ') + oid.slice(0, 7) + '] ' + message.split('\n')[0];
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
        return fail('log', "fatal: your current branch 'main' does not have any commits yet");
      }
      const out = state.commits.map((c, i) => {
        const deco = i === 0 ? ' (HEAD -> main)' : '';
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
  }

  window.GitEngine = Engine;
})();
