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
  const GRAPH_Y = ZONE_Y + ZONE_H + 74; // top of the History panel
  const LANE_H = 74;
  const LANE_X0 = 130;

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
    // opts.graph: draw commits as one lane per branch (lessons about branches and merging).
    constructor(container, opts) {
      this.container = container;
      this.graph = !!(opts && opts.graph);
      this.items = new Map();
      this.pulseTimers = [];
      this.resetLanes();

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

      if (this.graph) this.buildPanel(svg);
      this.edgeLayer = el('g', {}, svg);
      this.itemLayer = el('g', {}, svg);
      container.appendChild(svg);
      this.render({ initialized: false, files: [], commits: [], branches: [], allCommits: [] }, {});
    }

    resetLanes() {
      this.laneOf = new Map(); // commit id -> lane, kept so commits never jump between lanes
      this.branchLane = new Map();
      this.laneName = ['main'];
      this.maxLane = 0;
    }

    // The "History" panel under the three areas, with one line per lane.
    buildPanel(svg) {
      this.panel = el('g', { class: 'history' }, svg);
      this.panelRect = el('rect', { x: 12, y: GRAPH_Y, width: 696, rx: 20 }, this.panel);
      const t = el('text', { x: 30, y: GRAPH_Y + 30, class: 'history-title' }, this.panel);
      t.textContent = 'History: one line per branch';
      this.hint = el('text', { x: 360, y: GRAPH_Y + 90, class: 'history-hint' }, this.panel);
      this.hint.textContent = 'Commits appear here once you make one';
      this.laneLayer = el('g', {}, this.panel);
      this.laneEls = [];
    }

    // Remove every shape at once (used when a slide starts over).
    clear() {
      this.items.forEach((it) => it.node.remove());
      this.items.clear();
      this.resetLanes();
      this.render({ initialized: false, files: [], commits: [], branches: [], allCommits: [] }, {});
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

      if (this.graph) {
        this.layoutGraph(state, wanted);
      } else {
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
        if (w.type === 'edge') {
          if (!it) {
            it = { node: this.create(w), type: 'edge' };
            this.items.set(key, it);
            this.edgeLayer.appendChild(it.node);
            requestAnimationFrame(() => requestAnimationFrame(() => it.node.classList.add('shown')));
          }
          it.node.setAttribute('d', w.d);
          return;
        }
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

    // Place every commit in its branch's lane, and add branch labels and parent links.
    layoutGraph(state, wanted) {
      const commits = state.allCommits || [];
      const byOid = new Map(commits.map((c) => [c.oid, c]));

      state.branches.forEach((b) => {
        if (this.branchLane.has(b.name)) return;
        const lane = b.name === 'main' ? 0 : ++this.maxLane;
        this.branchLane.set(b.name, lane);
        this.laneName[lane] = b.name;
      });
      // Walk each branch down its first-parent line; the first branch to claim a commit keeps it.
      state.branches
        .slice()
        .sort((a, b) => this.branchLane.get(a.name) - this.branchLane.get(b.name))
        .forEach((b) => {
          const lane = this.branchLane.get(b.name);
          let oid = b.oid;
          // main (lane 0) may take over commits after a fast-forward; other lanes never steal.
          while (oid && byOid.has(oid) && (lane === 0 || !this.laneOf.has(oid))) {
            this.laneOf.set(oid, lane);
            oid = byOid.get(oid).parents[0];
          }
        });

      const col = new Map();
      const colOf = (oid) => {
        if (col.has(oid)) return col.get(oid);
        const c = byOid.get(oid);
        const parents = c.parents.filter((p) => byOid.has(p));
        const v = parents.length ? Math.max(...parents.map(colOf)) + 1 : 0;
        col.set(oid, v);
        return v;
      };
      commits.forEach((c) => colOf(c.oid));
      const maxCol = commits.length ? Math.max(...col.values()) : 0;
      const spacing = Math.min(92, (540 - LANE_X0) / Math.max(1, maxCol)); // leaves room for labels on the right
      const laneY = (lane) => GRAPH_Y + 112 + lane * LANE_H;
      const pos = new Map();

      commits.forEach((c) => {
        const lane = this.laneOf.has(c.oid) ? this.laneOf.get(c.oid) : 0;
        const p = { x: LANE_X0 + col.get(c.oid) * spacing, y: laneY(lane) };
        pos.set(c.oid, p);
        wanted.set('commit:' + c.oid, {
          type: 'commit', commit: c, latest: true, lane, x: p.x, y: p.y,
          from: { x: ZONE_X[1] + ZONE_W / 2, y: ZONE_Y + ZONE_H }
        });
      });
      commits.forEach((c) => {
        c.parents.forEach((par) => {
          if (!pos.has(par)) return;
          const a = pos.get(par);
          const b = pos.get(c.oid);
          const dx = b.x - a.x;
          const d = Math.abs(a.y - b.y) < 1 || dx < 30
            ? 'M' + a.x + ' ' + a.y + ' L' + b.x + ' ' + b.y
            : 'M' + a.x + ' ' + a.y + ' C' + (a.x + dx * 0.5) + ' ' + a.y + ',' + (b.x - dx * 0.5) + ' ' + b.y + ',' + b.x + ' ' + b.y;
          wanted.set('edge:' + c.oid + '>' + par, { type: 'edge', d });
        });
      });

      // Branch labels sit to the right of their tip commit; several on one commit stack upward.
      const stack = new Map();
      state.branches.forEach((b) => {
        const p = pos.get(b.oid);
        if (!p) return;
        const k = stack.get(b.oid) || 0;
        stack.set(b.oid, k + 1);
        const current = b.name === state.head;
        const width = Math.round((current ? b.name.length + 7 : b.name.length) * 8.8 + 24);
        wanted.set('branch:' + b.name, {
          type: 'branch', name: b.name, current, x: p.x + 24 + width / 2, y: p.y - k * 30
        });
      });

      // Panel: height follows the number of lanes; lane lines and names.
      const usedLanes = commits.map((c) => (this.laneOf.has(c.oid) ? this.laneOf.get(c.oid) : 0));
      const lanes = usedLanes.length ? Math.max(...usedLanes) + 1 : 1;
      const panelH = 112 + lanes * LANE_H - 38;
      this.panelRect.setAttribute('height', panelH);
      this.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (GRAPH_Y + panelH + 14));
      this.hint.style.display = commits.length ? 'none' : '';
      this.panel.classList.toggle('visible', state.initialized);
      while (this.laneEls.length < lanes) {
        const g = el('g', {}, this.laneLayer);
        el('line', { x1: 28, x2: 692, class: 'lane-line' }, g);
        g._label = el('text', { x: 30, y: 0, class: 'lane-label' }, g);
        this.laneEls.push(g);
      }
      this.laneEls.forEach((g, i) => {
        g.style.display = i < lanes ? '' : 'none';
        const y = laneY(i);
        const line = g.firstChild;
        line.setAttribute('y1', y);
        line.setAttribute('y2', y);
        g._label.setAttribute('y', y - 18);
        g._label.textContent = this.laneName[i] + ' line';
      });
    }

    create(w) {
      if (w.type === 'edge') return el('path', { class: 'edge' });
      const g = el('g', { class: 'item item-' + w.type });
      if (w.type === 'branch') {
        g._rect = el('rect', { y: -13, height: 26, rx: 13 }, g);
        g._text = el('text', { x: 0, y: 5, class: 'tag-text' }, g);
      } else if (w.type === 'chip') {
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
      if (w.type === 'branch') {
        const label = w.current ? 'HEAD \u2192 ' + w.name : w.name;
        const width = Math.round(label.length * 8.8 + 24);
        g._text.textContent = label;
        g._rect.setAttribute('x', -width / 2);
        g._rect.setAttribute('width', width);
        g.setAttribute('class', 'item item-branch' + (w.current ? ' current' : '') + (g.classList.contains('shown') ? ' shown' : ''));
      } else if (w.type === 'chip') {
        g.setAttribute('class', 'item item-chip chip-' + w.chip.cls + (g.classList.contains('shown') ? ' shown' : ''));
        g._name.textContent = shorten(w.chip.key.replace(/~$/, ''));
        g._badge.textContent = w.chip.label;
      } else if (w.type === 'commit') {
        g._hash.textContent = w.commit.short;
        g._hash.style.display = w.latest ? '' : 'none'; // older hashes would overlap
        g.setAttribute('class', 'item item-commit lane-' + ((w.lane || 0) % 3) + (g.classList.contains('shown') ? ' shown' : ''));
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
      if (this.graph && state.branches && state.branches.length) {
        const where = state.branches.map((b) => b.name + ' at ' + b.oid.slice(0, 7)).join(', ');
        return 'Working folder: ' + names(0) + '. Staging area: ' + names(1) + '. Current branch: ' + state.head + '. Branches: ' + where + '. Commits in history: ' + (state.allCommits || []).length + '.';
      }
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
