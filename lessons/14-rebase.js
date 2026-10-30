window.LESSONS = window.LESSONS || {};
(function () {
  const URL_ = 'https://github.com/you/project.git';
  // feature has one commit; main moved on with another. You are on feature.
  const DIVERGED = [
    'git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"',
    'git switch -c feature', 'echo "search" > search.txt', 'git add search.txt', 'git commit -m "Add search"',
    'git switch main', 'echo "footer" > footer.txt', 'git add footer.txt', 'git commit -m "Add footer"',
    'git switch feature'
  ];
  // Both branches changed the same title line, and feature has two commits.
  const COLLISION = [
    'git init', 'echo "title" > page.txt', 'git add page.txt', 'git commit -m "Add page"',
    'git switch -c feature', 'echo "feature title" > page.txt', 'git commit -am "Change title on feature"',
    'echo "extra" > extra.txt', 'git add extra.txt', 'git commit -m "Add extra"',
    'git switch main', 'echo "main title" > page.txt', 'git commit -am "Change title on main"', 'git switch feature'
  ];

  window.LESSONS['14'] = {
    title: 'Rebase',
    slides: [
      {
        type: 'story',
        title: 'Two ways to combine branches',
        body: [
          'In lesson 8 you combined branches with <strong>merge</strong>, which keeps the true history, joins and all. <strong>Rebase</strong> gets the same result differently: it takes your commits, lifts them off, and <strong>replays them on top of the other branch</strong>, as if you had started from there.',
          'The history ends up as one straight line. The price: the replayed commits are <strong>new commits</strong> with new IDs. The old ones are replaced.'
        ],
        visualHtml:
          '<div class="compare-graphs">' +
          '<figure class="reveal"><figcaption>merge: keeps the fork and the join</figcaption>' +
          '<svg class="mini-graph" viewBox="0 0 300 130" role="img" aria-label="History with a fork and a merge commit that joins it">' +
          '<line x1="30" y1="35" x2="230" y2="35"/><path d="M80 35 C110 35,100 95,140 95"/><line x1="140" y1="95" x2="180" y2="95"/><path d="M180 95 C210 95,200 35,230 35"/>' +
          '<circle cx="30" cy="35" r="11"/><circle cx="80" cy="35" r="11"/><circle cx="140" cy="35" r="11"/><circle cx="230" cy="35" r="11"/><circle class="alt" cx="140" cy="95" r="11"/><circle class="alt" cx="180" cy="95" r="11"/></svg></figure>' +
          '<figure class="reveal"><figcaption>rebase: one straight line</figcaption>' +
          '<svg class="mini-graph" viewBox="0 0 300 130" role="img" aria-label="History as a single straight line">' +
          '<line x1="30" y1="65" x2="270" y2="65"/><circle cx="30" cy="65" r="11"/><circle cx="90" cy="65" r="11"/><circle cx="150" cy="65" r="11"/><circle class="alt" cx="210" cy="65" r="11"/><circle class="alt" cx="270" cy="65" r="11"/></svg></figure>' +
          '</div>'
      },
      {
        type: 'step',
        title: 'Rebase replays your commits',
        body: [
          '<code>main</code> moved ahead while you worked on <code>feature</code>. Rebase your branch onto it. Watch the History panel: your old commit disappears, and a <strong>new copy with a new ID</strong> appears on top of main.'
        ],
        graph: true,
        setup: DIVERGED,
        steps: [
          { cmd: 'git log --oneline', caption: 'You are on feature. It has "Add search" on top of the first commit. main has gone its own way.' },
          { cmd: 'git rebase main', caption: 'Git replays "Add search" on top of main\'s latest commit. Look at the ID: it changed, because it is a new commit.' },
          { cmd: 'git log --oneline', caption: 'The history is now one straight line: home page, footer, search.' },
          { cmd: 'git switch main', caption: 'Back to main.' },
          { cmd: 'git merge feature', caption: 'Because feature is directly ahead of main, this merge is a fast-forward: no merge commit, no join. That is the payoff.' }
        ]
      },
      {
        type: 'step',
        title: 'When a rebase hits a conflict',
        body: [
          'Rebase replays commits <strong>one at a time</strong>, so a conflict can stop it partway. The fix is the same as in lesson 12, with a different last step: <code>git rebase --continue</code> instead of <code>git commit</code>.',
          'Watch the diagram: HEAD detaches and builds the new commits while <code>feature</code> still points at the old ones.'
        ],
        graph: true,
        setup: COLLISION,
        steps: [
          { cmd: 'git rebase main', caption: 'The first replayed commit changes the same line main changed, so Git stops on it. Nothing is lost.' },
          { cmd: 'git status', caption: 'Status shows the rebase in progress: which commit stopped, and what is left to do.' },
          { cmd: 'echo "A title we both like" > page.txt', caption: 'Edit the file to the final content, as with a merge conflict.' },
          { cmd: 'git add page.txt', caption: 'Mark it resolved.' },
          { cmd: 'git rebase --continue', caption: 'Git commits the fixed commit, replays the next one, and finishes. The feature label moves to the new commits.' },
          { cmd: 'git log --oneline', caption: 'A straight line again, with both of your commits on top of main.' }
        ],
        note: 'Changed your mind mid-rebase? git rebase --abort restores everything. git rebase --skip drops the commit that stopped.'
      },
      {
        type: 'step',
        title: 'The golden rule: do not rebase shared commits',
        body: [
          'Rebase <strong>replaces</strong> commits. If those commits were already pushed, GitHub still has the old ones, and your history no longer matches. A normal push is rejected.',
          'You can force it, but <strong>only do this on a branch that only you use</strong>. Otherwise you overwrite teammates\' work.'
        ],
        remote: true,
        setup: [
          'git init', 'echo "home" > home.txt', 'git add home.txt', 'git commit -m "Add home page"',
          'git remote add origin ' + URL_, 'git push -u origin main',
          'git switch -c feature', 'echo "search" > search.txt', 'git add search.txt', 'git commit -m "Add search"',
          'git push -u origin feature',
          'git switch main', 'echo "footer" > footer.txt', 'git add footer.txt', 'git commit -m "Add footer"', 'git push',
          'git switch feature'
        ],
        steps: [
          { cmd: 'git rebase main', caption: 'Your feature commit is replaced by a new one on top of main. GitHub still has the old one.' },
          { cmd: 'git status', caption: 'Git says your branch and origin/feature have diverged: each has a commit the other lacks.' },
          { cmd: 'git push', caption: 'Rejected. Git refuses to overwrite what GitHub has.' },
          { cmd: 'git push --force', caption: 'Forced update: GitHub\'s feature is replaced by yours. Only safe because nobody else uses this branch.' }
        ],
        note: 'git push --force-with-lease is the safer cousin: it refuses if someone else pushed in the meantime.'
      },
      {
        type: 'practice',
        title: 'Try it: rebase and fast-forward',
        body: [
          'Same situation as before: <code>feature</code> has one commit, and <code>main</code> has moved on. You are on <code>feature</code>. Rebase, then merge.'
        ],
        graph: true,
        setup: DIVERGED,
        tasks: [
          { text: 'Rebase onto main: <code>git rebase main</code>', hint: 'Type <code>git rebase main</code>. You should see "Successfully rebased".', done: (s, r) => r.ok && r.kind === 'rebase' && /Successfully/.test(r.out) },
          { text: 'Look at the history: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>. One straight line.', done: (s, r) => r.ok && r.kind === 'log' },
          { text: 'Go to main: <code>git switch main</code>', hint: 'Type <code>git switch main</code>.', done: (s, r) => r.ok && r.kind === 'switch' && s.head === 'main' },
          { text: 'Merge feature: <code>git merge feature</code>', hint: 'Type <code>git merge feature</code>. It will be a fast-forward.', done: (s, r) => r.ok && r.kind === 'merge' && /Fast-forward/.test(r.out) }
        ],
        success: 'A clean, straight history. Remember the rule: rebase your own unshared commits, merge when others are involved.'
      },
      {
        type: 'recap',
        title: 'What to remember',
        points: [
          '<code>git rebase main</code> (while on your branch) <strong>replays your commits on top of main</strong>, giving you a straight line.',
          'The replayed commits are <strong>new commits with new IDs</strong>. The old ones are replaced.',
          'If it stops on a conflict: edit, <code>git add</code>, then <code>git rebase --continue</code>. Or <code>--abort</code> to go back, <code>--skip</code> to drop that commit.',
          '<strong>Golden rule:</strong> never rebase commits that other people already have. Rebasing then pushing needs <code>--force</code>, which overwrites the remote.',
          'Merge keeps the true history, rebase makes it tidy. Many teams use rebase for their own branches and merge to combine them.'
        ]
      }
    ]
  };
})();
