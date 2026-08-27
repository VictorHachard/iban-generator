# IBAN Generator

Générateur d'IBAN valides pour les 27 pays de l'Union européenne, traduit dans les
24 langues officielles de l'UE. Thème sombre, zéro dépendance, zéro pub, zéro compte,
zéro paiement. Tout tourne dans le navigateur.

## Ce que ça fait

- Détecte le pays automatiquement (langue du navigateur, puis fuseau horaire) — modifiable.
- Génère 1 IBAN, ou une liste jusqu'à 1000.
- Copie en un clic avec retour visuel sur l'élément cliqué, export `.txt` et `.csv`.
- Format national respecté (ISO 13616), clé de contrôle IBAN (ISO 7064 mod 97-10) valide,
  et clés de contrôle **nationales** pour BE, ES, FR, IT, PT, FI, SI, EE.
- Codes banque réels (BNP Paribas, ING, Santander, Rabobank, UniCredit…), numéros de compte aléatoires.

## Langues

24 langues officielles de l'UE, qui couvrent les 27 pays : bg, cs, da, de, el, en, es, et,
fi, fr, ga, hr, hu, it, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv.

Chaque langue est une **page statique** à son propre URL (`/` en français, `/de/`, `/es/`…),
avec son `<title>`, sa description, son JSON-LD et ses `hreflang`. Le sélecteur en haut de
page ne fait que naviguer : rien n'est traduit à la volée, donc tout est indexable sans
JavaScript. Les noms de pays viennent d'ICU (`Intl.DisplayNames`), au build.

## Build

`index.html` et les 23 dossiers de langue sont **générés**. Après toute modification de
`i18n.mjs`, `build.mjs` ou `assets/iban.js` :

```bash
node build.mjs
```

Une fois l'URL du site connue, régénérez avec des URLs absolues — canonical, hreflang,
`og:url` et `sitemap.xml` :

```bash
node build.mjs --url https://<utilisateur>.github.io/iban-generator/
```

## Avertissement

Les IBAN générés sont *structurellement* valides mais ne correspondent à **aucun compte bancaire réel**.
C'est fait pour tester des formulaires, des validateurs et des jeux de données de test.
Toute utilisation frauduleuse est illégale.

## Publier sur GitHub Pages

Settings → Pages → Source : `Deploy from a branch`, branche `main`, dossier `/ (root)`.
Le site est ensuite servi sur `https://<utilisateur>.github.io/iban-generator/`.

## Tests

```bash
node test.mjs
```

Vérifie, pour les 27 pays, la longueur, le format des blocs et la clé de contrôle sur
3000 IBAN générés ; recalcule les clés nationales à partir d'IBAN de référence publics ;
puis contrôle les 24 traductions (mêmes clés, variables présentes, longueurs SEO) et les
24 pages générées (`hreflang`, JSON-LD, FAQ présente dans le corps, 27 pays, chemins).

## SEO

- Title et meta description par langue, `robots`, Open Graph, Twitter Card.
- JSON-LD `WebApplication` + `FAQPage` ; les questions balisées existent mot pour mot
  dans la page, condition pour l'affichage en résultat enrichi (le test le vérifie).
- `hreflang` réciproques entre les 24 langues, plus `x-default` vers l'anglais.
- Contenu réel indexable : « Comment ça marche », les 27 pays avec leur longueur d'IBAN,
  une FAQ. Hiérarchie h1 → h2 → h3.
- `robots.txt`, page unique sans dépendance externe (bon pour les Core Web Vitals).
- Sans `--url`, `canonical` et `og:url` sont posés au chargement par le JS. Les crawlers
  des réseaux sociaux n'exécutant pas JavaScript, préférez `--url` dès que possible, et
  ajoutez une `og:image` (1200 × 630).

## Structure

```
i18n.mjs          traductions (24 langues) — utilisées au build
build.mjs         génère index.html + <lang>/index.html (+ sitemap.xml avec --url)
assets/iban.js    moteur (spécifications pays, clés de contrôle)
assets/app.js     interface
assets/style.css  thème sombre
test.mjs          tests
robots.txt
index.html        généré (français)
<lang>/index.html généré (23 autres langues)
```
