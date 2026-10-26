/* Podium L4C84L — paramètres */
'use strict';
(() => {
  const P = window.Podium;
  const { esc, eur, num, clone, toast, $, $$ } = P;
  const cfg = () => P.cfg;
  const slug = s => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let tab = 'gammes', priceGamme = null, priceField = 'pv';
  let netId = null, netGamme = null; // page Réseaux : grille affichée, gamme dont on saisit les tarifs
  const nf = { q: '', show: 'all', type: 'all' };
  const gf = { q: '', show: 'on', type: 'all' }; // filtres de la liste des gammes

  const root = () => $('#viewAdmin');
  // Clavier AZERTY : sans Maj, la rangée du haut donne & é " ' ( - è _ ç à au lieu de 1 à 0
  const AZERTY = { '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5', '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0' };
  const pinOf = v => String(v || '').trim().replace(/[&é"'(\-è_çà]/g, c => AZERTY[c]);
  const save = (msg) => { P.saveCfg(); if (msg) toast(msg); };

  function open() {
    if (P.profile === 'admin') return render();                 // site publié, profil Paramètres
    if (P.profile === 'user') return renderRestricted();        // site publié, profil User
    if (sessionStorage.getItem('podium-admin') !== 'ok') return renderPin(); // version de travail
    render();
  }
  function renderRestricted() {
    root().innerHTML = `<div class="card-admin pin-box">
      <h3>Paramètres</h3><p class="sub">Les paramètres sont réservés au profil Paramètres.</p>
      <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" id="rBack">Retour</button><button class="btn primary" id="rSwitch">Changer de profil</button></div></div>`;
    $('#rBack').onclick = () => location.hash = '';
    $('#rSwitch').onclick = () => P.logout();
  }

  // Écran du code : clavier à l'écran + touches physiques lues par leur position (e.code),
  // donc indépendant du Verr Num, de la touche Maj et de l'AZERTY.
  let pinKeys = null;
  function renderPin() {
    let code = '';
    const want = pinOf(cfg().pin || '0000');
    root().innerHTML = `<div class="card-admin pin-box">
      <h3>Paramètres</h3><p class="sub">Code d'accès</p>
      <div class="pin-dots" id="pinDots"></div>
      <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="del" title="Effacer">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok">OK</button></div>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="pinBack">Retour</button></div>
      <p class="sub" style="margin-top:14px">Code par défaut : 0000 (modifiable dans « Import / sauvegarde »)</p></div>`;
    const dots = () => { $('#pinDots').innerHTML = Array.from({ length: Math.max(4, want.length, code.length) }, (_, i) => `<i class="${i < code.length ? 'on' : ''}"></i>`).join(''); };
    const go = () => {
      if (code === want) { stop(); sessionStorage.setItem('podium-admin', 'ok'); render(); }
      else { code = ''; dots(); $('#pinDots').classList.remove('shake'); void $('#pinDots').offsetWidth; $('#pinDots').classList.add('shake'); toast('Code incorrect'); }
    };
    const press = k => {
      if (k === 'ok') return go();
      if (k === 'del') code = code.slice(0, -1); else if (code.length < 8) code += k;
      dots();
      if (code.length === want.length) setTimeout(() => code === want && go(), 120); // validation automatique au bon nombre de chiffres
    };
    const stop = () => { if (pinKeys) document.removeEventListener('keydown', pinKeys); pinKeys = null; };
    stop();
    pinKeys = e => {
      if (!$('#pinDots')) return stop();
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code) || /^(\d)$/.exec(e.key);
      if (m) { e.preventDefault(); press(m[1]); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
      else if (e.key === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); press('ok'); }
      else if (e.key === 'Escape') location.hash = '';
    };
    document.addEventListener('keydown', pinKeys);
    $$('.pin-pad button').forEach(b => b.onclick = () => press(b.dataset.k));
    $('#pinBack').onclick = () => { stop(); location.hash = ''; };
    dots();
  }

  const TABS = [['gammes', 'Gammes'], ['tarifs', 'Tarifs PV / PA'], ['matieres', 'Matières & traitements'], ['options', 'Options & règles'], ['reseaux', 'Réseaux'], ['sauvegarde', 'Import / sauvegarde']];

  function render() {
    root().innerHTML = `
      <div class="admin-h"><h1>Paramètres</h1>
        <div class="row"><span class="pill">Config. du ${esc(cfg().updatedAt || '—')}</span><button class="btn primary" id="adminBack">← Retour au podium</button></div></div>
      <div class="tabs">${TABS.map(([id, l]) => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="tabBody"></div>`;
    $('#adminBack').onclick = () => location.hash = '';
    $$('[data-tab]', root()).forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); });
    ({ gammes: tabGammes, tarifs: tabTarifs, matieres: tabMatieres, options: tabOptions, reseaux: tabReseaux, sauvegarde: tabSauvegarde })[tab]();
  }

  /* ---------- Liaison générique champ ↔ config ---------- */
  function setPath(path, value) {
    const keys = path.split('.'); let o = cfg();
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }
  function getPath(path) { return path.split('.').reduce((o, k) => o?.[k], cfg()); }
  function readInput(el) {
    const t = el.dataset.type;
    if (el.type === 'checkbox') return el.checked;
    if (t === 'num') return num(el.value);
    if (t === 'lines') return el.value.split('\n').map(s => s.trim()).filter(Boolean);
    return el.value;
  }
  function bindAll(scope, after) {
    $$('[data-bind]', scope).forEach(el => {
      el.addEventListener('change', () => { setPath(el.dataset.bind, readInput(el)); save(); after && after(el); });
    });
  }
  const inp = (path, type = 'text', cls = '') => {
    const v = getPath(path);
    if (type === 'bool') return `<label class="switch"><input type="checkbox" data-bind="${path}" ${v ? 'checked' : ''}><span></span></label>`;
    if (type === 'num') return `<input type="text" inputmode="decimal" class="${cls}" data-bind="${path}" data-type="num" value="${v ?? ''}">`;
    if (type === 'color') return `<input type="color" data-bind="${path}" value="${esc(v || '#1d4fd7')}">`;
    return `<input type="text" class="${cls}" data-bind="${path}" value="${esc(v ?? '')}">`;
  };

  /* ---------- Gammes ---------- */
  function tabGammes() {
    const c = cfg();
    $('#tabBody').innerHTML = `<div class="card-admin">
      <div class="row" style="justify-content:space-between"><div><h3>Gammes</h3><p class="sub">Les gammes viennent du catalogue PA/PV (libellé complet). Cochez celles à présenter et rédigez la phrase porteur. Une version FIT reprend la phrase et la fiche de sa gamme de base si elles sont vides. FIT : proposé seul quand les mesures le recommandent. Track : proposé seul quand le CVP est renseigné.</p></div></div>
      <div class="row" style="margin-bottom:12px">
        <input type="text" id="gq" placeholder="Rechercher une gamme…" value="${esc(gf.q)}" style="max-width:280px;text-align:left">
        <div class="seg" id="gshow"><button data-v="on" class="${gf.show === 'on' ? 'on' : ''}">Affichées</button><button data-v="all" class="${gf.show === 'all' ? 'on' : ''}">Toutes (${c.gammes.length})</button></div>
        <div class="seg" id="gtype"><button data-v="all" class="${gf.type === 'all' ? 'on' : ''}">Tous types</button><button data-v="prog" class="${gf.type === 'prog' ? 'on' : ''}">Progressifs</button><button data-v="unif" class="${gf.type === 'unif' ? 'on' : ''}">Unifocaux</button></div>
      </div>
      <div class="scroll-x" id="gtable"></div></div>`;
    const draw = () => {
      const q = gf.q.trim().toLowerCase();
      const list = c.gammes.map((g, i) => ({ g, i }))
        .filter(({ g }) => (gf.show === 'all' || g.enabled) && (gf.type === 'all' || g.type === gf.type) && (!q || (g.name + ' ' + (g.source || '')).toLowerCase().includes(q)))
        .sort((a, b) => (a.g.type > b.g.type ? -1 : a.g.type < b.g.type ? 1 : a.g.order - b.g.order));
      $('#gtable').innerHTML = list.length ? `<table class="tbl">
        <thead><tr><th>Ordre</th><th>Afficher</th><th>Nom affiché</th><th>Libellé catalogue</th><th>Prix</th><th>Couleur</th><th>FIT</th><th>Track</th><th>Anti-fatigue</th><th style="min-width:220px">3 mots-clés</th><th style="min-width:320px">Phrase porteur</th><th></th></tr></thead>
        <tbody>${list.map(({ g, i }) => {
          const base = g.base && c.gammes.find(x => x.id === g.base);
          return `<tr class="${g.enabled ? '' : 'off'}">
          <td style="white-space:nowrap"><button class="btn small icon" data-up="${i}">↑</button><button class="btn small icon" data-down="${i}">↓</button></td>
          <td>${inp(`gammes.${i}.enabled`, 'bool')}</td>
          <td>${inp(`gammes.${i}.name`)}</td>
          <td><small>${esc(g.source || '—')}</small><br><small style="color:var(--ink-3)">${g.type === 'prog' ? 'Progressif' : 'Unifocal'}</small></td>
          <td>${Object.keys(g.prices).length}</td>
          <td>${inp(`gammes.${i}.color`, 'color')}</td>
          <td>${inp(`gammes.${i}.fit`, 'bool')}</td>
          <td>${inp(`gammes.${i}.track`, 'bool')}</td>
          <td>${inp(`gammes.${i}.antifatigue`, 'bool')}</td>
          <td><input type="text" data-bind="gammes.${i}.keywords" value="${esc(g.keywords || '')}" placeholder="${base?.keywords ? esc('Reprend : ' + base.keywords) : 'Mot · Mot · Mot'}"></td>
          <td><input type="text" data-bind="gammes.${i}.tagline" value="${esc(g.tagline || '')}" placeholder="${base?.tagline ? esc('Reprend : ' + base.tagline) : ''}"></td>
          <td style="white-space:nowrap"><button class="btn small" data-fiche="${i}">Fiche</button> <button class="btn small" data-prices="${g.id}">Tarifs</button></td>
        </tr>`; }).join('')}</tbody></table>` : '<p class="sub">Aucune gamme ne correspond.</p>';
      bindAll($('#gtable'), el => { if (/\.(enabled|fit|track)$/.test(el.dataset.bind)) draw(); });
      $$('[data-up]').forEach(b => b.onclick = () => swap(+b.dataset.up, -1));
      $$('[data-down]').forEach(b => b.onclick = () => swap(+b.dataset.down, 1));
      $$('[data-fiche]').forEach(b => b.onclick = () => editFiche(+b.dataset.fiche));
      $$('[data-prices]').forEach(b => b.onclick = () => { priceGamme = b.dataset.prices; tab = 'tarifs'; render(); });
    };
    const swap = (i, d) => {
      const g = c.gammes[i];
      const same = c.gammes.filter(x => x.type === g.type && (gf.show === 'all' || x.enabled)).sort((a, b) => a.order - b.order);
      const o = same[same.indexOf(g) + d]; if (!o) return;
      [g.order, o.order] = [o.order, g.order]; if (g.order === o.order) g.order += d;
      save(); draw();
    };
    $('#gq').oninput = e => { gf.q = e.target.value; draw(); };
    $$('#gshow button').forEach(b => b.onclick = () => { gf.show = b.dataset.v; tabGammes(); });
    $$('#gtype button').forEach(b => b.onclick = () => { gf.type = b.dataset.v; tabGammes(); });
    draw();
  }

  function editFiche(i) {
    const g = cfg().gammes[i]; g.fiche = g.fiche || {};
    P.openModal(`<div class="modal-pad">
      <div class="row" style="justify-content:space-between"><h3>Fiche — ${esc(g.name)}</h3><button class="btn icon ghost" data-close>✕</button></div>
      <div class="stack" id="ficheForm">
        <label>3 mots-clés (en gras sur la vignette)<input type="text" data-bind="gammes.${i}.keywords" value="${esc(g.keywords || '')}" placeholder="Mot · Mot · Mot"></label>
        <label>Phrase porteur (sur la vignette)<input type="text" data-bind="gammes.${i}.tagline" value="${esc(g.tagline)}"></label>
        <label>Géométrie<textarea data-bind="gammes.${i}.fiche.geometrie">${esc(g.fiche.geometrie)}</textarea></label>
        <label>Technologies & brevets (une par ligne)<textarea data-bind="gammes.${i}.fiche.technologies" data-type="lines">${esc((g.fiche.technologies || []).join('\n'))}</textarea></label>
        <label>Pour qui ?<input type="text" data-bind="gammes.${i}.fiche.pourqui" value="${esc(g.fiche.pourqui)}"></label>
        <label>Aides à la vente (dossier assets/fiches de l'application : ${esc((g.fiche.images || []).map(x => x.split('/').pop()).join(', ') || 'aucune, reprend la gamme de base')})${g.fit ? ' + visuel FIT' : ''}${g.track ? ' + visuel Track' : ''}</label>
        <label>Visuel supplémentaire
          <div class="row"><input type="file" accept="image/*" id="ficheImg">${g.fiche.image ? '<button class="btn small danger" id="ficheImgDel">Retirer l\'image</button>' : ''}</div>
          ${g.fiche.image ? `<img src="${esc(g.fiche.image)}" style="max-width:240px;border-radius:10px;margin-top:6px">` : ''}</label>
      </div>
      <div class="row end" style="margin-top:16px"><button class="btn primary" data-close>Terminé</button></div></div>`);
    const form = $('#ficheForm');
    $$('[data-bind]', form).forEach(el => el.addEventListener('input', () => { setPath(el.dataset.bind, readInput(el)); if (/\.fiche\./.test(el.dataset.bind)) g.fiche.edited = true; save(); }));
    $('#ficheImg').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      g.fiche.image = await shrinkImage(f, 1200); save('Image enregistrée'); editFiche(i);
    };
    const del = $('#ficheImgDel'); if (del) del.onclick = () => { g.fiche.image = ''; save(); editFiche(i); };
    $('#modal').addEventListener('click', function h(e) { if (e.target.closest('[data-close]')) { $('#modal').removeEventListener('click', h); if (tab === 'gammes') tabGammes(); } });
  }

  function shrinkImage(file, max) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', .85));
        };
        img.onerror = rej; img.src = r.result;
      };
      r.onerror = rej; r.readAsDataURL(file);
    });
  }

  /* ---------- Tarifs ---------- */
  function tabTarifs() {
    const c = cfg();
    if (!c.gammes.some(g => g.id === priceGamme)) priceGamme = (c.gammes.find(g => g.enabled) || c.gammes[0])?.id;
    const g = c.gammes.find(x => x.id === priceGamme);
    const opts = ['prog', 'unif'].map(t => `<optgroup label="${t === 'prog' ? 'Progressifs' : 'Unifocaux'}">${c.gammes.filter(x => x.type === t).sort((a, b) => (b.enabled - a.enabled) || a.order - b.order).map(x => `<option value="${x.id}" ${x.id === priceGamme ? 'selected' : ''}>${esc(x.name)}${x.enabled ? '' : ' (masquée)'}</option>`).join('')}</optgroup>`).join('');
    // lignes = matière + filtre (BUC/EPS) × traitement, uniquement les combinaisons présentes au catalogue
    const keys = Object.keys(g.prices).map(k => k.split('|'));
    const mats = [...c.materials].sort((a, b) => a.index - b.index);
    const groups = [];
    for (const m of mats) for (const f of ['', 'buc', 'eps']) {
      const trs = c.treatments.filter(t => keys.some(k => k[0] === m.id && k[1] === f && k[2] === t.id));
      if (trs.length) groups.push({ m, f, trs });
    }
    const fname = f => f ? (c.filters?.find(x => x.id === f)?.name || f.toUpperCase()) : '';
    const cell = (m, f, t, ti) => {
      const k = `${m}|${f}|${t}|${ti}`, p = g.prices[k], v = p?.[priceField];
      return `<td><input type="text" inputmode="decimal" data-price="${k}" class="${v == null ? 'empty' : ''}" value="${v == null ? '' : String(v).replace('.', ',')}" placeholder="—" title="${esc(p?.code ? 'Code EDI ' + p.code : '')}"></td>`;
    };
    $('#tabBody').innerHTML = `<div class="card-admin">
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <div class="row"><select id="pg" style="min-width:300px">${opts}</select>
        <div class="seg" id="pf"><button data-f="pv" class="${priceField === 'pv' ? 'on' : ''}">Prix de vente (PV)</button><button data-f="pa" class="${priceField === 'pa' ? 'on' : ''}">Prix d'achat (PA)</button></div></div>
        <button class="btn" id="goImport">Mettre à jour depuis le catalogue Excel…</button></div>
      <p class="sub">Libellé catalogue : <b>${esc(g.source || g.name)}</b>. Prix <b>par verre</b> ; survolez une case pour voir le code EDI. ${priceField === 'pa' ? 'Le PA n\'est jamais affiché côté opticien.' : 'Case vide : référence sans prix, non proposée.'}</p>
      ${groups.length ? `<div class="scroll-x"><table class="tbl grid-price"><thead><tr><th>Matière</th><th>Traitement</th>${c.tints.map(t => `<th>${esc(t.name)}</th>`).join('')}${priceField === 'pa' ? '<th>Coef. (blanc)</th>' : ''}</tr></thead>
      <tbody>${groups.map(({ m, f, trs }) => trs.map((t, k) => `<tr>${k === 0 ? `<td class="mat" rowspan="${trs.length}">${esc(m.name)} ${esc(fname(f))}<br><small>${m.index}</small></td>` : ''}<td>${esc(t.name)}</td>${c.tints.map(ti => cell(m.id, f, t.id, ti.id)).join('')}${priceField === 'pa' ? `<td>${coef(g, `${m.id}|${f}|${t.id}|blanc`)}</td>` : ''}</tr>`).join('')).join('')}</tbody></table></div>` : '<p class="sub">Aucun prix pour cette gamme.</p>'}</div>`;
    $('#pg').onchange = e => { priceGamme = e.target.value; tabTarifs(); };
    $$('#pf button').forEach(b => b.onclick = () => { priceField = b.dataset.f; tabTarifs(); });
    $('#goImport').onclick = () => { tab = 'sauvegarde'; render(); };
    $$('[data-price]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.price, v = num(el.value);
      const p = g.prices[k] || {};
      if (v == null) delete p[priceField]; else p[priceField] = v;
      if (p.pv == null && p.pa == null) delete g.prices[k]; else g.prices[k] = p;
      el.classList.toggle('empty', v == null); el.value = v == null ? '' : String(v).replace('.', ',');
      save();
    }));
  }
  function coef(g, k) {
    const p = g.prices[k];
    return p && p.pa && p.pv ? (p.pv / p.pa).toFixed(2).replace('.', ',') : '—';
  }

  /* ---------- Matières & traitements ---------- */
  function tabMatieres() {
    const c = cfg();
    $('#tabBody').innerHTML = `
    <div class="card-admin"><div class="row" style="justify-content:space-between"><div><h3>Matières</h3><p class="sub">L'indice sert au conseil d'amincissement et aux règles de monture.</p></div><button class="btn" id="addM">+ Matière</button></div>
      <table class="tbl"><thead><tr><th>Afficher</th><th>Code</th><th>Nom</th><th>Indice</th><th style="width:55%">Description (fiche)</th><th></th></tr></thead>
      <tbody>${c.materials.map((m, i) => `<tr class="${m.shown === false ? 'off' : ''}"><td>${inp(`materials.${i}.shown`, 'bool')}</td><td><code>${esc(m.id)}</code></td><td>${inp(`materials.${i}.name`)}</td><td>${inp(`materials.${i}.index`, 'num', 'mini')}</td><td>${inp(`materials.${i}.desc`)}</td><td><button class="btn small danger" data-delm="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="card-admin"><div class="row" style="justify-content:space-between"><div><h3>Traitements</h3><p class="sub">« Afficher » : traitement proposé sur le podium. « Filtre lumière bleue » : proposé quand l'option est cochée en mode « Traitement ». Les matières BUC / EPS sont reconnues dans le libellé catalogue.</p></div><button class="btn" id="addT">+ Traitement</button></div>
      <table class="tbl"><thead><tr><th>Ordre</th><th>Afficher</th><th>Code</th><th>Nom affiché</th><th>Description</th><th>Filtre lumière bleue</th><th></th></tr></thead>
      <tbody>${c.treatments.map((t, i) => `<tr class="${t.shown === false ? 'off' : ''}"><td style="white-space:nowrap"><button class="btn small icon" data-tup="${i}">↑</button><button class="btn small icon" data-tdown="${i}">↓</button></td><td>${inp(`treatments.${i}.shown`, 'bool')}</td><td><code>${esc(t.id)}</code></td><td>${inp(`treatments.${i}.name`)}</td><td>${inp(`treatments.${i}.label`)}</td><td>${inp(`treatments.${i}.blue`, 'bool')}</td><td><button class="btn small danger" data-delt="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="card-admin"><h3>Teintes / photochromiques</h3><p class="sub">Les colonnes du fichier tarif (Blanc, TRS, TXTR, TXPL). « Photochromique » = proposé avec l'option Transitions.</p>
      <table class="tbl"><thead><tr><th>Code</th><th>Nom affiché</th><th>Photochromique</th><th>Supplément teinte (€ / verre)</th></tr></thead>
      <tbody>${c.tints.map((t, i) => `<tr><td><code>${esc(t.id)}</code></td><td>${inp(`tints.${i}.name`)}</td><td>${inp(`tints.${i}.photo`, 'bool')}</td><td>${t.photo ? inp(`tints.${i}.supp`, 'num', 'num') : ''}</td></tr>`).join('')}</tbody></table></div>`;
    bindAll($('#tabBody'), el => { if (/\.shown$/.test(el.dataset.bind)) tabMatieres(); });
    const add = (arr, base) => { const name = prompt('Nom :'); if (!name) return; let id = slug(name); while (arr.some(x => x.id === id)) id += '-2'; arr.push({ id, name, ...base }); save(); tabMatieres(); };
    $('#addM').onclick = () => add(c.materials, { index: 1.5, desc: '' });
    $('#addT').onclick = () => add(c.treatments, { label: '', blue: false, shown: true });
    $$('[data-delm]').forEach(b => b.onclick = () => { if (confirm('Supprimer cette matière ?')) { c.materials.splice(+b.dataset.delm, 1); save(); tabMatieres(); } });
    $$('[data-delt]').forEach(b => b.onclick = () => { if (confirm('Supprimer ce traitement ?')) { c.treatments.splice(+b.dataset.delt, 1); save(); tabMatieres(); } });
    const mv = (i, d) => { const a = c.treatments, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(); tabMatieres(); };
    $$('[data-tup]').forEach(b => b.onclick = () => mv(+b.dataset.tup, -1));
    $$('[data-tdown]').forEach(b => b.onclick = () => mv(+b.dataset.tdown, 1));
  }

  /* ---------- Options & règles ---------- */
  function tabOptions() {
    const c = cfg();
    const idxOpts = sel => [...new Set(c.materials.map(m => m.index))].sort().map(x => `<option value="${x}" ${+sel === x ? 'selected' : ''}>${x} (${c.materials.filter(m => m.index === x).map(m => m.name).join(', ')})</option>`).join('');
    $('#tabBody').innerHTML = `
    <div class="card-admin"><h3>Suppléments & affichage</h3><p class="sub">Montants TTC par verre.</p>
      <div class="form-grid">
        <label>Précal (€ / verre)${inp('supplements.precal', 'num')}</label>
        <label>Unifocal associé (équipement prog. + unif.)<select data-bind="mixedUnifGamme"><option value="">Le moins cher disponible</option>${c.gammes.filter(g => g.type === 'unif' && !g.fit).map(g => `<option value="${g.id}" ${c.mixedUnifGamme === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      </div></div>
    ${c.classA ? `<div class="card-admin"><h3>Panier A · 100 % Santé</h3>
      <p class="sub">Prix limites de vente de l'équipement complet (monture valorisée incluse). Niveau selon la sphère, colonne selon le cylindre. Une monture dont le prix est inférieur ou égal au seuil est signalée « Classe A ».</p>
      <div class="form-grid" style="margin-bottom:14px">
        <label>Verre utilisé${inp('classA.name')}</label>
        <label>Seuil monture Classe A (€)${inp('classA.frameMax', 'num')}</label>
        <label>Monture valorisée incluse (€)${inp('classA.frameIncluded', 'num')}</label>
      </div>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Niveau</th><th>Sphère jusqu'à (D)</th><th>Indice</th><th colspan="3">Unifocaux : sphérique / cyl. 0 à 4 / cyl. &gt; 4</th><th colspan="3">Progressifs : sphérique / cyl. 0 à 4 / cyl. &gt; 4</th></tr></thead>
      <tbody>${c.classA.levels.map((l, i) => `<tr><td>${inp(`classA.levels.${i}.label`)}</td><td>${inp(`classA.levels.${i}.max`, 'num', 'mini')}</td><td>${inp(`classA.levels.${i}.index`, 'num', 'mini')}</td>
        ${[0, 1, 2].map(j => `<td>${inp(`classA.unif.${i}.${j}`, 'num', 'mini')}</td>`).join('')}${[0, 1, 2].map(j => `<td>${inp(`classA.prog.${i}.${j}`, 'num', 'mini')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="card-admin"><h3>Types de monture</h3><p class="sub">Indice minimum imposé par la monture (nylor et percée : Ormix minimum).</p>
      <table class="tbl"><thead><tr><th>Nom</th><th>Matière minimum</th></tr></thead>
      <tbody>${c.frames.map((f, i) => `<tr><td>${inp(`frames.${i}.name`)}</td><td><select data-bind="frames.${i}.minIndex" data-type="num">${idxOpts(f.minIndex)}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="card-admin"><div class="row" style="justify-content:space-between"><div><h3>Table d'amincissement</h3><p class="sub">Puissance du méridien le plus fort (valeur absolue, sphère ou sphère + cylindre) → indice conseillé.</p></div><button class="btn" id="addTh">+ Palier</button></div>
      <table class="tbl"><thead><tr><th>Jusqu'à (dioptries)</th><th>Indice conseillé</th><th></th></tr></thead>
      <tbody>${c.thinning.map((r, i) => `<tr><td>${inp(`thinning.${i}.max`, 'num', 'num')}</td><td><select data-bind="thinning.${i}.index" data-type="num">${idxOpts(r.index)}</select></td><td><button class="btn small danger" data-delth="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>
    <div class="card-admin"><h3>Seuils du tableau FIT</h3><p class="sub">≤ « Erreur basse » ou ≥ « Erreur haute » : erreur de prise de mesure. Entre « Standard min » et « Standard max » : FIT inutile. Ailleurs : FIT optimal.</p>
      <table class="tbl"><thead><tr><th>Mesure</th><th>Unité</th><th>Erreur basse ≤</th><th>Standard min</th><th>Standard max</th><th>Erreur haute ≥</th><th>Valeur par défaut</th></tr></thead>
      <tbody>${c.fit.map((m, i) => m.track ? '' : `<tr><td>${inp(`fit.${i}.name`)}</td><td>${inp(`fit.${i}.unit`, 'text', 'mini')}</td>${['errLow', 'uMin', 'uMax', 'errHigh'].map(k => `<td>${inp(`fit.${i}.${k}`, 'num', 'num')}</td>`).join('')}<td>${m.default != null ? inp(`fit.${i}.default`, 'num', 'num') : ''}</td></tr>`).join('')}</tbody></table></div>`;
    bindAll($('#tabBody'));
    $('#addTh').onclick = () => { c.thinning.push({ max: 99, index: 1.74 }); save(); tabOptions(); };
    $$('[data-delth]').forEach(b => b.onclick = () => { c.thinning.splice(+b.dataset.delth, 1); save(); tabOptions(); });
  }

  /* ---------- Réseaux de soins : une page par grille ---------- */
  // Chaque grille liste les verres à proposer quand le client en dépend, et leur tarif réseau.
  // Le tarif est rattaché au code EDI de la référence (comme le fera AreaGRILLE) ; case vide : prix catalogue.
  function tabReseaux() {
    const c = cfg();
    c.networks = c.networks || [];
    if (!c.networks.some(n => n.id === netId)) netId = c.networks[0]?.id || null;
    const net = c.networks.find(n => n.id === netId);
    const ni = c.networks.indexOf(net);
    const nav = `<div class="row" style="margin-bottom:14px;gap:8px">${c.networks.map(n => `<button class="btn ${n.id === netId ? 'primary' : ''}" data-net="${esc(n.id)}">${esc(n.name)} <small style="opacity:.7" data-ncount="${esc(n.id)}">${(n.gammes || []).length}</small></button>`).join('')}<button class="btn ghost" id="netAdd">＋ Réseau</button></div>`;
    if (!net) { $('#tabBody').innerHTML = `<div class="card-admin">${nav}<p class="sub">Aucun réseau. Ajoutez-en un.</p></div>`; return bindNav(); }
    net.gammes = net.gammes || []; net.prices = net.prices || {};
    const key = (g, k) => g.prices[k]?.code || `${g.id}|${k}`;
    const nPrices = g => Object.keys(g.prices).filter(k => typeof net.prices[key(g, k)] === 'number').length;
    $('#tabBody').innerHTML = `<div class="card-admin">${nav}
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div class="row"><label class="stack" style="gap:4px"><small>Nom du réseau</small>${inp(`networks.${ni}.name`)}</label>
          <label class="row" style="gap:8px">${inp(`networks.${ni}.withCatalogue`, 'bool')}<span>Compléter avec les verres hors réseau<br><small style="color:var(--ink-3)">gammes affichées, au prix catalogue</small></span></label></div>
        <button class="btn danger" id="netDel">Supprimer ce réseau</button></div>
      <p class="sub" style="margin-top:12px">Quand ce réseau est coché à l'étape 3, le podium ne propose que les gammes cochées ci-dessous, à leur tarif réseau (les options Précal et Transitions s'y ajoutent).
        Une gamme masquée dans « Gammes » peut être proposée ici : elle n'apparaîtra qu'avec ce réseau.
        <b>Tarifs AreaGRILLE :</b> ils viendront remplir ces cases automatiquement dès que l'accès sera disponible.</p></div>
    <div class="card-admin"><h3>Verres proposés — ${esc(net.name)}</h3>
      <div class="row" style="margin:10px 0 12px">
        <input type="text" id="nq" placeholder="Rechercher une gamme…" value="${esc(nf.q)}" style="max-width:280px;text-align:left">
        <div class="seg" id="nshow"><button data-v="in" class="${nf.show === 'in' ? 'on' : ''}">Dans la grille (${net.gammes.length})</button><button data-v="all" class="${nf.show === 'all' ? 'on' : ''}">Toutes (${c.gammes.length})</button></div>
        <div class="seg" id="ntype"><button data-v="all" class="${nf.type === 'all' ? 'on' : ''}">Tous types</button><button data-v="prog" class="${nf.type === 'prog' ? 'on' : ''}">Progressifs</button><button data-v="unif" class="${nf.type === 'unif' ? 'on' : ''}">Unifocaux</button></div>
        <button class="btn small" id="nAllShown">Ajouter toutes les gammes affichées</button>
      </div>
      <div class="scroll-x" id="ntable"></div></div>
    <div class="card-admin" id="nprices"></div>`;
    const draw = () => {
      const q = nf.q.trim().toLowerCase();
      const list = c.gammes.filter(g => (nf.show === 'all' || net.gammes.includes(g.id)) && (nf.type === 'all' || g.type === nf.type) && (!q || (g.name + ' ' + (g.source || '')).toLowerCase().includes(q)))
        .sort((a, b) => (net.gammes.includes(b.id) - net.gammes.includes(a.id)) || (a.type > b.type ? -1 : a.type < b.type ? 1 : a.order - b.order));
      $('#ntable').innerHTML = list.length ? `<table class="tbl"><thead><tr><th>Proposé</th><th>Nom affiché</th><th>Libellé catalogue</th><th>Affichée hors réseau</th><th>Tarifs réseau</th><th></th></tr></thead>
        <tbody>${list.map(g => { const on = net.gammes.includes(g.id), n = nPrices(g), t = Object.keys(g.prices).length;
          return `<tr class="${on ? '' : 'off'}"><td><label class="switch"><input type="checkbox" data-ng="${g.id}" ${on ? 'checked' : ''}><span></span></label></td>
          <td>${esc(g.name)}</td><td><small>${esc(g.source || '—')}</small><br><small style="color:var(--ink-3)">${g.type === 'prog' ? 'Progressif' : 'Unifocal'}</small></td>
          <td>${g.enabled ? 'Oui' : '<small style="color:var(--ink-3)">Non : réseau uniquement</small>'}</td>
          <td>${on ? `${n} / ${t}${n ? '' : ' <small style="color:var(--ink-3)">(prix catalogue)</small>'}` : '—'}</td>
          <td>${on ? `<button class="btn small ${netGamme === g.id ? 'primary' : ''}" data-np="${g.id}">Saisir les tarifs</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`
        : '<p class="sub">Aucune gamme ne correspond.</p>';
      $$('[data-ng]').forEach(el => el.onchange = () => {
        const id = el.dataset.ng;
        net.gammes = el.checked ? [...new Set([...net.gammes, id])] : net.gammes.filter(x => x !== id);
        if (!el.checked && netGamme === id) netGamme = null;
        $$(`[data-ncount="${net.id}"]`).forEach(x => x.textContent = net.gammes.length);
        save(); draw(); prices();
      });
      $$('[data-np]').forEach(b => b.onclick = () => { netGamme = b.dataset.np; draw(); prices(); $('#nprices').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    };
    // grille de saisie : mêmes lignes que l'onglet Tarifs (matière + BUC/EPS × traitement), une colonne par teinte
    const prices = () => {
      const g = net.gammes.includes(netGamme) && c.gammes.find(x => x.id === netGamme);
      const box = $('#nprices');
      if (!g) { box.innerHTML = `<p class="sub">Choisissez « Saisir les tarifs » sur une gamme de la grille.</p>`; return; }
      const keys = Object.keys(g.prices).map(k => k.split('|'));
      const mats = [...c.materials].sort((a, b) => a.index - b.index), groups = [];
      for (const m of mats) for (const f of ['', 'buc', 'eps']) {
        const trs = c.treatments.filter(t => keys.some(k => k[0] === m.id && k[1] === f && k[2] === t.id));
        if (trs.length) groups.push({ m, f, trs });
      }
      const fname = f => f ? (c.filters?.find(x => x.id === f)?.name || f.toUpperCase()) : '';
      const cell = (m, f, t, ti) => {
        const k = `${m}|${f}|${t}|${ti}`, p = g.prices[k];
        if (!p) return '<td></td>';
        const v = net.prices[key(g, k)];
        return `<td><input type="text" inputmode="decimal" data-nk="${esc(key(g, k))}" class="${v == null ? 'empty' : ''}" value="${v == null ? '' : String(v).replace('.', ',')}" placeholder="${p.pv == null ? '—' : eur(p.pv)}" title="${esc((p.code ? 'Code EDI ' + p.code : '') + (p.pv != null ? ' · catalogue ' + eur(p.pv) + ' €' : ''))}"></td>`;
      };
      box.innerHTML = `<div class="row" style="justify-content:space-between"><h3>Tarifs ${esc(net.name)} — ${esc(g.name)}</h3><button class="btn small" id="nClear">Vider les tarifs de cette gamme</button></div>
        <p class="sub">Prix <b>par verre</b> dans le réseau. En gris : prix catalogue, utilisé tant que la case est vide. Survolez une case pour voir le code EDI.</p>
        <div class="scroll-x"><table class="tbl grid-price"><thead><tr><th>Matière</th><th>Traitement</th>${c.tints.map(t => `<th>${esc(t.name)}</th>`).join('')}</tr></thead>
        <tbody>${groups.map(({ m, f, trs }) => trs.map((t, k) => `<tr>${k === 0 ? `<td class="mat" rowspan="${trs.length}">${esc(m.name)} ${esc(fname(f))}<br><small>${m.index}</small></td>` : ''}<td>${esc(t.name)}</td>${c.tints.map(ti => cell(m.id, f, t.id, ti.id)).join('')}</tr>`).join('')).join('')}</tbody></table></div>`;
      $$('[data-nk]', box).forEach(el => el.addEventListener('change', () => {
        const v = num(el.value);
        if (v == null) delete net.prices[el.dataset.nk]; else net.prices[el.dataset.nk] = v;
        el.classList.toggle('empty', v == null); el.value = v == null ? '' : String(v).replace('.', ',');
        save(); draw();
      }));
      $('#nClear').onclick = () => {
        if (!confirm(`Vider les tarifs ${net.name} de ${g.name} ?`)) return;
        Object.keys(g.prices).forEach(k => delete net.prices[key(g, k)]); save(); draw(); prices();
      };
    };
    function bindNav() {
      $$('[data-net]').forEach(b => b.onclick = () => { netId = b.dataset.net; netGamme = null; tabReseaux(); });
      $('#netAdd').onclick = () => {
        const name = (prompt('Nom du réseau ?') || '').trim(); if (!name) return;
        let id = slug(name) || 'reseau'; while (c.networks.some(n => n.id === id)) id += '-2';
        c.networks.push({ id, name: name.toUpperCase(), gammes: [], prices: {}, withCatalogue: false });
        netId = id; save('Réseau ajouté'); tabReseaux();
      };
    }
    bindNav();
    bindAll($('#tabBody').firstElementChild, el => { if (el.dataset.bind.endsWith('.name')) tabReseaux(); });
    $('#netDel').onclick = () => { if (!confirm(`Supprimer le réseau ${net.name} et ses tarifs ?`)) return; c.networks.splice(ni, 1); netId = null; save('Réseau supprimé'); tabReseaux(); };
    $('#nq').oninput = e => { nf.q = e.target.value; draw(); };
    $$('#nshow button').forEach(b => b.onclick = () => { nf.show = b.dataset.v; tabReseaux(); });
    $$('#ntype button').forEach(b => b.onclick = () => { nf.type = b.dataset.v; tabReseaux(); });
    $('#nAllShown').onclick = () => { net.gammes = [...new Set([...net.gammes, ...c.gammes.filter(g => g.enabled).map(g => g.id)])]; save('Gammes affichées ajoutées'); tabReseaux(); };
    draw(); prices();
  }

  /* ---------- Import / sauvegarde ---------- */
  function tabSauvegarde() {
    $('#tabBody').innerHTML = `
    <div class="card-admin"><h3>Mettre à jour depuis le catalogue PA/PV</h3>
      <p class="sub">Déposez l'export « Verres_PA_PV.xlsx » (colonnes État, Code fournisseur, Code EDI, Libellé verre, Géométrie, Prix d'achat, Prix de vente). Chaque libellé est découpé en gamme / matière / BUC-EPS / Transitions / traitement. Les prix des gammes reconnues sont remplacés ; les nouvelles gammes sont créées masquées ; noms, phrases, fiches et réglages sont conservés. Les verres solaires et miroirs sont ignorés.</p>
      <div class="drop" id="drop">Glissez le fichier .xlsx ici ou <label class="link" style="cursor:pointer">choisissez-le<input type="file" id="xlsFile" accept=".xlsx,.xls" hidden></label></div>
      <div class="log" id="xlsLog"></div></div>
    <div class="card-admin"><h3>Diffuser aux magasins</h3>
      <p class="sub">Vos modifications ne sont enregistrées que dans ce navigateur : les postes « Magasin » ne les voient qu'après publication.
        1. Cliquez sur « Préparer la publication » (le fichier <b>podium-parametres.json</b> arrive dans Téléchargements).
        2. Double-cliquez sur <b>Publier le site.cmd</b> (dossier PODIUM › outils) : il récupère ce fichier et met le site à jour pour tous les postes.</p>
      <div class="row"><button class="btn primary" id="pubCfg">Préparer la publication</button></div></div>
    <div class="card-admin"><h3>Sauvegarde et partage</h3>
      <p class="sub">Les paramètres sont enregistrés dans ce navigateur. Pour les sauvegarder ou les copier sur un autre poste, exportez-les puis importez-les. « Exporter data.js » produit le fichier à déposer dans le dossier de l'application pour diffuser la configuration à tous les postes.</p>
      <div class="row"><button class="btn primary" id="expJson">Exporter (.json)</button><label class="btn">Importer (.json)<input type="file" id="impJson" accept=".json" hidden></label><button class="btn" id="expJs">Exporter data.js</button><button class="btn danger" id="resetCfg">Revenir à la configuration publiée</button></div></div>
    <div class="card-admin"><h3>Code d'accès aux paramètres</h3>
      <div class="row"><input type="password" id="newPin" placeholder="Nouveau code" style="max-width:200px" inputmode="numeric" autocomplete="new-password"><button class="btn" id="savePin">Changer le code</button></div></div>`;
    const drop = $('#drop');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => e.dataTransfer.files[0] && importXlsx(e.dataTransfer.files[0]));
    $('#xlsFile').onchange = e => e.target.files[0] && importXlsx(e.target.files[0]);
    $('#pubCfg').onclick = () => { download('podium-parametres.json', JSON.stringify(exportable(), null, 1), 'application/json'); toast('Fichier prêt : lancez « Publier le site.cmd »'); };
    $('#expJson').onclick = () => download(`podium-config-${today()}.json`, JSON.stringify(exportable(), null, 1), 'application/json');
    $('#expJs').onclick = () => download('data.js', `// Configuration Podium L4C84L exportée le ${today()}\nwindow.PODIUM_DEFAULT = ${JSON.stringify(exportable(), null, 1)};\n`, 'text/javascript');
    $('#impJson').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { const c = JSON.parse(t); if (!c.gammes || !c.materials) throw new Error('fichier non reconnu'); P.setCfg(c); toast('Configuration importée'); render(); })
        .catch(err => toast('Import impossible : ' + err.message));
    };
    $('#resetCfg').onclick = () => { if (confirm('Remplacer vos paramètres locaux par la configuration publiée (data.js) ?')) { P.setCfg(clone(window.PODIUM_DEFAULT), false); toast('Configuration réinitialisée'); render(); } };
    $('#savePin').onclick = () => { const v = pinOf($('#newPin').value); if (v.length < 4) return toast('4 caractères minimum'); cfg().pin = v; save('Code modifié'); $('#newPin').value = ''; };
  }
  const today = () => new Date().toISOString().slice(0, 10);
  function exportable() { const c = clone(cfg()); delete c.localEdit; delete c.publishedAt; c.updatedAt = today(); return c; }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('lecteur Excel indisponible (connexion internet requise)')); document.head.appendChild(s); });
  }

  async function importXlsx(file) {
    const log = $('#xlsLog'); log.textContent = 'Lecture du fichier…';
    try {
      await loadSheetJS();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const found = parseCatalog(wb);
      const ids = Object.keys(found);
      if (!ids.length) throw new Error('aucune référence reconnue (feuille « Verres » avec colonnes Libellé verre / Prix de vente attendue)');
      const c = cfg(), lines = [];
      let created = 0, changed = 0, total = 0;
      for (const id of ids) {
        const f = found[id];
        for (const [tid, lab] of Object.entries(f.trs)) if (!c.treatments.some(t => t.id === tid)) { c.treatments.push({ id: tid, name: lab, label: '', blue: false, shown: false }); lines.push(`+ traitement « ${lab} » (masqué)`); }
        let g = c.gammes.find(x => x.id === id);
        if (!g) {
          const fit = /\bFit\b/.test(f.raw), baseId = id.replace(/-fit$/, '');
          g = { id, source: f.raw, name: prettyName(f.raw), type: f.type, enabled: false, order: Math.max(0, ...c.gammes.map(x => x.order)) + 1, tagline: '', color: '#1f4ea8', fit, track: /\btrack\b/i.test(f.raw), base: fit && found[baseId] ? baseId : null, antifatigue: false, fiche: { geometrie: '', technologies: [], benefices: [], pourqui: '', image: '' }, prices: {} };
          c.gammes.push(g); created++; lines.push(`+ gamme créée (masquée) : ${g.name}`);
        }
        const old = g.prices;
        changed += Object.keys(f.prices).filter(k => old[k]?.pv !== f.prices[k].pv || old[k]?.pa !== f.prices[k].pa).length;
        total += Object.keys(f.prices).length;
        g.prices = f.prices; g.source = f.raw;
      }
      const missing = c.gammes.filter(g => !found[g.id] && Object.keys(g.prices).length);
      save('Catalogue importé');
      log.textContent = `✓ ${ids.length} gammes lues, ${total} prix (${changed} nouveaux ou modifiés), ${created} gamme(s) créée(s).\n` + lines.join('\n') +
        (missing.length ? `\n⚠ Absentes du fichier (prix conservés) : ${missing.map(g => g.name).join(', ')}` : '');
    } catch (e) { log.textContent = '✕ ' + e.message; }
  }

  // Découpe d'un libellé catalogue : « Gamme [Fit] Matière [BUC|EPS] [TRS GNS|TRS TXTR|TRS TXPL] Traitement »
  // (même logique que le script qui a généré data.js)
  const MAT_RE = /\b(Orma|Ormix|Airwear|Stylis|Lineis|Trivex)\b/;
  const TINTS = [['TRS GNS', 'trs'], ['TRS TXTR', 'txtr'], ['TRS TXPL', 'txpl'], ['TR XTRPL', 'txpl'], ['TR XTR', 'txtr']];
  const SKIP_RE = /^(Sun|XpPolar|Xppolar|Mir|Smir)|\b(Mir\w*|Smir\w*|Xperio|Xp Pola|SunXP)\b/;
  function parseLabel(label) {
    const m = MAT_RE.exec(label); if (!m) return null;
    let prefix = label.slice(0, m.index).trim(), rest = label.slice(m.index + m[1].length).trim(), filt = '', tint = 'blanc';
    const mat = m[1];
    // « Eyezen Start Orma Stock BUC … » : verre de stock = gamme à part (« Eyezen Start Stock »)
    if (rest.startsWith('Stock ')) { prefix += ' Stock'; rest = rest.slice(6); }
    const fm = /^(BUC|EPS)\b\s*/.exec(rest);
    if (fm) { filt = fm[1].toLowerCase(); rest = rest.slice(fm[0].length); }
    for (const [lab, id] of TINTS) if (rest.startsWith(lab + ' ') || rest === lab) { tint = id; rest = rest.slice(lab.length).trim(); break; }
    if (!rest || SKIP_RE.test(rest)) return null;
    return { prefix, mat, filt, tint, tr: rest };
  }
  function parseCatalog(wb) {
    const name = wb.SheetNames.find(n => /verres/i.test(n)) || wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const head = (rows[0] || []).map(h => slug(h || ''));
    const col = k => head.findIndex(h => h.startsWith(k));
    const C = { etat: col('etat'), sup: col('code-fournisseur'), code: col('code-edi'), lab: col('libelle'), geo: col('geometrie'), pa: col('prix-d-achat'), pv: col('prix-de-vente') };
    if (C.lab < 0 || C.pv < 0) return {};
    const out = {};
    for (const r of rows.slice(1)) {
      if (!r || (C.etat >= 0 && r[C.etat] !== 'Actif') || !['Progressif', 'Unifocal'].includes(r[C.geo])) continue;
      const pv = r[C.pv]; if (typeof pv !== 'number') continue;
      const p = parseLabel(String(r[C.lab] ?? '').trim()); if (!p) continue;
      let prefix = p.prefix || 'Unifocal';
      if (prefix === 'As' || prefix === '(ATO) As') prefix = prefix.replace('As', 'Unifocal asphérique');
      if (prefix === '(ATO)') prefix = '(ATO) Unifocal';
      const id = slug(prefix);
      const g = out[id] || (out[id] = { raw: prefix, type: r[C.geo] === 'Progressif' ? 'prog' : 'unif', prices: {}, trs: {} });
      const key = `${slug(p.mat)}|${p.filt}|${slug(p.tr)}|${p.tint}`;
      if (g.prices[key] && g.prices[key].pv <= pv) continue;
      const pa = r[C.pa];
      g.prices[key] = { pv, ...(typeof pa === 'number' ? { pa } : {}), code: String(r[C.code] ?? ''), lab: String(r[C.lab] ?? '').trim() }; // lab : libellé exact MyEasyOptic
      g.trs[slug(p.tr)] = p.tr;
    }
    return out;
  }
  function prettyName(raw) {
    return [[/\bCft\b/g, 'Comfort'], [/\bP exten\b/g, 'P Extensee'], [/\bXR design\b/g, 'XR Design'], [/\bS design\b/g, 'S Design'],
      [/\bPhysio 3\b(?!D)/g, 'Physio 3.0'], [/\bComfort 3\b/g, 'Comfort 3.0'], [/\bLiberty 3\b/g, 'Liberty 3.0'],
      [/ Sh\b/g, ' Short'], [/ Ac\b/g, ' Activ'], [/ Se\b/g, ' Sense'], [/ Md\b/g, ' Mid'], [/ Rm\b/g, ' Room'], [/ Nr\b/g, ' Near'], [/\btrack\b/g, 'Track']]
      .reduce((n, [a, b]) => n.replace(a, b), raw);
  }

  window.Admin = { open };
})();
