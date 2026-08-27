/* Genere une page statique par langue :
     /index.html          francais (langue par defaut)
     /<lang>/index.html   les 23 autres langues officielles de l'UE
   Le texte editorial est ecrit en dur dans chaque page (indexable sans JavaScript) ;
   seules les chaines d'interface sont injectees pour le script.

   node build.mjs                                  URLs relatives
   node build.mjs --url https://moi.github.io/x/   canonical, hreflang, og:url absolus + sitemap.xml
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, DEFAULT_LANG } from './i18n.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LANGS = Object.keys(T);

const urlArg = process.argv.indexOf('--url');
const SITE = urlArg > -1 && process.argv[urlArg + 1] ? process.argv[urlArg + 1].replace(/\/*$/, '/') : '';

/* specifications pays, lues depuis le moteur pour ne jamais desynchroniser */
const sandbox = {};
new Function('globalThis', fs.readFileSync(path.join(ROOT, 'assets/iban.js'), 'utf8'))(sandbox);
const SPECS = sandbox.IBAN.SPECS;
const CODES = Object.keys(SPECS);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* noms de pays traduits : fournis par ICU, avec repli sur le nom francais du moteur */
function countryNames(lang) {
  let dn = null;
  try { dn = new Intl.DisplayNames([lang], { type: 'region' }); } catch { /* langue inconnue d'ICU */ }
  const out = {};
  for (const c of CODES) {
    let name = null;
    try { name = dn && dn.of(c); } catch { /* code inconnu */ }
    out[c] = (name && name !== c) ? name : SPECS[c].name;
  }
  return out;
}

/* chemin d'une langue vue depuis une autre page */
const href = (target, from) => SITE
  ? SITE + (target === DEFAULT_LANG ? '' : target + '/')
  : (from === DEFAULT_LANG ? '' : '../') + (target === DEFAULT_LANG ? './' : target + '/');

function page(lang) {
  const t = T[lang];
  const names = countryNames(lang);
  const isRoot = lang === DEFAULT_LANG;
  const assets = isRoot ? 'assets/' : '../assets/';
  const self = SITE ? SITE + (isRoot ? '' : lang + '/') : '';

  const countryList = CODES
    .slice()
    .sort((a, b) => names[a].localeCompare(names[b], lang))
    .map(c => `      <li data-country="${c}" tabindex="0"><b>${SPECS[c].flag} ${esc(names[c])}</b><span>${c} &middot; ${SPECS[c].length} ${esc(t.chars)}</span></li>`)
    .join('\n');

  const alternates = LANGS
    .map(l => `<link rel="alternate" hreflang="${l}" href="${esc(href(l, lang))}">`)
    .concat([`<link rel="alternate" hreflang="x-default" href="${esc(href('en', lang))}">`])
    .join('\n');

  const langOptions = LANGS
    .slice()
    .sort((a, b) => T[a].name.localeCompare(T[b].name))
    .map(l => `<option value="${esc(href(l, lang))}"${l === lang ? ' selected' : ''}>${esc(T[l].name)}</option>`)
    .join('');

  const langLinks = LANGS
    .slice()
    .sort((a, b) => T[a].name.localeCompare(T[b].name))
    .filter(l => l !== lang)
    .map(l => `<a href="${esc(href(l, lang))}" hreflang="${l}">${esc(T[l].name)}</a>`)
    .join(' · ');

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'IBAN Generator',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        inLanguage: lang,
        description: t.desc,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      },
      {
        '@type': 'FAQPage',
        mainEntity: t.faq.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        }))
      }
    ]
  }, null, 2);

  const runtime = {
    lang,
    t: {
      btnCopyAll: t.btnCopyAll, btnCopyAllDone: t.btnCopyAllDone,
      btnCopy: t.btnCopy, btnCopyDone: t.btnCopyDone,
      msgCopied: t.msgCopied, msgCopiedMany: t.msgCopiedMany,
      msgTxt: t.msgTxt, msgCsv: t.msgCsv, msgCopyFail: t.msgCopyFail,
      meta: t.meta, detCountry: t.detCountry, detBank: t.detBank, detKey: t.detKey
    },
    countries: names
  };

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.desc)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="google-site-verification" content="KyxS6is7H66ceLlscfv1wjpOluMQRb_hMnqZj-p2hgc">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0b0d10">
${self ? `<link rel="canonical" href="${esc(self)}">` : ''}
${alternates}

<meta property="og:type" content="website">
<meta property="og:site_name" content="IBAN Generator">
<meta property="og:locale" content="${lang}">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.desc)}">
${self ? `<meta property="og:url" content="${esc(self)}">` : ''}
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.desc)}">

<link rel="stylesheet" href="${assets}style.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#127974;</text></svg>">

<script type="application/ld+json">
${jsonld}
</script>
</head>
<body>
<main class="wrap">

  <div class="topbar">
    <label class="langpick">
      <span>${esc(t.lblLang)}</span>
      <select id="lang">${langOptions}</select>
    </label>
  </div>

  <header class="head">
    <h1>${esc(t.h1)}</h1>
    <p class="sub">${esc(t.sub)}</p>
  </header>

  <section class="panel" aria-label="${esc(t.h2how)}">
    <div class="controls">
      <label class="field field-grow">
        <span>${esc(t.lblCountry)}</span>
        <select id="country"></select>
      </label>

      <label class="field field-qty">
        <span>${esc(t.lblQty)}</span>
        <input id="count" type="number" min="1" max="1000" value="1" inputmode="numeric">
      </label>

      <button id="generate" class="btn btn-main" type="button">${esc(t.btnGenerate)}</button>
    </div>

    <div class="quick" id="quick">
      <span>${esc(t.lblQuick)}</span>
      <button type="button" data-n="1">1</button>
      <button type="button" data-n="10">10</button>
      <button type="button" data-n="50">50</button>
      <button type="button" data-n="100">100</button>
      <button type="button" data-n="500">500</button>
    </div>
  </section>

  <section class="panel out" id="out" aria-live="polite" hidden>
    <div class="out-head">
      <div class="out-meta" id="outMeta"></div>
      <div class="out-actions">
        <button type="button" class="btn" id="copyAll">${esc(t.btnCopyAll)}</button>
        <button type="button" class="btn" id="dlTxt">.txt</button>
        <button type="button" class="btn" id="dlCsv">.csv</button>
      </div>
    </div>
    <div id="single" class="single" hidden>
      <button type="button" class="iban-big" id="ibanBig" title="${esc(t.ttlCopy)}"></button>
      <div class="detail" id="detail"></div>
    </div>
    <ol id="list" class="list" hidden></ol>
  </section>

  <section class="info">
    <h2>${esc(t.h2how)}</h2>
    <p>${esc(t.p1)}</p>
    <p>${esc(t.p2)}</p>

    <h2>${esc(t.h2countries)}</h2>
    <p>${esc(t.pcountries)}</p>
    <ul class="countries">
${countryList}
    </ul>

    <h2>${esc(t.h2faq)}</h2>
${t.faq.map(f => `    <h3>${esc(f.q)}</h3>\n    <p>${esc(f.a)}</p>`).join('\n')}
  </section>

  <footer class="foot">
    <p><strong>${esc(t.warnLabel)}</strong> ${esc(t.warn)}</p>
    <p class="tiny">${esc(t.privacy)} <a id="src" href="#" hidden>${esc(t.src)}</a></p>
    <nav class="langs" aria-label="${esc(t.langNav)}">
      <span>${esc(t.langNav)} :</span> ${langLinks}
    </nav>
  </footer>

</main>
<div id="toast" class="toast" hidden></div>
<script>window.__I18N=${JSON.stringify(runtime)}</script>
<script src="${assets}iban.js"></script>
<script src="${assets}app.js"></script>
</body>
</html>
`;
}

let written = 0;
for (const lang of LANGS) {
  const dir = lang === DEFAULT_LANG ? ROOT : path.join(ROOT, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(lang), 'utf8');
  written++;
}

if (SITE) {
  const urls = LANGS.map(l => `  <url><loc>${SITE}${l === DEFAULT_LANG ? '' : l + '/'}</loc>${
    LANGS.map(a => `\n    <xhtml:link rel="alternate" hreflang="${a}" href="${SITE}${a === DEFAULT_LANG ? '' : a + '/'}"/>`).join('')
  }\n  </url>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`, 'utf8');
}

console.log(`${written} pages generees${SITE ? ' (URLs absolues + sitemap.xml)' : ' (URLs relatives)'}`);
