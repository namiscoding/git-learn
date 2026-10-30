window.LESSONS = window.LESSONS || {};
(function () {
  const THREE_COMMITS = [
    'git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"',
    'echo "footer" >> home.txt', 'git commit -am "Add footer"',
    'echo "search" >> home.txt', 'git commit -am "Add search"'
  ];

  window.LESSONS['15'] = {
    title: 'Reflog: your safety net',
    slides: [
      {
        type: 'story',
        title: 'Your life jacket',
        body: [
          'Sooner or later you will type something and watch commits seem to vanish: a <code>reset --hard</code> that went too far, a branch deleted too early, a rebase that went wrong. Panic is the normal reaction.',
          'Here is the good news. Git almost never deletes commits right away. It also keeps a <strong>private diary of everywhere HEAD has been</strong>: every commit, every branch switch, every reset. That diary is the <strong>reflog</strong>. If a commit ever existed on your computer, the reflog usually still knows where it is.'
        ],
        visualHtml:
          '<ol class="diary" aria-label="An example reflog diary">' +
          '<li class="reveal"><code>HEAD@{0}</code><span>reset: moving to HEAD~2</span><em>you are here</em></li>' +
          '<li class="reveal"><code>HEAD@{1}</code><span>commit: Add search</span><em>the "lost" commit</em></li>' +
          '<li class="reveal"><code>HEAD@{2}</code><span>commit: Add footer</span></li>' +
          '<li class="reveal"><code>HEAD@{3}</code><span>commit (initial): Add home page</span></li>' +
          '</ol>'
      },
      {
        type: 'step',
        title: 'Rescue 1: a reset that went too far',
        body: [
          'Three commits, then a <code>git reset --hard HEAD~2</code> that drops two of them. Watch the history shrink, and then watch the reflog bring it back.',
          'The reflog numbers its entries: <code>HEAD@{0}</code> is where HEAD is now, <code>HEAD@{1}</code> is where it was one move ago, and so on.'
        ],
        graph: true,
        setup: THREE_COMMITS,
        steps: [
          { cmd: 'git log --oneline', caption: 'Three commits. All is well.' },
          { cmd: 'git reset --hard HEAD~2', caption: 'Oops: this moves the branch back two commits and rewrites your files to match.' },
          { cmd: 'git log --oneline', caption: 'Only the first commit is left. It looks like the other two are gone.' },
          { cmd: 'git reflog', caption: 'But the diary remembers. The line commit: Add search shows the commit you lost. It is HEAD@{1}.' },
          { cmd: 'git reset --hard HEAD@{1}', caption: 'Move the branch back to where HEAD was one move ago. HEAD@{1} is just another way to name that commit.' },
          { cmd: 'git log --oneline', caption: 'All three commits are back, and your files with them. The rescue itself is in the diary too.' }
        ]
      },
      {
        type: 'step',
        title: 'Rescue 2: a branch deleted too soon',
        body: [
          'You made a branch, committed some work, and deleted the branch before merging it. The commit still exists, but no branch points at it any more, so <code>git log</code> will not show it.',
          'The reflog still lists it. All you need to do is <strong>put a new branch label on that commit</strong>.'
        ],
        graph: true,
        setup: [
          'git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"',
          'git switch -c feature', 'echo "work" > feature.txt', 'git add feature.txt', 'git commit -m "Add feature work"',
          'git switch main'
        ],
        steps: [
          { cmd: 'git branch -D feature', caption: '-D deletes the branch even though it was never merged. The label is gone, and so is the commit from the picture.' },
          { cmd: 'git branch', caption: 'Only main is left.' },
          { cmd: 'git reflog', caption: 'The diary shows two lines: HEAD moved back to main, and before that, the commit "Add feature work". That one is HEAD@{1}.' },
          { cmd: 'git branch feature HEAD@{1}', caption: 'Create a new branch called feature, pointing at that commit. The work is reachable again.' },
          { cmd: 'git switch feature', caption: 'Switch to it...' },
          { cmd: 'ls', caption: '...and feature.txt is back in your folder.' }
        ]
      },
      {
        type: 'practice',
        title: 'Try it: rescue your own commits',
        body: [
          'Three commits are ready. Break things on purpose, then fix them with the reflog.'
        ],
        graph: true,
        setup: THREE_COMMITS,
        tasks: [
          { text: 'Lose two commits: <code>git reset --hard HEAD~2</code>', hint: 'Type <code>git reset --hard HEAD~2</code>. HEAD~2 means "two commits before HEAD".', done: (s, r) => r.ok && r.kind === 'reset' && s.commits.length === 1 },
          { text: 'Check the damage: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>. Only one commit remains.', done: (s, r) => r.ok && r.kind === 'log' && s.commits.length === 1 },
          { text: 'Open the diary: <code>git reflog</code>', hint: 'Type <code>git reflog</code>. Find the line "commit: Add search" and its HEAD@{n} number.', done: (s, r) => r.ok && r.kind === 'reflog' },
          { text: 'Go back to where HEAD was: <code>git reset --hard HEAD@{1}</code>', hint: 'Type <code>git reset --hard HEAD@{1}</code>. Use the number you saw in the reflog.', done: (s, r) => r.ok && r.kind === 'reset' && s.commits.length === 3 },
          { text: 'Confirm everything is back: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>. Three commits again.', done: (s, r) => r.ok && r.kind === 'log' && s.commits.length === 3 }
        ],
        success: 'You went through the whole rescue. Remember the path: panic, then git reflog, then git reset --hard or git branch with the entry you want.'
      },
      {
        type: 'story',
        title: 'What the life jacket cannot save',
        body: [
          'The reflog is powerful, but it has limits. Know them before you rely on it.'
        ],
        visualHtml:
          '<ul class="limits">' +
          '<li class="reveal"><strong>Work you never committed</strong><span>If it was never saved in a commit, there is no entry. A <code>reset --hard</code> or <code>restore</code> on uncommitted edits is gone for good. Commit (or stash) early.</span></li>' +
          '<li class="reveal"><strong>Only on your computer</strong><span>The reflog is local. It is not pushed, and a fresh clone starts with an empty one.</span></li>' +
          '<li class="reveal"><strong>It expires</strong><span>Entries are kept for a while (by default about 90 days, and 30 for commits nothing points to), then cleaned up.</span></li>' +
          '</ul>'
      },
      {
        type: 'recap',
        title: 'What to remember',
        points: [
          '<code>git reflog</code> is a diary of where <strong>HEAD</strong> has been: commits, switches, resets, merges, rebases.',
          'Entries are numbered <code>HEAD@{0}</code> (now), <code>HEAD@{1}</code> (one move ago), and so on.',
          'To rescue a lost state, <strong>find it in the reflog</strong>, then either <code>git reset --hard HEAD@{n}</code> or <code>git branch name HEAD@{n}</code>.',
          'It only knows about <strong>committed</strong> work. Uncommitted edits cannot be recovered.',
          'It is local and it expires, so rescue soon, and do not treat it as a backup.'
        ]
      }
    ]
  };
})();
