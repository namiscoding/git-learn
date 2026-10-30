/*
 * engine-advanced.js: the parts of Git that the browser Git library does not do.
 *
 *   - three-way merging with conflict markers (merge, pull, rebase and stash all use it)
 *   - merge conflicts: the "unmerged" state, git merge --abort / --continue
 *   - git stash
 *   - git rebase (and pull --rebase), including stopping on conflicts
 *
 * These are written to print what real Git prints for the common situations.
 */
(function () {
  const P = window.GitEngine.prototype;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const AUTHOR = { name: 'You', email: 'you@example.com' };
  const DIR = '/project';

  const toLines = (text) => {
    if (!text) return [];
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  };
  const fromLines = (lines) => (lines.length ? lines.join('\n') + '\n' : '');
  const fail = (kind, out) => ({ ok: false, kind, out });
  const ok = (kind, out) => ({ ok: true, kind, out: out || '' });
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  /* ---------- three-way text merge ---------- */

  // Regions of `base` that `other` replaced: { start, end, lines }.
  function regions(base, other) {
    const n = base.length;
    const m = other.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = base[i] === other[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0;
    let j = 0;
    let cur = null;
    const close = () => { if (cur) { out.push(cur); cur = null; } };
    while (i < n || j < m) {
      if (i < n && j < m && base[i] === other[j]) { close(); i++; j++; continue; }
      if (!cur) cur = { start: i, end: i, lines: [] };
      if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) { cur.lines.push(other[j]); j++; }
      else { i++; cur.end = i; }
    }
    close();
    return out;
  }

  // Merge two edits of `base`. Changes that touch each other become a conflict, like Git.
  function merge3(base, ours, theirs, oursLabel, theirsLabel) {
    const all = regions(base, ours).map((r) => Object.assign(r, { side: 'o' }))
      .concat(regions(base, theirs).map((r) => Object.assign(r, { side: 't' })))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const out = [];
    let pos = 0;
    let conflict = false;
    let i = 0;
    while (i < all.length) {
      const s = all[i].start;
      let e = all[i].end;
      const group = [all[i]];
      i++;
      while (i < all.length && all[i].start <= e) {
        e = Math.max(e, all[i].end);
        group.push(all[i]);
        i++;
      }
      out.push(...base.slice(pos, s));
      const mine = group.filter((r) => r.side === 'o');
      const yours = group.filter((r) => r.side === 't');
      const apply = (regs) => {
        const res = [];
        let p = s;
        regs.forEach((r) => { res.push(...base.slice(p, r.start), ...r.lines); p = r.end; });
        res.push(...base.slice(p, e));
        return res;
      };
      if (!yours.length) out.push(...apply(mine));
      else if (!mine.length) out.push(...apply(yours));
      else {
        const ol = apply(mine);
        const tl = apply(yours);
        if (ol.join('\n') === tl.join('\n')) out.push(...ol);
        else {
          conflict = true;
          out.push('<<<<<<< ' + oursLabel, ...ol, '=======', ...tl, '>>>>>>> ' + theirsLabel);
        }
      }
      pos = e;
    }
    out.push(...base.slice(pos));
    return { text: fromLines(out), conflict };
  }

  /* ---------- shared helpers ---------- */

  // Merge three snapshots (path -> blob id). Returns what to write, what to delete, and conflicts.
  P.mergeSnapshots = async function (base, ours, theirs, oursLabel, theirsLabel) {
    const res = { write: new Map(), remove: [], conflicts: new Map(), lines: [] };
    const paths = Array.from(new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])).sort();
    for (const p of paths) {
      const b = base.get(p);
      const o = ours.get(p);
      const t = theirs.get(p);
      if (o === t) continue;
      if (b === o) {
        if (t === undefined) res.remove.push(p);
        else res.write.set(p, await this.blobTextByOid(t));
        continue;
      }
      if (b === t) continue;
      if (o === undefined || t === undefined) {
        // One side deleted the file, the other changed it.
        const deletedBy = o === undefined ? oursLabel : theirsLabel;
        const keptBy = o === undefined ? theirsLabel : oursLabel;
        res.conflicts.set(p, {
          kind: o === undefined ? 'deleted by us' : 'deleted by them',
          content: await this.blobTextByOid(o === undefined ? t : o)
        });
        res.lines.push('CONFLICT (modify/delete): ' + p + ' deleted in ' + deletedBy + ' and modified in ' + keptBy + '.  Version ' + keptBy + ' of ' + p + ' left in tree.');
        continue;
      }
      const m = merge3(
        toLines(await this.blobTextByOid(b)),
        toLines(await this.blobTextByOid(o)),
        toLines(await this.blobTextByOid(t)),
        oursLabel, theirsLabel
      );
      if (m.conflict) {
        res.conflicts.set(p, { kind: b === undefined ? 'both added' : 'both modified', content: m.text });
        if (b === undefined) res.lines.push('CONFLICT (add/add): Merge conflict in ' + p);
        else res.lines.push('Auto-merging ' + p, 'CONFLICT (content): Merge conflict in ' + p);
      } else {
        res.write.set(p, m.text);
        res.lines.push('Auto-merging ' + p);
      }
    }
    return res;
  };

  // Put merge results into the working folder, and stage the clean ones.
  P.applyMergeResult = async function (res) {
    for (const [p, text] of res.write) {
      await this.pfs.writeFile(DIR + '/' + p, text);
      await git.add({ ...this.gitArgs, filepath: p });
    }
    for (const p of res.remove) {
      if (await this.fileExists(p)) await this.pfs.unlink(DIR + '/' + p);
      await git.remove({ ...this.gitArgs, filepath: p });
    }
    for (const [p, c] of res.conflicts) await this.pfs.writeFile(DIR + '/' + p, c.content);
  };

  // Make the working folder and staging area match one commit exactly (like git reset --hard).
  P.restoreTree = async function (oid) {
    const target = await this.snapshot(oid);
    const matrix = await git.statusMatrix(this.gitArgs);
    const tracked = matrix.filter((r) => r[1] === 1 || r[3] !== 0).map((r) => r[0]);
    for (const [p, blob] of target) {
      await this.pfs.writeFile(DIR + '/' + p, await this.blobTextByOid(blob));
      await git.resetIndex({ ...this.gitArgs, filepath: p });
    }
    for (const p of tracked) {
      if (target.has(p)) continue;
      if (await this.fileExists(p)) await this.pfs.unlink(DIR + '/' + p);
      await git.remove({ ...this.gitArgs, filepath: p });
    }
    for (const p of this.unmerged.keys()) {
      if (!target.has(p) && (await this.fileExists(p))) await this.pfs.unlink(DIR + '/' + p);
    }
    this.unmerged.clear();
  };

  P.headBranchName = async function () {
    return (await git.currentBranch({ ...this.gitArgs, fullname: false })) || null;
  };

  const mergeMessage = (label, head, suffix) =>
    "Merge branch '" + label + "'" + (suffix || '') + (head !== 'main' && head !== 'master' ? ' into ' + head : '');

  /* ---------- merge ---------- */

  // Bring commit `theirsOid` into the current branch (used by merge and pull).
  // opts: { label, suffix, noFf }
  P.performMerge = async function (state, theirsOid, opts) {
    const label = opts.label;
    const oursOid = state.commits[0] && state.commits[0].oid;
    if (!oursOid) return fail('merge', 'fatal: there is nothing to merge into yet');
    if (await this.isAncestor(theirsOid, oursOid)) return ok('merge', 'Already up to date.');

    const before = await this.snapshot(oursOid);
    const after = await this.snapshot(theirsOid);
    const touched = Array.from(new Set([...before.keys(), ...after.keys()])).filter((p) => before.get(p) !== after.get(p));
    const dirty = (await this.dirtyFiles()).filter((f) => touched.includes(f));
    if (dirty.length) {
      return fail('merge',
        'error: Your local changes to the following files would be overwritten by merge:\n' +
        dirty.map((f) => '\t' + f).join('\n') + '\n' +
        'Please commit your changes or stash them before you merge.\nAborting');
    }

    const fastForward = !opts.noFf && (await this.isAncestor(oursOid, theirsOid));
    if (fastForward) {
      await git.writeRef({ ...this.gitArgs, ref: 'refs/heads/' + state.head, value: theirsOid, force: true });
      await git.checkout({ ...this.gitArgs, ref: state.head });
      this.logHead(theirsOid, (opts.logAs || 'merge ' + label) + ': Fast-forward');
      const stat = await this.changeSummary(before, after);
      return ok('merge', 'Updating ' + oursOid.slice(0, 7) + '..' + theirsOid.slice(0, 7) + '\nFast-forward' + (stat ? '\n' + stat : ''));
    }

    const baseOid = (await git.findMergeBase({ ...this.gitArgs, oids: [oursOid, theirsOid] }))[0] || null;
    const res = await this.mergeSnapshots(await this.snapshot(baseOid), before, after, 'HEAD', opts.markerLabel || label);
    await this.applyMergeResult(res);
    const message = mergeMessage(label, state.head, opts.suffix);

    if (res.conflicts.size) {
      this.merge = { theirsOid, label, message };
      res.conflicts.forEach((c, p) => this.unmerged.set(p, c.kind));
      return fail('merge', res.lines.concat('Automatic merge failed; fix conflicts and then commit the result.').join('\n'));
    }
    const oid = await git.commit({ ...this.gitArgs, author: AUTHOR, message, parent: [oursOid, theirsOid] });
    this.logHead(oid, (opts.logAs || 'merge ' + label) + ": Merge made by the 'ort' strategy.");
    const stat = await this.changeSummary(before, await this.snapshot(oid));
    const head = res.lines.concat("Merge made by the 'ort' strategy.");
    return ok('merge', head.join('\n') + (stat ? '\n' + stat : ''));
  };

  // git commit while a merge is waiting to be concluded.
  P.commitMerge = async function (message) {
    if (this.unmerged.size) {
      return fail('commit',
        'error: Committing is not possible because you have unmerged files.\n' +
        'hint: Fix them up in the work tree, and then use \'git add/rm <file>\'\n' +
        'hint: as appropriate to mark resolution and make a commit.\n' +
        'fatal: Exiting because of an unresolved conflict.\n' +
        Array.from(this.unmerged.keys()).map((p) => 'U\t' + p).join('\n'));
    }
    if (!this.merge) return fail('commit', 'fatal: There is no merge to continue.');
    const state = await this.getState();
    const oursOid = state.commits[0].oid;
    const text = message || this.merge.message;
    const oid = await git.commit({ ...this.gitArgs, author: AUTHOR, message: text, parent: [oursOid, this.merge.theirsOid] });
    this.merge = null;
    this.logHead(oid, 'commit (merge): ' + text.split('\n')[0]);
    return ok('commit', '[' + state.head + ' ' + oid.slice(0, 7) + '] ' + text.split('\n')[0]);
  };

  P.mergeAbort = async function () {
    if (!this.merge) return fail('merge', 'fatal: There is no merge to abort (MERGE_HEAD missing).');
    const head = await this.headOid();
    await this.restoreTree(head);
    this.merge = null;
    return ok('merge');
  };

  /* ---------- stash ---------- */

  P.stashLabel = function (e) {
    return e.custom ? 'On ' + e.branch + ': ' + e.custom : 'WIP on ' + e.branch + ': ' + e.headShort + ' ' + e.subject;
  };

  P.gitStash = async function (args) {
    const sub = args[0] && args[0][0] !== '-' ? args[0] : 'push';
    const rest = sub === 'push' && !(args[0] && args[0][0] !== '-') ? args : args.slice(1);
    const index = (list) => {
      const m = /^stash@\{(\d+)\}$/.exec(list.find((a) => a[0] !== '-') || 'stash@{0}');
      return m ? parseInt(m[1], 10) : null;
    };

    if (sub === 'list') {
      return ok('stash', this.stashes.map((e, i) => 'stash@{' + i + '}: ' + this.stashLabel(e)).join('\n'));
    }
    if (sub === 'clear') {
      this.stashes = [];
      return ok('stash');
    }
    if (sub === 'drop' || sub === 'pop' || sub === 'apply' || sub === 'show') {
      const i = index(rest);
      if (!this.stashes.length) return fail('stash', 'No stash entries found.');
      if (i === null || !this.stashes[i]) return fail('stash', "error: stash@{" + (i === null ? '?' : i) + "} is not a valid reference");
      const entry = this.stashes[i];
      if (sub === 'drop') {
        this.stashes.splice(i, 1);
        return ok('stash', 'Dropped refs/stash@{' + i + '} (' + entry.id + ')');
      }
      if (sub === 'show') {
        const before = new Map();
        const after = new Map();
        for (const f of entry.files) {
          if (f.base !== null) before.set(f.name, await this.blobOidOf(f.base));
          if (f.content !== null) after.set(f.name, await this.blobOidOf(f.content));
        }
        return ok('stash', (await this.changeSummary(before, after)) || '');
      }
      return this.stashApply(entry, i, sub === 'pop');
    }
    if (sub !== 'push') return fail('stash', "error: this course does not support 'git stash " + sub + "' yet");

    // git stash [push] [-u] [-m message]
    const includeUntracked = rest.includes('-u') || rest.includes('--include-untracked');
    let custom = null;
    for (let k = 0; k < rest.length; k++) {
      if (rest[k] === '-m' || rest[k] === '--message') custom = rest[++k];
      else if (rest[k].indexOf('--message=') === 0) custom = rest[k].slice(10);
      else if (rest[k] !== '-u' && rest[k] !== '--include-untracked' && rest[k] !== '-m') {
        return fail('stash', "error: this course does not support the option '" + rest[k] + "' yet");
      }
    }
    const state = await this.getState();
    if (!state.commits.length) return fail('stash', 'You do not have the initial commit yet');
    const changed = state.files.filter((f) => f.staged || f.work);
    const untracked = includeUntracked ? state.files.filter((f) => f.untracked && !f.unmerged) : [];
    if (!changed.length && !untracked.length) return ok('stash', 'No local changes to save');

    const files = [];
    for (const f of changed) {
      files.push({
        name: f.name,
        base: await this.headText(f.name),
        content: (await this.fileExists(f.name)) ? await this.readText(f.name) : null,
        staged: f.staged
      });
    }
    const loose = [];
    for (const f of untracked) loose.push({ name: f.name, content: await this.readText(f.name) });

    const subject = state.commits[0].message.split('\n')[0];
    const entry = {
      custom, branch: state.head, headShort: state.commits[0].short, subject, headOid: state.commits[0].oid,
      files, untracked: loose
    };
    const { oid } = await git.hashBlob({ object: enc.encode(JSON.stringify(entry) + Date.now()) });
    entry.id = oid;

    // Put the working folder back to the last commit.
    for (const f of files) {
      if (f.base !== null) {
        await this.pfs.writeFile(DIR + '/' + f.name, f.base);
        await git.resetIndex({ ...this.gitArgs, filepath: f.name });
      } else {
        if (await this.fileExists(f.name)) await this.pfs.unlink(DIR + '/' + f.name);
        await git.remove({ ...this.gitArgs, filepath: f.name });
      }
    }
    for (const f of loose) await this.pfs.unlink(DIR + '/' + f.name);
    this.stashes.unshift(entry);
    return ok('stash', 'Saved working directory and index state ' + this.stashLabel(entry));
  };

  P.blobOidOf = async function (text) {
    return (await git.hashBlob({ object: enc.encode(text) })).oid;
  };

  P.stashApply = async function (entry, i, drop) {
    const conflicts = new Map();
    const lines = [];
    for (const f of entry.files) {
      const here = (await this.fileExists(f.name)) ? await this.readText(f.name) : null;
      let next;
      if (here === f.base) next = f.content;
      else if (here === f.content) next = here;
      else {
        const m = merge3(toLines(f.base || ''), toLines(here || ''), toLines(f.content || ''), 'Updated upstream', 'Stashed changes');
        next = m.text;
        lines.push('Auto-merging ' + f.name);
        if (m.conflict) {
          conflicts.set(f.name, 'both modified');
          lines.push('CONFLICT (content): Merge conflict in ' + f.name);
        }
      }
      if (next === null) {
        if (await this.fileExists(f.name)) await this.pfs.unlink(DIR + '/' + f.name);
      } else {
        await this.pfs.writeFile(DIR + '/' + f.name, next);
      }
      // Files that were new and staged stay staged; everything else comes back unstaged.
      if (!conflicts.has(f.name) && f.staged === 'new') await git.add({ ...this.gitArgs, filepath: f.name });
    }
    for (const u of entry.untracked) await this.pfs.writeFile(DIR + '/' + u.name, u.content);
    if (conflicts.size) {
      conflicts.forEach((k, p) => this.unmerged.set(p, k));
      const state = await this.getState();
      return fail('stash', lines.join('\n') + '\n' + this.statusText(state) + '\nThe stash entry is kept in case you need it again.');
    }
    if (drop) this.stashes.splice(i, 1);
    const state = await this.getState();
    return ok('stash', lines.concat([this.statusText(state)]).join('\n') + (drop ? '\nDropped refs/stash@{' + i + '} (' + entry.id + ')' : ''));
  };

  /* ---------- rebase ---------- */

  P.gitRebase = async function (args) {
    const flags = args.filter((a) => a[0] === '-');
    const names = args.filter((a) => a[0] !== '-');
    const control = ['--continue', '--abort', '--skip'].find((f) => flags.includes(f));
    const unsupported = flags.filter((f) => !['--continue', '--abort', '--skip'].includes(f));
    if (unsupported.length) return fail('rebase', "error: this course does not support the option '" + unsupported[0] + "' yet");

    if (control) {
      if (!this.rebase) return fail('rebase', 'fatal: No rebase in progress?');
      if (control === '--abort') return this.rebaseAbort();
      if (control === '--skip') {
        await this.restoreTree(await this.headOid());
        this.rebase.todo.shift();
        return this.rebaseRun([]);
      }
      return this.rebaseContinue();
    }
    if (this.rebase) {
      return fail('rebase', 'fatal: It seems that there is already a rebase-merge directory, and\nI wonder if you are in the middle of another rebase.  If that is the case, please try\n\tgit rebase (--continue | --abort | --skip)');
    }
    if (!names.length) return fail('rebase', 'fatal: this course needs a branch to rebase onto, for example: git rebase main');
    const target = await this.resolveCommit(names[0]) ||
      (await git.resolveRef({ ...this.gitArgs, ref: 'refs/remotes/' + names[0] }).catch(() => null));
    if (!target) return fail('rebase', "fatal: invalid upstream '" + names[0] + "'");
    const state = await this.getState();
    return this.rebaseStart(state, target, names[0]);
  };

  // Start rebasing the current branch onto `target`.
  P.rebaseStart = async function (state, target, label) {
    if (!state.commits.length) return fail('rebase', 'fatal: no commits to rebase');
    const dirty = state.files.filter((f) => f.work || f.unmerged);
    if (dirty.length) return fail('rebase', 'error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.');
    if (state.files.some((f) => f.staged)) return fail('rebase', 'error: cannot rebase: Your index contains uncommitted changes.\nerror: Please commit or stash them.');

    const headOid = state.commits[0].oid;
    if (await this.isAncestor(target, headOid)) return ok('rebase', 'Current branch ' + state.head + ' is up to date.');
    const branchRef = 'refs/heads/' + state.head;
    if (await this.isAncestor(headOid, target)) {
      const before = await this.snapshot(headOid);
      await git.writeRef({ ...this.gitArgs, ref: branchRef, value: target, force: true });
      await git.checkout({ ...this.gitArgs, ref: state.head });
      this.logHead(target, 'rebase (finish): ' + branchRef + ' onto ' + target);
      void before;
      return ok('rebase', 'Successfully rebased and updated ' + branchRef + '.');
    }

    // Commits that are on this branch but not on the target, oldest first. Merge commits are dropped.
    const onTarget = new Set((await git.log({ ...this.gitArgs, ref: target })).map((e) => e.oid));
    const mine = state.commits.filter((c) => !onTarget.has(c.oid) && c.parents.length < 2).reverse();
    this.rebase = {
      branch: state.head, origTip: headOid, onto: target, ontoLabel: label,
      todo: mine.map((c) => ({ oid: c.oid, short: c.short, message: c.message, author: c.author, parent: c.parents[0] })),
      done: []
    };
    // Detach HEAD at the new base and replay one commit at a time.
    await git.writeRef({ ...this.gitArgs, ref: 'HEAD', value: target, force: true });
    this.logHead(target, 'rebase (start): checkout ' + label);
    await this.restoreTree(target);
    return this.rebaseRun([]);
  };

  P.rebaseRun = async function (lines) {
    const r = this.rebase;
    while (r.todo.length) {
      const c = r.todo[0];
      const headOid = await this.headOid();
      const base = await this.snapshot(c.parent);
      const ours = await this.snapshot(headOid);
      const theirs = await this.snapshot(c.oid);
      const res = await this.mergeSnapshots(base, ours, theirs, 'HEAD', c.short + ' (' + c.message.split('\n')[0] + ')');
      await this.applyMergeResult(res);
      if (res.conflicts.size) {
        res.conflicts.forEach((x, p) => this.unmerged.set(p, x.kind));
        r.stopped = c;
        return fail('rebase', lines.concat(res.lines, [
          'error: could not apply ' + c.short + '... ' + c.message.split('\n')[0],
          'hint: Resolve all conflicts manually, mark them as resolved with',
          'hint: "git add/rm <conflicted_files>", then run "git rebase --continue".',
          'hint: You can instead skip this commit: run "git rebase --skip".',
          'hint: To abort and get back to the state before "git rebase", run "git rebase --abort".',
          'Could not apply ' + c.short + '... ' + c.message.split('\n')[0]
        ]).join('\n'));
      }
      const staged = (await this.getState()).files.some((f) => f.staged);
      if (staged) await this.rebaseCommit(c);
      else lines.push('dropping ' + c.oid + ' ' + c.message.split('\n')[0] + ' -- patch contents already upstream');
      r.done.push(c);
      r.todo.shift();
    }
    const tip = await this.headOid();
    await git.writeRef({ ...this.gitArgs, ref: 'refs/heads/' + r.branch, value: tip, force: true });
    await git.writeRef({ ...this.gitArgs, ref: 'HEAD', value: 'refs/heads/' + r.branch, symbolic: true, force: true });
    this.logHead(tip, 'rebase (finish): returning to refs/heads/' + r.branch);
    this.rebase = null;
    return ok('rebase', lines.concat('Successfully rebased and updated refs/heads/' + r.branch + '.').join('\n'));
  };

  // Commit the staged result on the detached HEAD, keeping the original message and author.
  P.rebaseCommit = async function (c) {
    const parent = await this.headOid();
    const now = Math.floor(Date.now() / 1000);
    await git.commit({
      ...this.gitArgs, ref: 'refs/heads/rebase-tmp', parent: [parent], message: c.message + '\n',
      author: c.author, committer: { name: AUTHOR.name, email: AUTHOR.email, timestamp: now, timezoneOffset: new Date().getTimezoneOffset() }
    });
    const oid = await git.resolveRef({ ...this.gitArgs, ref: 'refs/heads/rebase-tmp' });
    await git.deleteRef({ ...this.gitArgs, ref: 'refs/heads/rebase-tmp' });
    await git.writeRef({ ...this.gitArgs, ref: 'HEAD', value: oid, force: true });
    this.logHead(oid, 'rebase (' + (this.unmerged.size === 0 && this.rebase && this.rebase.stopped === c ? 'continue' : 'pick') + '): ' + c.message.split('\n')[0]);
  };

  P.rebaseContinue = async function () {
    if (this.unmerged.size) {
      return fail('rebase', Array.from(this.unmerged.keys()).map((p) => p + ': needs merge').join('\n') +
        '\nYou must edit all merge conflicts and then\nmark them as resolved using git add');
    }
    const state = await this.getState();
    const c = this.rebase.todo[0];
    if (!state.files.some((f) => f.staged)) {
      return fail('rebase',
        "No changes - did you forget to use 'git add'?\nIf there is nothing left to stage, chances are that something else\n" +
        'already introduced the same changes; you might want to skip this patch.');
    }
    await this.rebaseCommit(c);
    this.rebase.done.push(c);
    this.rebase.todo.shift();
    return this.rebaseRun([]);
  };

  /* ---------- reflog ---------- */

  // git reflog [show]: where HEAD has been, newest first. It is kept only on this computer.
  P.gitReflog = async function (args) {
    const rest = args.filter((a) => a !== 'show' && a !== 'HEAD');
    if (rest.length) return fail('reflog', "error: this course does not support 'git reflog " + rest[0] + "' yet");
    if (!this.reflog.length) return ok('reflog');
    const state = await this.getState();
    const names = (oid) => {
      const local = state.branches.filter((b) => b.oid === oid).map((b) => b.name);
      local.sort((a, b) => (a === state.head ? -1 : b === state.head ? 1 : a < b ? -1 : 1));
      const all = local.map((n) => (n === state.head && !state.detachedOid ? 'HEAD -> ' + n : n))
        .concat((state.tracking || []).filter((t) => t.oid === oid).map((t) => t.name));
      return all.length ? ' (' + all.join(', ') + ')' : '';
    };
    return ok('reflog', this.reflog.map((e, i) => e.oid.slice(0, 7) + (i === 0 ? names(e.oid) : '') + ' HEAD@{' + i + '}: ' + e.message).join('\n'));
  };

  P.rebaseAbort = async function () {
    const r = this.rebase;
    await git.writeRef({ ...this.gitArgs, ref: 'HEAD', value: 'refs/heads/' + r.branch, symbolic: true, force: true });
    await this.restoreTree(r.origTip);
    this.rebase = null;
    return ok('rebase');
  };
})();
