window.LESSONS = window.LESSONS || {};
(function () {
  const BASE = ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"'];

  window.LESSONS['13'] = {
    title: 'Stash',
    slides: [
      {
        type: 'story',
        title: 'Interrupted halfway through a change',
        body: [
          'You are in the middle of some work when someone says: "Quick, fix this other thing first." Your work is not ready to commit, and you cannot switch branches or start something new cleanly with it lying around.',
          '<code>git stash</code> takes your unfinished changes, <strong>puts them on a shelf</strong>, and gives you back a clean working folder. When you are done with the urgent task, you take them off the shelf again.'
        ],
        visualHtml:
          '<ol class="story-steps">' +
          '<li class="reveal"><strong>1. Working</strong><span>You have edits that are not ready to commit.</span></li>' +
          '<li class="reveal"><strong>2. <code>git stash</code></strong><span>The edits go on the shelf. The folder is clean.</span></li>' +
          '<li class="reveal"><strong>3. Do the urgent thing</strong><span>Switch branches, fix, commit.</span></li>' +
          '<li class="reveal"><strong>4. <code>git stash pop</code></strong><span>Your edits come off the shelf and back into the folder.</span></li>' +
          '</ol>'
      },
      {
        type: 'step',
        title: 'Shelve it, fix something, bring it back',
        body: [
          'Watch the shelf at the bottom of the diagram. Your half-done edit leaves the working folder and sits there, then comes back.'
        ],
        stash: true,
        setup: BASE.concat(['echo "half-done idea" >> home.txt']),
        steps: [
          { cmd: 'git status', caption: 'You have an unfinished edit in home.txt.' },
          { cmd: 'git stash', caption: 'The edit moves onto the shelf as stash@{0}. The message names the branch and the last commit.' },
          { cmd: 'git status', caption: 'Your working folder is clean. You are free to do anything else.' },
          { cmd: 'echo "urgent fix" > fix.txt', caption: 'The urgent job...' },
          { cmd: 'git add fix.txt', caption: '...staged...' },
          { cmd: 'git commit -m "Urgent fix"', caption: '...and committed, with no half-done work mixed in.' },
          { cmd: 'git stash pop', caption: 'pop takes the newest entry off the shelf and reapplies it. The shelf is empty again and the edit is back.' },
          { cmd: 'git status', caption: 'You are exactly where you left off, plus the urgent commit.' }
        ]
      },
      {
        type: 'step',
        title: 'What a plain stash leaves behind',
        body: [
          'By default <code>git stash</code> only shelves files that Git <strong>already tracks</strong>. A brand-new file is untracked, so it stays where it is, unless you add <code>-u</code> (untracked).'
        ],
        stash: true,
        setup: BASE.concat(['echo "edit" >> home.txt', 'echo "a draft" > notes.txt']),
        steps: [
          { cmd: 'git stash', caption: 'Only the edit to home.txt is shelved.' },
          { cmd: 'ls', caption: 'notes.txt is still in the folder, because it was never tracked.' },
          { cmd: 'git stash pop', caption: 'The edit returns.' },
          { cmd: 'git stash -u', caption: 'With -u, new files go on the shelf as well.' },
          { cmd: 'ls', caption: 'Now notes.txt is gone from the folder too. It is on the shelf.' },
          { cmd: 'git stash pop', caption: 'And everything comes back together.' }
        ]
      },
      {
        type: 'practice',
        title: 'Try it: shelve and restore',
        body: [
          'You have a half-done edit in <code>home.txt</code>. Shelve it, make a quick commit, and bring the edit back.'
        ],
        stash: true,
        setup: BASE.concat(['echo "half-done idea" >> home.txt']),
        tasks: [
          { text: 'Shelve your work: <code>git stash</code>', hint: 'Type <code>git stash</code>. It prints "Saved working directory and index state".', done: (s, r) => r.ok && r.kind === 'stash' && /Saved/.test(r.out) },
          { text: 'Check the folder is clean: <code>git status</code>', hint: 'Type <code>git status</code>.', done: (s, r) => r.ok && r.kind === 'status' && /clean/.test(r.out) },
          { text: 'Make a quick commit. For example: <code>echo "fix" > fix.txt</code>, <code>git add fix.txt</code>, <code>git commit -m "Quick fix"</code>', hint: 'Three commands.', done: (s, r) => r.ok && r.kind === 'commit' },
          { text: 'See what is on the shelf: <code>git stash list</code>', hint: 'Type <code>git stash list</code>.', done: (s, r, line) => r.ok && r.kind === 'stash' && /list/.test(line) && /stash@/.test(r.out) },
          { text: 'Bring your work back: <code>git stash pop</code>', hint: 'Type <code>git stash pop</code>. Watch the shelf empty.', done: (s, r) => r.ok && r.kind === 'stash' && /Dropped/.test(r.out) }
        ],
        success: 'Stash is a safe drawer for unfinished work. If you forget what is in it, git stash list and git stash show help.'
      },
      {
        type: 'recap',
        title: 'What to remember',
        points: [
          '<code>git stash</code> shelves your uncommitted changes and gives you a clean folder.',
          '<code>git stash pop</code> brings back the newest entry and removes it from the shelf. <code>git stash apply</code> brings it back but keeps it on the shelf.',
          '<code>git stash list</code> shows the shelf. <code>git stash drop</code> throws an entry away.',
          'New (untracked) files are <strong>not</strong> stashed unless you use <code>git stash -u</code>.',
          'A stash belongs to the repository, not to a branch: you can pop it on any branch. If it clashes with newer changes, you get a conflict to resolve, as in lesson 12.'
        ]
      }
    ]
  };
})();
