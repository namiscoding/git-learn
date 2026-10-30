/*
 * diagram.js: draws the three areas (working folder, staging area, repository) as SVG.
 * It only ever reads the state object from engine.getState(); it never decides what a
 * command did. Moving a shape between areas is a CSS transition on its transform.
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 720;
  const H = 390;
  const ZONE_Y = 40;
  const ZONE_H = 280;
  const ZONE_W = 208;
  const ZONE_X = [12, 256, 500];
  const CHIP_W = 188;
  const CHIP_H = 38;
  const COMMIT_ROW_Y = ZONE_Y + 238;

  const ZONES = [
    { key: 'working', title: 'Working folder', sub: 'files you edit' },
    { key: 'staging', title: 'Staging area', sub: 'picked for next save' },
    { key: 'repo', title: 'Repository', sub: 'saved snapshots' }
  ];

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach((k) => node.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(node);
    return node;
  }

  function place(node, x, y) {
    node.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }

  function shorten(name) {
    return name.length > 11 ? name.slice(0, 10) + '…' : name;
  }

  // Where does this file's main shape live, and what does it say?
  function chipsFor(file) {
    const chips = [];
    if (file.staged) {
      chips.push({ key: file.name, zone: 1, label: file.staged === 'new' ? 'new' : file.staged, cls: 'staged' });
      if (file.work) chips.push({ key: file.name + '~', zone: 0, label: 'edited again', cls: 'modified' });
    } else if (file.untracked) {
      chips.push({ key: file.name, zone: 0, label: 'untracked', cls: 'untracked' });
    } else if (file.work) {
      chips.push({ key: file.name, zone: 0, label: file.work, cls: 'modified' });
    } else if (file.h === 1) {
      chips.push({ key: file.name, zone: 2, label: 'saved', cls: 'saved' });
    }
    return chips;
  }

  class Diagram {
    constructor(container) {
      this.container = container;
      this.items = new Map();
      this.pulseTimers = [];

      const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', class: 'diagram-svg' });
      this.svg = svg;
      const defs = el('defs', {}, svg);
      const marker = el('marker', {
        id: 'arrow-head', viewBox: '0 0 10 10', refX: '6', refY: '5',
        markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse'
      }, defs);
      el('path', { d: 'M0 0 L10 5 L0 10 z', class: 'arrow-head' }, marker);

      this.zoneEls = ZONES.map((z, i) => {
        const g = el('g', { class: 'zone zone-' + z.key }, svg);
        el('rect', { x: ZONE_X[i], y: ZONE_Y, width: ZONE_W, height: ZONE_H, rx: 20 }, g);
        const t = el('text', { x: ZONE_X[i] + ZONE_W / 2, y: ZONE_Y + 30, class: 'zone-title' }, g);
        t.textContent = z.title;
        const s = el('text', { x: ZONE_X[i] + ZONE_W / 2, y: ZONE_Y + 52, class: 'zone-sub' }, g);
        s.textContent = z.sub;
        return g;
      });

      // Empty-repository placeholder, shown until "git init".
      this.placeholder = el('g', { class: 'placeholder' }, svg);
      const p1 = el('text', { x: ZONE_X[2] + ZONE_W / 2, y: ZONE_Y + 140, class: 'placeholder-text' }, this.placeholder);
      p1.textContent = 'No repository yet';
      const p2 = el('text', { x: ZONE_X[2] + ZONE_W / 2, y: ZONE_Y + 166, class: 'placeholder-sub' }, this.placeholder);
      p2.textContent = 'git init creates one';

      // Arrows below the zones, labelled with the command that moves changes along them.
      this.arrows = [
        { from: 0, to: 1, label: 'git add' },
        { from: 1, to: 2, label: 'git commit' }
      ].map((a) => {
        const x1 = ZONE_X[a.from] + ZONE_W / 2;
        const x2 = ZONE_X[a.to] + ZONE_W / 2;
        const y = ZONE_Y + ZONE_H;
        const g = el('g', { class: 'arrow' }, svg);
        el('path', {
          d: 'M' + x1 + ' ' + (y + 4) + ' V' + (y + 28) + ' H' + x2 + ' V' + (y + 10),
          'marker-end': 'url(#arrow-head)'
        }, g);
        const t = el('text', { x: (x1 + x2) / 2, y: y + 48 }, g);
        t.textContent = a.label;
        return g;
      });

      this.itemLayer = el('g', {}, svg);
      container.appendChild(svg);
      this.render({ initialized: false, files: [], commits: [] }, {});
    }

    // Remove every shape at once (used when a slide starts over).
    clear() {
      this.items.forEach((it) => it.node.remove());
      this.items.clear();
      this.render({ initialized: false, files: [], commits: [] }, {});
    }

    // Light up the arrow for a command that just ran ('add' or 'commit').
    pulse(kind) {
      const idx = kind === 'add' ? 0 : kind === 'commit' ? 1 : -1;
      if (idx === -1) return;
      const node = this.arrows[idx];
      node.classList.add('active');
      const t = setTimeout(() => node.classList.remove('active'), 1400);
      this.pulseTimers.push(t);
    }

    render(state, opts) {
      opts = opts || {};
      const wanted = new Map();
      const perZone = [0, 0, 0];

      // File shapes
      state.files.forEach((file) => {
        chipsFor(file).forEach((c) => {
          const row = perZone[c.zone]++;
          const step = c.zone === 2 ? 42 : 50;
          wanted.set(c.key, {
            type: 'chip', chip: c,
            x: ZONE_X[c.zone] + (ZONE_W - CHIP_W) / 2,
            y: ZONE_Y + 70 + row * step
          });
        });
      });

      // Commit dots, oldest on the left, newest on the right.
      const commits = state.commits.slice().reverse();
      const n = commits.length;
      const spacing = n > 1 ? Math.min(46, 150 / (n - 1)) : 0;
      const startX = ZONE_X[2] + ZONE_W / 2 - (spacing * (n - 1)) / 2;
      commits.forEach((c, i) => {
        wanted.set('commit:' + c.oid, {
          type: 'commit', commit: c, latest: i === n - 1, x: startX + i * spacing, y: COMMIT_ROW_Y,
          from: { x: ZONE_X[1] + ZONE_W / 2, y: COMMIT_ROW_Y - 40 }
        });
      });
      if (n) {
        wanted.set('tag', { type: 'tag', x: startX + (n - 1) * spacing, y: COMMIT_ROW_Y - 36 });
      }

      // Remove shapes that are no longer wanted.
      this.items.forEach((it, key) => {
        if (!wanted.has(key)) {
          it.node.classList.remove('shown');
          const node = it.node;
          setTimeout(() => node.remove(), 350);
          this.items.delete(key);
        }
      });

      // Create new shapes, move existing ones.
      wanted.forEach((w, key) => {
        let it = this.items.get(key);
        if (!it) {
          it = { node: this.create(w), type: w.type };
          this.items.set(key, it);
          const start = w.from || { x: w.x, y: w.y };
          place(it.node, start.x, start.y);
          this.itemLayer.appendChild(it.node);
          // Next frame: fade in and glide to the final position.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            it.node.classList.add('shown');
            place(it.node, w.x, w.y);
          }));
        } else {
          this.update(it.node, w);
          place(it.node, w.x, w.y);
        }
      });

      this.placeholder.classList.toggle('visible', !state.initialized);
      this.zoneEls[2].classList.toggle('inactive', !state.initialized);
      this.svg.setAttribute('aria-label', this.describe(state));
      if (opts.pulse) this.pulse(opts.pulse);
    }

    create(w) {
      const g = el('g', { class: 'item item-' + w.type });
      if (w.type === 'chip') {
        el('rect', { width: CHIP_W, height: CHIP_H, rx: 10 }, g);
        const name = el('text', { x: 12, y: 25, class: 'chip-name' }, g);
        const badge = el('text', { x: CHIP_W - 10, y: 25, class: 'chip-badge' }, g);
        g._name = name;
        g._badge = badge;
      } else if (w.type === 'commit') {
        el('circle', { r: 13, cx: 0, cy: 0 }, g);
        g._hash = el('text', { x: 0, y: 34, class: 'commit-hash' }, g);
      } else {
        el('rect', { x: -27, y: -13, width: 54, height: 26, rx: 13 }, g);
        const t = el('text', { x: 0, y: 5, class: 'tag-text' }, g);
        t.textContent = 'main';
      }
      this.update(g, w);
      return g;
    }

    update(g, w) {
      if (w.type === 'chip') {
        g.setAttribute('class', 'item item-chip chip-' + w.chip.cls + (g.classList.contains('shown') ? ' shown' : ''));
        g._name.textContent = shorten(w.chip.key.replace(/~$/, ''));
        g._badge.textContent = w.chip.label;
      } else if (w.type === 'commit') {
        g._hash.textContent = w.commit.short;
        g._hash.style.display = w.latest ? '' : 'none'; // older hashes would overlap
        g.setAttribute('class', 'item item-commit' + (g.classList.contains('shown') ? ' shown' : ''));
      }
    }

    describe(state) {
      const names = (zone) => {
        const list = [];
        state.files.forEach((f) => chipsFor(f).forEach((c) => {
          if (c.zone === zone) list.push(c.key.replace(/~$/, '') + ' (' + c.label + ')');
        }));
        return list.length ? list.join(', ') : 'empty';
      };
      const count = state.commits.length;
      return (
        'Working folder: ' + names(0) + '. Staging area: ' + names(1) + '. Repository: ' +
        (state.initialized ? plural(count, 'commit') + (names(2) === 'empty' ? '' : ', files ' + names(2)) : 'not created yet') + '.'
      );
    }
  }

  function plural(n, w) {
    return n + ' ' + w + (n === 1 ? '' : 's');
  }

  window.GitDiagram = Diagram;
})();
