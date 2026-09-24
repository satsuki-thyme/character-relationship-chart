(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RelationsGraph = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH = 164, HEIGHT = 80;
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  function wrap(text, max = 12, lines = 2) {
    const chars = Array.from(text); const result = [];
    while (chars.length && result.length < lines) result.push(chars.splice(0, max).join(''));
    if (chars.length && result.length) result[result.length - 1] = Array.from(result.at(-1)).slice(0, max - 1).join('') + '…';
    return result.length ? result : [''];
  }
  function signature(node) { return `${node.x ?? ''},${node.y ?? ''}`; }
  function layout(graph, mode, moved = {}) {
    const size = graph.nodes.length;
    const radius = Math.max(240, size * 35);
    const positioned = graph.nodes.map((node, i) => {
      const drag = Object.prototype.hasOwnProperty.call(moved, node.id) && moved[node.id];
      const validDrag = drag && finite(drag.x) && finite(drag.y) && Math.abs(drag.x) <= 20000 && Math.abs(drag.y) <= 20000 && drag.source === signature(node);
      const fixed = finite(node.x) && finite(node.y);
      const angle = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, size);
      return { ...node, x: validDrag ? drag.x : fixed ? node.x : size === 1 ? 0 : Math.cos(angle) * radius,
        y: validDrag ? drag.y : fixed ? node.y : size === 1 ? 0 : Math.sin(angle) * radius, fixed: Boolean(validDrag || fixed) };
    });
    if (mode === 'circle' || size < 2) return positioned;
    const index = new Map(positioned.map((node, i) => [node.id, i]));
    const unique = new Set();
    const links = graph.edges.filter(e => {
      const key = JSON.stringify([e.from, e.to].sort());
      if (e.from === e.to || unique.has(key)) return false;
      unique.add(key); return true;
    }).map(e => [index.get(e.from), index.get(e.to)]);
    for (let step = 0; step < 260; step++) {
      const forces = positioned.map(n => ({ x: -n.x * 0.004, y: -n.y * 0.004 }));
      for (let i = 0; i < size; i++) for (let j = i + 1; j < size; j++) {
        let dx = positioned[j].x - positioned[i].x, dy = positioned[j].y - positioned[i].y;
        if (Math.abs(dx) + Math.abs(dy) < 0.01) { dx = 1; dy = 0.5; }
        const distance = Math.max(1, Math.hypot(dx, dy));
        const strength = Math.min(300, 36000 / (distance * distance));
        let fx = strength * dx / distance, fy = strength * dy / distance;
        const ox = WIDTH + 52 - Math.abs(dx), oy = HEIGHT + 75 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) fx += Math.sign(dx || 1) * ox * 0.28;
          else fy += Math.sign(dy || 1) * oy * 0.28;
        }
        forces[i].x -= fx; forces[i].y -= fy; forces[j].x += fx; forces[j].y += fy;
      }
      for (const [a, b] of links) {
        const dx = positioned[b].x - positioned[a].x, dy = positioned[b].y - positioned[a].y;
        const d = Math.max(1, Math.hypot(dx, dy)), force = (d - 300) * 0.027;
        const fx = force * dx / d, fy = force * dy / d;
        forces[a].x += fx; forces[a].y += fy; forces[b].x -= fx; forces[b].y -= fy;
      }
      const maxStep = 22 * (1 - step / 260) + 0.1;
      positioned.forEach((node, i) => {
        if (node.fixed) return;
        const force = forces[i], d = Math.hypot(force.x, force.y) || 1, factor = Math.min(maxStep, d) / d;
        node.x += force.x * factor; node.y += force.y * factor;
      });
    }
    return positioned;
  }
  function clip(center, toward, pad = 0) {
    let dx = toward.x - center.x, dy = toward.y - center.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.001) { dx = 1; dy = 0; }
    const factor = Math.min((WIDTH / 2 + pad) / Math.max(0.0001, Math.abs(dx)), (HEIGHT / 2 + pad) / Math.max(0.0001, Math.abs(dy)));
    return { x: center.x + dx * factor, y: center.y + dy * factor };
  }
  function straightRoute(a, b, edge, index, count) {
    let dx = b.x - a.x, dy = b.y - a.y;
    if (Math.hypot(dx, dy) < .001) dx = 1;
    const length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
    const span = Math.abs(nx) * WIDTH + Math.abs(ny) * HEIGHT - 18;
    const gap = Math.min(48, span / Math.max(1, count - 1)), lane = (index - (count - 1) / 2) * gap;
    const hit = (node, pad, exit) => {
      const p = { x: node.x + nx * lane, y: node.y + ny * lane };
      let low = -Infinity, high = Infinity;
      for (const [axis, velocity, half] of [['x', ux, WIDTH / 2 + pad], ['y', uy, HEIGHT / 2 + pad]]) {
        if (Math.abs(velocity) < 1e-9) continue;
        const t1 = (node[axis] - half - p[axis]) / velocity, t2 = (node[axis] + half - p[axis]) / velocity;
        low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2));
      }
      const t = exit ? high : low; return { x: p.x + ux * t, y: p.y + uy * t };
    };
    const forward = edge.from === a.id;
    const start = hit(a, (forward ? edge.arrow === 'both' : edge.arrow !== 'none') ? 8 : 2, true);
    const end = hit(b, (forward ? edge.arrow !== 'none' : edge.arrow === 'both') ? 8 : 2, false);
    const points = forward ? [start, end] : [end, start];
    const t = Math.abs(dy) > Math.abs(dx) * .7 && count > 1 ? .3 + .4 * index / (count - 1) : .5;
    const label = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    return { edge, d: `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`, label, extra: points,
      parallel: edge.setId ? { setId: edge.setId, lane, centerOffset: 0 } : undefined };
  }
  function legacyRoutes(nodes, edges) {
    const map = new Map(nodes.map(n => [n.id, n])); const bundles = new Map();
    for (const edge of edges) {
      const key = JSON.stringify([edge.from, edge.to].sort());
      if (!bundles.has(key)) bundles.set(key, []);
      bundles.get(key).push(edge);
    }
    const result = [];
    for (const bundle of bundles.values()) bundle.forEach((edge, i) => {
      const a = map.get(edge.from), b = map.get(edge.to);
      if (a === b) {
        const height = 104 + i * 66;
        const start = { x: a.x - 40, y: a.y - HEIGHT / 2 - (edge.arrow === 'both' ? 7 : 0) };
        const end = { x: a.x + 40, y: a.y - HEIGHT / 2 - (edge.arrow !== 'none' ? 7 : 0) };
        result.push({ edge, d: `M ${start.x} ${start.y} C ${a.x - 145} ${a.y - height - 30}, ${a.x + 145} ${a.y - height - 30}, ${end.x} ${end.y}`,
          label: { x: a.x, y: a.y - height }, extra: [{ x: a.x, y: a.y - height - 30 }] });
        return;
      }
      const first = edge.from < edge.to ? a : b, last = first === a ? b : a;
      const dx = last.x - first.x, dy = last.y - first.y, length = Math.max(1, Math.hypot(dx, dy));
      if (edge.shape === 'straight') {
        const straight = bundle.filter(e => e.shape === 'straight');
        result.push(straightRoute(first, last, edge, straight.indexOf(edge), straight.length)); return;
      }
      const lane = (i - (bundle.length - 1) / 2) * 140 || (edge.shape === 'curved' ? 140 : 0);
      // Curve around unrelated cards when a straight connection would hide behind one.
      function candidate(offset) {
        const control = { x: (a.x + b.x) / 2 - dy / length * offset, y: (a.y + b.y) / 2 + dx / length * offset };
        const start = clip(a, control, edge.arrow === 'both' ? 8 : 2), end = clip(b, control, edge.arrow !== 'none' ? 8 : 2);
        const samples = Array.from({ length: 19 }, (_, k) => {
          const t = (k + 1) / 20, s = 1 - t;
          return { x: s * s * start.x + 2 * s * t * control.x + t * t * end.x, y: s * s * start.y + 2 * s * t * control.y + t * t * end.y };
        });
        const middle = samples[9]; let collisions = 0;
        for (const node of nodes) {
          if (node === a || node === b) continue;
          if (samples.some(p => Math.abs(p.x - node.x) < WIDTH / 2 + 14 && Math.abs(p.y - node.y) < HEIGHT / 2 + 14)) collisions += 2;
          if (edge.label && Math.abs(middle.x - node.x) < WIDTH / 2 + 95 && Math.abs(middle.y - node.y) < HEIGHT / 2 + 25) collisions += 3;
        }
        return { control, start, end, samples, collisions };
      }
      let best = candidate(lane);
      const offsets = lane ? [120, 220, 360, 540, 760].map(n => lane + Math.sign(lane) * n) : [-120, 120, -220, 220, -360, 360, -540, 540, -760, 760];
      for (const offset of offsets) {
        if (best.collisions === 0) break;
        const next = candidate(offset);
        if (next.collisions < best.collisions) best = next;
      }
      const { control, start, end } = best;
      result.push({ edge, d: `M ${start.x} ${start.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`,
        label: { x: (start.x + 2 * control.x + end.x) / 4, y: (start.y + 2 * control.y + end.y) / 4 }, extra: best.samples });
    });
    return result.sort((a, b) => a.edge.index - b.edge.index);
  }
  function routes(nodes, edges) {
    if (!edges.some(e => e.setId)) return legacyRoutes(nodes, edges);
    const fallback = new Map(legacyRoutes(nodes, edges).map(r => [r.edge.index, r]));
    const byId = new Map(nodes.map(n => [n.id, n])), pairs = new Map(), result = [];
    for (const edge of edges) {
      const key = JSON.stringify([edge.from, edge.to].sort());
      if (!pairs.has(key)) pairs.set(key, []);
      pairs.get(key).push(edge);
    }
    for (const pair of pairs.values()) {
      const units = new Map();
      for (const edge of pair) {
        const key = edge.setId ? 'set:' + edge.setId : 'edge:' + edge.index;
        if (!units.has(key)) units.set(key, []);
        units.get(key).push(edge);
      }
      let unitIndex = 0;
      for (const members of units.values()) {
        const centerOffset = (unitIndex++ - (units.size - 1) / 2) * 190 || (members[0].shape === 'curved' ? 160 : 0);
        if (members[0].shape === 'straight' || !members[0].setId || members.length < 2 || members[0].from === members[0].to) {
          result.push(...members.map(e => fallback.get(e.index))); continue;
        }
        const ids = [members[0].from, members[0].to].sort(), a = byId.get(ids[0]), b = byId.get(ids[1]);
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
        function build(offset) {
          const control = { x: (a.x + b.x) / 2 - dy / distance * offset, y: (a.y + b.y) / 2 + dx / distance * offset };
          let collisions = 0;
          const family = members.map((edge, index) => {
            const lane = (index - (members.length - 1) / 2) * 48;
            const point = t => {
              const s = 1 - t, tx = 2 * (s * (control.x - a.x) + t * (b.x - control.x)), ty = 2 * (s * (control.y - a.y) + t * (b.y - control.y));
              const norm = Math.hypot(tx, ty) || 1;
              // Ports converge inside the cards. The visible middle follows a constant normal offset.
              const spread = Math.max(0, Math.min(1, t / .16, (1 - t) / .16));
              return { x: s * s * a.x + 2 * s * t * control.x + t * t * b.x - ty / norm * lane * spread,
                y: s * s * a.y + 2 * s * t * control.y + t * t * b.y + tx / norm * lane * spread };
            };
            const samples = Array.from({ length: 81 }, (_, k) => point(k / 80));
            const forward = edge.from === a.id;
            const firstPad = (forward ? edge.arrow === 'both' : edge.arrow !== 'none') ? 8 : 2;
            const lastPad = (forward ? edge.arrow !== 'none' : edge.arrow === 'both') ? 8 : 2;
            const inside = (p, c, pad) => Math.abs(p.x - c.x) <= WIDTH / 2 + pad && Math.abs(p.y - c.y) <= HEIGHT / 2 + pad;
            const intersection = (p, q, c, pad) => {
              const vx = q.x - p.x, vy = q.y - p.y;
              const tx = vx > 0 ? (c.x + WIDTH / 2 + pad - p.x) / vx : vx < 0 ? (c.x - WIDTH / 2 - pad - p.x) / vx : Infinity;
              const ty = vy > 0 ? (c.y + HEIGHT / 2 + pad - p.y) / vy : vy < 0 ? (c.y - HEIGHT / 2 - pad - p.y) / vy : Infinity;
              const t = Math.max(0, Math.min(1, tx, ty)); return { x: p.x + vx * t, y: p.y + vy * t };
            };
            const first = samples.findIndex(p => !inside(p, a, firstPad));
            let last = samples.length - 1; while (last >= 0 && inside(samples[last], b, lastPad)) last--;
            let clipped;
            if (first < 1 || last < first || last >= samples.length - 1) clipped = [clip(a, b, firstPad), clip(b, a, lastPad)];
            else clipped = [intersection(samples[first - 1], samples[first], a, firstPad), ...samples.slice(first, last + 1), intersection(samples[last + 1], samples[last], b, lastPad)];
            const labelT = Math.abs(dy) > Math.abs(dx) * .7 ? .3 + .4 * index / Math.max(1, members.length - 1) : .5;
            const label = point(labelT);
            for (const n of nodes) {
              if (n === a || n === b) continue;
              if (clipped.some(p => inside(p, n, 15))) collisions += 2;
              if (edge.label && Math.abs(label.x - n.x) < WIDTH / 2 + 100 && Math.abs(label.y - n.y) < HEIGHT / 2 + 26) collisions += 3;
            }
            const directed = forward ? clipped : [...clipped].reverse();
            return { edge, d: directed.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '), label, extra: clipped, parallel: { setId: edge.setId, lane, centerOffset: offset }, samples: samples.slice(16, 65) };
          });
          return { family, collisions };
        }
        let best = build(centerOffset);
        const offsets = centerOffset ? [160, 280, 440, 680, 980].map(n => centerOffset + Math.sign(centerOffset) * n) : [-160, 160, -280, 280, -440, 440, -680, 680, -980, 980];
        for (const offset of offsets) { if (!best.collisions) break; const next = build(offset); if (next.collisions < best.collisions) best = next; }
        result.push(...best.family);
      }
    }
    return result.sort((a, b) => a.edge.index - b.edge.index);
  }
  function bounds(nodes, paths = []) {
    if (!nodes.length) return { x: -200, y: -150, width: 400, height: 300 };
    const xs = [], ys = [];
    for (const n of nodes) { xs.push(n.x - WIDTH / 2, n.x + WIDTH / 2); ys.push(n.y - HEIGHT / 2, n.y + HEIGHT / 2); }
    for (const path of paths) {
      xs.push(path.label.x - 120, path.label.x + 120); ys.push(path.label.y - 26, path.label.y + 26);
      for (const p of path.extra) { xs.push(p.x); ys.push(p.y); }
    }
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  return { WIDTH, HEIGHT, wrap, signature, layout, routes, bounds };
});
