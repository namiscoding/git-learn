window.LESSONS = window.LESSONS || {};
window.LESSONS['03'] = {
  title: 'Your first commit',
  slides: [
    {
      type: 'concept',
      title: 'Two commands make a save',
      body: [
        'A <strong>commit</strong> is a saved snapshot of your project that you can return to later.',
        'Making one takes two commands: <code>git add</code> chooses what goes in the snapshot, and <code>git commit</code> saves it.',
        'Watch the file travel from the working folder, through the staging area, into the repository.'
      ],
      setup: ['git init', 'echo "hello world" > hello.txt'],
      steps: [
        { cmd: 'git add hello.txt', caption: 'git add moves hello.txt into the staging area. Nothing is saved yet.' },
        { cmd: 'git commit -m "Add hello.txt"', caption: 'git commit saves the staged files. A commit dot appears, labelled with its short ID (a fingerprint of the snapshot).' }
      ]
    },
    {
      type: 'step',
      title: 'Why two steps?',
      body: [
        'Because the staging area lets you <strong>choose</strong>. Here are two new files, but we only want one in the first commit.',
        'Press <strong>Next step</strong> and watch which file gets saved.'
      ],
      setup: ['git init', 'echo "first" > a.txt', 'echo "second" > b.txt'],
      steps: [
        { cmd: 'git add a.txt', caption: 'Only a.txt moves to the staging area. b.txt stays behind in the working folder.' },
        { cmd: 'git status', caption: 'Git confirms it: a.txt is "to be committed", and b.txt is still untracked.' },
        { cmd: 'git commit -m "Add a.txt"', caption: 'The commit contains only a.txt. b.txt was not staged, so it was left out.' },
        { cmd: 'git log --oneline', caption: 'git log lists your commits. Each has a short ID (a fingerprint) and your message.' }
      ]
    },
    {
      type: 'practice',
      title: 'Try it: make your first commit',
      body: [
        'A repository is already created for you. Do the tasks in order, and watch the diagram after every command.'
      ],
      setup: ['git init'],
      tasks: [
        { text: 'Create a file with some text: <code>echo "my first file" > first.txt</code>', hint: 'Type <code>echo "my first file" > first.txt</code>. The <code>&gt;</code> sends the text into a file instead of printing it.', done: (s) => s.files.length > 0 },
        { text: 'Stage it: <code>git add first.txt</code>', hint: 'Type <code>git add first.txt</code>. The shape should move into the staging area.', done: (s) => s.files.some((f) => f.staged) },
        { text: 'Save it: <code>git commit -m "My first commit"</code>', hint: 'Type <code>git commit -m "My first commit"</code>. The text in quotes is your message. If Git says "nothing to commit", you probably skipped git add.', done: (s, r) => r.ok && r.kind === 'commit' },
        { text: 'See your history: <code>git log</code>', hint: 'Type <code>git log</code>, or <code>git log --oneline</code> for a short version.', done: (s, r) => r.ok && r.kind === 'log' }
      ],
      success: 'You made a commit and found it in the history. Try making a second file or editing first.txt (echo "more" >> first.txt), then add and commit again.'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        'A <strong>commit</strong> is a saved snapshot of the staged files.',
        '<code>git add &lt;file&gt;</code> chooses what goes into the next commit.',
        '<code>git commit -m "message"</code> saves it, with a short note about what changed.',
        'Files you did not add are <strong>not</strong> in the commit. That is the point of the staging area.',
        '<code>git log</code> lists your commits.'
      ]
    }
  ]
};
