// Pre-deploy checks: fail the pipeline if the site is obviously broken.
// Run locally with:  node scripts/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const problems = [];
const fail = (msg) => problems.push(msg);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

// 1. Our own JavaScript must parse (vendored libraries are skipped).
const ours = ['js', 'lessons']
  .flatMap((dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => dir + '/' + e.name));
for (const file of ours) {
  try {
    new vm.Script(read(file), { filename: file });
  } catch (e) {
    fail(file + ': syntax error: ' + e.message);
  }
}

// 2. Every file an HTML page points at must exist.
for (const page of ['index.html', 'lesson.html']) {
  const html = read(page);
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const ref = m[1];
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('mailto:')) continue;
    if (!exists(ref)) fail(page + ': missing file ' + ref);
  }
}

// 3. Every lesson marked ready must have a file that registers itself with slides.
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('js/lessons-list.js'), sandbox);
const list = sandbox.window.LESSON_LIST || [];
if (list.length === 0) fail('js/lessons-list.js: LESSON_LIST is empty');
const ids = new Set();
for (const entry of list) {
  if (ids.has(entry.id)) fail('duplicate lesson id ' + entry.id);
  ids.add(entry.id);
  if (!entry.file) continue;
  const rel = 'lessons/' + entry.file + '.js';
  if (!exists(rel)) {
    fail(rel + ': listed as ready but the file is missing');
    continue;
  }
  const lessonSandbox = { window: {} };
  vm.createContext(lessonSandbox);
  try {
    vm.runInContext(read(rel), lessonSandbox);
  } catch (e) {
    fail(rel + ': ' + e.message);
    continue;
  }
  const lesson = (lessonSandbox.window.LESSONS || {})[entry.id];
  if (!lesson) fail(rel + ': does not register LESSONS["' + entry.id + '"]');
  else if (!Array.isArray(lesson.slides) || lesson.slides.length === 0) fail(rel + ': no slides');
  else {
    lesson.slides.forEach((s, i) => {
      const where = rel + ' slide ' + (i + 1);
      if (!['concept', 'story', 'step', 'practice', 'recap'].includes(s.type)) fail(where + ': unknown type "' + s.type + '"');
      if (s.type === 'story' && !s.visualHtml) fail(where + ': story slide has no visualHtml');
      if ((s.type === 'concept' || s.type === 'step') && !(s.steps && s.steps.length)) fail(where + ': no steps');
      if (s.type === 'practice' && !(s.tasks && s.tasks.length)) fail(where + ': no tasks');
    });
  }
}

if (problems.length) {
  console.error('Checks failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('All checks passed: ' + ours.length + ' scripts parsed, ' + list.filter((l) => l.file).length + ' lessons valid.');
