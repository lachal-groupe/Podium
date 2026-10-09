/* Pont MyEasyOptic -> Podium L4C84L (bouton de la barre de favoris, à cliquer sur l'écran de vente / devis).
   1. Lit la correction (bloc Ordonnance, à défaut lignes verres) et le prix de la monture.
   2. Ouvre Podium et lui transmet ces données (postMessage, directement d'onglet à onglet, sans serveur).
   3. Reçoit en retour le libellé exact des verres choisis, le colle dans « Libellé Verre » OD / OG,
      coche Précalibrage si besoin et ouvre la loupe : l'opticien choisit la ligne, le diamètre, puis OK. */
(() => {
  const PODIUM = 'https://lachal-groupe.github.io/Podium/';
  const ORIGIN = 'https://lachal-groupe.github.io';
  const vis = () => [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null);
  const by = p => vis().filter(i => i.placeholder === p);
  const note = (msg, ok) => {
    let d = document.getElementById('podium-note');
    if (!d) {
      d = document.createElement('div'); d.id = 'podium-note';
      d.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:12px 22px;border-radius:12px;font:600 14px/1.4 Segoe UI,Arial,sans-serif;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.28);max-width:82vw;text-align:center';
      document.body.appendChild(d);
    }
    d.style.background = ok ? '#1d4fd7' : '#c13246'; d.textContent = msg;
    clearTimeout(d._t); d._t = setTimeout(() => d.remove(), 10000);
  };

  const price = by('PV Monture')[0];
  if (!price) return note("Podium : ouvrez d'abord l'écran de vente / devis du client.", false);
  const S = by('Sph.'), C = by('Cyl.'), A = by('Axe'), D = by('Add.');
  const val = (arr, k) => ((arr[k] && arr[k].value) || '').trim();
  const eye = k => ({ sph: val(S, k), cyl: val(C, k), axe: val(A, k), add: val(D, k) });
  const filled = e => Object.values(e).some(Boolean);
  // les deux premières lignes Sph. sont l'ordonnance, les deux suivantes les lignes verres
  const pick = (o, v) => (S.length >= 4 && !filled(eye(o)) ? eye(v) : eye(o));
  const data = { type: 'podium-client', id: Date.now(), rx: { od: pick(0, 2), og: pick(1, 3) }, framePrice: price.value };

  const coller = d => {
    const od = by('Libellé Verre Œil Droit')[0], og = by('Libellé Verre Œil Gauche')[0];
    if (!od || !og) return note("Podium : revenez sur l'écran du devis pour recevoir les verres.", false);
    const set = (el, v) => {
      el.focus(); el.value = v;
      ['input', 'keyup', 'change'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
      el.blur();
    };
    set(od, d.od); set(og, d.og);
    if (d.precal) {
      const lab = [...document.querySelectorAll('label')].find(l => l.textContent.trim() === 'Précalibrage' && l.offsetParent);
      const cb = lab && (document.getElementById(lab.htmlFor) || lab.parentElement.querySelector('input[type=checkbox]'));
      if (cb && !cb.checked) cb.click();
    }
    window.focus();
    od.scrollIntoView({ block: 'center' });
    setTimeout(() => {
      const r = od.getBoundingClientRect();
      const loupe = document.elementFromPoint(r.left - 14, r.top + r.height / 2);
      const fin = d.od === d.og ? 'cliquez sur la ligne exacte, choisissez le diamètre puis OK.' : 'OD et OG sont différents : sélectionnez chaque œil, puis OK.';
      if (loupe && loupe !== od) { loupe.click(); note('Verres Podium collés : ' + fin, true); }
      else note('Verres Podium collés : cliquez sur la loupe, puis ' + fin, true);
    }, 250);
  };

  // un seul écouteur par page, même si le bouton est cliqué plusieurs fois
  window.__podiumPont = e => {
    if (e.origin !== ORIGIN || !e.data) return;
    if (e.data.type === 'podium-ack' && e.data.id === data.id) window.__podiumAck = data.id;
    if (e.data.type === 'podium-verres') coller(e.data);
  };
  if (!window.__podiumPontOn) { window.__podiumPontOn = true; window.addEventListener('message', e => window.__podiumPont(e)); }

  const w = window.open(PODIUM, 'podium-l4c84l');
  if (!w) return note('Podium : autorisez les fenêtres pop-up pour MyEasyOptic.', false);
  let n = 0;
  const t = setInterval(() => {   // renvoie jusqu'à ce que Podium soit prêt (connexion comprise), 2 minutes max
    if (window.__podiumAck === data.id || ++n > 240 || w.closed) return clearInterval(t);
    w.postMessage(data, ORIGIN);
  }, 500);
  note('Podium ouvert avec la correction et la monture de ce devis.', true);
})();
