window.LESSONS = window.LESSONS || {};
(function () {
  // Two branches both changed the title line of page.txt. main has the "main title" version.
  const COLLISION = [
    'git init', 'echo "title" > page.txt', 'git add page.txt', 'git commit -m "Add page"',
    'git switch -c feature', 'echo "feature title" > page.txt', 'git commit -am "Change title on feature"',
    'git switch main', 'echo "main title" > page.txt', 'git commit -am "Change title on main"'
  ];

  window.LESSONS['12'] = {
    title: 'Merge conflicts',
    slides: [
      {
        type: 'story',
        title: 'When Git cannot decide for you',
        body: [
          'Git merges two branches line by line. If the branches changed <strong>different</strong> lines, it combines them on its own. If both changed the <strong>same line</strong> in different ways, Git cannot know which one you want. That is a <strong>merge conflict</strong>.',
          'It is not an error, and nothing is lost. Git stops, puts <strong>both versions</strong> into the file between marker lines, and asks you to choose.',
          'Here is what that looks like inside the file:'
        ],
        visualHtml:
          '<div class="conflict-file" role="img" aria-label="A file with conflict markers: your version, then a separator, then their version">' +
          '<p class="cf-line cf-marker reveal">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD</p>' +
          '<p class="cf-line cf-ours reveal">main title</p>' +
          '<p class="cf-line cf-marker reveal">=======</p>' +
          '<p class="cf-line cf-theirs reveal">feature title</p>' +
          '<p class="cf-line cf-marker reveal">&gt;&gt;&gt;&gt;&gt;&gt;&gt; feature</p>' +
          '<ul class="cf-key reveal">' +
          '<li><span class="cf-ours">Green</span>: your version, from the branch you are on (HEAD)</li>' +
          '<li><span class="cf-theirs">Blue</span>: their version, from the branch being merged</li>' +
          '<li>The marker lines are <strong>not</strong> part of your file. You delete them.</li>' +
          '</ul>' +
          '</div>'
      },
      {
        type: 'step',
        title: 'Cause a conflict, then fix it',
        body: [
          'Both branches changed the title line of <code>page.txt</code>. Merge them, and follow the five stages: <strong>merge, look, edit, add, commit</strong>.',
          'Watch the file in the diagram: it turns red and says "conflict" until you mark it resolved with <code>git add</code>.'
        ],
        graph: true,
        setup: COLLISION,
        steps: [
          { cmd: 'git merge feature', caption: 'Git merged what it could and stopped on page.txt. The merge is now "in progress".' },
          { cmd: 'git status', caption: 'Status lists page.txt under "Unmerged paths", "both modified". It also tells you how to back out: git merge --abort.' },
          { cmd: 'cat page.txt', caption: 'Both versions are in the file, between the marker lines. In real life you open it in an editor.' },
          { cmd: 'echo "A title we both like" > page.txt', caption: 'You decide the final content. Here we replace the whole file, which also removes the marker lines. You can keep one side, the other, or a mix.' },
          { cmd: 'git add page.txt', caption: 'git add means "this file is resolved". The red "conflict" tag clears.' },
          { cmd: 'git status', caption: 'Git now says all conflicts are fixed, and waits for you to conclude the merge.' },
          { cmd: 'git commit', caption: 'The merge commit is created, with its default message. (Real Git may open an editor for the message; this course skips that.)' },
          { cmd: 'git log --oneline', caption: 'The history shows the merge commit joining both lines.' }
        ]
      },
      {
        type: 'step',
        title: 'Changed your mind? Back out safely',
        body: [
          'If a conflict looks scarier than you expected, you can walk away. <code>git merge --abort</code> puts everything back exactly as it was before you started the merge.'
        ],
        graph: true,
        setup: COLLISION.concat(['git merge feature']),
        steps: [
          { cmd: 'git status', caption: 'You are in the middle of a conflicted merge.' },
          { cmd: 'git merge --abort', caption: 'Merge cancelled. No output means it worked.' },
          { cmd: 'git status', caption: 'Clean again, as if you had never merged.' },
          { cmd: 'cat page.txt', caption: 'The file is back to your main version, with no markers.' }
        ]
      },
      {
        type: 'practice',
        title: 'Try it: resolve a conflict',
        body: [
          'The same situation is set up: <code>main</code> and <code>feature</code> both changed the title. Merge, look at the conflict, resolve it, and finish.'
        ],
        graph: true,
        setup: COLLISION,
        tasks: [
          { text: 'Start the merge: <code>git merge feature</code>', hint: 'Type <code>git merge feature</code>. It will report a conflict. That is expected.', done: (s, r) => r.kind === 'merge' && !r.ok && /CONFLICT/.test(r.out) },
          { text: 'Look at the conflicted file: <code>cat page.txt</code>', hint: 'Type <code>cat page.txt</code>. Find the <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, <code>=======</code> and <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> lines.', done: (s, r, line) => r.ok && r.kind === 'cat' && /page\.txt/.test(line) && /<<<<<<</.test(r.out) },
          { text: 'Write the final version of the file: <code>echo "My final title" > page.txt</code>', hint: 'Type <code>echo "My final title" > page.txt</code>. That replaces the file, so the marker lines are gone.', done: (s, r, line) => r.ok && r.kind === 'write' && /page\.txt/.test(line) },
          { text: 'Mark it resolved: <code>git add page.txt</code>', hint: 'Type <code>git add page.txt</code>. Then <code>git status</code> shows what is next.', done: (s, r, line) => r.ok && r.kind === 'add' && !s.files.some((f) => f.unmerged) },
          { text: 'Conclude the merge: <code>git commit</code>', hint: 'Type <code>git commit</code>. No message needed: Git supplies "Merge branch \'feature\'".', done: (s, r) => r.ok && r.kind === 'commit' && /Merge branch/.test(r.out) }
        ],
        success: 'Conflict resolved. The scary-looking markers are just a note telling you where to decide. Nothing was lost along the way.'
      },
      {
        type: 'recap',
        title: 'What to remember',
        points: [
          'A <strong>conflict</strong> happens when both branches changed the <strong>same lines</strong>. Git asks you to choose; it is not an error.',
          'The file contains <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> (your side), <code>=======</code>, and <code>&gt;&gt;&gt;&gt;&gt;&gt;&gt;</code> (their side). <strong>Edit the file and delete the marker lines.</strong>',
          'The recipe: <strong>merge, status, edit, add, commit</strong>.',
          '<code>git add</code> on a conflicted file means "resolved". <code>git commit</code> will refuse until every conflicted file is added.',
          '<code>git merge --abort</code> cancels the merge and restores everything.',
          'You can reduce conflicts by merging often and keeping branches short.'
        ]
      }
    ]
  };
})();
