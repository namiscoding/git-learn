window.LESSONS = window.LESSONS || {};
window.LESSONS['08'] = {
  title: 'Merging',
  slides: [
    {
      type: 'concept',
      title: 'Merge, case 1: fast-forward',
      body: [
        'You made a <code>feature</code> branch and added a commit. Meanwhile <strong>main did not change</strong>. To merge, you switch to the branch you want to <em>receive</em> the work (main), then say which branch to bring in.',
        'Because main has nothing of its own, Git does not need to combine anything. It just slides the main label forward.'
      ],
      graph: true,
      setup: ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"', 'git switch -c feature', 'echo "search box" > search.txt', 'git add search.txt', 'git commit -m "Add search box"', 'git switch main'],
      steps: [
        { cmd: 'git merge feature', caption: 'Fast-forward: the main label jumps to the same commit as feature. No new commit was needed.' },
        { cmd: 'git branch -d feature', caption: 'The feature label has done its job, so we delete it. The commits stay; only the label goes.' },
        { cmd: 'git log --oneline', caption: 'The history is one straight line, and main contains the search box.' }
      ]
    },
    {
      type: 'concept',
      title: 'Merge, case 2: both lines moved',
      body: [
        'Now main <strong>also</strong> got a commit while you worked on feature. The two lines have gone different ways, so Git cannot just slide a label.',
        'It makes a new <strong>merge commit</strong> with <em>two parents</em>, one from each line. Watch the lines join.'
      ],
      graph: true,
      note: 'In a real terminal, Git may open a text editor to confirm the merge message. Save and close it to continue. This course skips that step.',
      setup: ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"', 'git switch -c feature', 'echo "search box" > search.txt', 'git add search.txt', 'git commit -m "Add search box"', 'git switch main', 'echo "footer" > footer.txt', 'git add footer.txt', 'git commit -m "Add footer"'],
      steps: [
        { cmd: 'git merge feature', caption: 'A merge commit appears on main, with lines from both parents. Your folder now has the work from both branches.' },
        { cmd: 'ls', caption: 'home.txt, footer.txt (from main) and search.txt (from feature) are all here.' },
        { cmd: 'git log --oneline', caption: 'The log lists the merge commit and the commits from both lines.' }
      ]
    },
    {
      type: 'practice',
      title: 'Try it: merge a branch',
      body: [
        'Two lines of work are ready: <code>main</code> added a footer, and <code>feature</code> added a search box. You are on main. Bring feature in.'
      ],
      graph: true,
      setup: ['git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"', 'git switch -c feature', 'echo "search box" > search.txt', 'git add search.txt', 'git commit -m "Add search box"', 'git switch main', 'echo "footer" > footer.txt', 'git add footer.txt', 'git commit -m "Add footer"'],
      tasks: [
        { text: 'Merge feature into main: <code>git merge feature</code>', hint: 'Type <code>git merge feature</code>. You are already on main, which is the branch that receives the work.', done: (s, r) => r.ok && r.kind === 'merge' && /Merge made/.test(r.out) },
        { text: 'Check your files: <code>ls</code>', hint: 'Type <code>ls</code>. You should see three files.', done: (s, r) => r.ok && r.kind === 'ls' },
        { text: 'Delete the finished branch: <code>git branch -d feature</code>', hint: 'Type <code>git branch -d feature</code>. Git only allows -d if the branch is fully merged, which protects unmerged work.', done: (s, r) => r.ok && r.kind === 'branch' && /Deleted/.test(r.out) },
        { text: 'Read the history: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>.', done: (s, r) => r.ok && r.kind === 'log' }
      ],
      success: 'Two lines of work, one project. If both lines had changed the same line of the same file, Git would have asked you to decide, which is lesson 12.'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        'To merge, <strong>switch to the branch that should receive the work</strong>, then run <code>git merge &lt;other-branch&gt;</code>.',
        'If the receiving branch has no new commits, Git does a <strong>fast-forward</strong>: it just moves the label.',
        'If both lines moved, Git creates a <strong>merge commit</strong> with two parents.',
        '<code>git branch -d name</code> deletes a finished branch label. The commits stay in history.',
        'When the same lines were changed on both sides, you get a <strong>merge conflict</strong>. That is lesson 12.'
      ]
    }
  ]
};
