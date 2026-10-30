window.LESSONS = window.LESSONS || {};
window.LESSONS['05'] = {
  title: 'Looking at history',
  slides: [
    {
      type: 'concept',
      title: 'git log: the story so far',
      body: [
        'A repository with some history is already set up here: three commits on one story file.',
        '<code>git log</code> lists the commits, newest first. First the short version, then the full one.'
      ],
      setup: [
        'git init',
        'echo "Once upon a time" > story.txt',
        'git add story.txt',
        'git commit -m "Start the story"',
        'echo "There was a dragon" >> story.txt',
        'git commit -am "Add a dragon"',
        'echo "It was friendly" >> story.txt',
        'git commit -am "Make the dragon friendly"'
      ],
      steps: [
        { cmd: 'git log --oneline', caption: 'One line per commit: a short ID, then the message. "HEAD -> main" marks where you are now: the newest commit on the main line.' },
        { cmd: 'git log', caption: 'The full version adds the complete ID, the author, and the date. The long ID is the commit\'s unique fingerprint.' }
      ]
    },
    {
      type: 'step',
      title: 'git diff: what exactly changed?',
      body: [
        'The log tells you <em>that</em> something changed. <code>git diff</code> shows <em>what</em>, line by line. Lines starting with <code>+</code> were added; lines starting with <code>-</code> were removed.',
        'It compares two of the three areas. Watch which two, at each step.'
      ],
      setup: ['git init', 'echo "Once upon a time" > story.txt', 'git add story.txt', 'git commit -m "Start the story"'],
      steps: [
        { cmd: 'echo "There was a dragon" >> story.txt', caption: 'You add a line in the working folder. Git has noticed the change but nothing is staged yet.' },
        { cmd: 'git diff', caption: 'Plain git diff compares the working folder with the staging area. The new line shows with a +.' },
        { cmd: 'git add story.txt', caption: 'Now the change is staged.' },
        { cmd: 'git diff', caption: 'Nothing! The working folder and the staging area now match, so there is no difference to show.' },
        { cmd: 'git diff --staged', caption: 'With --staged, Git compares the staging area with the last commit. This shows exactly what the next commit will contain.' },
        { cmd: 'git commit -m "Add a dragon"', caption: 'Saved. A quick git diff --staged before committing is a good habit: it is your last chance to check.' }
      ]
    },
    {
      type: 'practice',
      title: 'Try it: read your changes',
      body: [
        'A story file is already committed. Change it, look at the change, stage it, look again, then save it.'
      ],
      setup: ['git init', 'echo "Once upon a time" > story.txt', 'git add story.txt', 'git commit -m "Start the story"'],
      tasks: [
        { text: 'Add a line: <code>echo "There was a dragon" >> story.txt</code>', hint: 'Type <code>echo "There was a dragon" >> story.txt</code>.', done: (s) => s.files.some((f) => f.work === 'modified') },
        { text: 'See the change: <code>git diff</code>', hint: 'Type <code>git diff</code>. Find the line starting with +.', done: (s, r) => r.ok && r.kind === 'diff' && r.out.length > 0 },
        { text: 'Stage it, then check what will be committed: <code>git add story.txt</code> and <code>git diff --staged</code>', hint: 'Run <code>git add story.txt</code> first. Plain <code>git diff</code> would now print nothing.', done: (s, r, line) => r.ok && r.kind === 'diff' && /--staged|--cached/.test(line) && r.out.length > 0 },
        { text: 'Save it: <code>git commit -m "Add a dragon"</code>', hint: 'Type <code>git commit -m "Add a dragon"</code>.', done: (s, r) => r.ok && r.kind === 'commit' },
        { text: 'See the history: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>. You should see two commits.', done: (s, r) => r.ok && r.kind === 'log' }
      ],
      success: 'You can now ask Git two questions: what happened (log) and what exactly changed (diff).'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        '<code>git log --oneline</code> lists commits, newest first, one line each.',
        '<code>git log</code> adds the full ID, author and date.',
        '<code>git diff</code> compares the <strong>working folder</strong> with the <strong>staging area</strong>.',
        '<code>git diff --staged</code> compares the <strong>staging area</strong> with the <strong>last commit</strong>: what your next commit will contain.',
        'Lines with <code>+</code> were added; lines with <code>-</code> were removed.'
      ]
    }
  ]
};
