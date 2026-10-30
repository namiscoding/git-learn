window.LESSONS = window.LESSONS || {};
window.LESSONS['06'] = {
  title: 'Ignoring files with .gitignore',
  slides: [
    {
      type: 'story',
      title: 'Not everything belongs in history',
      body: [
        'Some files in a project should never be saved by Git: passwords, logs, and downloaded packages that can be rebuilt. Secrets are the dangerous ones. Once committed and shared, they are very hard to take back.',
        'A file called <code>.gitignore</code> lists patterns Git should pretend not to see.'
      ],
      visualHtml:
        '<ul class="folder-list" aria-label="A project folder and which files to keep">' +
        '<li class="reveal"><code>app.txt</code><span class="tag keep">keep</span><small>your work</small></li>' +
        '<li class="reveal"><code>notes.txt</code><span class="tag keep">keep</span><small>your work</small></li>' +
        '<li class="reveal"><code>debug.log</code><span class="tag skip">ignore</span><small>clutter that changes constantly</small></li>' +
        '<li class="reveal"><code>.env</code><span class="tag skip">ignore</span><small>passwords and keys</small></li>' +
        '<li class="reveal"><code>node_modules/</code><span class="tag skip">ignore</span><small>thousands of downloaded files</small></li>' +
        '</ul>'
    },
    {
      type: 'concept',
      title: 'Watch files disappear from Git\'s view',
      body: [
        'The project has three files: <code>app.txt</code>, a log, and a file with a password. First Git sees all of them.',
        'Then we write a <code>.gitignore</code> and ask again. Patterns like <code>*.log</code> mean "every file ending in .log".'
      ],
      setup: ['git init', 'echo "hello" > app.txt', 'echo "debug output" > debug.log', 'echo "PASSWORD=1234" > .env'],
      steps: [
        { cmd: 'git status', caption: 'All three files are untracked. The password file is one careless "git add ." away from being saved.' },
        { cmd: 'echo "*.log" > .gitignore', caption: 'The first rule: ignore every file ending in .log.' },
        { cmd: 'echo ".env" >> .gitignore', caption: 'The second rule: ignore the file named .env. (>> adds a line instead of replacing the file.)' },
        { cmd: 'git status', caption: 'debug.log and .env are gone from the list. The only new thing is .gitignore itself, which you should commit so everyone shares the rules.' },
        { cmd: 'git add .', caption: '"Add everything" is now safe: ignored files are skipped.' },
        { cmd: 'git commit -m "Add app and ignore rules"', caption: 'Saved: app.txt and .gitignore. The log and the password file are still in the folder, but not in history.' }
      ]
    },
    {
      type: 'step',
      title: 'A trap: ignoring is not deleting',
      body: [
        '<code>.gitignore</code> only affects files Git is <strong>not tracking yet</strong>. If a file was already committed, adding it to the ignore list changes nothing.',
        'Here a password file was committed by mistake. Then we add the rule, too late.'
      ],
      setup: ['git init', 'echo "PASSWORD=1234" > .env', 'git add .env', 'git commit -m "Oops, saved the password file"'],
      steps: [
        { cmd: 'echo ".env" > .gitignore', caption: 'You add the rule you should have written first.' },
        { cmd: 'git status', caption: '.env is not mentioned as a problem, and it is still in the repository: Git keeps tracking files it has already saved. Only .gitignore is listed, as new.' }
      ],
      note: 'Lesson 9 shows how to stop tracking a file. If a real secret was ever pushed to GitHub, treat it as leaked and change it.'
    },
    {
      type: 'practice',
      title: 'Try it: ignore a log file',
      body: [
        'A project already has <code>notes.txt</code> and a noisy <code>app.log</code>. Keep the notes, ignore the log.'
      ],
      setup: ['git init', 'echo "hello" > notes.txt', 'echo "debug" > app.log'],
      tasks: [
        { text: 'Look at the project: <code>git status</code>', hint: 'Type <code>git status</code>. Both files are untracked.', done: (s, r) => r.ok && r.kind === 'status' && s.files.some((f) => f.name === 'app.log' && f.untracked) },
        { text: 'Ignore all log files: <code>echo "*.log" > .gitignore</code>', hint: 'Type <code>echo "*.log" > .gitignore</code>. The quotes stop the shell from treating * specially.', done: (s, r, line) => r.ok && /\.gitignore/.test(line) && /\*\.log/.test(line) },
        { text: 'Check again: <code>git status</code>. Is app.log gone from the list?', hint: 'Type <code>git status</code>. You should see notes.txt and .gitignore, but not app.log.', done: (s, r) => r.ok && r.kind === 'status' && !s.files.some((f) => f.name === 'app.log') },
        { text: 'Add everything and commit: <code>git add .</code> then <code>git commit -m "Add notes and ignore logs"</code>', hint: 'Run <code>git add .</code>, then the commit. app.log will not be included.', done: (s, r) => r.ok && r.kind === 'commit' && s.commits.length >= 1 }
      ],
      success: 'app.log is still in your folder (try ls), but Git never saved it. Try git add app.log and read what Git says.'
    },
    {
      type: 'recap',
      title: 'What to remember',
      points: [
        '<code>.gitignore</code> is a plain file listing patterns Git should <strong>not track</strong>.',
        'Typical entries: <code>*.log</code> (logs), <code>.env</code> (secrets), <code>node_modules/</code> (downloaded packages).',
        'Commit <code>.gitignore</code> itself so everyone on the project shares the rules.',
        'It only affects files that are <strong>not tracked yet</strong>. Write it before the first <code>git add .</code>.',
        'Never commit passwords or keys. If one was pushed to GitHub, treat it as leaked.'
      ]
    }
  ]
};
