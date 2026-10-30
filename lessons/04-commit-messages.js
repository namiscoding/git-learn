window.LESSONS = window.LESSONS || {};
(function () {
  // A message is "clear enough" for practice if it has 3+ words and starts with a capital.
  const clear = (m) => !!m && m.trim().split(/\s+/).length >= 3 && /^[A-Z]/.test(m.trim());

  window.LESSONS['04'] = {
    title: 'Writing good commit messages',
    slides: [
      {
        type: 'story',
        title: 'The message is for your future self',
        body: [
          'Every commit carries a short message. In six months, the history is all you will have to understand what happened. "fix" will not help you then.',
          'Four habits make messages useful:',
          '<strong>1. Keep the first line short,</strong> around 50 characters.<br><strong>2. Start with a verb</strong> like a command: "Add", "Fix", "Remove".<br><strong>3. Say what changed,</strong> and why if it is not obvious.<br><strong>4. One idea per commit.</strong> Do not mix a bug fix and a redesign.'
        ],
        visualHtml:
          '<div class="msg-compare">' +
          '<div class="msg-col msg-bad reveal"><h3>Hard to use</h3><ul><li>stuff</li><li>fix</li><li>update</li><li>asdf</li><li>Changed some things in the login and also the header</li></ul></div>' +
          '<div class="msg-col msg-good reveal"><h3>Easy to use</h3><ul><li>Add login page</li><li>Fix crash on empty password</li><li>Show error on wrong password</li><li>Remove unused header image</li></ul></div>' +
          '</div>'
      },
      {
        type: 'concept',
        title: 'A history with vague messages',
        body: [
          'Here are three real changes, saved with vague messages. Watch the history at the end.',
          'Imagine a bug appears and you ask: <em>which commit broke the login?</em>'
        ],
        setup: ['git init', 'echo "login page" > app.txt', 'git add app.txt'],
        steps: [
          { cmd: 'git commit -m "stuff"', caption: 'The first change is saved with the message "stuff".' },
          { cmd: 'echo "fix empty password crash" >> app.txt', caption: 'A second change: this one fixes a crash.' },
          { cmd: 'git commit -am "fix"', caption: 'Saved as "fix". Fix of what?' },
          { cmd: 'echo "show error message" >> app.txt', caption: 'A third change, a new error message.' },
          { cmd: 'git commit -am "update"', caption: 'Saved as "update".' },
          { cmd: 'git log --oneline', caption: 'Which commit fixed the crash? You cannot tell from this list. You would have to open each one.' }
        ]
      },
      {
        type: 'concept',
        title: 'The same history with clear messages',
        body: [
          'Exactly the same three changes, but each message says what the commit does.',
          'Now the history reads like a short story, and the question from before has an answer.'
        ],
        setup: ['git init', 'echo "login page" > app.txt', 'git add app.txt'],
        steps: [
          { cmd: 'git commit -m "Add login page"', caption: 'Starts with a verb and says what was added.' },
          { cmd: 'echo "fix empty password crash" >> app.txt', caption: 'The same second change as before.' },
          { cmd: 'git commit -am "Fix crash on empty password"', caption: 'Now the message names the problem it solves.' },
          { cmd: 'echo "show error message" >> app.txt', caption: 'The same third change.' },
          { cmd: 'git commit -am "Show error on wrong password"', caption: 'Short, specific, one idea.' },
          { cmd: 'git log --oneline', caption: 'The crash was fixed in the second commit. You can see it without opening anything.' }
        ]
      },
      {
        type: 'practice',
        title: 'Try it: write clear messages',
        body: [
          'Make two commits with messages you would be happy to read later. This page only checks for a capital letter and at least three words, but aim for the four habits.'
        ],
        setup: ['git init'],
        tasks: [
          { text: 'Create a file: <code>echo "Buy milk" > todo.txt</code>', hint: 'Type <code>echo "Buy milk" > todo.txt</code>.', done: (s) => s.files.length > 0 },
          { text: 'Stage it and commit it with a clear message. For example: <code>git add todo.txt</code> then <code>git commit -m "Add todo list with first item"</code>', hint: 'Needs three or more words and a capital first letter. Start with a verb: "Add …".', done: (s, r) => r.ok && r.kind === 'commit' && clear(s.commits[0].message) },
          { text: 'Change the file: <code>echo "Call Sam" >> todo.txt</code>', hint: 'Type <code>echo "Call Sam" >> todo.txt</code>. The <code>&gt;&gt;</code> adds a line instead of replacing the file.', done: (s) => s.files.some((f) => f.work === 'modified') },
          { text: 'Commit again with a clear message: <code>git commit -am "Add Sam to the todo list"</code>', hint: '<code>-am</code> stages changes to tracked files and commits in one go. Use your own words, a verb first.', done: (s, r) => r.ok && r.kind === 'commit' && clear(s.commits[0].message) },
          { text: 'Read your history: <code>git log --oneline</code>', hint: 'Type <code>git log --oneline</code>. Would a stranger understand your work from these lines?', done: (s, r) => r.ok && r.kind === 'log' }
        ],
        success: 'Two commits with messages that explain themselves. This habit costs seconds now and saves hours later.'
      },
      {
        type: 'recap',
        title: 'What to remember',
        points: [
          'A commit message is a note to your <strong>future self and teammates</strong>.',
          'Keep the first line short, and start with a <strong>verb</strong> ("Add", "Fix", "Remove").',
          'Say <strong>what</strong> changed, and why if it is not obvious.',
          '<strong>One idea per commit</strong> makes history easy to read and easy to undo.',
          '<code>git commit -am "message"</code> stages tracked files and commits in one step. New files still need <code>git add</code>.'
        ]
      }
    ]
  };
})();
