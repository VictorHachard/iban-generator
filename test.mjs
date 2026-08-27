/* node test.mjs — verifie structure, longueur, cle IBAN et cles nationales. */
import fs from 'node:fs';
import { T, DEFAULT_LANG } from './i18n.mjs';

const src = fs.readFileSync(new URL('./assets/iban.js', import.meta.url), 'utf8')
  .replace('global.IBAN = {', 'global.__NATIONAL = NATIONAL;\n  global.IBAN = {');
const g = {};
new Function('globalThis', src)(g);
const { IBAN, __NATIONAL: NATIONAL } = g;

/* format officiel attendu, pays par pays */
const FORMAT = {
  AT: /^AT\d{18}$/, BE: /^BE\d{14}$/, BG: /^BG\d{2}[A-Z]{4}\d{6}[A-Z0-9]{8}$/, HR: /^HR\d{19}$/,
  CY: /^CY\d{10}[A-Z0-9]{16}$/, CZ: /^CZ\d{22}$/, DK: /^DK\d{16}$/, EE: /^EE\d{18}$/,
  FI: /^FI\d{16}$/, FR: /^FR\d{12}[A-Z0-9]{11}\d{2}$/, DE: /^DE\d{20}$/, GR: /^GR\d{9}[A-Z0-9]{16}$/,
  HU: /^HU\d{26}$/, IE: /^IE\d{2}[A-Z]{4}\d{14}$/, IT: /^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/,
  LV: /^LV\d{2}[A-Z]{4}[A-Z0-9]{13}$/, LT: /^LT\d{18}$/, LU: /^LU\d{5}[A-Z0-9]{13}$/,
  MT: /^MT\d{2}[A-Z]{4}\d{5}[A-Z0-9]{18}$/, NL: /^NL\d{2}[A-Z]{4}\d{10}$/, PL: /^PL\d{26}$/,
  PT: /^PT\d{23}$/, RO: /^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$/, SK: /^SK\d{22}$/, SI: /^SI\d{17}$/,
  ES: /^ES\d{22}$/, SE: /^SE\d{22}$/
};

/* IBAN publics de reference : la cle nationale doit reproduire le BBAN a l'identique */
const REFERENCES = [
  ['BE', 'BE68539007547034'],
  ['ES', 'ES9121000418450200051332'],
  ['PT', 'PT50000201231234567890154'],
  ['IT', 'IT60X0542811101000000123456'],
  ['FI', 'FI2112345600000785'],
  ['SI', 'SI56263300012039086'],
  ['EE', 'EE382200221020145685'],
  ['FR', 'FR7630006000011234567890189']
];

const N = 3000;
let failures = 0;
const fail = (...m) => { failures++; console.error('  KO', ...m); };

const codes = Object.keys(IBAN.SPECS);
if (codes.length !== 27) fail('27 pays attendus, trouve', codes.length);

for (const code of codes) {
  for (const r of IBAN.generateMany(code, N)) {
    if (r.iban.length !== IBAN.SPECS[code].length) { fail(code, 'longueur', r.iban); break; }
    if (!FORMAT[code].test(r.iban)) { fail(code, 'format', r.iban); break; }
    if (!IBAN.validate(r.iban)) { fail(code, 'cle IBAN', r.iban); break; }
  }
}
console.log(`27 pays x ${N} IBAN : longueur, format et cle IBAN`);

for (const [code, iban] of REFERENCES) {
  const bban = iban.slice(4);
  if (!IBAN.validate(iban)) fail(code, 'reference invalide', iban);
  if (NATIONAL[code](bban) !== bban) fail(code, 'cle nationale', bban, '->', NATIONAL[code](bban));
}
console.log(`${REFERENCES.length} cles nationales verifiees sur des IBAN de reference`);

/* garde-fous du validateur */
if (IBAN.validate('FR7630006000011234567890188')) fail('validate accepte une cle IBAN fausse');
if (IBAN.validate('FR76 3000 6000 0112 3456 7890 189') !== true) fail('validate refuse les espaces');

/* ---- traductions : toutes les langues ont exactement les cles du francais ---- */
const LANGS = Object.keys(T);
const refKeys = Object.keys(T[DEFAULT_LANG]).sort();
for (const lang of LANGS) {
  const keys = Object.keys(T[lang]).sort();
  const missing = refKeys.filter(k => !keys.includes(k));
  const extra = keys.filter(k => !refKeys.includes(k));
  if (missing.length) fail(lang, 'cles manquantes :', missing.join(', '));
  if (extra.length) fail(lang, 'cles en trop :', extra.join(', '));
  if (T[lang].faq.length !== T[DEFAULT_LANG].faq.length) fail(lang, 'nombre de questions FAQ');
  for (const k of keys) {
    const v = T[lang][k];
    if (typeof v === 'string' && !v.trim()) fail(lang, 'chaine vide :', k);
  }
  for (const f of T[lang].faq) if (!f.q.trim() || !f.a.trim()) fail(lang, 'question ou reponse vide');
  for (const ph of ['{n}', '{country}', '{len}']) {
    if (!T[lang].meta.includes(ph)) fail(lang, 'meta sans', ph);
  }
  if (!T[lang].msgCopiedMany.includes('{n}')) fail(lang, 'msgCopiedMany sans {n}');
  if (T[lang].title.length > 70) fail(lang, 'title trop long pour le SEO :', T[lang].title.length);
  if (T[lang].desc.length > 200) fail(lang, 'description trop longue :', T[lang].desc.length);
}
console.log(`${LANGS.length} langues : cles, FAQ, variables et longueurs SEO`);

/* ---- pages generees ---- */
for (const lang of LANGS) {
  const file = lang === DEFAULT_LANG ? 'index.html' : `${lang}/index.html`;
  if (!fs.existsSync(new URL('./' + file, import.meta.url))) { fail(lang, 'page absente :', file); continue; }
  const html = fs.readFileSync(new URL('./' + file, import.meta.url), 'utf8');
  const t = T[lang];

  if (!html.includes(`<html lang="${lang}">`)) fail(lang, 'attribut lang');
  if (!html.includes(`<title>`) || !html.includes(t.title.replace(/&/g, '&amp;'))) fail(lang, 'title');
  const alts = (html.match(/rel="alternate" hreflang="/g) || []).length;
  if (alts !== LANGS.length + 1) fail(lang, 'hreflang :', alts, 'au lieu de', LANGS.length + 1);

  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld) { fail(lang, 'JSON-LD absent'); continue; }
  let data;
  try { data = JSON.parse(ld[1]); } catch (e) { fail(lang, 'JSON-LD invalide'); continue; }
  const faq = data['@graph'].find(x => x['@type'] === 'FAQPage');
  if (!faq || faq.mainEntity.length !== t.faq.length) fail(lang, 'FAQPage incomplete');
  /* une question balisee doit exister telle quelle dans la page */
  for (const q of faq.mainEntity) {
    const needle = q.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    if (!html.includes(`<h3>${needle}</h3>`)) fail(lang, 'question balisee absente du corps :', q.name);
  }

  const rt = html.match(/window\.__I18N=(\{[\s\S]*?\})<\/script>/);
  if (!rt) { fail(lang, 'chaines d interface absentes'); continue; }
  let runtime;
  try { runtime = JSON.parse(rt[1]); } catch (e) { fail(lang, 'chaines d interface invalides'); continue; }
  if (runtime.lang !== lang) fail(lang, 'langue injectee incorrecte');
  if (Object.keys(runtime.countries).length !== 27) fail(lang, 'noms de pays :', Object.keys(runtime.countries).length);
  for (const code of Object.keys(IBAN.SPECS)) {
    if (!runtime.countries[code]) fail(lang, 'nom de pays manquant :', code);
    if (!html.includes(`>${code} &middot; ${IBAN.SPECS[code].length} `)) fail(lang, 'pays absent de la liste :', code);
  }
  const assets = lang === DEFAULT_LANG ? 'assets/' : '../assets/';
  if (!html.includes(`src="${assets}app.js"`)) fail(lang, 'chemin des assets');
}
console.log(`${LANGS.length} pages : hreflang, JSON-LD, FAQ, 27 pays et chemins`);

console.log(failures ? `\n${failures} echec(s)` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
