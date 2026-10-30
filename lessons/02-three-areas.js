window.LESSONS = window.LESSONS || {};
window.LESSONS['02'] = {
  title: 'The three areas',
  slides: [
    {
      type: 'concept',
      title: 'Git keeps your work in three places',
      body: [
        'Almost every confusing moment in Git comes from not knowing <strong>where</strong> a change is right now. So learn the three places first.',
        '<strong>Working folder:</strong> the files you see and edit.<br><strong>Staging area:</strong> a waiting room for changes you want in the next save.<br><strong>Repository:</strong> the saved snapshots, called commits.',
        'Watch the diagram on the right. The page is running real commands, and the shapes move to show what happened.'
      ],
      setup: [],
      steps: [
        { cmd: 'git init', caption: 'The repository did not exist before. git init creates it (a hidden .git folder inside your project).' },
        { cmd: 'touch notes.txt', caption: 'A new file appears in the working folder. Git can see it, but it is not tracking it yet, so it is marked "untracked".' },
        { cmd: 'git status', caption: 'git status reports where every file is. It changes nothing; it only tells you.' }
      ]
    },
    {
      type: 'step',
      title: 'A file travels left to right',
      body: [
        'Press <strong>Next step</strong> to run each command yourself, one at a time. Watch the file move.',
        'You will type these commands in the next lesson. For now, just notice that <strong>a file moves one area at a time</strong>, and that git status describes each area in words.'
      ],
      setup: ['git init', 'touch todo.txt'],
      steps: [
        { cmd: 'git status', caption: 'todo.txt is in the working folder only. Git lists it under "Untracked files".' },
        { cmd: 'git add todo.txt', caption: 'git add moves the file into the staging area. It is now picked for the next commit.' },
        { cmd: 'git status', caption: 'Now Git lists it under "Changes to be committed": it is waiting in the staging area.' },
        { cmd: 'git commit -m "Add todo list"', caption: 'git commit saves everything in the staging area as a snapshot. The file now sits in the repository, and a commit dot appears.' },
        { cmd: 'git status', caption: 'Nothing is waiting anywhere, so Git says the working tree is clean.' }
      ]
    },
    {
      type: 'practice',
      title: 'Try it: look at the three areas',
      body: [
        'Use the terminal below. The diagram shows exactly what your commands do. Nothing here can break your real computer.'
      ],
      setup: [],
      tasks: [
        { text: 'Create a repository: <code>git init</code>', hint: 'Type <code>git init</code> and press Enter. The right-hand box stops saying "No repository yet".', done: (s) => s.initialized },
        { text: 'Make a file: <code>touch hello.txt</code>', hint: 'Type <code>touch hello.txt</code>. A shape appears in the working folder.', done: (s) => s.initialized && s.files.length > 0 },
        { text: 'Ask Git where it is: <code>git status</code>', hint: 'Type <code>git status</code>. Find hello.txt in the output and say which area it is in.', done: (s, r) => r.ok && r.kind === 'status' && s.files.length > 0 }
      ],
      success: 'All three done. You created a repository, put a file in the working folder, and asked Git where it is. Try ls, or run git status again.'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        'Git has <strong>three areas</strong>: working folder, staging area, repository.',
        '<code>git init</code> creates the repository.',
        'A new file starts <strong>untracked</strong> in the working folder.',
        '<code>git status</code> tells you which area each file is in, and changes nothing.',
        'Next lesson: you move files across the areas with <code>git add</code> and <code>git commit</code>.'
      ]
    }
  ]
};
