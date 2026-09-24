/* global RelationsGraph */
(() => {
  'use strict';
  window.RelationsUi = host => {
    const G = RelationsGraph, NS = 'http://www.w3.org/2000/svg';
    const $ = id => document.getElementById(id);
    const editor = window.RelationsEditor(host);
    const svg = $('canvas'), viewport = $('viewport');
    let state = { version: 1 }, graph, positioned = [], paths = [], selected = null, drag = null;
    let camera = { x: 0, y: 0, scale: 1 }, hasCamera = false, pendingFrame = false;
    let nodeEls = new Map(), edgeEls = new Map(), edgeLabelEls = new Map();
    let statusText = '', issueMessages = [], lastSize;
    const svgEl = (name, attrs = {}, text) => {
      const e = document.createElementNS(NS, name);
      for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value));
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const el = (tag, className, text) => {
      const e = document.createElement(tag); if (className) e.className = className;
      if (text !== undefined) e.textContent = text; return e;
    };
    function save() {
      const rect = svg.getBoundingClientRect();
      state.version = 1; state.camera = { ...camera, width: rect.width, height: rect.height };
      host.updateView(state);
    }
    function applyUi() {
      state.ui ||= { details: false, focus: false };
      document.body.classList.toggle('focus-mode', !!state.ui.focus);
      $('exit-focus').hidden = !state.ui.focus;
      $('details').hidden = !state.ui.details || !!state.ui.focus;
      $('toggle-details').setAttribute('aria-expanded', String(!!state.ui.details));
    }
    function setUi(key, value) {
      state.ui ||= {}; state.ui[key] = value; applyUi();
      const rect = svg.getBoundingClientRect();
      if (hasCamera && lastSize) { camera.x += (rect.width - lastSize.width) / 2; camera.y += (rect.height - lastSize.height) / 2; transform(); }
      lastSize = { width: rect.width, height: rect.height }; save();
    }
    function restoreCamera() {
      if (!state.camera) { hasCamera = false; if (graph) requestAnimationFrame(() => fit(false)); return; }
      const rect = svg.getBoundingClientRect(), c = state.camera;
      camera = { x: c.x + (c.width ? (rect.width - c.width) / 2 : 0), y: c.y + (c.height ? (rect.height - c.height) / 2 : 0), scale: c.scale };
      hasCamera = true; lastSize = { width: rect.width, height: rect.height }; transform();
    }
    function transform() {
      viewport.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
      $('zoom').textContent = `${Math.round(camera.scale * 100)}%`;
    }
    function fit(persist = true) {
      if (!graph) return;
      const rect = svg.getBoundingClientRect(), box = G.bounds(positioned, paths);
      const scale = Math.max(0.01, Math.min(1.35, (rect.width - 90) / (box.width + 50), (rect.height - 85) / (box.height + 50)));
      camera = { x: rect.width / 2 - (box.x + box.width / 2) * scale, y: rect.height / 2 - (box.y + box.height / 2) * scale, scale };
      hasCamera = true; lastSize = { width: rect.width, height: rect.height }; transform(); if (persist) save();
    }
    function zoom(factor, center) {
      const rect = svg.getBoundingClientRect(); const point = center || { x: rect.width / 2, y: rect.height / 2 };
      const next = Math.max(0.01, Math.min(4, camera.scale * factor));
      const ratio = next / camera.scale;
      camera = { x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio, scale: next };
      hasCamera = true; transform(); save();
    }
    function localPoint(event) {
      const rect = svg.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    const worldPoint = p => ({ x: (p.x - camera.x) / camera.scale, y: (p.y - camera.y) / camera.scale });
    function groupsFor(node) { return (node.groups || (node.group ? [node.group] : [])).map(id => graph.groups.find(g => g.id === id)).filter(Boolean); }
    function defaultLine() { return getComputedStyle(document.body).getPropertyValue('--line').trim() || '#98a5ba'; }
    function paintEdges() {
      const layer = $('edges'), labels = $('edge-labels'), defs = $('defs');
      layer.replaceChildren(); labels.replaceChildren(); defs.replaceChildren(); edgeEls = new Map(); edgeLabelEls = new Map();
      paths = G.routes(positioned, graph.edges);
      for (const route of paths) {
        const edge = route.edge, color = edge.color || defaultLine();
        const marker = svgEl('marker', { id: `arrow-${edge.index}`, markerWidth: 9, markerHeight: 9, refX: 8, refY: 4.5, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse', viewBox: '0 0 9 9' });
        marker.append(svgEl('path', { d: 'M 0 0 L 9 4.5 L 0 9 z', fill: color })); defs.append(marker);
        const from = graph.nodes.find(n => n.id === edge.from), to = graph.nodes.find(n => n.id === edge.to);
        const relationship = `${from.label} ${edge.arrow === 'both' ? '↔' : edge.arrow === 'none' ? '―' : '→'} ${to.label}: ${edge.label || '関係'}`;
        const group = svgEl('g', { class: 'edge', 'data-edge': edge.index, tabindex: '0', role: 'button', 'aria-label': relationship });
        group.append(svgEl('title', {}, `${relationship}${edge.description ? '\n' + edge.description : ''}`));
        const line = svgEl('path', { class: 'edge-line', d: route.d, stroke: color, 'stroke-linejoin': 'round' });
        if (edge.arrow !== 'none') line.setAttribute('marker-end', `url(#arrow-${edge.index})`);
        if (edge.arrow === 'both') line.setAttribute('marker-start', `url(#arrow-${edge.index})`);
        if (edge.style !== 'solid') line.setAttribute('stroke-dasharray', edge.style === 'dashed' ? '7 5' : '2 5');
        if (edge.style === 'dotted') line.setAttribute('stroke-linecap', 'round');
        group.append(line, svgEl('path', { class: 'edge-hit', d: route.d }));
        const activate = event => { if (!drag?.moved) { event.stopPropagation(); select({ kind: 'edge', index: edge.index }); } };
        if (edge.label) {
          // A separate layer keeps every label above every stroke and arrow.
          // The edge remains the single keyboard / accessibility control.
          const labelGroup = svgEl('g', { class: 'edge-label-group', 'data-edge': edge.index, 'aria-hidden': 'true' });
          labelGroup.append(svgEl('title', {}, `${relationship}${edge.description ? '\n' + edge.description : ''}`));
          const lines = G.wrap(edge.label, 16, 2);
          const width = Math.min(190, Math.max(35, Math.max(...lines.map(s => Array.from(s).reduce((w, c) => w + (c.codePointAt(0) < 128 ? 6.6 : 11), 0))) + 18));
          const height = lines.length * 16 + 8;
          labelGroup.append(svgEl('rect', { class: 'edge-label-bg', x: route.label.x - width / 2, y: route.label.y - height / 2, width, height, rx: 4 }));
          lines.forEach((text, i) => labelGroup.append(svgEl('text', { class: 'edge-label', x: route.label.x, y: route.label.y - (lines.length - 1) * 8 + i * 16 + 4, 'text-anchor': 'middle' }, text)));
          labelGroup.addEventListener('click', activate);
          labels.append(labelGroup); edgeLabelEls.set(edge.index, labelGroup);
        }
        group.addEventListener('click', activate);
        group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select({ kind: 'edge', index: edge.index }); } });
        layer.append(group); edgeEls.set(edge.index, group);
      }
    }
    function paintNodes() {
      $('nodes').replaceChildren(); nodeEls = new Map();
      for (const node of positioned) {
        const groups = groupsFor(node), groupLabel = groups.map(g => g.label).join(' / ');
        const item = svgEl('g', { class: 'node', transform: `translate(${node.x} ${node.y})`, tabindex: '0', role: 'button', 'aria-label': `${node.label}${groupLabel ? '、' + groupLabel : ''}` });
        item.append(svgEl('title', {}, `${node.label}\n${groupLabel}\n${node.description}`));
        item.append(svgEl('rect', { class: 'selection', x: -G.WIDTH / 2 - 5, y: -G.HEIGHT / 2 - 5, width: G.WIDTH + 10, height: G.HEIGHT + 10, rx: 14 }));
        item.append(svgEl('rect', { class: 'card', x: -G.WIDTH / 2, y: -G.HEIGHT / 2, width: G.WIDTH, height: G.HEIGHT, rx: 10, stroke: node.color }));
        const bars = groups.length ? groups.map(g => g.color) : [node.color];
        bars.forEach((color, i) => item.append(svgEl('rect', { x: -G.WIDTH / 2 + 12, y: -G.HEIGHT / 2 + 17 + (G.HEIGHT - 34) * i / bars.length, width: 3, height: (G.HEIGHT - 34) / bars.length, rx: 1, fill: color })));
        const lines = G.wrap(node.label, 9, 2);
        lines.forEach((text, i) => item.append(svgEl('text', { class: 'name', x: 6, y: lines.length === 1 ? -3 : -12 + 19 * i, 'text-anchor': 'middle' }, text)));
        item.append(svgEl('text', { class: 'group-name', x: 6, y: 26, 'text-anchor': 'middle' }, G.wrap(groupLabel || node.id, 14, 1)[0]));
        item.addEventListener('pointerdown', event => beginNodeDrag(event, node));
        item.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select({ kind: 'node', id: node.id }); }
        });
        $('nodes').append(item); nodeEls.set(node.id, item);
      }
    }
    function render() {
      if (!graph) return;
      paintEdges(); paintNodes(); highlight(); transform();
    }
    function badge(label, color) {
      const b = el('span', 'badge'), dot = el('span', 'dot'); dot.style.backgroundColor = color;
      b.append(dot, document.createTextNode(label)); return b;
    }
    function describeSelection() {
      const box = $('detail-content'); box.replaceChildren();
      if (!graph) { box.append(el('p', 'detail-note', '設定ファイルを読み込んでいます。')); return; }
      if (!selected) {
        box.append(el('h2', 'detail-heading', 'つながりを読む'), el('p', 'detail-note', '人物や関係線を選ぶと、ここに詳しい情報を表示します。'));
        const help = el('div', 'detail-help');
        for (const text of [graph.description, '人物をドラッグして、見やすい位置へ。', '空白をドラッグして、図全体を移動。', '配置・倍率などは、設定の隣の .view.json に自動保存します。2つのファイルを一緒に共有できます。'].filter(Boolean)) help.append(el('p', '', text));
        box.append(help); return;
      }
      if (selected.kind === 'node') {
        const node = graph.nodes.find(n => n.id === selected.id);
        if (!node) { selected = null; describeSelection(); return; }
        const groups = groupsFor(node), groupLabel = groups.map(g => g.label).join(' / ');
        for (const group of groups) box.append(badge(group.label, group.color));
        box.append(el('h2', 'detail-heading', node.label), el('p', 'detail-note', node.description || '説明はまだありません。'), el('div', 'detail-id', `ID: ${node.id}`));
        const editButton = el('button', 'detail-edit', 'このキャラクターを編集'); editButton.addEventListener('click', () => editor.open('nodes', node.id)); box.append(editButton);
        const related = graph.edges.filter(e => e.from === node.id || e.to === node.id);
        box.append(el('div', 'detail-section', `つながり · ${related.length}`));
        for (const edge of related) {
          const other = graph.nodes.find(n => n.id === (edge.from === node.id ? edge.to : edge.from));
          const direction = edge.arrow === 'both' ? '↔' : edge.arrow === 'none' ? '―' : edge.from === node.id ? '→' : '←';
          const button = el('button', 'relation-item', `${direction} ${other.label}`);
          button.append(el('small', '', edge.label || '関係')); button.addEventListener('click', () => select({ kind: 'edge', index: edge.index })); box.append(button);
        }
      } else {
        const edge = graph.edges.find(e => e.index === selected.index);
        if (!edge) { selected = null; describeSelection(); return; }
        box.append(el('h2', 'detail-heading', edge.label || '関係'));
        const direction = edge.arrow === 'both' ? '↔' : edge.arrow === 'none' ? '―' : '→';
        for (const [i, id] of [edge.from, edge.to].entries()) {
          if (i) box.append(el('p', 'detail-note', direction));
          const node = graph.nodes.find(n => n.id === id), button = el('button', 'relation-item', node.label);
          button.addEventListener('click', () => select({ kind: 'node', id })); box.append(button);
        }
        box.append(el('p', 'detail-note', edge.description || 'この関係の説明はまだありません。'));
        const editButton = el('button', 'detail-edit', 'この関係を編集'); editButton.addEventListener('click', () => editor.open('edges', edge.index)); box.append(editButton);
        box.append(el('div', 'detail-id', `線の形: ${{ auto: '自動', straight: '直線', curved: '曲線' }[edge.shape || 'auto']}`));
        if (edge.setId) box.append(el('div', 'detail-id', `セットID: ${edge.setId}`));
      }
    }
    function select(selection) { selected = selection; if (selection && !state.ui?.focus && !state.ui?.details) setUi('details', true); describeSelection(); highlight(); }
    function highlight() {
      if (!graph) return;
      const query = $('search').value.trim().toLocaleLowerCase();
      let focus = null, relevant = null;
      const matches = graph.nodes.filter(n => `${n.label} ${n.id} ${n.description} ${groupsFor(n).map(g => g.label + ' ' + g.id).join(' ')}`.toLocaleLowerCase().includes(query));
      if (query) focus = new Set(matches.map(n => n.id));
      else if (selected?.kind === 'node') focus = new Set([selected.id]);
      else if (selected?.kind === 'edge') {
        const edge = graph.edges.find(e => e.index === selected.index);
        if (edge) { focus = new Set([edge.from, edge.to]); relevant = new Set([edge.index]); }
      }
      if (focus && !relevant) relevant = new Set(graph.edges.filter(e => focus.has(e.from) || focus.has(e.to)).map(e => e.index));
      const neighbors = new Set(focus || []);
      if (relevant) for (const edge of graph.edges) if (relevant.has(edge.index)) { neighbors.add(edge.from); neighbors.add(edge.to); }
      for (const [id, item] of nodeEls) {
        item.classList.toggle('faded', Boolean(focus && !neighbors.has(id)));
        item.classList.toggle('selected', query ? focus.has(id) : selected?.kind === 'node' && selected.id === id);
        item.setAttribute('aria-pressed', String(selected?.kind === 'node' && selected.id === id));
      }
      for (const [index, item] of edgeEls) {
        for (const part of [item, edgeLabelEls.get(index)].filter(Boolean)) {
          part.classList.toggle('faded', Boolean(relevant && !relevant.has(index)));
          part.classList.toggle('selected', selected?.kind === 'edge' && selected.index === index);
        }
        item.setAttribute('aria-pressed', String(selected?.kind === 'edge' && selected.index === index));
      }
      $('stats').textContent = `${graph.nodes.length} 人物・項目 / ${graph.edges.length} 関係${query ? ` / 検索 ${matches.length} 件` : ''}`;
    }
    function beginNodeDrag(event, node) {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      const p = localPoint(event), w = worldPoint(p);
      drag = { type: 'node', node, origin: p, dx: node.x - w.x, dy: node.y - w.y, moved: false, pointer: event.pointerId };
      svg.setPointerCapture(event.pointerId); svg.classList.add('dragging');
    }
    svg.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('.edge, .edge-label-group')) return;
      const p = localPoint(event);
      drag = { type: 'pan', origin: p, x: camera.x, y: camera.y, moved: false, pointer: event.pointerId };
      svg.setPointerCapture(event.pointerId); svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const p = localPoint(event); if (Math.hypot(p.x - drag.origin.x, p.y - drag.origin.y) > 3) drag.moved = true;
      if (!drag.moved) return;
      if (drag.type === 'pan') {
        camera.x = drag.x + p.x - drag.origin.x; camera.y = drag.y + p.y - drag.origin.y; hasCamera = true; transform();
      } else {
        const w = worldPoint(p); drag.node.x = Math.max(-20000, Math.min(20000, w.x + drag.dx)); drag.node.y = Math.max(-20000, Math.min(20000, w.y + drag.dy));
        nodeEls.get(drag.node.id).setAttribute('transform', `translate(${drag.node.x} ${drag.node.y})`);
        if (!pendingFrame) { pendingFrame = true; requestAnimationFrame(() => { pendingFrame = false; if (graph) { paintEdges(); highlight(); } }); }
      }
    });
    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const finished = drag; drag = null; svg.classList.remove('dragging');
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
      if (finished.type === 'node') {
        if (finished.moved) {
          const original = graph.nodes.find(n => n.id === finished.node.id);
          state.positions ||= {};
          Object.defineProperty(state.positions, finished.node.id, { value: { x: finished.node.x, y: finished.node.y, source: G.signature(original) }, writable: true, configurable: true, enumerable: true });
        }
        // Dragging preserves both the current selection and the details mode.
        if (!finished.moved && event.type === 'pointerup') select({ kind: 'node', id: finished.node.id });
      } else if (!finished.moved && event.type === 'pointerup') select(null);
      save();
    }
    svg.addEventListener('pointerup', finishDrag); svg.addEventListener('pointercancel', finishDrag);
    svg.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .0025), localPoint(event)); }, { passive: false });
    svg.addEventListener('keydown', event => {
      if (event.key === 'Escape') select(null);
      if (event.target !== svg) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
      if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); fit(); }
    });

    function exportSvg() {
      if (!graph || !positioned.length || issueMessages.length) return;
      const box = G.bounds(positioned, paths), pad = 50, titleSpace = 54;
      const root = svgEl('svg', { width: Math.ceil(box.width + pad * 2), height: Math.ceil(box.height + pad * 2 + titleSpace), viewBox: `${box.x - pad} ${box.y - pad - titleSpace} ${box.width + pad * 2} ${box.height + pad * 2 + titleSpace}` });
      const bg = getComputedStyle(document.body).backgroundColor, fg = getComputedStyle(document.body).color;
      root.append(svgEl('title', {}, graph.title), svgEl('desc', {}, graph.description));
      root.append(svgEl('rect', { x: box.x - pad, y: box.y - pad - titleSpace, width: box.width + pad * 2, height: box.height + pad * 2 + titleSpace, fill: bg }));
      root.append(svgEl('text', { x: box.x, y: box.y - pad - 13, fill: fg, 'font-size': 23, 'font-family': 'sans-serif', 'font-weight': 600 }, graph.title));
      root.append($('defs').cloneNode(true));
      for (const layer of [$('edges'), $('edge-labels'), $('nodes')]) {
        const clone = layer.cloneNode(true);
        const originals = [layer, ...layer.querySelectorAll('*')], copies = [clone, ...clone.querySelectorAll('*')];
        originals.forEach((original, i) => {
          const target = copies[i], css = getComputedStyle(original);
          for (const prop of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'font-family', 'font-size', 'font-weight']) {
            const value = css.getPropertyValue(prop);
            if (value && !value.includes('var(')) target.setAttribute(prop, value);
          }
          target.removeAttribute('class'); target.removeAttribute('tabindex'); target.removeAttribute('role'); target.removeAttribute('aria-pressed');
          target.removeAttribute('aria-label'); target.removeAttribute('aria-hidden'); target.removeAttribute('data-edge'); target.removeAttribute('id');
          if (original.classList.contains('selection') || original.classList.contains('edge-hit')) target.remove();
        });
        root.append(clone);
      }
      host.exportSvg(new XMLSerializer().serializeToString(root));
    }
    $('open-source').addEventListener('click', () => host.openSource());
    $('fit').addEventListener('click', () => fit());
    $('toggle-details').addEventListener('click', () => setUi('details', !state.ui?.details));
    $('close-details').addEventListener('click', () => setUi('details', false));
    $('focus').addEventListener('click', () => { $('more-menu').open = false; setUi('focus', true); });
    $('exit-focus').addEventListener('click', () => setUi('focus', false));
    $('open-view').addEventListener('click', () => { save(); host.openView(); });
    $('save-view').addEventListener('click', () => { save(); host.saveView(); });
    $('reload-view').addEventListener('click', () => host.reloadView());
    document.addEventListener('keydown', e => { if ($('config-editor').open) return; if (e.key === 'Escape') { $('more-menu').open = false; if (state.ui?.focus) setUi('focus', false); } });
    document.addEventListener('pointerdown', e => { if (!$('more-menu').contains(e.target)) $('more-menu').open = false; });
    $('zoom-in').addEventListener('click', () => zoom(1.2)); $('zoom-out').addEventListener('click', () => zoom(1 / 1.2));
    $('clear-selection').addEventListener('click', () => { $('search').value = ''; select(null); });
    $('search').addEventListener('input', highlight);
    $('layout').addEventListener('change', () => { if (!graph) return; state.layout = $('layout').value; state.positions = {}; positioned = G.layout(graph, state.layout); render(); fit(); });
    $('reset').addEventListener('click', () => { if (!graph) return; state.positions = {}; positioned = G.layout(graph, state.layout); render(); fit(); });
    $('export').addEventListener('click', exportSvg);
    new ResizeObserver(() => {
      const rect = svg.getBoundingClientRect();
      if (!hasCamera && graph) fit(false);
      else if (lastSize && hasCamera) { camera.x += (rect.width - lastSize.width) / 2; camera.y += (rect.height - lastSize.height) / 2; transform(); }
      lastSize = { width: rect.width, height: rect.height };
    }).observe(svg);
    new MutationObserver(() => { if (graph) render(); }).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    host.onView(message => {
      state = message.viewState || { version: 1 };
      $('storage-file').textContent = message.fileName || '';
      applyUi(); restoreCamera();
      if (graph) { positioned = G.layout(graph, state.layout || graph.layout, state.positions); render(); }
    });
    host.onStorage(message => {
      $('storage-error').hidden = message.status !== 'error';
      $('storage-error').textContent = message.status === 'error' ? `表示データの保存・読込: ${message.message}　「⋯」から保存先を開くか、配置を再読込できます。` : '';
      $('storage-status').textContent = message.status === 'error' ? '表示データ未保存' : message.status === 'pending' ? '配置を保存中…' : message.exists ? '配置をファイルに保存済み' : '操作後に配置を自動保存';
    });
    host.onConfig(message => {
      issueMessages = message.issues || [];
      $('error').hidden = !issueMessages.length;
      $('error').textContent = issueMessages.length ? `${graph ? '直前の有効な図を表示中。' : ''} 設定を確認してください。\n` + issueMessages.slice(0, 5).map(e => `${e.line}行: ${e.message}`).join('\n') : '';
      statusText = issueMessages.length ? '設定エラー' : message.dirty ? '未保存の編集を反映中' : '設定を反映済み';
      $('status').textContent = statusText; $('status').title = message.fileName || '';
      $('export').disabled = issueMessages.length > 0 || !message.graph?.nodes.length;
      if (!message.graph) return;
      const first = !graph;
      if (drag) {
        if (svg.hasPointerCapture(drag.pointer)) svg.releasePointerCapture(drag.pointer);
        drag = null; svg.classList.remove('dragging');
      }
      graph = message.graph;
      if (state.configLayout !== graph.layout || !['auto', 'circle'].includes(state.layout)) state.layout = graph.layout;
      state.configLayout = graph.layout; state.positions ||= {};
      const validIds = new Set(graph.nodes.map(n => n.id));
      for (const id of Object.keys(state.positions)) if (!validIds.has(id)) delete state.positions[id];
      $('layout').value = state.layout;
      $('title').textContent = graph.title; $('title').title = graph.title; $('description').textContent = graph.description;
      $('empty').hidden = graph.nodes.length !== 0;
      $('legend').replaceChildren(...graph.groups.map(g => badge(g.label, g.color)));
      positioned = G.layout(graph, state.layout, state.positions);
      render(); describeSelection();
      if (first && !hasCamera) requestAnimationFrame(() => fit(false));
    });
    describeSelection(); host.ready();
  };
})();
