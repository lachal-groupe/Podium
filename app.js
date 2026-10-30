/* Podium L4C84L — écran opticien */
'use strict';

let LS_CFG = 'podium-l4c84l-config';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => n == null || isNaN(n) ? '—' : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => { if (v == null) return null; const s = String(v).trim().replace(',', '.').replace(/[°\s€−]/g, m => m === '−' ? '-' : ''); if (s === '' || s === '+' || s === '-') return null; const n = Number(s); return isNaN(n) ? null : n; };
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- Configuration (paramètres) ---------- */
let cfgNotice = '';
let cfg; // chargée au démarrage, une fois l'accès ouvert
function loadCfg() {
  // profil Magasin (user) : toujours la configuration publiée, jamais une copie locale
  if (PROFILE === 'user') { try { localStorage.removeItem(LS_CFG); } catch (e) {} return migrate(clone(window.PODIUM_DEFAULT)); }
  try {
    const s = localStorage.getItem(LS_CFG);
    if (s) {
      const c = JSON.parse(s);
      if (c && c.gammes && c.schema === window.PODIUM_DEFAULT.schema) return migrate(c);
      if (c && c.gammes) { localStorage.setItem(LS_CFG + '-ancienne', s); cfgNotice = 'Nouvelle version des paramètres chargée (l\'ancienne est conservée en sauvegarde).'; }
    }
  } catch (e) {}
  return migrate(clone(window.PODIUM_DEFAULT));
}
// Réseaux de soins (grilles tarifaires des complémentaires) proposés par défaut
const NETWORKS = ['CARTE BLANCHE', 'SÉVÉANE', 'KALIXIA', 'SANTÉCLAIR', 'ITELIS', 'ACTIL'];
const newNetwork = name => ({ id: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name, gammes: [], prices: {}, withCatalogue: false });
// Complète une config enregistrée avec les champs apparus depuis (mots-clés, gamme de base des versions Fit/Short)
function migrate(c) {
  if (!c.networks) c.networks = clone(window.PODIUM_DEFAULT.networks || NETWORKS.map(newNetwork));
  if (!c.netClasses) c.netClasses = clone(window.PODIUM_DEFAULT.netClasses || []);
  if (!c.stores) c.stores = clone(window.PODIUM_DEFAULT.stores || []);
  if (!c.stats) c.stats = clone(window.PODIUM_DEFAULT.stats || { url: '', token: '' });
  if (!c.noNetwork) c.noNetwork = clone(window.PODIUM_DEFAULT.noNetwork || { treatments: [], defaults: {} });
  // grilles relevées dans MyEasyOptic : un relevé plus récent remplace verres et tarifs de la copie locale
  for (const dn of window.PODIUM_DEFAULT.networks || []) {
    const n = c.networks.find(x => x.id === dn.id);
    if (!n) { c.networks.push(clone(dn)); continue; }
    if (dn.source && dn.source !== n.source) Object.assign(n, { gammes: clone(dn.gammes), prices: clone(dn.prices), source: dn.source, corrSupp: clone(dn.corrSupp || n.corrSupp || null) });
    if (!n.corrSupp) n.corrSupp = clone(dn.corrSupp || { prog: [], unif: [] });
    if (!n.treatments && dn.treatments) n.treatments = clone(dn.treatments);
    if (dn.storeDiscount && n.storeDiscount == null) n.storeDiscount = true;
    if (n.frameDiscount === undefined && dn.frameDiscount) n.frameDiscount = clone(dn.frameDiscount);
    if (dn.exclude) { n.exclude = clone(dn.exclude); n.excludeNote = dn.excludeNote; }
    if (!n.defaults && dn.defaults) n.defaults = clone(dn.defaults);
    if (dn.rulesVersion && dn.rulesVersion !== n.rulesVersion) Object.assign(n, { rules: clone(dn.rules), supp: clone(dn.supp || null), rulesVersion: dn.rulesVersion });
  }
  if (!c.optionImages) c.optionImages = clone(window.PODIUM_DEFAULT.optionImages || {});
  // nouvelle version des fiches (textes du PDF Essilor, visuels) : remplace les fiches non retouchées dans les paramètres
  const fresh = (c.ficheVersion || 1) < (window.PODIUM_DEFAULT.ficheVersion || 1);
  if (fresh) c.ficheVersion = window.PODIUM_DEFAULT.ficheVersion;
  for (const dg of window.PODIUM_DEFAULT.gammes) if (!c.gammes.some(g => g.id === dg.id)) c.gammes.push(clone(dg));
  for (const g of c.gammes) {
    const dg = window.PODIUM_DEFAULT.gammes.find(x => x.id === g.id); if (!dg) continue;
    if (g.keywords === undefined) g.keywords = dg.keywords || '';
    if (dg.fitAuto && !g.fit) g.fit = true; // gammes individualisées d'office (Varilux S2, Physio 3D)
    if (!g.base && dg.base) g.base = dg.base;
    if (g.fiche && !g.fiche.images) g.fiche.images = clone(dg.fiche?.images || []);
    for (const [k, p] of Object.entries(g.prices)) if (!p.lab && dg.prices[k]?.lab) p.lab = dg.prices[k].lab;
    if (fresh && !g.fiche?.edited) g.fiche = { ...clone(dg.fiche || {}), image: g.fiche?.image || '' };
  }
  // supplément teinte : valeur du catalogue (Gen S 56 €, XTRActive 68 €) ; remplace l'ancien forfait provisoire de 59 €
  for (const k of ['precalCode', 'prism', 'prismCode']) if (c.supplements[k] == null) c.supplements[k] = window.PODIUM_DEFAULT.supplements[k];
  for (const t of c.tints) {
    const dt = window.PODIUM_DEFAULT.tints.find(x => x.id === t.id);
    if (dt?.colors && (!t.colors || t.colors.some(c => !c.lib))) t.colors = clone(dt.colors);
    if (t.photo && (t.supp === undefined || t.supp === 59)) t.supp = dt?.supp ?? 0;
  }
  return c;
}
function saveCfg() {
  cfg.updatedAt = new Date().toISOString().slice(0, 10);
  cfg.localEdit = true;
  try { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); } catch (e) { toast('Enregistrement impossible : ' + e.message); }
}
function setCfg(c, persist = true) { cfg = c; if (persist) saveCfg(); else try { localStorage.removeItem(LS_CFG); } catch (e) {} }

/* ---------- État client ---------- */
const defaultMes = () => Object.fromEntries(cfg.fit.filter(m => m.default != null).map(m => [m.id, String(m.default)]));
const blankClient = () => ({
  step: 1, rx: { od: {}, og: {} }, mes: defaultMes(), alt: 'dvo', mixed: false,
  frame: { type: cfg.frames[0]?.id, price: null }, mode: 'auto',
  // blueMat coché par défaut : les verres BUC / EPS sont présentés ; décoché : uniquement les verres sans BUC / EPS
  opts: { precal: false, blue: false, blueMat: true, blueTr: false, ar: false, arSel: [], photo: false, tint: 'trs', color: null, antifatigue: false, boost: null, panierA: false, noFit: false },
  material: 'auto', pos: 0, selected: null, network: null,
});
let S;

/* ---------- Accès protégé (version publiée) ----------
   Version de travail (data.js en clair) : profil « local », paramètres protégés par le code.
   Site publié (data.enc.js) : les données sont chiffrées ; le mot de passe user ouvre la version sans prix d'achat,
   le mot de passe paramètres ouvre la version complète et les paramètres. */
let PROFILE = 'local';
const AUTH = 'podium-l4c84l-acces';
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = u => btoa(String.fromCharCode(...new Uint8Array(u)));
async function deriveKey(pw, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: window.PODIUM_ENC.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
}
async function openBlob(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function useData(data) {
  window.PODIUM_DEFAULT = data.cfg; PROFILE = data.profile;
  LS_CFG = 'podium-l4c84l-config-' + PROFILE; // réglages séparés par profil sur un même poste
}
// clé mémorisée (« rester connecté » : localStorage, sinon le temps de la session)
async function unlockSaved() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(AUTH) || localStorage.getItem(AUTH) || 'null'); } catch (e) {}
  if (!saved) return false;
  try {
    const key = await crypto.subtle.importKey('raw', b64d(saved.k), 'AES-GCM', false, ['decrypt']);
    useData(await openBlob(key, window.PODIUM_ENC.blobs[saved.i])); return true;
  } catch (e) { forget(); return false; } // mot de passe changé depuis : on redemande
}
function forget() { try { sessionStorage.removeItem(AUTH); localStorage.removeItem(AUTH); } catch (e) {} }
function logout() { forget(); location.hash = ''; location.reload(); }
function showLogin() {
  return new Promise(resolve => {
    const box = $('#login'); box.hidden = false;
    const pw = $('#loginPw'), msg = $('#loginMsg'), btn = $('#loginBtn');
    setTimeout(() => pw.focus(), 50);
    $('#loginForm').onsubmit = async e => {
      e.preventDefault();
      if (!pw.value) return;
      btn.disabled = true; msg.textContent = 'Vérification…'; msg.className = 'login-msg';
      for (const [i, blob] of window.PODIUM_ENC.blobs.entries()) {
        try {
          const key = await deriveKey(pw.value, b64d(blob.salt));
          const data = await openBlob(key, blob);
          const saved = JSON.stringify({ i, k: b64e(await crypto.subtle.exportKey('raw', key)) });
          try { ($('#loginKeep').checked ? localStorage : sessionStorage).setItem(AUTH, saved); } catch (err) {}
          pw.value = ''; useData(data); box.hidden = true; return resolve();
        } catch (err) { /* pas ce profil */ }
      }
      btn.disabled = false; pw.value = ''; pw.focus();
      msg.textContent = 'Mot de passe incorrect.'; msg.className = 'login-msg err';
    };
  });
}
async function ensureAccess() {
  if (window.PODIUM_DEFAULT) return; // version de travail en clair
  if (!window.PODIUM_ENC || !crypto?.subtle) { document.body.innerHTML = '<p style="padding:40px">Données introuvables ou navigateur non compatible.</p>'; throw new Error('accès'); }
  if (!(await unlockSaved())) await showLogin();
}

/* ---------- Calculs métier ---------- */
const addOf = e => num(S.rx[e].add) || 0;
// Addition sur un seul œil : équipement mixte progressif / unifocal possible
const mixedRx = () => (addOf('od') > 0) !== (addOf('og') > 0);
const progEye = () => addOf('od') > 0 ? 'od' : 'og';
const isProg = () => S.mode === 'prog' || (S.mode === 'auto' && (addOf('od') > 0 || addOf('og') > 0));
const isMixed = () => S.mode !== 'unif' && mixedRx() && S.mixed;

function strongest() {
  let best = null;
  for (const e of ['od', 'og']) {
    const sph = num(S.rx[e].sph), cyl = num(S.rx[e].cyl) || 0;
    if (sph == null && !cyl) continue;
    for (const p of [sph || 0, (sph || 0) + cyl]) if (best == null || Math.abs(p) > Math.abs(best)) best = p;
  }
  return best;
}
const frameDef = () => cfg.frames.find(f => f.id === S.frame.type) || cfg.frames[0];
function thinningIndex(p) {
  if (p == null) return null;
  const rows = [...cfg.thinning].sort((a, b) => a.max - b.max);
  return (rows.find(r => Math.abs(p) <= r.max) || rows[rows.length - 1]).index;
}
const recommendedIndex = () => Math.max(thinningIndex(strongest()) || 0, frameDef()?.minIndex || 0);
const matsSorted = () => cfg.materials.filter(m => m.shown !== false).sort((a, b) => a.index - b.index);

// Épaisseur estimée (mm) — indicatif, diamètre 65 mm
function thickness(mat, p) {
  if (p == null || p === 0) return null;
  const h = 32.5, sag = h * h * Math.abs(p) / (2000 * (mat.index - 1));
  const centre = mat.index >= 1.67 ? 1.1 : mat.index >= 1.6 ? 1.2 : mat.index >= 1.59 ? 1.3 : 2.0;
  return p < 0 ? { where: 'bord', mm: centre + sag, min: centre } : { where: 'centre', mm: 1.0 + sag, min: 1.0 };
}

// Mesures visibles : DVO ou CRO selon le choix, + les autres
const visibleMes = () => cfg.fit.filter(m => !m.alt || m.alt === S.alt);
function classify(m, v) {
  if (v == null) return null;
  if (m.track) return 'track';
  if (m.errLow == null) return null;
  if (v <= m.errLow || v >= m.errHigh) return 'err';
  if (v >= m.uMin && v <= m.uMax) return 'useless';
  return 'fit';
}
const isDefault = m => m.default != null && num(S.mes[m.id]) === m.default;
function fitVerdict() {
  const ms = visibleMes().filter(m => !m.track && num(S.mes[m.id]) != null);
  if (!ms.some(m => !isDefault(m))) return null; // seules des valeurs par défaut : pas d'avis
  const st = ms.map(m => classify(m, num(S.mes[m.id])));
  if (st.includes('err')) return 'err';
  if (st.includes('fit')) return 'fit';
  return 'useless';
}
const trackOnly = () => cfg.fit.some(m => m.track && num(S.mes[m.id]) != null);

// Clé de prix : matière | filtre (buc, eps ou vide) | traitement | teinte
function priceOf(g, mat, filt, tr, tint) {
  const k = `${mat}|${filt}|${tr}|${tint}`, p = g?.prices[k];
  if (!p) return null;
  const n = netPrice(g, k, p);
  if (n != null) return n;
  const net = curNet();
  if (net?.rules && inNet(g, net)) return null; // grille à règles : matière non autorisée pour cette correction
  return typeof p.pv === 'number' ? p.pv : null;
}
// Réseau de soins choisi à l'étape 3 : seuls les verres de sa grille sont proposés, à son tarif
// (tarif rattaché au code EDI ; à défaut de tarif saisi, prix catalogue)
const curNet = () => S.network ? (cfg.networks || []).find(n => n.id === S.network) || null : null;
const netKey = (g, k, p) => p?.code || `${g.id}|${k}`;
const inNet = (g, net = curNet()) => !!net && (net.gammes || []).includes(g.id) && !(net.exclude || []).includes(g.id);
function netPrice(g, k, p) {
  const net = curNet();
  if (!net || !inNet(g, net)) return null;
  if (net.rules) return rulePrice(net, g, k);
  const v = net.prices?.[netKey(g, k, p)];
  return typeof v === 'number' ? v + netCorrSupp(net, g.type) : null;
}
// Valeurs de chaque œil utilisées par les règles des réseaux (cylindre en convention positive, comme la saisie Podium)
//   s : |sphère| · c : |cylindre| · sc : |sphère| + |cylindre| · bcia (Carte Blanche) : sphère + cylindre + addition
//   si sphère ≥ 0, sinon sphère · sumSC / sumSCA : |S + C| et |S + C + Add| (conditions Précal Kalixia)
//   m (Santéclair, Itelis) : « S ou S + C » = méridien le plus fort, max(|S|, |S + C|)
function eyeVals() {
  return ['od', 'og'].map(e => {
    const sph = num(S.rx[e].sph) || 0, cyl = Math.abs(num(S.rx[e].cyl) || 0), add = num(S.rx[e].add) || 0;
    return { s: Math.abs(sph), c: cyl, sc: Math.abs(sph) + cyl, bcia: sph >= 0 ? sph + cyl + add : sph,
      sumSC: Math.abs(sph + cyl), sumSCA: Math.abs(sph + cyl + add), m: Math.max(Math.abs(sph), Math.abs(sph + cyl)) };
  });
}
const inRange = (v, r) => !r || (v >= r[0] - 1e-9 && v <= r[1] + 1e-9);
const ruleMatch = (w, x) => !w || Object.keys(w).every(k => inRange(x[k], w[k]));
// Matière autorisée par le réseau : indice maximum (première règle qui correspond, œil le plus favorable),
// jamais en dessous du minimum imposé par la monture ; matières toujours permises ou limitées à une plage
function netMatAllowed(R, mat, eyes) {
  const m = cfg.materials.find(x => x.id === mat);
  if (!m || (R.matAlways || []).includes(mat)) return true;
  const range = R.matRange?.[mat];
  if (range && !eyes.every(x => ruleMatch(range, x))) return false;
  const lim = Math.max(...eyes.map(x => (R.maxIndex || []).find(r => ruleMatch(r.when, x))?.index ?? Infinity), frameDef()?.minIndex || 0);
  return m.index <= lim + 1e-9;
}
// Suppléments de fabrication liés à la correction (cylindre, forte sphère…) : œil le plus cher
const netExtra = (R, eyes) => Math.max(0, ...eyes.map(x => (R.extra || []).reduce((t, e) => t + (ruleMatch(e.when, x) ? +e.supp || 0 : 0), 0)));
// Verre individualisé (Kalixia) : tarif plein si au moins une mesure saisie sort des normes, sinon décote
const fitJustified = F => Object.entries(F.norms || {}).some(([id, r]) => { const v = num(S.mes[id]); return v != null && !inRange(v, r); });
// Prix réseau selon les règles de la grille (fiches Essilor « Podium – Règles … ») :
//  - Actil (base) : relevé MyEasyOptic (sphère ≤ 2) − base de la matière relevée + base de la matière pour la classe de sphère ;
//  - autres : tarif relevé dans MyEasyOptic, identique quelle que soit la correction ;
//  + suppléments liés à la correction, − décote individualisation ; matière non autorisée : verre non proposé.
function rulePrice(net, g, k) {
  const R = net.rules, [mat, filt, tr, tint] = k.split('|'), eyes = eyeVals();
  if (!netMatAllowed(R, mat, eyes)) return null;
  let v = null;
  if (R.base) {
    const base = R.base[g.type]; if (!base) return null;
    const s = Math.max(...eyes.map(x => x.s));
    let ci = (R.sph || []).findIndex(x => s <= x); if (ci < 0) ci = (R.sph || []).length;
    const bm = base[mat]?.[ci]; if (bm == null) return null;
    for (const m0 of [mat, ...Object.keys(base).filter(x => x !== mat)]) {   // tarif relevé de la même matière, sinon d'une autre
      const k0 = `${m0}|${filt}|${tr}|${tint}`, p0 = g.prices[k0], b0 = base[m0]?.[0];
      const r = p0 && net.prices?.[netKey(g, k0, p0)];
      if (typeof r === 'number' && b0 != null) { v = r - b0 + bm; break; }
    }
  } else {
    const p = g.prices[k], r = p && net.prices?.[netKey(g, k, p)];
    if (typeof r === 'number') v = r;
  }
  if (v == null) return null;
  // Santéclair : au-dessous du seuil de la matière, tarif d'une matière inférieure (écart de la table) ou décote
  for (const c of R.cap || []) {
    if (!c.mat.includes(mat) || !eyes.every(x => ruleMatch(c.when, x))) continue;
    const t = R.matTable?.[g.type] || {};
    if (c.to && t[mat] != null && t[c.to] != null) v -= t[mat] - t[c.to];
    if (c.minus) v -= c.minus;
    break;
  }
  v += netExtra(R, eyes);
  // individualisation (Santéclair) : décote si aucun œil n'atteint la condition
  if (R.fitRule && (R.fitRule.gammes ? R.fitRule.gammes.includes(g.id) : g.fit) && !eyes.some(x => ruleMatch(R.fitRule.needs, x))) v -= R.fitRule.minus;
  if (R.fitDiscount && g.fit && !fitJustified(R.fitDiscount)) v = Math.round(v * (1 - R.fitDiscount.rate) * 100) / 100;
  return Math.round(v * storeFactor(net) * 100) / 100;
}
// Précal pris en charge par le réseau (Kalixia : seulement si |S + C| ≥ 2 ou |S + C + Add| ≥ 2 sur un œil)
function netPrecal(n) {
  const eyes = eyeVals(), P = n.supp, f = storeFactor(n);
  if (P.precal == null) return null;
  if (P.precalIf && !eyes.some(x => x.sumSC >= P.precalIf || x.sumSCA >= P.precalIf)) return 0;
  if (P.precalWhen && !eyes.some(x => ruleMatch(P.precalWhen, x))) return Math.round((P.precalElse ?? 0) * f * 100) / 100;
  return Math.round(P.precal * f * 100) / 100;
}
/* ---------- Magasin (reçu de MyEasyOptic, sinon le dernier connu sur ce poste) ---------- */
const normName = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/^\s*\d+\s*/, '').replace(/[^A-Z0-9]/g, '');
function storeCtx() {
  if (S.ctx?.magasin || S.ctx?.codeClient) return S.ctx;
  try { return JSON.parse(localStorage.getItem('podium-magasin') || 'null') || {}; } catch (e) { return {}; }
}
function storeOf() {
  const c = storeCtx(), list = cfg.stores || [];
  return list.find(s => s.codeClient && String(s.codeClient) === String(c.codeClient || ''))
    || list.find(s => c.magasin && normName(s.meo || s.name) === normName(c.magasin)) || null;
}
// remise négociée par le magasin (grilles Santéclair à 12, 14, 16 ou 18 %) : multiplie tous les montants du réseau
const storeFactor = n => n?.storeDiscount ? 1 - (+storeOf()?.discounts?.[n.id] || 0) / 100 : 1;
// Supplément de la grille selon la correction (ex. Actil) : classe témoin la plus proche de chaque œil, la plus chère retenue
function netCorrSupp(net, type) {
  const cls = cfg.netClasses || [], sup = net.corrSupp?.[type];
  if (!cls.length || !sup || !sup.some(Number)) return 0;
  let best = 0;
  for (const e of ['od', 'og']) {
    const s = Math.abs(num(S.rx[e].sph) || 0), c = Math.abs(num(S.rx[e].cyl) || 0);
    let k = 0, dist = Infinity;
    cls.forEach((x, i) => { const dd = (x.sph - s) ** 2 + (x.cyl - c) ** 2; if (dd < dist) { dist = dd; k = i; } });
    best = Math.max(best, +sup[k] || 0);
  }
  return best;
}
// gamme proposée : sans réseau, les gammes affichées ; avec réseau, celles de sa grille (+ le catalogue si la grille le prévoit)
const inScope = g => { const net = curNet(); return net ? inNet(g, net) || (!!net.withCatalogue && g.enabled) : g.enabled; };
const FILTS = ['buc', 'eps', ''];
// Variante disponible la moins chère pour une matière (parmi les filtres autorisés)
function bestFilt(g, mat, tr, tint, allowed = FILTS) {
  let best = null;
  for (const f of allowed) { const p = priceOf(g, mat, f, tr, tint); if (p != null && (best == null || p < best.p)) best = { f, p }; }
  return best;
}
const baseOf = g => g.base && cfg.gammes.find(x => x.id === g.base);
const taglineOf = g => g.tagline || baseOf(g)?.tagline || '';
const keywordsOf = g => g.keywords || baseOf(g)?.keywords || '';
const ficheOf = g => { const f = g.fiche || {}; return (f.geometrie || f.benefices?.length) ? f : (baseOf(g)?.fiche || f); };
const filtName = f => cfg.filters?.find(x => x.id === f)?.name || f.toUpperCase();
// Verre unifocal associé (équipement mixte) : gamme de référence, sinon la moins chère disponible
function unifPrice(mat, filt, tr, tint) {
  const pick = g => bestFilt(g, mat, tr, tint, [filt]) || bestFilt(g, mat, tr, tint);
  const ref = cfg.gammes.find(g => g.id === cfg.mixedUnifGamme);
  const r = ref && pick(ref);
  if (r) return { g: ref, p: r.p, f: r.f };
  let best = null;
  for (const g of cfg.gammes) {
    if (g.type !== 'unif' || g.fit || !inScope(g)) continue;
    const q = pick(g);
    if (q && (!best || q.p < best.p)) best = { g, p: q.p, f: q.f };
  }
  return best;
}

// Eyezen Boost : puissance lue dans le libellé (« Eyezen Boost 0.6 Fit » -> 0.6)
const boostOf = g => { const m = /Boost (\d+(?:\.\d+)?)/.exec(g.source || g.name); return m ? m[1] : null; };
const curBoost = () => { const l = boostLevels(); return l.includes(S.opts.boost) ? S.opts.boost : l[0]; };
const boostLevels = () => [...new Set(cfg.gammes.filter(g => inScope(g) && boostOf(g)).map(boostOf))].sort((a, b) => a - b);
const isClassAFrame = () => { const p = num(S.frame.price); return p != null && p > 0 && cfg.classA && p <= cfg.classA.frameMax; };

// Panier A (100 % Santé) : prix limite de l'équipement selon niveau (sphère) et cylindre, monture valorisée incluse.
// Chaque verre vaut (PLV - monture valorisée) / 2, calculé œil par œil.
function classAOffer() {
  const A = cfg.classA; if (!A) return null;
  const prog = isProg(), mixed = isMixed();
  const eyes = ['od', 'og'].map(e => {
    const sph = Math.abs(num(S.rx[e].sph) || 0), cyl = Math.abs(num(S.rx[e].cyl) || 0);
    let lv = A.levels.findIndex(l => sph <= l.max); if (lv < 0) lv = A.levels.length - 1;
    const col = cyl === 0 ? 0 : cyl <= 4 ? 1 : 2;
    const eyeProg = prog && (!mixed || e === progEye());
    const plv = (eyeProg ? A.prog : A.unif)[lv][col];
    return { e, lv, col, plv, prog: eyeProg, index: A.levels[lv].index, price: (plv - A.frameIncluded) / 2 };
  });
  const idx = [...new Set(eyes.map(x => x.index))];
  return {
    key: 'panier-a', classA: true, eyes, tint: 'blanc', filt: '', precal: 0,
    g: { id: 'panier-a', name: 'Panier A · 100 % Santé', type: prog ? 'prog' : 'unif', color: '#0f8a6c', fit: false, track: false,
         tagline: 'Un équipement de qualité pris en charge à 100 % : verres amincis, durcis et antireflet.' },
    mat: { name: A.name, index: idx.join(' / ') }, tr: { name: 'Antireflet HMC' },
    price: eyes[0].price, pair: eyes[0].price + eyes[1].price,
  };
}

function offers() {
  if (S.opts.panierA) { const a = classAOffer(); return a ? [a] : []; }
  const type = isProg() ? 'prog' : 'unif';
  const verdict = fitVerdict(), track = trackOnly(), mixed = isMixed();
  const rec = recommendedIndex(), minFrame = frameDef()?.minIndex || 0;
  const tint = S.opts.photo ? S.opts.tint : 'blanc';
  const precal = S.opts.precal ? (+cfg.supplements.precal || 0) : 0;
  const tintDef = cfg.tints.find(t => t.id === tint);
  const supp = precal + (tintDef?.photo ? (+tintDef.supp || 0) : 0); // Précal + teinte Transitions, inclus dans le prix du verre
  // verre au tarif d'un réseau qui a ses propres suppléments (ex. Actil : Précal 15 €, photochromique déjà dans le tarif)
  const suppOf = g => {
    const n = curNet();
    if (!n?.supp || !inNet(g, n)) return supp;
    return (S.opts.precal ? (netPrecal(n) ?? (+cfg.supplements.precal || 0)) : 0) + (tintDef?.photo ? (n.supp.tint ?? (+tintDef.supp || 0)) : 0);
  };
  // Filtre lumière bleue : « Matière » = BUC/EPS exigé (option active) ou simplement autorisé (option inactive) ;
  // « Matière + traitement » ajoute le traitement filtrant. Matière décochée : verres sans BUC/EPS.
  const allowed = !S.opts.blueMat ? [''] : S.opts.blue ? ['buc', 'eps'] : ['buc', 'eps', ''];
  const blueTr = S.opts.blue && S.opts.blueTr;
  const arSel = S.opts.ar ? S.opts.arSel : [];
  const allowedTr = optScope().treatments || [];
  const mats = matsSorted();
  const out = [];
  for (const g of cfg.gammes) {
    if (!inScope(g) || g.type !== type) continue;
    if (S.opts.antifatigue ? !g.antifatigue || (boostOf(g) && boostOf(g) !== curBoost()) : boostOf(g)) continue;
    if (track) { if (!g.track) continue; }              // CVP renseigné : uniquement des verres Track
    else if (g.track) continue;                        // un verre Track n'est proposé qu'avec un CVP
    else if (curNet()) { /* grille tarifaire : verres FIT et non FIT proposés ensemble, mesures non prises en compte */ }
    else if (verdict === 'fit' && !S.opts.noFit && !g.fit) continue; // FIT recommandé : uniquement des verres FIT
    else if ((verdict === 'useless' || (verdict === 'fit' && S.opts.noFit)) && g.fit) continue; // standard, ou « Non FIT » : pas de FIT
    for (const tr of cfg.treatments) {
      if (tr.shown === false) continue;
      if (arSel.length && !arSel.includes(tr.id)) continue;
      if (allowedTr.length && !allowedTr.includes(tr.id)) continue; // traitements retenus pour ce réseau
      if (blueTr && !tr.blue) continue;
      let mat = null, v = null;
      for (const m of mats) {
        if (m.index < minFrame || (S.material === 'auto' ? m.index < rec : m.id !== S.material)) continue;
        v = bestFilt(g, m.id, tr.id, tint, allowed); // à prix égal, la version BUC/EPS est présentée
        if (v) { mat = m; break; }
      }
      if (!mat) continue;
      const filt = v.f;
      const pk = `${mat.id}|${filt}|${tr.id}|${tint}`;
      const o = { key: `${g.id}|${pk}`, g, mat, filt, tr, tint, precal, price: v.p + suppOf(g), net: netPrice(g, pk, g.prices[pk]) != null };
      if (mixed) { const u = unifPrice(mat.id, filt, tr.id, tint); o.unif = u ? { g: u.g, price: u.p + suppOf(u.g), key: `${mat.id}|${u.f}|${tr.id}|${tint}` } : null; }
      o.pair = mixed ? (o.unif ? o.price + o.unif.price : null) : o.price * 2;
      out.push(o);
    }
  }
  out.sort((a, b) => a.price - b.price || a.g.order - b.g.order);
  return out;
}

/* ---------- Formatage ---------- */
// Transposition en cylindre positif : sphère + cylindre, cylindre inversé, axe tourné de 90°.
// Ex. +2,00 (−0,50) 112° → +1,50 (+0,50) 22°. Faite dès que cylindre (négatif) et axe sont saisis.
function transpose(e) {
  const r = S.rx[e], cyl = num(r.cyl), axe = num(r.axe);
  if (cyl == null || cyl >= 0 || axe == null) return false;
  const ax = Math.round(axe) % 180;
  r.sph = String(Math.round(((num(r.sph) || 0) + cyl) * 100) / 100);
  r.cyl = String(-cyl);
  r.axe = String(ax <= 90 ? ax + 90 : ax - 90);
  for (const f of ['sph', 'cyl', 'axe']) $(`[data-rx="${e}.${f}"]`).value = fmtRx(f, r[f]);
  $$(`[data-rx^="${e}."]`).forEach(i => { i.classList.remove('flash'); void i.offsetWidth; i.classList.add('flash'); });
  return true;
}

// Bornes de saisie : pas de 0,25 ; sphère ±25 ; cylindre ±6 ; addition de 0 à +4 ; axe entier de 0 à 180
function rxError(field, v) {
  const n = num(v); if (n == null) return null;
  const step = Math.abs(n * 4 - Math.round(n * 4)) > 1e-6;
  if (field === 'axe') return !Number.isInteger(n) || n < 0 || n > 180 ? "L'axe va de 0 à 180°" : null;
  if (field === 'sph') return Math.abs(n) > 25 ? 'La sphère va de −25,00 à +25,00' : step ? 'La sphère se saisit par pas de 0,25' : null;
  if (field === 'cyl') return Math.abs(n) > 6 ? 'Le cylindre va de −6,00 à +6,00' : step ? 'Le cylindre se saisit par pas de 0,25' : null;
  if (field === 'prism') return n < 0.5 || n > 12 ? 'Le prisme va de 0,50 à 12,00' : step ? 'Le prisme se saisit par pas de 0,25' : null;
  if (field === 'base') return !Number.isInteger(n) || n < 1 || n > 360 ? 'La base du prisme va de 1 à 360°' : null;
  if (field === 'add') return n < 0 ? "L'addition est toujours positive" : n > 4 ? "L'addition ne dépasse pas +4,00" : step ? "L'addition se saisit par pas de 0,25" : null;
  return null;
}
// Vérifie un champ : une valeur hors bornes reste affichée en rouge mais n'est pas prise en compte
function checkRx(inp) {
  const [e, f] = inp.dataset.rx.split('.'), err = rxError(f, inp.value);
  inp.classList.toggle('invalid', !!err);
  inp.title = err || '';
  if (err) S.rx[e][f] = '';
  return err;
}
function rxErrors() { return $$('[data-rx]').map(i => i.title && i.classList.contains('invalid') ? `${eyeName(i.dataset.rx.split('.')[0])} : ${i.title}` : null).filter(Boolean); }

function fmtRx(field, v) {
  const n = num(v);
  if (n == null) return '';
  if (field === 'axe' || field === 'base') return Math.round(n) + '°';
  if (field === 'prism') return Math.abs(n).toFixed(2).replace('.', ',');
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2).replace('.', ',');
}
const eyeName = e => e === 'od' ? 'OD' : 'OG';

/* ---------- Étape 1 : saisie ---------- */
function buildMesures() {
  $$('#altSeg button').forEach(b => b.classList.toggle('on', b.dataset.alt === S.alt));
  $('#mesGrid').innerHTML = visibleMes().map(m => `<div class="mfield">
    <span class="mlabel">${esc(m.name)}${m.unit ? ` (${esc(m.unit)})` : ''}</span>
    <input data-mes="${m.id}" inputmode="decimal" placeholder="—" value="${esc(S.mes[m.id] ?? '')}">
    <span class="mstate" data-state="${m.id}">—</span></div>`).join('');
}
function buildNetSeg() {
  $('#netSeg').innerHTML = (cfg.networks || []).map(n => `<button type="button" data-net="${esc(n.id)}" aria-pressed="false">${esc(n.name)}</button>`).join('');
  if (S.network && !curNet()) S.network = null;
}
// Réseau coché alors que le dossier MyEasyOptic n'a pas de mutuelle (« Rbt RC » affiché)
const noMutuelle = () => !!(curNet() && S.ctx?.sansMutuelle);
// Remise imposée par le réseau sur la monture (Panier A : aucune)
function frameNet() {
  const gross = num(S.frame.price), net = curNet();
  if (gross == null || !net || S.opts.panierA || isClassAFrame()) return { gross, price: gross, rate: 0, remise: 0 }; // Panier A, monture Classe A : pas de remise
  const r = (net.frameDiscount || []).find(x => gross >= (+x.min || 0) && (x.max == null || x.max === '' || gross <= +x.max));
  const rate = +r?.rate || 0, remise = Math.round(gross * rate) / 100;
  return { gross, rate, remise, price: Math.round((gross - remise) * 100) / 100 };
}
function renderNet() {
  $$('#netSeg button').forEach(b => { const on = b.dataset.net === S.network; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const net = curNet(), n = net ? cfg.gammes.filter(g => inNet(g, net)).length : 0;
  const st = storeOf(), rem = net?.storeDiscount ? +st?.discounts?.[net.id] || 0 : null;
  const remTxt = rem == null ? '' : st ? ` · remise ${st.name} : ${rem} %` : ' · magasin non identifié : tarif sans remise';
  $('#netNote').textContent = (!net ? 'Aucun réseau : tarifs catalogue' : n ? `Grille ${net.name} : ${n} gamme${n > 1 ? 's' : ''} au tarif réseau${net.withCatalogue ? ', complétée par le catalogue' : ''}`
    : `Aucun verre configuré pour ${net.name} (Paramètres › Réseaux)${net.withCatalogue ? ' : tarifs catalogue' : ''}`) + remTxt;
  $('#netWarn').hidden = !noMutuelle();
}
function buildFrameSeg() {
  $('#frameSeg').innerHTML = cfg.frames.map(f => `<button data-frame="${f.id}">${esc(f.name)}</button>`).join('');
}

function renderEntry() {
  const labels = { fit: 'FIT', useless: 'Standard', err: 'À vérifier', track: 'Track' };
  for (const m of visibleMes()) {
    const st = isDefault(m) ? null : classify(m, num(S.mes[m.id]));
    const inp = $(`[data-mes="${m.id}"]`), pill = $(`[data-state="${m.id}"]`);
    if (!inp) continue;
    inp.className = st || '';
    pill.className = 'mstate ' + (st || '');
    pill.textContent = st ? labels[st] : isDefault(m) ? 'Par défaut' : '—';
  }
  const v = fitVerdict(), vEl = $('#fitVerdict');
  const msg = {
    fit: '<span class="ico">✓</span> Personnalisation FIT recommandée : seuls les verres FIT seront proposés',
    useless: '<span class="ico">=</span> Mesures standard : la personnalisation FIT n\'apporte rien',
    err: '<span class="ico">!</span> Valeur hors limites : vérifier la prise de mesure',
  }[v] || '<span class="ico">ⓘ</span> Renseignez la DVO ou les CRO pour évaluer l\'intérêt d\'un verre FIT';
  vEl.className = 'verdict ' + (trackOnly() ? 'track' : v || '');
  vEl.innerHTML = trackOnly() ? '<span class="ico">◎</span> CVP renseigné : seuls les verres Track seront proposés' : msg;

  // Équipement mixte
  const mixed = mixedRx() && S.mode !== 'unif';
  $('#mixedBox').hidden = !mixed;
  if (!mixed) S.mixed = false;
  $('#mixedChk').checked = S.mixed;
  $('#mixedBox').classList.toggle('on', S.mixed);
  if (mixed) $('#mixedTxt').innerHTML = `Addition sur l'${progEye() === 'od' ? 'œil droit' : 'œil gauche'} uniquement. <b>Confirmer équipement progressif ${eyeName(progEye())} / unifocal ${eyeName(progEye() === 'od' ? 'og' : 'od')} ?</b>`;

  const p = strongest(), recMat = matsSorted().find(m => m.index >= recommendedIndex());
  const info = [`<span class="pill brand">${isMixed() ? 'Progressif + unifocal' : isProg() ? 'Progressif' : 'Unifocal'}${S.mode === 'auto' ? ' · auto' : ''}</span>`];
  if (p != null) info.push(`<span class="pill">Méridien max ${fmtRx('sph', p)}</span>`);
  if (recMat && p != null) info.push(`<span class="pill">Conseil : ${esc(recMat.name)} ${recMat.index}</span>`);
  $('#rxInfo').innerHTML = rxErrors().map(m => `<span class="pill err">⚠ ${esc(m)}</span>`).join('') + info.join('');

  const f = frameDef();
  $$('#frameSeg button').forEach(b => b.classList.toggle('on', b.dataset.frame === S.frame.type));
  renderNet();
  const minMat = matsSorted().find(m => m.index >= (f?.minIndex || 0));
  const fnet = frameNet();
  $('#frameNote').innerHTML = (fnet.rate ? `Remise ${esc(curNet().name)} imposée : <b>−${fnet.rate} %</b>, soit ${eur(fnet.price)} €. ` : '') + (isClassAFrame() ? '<b class="classA">Classe A</b> ' : '') + (f && f.minIndex > 1.5 && minMat ? `Monture ${esc(f.name.toLowerCase())} : <b>${esc(minMat.name)}</b> minimum.` : '');
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
}

/* ---------- Étape 2 : récap compact ---------- */
function renderRecap() {
  const eye = e => {
    const r = S.rx[e];
    const parts = [fmtRx('sph', r.sph) || '0,00'];
    if (num(r.cyl)) parts.push(`(${fmtRx('cyl', r.cyl)}) ${fmtRx('axe', r.axe) || '0°'}`);
    if (addOf(e) > 0) parts.push(`Add ${fmtRx('add', r.add)}`);
    if (num(r.prism)) parts.push(`Prisme ${fmtRx('prism', r.prism)} base ${fmtRx('base', r.base) || '—'}`);
    return `<span><i>${eyeName(e)}</i>${parts.join(' ')}</span>`;
  };
  const mes = visibleMes().filter(m => num(S.mes[m.id]) != null && !isDefault(m)).map(m => `${esc(m.name)} ${String(S.mes[m.id]).replace('.', ',')}`);
  const v = trackOnly() ? 'Track (CVP)' : fitVerdict() === 'fit' && S.opts.noFit ? 'FIT recommandé · non retenu'
    : { fit: 'FIT recommandé', useless: 'FIT inutile', err: 'Mesure à vérifier' }[fitVerdict()];
  const frame = num(S.frame.price);
  $('#recap').innerHTML = `
    <div class="blk"><small>Correction</small>${eye('od')}${eye('og')}</div>
    <div class="blk"><small>Mesures${v ? ' · ' + v : ''}</small><span>${mes.join(' · ') || '—'}</span></div>
    <div class="blk"><small>Monture</small><span>${esc(frameDef()?.name || '')}${frame != null ? ' · ' + eur(frame) + ' €' : ''}${frameNet().rate ? ` (−${frameNet().rate} % : ${eur(frameNet().price)} €)` : ''}${isClassAFrame() ? ' <b class="classA">Classe A</b>' : ''}</span></div>
    ${curNet() ? `<div class="blk"><small>Réseau</small><span>${esc(curNet().name)}${curNet().storeDiscount && storeOf() ? ` · −${+storeOf().discounts?.[curNet().id] || 0} %` : ''}</span></div>` : ''}
    ${storeOf() || S.ctx?.client ? `<div class="blk"><small>Magasin${S.ctx?.client ? ' · client' : ''}</small><span>${esc(storeOf()?.name || storeCtx().magasin || '—')}${S.ctx?.client ? ' · ' + esc(S.ctx.client) : ''}</span></div>` : ''}
    ${isMixed() ? `<div class="blk"><small>Équipement</small><span>Progressif ${eyeName(progEye())} + unifocal</span></div>` : ''}
    ${noMutuelle() ? '<div class="blk warn">⚠ Sélectionnez la mutuelle dans MyEasyOptic : tarif réseau non garanti</div>' : ''}
    <div class="blk edit">✎ Modifier</div>`;
}

/* ---------- Étape 2 : options ---------- */
// Prix du Précal affiché : celui du réseau coché (avec ses conditions), sinon celui du catalogue
function precalLabel() {
  const n = curNet(), base = +cfg.supplements.precal || 0;
  const v = n?.supp?.precal != null ? netPrecal(n) : base;
  if (n?.supp?.precal != null && !v) return `Non pris en charge par ${esc(n.name)} pour cette correction`;
  return `+${eur(v)} € / verre${n?.supp?.precal != null ? ' · tarif ' + esc(n.name) : ''}`;
}
function renderFilters() {
  const photoTints = cfg.tints.filter(t => t.photo);
  const allowedTr = optScope().treatments || [];
  const shownTr = cfg.treatments.filter(t => t.shown !== false && (!allowedTr.length || allowedTr.includes(t.id)));
  // Panier A : les autres options ne s'appliquent pas, elles sont grisées
  const tog = (id, label, sub, extra = '') => `<div class="tog ${S.opts[id] ? 'on' : ''} ${S.opts.panierA && id !== 'panierA' ? 'locked' : ''}" data-opt="${id}" role="switch" aria-checked="${!!S.opts[id]}" tabindex="0"><span class="sw"></span><span>${label}${sub ? `<br><small>${sub}</small>` : ''}</span>${extra}</div>`;
  const chk = (id, label, dis) => `<label class="mini-chk ${dis ? 'dis' : ''}"><input type="checkbox" data-chk="${id}" ${S.opts[id] ? 'checked' : ''} ${dis ? 'disabled' : ''}> ${label}</label>`;
  const arSel = S.opts.arSel.filter(id => shownTr.some(t => t.id === id));
  const arLabel = !arSel.length ? 'Tous les traitements' : arSel.length === 1 ? shownTr.find(t => t.id === arSel[0]).name : `${arSel.length} traitements`;
  $('#optToggles').innerHTML =
    tog('precal', 'Précal', precalLabel()) +
    tog('blue', 'Filtre lumière bleue', '', `<span class="sub-opts">${chk('blueMat', 'Matière')}${chk('blueTr', 'Matière + traitement', !S.opts.blue)}</span>`) +
    tog('ar', 'Anti-reflets', '', S.opts.ar
      ? `<span class="dd"><button type="button" class="dd-btn" id="arBtn">${esc(arLabel)} ▾</button>${arOpen ? `<span class="dd-pop">${shownTr.map(t => `<label><input type="checkbox" data-ar="${t.id}" ${arSel.includes(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}<button type="button" class="link" id="arAll">Tout afficher</button></span>` : ''}</span>`
      : '<small>Choisir les traitements</small>') +
    tog('photo', 'Transitions', '', S.opts.photo ? `<span class="sub-opts"><select id="tintSel">${photoTints.map(t => `<option value="${t.id}" ${t.id === S.opts.tint ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>${tintColors().length ? `<select id="colorSel">${tintColors().map(c => `<option ${c.name === curColor()?.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}</span>` : '<small>Verres photochromiques</small>') +
    tog('antifatigue', 'Anti-fatigue', '', S.opts.antifatigue
      ? `<select id="boostSel">${boostLevels().map(b => `<option value="${b}" ${b === curBoost() ? 'selected' : ''}>Boost ${b.replace('.', ',')}</option>`).join('')}</select>`
      : '<small>Eyezen Boost</small>') +
    tog('panierA', 'Panier A', '100 % Santé') +
    // FIT recommandé : l'opticien peut sortir de la préconisation et proposer des verres standard
    (fitVerdict() === 'fit' && !trackOnly() && !curNet() ? tog('noFit', 'Non FIT', 'Ignorer la préconisation FIT') : '') +
    // en réseau, la recommandation FIT est seulement indiquée
    (fitVerdict() === 'fit' && !trackOnly() && curNet() ? '<span class="pill brand fit-reco">✓ Verres FIT recommandés</span>' : '');
  renderLenses();
}
let arOpen = false;

// Choix de la matière : profils de verres convexes (correction positive) ou concaves (négative)
function renderLenses() {
  const p = strongest(), rec = recommendedIndex(), minFrame = frameDef()?.minIndex || 0;
  const recMat = matsSorted().find(m => m.index >= rec);
  const plus = p != null && p > 0;
  const rows = matsSorted().map(m => ({ m, t: thickness(m, p) }));
  const maxmm = Math.max(...rows.map(r => r.t?.mm || 0), 4);
  const sel = S.material === 'auto' ? recMat?.id : S.material;
  const lens = t => {
    // épaisseurs en px : max (centre si +, bord si −) et min
    const k = 30 / maxmm, big = t ? Math.max(3, t.mm * k) : 4, small = t ? Math.max(2, t.min * k) : 4;
    const tc = plus ? big : small, te = plus ? small : big;
    const xe = 60, top = 4, bot = 156, mid = 80, bb = 18; // bb : flèche de la face arrière
    const backC = xe - 2 * bb, frontE = xe - te, frontMid = xe - bb - tc, frontC = 2 * frontMid - frontE;
    return `<svg viewBox="0 0 70 160" aria-hidden="true"><path d="M${xe} ${top} Q${backC} ${mid} ${xe} ${bot} L${frontE} ${bot} Q${frontC} ${mid} ${frontE} ${top} Z"/></svg>`;
  };
  $('#lensPanel').classList.toggle('locked', !!S.opts.panierA); // Panier A : l'indice dépend du niveau
  $('#lensPanel').innerHTML = `
    <div class="lens-h"><b>Matière</b><small>${p == null ? 'Saisissez la correction' : plus ? 'Correction positive · épaisseur au centre' : 'Correction négative · épaisseur au bord'}</small>
      <button class="link" id="matInfo">Amincissement ?</button></div>
    <div class="lens-row">${rows.map(({ m, t }) => {
      const dis = m.index < minFrame;
      const w = dis ? [] : matWarnings(m);
      return `<button class="lens ${sel === m.id ? 'on' : ''} ${dis ? 'dis' : ''}" data-mat="${m.id}" ${dis ? 'disabled title="Non compatible avec ce type de monture"' : w.length ? `title="${esc('Attention : ' + w.join(' · '))}"` : ''}>
        ${w.length ? '<i class="warn-i" aria-hidden="true">⚠</i>' : ''}${lens(t)}<span class="ln">${esc(m.name)}${recMat?.id === m.id ? ' <i class="star">★</i>' : ''}</span>
</button>`;
    }).join('')}</div>
    ${(() => { const m = cfg.materials.find(x => x.id === sel), w = m ? matWarnings(m) : []; return w.length ? `<div class="mat-warn">⚠ <b>${esc(m.name)}</b> : ${w.map(esc).join(' · ')}</div>` : ''; })()}
    <div class="lens-f">${S.material === 'auto' ? '<span class="pill brand">★ Conseillée automatiquement</span>' : '<button class="link" id="matAuto">↺ Revenir à la matière conseillée</button>'}</div>`;
}

/* ---------- Étape 2 : podium ---------- */
let current = [];
// Avertissements d'amincissement en réseau : matière non autorisée par la grille, plus forte que ce que demandent
// la correction et la monture (plus d'un cran au-dessus de la matière conseillée), ou non valorisée (même tarif)
function matWarnings(m) {
  const net = curNet();
  if (!net || S.opts.panierA || !m) return [];
  const w = [], rec = matsSorted().find(x => x.index >= recommendedIndex());
  if (net.rules && !netMatAllowed(net.rules, m.id, eyeVals())) w.push(`non autorisée par la grille ${net.name} pour cette correction`);
  if (rec && m.index - rec.index > 0.1 + 1e-9) w.push(`plus forte que nécessaire pour la correction et la monture (conseil : ${rec.name})`);
  const o = current[0];
  if (o && !o.classA && rec && m.index > rec.index) {
    const pm = bestFilt(o.g, m.id, o.tr.id, o.tint, [o.filt])?.p, pr = bestFilt(o.g, rec.id, o.tr.id, o.tint, [o.filt])?.p;
    if (pm != null && pr != null && pm <= pr + 0.001) w.push(`non valorisée par la grille : même tarif qu'en ${rec.name}`);
  }
  return w;
}
const perView = () => { const w = $('#viewport').clientWidth; return w < 540 ? 1 : w < 740 ? 2 : w < 940 ? 3 : 4; };

function cardHTML(o, i) {
  const v = fitVerdict();
  const tint = cfg.tints.find(t => t.id === o.tint);
  // toutes les options actives du verre, lisibles par le client
  const feats = [];
  if (o.classA) feats.push('100 % Santé');
  if (o.net) feats.push(`Tarif ${curNet().name}`);
  if (o.g.track) feats.push('Track');
  if (o.g.fit) feats.push(v === 'fit' ? 'FIT recommandé' : 'Personnalisé FIT');
  if (o.g.antifatigue) feats.push(`Anti-fatigue${boostOf(o.g) ? ' ' + boostOf(o.g).replace('.', ',') : ''}`);
  if (tint?.photo) feats.push('Photochromique');
  if (o.classA || o.tr.id !== 'supra') feats.push('Anti-reflet');
  if (o.filt || o.tr.blue) feats.push('Protection LB+UV');
  const rank = matsSorted().findIndex(m => m.id === o.mat.id) + 1; // Orma 1, Airwear 2, Ormix 3…
  if (!o.classA && rank > 1) feats.push(`Aminci ${rank}°`);
  if (o.precal) feats.push('Précalibré');
  const c = o.g.color || '#1d4fd7';
  const sel = S.selected === o.key;
  const other = eyeName(progEye() === 'od' ? 'og' : 'od');
  return `<div class="slot"><article class="card ${sel ? 'sel' : ''}" data-key="${esc(o.key)}" style="animation-delay:${Math.min(i, 6) * 40}ms">
    <div class="card-h" title="Sélectionner ce verre" style="background:linear-gradient(135deg,${c},${shade(c, -35)})">
      <div class="type">${o.g.type === 'prog' ? 'Progressif' : 'Unifocal'}</div>
      <h3>${esc(o.g.name)}</h3>
      <div class="check">${sel ? '✓' : ''}</div>
    </div>
    <div class="card-b">
      <div class="kw">${esc(keywordsOf(o.g))}</div>
      <p class="tagline">${esc(taglineOf(o.g))}</p>
      <div class="feats">${feats.map(f => `<span class="feat">✓ ${esc(f)}</span>`).join('')}</div>
      <div class="spec">
        <div class="m">${esc(o.mat.name)} ${o.classA ? 'indice ' : ''}${o.mat.index}</div>
        <div class="t">${esc(o.tr.name)}</div>
        ${tint?.photo ? `<div class="tn">${esc(tint.name)}${curColor() ? ' · ' + esc(curColor().name) : ''}</div>` : ''}
      </div>
      <button class="link more" data-more="${esc(o.key)}">En savoir plus →</button>
    </div>
    <div class="card-f">
      ${o.unif !== undefined ? `<div class="mixinfo">${o.unif ? `+ unifocal ${other} (${esc(o.unif.g.name)}) : <b>${eur(o.unif.price)} €</b>` : `Unifocal ${other} non tarifé dans cette matière`}</div>` : ''}
      ${o.classA && o.eyes[0].price !== o.eyes[1].price ? `<div class="mixinfo" style="background:var(--fit-soft);color:#13845b">OD ${eur(o.eyes[0].price)} € · OG ${eur(o.eyes[1].price)} €</div>` : ''}
      <div class="price"><b>${eur(o.price)}</b><span>€ le verre</span></div>
    </div>
  </article><div class="step"></div></div>`;
}

function renderPodium() {
  current = offers();
  if (S.selected && !current.some(o => o.key === S.selected)) S.selected = null;
  const track = $('#track');
  $('#podiumTitle').textContent = isMixed() ? 'Équipement progressif + unifocal' : isProg() ? 'Verres progressifs' : 'Verres unifocaux';
  $('#podiumCount').textContent = current.length ? `${current.length} proposition${current.length > 1 ? 's' : ''} · du plus abordable au plus premium` : '';
  if (!current.length) {
    const why = trackOnly() ? (cfg.gammes.some(g => g.enabled && g.track) ? 'Seuls les verres Track sont proposés (CVP renseigné).' : 'CVP renseigné, mais aucune gamme Track n\'est active dans les paramètres.') : fitVerdict() === 'fit' && !S.opts.noFit ? 'Seuls les verres FIT sont proposés (FIT recommandé ; option « Non FIT » pour les verres standard).' : '';
    track.innerHTML = `<div class="empty" style="flex:1"><b>Aucun verre ne correspond</b>${why} Assouplissez les filtres (traitement, matière, lumière bleue, anti-fatigue…) ou activez/tarifez des gammes dans les paramètres.</div>`;
    track.style.transform = ''; $('#dots').innerHTML = ''; $('#prev').disabled = $('#next').disabled = true;
    renderSummary(); return;
  }
  track.innerHTML = current.map(cardHTML).join('');
  layoutCarousel();
  renderSummary();
}

function layoutCarousel() {
  const per = perView(), track = $('#track');
  const max = Math.max(0, current.length - per);
  S.pos = Math.min(Math.max(0, S.pos), max);
  track.style.transform = `translateX(${-S.pos * 100 / per}%)`;
  $$('.slot', track).forEach((s, i) => {
    s.style.flexBasis = `${100 / per}%`;
    const r = i - S.pos, on = r >= 0 && r < per;
    s.style.setProperty('--lift', on ? r / Math.max(1, Math.min(per, current.length) - 1) : r < 0 ? 0 : 1);
    s.classList.toggle('top', on && r === Math.min(per, current.length) - 1 && current.length > 1);
  });
  $('#prev').disabled = S.pos <= 0;
  $('#next').disabled = S.pos >= max;
  const pages = Math.ceil(current.length / per), page = S.pos >= max ? pages - 1 : Math.floor(S.pos / per);
  $('#dots').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('') : '';
}
function move(d) { S.pos += d; layoutCarousel(); }

function renderSummary() {
  const o = current.find(x => x.key === S.selected);
  const fn = frameNet(), frame = fn.price;
  const prisms = o && !o.classA ? prismEyes() : [];
  const prismCost = prisms.length * (o?.net && curNet()?.supp?.prism != null ? Math.round(+curNet().supp.prism * storeFactor(curNet()) * 100) / 100 : (+cfg.supplements.prism || 0));
  const lenses = o ? o.pair + prismCost : null;
  const total = (frame || 0) + (lenses || 0);
  const tint = o && cfg.tints.find(t => t.id === o.tint);
  const pe = eyeName(progEye()), ue = eyeName(progEye() === 'od' ? 'og' : 'od');
  const lensLabel = !o ? '2 verres' : o.classA ? `Verres OD ${eur(o.eyes[0].price)} € + OG ${eur(o.eyes[1].price)} €` : o.unif !== undefined
    ? `Progressif ${pe} ${eur(o.price)} € + unifocal ${ue} ${o.unif ? eur(o.unif.price) + ' €' : '—'}`
    : `2 verres (2 × ${eur(o.price)} €)`;
  const lensLabelFull = lensLabel + (prismCost ? ` + prisme ${prisms.map(eyeName).join('/')} ${eur(prismCost)} €` : '');
  $('#summary').innerHTML = `
    <div class="sel-name"><small>Équipement</small>${o
      ? `<b>${esc(o.g.name)}${o.unif ? ' + ' + esc(o.unif.g.name) : ''}</b><em>${esc(o.mat.name)} ${o.mat.index}${o.filt ? ' ' + esc(filtName(o.filt)) : ''} · ${esc(o.tr.name)}${tint?.photo ? ' · ' + esc(tint.name) + (curColor() ? ' ' + esc(curColor().name) : '') : ''}${o.precal ? ' · Précal' : ''}</em>`
      : '<b>Sélectionnez un verre</b><em>Cliquez sur une vignette du podium</em>'}</div>
    <div class="amt"><small>Monture ${esc(frameDef()?.name || '')}${isClassAFrame() ? ' · Classe A' : ''}${fn.rate ? ` · ${eur(fn.gross)} € − ${fn.rate} % ${esc(curNet().name)}` : ''}</small><b>${frame != null ? eur(frame) + ' €' : '—'}</b></div>
    <span class="op">+</span>
    <div class="amt"><small>${lensLabelFull}</small><b>${lenses != null ? eur(lenses) + ' €' : '—'}</b></div>
    <span class="op">=</span>
    ${o && meo && !meo.closed ? '<button class="btn send-meo" id="sendMeo" title="Coller le libellé des verres dans le devis MyEasyOptic">Envoyer dans<br>MyEasyOptic →</button>' : ''}
    <div class="amt total"><small>Total</small><b>${frame != null || lenses != null ? eur(total) + ' €' : '—'}</b></div>`;
}

/* ---------- Pont MyEasyOptic ----------
   Le bouton « → Podium » (pont-meo.js, barre de favoris) envoie la correction et le prix monture du devis ouvert ;
   « Envoyer dans MyEasyOptic » renvoie le libellé exact des verres choisis. Échange direct entre onglets, sans serveur. */
const MEO_ORIGIN = 'https://hds.myeasyoptic.com';
let meo = null, meoLast = null;
window.addEventListener('message', e => {
  if (e.origin === MEO_ORIGIN && e.data?.type === 'podium-mutuelle' && S?.ctx) {
    if (S.ctx.sansMutuelle === e.data.sansMutuelle && S.ctx.mutuelle === e.data.mutuelle) return;
    Object.assign(S.ctx, { sansMutuelle: e.data.sansMutuelle, mutuelle: e.data.mutuelle });
    if (S.step === 1) renderNet(); else renderRecap();
    return;
  }
  if (e.origin !== MEO_ORIGIN || e.data?.type !== 'podium-client' || !cfg) return; // pas encore connecté : le pont réessaie
  meo = e.source;
  meo.postMessage({ type: 'podium-ack', id: e.data.id }, MEO_ORIGIN);
  if (meoLast === e.data.id) return;
  meoLast = e.data.id;
  fromMeo(e.data);
});
// Version minimale de l'extension MyEasyOptic : une ancienne version est signalée sur le poste
const EXT_MIN = '1.12.0';
const verNum = v => String(v || '0').split('.').reduce((t, x) => t * 1000 + (+x || 0), 0);
function checkExtension(v) {
  if (verNum(v) >= verNum(EXT_MIN)) return;
  const b = $('#updateBanner');
  b.hidden = false;
  b.textContent = `⚠ Extension MyEasyOptic à mettre à jour sur ce poste : version ${v || 'ancienne'} installée, ${EXT_MIN} attendue (page d'installation : pont.html).`;
}
function fromMeo(d) {
  checkExtension(d.ctx?.version);
  resetClient();
  S.ctx = d.ctx || null;
  if (d.ctx?.magasin || d.ctx?.codeClient) try { localStorage.setItem('podium-magasin', JSON.stringify({ magasin: d.ctx.magasin, codeClient: d.ctx.codeClient })); } catch (e) {}
  for (const e of ['od', 'og']) {
    for (const f of ['sph', 'cyl', 'axe', 'add', 'prism', 'base']) {
      const v = (d.rx?.[e]?.[f] || '').replace(/°/g, '');
      const inp = $(`[data-rx="${e}.${f}"]`);
      S.rx[e][f] = v; inp.value = v;
      if (!checkRx(inp)) inp.value = fmtRx(f, v);
    }
    transpose(e);
  }
  const price = num(d.framePrice);
  S.frame.price = price == null ? null : String(price);
  $('#framePrice').value = price == null ? '' : eur(price);
  renderEntry();
  toast('Correction et prix monture reçus de MyEasyOptic');
}
// Libellé MyEasyOptic du verre de chaque œil
// Verre de chaque œil pour MyEasyOptic : libellé exact et code EDI
function meoLabels(o) {
  if (o.classA) {
    const idx = { 1.5: '1.5', 1.59: 'PC', 1.67: '1.67', 1.74: '1.74' };
    const lab = e => ({ lab: `Economic ${e.prog ? 'Prog' : 'Unifocal'} ${idx[e.index] || e.index} HMC`, code: '' });
    return { od: lab(o.eyes[0]), og: lab(o.eyes[1]) };
  }
  const ref = (g, key) => ({ lab: g.prices[key]?.lab || g.name, code: g.prices[key]?.code || '' });
  const main = ref(o.g, `${o.mat.id}|${o.filt}|${o.tr.id}|${o.tint}`);
  if (!o.unif) return { od: main, og: main };
  const other = ref(o.unif.g, o.unif.key);
  return progEye() === 'od' ? { od: main, og: other } : { od: other, og: main };
}
// yeux avec un prisme saisi
const prismEyes = () => ['od', 'og'].filter(e => num(S.rx[e].prism) > 0);
const tintColors = () => cfg.tints.find(t => t.id === S.opts.tint)?.colors || [];
const curColor = () => { const l = tintColors(); return l.find(c => c.name === S.opts.color) || l[0] || null; };
function sendToMeo() {
  const o = current.find(x => x.key === S.selected);
  if (!o || !meo || meo.closed) return toast("MyEasyOptic n'est plus ouvert : relancez le bouton « → Podium » depuis le devis.");
  const l = meoLabels(o);
  // suppléments à cocher dans MyEasyOptic après le choix du diamètre : Précal, couleur de teinte Transitions
  const supps = [], both = ['od', 'og'];
  if (o.precal && cfg.supplements.precalCode) supps.push({ code: cfg.supplements.precalCode, lib: 'Precal', name: 'Précal', eyes: both });
  const tint = cfg.tints.find(t => t.id === o.tint);
  if (tint?.photo && curColor()) supps.push({ code: curColor().code, lib: curColor().lib || '', name: `${tint.name} ${curColor().name}`, eyes: both });
  const prisms = o.classA ? [] : prismEyes();
  if (prisms.length) supps.push({ code: cfg.supplements.prismCode || '550', lib: 'Prisme standard', name: `Prisme standard ${prisms.map(eyeName).join('/')}`, eyes: prisms });
  logStat(o, l);
  meo.postMessage({ type: 'podium-verres', v: 2, od: l.od.lab, og: l.og.lab, odCode: l.od.code, ogCode: l.og.code, supps, precal: !!o.precal }, MEO_ORIGIN);
  try { meo.focus(); } catch (e) {}
  // Podium a été ouvert par MyEasyOptic : on referme l'onglet (sans effet si Podium a été ouvert à la main)
  setTimeout(() => window.close(), 600);
  toast(`Envoyé : ${l.od.lab}${l.og.lab !== l.od.lab ? ' / ' + l.og.lab : ''}${supps.length ? ' + ' + supps.map(s => s.name).join(', ') : ''}`);
}

// Suivi d'utilisation (Google Sheets via Apps Script, adresse dans Paramètres › Magasins & suivi)
function statRow(o, l) {
  const c = storeCtx(), st = storeOf(), frame = frameNet().price || 0;
  const prisms = o.classA ? [] : prismEyes();
  const prism = prisms.length * (o.net && curNet()?.supp?.prism != null ? +curNet().supp.prism * storeFactor(curNet()) : (+cfg.supplements.prism || 0));
  // mesures FIT renseignées : au moins 3 champs (le cap de tête à sa valeur par défaut ne compte pas)
  const mes = visibleMes().filter(m => num(S.mes[m.id]) != null && !(m.default != null && num(S.mes[m.id]) === +m.default)).length;
  const d = new Date(), p2 = n => String(n).padStart(2, '0');
  return {
    token: cfg.stats?.token || '',
    date: `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`,
    magasin: st?.name || c.magasin || '', technicien: S.ctx?.technicien || '', client: S.ctx?.client || '',
    mesuresFit: mes >= 3 ? 'oui' : 'non',
    produit: l.od.lab + (l.og.lab !== l.od.lab ? ' / ' + l.og.lab : ''),
    montant: Math.round((frame + (o.pair || 0) + prism) * 100) / 100,
    reseau: curNet()?.name || 'Hors réseau',
  };
}
function logStat(o, l) {
  const url = cfg.stats?.url;
  if (!url) return;
  try { fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(statRow(o, l)) }); } catch (e) {}
}
window.PodiumStats = { statRow, logStat, storeOf, storeCtx };

/* ---------- Navigation entre étapes ---------- */
/* ---------- Repli de la zone options ---------- */
let ctrlTimer = null, ctrlCollapsed = false;
function setCollapsed(v) {
  ctrlCollapsed = v; arOpen = false;
  $('.controls').classList.toggle('collapsed', v);
  if (v) renderMini(); else { renderFilters(); armCtrlTimer(); }
  if (current.length) requestAnimationFrame(layoutCarousel);
}
// 20 s sans clic : on replie
function armCtrlTimer() { clearTimeout(ctrlTimer); if (S.step === 2 && !ctrlCollapsed) ctrlTimer = setTimeout(() => setCollapsed(true), 20000); }
function renderMini() {
  const o = S.opts, chips = [];
  const recMat = matsSorted().find(m => m.index >= recommendedIndex());
  if (o.panierA) chips.push('Panier A · 100 % Santé');
  else {
    const mat = S.material === 'auto' ? recMat : cfg.materials.find(m => m.id === S.material);
    if (mat) chips.push(`${mat.name}${S.material === 'auto' ? ' (conseillée)' : ''}`);
    if (o.precal) chips.push('Précal');
    if (o.blue) chips.push(`Lumière bleue : ${o.blueTr ? 'matière + traitement' : o.blueMat ? 'matière' : 'traitement'}`);
    else if (!o.blueMat) chips.push('Sans matière filtrante');
    if (o.ar) chips.push(`Anti-reflets : ${o.arSel.length ? o.arSel.map(id => cfg.treatments.find(t => t.id === id)?.name).filter(Boolean).join(', ') : 'tous'}`);
    if (o.photo) chips.push(cfg.tints.find(t => t.id === o.tint)?.name || 'Transitions');
    if (o.noFit && fitVerdict() === 'fit' && !trackOnly() && !curNet()) chips.push('Non FIT');
    if (fitVerdict() === 'fit' && !trackOnly() && curNet()) chips.push('Verres FIT recommandés');
    if (mat && matWarnings(mat).length) chips.push('⚠ Amincissement à vérifier');
    if (o.antifatigue) chips.push(`Anti-fatigue · Boost ${String(curBoost() || '').replace('.', ',')}`);
  }
  $('#ctrlMini').innerHTML = `<span class="mini-l">Options</span>${chips.map(c => `<span class="pill">${esc(c)}</span>`).join('') || '<span class="pill">Aucune option</span>'}<span class="mini-e">⚙ Modifier les options</span>`;
}

// Réglages d'options du réseau choisi, sinon du hors réseau
const optScope = () => curNet() || cfg.noNetwork || {};
// Sens de la correction : sphère de l'œil le plus fort (+1 positive, −1 négative, 0 plan)
function rxSign() {
  let best = 0;
  for (const e of ['od', 'og']) { const s = num(S.rx[e].sph) || 0; if (Math.abs(s) > Math.abs(best)) best = s; }
  return Math.sign(best);
}
// Options pré-cochées (paramètres du réseau ou hors réseau) : appliquées à l'arrivée sur le podium,
// à nouveau seulement si le réseau ou le sens de la correction change (les choix de l'opticien sont conservés)
function applyDefaults() {
  const sign = rxSign(), sig = (S.network || '') + '|' + sign;
  if (S.defSig === sig) return;
  S.defSig = sig;
  const def = optScope().defaults || {};
  for (const k of ['precal', 'blue', 'ar', 'photo', 'antifatigue']) {
    const v = def[k];
    if (!v) continue; // au choix de l'opticien
    S.opts[k] = v === 'on' || (v === 'pos' && sign > 0) || (v === 'neg' && sign < 0);
  }
}

function showStep(n) {
  S.step = n;
  $('#stepInput').hidden = n !== 1;
  $('#stepPodium').hidden = n !== 2;
  if (n === 1) renderEntry();
  else { S.pos = 0; renderRecap(); renderFilters(); renderPodium(); setCollapsed(false); }
  if (n !== 2) clearTimeout(ctrlTimer);
  window.scrollTo(0, 0);
}
function refresh() { if (S.step === 1) renderEntry(); else { renderRecap(); renderFilters(); renderPodium(); } }

/* ---------- Fiches ---------- */
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; galleryKeys = null; }

// Aides à la vente : images propres à la gamme (sinon celles de sa gamme de base) + visuel FIT / Track selon l'option
function imagesOf(g) {
  const own = g.fiche?.images || [], base = baseOf(g)?.fiche?.images || [];
  const list = [...(own.length ? own : base)];
  if (g.fiche?.image) list.push(g.fiche.image); // visuel ajouté depuis les paramètres
  if (g.fit) list.push(...(cfg.optionImages?.fit || []));
  if (g.track) list.push(...(cfg.optionImages?.track || []));
  return list;
}

function openFiche(key) {
  const o = current.find(x => x.key === key); if (!o) return;
  if (o.classA) return openClassA(o);
  const g = o.g, f = ficheOf(g), c = g.color || '#1d4fd7';
  const imgs = imagesOf(g);
  const tech = (f.technologies || []).filter(Boolean);
  const blocks = [
    f.geometrie && `<div><h4>Géométrie</h4><p>${esc(f.geometrie)}</p></div>`,
    tech.length && `<div><h4>Technologies & brevets</h4><ul>${tech.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`,
    f.pourqui && `<div><h4>Pour qui ?</h4><p>${esc(f.pourqui)}</p></div>`,
  ].filter(Boolean);
  openModal(`
    <div class="fiche-h" style="background:linear-gradient(135deg,${c},${shade(c, -40)})">
      <button class="x" data-close aria-label="Fermer">✕</button>
      <div class="fiche-type">${g.type === 'prog' ? 'Verre progressif' : 'Verre unifocal'}${g.fit ? ' · FIT' : ''}${g.track ? ' · Track' : ''}</div>
      <h2>${esc(g.name)}</h2>
      ${keywordsOf(g) ? `<div class="fiche-kw">${esc(keywordsOf(g))}</div>` : ''}
      ${taglineOf(g) ? `<p>« ${esc(taglineOf(g))} »</p>` : ''}
    </div>
    ${imgs.length ? `<div class="gallery">
      <div class="g-wrap"><div class="g-stage"><div class="g-track">${(imgs.length > 1 ? [imgs[imgs.length - 1], ...imgs, imgs[0]] : imgs).map((src, k) => `<div class="g-slide" data-s="${k}"><img src="${esc(src)}" alt="" draggable="false"></div>`).join('')}</div></div>
        ${imgs.length > 1 ? '<button class="g-nav prev" data-g="-1" aria-label="Visuel précédent">‹</button><button class="g-nav next" data-g="1" aria-label="Visuel suivant">›</button>' : ''}</div>
      ${imgs.length > 1 ? `<div class="g-thumbs">${imgs.map((src, i) => `<button class="${i ? '' : 'on'}" data-t="${i}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>` : ''}
    </div>` : ''}
    ${blocks.length ? `<div class="fiche-b cols-${blocks.length}">${blocks.join('')}</div>` : ''}`);
  if (imgs.length) carousel(imgs.length);
}

// Carrousel en boucle : visuel courant au centre, voisins visibles de chaque côté en fondu.
// Les pistes contiennent une copie du dernier visuel au début et du premier à la fin pour boucler sans saut visible.
function carousel(n) {
  const track = $('.g-track'), loop = n > 1;
  $('.gallery').classList.toggle('single', !loop); // un seul visuel : pleine largeur, sans fondu
  let pos = loop ? 1 : 0;
  const place = (anim = true) => {
    track.classList.toggle('snap', !anim);
    track.style.transform = loop ? `translateX(${19 - pos * 62}%)` : 'none';
    $$('.g-slide').forEach(sl => sl.classList.toggle('on', +sl.dataset.s === pos));
    const cur = loop ? (pos - 1 + n) % n : pos;
    $$('.g-thumbs button').forEach(t => t.classList.toggle('on', +t.dataset.t === cur));
    if (!anim) { void track.offsetWidth; track.classList.remove('snap'); }
  };
  const normalize = () => { if (pos <= 0) { pos = n; place(false); } else if (pos >= n + 1) { pos = 1; place(false); } };
  const go = target => { if (!loop) return; normalize(); pos = target; place(); };
  track.addEventListener('transitionend', e => { if (e.target === track && loop) normalize(); });
  place(false);
  if (!loop) return;
  $('.gallery').onclick = e => {
    const nav = e.target.closest('[data-g]'), th = e.target.closest('[data-t]'), sl = e.target.closest('.g-slide');
    if (nav) go(pos + +nav.dataset.g);
    else if (th) go(+th.dataset.t + 1);
    else if (sl && +sl.dataset.s !== pos) go(pos + Math.sign(+sl.dataset.s - pos)); // clic sur un voisin
  };
  let x0 = null;
  $('.g-stage').addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true });
  $('.g-stage').addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(pos + (dx < 0 ? 1 : -1)); x0 = null; });
  galleryKeys = e => { if (e.key === 'ArrowRight') go(pos + 1); if (e.key === 'ArrowLeft') go(pos - 1); };
}
let galleryKeys = null;

function openClassA(o) {
  const A = cfg.classA, cols = ['Sphérique', 'Cylindre 0 à 4 D', 'Cylindre > 4 D'];
  const table = (rows, kind) => `<table class="ptable"><thead><tr><th>${kind}</th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr><td>${esc(A.levels[i].label)} (indice ${A.levels[i].index})</td>${r.map((v, j) => `<td class="${o.eyes.some(e => e.lv === i && e.col === j && (kind === 'Progressifs') === e.prog) ? 'hl' : ''}">${eur(v)} €</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  openModal(`
    <div class="fiche-h" style="background:linear-gradient(135deg,#0f8a6c,#0b5a47)">
      <button class="x" data-close aria-label="Fermer">✕</button>
      <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.75;font-weight:600">100 % Santé · Classe A</div>
      <h2>Panier A</h2><p>« ${esc(o.g.tagline)} »</p>
    </div>
    <div class="fiche-b">
      <div class="full"><h4>Pour ce porteur</h4>
        ${o.eyes.map(e => `<p><b>${eyeName(e.e)}</b> : ${e.prog ? 'progressif' : 'unifocal'} ${esc(A.name)} indice ${e.index}, ${esc(A.levels[e.lv].label.toLowerCase())}, ${cols[e.col].toLowerCase()} → <b>${eur(e.price)} €</b></p>`).join('')}
        <p style="margin-top:8px;color:var(--ink-3);font-size:12.5px">Prix limites de vente d'un équipement complet, monture valorisée à ${eur(A.frameIncluded)} € comprise. Chaque verre vaut (prix limite − ${eur(A.frameIncluded)} €) ÷ 2.</p></div>
      <div class="full"><h4>Monture + unifocaux</h4><div class="scroll-x">${table(A.unif, 'Unifocaux')}</div></div>
      <div class="full"><h4>Monture + progressifs</h4><div class="scroll-x">${table(A.prog, 'Progressifs')}</div></div>
    </div>`);
}

function openThinning() {
  const p = strongest();
  const rows = matsSorted().map(m => ({ m, t: thickness(m, p) }));
  const maxmm = Math.max(...rows.map(r => r.t?.mm || 0), 1);
  const f = x => x.toFixed(2).replace('.', ',');
  openModal(`<div class="modal-pad">
    <div class="row" style="justify-content:space-between"><h3>Amincissement</h3><button class="btn icon ghost" data-close>✕</button></div>
    ${p != null ? `<p style="color:var(--ink-2);margin-top:0">Épaisseur estimée au ${p < 0 ? 'bord' : 'centre'} pour ${fmtRx('sph', p)} (diamètre 65 mm, valeurs indicatives).</p>
    <div class="stack" style="gap:8px;margin-bottom:18px">${rows.map(r => `<div class="row" style="flex-wrap:nowrap"><b style="width:110px">${esc(r.m.name)} ${r.m.index}</b>
      <div style="flex:1;background:var(--surface-2);border-radius:8px;height:22px;overflow:hidden"><div style="height:100%;width:${(r.t.mm / maxmm * 100).toFixed(0)}%;background:linear-gradient(90deg,#3f7bff,#0b2a7a);border-radius:8px"></div></div>
      <b style="width:70px;text-align:right">${r.t.mm.toFixed(1).replace('.', ',')} mm</b></div>`).join('')}</div>` : '<p style="color:var(--ink-2)">Saisissez la correction pour estimer les épaisseurs.</p>'}
    <h4 style="margin:0 0 8px">Règle de conseil</h4>
    <table class="ptable" style="margin-bottom:16px"><thead><tr><th>Puissance max (méridien)</th><th>Indice conseillé</th></tr></thead><tbody>
    ${[...cfg.thinning].sort((a, b) => a.max - b.max).map((r, i, a) => `<tr><td>${i === 0 ? `jusqu'à ${f(r.max)}` : i === a.length - 1 ? `au-delà de ${f(a[i - 1].max)}` : `de ${f(a[i - 1].max)} à ${f(r.max)}`} D</td><td>${r.index}</td></tr>`).join('')}
    </tbody></table>
    <img src="assets/amincissement.png" alt="Comparatif d'épaisseur des matières" style="max-width:100%;border-radius:12px">
  </div>`);
}

/* ---------- Utilitaires ---------- */
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(v + v * pct / 100)));
  return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }

/* ---------- Événements ---------- */
function bindMain() {
  // Correction
  const rxInputs = $$('[data-rx]');
  rxInputs.forEach(inp => {
    inp.addEventListener('input', () => { const [e, f] = inp.dataset.rx.split('.'); S.rx[e][f] = inp.value; inp.classList.remove('invalid'); inp.title = ''; renderEntry(); });
    inp.addEventListener('blur', () => {
      const [e, f] = inp.dataset.rx.split('.');
      if (checkRx(inp)) return renderEntry();
      inp.value = fmtRx(f, inp.value);
      if ((f === 'cyl' || f === 'axe') && transpose(e)) toast(`${eyeName(e)} transposé en cylindre positif`);
      renderEntry();
    });
    inp.addEventListener('focus', () => inp.classList.contains('invalid') && inp.select());
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') rxInputs[(rxInputs.indexOf(inp) + 1) % rxInputs.length].focus(); });
  });
  $('#copyOD').onclick = () => {
    S.rx.og = { ...S.rx.od };
    $$('[data-rx^="og."]').forEach(i => { const f = i.dataset.rx.split('.')[1]; i.value = fmtRx(f, S.rx.og[f]); });
    renderEntry();
  };
  $('#mixedChk').onchange = e => { S.mixed = e.target.checked; renderEntry(); };
  // Mesures
  $('#altSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-alt]'); if (!b || b.dataset.alt === S.alt) return;
    S.alt = b.dataset.alt;
    cfg.fit.filter(m => m.alt && m.alt !== S.alt).forEach(m => delete S.mes[m.id]); // DVO ou CRO, pas les deux
    buildMesures(); renderEntry();
  });
  $('#mesGrid').addEventListener('input', e => { const id = e.target.dataset.mes; if (!id) return; S.mes[id] = e.target.value; renderEntry(); });
  $('#mesGrid').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.mes) { const all = $$('[data-mes]'); const n = all[all.indexOf(e.target) + 1]; (n || $('#framePrice')).focus(); } });
  // Réseau : un seul à la fois, re-clic pour décocher
  $('#netSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-net]'); if (!b) return;
    S.network = S.network === b.dataset.net ? null : b.dataset.net;
    S.pos = 0; renderEntry();
  });
  // Monture
  $('#frameSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-frame]'); if (!b) return;
    S.frame.type = b.dataset.frame;
    const m = cfg.materials.find(x => x.id === S.material);
    if (m && m.index < (frameDef()?.minIndex || 0)) S.material = 'auto';
    renderEntry();
  });
  $('#framePrice').addEventListener('input', e => { S.frame.price = e.target.value; renderEntry(); });
  $('#framePrice').addEventListener('blur', e => { const n = num(e.target.value); e.target.value = n == null ? '' : eur(n); });
  // on ne passe au podium qu'avec une correction valide
  const go = () => {
    $$('[data-rx]').forEach(checkRx);
    const bad = $('[data-rx].invalid');
    if (bad) { renderEntry(); toast(bad.title); bad.focus(); return; }
    applyDefaults();
    showStep(2);
  };
  $('#framePrice').addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); go(); } });
  $('#btnGo').onclick = go;
  $('#recap').onclick = () => showStep(1);
  // Mode
  $('#modeSeg').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; S.mode = b.dataset.mode; S.pos = 0; refresh(); });
  // Options
  $('#optToggles').addEventListener('click', e => {
    if (e.target.id === 'arBtn') { arOpen = !arOpen; return renderFilters(); }
    if (e.target.id === 'arAll') { S.opts.arSel = []; arOpen = false; S.pos = 0; renderFilters(); return renderPodium(); }
    if (e.target.closest('select, label, .dd')) return; // contrôles internes : ne basculent pas l'option
    const t = e.target.closest('[data-opt]'); if (!t || t.classList.contains('locked')) return;
    S.opts[t.dataset.opt] = !S.opts[t.dataset.opt];
    if (t.dataset.opt === 'ar') arOpen = S.opts.ar;
    if (t.dataset.opt === 'noFit' || t.dataset.opt === 'panierA') renderRecap();
    S.pos = 0; renderFilters(); renderPodium();
  });
  document.addEventListener('click', e => {
    // chemin d'origine du clic : la zone a pu être redessinée entre-temps
    const inside = sel => e.composedPath().some(n => n.matches?.(sel));
    if (arOpen && !inside('.dd, [data-opt="ar"]')) { arOpen = false; if (!ctrlCollapsed) renderFilters(); }
    if (S.step !== 2 || !$('#viewAdmin').hidden) return;
    // clic hors de la zone options (et hors fenêtre de fiche) : on replie ; sinon on relance le délai
    if (!ctrlCollapsed && e.isTrusted && !inside('.controls, .modal, .topbar, #stepInput, #recap')) setCollapsed(true);
    else armCtrlTimer();
  });
  $('#ctrlMini').onclick = () => setCollapsed(false);
  $('#optToggles').addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.dataset.opt) { e.preventDefault(); e.target.click(); } });
  $('#optToggles').addEventListener('change', e => {
    if (e.target.id === 'tintSel') { S.opts.tint = e.target.value; renderFilters(); }
    if (e.target.id === 'colorSel') S.opts.color = e.target.value;
    if (e.target.id === 'boostSel') S.opts.boost = e.target.value;
    if (e.target.dataset.chk) S.opts[e.target.dataset.chk] = e.target.checked;
    if (e.target.dataset.ar) {
      const id = e.target.dataset.ar;
      S.opts.arSel = e.target.checked ? [...S.opts.arSel, id] : S.opts.arSel.filter(x => x !== id);
      const btn = $('#arBtn'), n = S.opts.arSel.length;
      if (btn) btn.textContent = (!n ? 'Tous les traitements' : n === 1 ? cfg.treatments.find(t => t.id === S.opts.arSel[0]).name : `${n} traitements`) + ' ▾';
    } else renderFilters();
    S.pos = 0; renderPodium();
  });
  $('#lensPanel').addEventListener('click', e => {
    if (e.target.id === 'matInfo') return openThinning();
    if (e.target.id === 'matAuto') { S.material = 'auto'; S.pos = 0; renderLenses(); return renderPodium(); }
    const b = e.target.closest('[data-mat]'); if (!b || b.disabled) return;
    S.material = S.material === b.dataset.mat ? 'auto' : b.dataset.mat; // second clic : retour à la matière conseillée
    S.pos = 0; renderLenses(); renderPodium();
  });
  // Podium
  $('#prev').onclick = () => move(-1);
  $('#next').onclick = () => move(1);
  $('#track').addEventListener('click', e => {
    const more = e.target.closest('[data-more]'); if (more) return openFiche(more.dataset.more);
    const card = e.target.closest('.card'); if (!card) return;
    if (!e.target.closest('.card-h')) return openFiche(card.dataset.key); // corps de la carte : « En savoir plus »
    S.selected = S.selected === card.dataset.key ? null : card.dataset.key; // bandeau bleu : sélection
    $$('.card').forEach(c => { const on = c.dataset.key === S.selected; c.classList.toggle('sel', on); $('.check', c).textContent = on ? '✓' : ''; });
    renderSummary();
  });
  let tx = null;
  $('#viewport').addEventListener('touchstart', e => tx = e.touches[0].clientX, { passive: true });
  $('#viewport').addEventListener('touchend', e => { if (tx == null) return; const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 40) move(d < 0 ? 1 : -1); tx = null; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').hidden) return closeModal();
    if (!$('#modal').hidden && galleryKeys) return galleryKeys(e);
    if ($('#stepPodium').hidden || !$('#modal').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowLeft') move(-1);
  });
  window.addEventListener('resize', () => S.step === 2 && current.length && layoutCarousel());
  $('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  $('#btnReset').onclick = resetClient;
  $('#summary').addEventListener('click', e => { if (e.target.closest('#sendMeo')) sendToMeo(); });
  $('#btnAdmin').onclick = () => location.hash = '#parametres';
}

function resetClient() {
  S = blankClient();
  $$('[data-rx]').forEach(i => { i.value = ''; i.classList.remove('invalid'); i.title = ''; });
  $('#framePrice').value = '';
  buildMesures(); buildFrameSeg(); buildNetSeg(); showStep(1);
  $('[data-rx="od.sph"]').focus();
}

/* ---------- Routage ---------- */
function route() {
  const admin = location.hash === '#parametres';
  $('#viewAdmin').hidden = !admin;
  if (admin) { $('#stepInput').hidden = $('#stepPodium').hidden = true; window.Admin.open(); return; }
  // les paramètres ont pu changer : on remet l'état client en cohérence
  if (!cfg.frames.some(f => f.id === S.frame.type)) S.frame.type = cfg.frames[0]?.id;
  buildMesures(); buildFrameSeg(); buildNetSeg(); showStep(S.step);
}

function checkUpdate() {
  if (cfgNotice) toast(cfgNotice);
  const d = window.PODIUM_DEFAULT;
  if (!cfg.localEdit || !d || !d.updatedAt || d.updatedAt <= (cfg.publishedAt || cfg.updatedAt)) return;
  const b = $('#updateBanner');
  b.hidden = false;
  b.innerHTML = `Une configuration plus récente a été publiée (${esc(d.updatedAt)}). <button class="btn small primary" id="loadPub">Charger</button> <button class="btn small" id="ignorePub">Ignorer</button>`;
  $('#loadPub').onclick = () => { setCfg(clone(d), false); b.hidden = true; route(); toast('Configuration mise à jour'); };
  $('#ignorePub').onclick = () => { cfg.publishedAt = d.updatedAt; saveCfg(); b.hidden = true; };
}

window.Podium = { get cfg() { return cfg; }, get profile() { return PROFILE; }, logout, setCfg, saveCfg, esc, eur, num, clone, toast, openModal, closeModal, shade, $, $$ };
// démarrage une fois tous les scripts chargés (admin.js arrive après ce fichier)
window.addEventListener('DOMContentLoaded', async () => {
  await ensureAccess();
  cfg = loadCfg(); S = blankClient();
  document.body.dataset.profile = PROFILE;
  if (PROFILE !== 'local') { $('#btnLogout').hidden = false; $('#btnLogout').title = `Profil ${PROFILE === 'admin' ? 'Paramètres' : 'User'} : se déconnecter`; $('#btnLogout').onclick = logout; }
  bindMain();
  window.addEventListener('hashchange', route);
  route();
  checkUpdate();
});
