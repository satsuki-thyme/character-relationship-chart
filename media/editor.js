/* global document */
(() => {
  'use strict';
  window.RelationsEditor = api => {
    const $ = id => document.getElementById(id), dialog = $('config-editor'), form = $('edit-form');
    const names = { general: '全体', nodes: 'キャラクター', groups: 'グループ', edges: '関係' };
    let latest, base, kind = 'general', index = null, dirty = false, pending = null, serial = 0, groupOrder = [];
    const el = (tag, text, attrs = {}) => {
      const item = document.createElement(tag); if (text !== undefined) item.textContent = text;
      for (const [k, v] of Object.entries(attrs)) item.setAttribute(k, v); return item;
    };
    const stale = () => !latest?.config || latest.documentVersion !== base?.documentVersion;
    function notice(text, error = false) {
      $('edit-message').textContent = text; $('edit-message').classList.toggle('is-error', error);
    }
    function controls() {
      $('edit-save').disabled = !!pending || stale();
      $('edit-delete').hidden = kind === 'general' || index === null;
      $('edit-delete').disabled = !!pending || stale();
      $('edit-fields').disabled = !!pending;
      $('edit-reload').disabled = !!pending;
      $('edit-add').disabled = !!pending || !latest?.config;
      $('edit-close').disabled = !!pending;
      $('edit-state').textContent = pending ? '保存中…' : stale() ? '設定が変更されています' : dirty ? '未保存の入力あり' : '設定ファイルへ保存';
    }
    function ask(text, action, label = '破棄して続ける') {
      const box = $('edit-confirm'); box.replaceChildren(el('p', text)); box.hidden = false;
      const accept = el('button', label, { type: 'button', class: 'primary' }), cancel = el('button', '戻る', { type: 'button' });
      accept.addEventListener('click', () => { box.hidden = true; action(); });
      cancel.addEventListener('click', () => { box.hidden = true; }); box.append(accept, cancel); accept.focus();
    }
    function navigate(action) {
      if (pending) return;
      if (dirty) ask('未保存の入力を破棄して続けますか？', action); else action();
    }
    function field(name, label, value = '', options = {}) {
      const wrapper = el('label', undefined, { class: 'edit-field' }); wrapper.append(el('span', label));
      let input;
      if (options.choices) {
        input = el('select');
        for (const [id, name] of options.choices) input.append(el('option', name, { value: id }));
      } else if (options.multiline) input = el('textarea', undefined, { rows: '4' });
      else input = el('input', undefined, { type: options.number ? 'number' : 'text' });
      input.id = 'field-' + name; input.name = name; input.value = value ?? '';
      if (options.required) input.required = true;
      if (options.max) input.maxLength = options.max;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.number) { input.min = '-20000'; input.max = '20000'; input.step = 'any'; }
      wrapper.append(input); $('edit-fields').append(wrapper); return input;
    }
    function id(prefix, list) { let n = 1; while (list.some(v => v.id === `${prefix}-${n}`)) n++; return `${prefix}-${n}`; }
    function defaults() {
      const data = base.config;
      if (kind === 'nodes') return { id: id('character', data.nodes), label: '', groups: [] };
      if (kind === 'groups') return { id: id('group', data.groups || []), label: '' };
      if (kind === 'edges') return { from: data.nodes[0]?.id || '', to: data.nodes[1]?.id || data.nodes[0]?.id || '' };
      return {};
    }
    function renderList() {
      const box = $('edit-list'); box.replaceChildren(); $('edit-add').hidden = kind === 'general';
      $('edit-add').textContent = `${names[kind]}を追加`;
      if (kind === 'general') { box.append(el('p', '図のタイトルや説明、初期配置を編集できます。', { class: 'edit-note' })); return; }
      const list = base.config[kind] || [];
      list.forEach((value, i) => {
        const button = el('button', value.label || (kind === 'edges' ? '関係' : value.id), { type: 'button', class: 'edit-item', 'aria-current': String(index === i) });
        if (kind === 'edges') {
          const label = id => base.config.nodes.find(n => n.id === id)?.label || id;
          button.append(el('small', `${label(value.from)} → ${label(value.to)}`));
        } else button.append(el('small', value.id));
        button.addEventListener('click', () => navigate(() => load(kind, i))); box.append(button);
      });
      if (!list.length) box.append(el('p', 'まだ登録されていません。追加ボタンから作成できます。', { class: 'edit-note' }));
    }
    function render() {
      const data = base.config, value = kind === 'general' ? data : index === null ? defaults() : data[kind][index];
      $('edit-fields').replaceChildren(); $('edit-confirm').hidden = true;
      $('edit-heading').textContent = kind === 'general' ? '図の設定' : `${names[kind]}${index === null ? 'を追加' : 'を編集'}`;
      for (const button of $('edit-tabs').children) button.setAttribute('aria-pressed', String(button.dataset.kind === kind));
      renderList();
      if (kind === 'general') {
        field('title', 'タイトル', value.title, { max: 200 });
        field('description', '説明', value.description, { multiline: true, max: 4000 });
        field('layout', '初期配置', value.layout || 'auto', { choices: [['auto', '自動'], ['circle', '円形']] });
      } else {
        if (kind !== 'edges') field('id', 'ID', value.id, { required: true, max: 100 });
        if (kind === 'edges') {
          const choices = data.nodes.map(n => [n.id, `${n.label} (${n.id})`]);
          field('from', '始点', value.from, { required: true, choices });
          field('to', '終点', value.to, { required: true, choices });
        }
        field('label', kind === 'edges' ? '関係名' : '名前', value.label, { required: kind !== 'edges', max: 200 });
        if (kind === 'nodes') {
          groupOrder = [...(value.groups || (value.group !== undefined ? [value.group] : []))];
          const memberships = el('div', undefined, { class: 'edit-memberships' }); memberships.append(el('span', '所属グループ（複数選択）'));
          for (const group of data.groups || []) {
            const label = el('label', undefined, { class: 'membership-option' }), check = el('input', undefined, { type: 'checkbox', name: 'groups', value: group.id });
            check.checked = groupOrder.includes(group.id);
            check.addEventListener('change', () => { groupOrder = groupOrder.filter(id => id !== group.id); if (check.checked) groupOrder.push(group.id); });
            label.append(check, document.createTextNode(group.label)); memberships.append(label);
          }
          if (!(data.groups || []).length) memberships.append(el('small', '「グループ」タブから先にグループを追加してください。'));
          $('edit-fields').append(memberships);
        }
        if (kind !== 'groups') field('description', '説明', value.description, { multiline: true, max: 4000 });
        field('color', '色（省略すると自動）', value.color, { placeholder: '#55b8ad', max: 7 });
        if (kind === 'nodes') {
          const note = el('p', '色を省略すると先頭の所属グループの色を使います。所属の順番は選び直すと変えられます。', { class: 'edit-note' }); $('edit-fields').append(note);
          field('x', '固定位置 X（任意）', value.x, { number: true }); field('y', '固定位置 Y（任意）', value.y, { number: true });
        }
        if (kind === 'edges') {
          field('arrow', '矢印', value.arrow || 'forward', { choices: [['forward', '始点 → 終点'], ['both', '双方向 ↔'], ['none', '矢印なし']] });
          field('style', '線の種類', value.style || 'solid', { choices: [['solid', '実線'], ['dashed', '破線'], ['dotted', '点線']] });
          field('shape', '線の形', value.shape || 'auto', { choices: [['auto', '自動／セットに合わせる'], ['straight', '直線'], ['curved', '曲線']] });
          field('setId', '並行線のセットID（任意）', value.setId, { max: 100, placeholder: '例: hero-friend' });
          $('edit-fields').append(el('p', '同じセットは同じ2人を結ぶ関係に指定します。線の形を指定すると、同じセットの形も一緒に変更します。', { class: 'edit-note' }));
        }
      }
      controls();
    }
    function load(nextKind, nextIndex) {
      if (!latest?.config) { notice('設定にエラーがあります。設定ファイルで修正してください。', true); return; }
      base = latest; kind = nextKind;
      const list = base.config[kind] || [];
      index = kind === 'general' ? null : nextIndex !== undefined ? nextIndex : list.length ? 0 : null;
      if (index !== null && !list[index]) index = list.length ? 0 : null;
      dirty = false; notice('変更は「保存して反映」で設定ファイルに保存されます。'); render();
    }
    function open(nextKind = 'general', identifier) {
      if (!latest?.config) return;
      const action = () => {
        let nextIndex = identifier;
        if (typeof identifier === 'string') nextIndex = latest.config[nextKind]?.findIndex(n => n.id === identifier);
        load(nextKind, nextIndex); if (!dialog.open) dialog.showModal();
      };
      if (dialog.open) navigate(action); else action();
    }
    function collect() {
      const value = {}, get = name => form.elements.namedItem(name)?.value ?? '';
      const string = (name, required = false) => { const text = get(name); if (text || required) value[name] = text; };
      if (kind === 'general') { string('title'); string('description'); value.layout = get('layout'); return value; }
      if (kind !== 'edges') string('id', true);
      if (kind === 'edges') { string('from', true); string('to', true); }
      string('label', kind !== 'edges'); if (kind !== 'groups') string('description'); string('color');
      if (kind === 'nodes') {
        value.groups = [...groupOrder];
        for (const axis of ['x', 'y']) if (get(axis) !== '') value[axis] = Number(get(axis));
      }
      if (kind === 'edges') { value.arrow = get('arrow'); value.style = get('style'); if (get('shape') !== 'auto') value.shape = get('shape'); string('setId'); }
      return value;
    }
    function submit(action) {
      if (pending || stale()) return;
      if (action !== 'delete' && !form.reportValidity()) return;
      const operation = { kind, action, index };
      if (action !== 'delete') operation.value = collect();
      pending = ++serial; $('edit-confirm').hidden = true; notice('保存しています…'); controls();
      api.postMessage({ type: 'editConfig', requestId: pending, baseVersion: base.documentVersion, operation });
    }
    form.addEventListener('submit', event => { event.preventDefault(); submit(kind === 'general' || index !== null ? 'save' : 'add'); });
    form.addEventListener('input', () => { dirty = true; controls(); });
    form.addEventListener('change', () => { dirty = true; controls(); });
    $('edit-delete').addEventListener('click', () => {
      let suffix = '';
      if (kind === 'nodes') {
        const node = base.config.nodes[index], count = base.config.edges.filter(e => e.from === node.id || e.to === node.id).length;
        suffix = ` 接続している関係${count}件も削除します。`;
      } else if (kind === 'groups') suffix = ' キャラクターは残し、このグループへの所属だけを解除します。';
      ask(`${names[kind]}を削除しますか？${suffix}`, () => submit('delete'), '削除する');
    });
    for (const [key, name] of Object.entries(names)) {
      const button = el('button', name, { type: 'button', 'data-kind': key, 'aria-pressed': 'false' });
      button.addEventListener('click', () => navigate(() => load(key))); $('edit-tabs').append(button);
    }
    $('edit-add').addEventListener('click', () => navigate(() => load(kind, null)));
    $('edit-reload').addEventListener('click', () => navigate(() => load(kind, index)));
    $('edit-close').addEventListener('click', () => navigate(() => dialog.close()));
    dialog.addEventListener('cancel', event => { event.preventDefault(); navigate(() => dialog.close()); });
    $('edit-config').addEventListener('click', () => open());
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'update') {
        latest = { config: message.config, documentVersion: message.documentVersion };
        $('edit-config').disabled = !latest.config;
        if (dialog.open && !pending) {
          if (dirty) { if (stale()) notice('設定が別の場所で変更されました。入力を確認し、「再読込」してから編集してください。', true); controls(); }
          else if (latest.config) load(kind, index);
          else { notice('設定にエラーがあります。設定ファイルで修正してください。', true); controls(); }
        }
      } else if (message.type === 'editResult' && message.requestId === pending) {
        pending = null;
        if (message.ok) {
          latest = { config: message.config, documentVersion: message.documentVersion }; load(kind, message.index === null ? undefined : message.index);
          notice('保存しました。相関図に反映されています。');
        } else { notice(message.message || '保存できませんでした。', true); controls(); }
      }
    });
    return { open };
  };
})();
