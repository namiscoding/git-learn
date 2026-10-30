window.LESSONS = window.LESSONS || {};
(function () {
  const URL_ = 'https://github.com/you/project.git';
  // A project that already has two commits on GitHub, and an empty folder on your computer.
  const SEEDED = {
    seedRemote: {
      url: URL_,
      commits: [
        { file: 'home.txt', text: 'home', message: 'Add home page' },
        { file: 'home.txt', text: 'footer', message: 'Add footer', append: true }
      ]
    }
  };
  // Your project is already connected to GitHub and in sync.
  const CONNECTED = [
    'git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"',
    'git remote add origin ' + URL_, 'git push -u origin main'
  ];

  window.LESSONS['10'] = {
    title: 'Remotes: push and pull',
    slides: [
      {
        type: 'story',
        title: 'A remote is another copy, somewhere else',
        body: [
          'So far, everything lived on your computer. A <strong>remote</strong> is another copy of the same repository, stored on a server such as GitHub. It is how work is backed up, shared, and combined with other people\'s.',
          'The copies do not sync by themselves. <strong>You decide when</strong> commits travel, with four commands:'
        ],
        visualHtml:
          '<ul class="cmd-table" aria-label="The four commands that move commits between copies">' +
          '<li class="reveal"><code>git clone &lt;url&gt;</code><span>Make your first copy of a remote repository.</span></li>' +
          '<li class="reveal"><code>git push</code><span>Send your new commits <strong>to</strong> the remote.</span></li>' +
          '<li class="reveal"><code>git fetch</code><span>Download new commits, but do not touch your work.</span></li>' +
          '<li class="reveal"><code>git pull</code><span>Fetch, then merge them into your branch.</span></li>' +
          '</ul>'
      },
      {
        type: 'concept',
        title: 'Connect and push',
        body: [
          'Your project has one commit and lives only on your computer. First give the remote a nickname, then send your commits.',
          'Watch the right-hand panel: commits <strong>glide across</strong> when you push. The grey label <code>origin/main</code> is your computer\'s memory of where GitHub\'s main branch is.'
        ],
        remote: true,
        setup: ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"'],
        steps: [
          { cmd: 'git remote add origin ' + URL_, caption: '"origin" is just a nickname for the address. Nothing was copied yet.' },
          { cmd: 'git remote -v', caption: 'Your computer remembers the address, once for sending and once for fetching.' },
          { cmd: 'git push -u origin main', caption: 'The commit is copied to GitHub. The -u remembers that your main goes with origin/main, so later you can just type git push.' },
          { cmd: 'echo "footer" >> home.txt', caption: 'You keep working locally.' },
          { cmd: 'git commit -am "Add footer"', caption: 'The new commit exists only on your computer. GitHub does not know about it.' },
          { cmd: 'git status', caption: 'Git compares main with origin/main and tells you: ahead by 1.' },
          { cmd: 'git push', caption: 'Now it is copied across, and both labels point at the same commit again.' }
        ]
      },
      {
        type: 'step',
        title: 'Fetch and pull: get what others pushed',
        body: [
          'A teammate, Sam, pushes a commit while you are not looking. Step through what you see, and when.',
          '<strong>Fetch</strong> only downloads. <strong>Pull</strong> is fetch plus merge.'
        ],
        remote: true,
        setup: CONNECTED,
        steps: [
          { label: 'Sam pushes a commit to GitHub', teammate: { file: 'team.txt', text: 'Hi from Sam', message: 'Add team page' }, caption: 'GitHub now has a commit that your computer has never seen.' },
          { cmd: 'git status', caption: 'It still says "up to date". Git only knows what it saw the last time it talked to GitHub. It does not check on its own.' },
          { cmd: 'git fetch', caption: 'Now your computer asks. The origin/main label jumps ahead, but your own main did not move and your files did not change.' },
          { cmd: 'git status', caption: 'Now Git knows: you are behind by 1 commit.' },
          { cmd: 'git pull', caption: 'Pull merges origin/main into main. This time it is a fast-forward, because you had nothing new.' },
          { cmd: 'ls', caption: 'Sam\'s file is in your folder.' }
        ]
      },
      {
        type: 'step',
        title: 'When a push is rejected',
        body: [
          'Sam pushes first, and you commit on top of the old version. Now your histories have split. Git will not let you overwrite Sam\'s work.',
          'The rule: <strong>pull before you push</strong> when others share the branch.'
        ],
        remote: true,
        setup: CONNECTED,
        steps: [
          { label: 'Sam pushes a commit to GitHub', teammate: { file: 'team.txt', text: 'Hi from Sam', message: 'Add team page' }, caption: 'GitHub moved ahead without you.' },
          { cmd: 'echo "mine" > mine.txt', caption: 'Meanwhile you create a file...' },
          { cmd: 'git add mine.txt', caption: '...stage it...' },
          { cmd: 'git commit -m "Add my file"', caption: '...and commit. Your main now has a commit that GitHub lacks, and GitHub has one that you lack.' },
          { cmd: 'git push', caption: 'Rejected! Git protects Sam\'s commit. Read the hint: it tells you to pull first.' },
          { cmd: 'git fetch', caption: 'Download Sam\'s commit. In the left panel the two lines have split: origin/main sits on its own line.' },
          { cmd: 'git pull', caption: 'Pull merges the two lines into one merge commit.' },
          { cmd: 'git push', caption: 'This time it is accepted: your history contains everything GitHub had, plus your commits.' }
        ]
      },
      {
        type: 'practice',
        title: 'Try it: clone, change, push',
        body: [
          'A project already exists on GitHub with two commits. Your folder is empty. Copy it, add a commit, and send it back.'
        ],
        remote: true,
        setup: [SEEDED],
        tasks: [
          { text: 'Copy the project: <code>git clone ' + URL_ + '</code>', hint: 'Type <code>git clone ' + URL_ + '</code>. In this course it copies into your current folder.', done: (s, r) => r.ok && r.kind === 'clone' },
          { text: 'Look at the history: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>. Look for (HEAD -> main, origin/main).', done: (s, r) => r.ok && r.kind === 'log' },
          { text: 'Make your own commit. For example: <code>echo "search" > search.txt</code>, <code>git add search.txt</code>, <code>git commit -m "Add search"</code>', hint: 'Three commands. After the commit, main is ahead of origin/main.', done: (s, r) => r.ok && r.kind === 'commit' },
          { text: 'Ask Git where you stand: <code>git status</code>', hint: 'Type <code>git status</code>. It should say you are ahead by 1 commit.', done: (s, r) => r.ok && r.kind === 'status' && /ahead/.test(r.out) },
          { text: 'Send your commit: <code>git push</code>', hint: 'Type <code>git push</code>. clone already set up the connection, so no extra words are needed.', done: (s, r) => r.ok && r.kind === 'push' },
          { text: 'Confirm: <code>git status</code>', hint: 'Type <code>git status</code>. It should say "up to date with \'origin/main\'".', done: (s, r) => r.ok && r.kind === 'status' && /up to date/.test(r.out) }
        ],
        success: 'You did the everyday loop: copy, work, commit, push. Try git fetch and git pull, which have nothing new to get here.'
      },
      {
        type: 'recap',
        title: 'What to remember',
        points: [
          'A <strong>remote</strong> is another copy of your repository on a server. <code>origin</code> is the usual nickname for it.',
          '<code>git clone &lt;url&gt;</code> makes the first copy. <code>git push</code> sends your commits. <code>git fetch</code> downloads without changing your work. <code>git pull</code> is fetch plus merge.',
          '<code>origin/main</code> is your computer\'s <strong>memory</strong> of GitHub\'s main. It only updates when you fetch, pull or push.',
          '<code>git status</code> tells you if you are ahead of or behind the remote, as of the last time you checked.',
          'If a push is <strong>rejected</strong>, pull first, then push again.'
        ]
      }
    ]
  };
})();
