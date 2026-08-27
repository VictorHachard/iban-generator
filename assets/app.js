/* UI - langue, detection du pays, generation, copie, export.
   Les chaines et les noms de pays traduits sont injectes par build.mjs dans window.__I18N. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var I = window.__I18N || {};
  var T = I.t || {};
  var LANG = I.lang || 'fr';
  var CN = I.countries || {};

  var countrySel = $('country'), countInput = $('count'), out = $('out'),
      outMeta = $('outMeta'), single = $('single'), ibanBig = $('ibanBig'),
      detail = $('detail'), list = $('list'), toast = $('toast');

  var current = [];

  function label(code) { return CN[code] || IBAN.SPECS[code].name; }
  function fill(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] !== undefined ? vars[k] : m;
    });
  }

  /* ---------- detection du pays ---------- */
  var TZ = {
    'Europe/Paris': 'FR', 'Europe/Brussels': 'BE', 'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE',
    'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Europe/Rome': 'IT', 'Europe/Lisbon': 'PT',
    'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE',
    'Europe/Vienna': 'AT', 'Europe/Luxembourg': 'LU', 'Europe/Athens': 'GR', 'Europe/Nicosia': 'CY',
    'Asia/Nicosia': 'CY', 'Europe/Helsinki': 'FI', 'Europe/Stockholm': 'SE', 'Europe/Copenhagen': 'DK',
    'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Bratislava': 'SK', 'Europe/Budapest': 'HU',
    'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI',
    'Europe/Tallinn': 'EE', 'Europe/Riga': 'LV', 'Europe/Vilnius': 'LT', 'Europe/Malta': 'MT'
  };

  function detectCountry() {
    var saved = null;
    try { saved = localStorage.getItem('iban.country'); } catch (e) { /* mode prive */ }
    if (saved && IBAN.SPECS[saved]) return saved;

    var langs = (navigator.languages && navigator.languages.length ? navigator.languages
      : [navigator.language || '']);
    for (var i = 0; i < langs.length; i++) {
      var m = /[-_]([A-Za-z]{2})\b/.exec(langs[i] || '');
      if (m && IBAN.SPECS[m[1].toUpperCase()]) return m[1].toUpperCase();
    }
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (TZ[tz]) return TZ[tz];
    } catch (e) { /* Intl absent */ }
    return 'FR';
  }

  /* ---------- liste des pays ---------- */
  function buildCountries() {
    var codes = Object.keys(IBAN.SPECS).sort(function (x, y) {
      return label(x).localeCompare(label(y), LANG);
    });
    var frag = document.createDocumentFragment();
    codes.forEach(function (code) {
      var o = document.createElement('option');
      o.value = code;
      o.textContent = IBAN.SPECS[code].flag + '  ' + label(code) + ' (' + code + ')';
      frag.appendChild(o);
    });
    countrySel.appendChild(frag);
    countrySel.value = detectCountry();
  }

  /* ---------- rendu ---------- */
  function render(results) {
    current = results;
    out.hidden = false;

    var code = results[0].country, spec = IBAN.SPECS[code];
    outMeta.textContent = fill(T.meta, {
      n: results.length,
      country: spec.flag + ' ' + label(code),
      len: spec.length
    });

    if (results.length === 1) {
      single.hidden = false;
      list.hidden = true;
      list.innerHTML = '';
      var r = results[0];
      ibanBig.textContent = IBAN.format(r.iban);
      detail.innerHTML = '';
      addDetail(T.detCountry, spec.flag + ' ' + label(code));
      if (r.bank) addDetail(T.detBank, r.bank + ' (' + r.bankCode + ')');
      addDetail(T.detKey, r.iban.slice(2, 4) + ' ✓');
      return;
    }

    single.hidden = true;
    list.hidden = false;
    var frag = document.createDocumentFragment();
    results.forEach(function (r, i) {
      var li = document.createElement('li');
      var n = document.createElement('span'); n.className = 'n'; n.textContent = (i + 1) + '.';
      var v = document.createElement('span'); v.className = 'v'; v.textContent = IBAN.format(r.iban);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'c'; b.textContent = T.btnCopy;
      b.addEventListener('click', function () {
        copy(r.iban, T.msgCopied, [[b, T.btnCopyDone], [li, null]]);
      });
      li.appendChild(n); li.appendChild(v); li.appendChild(b);
      frag.appendChild(li);
    });
    list.innerHTML = '';
    list.appendChild(frag);
  }

  function addDetail(label, value) {
    var d = document.createElement('span');
    d.innerHTML = '<i></i> : <b></b>';
    d.querySelector('i').textContent = label;
    d.querySelector('b').textContent = value;
    detail.appendChild(d);
  }

  /* ---------- actions ---------- */
  function generate() {
    var code = countrySel.value;
    var count = Math.min(1000, Math.max(1, parseInt(countInput.value, 10) || 1));
    countInput.value = count;
    try { localStorage.setItem('iban.country', code); } catch (e) { /* mode prive */ }
    render(IBAN.generateMany(code, count));
  }

  /* copie + retour visuel sur les elements cliques (els : [element, libelle|null]) */
  function copy(text, msg, els) {
    var done = function () {
      flash(msg);
      (els || []).forEach(function (p) { markDone(p[0], p[1]); });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }

  /* passe l'element en "copie" pendant 1,4 s ; libelle null = on garde le texte */
  function markDone(el, label) {
    if (!el) return;
    if (el.copyTimer) clearTimeout(el.copyTimer);
    else if (label) el.copyLabel = el.textContent;
    el.classList.add('is-copied');
    if (label) el.textContent = label;
    el.copyTimer = setTimeout(function () {
      el.classList.remove('is-copied');
      if (label) el.textContent = el.copyLabel;
      el.copyTimer = null;
    }, 1400);
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { flash(T.msgCopyFail); }
    document.body.removeChild(ta);
  }

  var toastTimer;
  function flash(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 1600);
  }

  function download(name, mime, content) {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- evenements ---------- */
  $('generate').addEventListener('click', generate);
  countrySel.addEventListener('change', generate);
  countInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') generate(); });

  $('lang').addEventListener('change', function () { location.href = this.value; });

  $('quick').addEventListener('click', function (e) {
    var n = e.target.getAttribute && e.target.getAttribute('data-n');
    if (!n) return;
    countInput.value = n;
    generate();
  });

  ibanBig.addEventListener('click', function () {
    if (current[0]) copy(current[0].iban, T.msgCopied, [[ibanBig, null]]);
  });

  $('copyAll').addEventListener('click', function () {
    if (!current.length) return;
    copy(current.map(function (r) { return r.iban; }).join('\n'),
      fill(T.msgCopiedMany, { n: current.length }), [[$('copyAll'), T.btnCopyAllDone]]);
  });

  $('dlTxt').addEventListener('click', function () {
    if (!current.length) return;
    download('iban-' + current[0].country + '.txt', 'text/plain',
      current.map(function (r) { return r.iban; }).join('\r\n'));
    markDone($('dlTxt'), '✓ .txt');
    flash(T.msgTxt);
  });

  $('dlCsv').addEventListener('click', function () {
    if (!current.length) return;
    var rows = ['iban,country,bank,bank_code'];
    current.forEach(function (r) {
      rows.push([r.iban, r.country, '"' + (r.bank || '') + '"', r.bankCode || ''].join(','));
    });
    download('iban-' + current[0].country + '.csv', 'text/csv', rows.join('\r\n'));
    markDone($('dlCsv'), '✓ .csv');
    flash(T.msgCsv);
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'g' || e.key === 'G') generate();
  });

  /* URL canonique + og:url quand le build ne les a pas ecrits en dur */
  (function () {
    if (document.querySelector('link[rel="canonical"]')) return;
    var url = location.origin + location.pathname.replace(/index\.html$/, '');
    var link = document.createElement('link');
    link.rel = 'canonical';
    link.href = url;
    var og = document.createElement('meta');
    og.setAttribute('property', 'og:url');
    og.setAttribute('content', url);
    document.head.appendChild(link);
    document.head.appendChild(og);
  })();

  /* lien vers le depot, deduit de l'URL GitHub Pages */
  (function () {
    var m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
    if (!m) return;
    var repo = location.pathname.split('/').filter(Boolean)[0];
    if (repo && repo.length === 2) repo = null;            /* /xx/ est un dossier de langue */
    var el = $('src');
    el.href = 'https://github.com/' + m[1] + '/' + (repo || (m[1] + '.github.io'));
    el.hidden = false;
  })();

  /* ---------- demarrage ---------- */
  buildCountries();
  generate();
})();
