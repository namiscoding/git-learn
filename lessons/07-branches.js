window.LESSONS = window.LESSONS || {};
window.LESSONS['07'] = {
  title: 'Branches',
  slides: [
    {
      type: 'story',
      title: 'A branch is a separate line of work',
      body: [
        'You want to try a new idea, but the project works today and you do not want to risk it. A <strong>branch</strong> lets you work on the idea in a separate line of history. The main line stays untouched.',
        'If the idea works, you bring it back later (lesson 8). If not, you throw the branch away.',
        'Under the hood, a branch is surprisingly small: <strong>just a label that points at one commit</strong>. Making a branch costs almost nothing.'
      ],
      visualHtml:
        '<svg class="mini-graph" viewBox="0 0 400 190" role="img" aria-label="Main line of three commits. A second line branches off after the second commit and has two commits of its own.">' +
        '<line class="reveal" x1="40" y1="60" x2="200" y2="60"/>' +
        '<path class="reveal" d="M120 60 C150 60,150 130,190 130"/>' +
        '<line class="reveal" x1="190" y1="130" x2="320" y2="130"/>' +
        '<circle class="reveal" cx="40" cy="60" r="13"/><circle class="reveal" cx="120" cy="60" r="13"/><circle class="reveal" cx="200" cy="60" r="13"/>' +
        '<circle class="reveal alt" cx="190" cy="130" r="13"/><circle class="reveal alt" cx="270" cy="130" r="13"/>' +
        '<text class="reveal lbl" x="20" y="25">main</text><text class="reveal lbl" x="205" y="170">your idea (a new branch)</text>' +
        '</svg>'
    },
    {
      type: 'concept',
      title: 'Create a branch and commit on it',
      body: [
        'The project already has two commits on <code>main</code>. Watch what happens in the History panel when we branch off.',
        'Pay attention to the very last command: the files in your working folder <strong>change</strong> when you switch branches.'
      ],
      graph: true,
      setup: ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"', 'echo "footer" >> home.txt', 'git commit -am "Add footer"'],
      steps: [
        { cmd: 'git switch -c feature', caption: 'A new branch called feature appears, pointing at the same commit as main. The blue label HEAD shows which branch you are on now.' },
        { cmd: 'echo "search box" > search.txt', caption: 'You create a new file while on the feature branch.' },
        { cmd: 'git add search.txt', caption: 'Staged, as usual.' },
        { cmd: 'git commit -m "Add search box"', caption: 'The new commit goes on the feature line only. main did not move.' },
        { cmd: 'git switch main', caption: 'You go back to main. HEAD moves to the main label.' },
        { cmd: 'ls', caption: 'search.txt is gone from your folder! It is not lost; it belongs to the feature commit. Git rewrote your files to match main.' }
      ]
    },
    {
      type: 'step',
      title: 'Switching branches moves HEAD',
      body: [
        'Step through slowly. Notice three things: where the <code>*</code> is in <code>git branch</code>, where HEAD sits in the diagram, and what <code>git log</code> shows on each branch.'
      ],
      graph: true,
      setup: ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"', 'git branch idea'],
      steps: [
        { cmd: 'git branch', caption: 'Two branches exist. The * marks the current one. git branch idea made the label without moving you.' },
        { cmd: 'git switch idea', caption: 'HEAD moves to idea. Nothing in your files changes yet, because both branches point to the same commit.' },
        { cmd: 'echo "new idea" > idea.txt', caption: 'A new file in the working folder.' },
        { cmd: 'git add idea.txt', caption: 'Staged.' },
        { cmd: 'git commit -m "Try a new idea"', caption: 'The commit lands on idea. The main label stays behind.' },
        { cmd: 'git switch main', caption: 'Back to main. Your folder returns to how main looked.' },
        { cmd: 'git log --oneline', caption: 'Only the history reachable from main is listed. The idea commit is not here.' },
        { cmd: 'git switch idea', caption: 'Back to the idea branch.' },
        { cmd: 'git log --oneline', caption: 'Now the idea commit is on top. Each branch has its own view of the history.' }
      ]
    },
    {
      type: 'practice',
      title: 'Try it: branch, commit, come back',
      body: [
        'A project with one commit is ready. Make an experiment on its own branch, then return to main and see that nothing changed there.'
      ],
      graph: true,
      setup: ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"'],
      tasks: [
        { text: 'Create a branch and switch to it: <code>git switch -c experiment</code>', hint: 'Type <code>git switch -c experiment</code>. The -c means "create".', done: (s, r) => r.ok && r.kind === 'switch' && s.head === 'experiment' },
        { text: 'Create a file and commit it on this branch. For example: <code>echo "test" > test.txt</code>, <code>git add test.txt</code>, <code>git commit -m "Add test file"</code>', hint: 'Three commands. After the commit, a new dot appears on the experiment line.', done: (s, r) => r.ok && r.kind === 'commit' && s.head === 'experiment' },
        { text: 'Go back to main: <code>git switch main</code>', hint: 'Type <code>git switch main</code>.', done: (s, r) => r.ok && r.kind === 'switch' && s.head === 'main' },
        { text: 'Look at your files: <code>ls</code>. Is your test file there?', hint: 'Type <code>ls</code>. Only home.txt should be listed, because the test file lives on the experiment branch.', done: (s, r) => r.ok && r.kind === 'ls' && s.head === 'main' },
        { text: 'List the branches: <code>git branch</code>', hint: 'Type <code>git branch</code>. You should see both branches, with * on main.', done: (s, r) => r.ok && r.kind === 'branch' && /experiment/.test(r.out) }
      ],
      success: 'You made a safe space to experiment, and main never noticed. Try switching back and forth and watching ls.'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        'A <strong>branch</strong> is a separate line of history. It is just a <strong>label pointing at a commit</strong>.',
        '<code>git branch</code> lists branches. <code>git switch -c name</code> creates one and moves to it. <code>git switch name</code> moves to an existing one.',
        '<strong>HEAD</strong> is the label for "where you are now". New commits go on the current branch.',
        'Switching branches <strong>rewrites your working folder</strong> to match that branch.',
        'Next lesson: bring a branch back into main with <code>git merge</code>.'
      ]
    }
  ]
};
