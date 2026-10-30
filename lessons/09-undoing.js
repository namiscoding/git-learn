window.LESSONS = window.LESSONS || {};
window.LESSONS['09'] = {
  title: 'Undoing mistakes',
  slides: [
    {
      type: 'story',
      title: 'Pick the undo by how far the mistake travelled',
      body: [
        'Everyone makes mistakes. Git has several undo tools, and the confusing part is choosing the right one.',
        'Here is the rule that makes it easy: <strong>how far has the mistake gone?</strong> The further it went, the more careful the undo must be.'
      ],
      visualHtml:
        '<ol class="undo-ladder">' +
        '<li class="reveal"><span class="where">Only edited in the working folder</span><code>git restore file</code><small>Throws the edit away. It was never saved, so it cannot come back.</small></li>' +
        '<li class="reveal"><span class="where">Staged, not committed</span><code>git restore --staged file</code><small>Moves it out of the staging area. Your edit stays.</small></li>' +
        '<li class="reveal"><span class="where">Committed, only on your computer</span><code>git reset</code><small>Moves the branch back. Rewrites history, so use it only before sharing.</small></li>' +
        '<li class="reveal"><span class="where">Committed and already shared</span><code>git revert</code><small>Adds a new commit that undoes an old one. History is kept.</small></li>' +
        '</ol>'
    },
    {
      type: 'step',
      title: 'Undo an edit, and undo an add',
      body: [
        'First two rungs of the ladder. Watch the file chip move, and watch what <code>git status</code> says at each point.',
        '<strong>Careful:</strong> <code>git restore file</code> discards your edit for good. Git has no copy of work it never saved.'
      ],
      setup: ['git init', 'echo "Hello" > note.txt', 'git add note.txt', 'git commit -m "Add note"'],
      steps: [
        { cmd: 'echo "Mistake" >> note.txt', caption: 'You edit the file, and now you regret it.' },
        { cmd: 'cat note.txt', caption: 'The file now has two lines, one of them the mistake.' },
        { cmd: 'git restore note.txt', caption: 'The working folder copy is replaced with the staged (here: last saved) version. The chip is back to "saved".' },
        { cmd: 'cat note.txt', caption: 'Only "Hello" remains. The mistake is gone for good.' },
        { cmd: 'echo "Another mistake" >> note.txt', caption: 'A second edit...' },
        { cmd: 'git add note.txt', caption: '...and this time you staged it by accident.' },
        { cmd: 'git restore --staged note.txt', caption: 'Unstaged: the chip moves out of the staging area. The edit itself is still in your file.' },
        { cmd: 'git status', caption: 'Now it is "not staged for commit". You can edit it, add it, or discard it.' }
      ]
    },
    {
      type: 'step',
      title: 'reset: move the branch back (before sharing)',
      body: [
        'The third rung. <code>git reset</code> moves your branch label back to an earlier commit. The two common modes differ in what happens to the changes:',
        '<code>--soft</code> keeps the changes staged, handy for redoing a commit. <code>--hard</code> throws the changes away. It is the dangerous one.'
      ],
      graph: true,
      setup: ['git init', 'echo "one" > note.txt', 'git add note.txt', 'git commit -m "Add note"', 'echo "two" >> note.txt', 'git commit -am "Add line two"', 'echo "three" >> note.txt', 'git commit -am "wrong message"'],
      steps: [
        { cmd: 'git log --oneline', caption: 'Three commits. The last one has a bad message, and we want to redo it.' },
        { cmd: 'git reset --soft HEAD~1', caption: 'HEAD~1 means "one commit before HEAD". The label moves back one commit. The commit disappears from the history, but its change stays staged.' },
        { cmd: 'git status', caption: 'The change from the removed commit is waiting in the staging area, ready to commit again.' },
        { cmd: 'git commit -m "Add line three"', caption: 'Committed again with a better message. Same change, new commit.' },
        { cmd: 'git reset --hard HEAD~1', caption: 'DANGER: --hard moves the label back and also rewrites your files to match. The line three work is gone from the folder.' },
        { cmd: 'cat note.txt', caption: 'Only two lines remain. Use --hard only when you are sure you want to discard the work.' }
      ],
      note: 'Never reset commits you have already pushed and shared: it rewrites history other people are building on. Use revert for those.'
    },
    {
      type: 'step',
      title: 'revert: undo safely with a new commit',
      body: [
        'The fourth rung, for mistakes that are already shared. <code>git revert HEAD</code> does not remove the bad commit. It adds a <strong>new commit that does the opposite</strong>.',
        'History stays complete and honest, and nobody else\'s copy breaks.'
      ],
      graph: true,
      setup: ['git init', 'echo "good" > app.txt', 'git add app.txt', 'git commit -m "Add app"', 'echo "bad idea" > risky.txt', 'git add risky.txt', 'git commit -m "Add risky feature"'],
      steps: [
        { cmd: 'git revert HEAD', caption: 'A new commit appears that removes risky.txt again. The old commit is still in the history.' },
        { cmd: 'ls', caption: 'risky.txt is gone from the folder.' },
        { cmd: 'git log --oneline', caption: 'Three commits: the original, the mistake, and the undo. Anyone who already had the mistake just receives the undo.' }
      ],
      note: 'In a real terminal, git revert may open an editor for the message. Save and close it to continue. This course skips that step.'
    },
    {
      type: 'step',
      title: 'Stop tracking a file you committed by mistake',
      body: [
        'Remember the trap from lesson 6? A secret file was committed <em>before</em> it was ignored, so ignoring it changed nothing. Here is the fix: <code>git rm --cached</code> removes the file from Git\'s tracking but <strong>leaves it in your folder</strong>.'
      ],
      setup: ['git init', 'echo "PASSWORD=1234" > .env', 'git add .env', 'git commit -m "Oops, saved the password file"', 'echo ".env" > .gitignore'],
      steps: [
        { cmd: 'git rm --cached .env', caption: 'Git stops tracking .env. The file stays on disk.' },
        { cmd: 'git status', caption: 'The removal is staged as "deleted", and .gitignore is new. .env itself is quiet now because it is ignored.' },
        { cmd: 'git add .gitignore', caption: 'Stage the ignore rule too.' },
        { cmd: 'git commit -m "Stop tracking .env"', caption: 'From now on the file is out of the repository.' },
        { cmd: 'ls', caption: '.env is still in your folder (use ls -a to see hidden files).' }
      ],
      note: 'The old commit still contains the password. If it was ever pushed to GitHub, treat the secret as leaked and change it.'
    },
    {
      type: 'practice',
      title: 'Try it: undo an edit, then undo a commit',
      body: [
        'A note file has two commits. Make a mistake, discard it, then undo the last commit safely.'
      ],
      graph: true,
      setup: ['git init', 'echo "line one" > note.txt', 'git add note.txt', 'git commit -m "Add note"', 'echo "line two" >> note.txt', 'git commit -am "Add line two"'],
      tasks: [
        { text: 'Make a mistake: <code>echo "oops" >> note.txt</code>', hint: 'Type <code>echo "oops" >> note.txt</code>.', done: (s) => s.files.some((f) => f.work === 'modified') },
        { text: 'Discard it: <code>git restore note.txt</code>', hint: 'Type <code>git restore note.txt</code>. Then try <code>cat note.txt</code> to check.', done: (s, r) => r.ok && r.kind === 'restore' && !s.files.some((f) => f.work) },
        { text: 'Undo the last commit safely: <code>git revert HEAD</code>', hint: 'Type <code>git revert HEAD</code>. A new commit appears; the old one stays.', done: (s, r) => r.ok && r.kind === 'revert' },
        { text: 'See the result: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>. You should see three commits.', done: (s, r) => r.ok && r.kind === 'log' }
      ],
      success: 'You used two rungs of the ladder. Optional: try git reset --hard HEAD~1 and watch what disappears, since this practice space cannot hurt anything real.'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        'Choose the undo by <strong>how far the mistake travelled</strong>.',
        '<code>git restore file</code> discards an edit (<strong>permanent</strong>). <code>git restore --staged file</code> unstages it.',
        '<code>git reset --soft HEAD~1</code> undoes a commit but keeps the change staged. <code>--hard</code> also throws the change away.',
        '<strong>Never reset shared commits.</strong> Use <code>git revert HEAD</code>, which adds an undo commit and keeps history.',
        '<code>git rm --cached file</code> stops tracking a file without deleting it.'
      ]
    }
  ]
};
