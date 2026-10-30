/*
 * diagram.js: draws the repository as SVG. It only ever reads the state object from
 * engine.getState(); it never decides what a command did. Moving a shape is a CSS
 * transition on its transform.
 *
 * Three looks, chosen per slide:
 *   default        the three areas (working folder, staging area, repository)
 *   graph          the three areas plus a History panel with one lane per branch
 *   remote         two panels side by side: your computer and GitHub, each a set of lanes
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

  // Remote look: two equal panels.
  const R_Y = 40;
  const R_W = 340;
  const R_X = [12, 368];
  const R_LANE0 = 158; // first lane, measured from the panel top
  const R_LANE_H = 100;

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

  function plural(n, w) {
    return n + ' ' + w + (n === 1 ? '' : 's');
  }

  function newLanes() {
    return { laneOf: new Map(), branchLane: new Map(), laneName: ['main'], maxLane: 0 };
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

  const EMPTY = { initialized: false, files: [], commits: [], branches: [], allCommits: [], tracking: [], remote: null };

  class Diagram {
    // opts.graph: add a History panel with one lane per branch.
    // opts.remote: show your computer and GitHub side by side (implies lanes).
    constructor(container, opts) {
      this.container = container;
      this.remoteMode = !!(opts && opts.remote);
      this.graph = this.remoteMode || !!(opts && opts.graph);
      this.items = new Map();
      this.pulseTimers = [];
      this.resetLanes();

      const svg = el('svg', {
        viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        class: 'diagram-svg' + (this.remoteMode ? ' remote-mode' : '')
      });
      this.svg = svg;
      const defs = el('defs', {}, svg);
      const marker = el('marker', {
        id: 'arrow-head', viewBox: '0 0 10 10', refX: '6', refY: '5',
        markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse'
      }, defs);
      el('path', { d: 'M0 0 L10 5 L0 10 z', class: 'arrow-head' }, marker);

      if (this.remoteMode) this.buildRemote(svg);
      else this.buildAreas(svg);

      if (this.graph && !this.remoteMode) this.buildPanel(svg);
      this.edgeLayer = el('g', {}, svg);
      this.itemLayer = el('g', {}, svg);
      container.appendChild(svg);
      this.render(EMPTY, {});
    }

    buildAreas(svg) {
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
    }

    // Two panels: your computer (left) and GitHub (right), with arrows underneath.
    buildRemote(svg) {
      this.rPanels = ['Your computer', 'GitHub (the remote)'].map((title, i) => {
        const g = el('g', { class: 'remote-panel remote-panel-' + (i ? 'github' : 'local') }, svg);
        const rect = el('rect', { x: R_X[i], y: R_Y, width: R_W, rx: 20 }, g);
        const t = el('text', { x: R_X[i] + R_W / 2, y: R_Y + 32, class: 'zone-title' }, g);
        t.textContent = title;
        const s = el('text', { x: R_X[i] + R_W / 2, y: R_Y + 54, class: 'zone-sub' }, g);
        s.textContent = i ? 'a copy on a website' : 'your repository';
        const hint = el('text', { x: R_X[i] + R_W / 2, y: R_Y + 110, class: 'history-hint' }, g);
        const lanes = el('g', {}, g);
        return { g, rect, hint, lanes, laneEls: [] };
      });
      this.rArrows = [
        { label: 'git push', dir: 1 },
        { label: 'git fetch / pull / clone', dir: -1 }
      ].map((a) => {
        const g = el('g', { class: 'arrow' }, svg);
        const path = el('path', { 'marker-end': 'url(#arrow-head)' }, g);
        const text = el('text', {}, g);
        text.textContent = a.label;
        return { g, path, text, dir: a.dir };
      });
      this.arrows = this.rArrows.map((a) => a.g);
    }

    resetLanes() {
      this.lanes = { local: newLanes(), remote: newLanes() }; // kept so commits never jump between lanes
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
      this.render(EMPTY, {});
    }

    // Light up the arrow for a command that just ran.
    pulse(kind) {
      let idx = -1;
      if (this.remoteMode) {
        if (kind === 'push') idx = 0;
        else if (kind === 'fetch' || kind === 'pull' || kind === 'clone' || kind === 'github') idx = 1;
      } else {
        idx = kind === 'add' ? 0 : kind === 'commit' ? 1 : -1;
      }
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

      // File shapes (the remote look has no file areas)
      if (!this.remoteMode) {
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
      }

      if (this.remoteMode) {
        this.layoutRemote(state, wanted);
      } else if (this.graph) {
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

      if (!this.remoteMode) {
        this.placeholder.classList.toggle('visible', !state.initialized);
        this.zoneEls[2].classList.toggle('inactive', !state.initialized);
      }
      this.svg.setAttribute('aria-label', this.describe(state));
      if (opts.pulse) this.pulse(opts.pulse);
    }

    /* ---------- lanes ---------- */

    // Place commits of one repository in lanes. Returns where each commit went.
    // geom: { x0, xMax, y0, laneH, maxSpacing, pills: 'right' | 'above', pillMinX, pillMaxX }
    layoutSide(lay, commits, branches, head, tracking, geom, wanted, prefix) {
      const byOid = new Map(commits.map((c) => [c.oid, c]));

      branches.forEach((b) => {
        if (lay.branchLane.has(b.name)) return;
        const lane = b.name === 'main' ? 0 : ++lay.maxLane;
        lay.branchLane.set(b.name, lane);
        lay.laneName[lane] = b.name;
      });
      // Walk each branch down its first-parent line; the first branch to claim a commit keeps it.
      branches
        .slice()
        .sort((a, b) => lay.branchLane.get(a.name) - lay.branchLane.get(b.name))
        .forEach((b) => {
          const lane = lay.branchLane.get(b.name);
          let oid = b.oid;
          // main (lane 0) may take over commits after a fast-forward; other lanes never steal.
          while (oid && byOid.has(oid) && (lane === 0 || !lay.laneOf.has(oid))) {
            lay.laneOf.set(oid, lane);
            oid = byOid.get(oid).parents[0];
          }
        });
      // Commits only origin/* knows about: continue the branch they extend, or start their own lane.
      tracking.forEach((t) => {
        const chain = [];
        let oid = t.oid;
        while (oid && byOid.has(oid) && !lay.laneOf.has(oid)) {
          chain.push(oid);
          oid = byOid.get(oid).parents[0];
        }
        if (!chain.length) return;
        const tipOfBranch = branches.find((b) => b.oid === oid);
        let lane;
        if (tipOfBranch && lay.laneOf.get(oid) === lay.branchLane.get(tipOfBranch.name)) {
          lane = lay.laneOf.get(oid);
        } else {
          if (!lay.branchLane.has(t.name)) {
            lay.branchLane.set(t.name, ++lay.maxLane);
            lay.laneName[lay.maxLane] = t.name;
          }
          lane = lay.branchLane.get(t.name);
        }
        chain.forEach((id) => lay.laneOf.set(id, lane));
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
      const spacing = Math.min(geom.maxSpacing, (geom.xMax - geom.x0) / Math.max(1, maxCol));
      const laneY = (lane) => geom.y0 + lane * geom.laneH;
      const pos = new Map();
      const laneUsed = (c) => (lay.laneOf.has(c.oid) ? lay.laneOf.get(c.oid) : 0);

      commits.forEach((c) => {
        const lane = laneUsed(c);
        const p = { x: geom.x0 + col.get(c.oid) * spacing, y: laneY(lane) };
        pos.set(c.oid, p);
        wanted.set(prefix + 'commit:' + c.oid, {
          type: 'commit', commit: c, latest: true, lane, x: p.x, y: p.y,
          from: geom.from ? geom.from(c.oid, p) : { x: p.x, y: p.y - 50 }
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
          wanted.set(prefix + 'edge:' + c.oid + '>' + par, { type: 'edge', d });
        });
      });

      // Labels for branches (and origin/* labels); several on one commit stack up.
      const stack = new Map();
      const pill = (name, oid, current, remoteRef) => {
        const p = pos.get(oid);
        if (!p) return;
        const k = stack.get(oid) || 0;
        stack.set(oid, k + 1);
        const width = Math.round((current ? name.length + 7 : name.length) * 8.8 + 24);
        let x;
        let y;
        if (geom.pills === 'above') {
          x = Math.max(geom.pillMinX + width / 2, Math.min(geom.pillMaxX - width / 2, p.x));
          y = p.y - 38 - k * 30;
        } else {
          x = p.x + 24 + width / 2;
          y = p.y - k * 30;
        }
        wanted.set(prefix + 'branch:' + name, { type: 'branch', name, current, remoteRef, x, y });
      };
      branches.forEach((b) => pill(b.name, b.oid, !!head && b.name === head, false));
      tracking.forEach((t) => pill(t.name, t.oid, false, true));

      const used = commits.map(laneUsed);
      return { pos, lanes: used.length ? Math.max(...used) + 1 : 1, lay };
    }

    // Lane lines and names inside a panel.
    drawLanes(holder, lay, lanes, geom, labelX) {
      while (holder.laneEls.length < lanes) {
        const g = el('g', {}, holder.lanes);
        el('line', { class: 'lane-line' }, g);
        g._label = el('text', { x: labelX, y: 0, class: 'lane-label' }, g);
        if (geom.labelAnchor) g._label.setAttribute('text-anchor', geom.labelAnchor);
        holder.laneEls.push(g);
      }
      holder.laneEls.forEach((g, i) => {
        g.style.display = i < lanes ? '' : 'none';
        const y = geom.y0 + i * geom.laneH;
        const line = g.firstChild;
        line.setAttribute('x1', geom.lineX1);
        line.setAttribute('x2', geom.lineX2);
        line.setAttribute('y1', y);
        line.setAttribute('y2', y);
        g._label.setAttribute('y', y + (geom.labelDy === undefined ? -18 : geom.labelDy));
        g._label.textContent = (lay.laneName[i] || '') + ' line';
      });
    }

    // The History panel under the three areas (lessons 7-9).
    layoutGraph(state, wanted) {
      const geom = {
        x0: LANE_X0, xMax: 540, y0: GRAPH_Y + 112, laneH: LANE_H, maxSpacing: 92, pills: 'right',
        lineX1: 28, lineX2: 692,
        from: () => ({ x: ZONE_X[1] + ZONE_W / 2, y: ZONE_Y + ZONE_H })
      };
      const r = this.layoutSide(this.lanes.local, state.allCommits || [], state.branches || [], state.head, [], geom, wanted, '');
      const panelH = 112 + r.lanes * LANE_H - 38;
      this.panelRect.setAttribute('height', panelH);
      this.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (GRAPH_Y + panelH + 14));
      this.hint.style.display = (state.allCommits || []).length ? 'none' : '';
      this.panel.classList.toggle('visible', state.initialized);
      this.drawLanes({ lanes: this.laneLayer, laneEls: this.laneEls }, this.lanes.local, r.lanes, geom, 30);
    }

    // Your computer and GitHub side by side (lessons 10-11).
    layoutRemote(state, wanted) {
      const mk = (i) => ({
        x0: R_X[i] + 52, xMax: R_X[i] + R_W - 44, y0: R_Y + R_LANE0, laneH: R_LANE_H, maxSpacing: 66, pills: 'above',
        pillMinX: R_X[i] + 12, pillMaxX: R_X[i] + R_W - 12, lineX1: R_X[i] + 18, lineX2: R_X[i] + R_W - 18,
        labelAnchor: 'end', labelDy: 28
      });
      const gL = mk(0);
      const gR = mk(1);
      const wl = new Map();
      const wr = new Map();
      const remote = state.remote || { branches: [], allCommits: [] };
      const L = this.layoutSide(this.lanes.local, state.allCommits || [], state.branches || [], state.head, state.tracking || [], gL, wl, 'L:');
      const R = this.layoutSide(this.lanes.remote, remote.allCommits, remote.branches, null, [], gR, wr, 'R:');
      // A commit that exists on the other side glides in from there (that is a push, pull or clone).
      wl.forEach((w, key) => {
        if (w.type !== 'commit') return;
        const o = R.pos.get(w.commit.oid);
        if (o) w.from = { x: o.x, y: o.y };
      });
      wr.forEach((w, key) => {
        if (w.type !== 'commit') return;
        const o = L.pos.get(w.commit.oid);
        if (o) w.from = { x: o.x, y: o.y };
      });
      wl.forEach((w, k) => wanted.set(k, w));
      wr.forEach((w, k) => wanted.set(k, w));

      const lanes = Math.max(L.lanes, R.lanes);
      const panelH = R_LANE0 + (lanes - 1) * R_LANE_H + 66;
      this.rPanels.forEach((p, i) => {
        p.rect.setAttribute('height', panelH);
        this.drawLanes(p, i ? this.lanes.remote : this.lanes.local, i ? R.lanes : L.lanes, i ? gR : gL, R_X[i] + R_W - 18);
      });
      this.rPanels[0].hint.textContent = state.initialized ? ((state.allCommits || []).length ? '' : 'Commits appear here') : 'No repository yet';
      this.rPanels[1].hint.textContent = remote.allCommits.length ? '' : 'Nothing on GitHub yet';

      // Arrows under the panels.
      const y = R_Y + panelH;
      const left = R_X[0] + R_W / 2;
      const right = R_X[1] + R_W / 2;
      const set = (a, from, to, yy) => {
        a.path.setAttribute('d', 'M' + from + ' ' + (y + 4) + ' V' + (y + yy) + ' H' + to + ' V' + (y + 10));
        a.text.setAttribute('x', (from + to) / 2);
        a.text.setAttribute('y', y + yy + 22);
      };
      set(this.rArrows[0], left, right, 28);
      set(this.rArrows[1], right, left, 66);
      this.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (y + 66 + 34));
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
      const shown = g.classList.contains('shown') ? ' shown' : '';
      if (w.type === 'branch') {
        const label = w.current ? 'HEAD → ' + w.name : w.name;
        const width = Math.round(label.length * 8.8 + 24);
        g._text.textContent = label;
        g._rect.setAttribute('x', -width / 2);
        g._rect.setAttribute('width', width);
        g.setAttribute('class', 'item item-branch' + (w.current ? ' current' : '') + (w.remoteRef ? ' remote-ref' : '') + shown);
      } else if (w.type === 'chip') {
        g.setAttribute('class', 'item item-chip chip-' + w.chip.cls + shown);
        g._name.textContent = shorten(w.chip.key.replace(/~$/, ''));
        g._badge.textContent = w.chip.label;
      } else if (w.type === 'commit') {
        g._hash.textContent = w.commit.short;
        g._hash.style.display = w.latest ? '' : 'none'; // older hashes would overlap
        g.setAttribute('class', 'item item-commit lane-' + ((w.lane || 0) % 3) + shown);
      }
    }

    describe(state) {
      if (this.remoteMode) {
        const side = (branches) => (branches.length ? branches.map((b) => b.name + ' at ' + b.oid.slice(0, 7)).join(', ') : 'nothing yet');
        const remote = state.remote || { branches: [] };
        return 'Your computer: ' + side(state.branches || []) +
          (state.tracking && state.tracking.length ? '; remote-tracking labels ' + state.tracking.map((t) => t.name + ' at ' + t.oid.slice(0, 7)).join(', ') : '') +
          '. GitHub: ' + side(remote.branches) + '.';
      }
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

  window.GitDiagram = Diagram;
})();
