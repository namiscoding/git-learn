window.LESSONS = window.LESSONS || {};
(function () {
  const URL_ = 'https://github.com/you/project.git';

  window.LESSONS['11'] = {
    title: 'Pull requests',
    slides: [
      {
        type: 'story',
        title: 'A pull request is a proposal',
        body: [
          'On a team you rarely push straight to <code>main</code>. Instead you put your work on a branch, push the branch, and ask: <strong>"please pull my changes into main"</strong>. That request is a <strong>pull request</strong>, or PR.',
          'A PR is a feature of <strong>GitHub</strong>, not of Git. It is a web page where teammates read your changes, comment, and approve. Then someone clicks the green button to merge.',
          'The whole flow: branch, commit, push the branch, open the PR, review, merge, then pull the result.'
        ],
        visualHtml:
          '<div class="pr-mock" role="img" aria-label="A mock pull request page titled Add footer, from branch add-footer into main, with a Merge pull request button">' +
          '<div class="pr-head reveal"><span class="pr-badge">Open</span><strong>Add footer</strong><span class="pr-num">#1</span></div>' +
          '<p class="pr-meta reveal"><b>you</b> wants to merge 1 commit into <code>main</code> from <code>add-footer</code></p>' +
          '<div class="pr-diff reveal"><div class="pr-file">home.txt</div><div class="pr-line add">+ footer</div></div>' +
          '<div class="pr-review reveal"><span class="pr-check">&#10003;</span> Sam approved these changes</div>' +
          '<div class="pr-merge reveal"><span class="pr-btn">Merge pull request</span></div>' +
          '</div>'
      },
      {
        type: 'step',
        title: 'The pull request flow, end to end',
        body: [
          'Two steps happen on GitHub, not in your terminal. They appear in the step list as lines starting with <code>#</code>.',
          'Watch the right-hand panel: the branch <code>add-footer</code> reaches GitHub first, then main gets the merge there. Your own main only catches up when you <strong>pull</strong>.'
        ],
        remote: true,
        setup: [
          'git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"',
          'git remote add origin ' + URL_, 'git push -u origin main'
        ],
        steps: [
          { cmd: 'git switch -c add-footer', caption: 'Work on a branch, never directly on main.' },
          { cmd: 'echo "footer" >> home.txt', caption: 'You make your change.' },
          { cmd: 'git commit -am "Add footer"', caption: 'Saved on your branch only.' },
          { cmd: 'git push -u origin add-footer', caption: 'The branch reaches GitHub. GitHub\'s main has not changed, and nothing is merged yet.' },
          { label: 'On GitHub: you open a pull request, and Sam reviews and approves it', noop: true, caption: 'This is the human part: reading the changes, commenting, asking for fixes. Nothing in the repository changes yet.', output: 'Pull request #1: add-footer into main. Approved by Sam.' },
          { label: 'On GitHub: someone clicks "Merge pull request"', githubMerge: { head: 'add-footer', base: 'main' }, caption: 'GitHub merges the branch into main, making a merge commit on its side. Your computer has not heard about it.', output: 'Merge pull request #1 from you/add-footer' },
          { cmd: 'git switch main', caption: 'Back to your local main, which is now behind GitHub\'s.' },
          { cmd: 'git pull', caption: 'Pull brings the merge commit down. Your main catches up, and the footer is on main.' },
          { cmd: 'git branch -d add-footer', caption: 'The branch is merged, so you can delete the local label.' }
        ]
      },
      {
        type: 'practice',
        title: 'Try it: your first pull request',
        body: [
          'You have cloned a project. Make a branch called <code>my-feature</code>, push it, then use the button below to stand in for clicking "Merge pull request" on GitHub.'
        ],
        remote: true,
        setup: [
          { seedRemote: { url: URL_, commits: [{ file: 'home.txt', text: 'home', message: 'Add home page' }] } },
          'git clone ' + URL_
        ],
        githubButton: { label: 'Simulate GitHub: Merge pull request', head: 'my-feature', base: 'main' },
        tasks: [
          { text: 'Create a branch: <code>git switch -c my-feature</code>', hint: 'Type <code>git switch -c my-feature</code>. Use exactly that name, because the GitHub button looks for it.', done: (s, r) => r.ok && r.kind === 'switch' && s.head === 'my-feature' },
          { text: 'Commit a change on it. For example: <code>echo "hello" > hello.txt</code>, <code>git add hello.txt</code>, <code>git commit -m "Add hello"</code>', hint: 'Three commands, ending with a commit.', done: (s, r) => r.ok && r.kind === 'commit' && s.head === 'my-feature' },
          { text: 'Push the branch: <code>git push -u origin my-feature</code>', hint: 'Type <code>git push -u origin my-feature</code>. Watch the branch appear on the GitHub side.', done: (s, r) => r.ok && r.kind === 'push' },
          { text: 'Merge the pull request: press the <strong>Simulate GitHub</strong> button', hint: 'It is the blue button above the terminal. It does what the green button on GitHub does.', done: (s, r) => r.kind === 'github' },
          { text: 'Go back to main: <code>git switch main</code>', hint: 'Type <code>git switch main</code>.', done: (s, r) => r.ok && r.kind === 'switch' && s.head === 'main' },
          { text: 'Bring the merged result down: <code>git pull</code>', hint: 'Type <code>git pull</code>. Your main catches up with GitHub\'s.', done: (s, r) => r.ok && r.kind === 'pull' }
        ],
        success: 'That is the loop most teams follow every day. Run ls: your hello.txt is now on main.'
      },
      {
        type: 'recap',
        title: 'What to remember',
        points: [
          'A <strong>pull request</strong> asks to merge one branch into another. It is a GitHub feature, not a Git command.',
          'The flow: <strong>branch, commit, push the branch, open the PR, review, merge on GitHub, pull</strong>.',
          'Merging on GitHub changes GitHub\'s main. Your own main updates only when you <code>git pull</code>.',
          'Work on branches so that <code>main</code> always stays in a working state.',
          'Next: what happens when two people change the same line.'
        ]
      }
    ]
  };
})();
