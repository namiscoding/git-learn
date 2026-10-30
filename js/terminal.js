/*
 * terminal.js: a small fake terminal. It only collects input and shows output;
 * every command is run by the engine.
 */
(function () {
  let counter = 0;

  class Terminal {
    // opts.onResult(line, result) is called after each command finishes.
    constructor(root, engine, opts) {
      this.engine = engine;
      this.opts = opts || {};
      this.history = [];
      this.cursor = 0;
      this.busy = false;

      const id = 'term-input-' + ++counter;
      root.innerHTML =
        '<div class="term-out" role="log" aria-label="Terminal output" tabindex="0"></div>' +
        '<form class="term-form" autocomplete="off">' +
        '<label class="sr-only" for="' + id + '">Type a command and press Enter</label>' +
        '<span class="term-prompt" aria-hidden="true">~/project $</span>' +
        '<input id="' + id + '" class="term-input" type="text" spellcheck="false" ' +
        'autocapitalize="off" autocorrect="off" enterkeyhint="send" />' +
        '</form>';
      this.out = root.querySelector('.term-out');
      this.form = root.querySelector('.term-form');
      this.input = root.querySelector('.term-input');

      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submit();
      });
      this.input.addEventListener('keydown', (e) => this.onKey(e));
      root.addEventListener('click', (e) => {
        if (!window.getSelection().toString() && e.target !== this.input) this.input.focus();
      });
      this.greet();
    }

    greet() {
      this.print('Type a command and press Enter. Stuck? Type  help', 'term-note');
    }

    print(text, cls) {
      const div = document.createElement('div');
      div.className = 'term-line ' + (cls || '');
      div.textContent = text;
      this.out.appendChild(div);
      this.out.scrollTop = this.out.scrollHeight;
    }

    clear() {
      this.out.textContent = '';
    }

    reset() {
      this.clear();
      this.history = [];
      this.cursor = 0;
      this.input.value = '';
      this.greet();
    }

    focus() {
      this.input.focus();
    }

    onKey(e) {
      if (e.key === 'ArrowUp') {
        if (this.cursor > 0) this.cursor--;
        this.input.value = this.history[this.cursor] || '';
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (this.cursor < this.history.length) this.cursor++;
        this.input.value = this.history[this.cursor] || '';
        e.preventDefault();
      }
    }

    async submit() {
      if (this.busy) return;
      const line = this.input.value;
      this.input.value = '';
      this.print('~/project $ ' + line, 'term-cmd');
      if (!line.trim()) return;
      this.history.push(line);
      this.cursor = this.history.length;

      if (line.trim() === 'clear') {
        this.clear();
        return;
      }
      this.busy = true;
      this.input.disabled = true;
      try {
        const result = await this.engine.run(line);
        if (result.out) this.print(result.out, result.ok ? '' : 'term-err');
        if (this.opts.onResult) await this.opts.onResult(line, result);
      } catch (err) {
        this.print('error: ' + err.message, 'term-err');
      } finally {
        this.busy = false;
        this.input.disabled = false;
        this.input.focus();
      }
    }
  }

  window.GitTerminal = Terminal;
})();
