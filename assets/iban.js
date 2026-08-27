/* IBAN engine - 27 pays de l'UE.
   Structure nationale (ISO 13616) + cle de controle IBAN (ISO 7064 mod 97-10)
   + cles de controle nationales quand elles existent (BE, ES, FR, IT, PT, FI, SI, EE).
   Les codes banque listes sont des codes reels, les numeros de compte sont aleatoires :
   les IBAN produits sont valides mais ne designent aucun compte existant. */
(function (global) {
  'use strict';

  var DIGITS = '0123456789';
  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var ALNUM = DIGITS + ALPHA;

  function randInt(max) {
    if (global.crypto && global.crypto.getRandomValues) {
      var lim = Math.floor(4294967296 / max) * max, a = new Uint32Array(1);
      do { global.crypto.getRandomValues(a); } while (a[0] >= lim);
      return a[0] % max;
    }
    return Math.floor(Math.random() * max);
  }
  function pick(arr) { return arr[randInt(arr.length)]; }
  function randStr(len, type) {
    var pool = type === 'n' ? DIGITS : type === 'a' ? ALPHA : ALNUM, s = '';
    for (var i = 0; i < len; i++) s += pool.charAt(randInt(pool.length));
    return s;
  }

  /* mod 97 sur une longue chaine de chiffres */
  function mod97(numeric) {
    var rest = 0;
    for (var i = 0; i < numeric.length; i++) rest = (rest * 10 + (numeric.charCodeAt(i) - 48)) % 97;
    return rest;
  }
  /* lettres -> nombres (A=10 ... Z=35) */
  function toNumeric(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += (c >= '0' && c <= '9') ? c : String(c.charCodeAt(0) - 55);
    }
    return out;
  }
  function pad(n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; }

  /* ISO 7064 mod 97-10 : deux chiffres de controle */
  function mod9710(digits) { return pad(98 - mod97(digits + '00'), 2); }

  /* ---- cles de controle nationales ---- */
  var NATIONAL = {
    /* BE : 3 banque + 7 compte + 2 cle = (10 chiffres) mod 97, 0 -> 97 */
    BE: function (b) { var r = mod97(b.slice(0, 10)) || 97; return b.slice(0, 10) + pad(r, 2); },

    /* ES : 2 chiffres de controle (banque+agence, puis compte) */
    ES: function (b) {
      var w = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
      function dc(s) {
        var sum = 0;
        for (var i = 0; i < 10; i++) sum += (s.charCodeAt(i) - 48) * w[i];
        var r = 11 - (sum % 11);
        return r === 10 ? 1 : r === 11 ? 0 : r;
      }
      return b.slice(0, 8) + dc('00' + b.slice(0, 8)) + dc(b.slice(10, 20)) + b.slice(10);
    },

    /* FR : cle RIB = 97 - (89*banque + 15*guichet + 3*compte) mod 97 */
    FR: function (b) {
      var n = (BigInt(89) * BigInt(b.slice(0, 5)) +
               BigInt(15) * BigInt(b.slice(5, 10)) +
               BigInt(3) * BigInt(b.slice(10, 21))) % BigInt(97);
      return b.slice(0, 21) + pad(97 - Number(n), 2);
    },

    /* IT : CIN (lettre) calculee sur les 22 caracteres suivants */
    IT: function (b) {
      var ODD = { '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
        A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20,
        O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
      var rest = b.slice(1), sum = 0;
      for (var i = 0; i < rest.length; i++) {
        var ch = rest.charAt(i);
        if (i % 2 === 0) sum += ODD[ch];                                  /* positions impaires (1-based) */
        else sum += (ch >= '0' && ch <= '9') ? ch.charCodeAt(0) - 48 : ALPHA.indexOf(ch);
      }
      return ALPHA.charAt(sum % 26) + rest;
    },

    /* PT : 2 chiffres sur les 19 precedents */
    PT: function (b) { return b.slice(0, 19) + mod9710(b.slice(0, 19)); },

    /* SI : 2 chiffres sur les 13 precedents */
    SI: function (b) { return b.slice(0, 13) + mod9710(b.slice(0, 13)); },

    /* FI : cle de Luhn sur les 13 premiers chiffres */
    FI: function (b) {
      var s = b.slice(0, 13), sum = 0, dbl = true;
      for (var i = s.length - 1; i >= 0; i--) {
        var d = s.charCodeAt(i) - 48;
        if (dbl) { d *= 2; if (d > 9) d -= 9; }
        dbl = !dbl;
        sum += d;
      }
      return s + String((10 - (sum % 10)) % 10);
    },

    /* EE : dernier chiffre, poids 7-3-1 appliques de droite a gauche */
    EE: function (b) {
      var s = b.slice(0, 15), w = [1, 3, 7], sum = 0;
      for (var i = 0; i < s.length; i++) sum += (s.charCodeAt(i) - 48) * w[(s.length - 1 - i) % 3];
      return s + String((10 - (sum % 10)) % 10);
    }
  };

  /* ---- specifications par pays ----
     parts : suite de blocs { len, type n|a|c, bank:true pour le code banque } */
  function C(name, flag, len, parts, banks) {
    return { name: name, flag: flag, length: len, parts: parts, banks: banks || null };
  }
  function n(l, bank) { return { len: l, type: 'n', bank: !!bank }; }
  function a(l, bank) { return { len: l, type: 'a', bank: !!bank }; }
  function c(l) { return { len: l, type: 'c', bank: false }; }

  var SPECS = {
    AT: C('Autriche', '🇦🇹', 20, [n(5, 1), n(11)],
      [['20111', 'Erste Bank'], ['12000', 'UniCredit Bank Austria'], ['60000', 'BAWAG P.S.K.'], ['19190', 'Raiffeisen']]),
    BE: C('Belgique', '🇧🇪', 16, [n(3, 1), n(7), n(2)],
      [['001', 'BNP Paribas Fortis'], ['063', 'Belfius'], ['733', 'KBC'], ['630', 'ING Belgique']]),
    BG: C('Bulgarie', '🇧🇬', 22, [a(4, 1), n(4), n(2), c(8)],
      [['UNCR', 'UniCredit Bulbank'], ['STSA', 'Banque DSK'], ['FINV', 'First Investment Bank'], ['BUIN', 'Allianz Bank Bulgaria']]),
    HR: C('Croatie', '🇭🇷', 21, [n(7, 1), n(10)],
      [['2360000', 'Zagrebačka banka'], ['2340009', 'PBZ'], ['2402006', 'Erste'], ['2407000', 'OTP']]),
    CY: C('Chypre', '🇨🇾', 28, [n(3, 1), n(5), c(16)],
      [['002', 'Bank of Cyprus'], ['005', 'Hellenic Bank'], ['007', 'Alpha Bank Cyprus']]),
    CZ: C('Tchéquie', '🇨🇿', 24, [n(4, 1), n(6), n(10)],
      [['0100', 'Komerční banka'], ['0800', 'Česká spořitelna'], ['0300', 'ČSOB'], ['2010', 'Fio banka']]),
    DK: C('Danemark', '🇩🇰', 18, [n(4, 1), n(9), n(1)],
      [['0040', 'Nordea'], ['3000', 'Danske Bank'], ['5301', 'Arbejdernes Landsbank']]),
    EE: C('Estonie', '🇪🇪', 20, [n(2, 1), n(2), n(11), n(1)],
      [['22', 'Swedbank'], ['10', 'SEB'], ['17', 'Luminor'], ['77', 'LHV Pank']]),
    FI: C('Finlande', '🇫🇮', 18, [n(6, 1), n(7), n(1)],
      [['405500', 'OP'], ['182000', 'Nordea'], ['339900', 'Handelsbanken']]),
    FR: C('France', '🇫🇷', 27, [n(5, 1), n(5), n(11), n(2)],
      [['30004', 'BNP Paribas'], ['30003', 'Société Générale'], ['30002', 'LCL'],
       ['20041', 'La Banque Postale'], ['10278', 'Crédit Mutuel']]),
    DE: C('Allemagne', '🇩🇪', 22, [n(8, 1), n(10)],
      [['10070024', 'Deutsche Bank'], ['50010517', 'ING'], ['37040044', 'Commerzbank'],
       ['70020270', 'HypoVereinsbank'], ['43060967', 'GLS Bank']]),
    GR: C('Grèce', '🇬🇷', 27, [n(3, 1), n(4), c(16)],
      [['011', 'National Bank of Greece'], ['014', 'Alpha Bank'], ['026', 'Eurobank'], ['017', 'Piraeus Bank']]),
    HU: C('Hongrie', '🇭🇺', 28, [n(3, 1), n(4), n(1), n(15), n(1)],
      [['117', 'OTP Bank'], ['109', 'UniCredit'], ['104', 'K&H Bank']]),
    IE: C('Irlande', '🇮🇪', 22, [a(4, 1), n(6), n(8)],
      [['AIBK', 'Allied Irish Banks'], ['BOFI', 'Bank of Ireland'], ['IPBS', 'Permanent TSB'], ['CITI', 'Citibank']]),
    IT: C('Italie', '🇮🇹', 27, [a(1), n(5, 1), n(5), c(12)],
      [['02008', 'UniCredit'], ['03069', 'Intesa Sanpaolo'], ['05034', 'Banco BPM'], ['01005', 'BNL']]),
    LV: C('Lettonie', '🇱🇻', 21, [a(4, 1), c(13)],
      [['HABA', 'Swedbank'], ['UNLA', 'SEB banka'], ['RTMB', 'Rietumu Banka'], ['PARX', 'Citadele']]),
    LT: C('Lituanie', '🇱🇹', 20, [n(5, 1), n(11)],
      [['73000', 'Swedbank'], ['70440', 'SEB'], ['21400', 'Luminor'], ['32250', 'Revolut']]),
    LU: C('Luxembourg', '🇱🇺', 20, [n(3, 1), c(13)],
      [['001', 'BCEE'], ['002', 'BGL BNP Paribas'], ['003', 'Banque Internationale']]),
    MT: C('Malte', '🇲🇹', 31, [a(4, 1), n(5), c(18)],
      [['VALL', 'Bank of Valletta'], ['MMEB', 'HSBC Malta'], ['APSB', 'APS Bank'], ['FIMB', 'FIMBank']]),
    NL: C('Pays-Bas', '🇳🇱', 18, [a(4, 1), n(10)],
      [['INGB', 'ING'], ['RABO', 'Rabobank'], ['ABNA', 'ABN AMRO'], ['SNSB', 'SNS Bank'],
       ['TRIO', 'Triodos'], ['BUNQ', 'bunq'], ['KNAB', 'Knab']]),
    PL: C('Pologne', '🇵🇱', 28, [n(8, 1), n(16)],
      [['10201026', 'PKO Bank Polski'], ['11402004', 'mBank'], ['10901014', 'Santander Bank Polska'], ['12401053', 'Pekao']]),
    PT: C('Portugal', '🇵🇹', 25, [n(4, 1), n(4), n(11), n(2)],
      [['0033', 'Millennium BCP'], ['0035', 'Caixa Geral de Depósitos'], ['0007', 'Novo Banco'], ['0010', 'BPI']]),
    RO: C('Roumanie', '🇷🇴', 24, [a(4, 1), c(16)],
      [['BTRL', 'Banca Transilvania'], ['RNCB', 'BCR'], ['BRDE', 'BRD'], ['RZBR', 'Raiffeisen']]),
    SK: C('Slovaquie', '🇸🇰', 24, [n(4, 1), n(6), n(10)],
      [['0900', 'Slovenská sporiteľňa'], ['0200', 'VUB Banka'], ['7500', 'ČSOB'], ['1100', 'Tatra banka']]),
    SI: C('Slovénie', '🇸🇮', 19, [n(5, 1), n(8), n(2)],
      [['02', 'NLB'], ['03', 'SKB banka'], ['04', 'Nova KBM'], ['06', 'Banka Koper']]),
    ES: C('Espagne', '🇪🇸', 24, [n(4, 1), n(4), n(2), n(10)],
      [['0049', 'Banco Santander'], ['0182', 'BBVA'], ['2100', 'CaixaBank'],
       ['0081', 'Banco Sabadell'], ['0128', 'Bankinter']]),
    SE: C('Suède', '🇸🇪', 24, [n(3, 1), n(16), n(1)],
      [['500', 'SEB'], ['600', 'Handelsbanken'], ['800', 'Swedbank'], ['300', 'Nordea']])
  };

  /* place le code banque dans son bloc (certains codes sont plus courts que le bloc) */
  function fillPart(part, bankCode) {
    if (bankCode && bankCode.length <= part.len) {
      return bankCode + (bankCode.length === part.len ? '' : randStr(part.len - bankCode.length, part.type));
    }
    return randStr(part.len, part.type);
  }

  function generate(code) {
    var spec = SPECS[code];
    if (!spec) throw new Error('Pays non supporte : ' + code);

    var bank = spec.banks ? pick(spec.banks) : null;
    var bban = '', bankDone = false;
    for (var i = 0; i < spec.parts.length; i++) {
      var p = spec.parts[i];
      var useCode = (p.bank && !bankDone && bank) ? bank[0] : null;
      bban += fillPart(p, useCode);
      if (useCode) bankDone = true;
    }
    if (NATIONAL[code]) bban = NATIONAL[code](bban);

    var iban = code + pad(98 - mod97(toNumeric(bban + code + '00')), 2) + bban;
    if (iban.length !== spec.length) throw new Error('Longueur invalide pour ' + code + ' : ' + iban.length);
    return {
      iban: iban,
      country: code,
      countryName: spec.name,
      bank: bank ? bank[1] : null,
      bankCode: bank ? bank[0] : null
    };
  }

  function generateMany(code, count) {
    var out = [], seen = Object.create(null);
    for (var i = 0; i < count; i++) {
      var r, tries = 0;
      do { r = generate(code); tries++; } while (seen[r.iban] && tries < 5);
      seen[r.iban] = 1;
      out.push(r);
    }
    return out;
  }

  function validate(value) {
    var s = String(value).toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(s)) return false;
    return mod97(toNumeric(s.slice(4) + s.slice(0, 4))) === 1;
  }

  function format(iban) { return iban.replace(/(.{4})/g, '$1 ').trim(); }

  global.IBAN = {
    SPECS: SPECS,
    generate: generate,
    generateMany: generateMany,
    validate: validate,
    format: format
  };
})(typeof window !== 'undefined' ? window : globalThis);
