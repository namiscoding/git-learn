/*
 * player.js: turns a lesson (plain data in lessons/*.js) into slides.
 *
 * Slide types
 *   concept   autoplay: the page runs the lesson's commands for you, with captions
 *   step      step-through: you press "Next step" to run each command
 *   practice  you type the commands in a terminal; tasks tick off as you go
 *   recap     summary points
 *
 * Every command goes through the shared engine, and the diagram redraws from the
 * engine's state afterwards.
 */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const app = document.getElementById('app');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const params = new URLSearchParams(location.search);
  const lessonId = params.get('id');

  function h(tag, props, children) {
    const node = document.createElement(tag);
    Object.keys(props || {}).forEach((k) => {
      if (k === 'class') node.className = props[k];
      else if (k === 'text') node.textContent = props[k];
      else if (k === 'html') node.innerHTML = props[k];
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), props[k]);
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }

  function showMessage(title, text) {
    app.innerHTML = '';
    app.appendChild(h('div', { class: 'message' }, [
      h('h1', { text: title }),
      h('p', { text }),
      h('a', { class: 'btn btn-primary', href: 'index.html', text: 'Back to all lessons' })
    ]));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      // Same version as the page's own files, so a new deploy never mixes old and new code.
      const v = window.COURSE_VERSION;
      s.src = src + '?v=' + (v && v.indexOf('__') !== 0 ? v : Date.now());
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function start() {
    const entry = (window.LESSON_LIST || []).find((l) => l.id === lessonId);
    if (!entry) return showMessage('Lesson not found', 'That lesson does not exist.');
    if (!entry.file) return showMessage('Coming soon', '"' + entry.title + '" is not written yet.');
    if (!window.git || !window.LightningFS) {
      return showMessage('The Git library did not load', 'Check that the files in js/vendor/ are present, then reload.');
    }
    try {
      await loadScript('lessons/' + entry.file + '.js');
    } catch (e) {
      return showMessage('Lesson failed to load', e.message);
    }
    const lesson = window.LESSONS && window.LESSONS[lessonId];
    if (!lesson) return showMessage('Lesson failed to load', 'The lesson file did not register itself.');
    new Player(lesson, entry).mount();
  }

  class Player {
    constructor(lesson, entry) {
      this.lesson = lesson;
      this.entry = entry;
      this.engine = new GitEngine();
      this.index = 0;
      this.token = 0; // bumped on every slide change so old timers stop themselves
      this.diagram = null;
      this.terminal = null;
    }

    mount() {
      document.title = this.lesson.title + ' · Git Course';
      app.innerHTML = '';

      const header = h('header', { class: 'lesson-head' }, [
        h('a', { class: 'back', href: 'index.html', 'aria-label': 'Back to all lessons', text: '← All lessons' }),
        h('p', { class: 'lesson-name', text: 'Lesson ' + this.entry.id + ' · ' + this.lesson.title }),
        h('p', { class: 'slide-count', id: 'slide-count', 'aria-live': 'polite' })
      ]);
      this.dots = h('nav', { class: 'dots', 'aria-label': 'Slides in this lesson' });
      this.lesson.slides.forEach((s, i) => {
        this.dots.appendChild(h('button', {
          class: 'dot', type: 'button',
          'aria-label': 'Go to slide ' + (i + 1) + ': ' + s.title,
          onclick: () => this.go(i)
        }));
      });
      this.stage = h('main', { class: 'stage', id: 'stage' });
      this.prevBtn = h('button', { class: 'btn btn-secondary', type: 'button', text: '← Previous', onclick: () => this.go(this.index - 1) });
      this.nextBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Next →' });
      const nav = h('footer', { class: 'slide-nav' }, [this.prevBtn, this.nextBtn]);

      app.appendChild(header);
      app.appendChild(this.dots);
      app.appendChild(this.stage);
      app.appendChild(nav);

      document.addEventListener('keydown', (e) => {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.key === 'ArrowRight') this.next();
        if (e.key === 'ArrowLeft') this.go(this.index - 1);
      });
      window.addEventListener('hashchange', () => {
        const i = this.fromHash();
        if (i !== this.index) this.go(i, true);
      });

      this.go(this.fromHash(), true);
    }

    fromHash() {
      const n = parseInt(location.hash.replace('#', ''), 10);
      return n >= 1 && n <= this.lesson.slides.length ? n - 1 : 0;
    }

    next() {
      if (this.index < this.lesson.slides.length - 1) this.go(this.index + 1);
    }

    async go(i, fromHash) {
      if (i < 0 || i >= this.lesson.slides.length) return;
      this.index = i;
      this.token++;
      if (!fromHash) history.replaceState(null, '', '#' + (i + 1));
      const slide = this.lesson.slides[i];
      this.renderSlide(slide);

      document.getElementById('slide-count').textContent = 'Slide ' + (i + 1) + ' of ' + this.lesson.slides.length;
      Array.from(this.dots.children).forEach((d, k) => {
        if (k === i) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
        d.classList.toggle('done', k < i);
      });
      this.prevBtn.disabled = i === 0;
      const last = i === this.lesson.slides.length - 1;
      this.nextBtn.textContent = last ? 'Finish ✓' : 'Next →';
      this.nextBtn.onclick = last ? () => { location.href = 'index.html'; } : () => this.next();

      const heading = this.stage.querySelector('h2');
      if (heading) heading.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });

      if (slide.type === 'concept' || slide.type === 'step' || slide.type === 'practice') {
        await this.prepare(slide);
      }
      if (slide.type === 'concept') this.autoplay(slide);
    }

    /* ---------- slide layout ---------- */

    renderSlide(slide) {
      this.stage.innerHTML = '';
      this.diagram = null;
      this.terminal = null;

      const label = { concept: 'Watch', story: 'The idea', step: 'Step through', practice: 'Your turn', recap: 'Recap' }[slide.type];
      const text = h('div', { class: 'slide-text' }, [
        h('p', { class: 'eyebrow', text: label }),
        h('h2', { tabindex: '-1', text: slide.title }),
        h('div', { class: 'prose', html: (slide.body || []).map((p) => '<p>' + p + '</p>').join('') })
      ]);

      const section = h('section', { class: 'slide slide-' + slide.type }, [text]);

      if (slide.note) text.appendChild(h('p', { class: 'note', text: slide.note }));

      if (slide.type === 'recap') {
        const list = h('ul', { class: 'recap-list' });
        slide.points.forEach((p) => list.appendChild(h('li', { html: p })));
        text.appendChild(list);
      }

      if (slide.type === 'story') {
        // A hand-made picture (plain HTML in the lesson file); .reveal items fade in one by one.
        const visual = h('div', { class: 'slide-visual story-visual', html: slide.visualHtml });
        visual.querySelectorAll('.reveal').forEach((n, i) => {
          n.style.animationDelay = i * 0.45 + 0.2 + 's';
        });
        section.appendChild(visual);
      }

      if (slide.type !== 'recap' && slide.type !== 'story') {
        const visual = h('div', { class: 'slide-visual' });
        const diagramBox = h('div', { class: 'diagram-box' });
        visual.appendChild(diagramBox);
        this.diagram = new GitDiagram(diagramBox, { graph: !!slide.graph, remote: !!slide.remote });

        if (slide.type !== 'practice') {
          this.cmdLine = h('p', { class: 'cmd-line', 'aria-hidden': 'true' });
          this.cmdOut = h('pre', { class: 'cmd-out', 'aria-live': 'polite' });
          this.caption = h('p', { class: 'caption', 'aria-live': 'polite', text: 'Press the button to begin.' });
          this.controls = h('div', { class: 'controls' });
          visual.appendChild(h('div', { class: 'cmd-card' }, [this.cmdLine, this.cmdOut]));
          visual.appendChild(this.caption);
          visual.appendChild(this.controls);
        }
        section.appendChild(visual);
      }

      if (slide.type === 'practice') {
        this.buildPractice(slide, section, text);
      }
      this.stage.appendChild(section);
    }

    /* ---------- shared helpers ---------- */

    async prepare(slide) {
      const token = this.token;
      await this.engine.reset();
      if (token !== this.token) return;
      for (const item of slide.setup || []) await this.runSetup(item);
      if (token !== this.token) return;
      const state = await this.engine.getState();
      if (token !== this.token) return;
      this.diagram.clear();
      this.diagram.render(state, {});
      if (slide.type === 'step') this.initStepControls(slide);
    }

    // A setup item is a command string, or an object for something that happens elsewhere.
    async runSetup(item) {
      if (typeof item === 'string') return this.engine.run(item);
      if (item.seedRemote) return this.engine.seedRemote(item.seedRemote.url, item.seedRemote.commits);
      if (item.teammate) return this.engine.remoteCommit(item.teammate);
      if (item.githubMerge) return this.engine.remoteMerge(item.githubMerge.head, item.githubMerge.base);
      return null;
    }

    async execute(cmd, token) {
      const result = await this.engine.run(cmd);
      if (token !== this.token) return null;
      const state = await this.engine.getState();
      if (token !== this.token) return null;
      this.diagram.render(state, { pulse: result.ok ? result.kind : null });
      return { result, state };
    }

    async typeCommand(cmd, token) {
      this.cmdOut.textContent = '';
      this.cmdLine.textContent = '$ ';
      if (reduceMotion) {
        this.cmdLine.textContent = '$ ' + cmd;
        return;
      }
      for (let i = 1; i <= cmd.length; i++) {
        if (token !== this.token) return;
        this.cmdLine.textContent = '$ ' + cmd.slice(0, i);
        await wait(28);
      }
      await wait(250);
    }

    showOutput(result) {
      if (result.out) {
        this.cmdOut.textContent = result.out;
        this.cmdOut.classList.remove('empty');
      } else {
        this.cmdOut.textContent = 'No output. Many Git commands print nothing when they work.';
        this.cmdOut.classList.add('empty');
      }
    }

    // A step that is not a command: a teammate pushes, or someone clicks a button on GitHub.
    async playRemoteStep(step, token) {
      this.cmdOut.textContent = '';
      this.cmdLine.textContent = '# ' + step.label;
      this.cmdOut.classList.remove('empty');
      await wait(reduceMotion ? 0 : 700);
      if (token !== this.token) return false;
      await this.runSetup(step);
      if (token !== this.token) return false;
      const state = await this.engine.getState();
      if (token !== this.token) return false;
      this.diagram.render(state, { pulse: 'github' });
      this.cmdOut.textContent = step.output || 'This happened on GitHub, not on your computer.';
      this.cmdOut.classList.add('empty');
      this.caption.textContent = step.caption;
      return true;
    }

    async playStep(step, token) {
      if (!step.cmd) return this.playRemoteStep(step, token);
      await this.typeCommand(step.cmd, token);
      if (token !== this.token) return false;
      const done = await this.execute(step.cmd, token);
      if (!done) return false;
      this.showOutput(done.result);
      this.caption.textContent = step.caption;
      return true;
    }

    /* ---------- concept: autoplay ---------- */

    async autoplay(slide) {
      const token = this.token;
      this.controls.innerHTML = '';
      const replay = h('button', {
        class: 'btn btn-secondary', type: 'button', disabled: 'true', text: 'Replay',
        onclick: () => {
          this.token++;
          this.diagram.clear();
          this.prepare(slide).then(() => this.autoplay(slide));
        }
      });
      this.controls.appendChild(replay);
      this.caption.textContent = 'Watch what each command does.';
      await wait(900);
      for (const step of slide.steps) {
        if (token !== this.token) return;
        const okStep = await this.playStep(step, token);
        if (!okStep) return;
        await wait(reduceMotion ? 1200 : 2600);
      }
      if (token === this.token) replay.disabled = false;
    }

    /* ---------- step: step-through ---------- */

    initStepControls(slide) {
      const token = this.token;
      let done = 0;
      let busy = false;
      this.controls.innerHTML = '';
      this.cmdLine.textContent = '';
      this.cmdOut.textContent = '';
      this.cmdOut.classList.remove('empty');
      this.caption.textContent = 'Press "Next step" to run the first command.';

      const progress = h('span', { class: 'step-progress', text: 'Step 0 of ' + slide.steps.length });
      const nextStep = h('button', { class: 'btn btn-primary', type: 'button', text: 'Next step ▸' });
      const restart = h('button', { class: 'btn btn-secondary', type: 'button', text: 'Start over', disabled: 'true' });

      nextStep.onclick = async () => {
        if (busy || done >= slide.steps.length) return;
        busy = true;
        nextStep.disabled = true;
        const okStep = await this.playStep(slide.steps[done], token);
        busy = false;
        if (!okStep) return;
        done++;
        progress.textContent = 'Step ' + done + ' of ' + slide.steps.length;
        restart.disabled = false;
        if (done >= slide.steps.length) {
          nextStep.textContent = 'All steps done';
          this.caption.textContent += ' That was the last step, so try Start over or move to the next slide.';
        } else {
          nextStep.disabled = false;
          nextStep.focus();
        }
      };
      restart.onclick = async () => {
        if (busy) return;
        this.token++;
        await this.prepare(slide);
      };
      this.controls.appendChild(nextStep);
      this.controls.appendChild(restart);
      this.controls.appendChild(progress);
    }

    /* ---------- practice ---------- */

    buildPractice(slide, section, text) {
      const taskList = h('ol', { class: 'tasks' });
      slide.tasks.forEach((t, i) => {
        taskList.appendChild(h('li', { class: 'task', 'data-state': i === 0 ? 'current' : 'todo' }, [
          h('span', { class: 'task-state', 'aria-hidden': 'true' }),
          h('span', { class: 'task-text', html: t.text })
        ]));
      });
      const hint = h('p', { class: 'hint', hidden: 'true' });
      const hintBtn = h('button', { class: 'btn btn-secondary btn-small', type: 'button', text: 'Show a hint' });
      const resetBtn = h('button', { class: 'btn btn-secondary btn-small', type: 'button', text: 'Reset practice' });
      const status = h('p', { class: 'practice-status', role: 'status' });
      text.appendChild(taskList);
      let githubBtn = null;
      if (slide.githubButton) {
        githubBtn = h('button', { class: 'btn btn-primary btn-small', type: 'button', text: slide.githubButton.label });
      }
      text.appendChild(h('div', { class: 'controls' }, [githubBtn, hintBtn, resetBtn]));
      text.appendChild(hint);
      text.appendChild(status);

      const termBox = h('div', { class: 'terminal' });
      section.appendChild(termBox);

      let current = 0;
      const items = Array.from(taskList.children);
      const refresh = () => {
        items.forEach((li, i) => {
          li.dataset.state = i < current ? 'done' : i === current ? 'current' : 'todo';
          li.querySelector('.task-state').textContent = i < current ? '✓ Done' : i === current ? '→ Now' : 'Later';
        });
        hint.hidden = true;
        hintBtn.textContent = 'Show a hint';
        hintBtn.disabled = current >= slide.tasks.length;
        if (current >= slide.tasks.length) {
          status.textContent = slide.success || 'All tasks done. Nice work.';
          status.classList.add('ok');
        } else {
          status.textContent = '';
          status.classList.remove('ok');
        }
      };
      refresh();

      hintBtn.onclick = () => {
        if (current >= slide.tasks.length) return;
        hint.hidden = !hint.hidden;
        hint.innerHTML = slide.tasks[current].hint;
        hintBtn.textContent = hint.hidden ? 'Show a hint' : 'Hide hint';
      };

      const evaluate = async (line, result) => {
        const token = this.token;
        const state = await this.engine.getState();
        if (token !== this.token) return;
        this.diagram.render(state, { pulse: result.ok ? result.kind : null });
        // Tasks tick off in order, judged by the command that just ran.
        while (current < slide.tasks.length && slide.tasks[current].done(state, result, line)) current++;
        refresh();
      };

      this.terminal = new GitTerminal(termBox, this.engine, { onResult: evaluate });

      if (githubBtn) {
        githubBtn.onclick = async () => {
          const g = slide.githubButton;
          githubBtn.disabled = true;
          try {
            await this.engine.remoteMerge(g.head, g.base);
            this.terminal.print('(on GitHub) Pull request merged: ' + g.head + ' into ' + g.base + '.', 'term-note');
            await evaluate('', { ok: true, kind: 'github', out: '' });
          } catch (e) {
            this.terminal.print('GitHub says: nothing to merge yet. Push your branch first.', 'term-err');
          } finally {
            githubBtn.disabled = false;
          }
        };
      }

      resetBtn.onclick = async () => {
        this.token++;
        current = 0;
        this.terminal.reset();
        await this.prepare(slide);
        refresh();
      };
    }
  }

  start();
})();
