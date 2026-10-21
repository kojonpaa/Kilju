/*
 * Kiljusimulaatio: käymisen malli ja lopputuloksen arviointi.
 * Ei riippuvuuksia DOMiin, joten toimii myös Nodessa testejä varten.
 */
(function (root) {
  'use strict';

  var VOLUME_L = 25;
  var G_PER_ABV = 17; // g/L sokeria yhtä tilavuusprosenttia kohden
  var ENERGY_EUR_PER_DEG_DAY = 0.015;

  var FRUITS = {
    sitruuna:  { name: 'Sitruuna',       emoji: '🍋', sugar: 2,  nutrient: 0.05, acid: 0.30, flavor: 8,  color: [250, 240, 160] },
    omena:     { name: 'Omenamehu',      emoji: '🍎', sugar: 20, nutrient: 0.20, acid: 0.15, flavor: 10, color: [240, 200, 120] },
    herukka:   { name: 'Mustaherukka',   emoji: '🫐', sugar: 6,  nutrient: 0.25, acid: 0.25, flavor: 14, color: [120, 30, 80] },
    puolukka:  { name: 'Puolukka',       emoji: '🍒', sugar: 4,  nutrient: 0.15, acid: 0.30, flavor: 11, color: [200, 50, 60] },
    rusina:    { name: 'Rusinat',        emoji: '🍇', sugar: 12, nutrient: 0.45, acid: 0.02, flavor: 5,  color: [200, 150, 90] },
    ananas:    { name: 'Ananas',         emoji: '🍍', sugar: 10, nutrient: 0.20, acid: 0.15, flavor: 12, color: [250, 220, 90] }
  };

  var SPICES = {
    vanilja:   { name: 'Vanilja',    emoji: '🌼', flavor: 7 },
    kaneli:    { name: 'Kaneli',     emoji: '🪵', flavor: 6 },
    inkivaari: { name: 'Inkivääri',  emoji: '🫚', flavor: 7 },
    minttu:    { name: 'Minttu',     emoji: '🌿', flavor: 5 },
    humala:    { name: 'Humala',     emoji: '🌱', flavor: 4 },
    chili:     { name: 'Chili',      emoji: '🌶️', flavor: 3 }
  };

  // Hyviä ja huonoja yhdistelmiä: avain on aakkosjärjestetty pari
  var COMBOS = {
    'ananas+inkivaari': 6, 'omena+kaneli': 8, 'herukka+vanilja': 7,
    'sitruuna+inkivaari': 6, 'sitruuna+minttu': 6, 'puolukka+kaneli': 6,
    'omena+vanilja': 4, 'ananas+chili': 4, 'humala+sitruuna': 4,
    'chili+minttu': -8, 'humala+vanilja': -6, 'herukka+humala': -4,
    'kaneli+minttu': -6, 'ananas+humala': -3
  };

  var YEASTS = {
    leivin:    { name: 'Leivinhiiva',      tol: 11, opt: 30, clean: 27, base: -10, floc: 0.6, nutrient: 0.0,
                 desc: 'Kaupan perushiiva. Halpa, mutta leipäinen maku ja heikko alkoholinsieto.' },
    olut:      { name: 'Oluthiiva',        tol: 9,  opt: 20, clean: 22, base: 2,   floc: 0.9, nutrient: 0.0,
                 desc: 'Hedelmäiset esterit, mutta väsyy jo noin 9 %:ssa.' },
    viini:     { name: 'Viinihiiva',       tol: 15, opt: 22, clean: 25, base: 4,   floc: 0.8, nutrient: 0.1,
                 desc: 'Puhdas ja luotettava. Sietää noin 15 %.' },
    samppanja: { name: 'Samppanjahiiva',   tol: 18, opt: 18, clean: 23, base: 3,   floc: 0.85, nutrient: 0.1,
                 desc: 'Sitkeä ja puhdas, viihtyy viileässä. Sietää noin 18 %.' },
    turbo:     { name: 'Turbohiiva',       tol: 20, opt: 27, clean: 30, base: -4,  floc: 0.5, nutrient: 0.6,
                 desc: 'Ravinteet mukana, sietää jopa 20 %. Maku jää vähän teolliseksi.' }
  };

  var CLEANING = {
    ei:      { name: 'En pese mitään',             value: 0.05 },
    huuhdo:  { name: 'Huuhtelu vedellä',           value: 0.35 },
    pesu:    { name: 'Pesu astianpesuaineella',    value: 0.7 },
    desinf:  { name: 'Pesu + desinfiointi',        value: 0.97 }
  };

  // Avaimet aakkosjärjestykseen, jotta haku toimii valintajärjestyksestä riippumatta
  Object.keys(COMBOS).forEach(function (k) {
    var parts = k.split('+'), norm = comboKey(parts[0], parts[1]);
    if (norm !== k) { COMBOS[norm] = COMBOS[k]; delete COMBOS[k]; }
  });

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function comboKey(a, b) { return a < b ? a + '+' + b : b + '+' + a; }

  /* Satunnaislukugeneraattori siemenellä, jotta tapahtumat ovat toistettavia testeissä */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /*
   * recipe = {
   *   fruits: ['sitruuna', ...], spices: [...], yeast: 'turbo',
   *   sugarKg: 6, yeastG: 30, nutrient: bool, waterTemp: 25, ambient: 22,
   *   cleaning: 'desinf', airlock: bool, seed: number
   * }
   */
  /*
   * mods: taitopuun vaikutukset, esim. { infection: 0.7, fusel: 0.8, tol: 1, taste: 3, clarity: 1.3 }
   */
  function createBatch(recipe, mods) {
    var y = YEASTS[recipe.yeast];
    mods = mods || {};
    mods = {
      infection: mods.infection === undefined ? 1 : mods.infection,
      fusel: mods.fusel === undefined ? 1 : mods.fusel,
      tol: mods.tol || 0,
      taste: mods.taste || 0,
      clarity: mods.clarity || 1
    };
    var fruitSugar = 0, nutrient = 0.5 + y.nutrient + (recipe.nutrient ? 0.45 : 0);
    recipe.fruits.forEach(function (f) { fruitSugar += FRUITS[f].sugar; nutrient += FRUITS[f].nutrient; });
    nutrient = clamp(nutrient, 0.2, 1.3);

    var sugar = recipe.sugarKg * 1000 / VOLUME_L + fruitSugar;
    var T0 = recipe.waterTemp;
    // Kuuma vesi tappaa hiivaa ennen kuin se ehtii töihin
    var viability = T0 <= 38 ? 1 : clamp(1 - (T0 - 38) / 12, 0, 1);
    var clean = CLEANING[recipe.cleaning].value;

    var b = {
      recipe: recipe,
      yeast: y,
      hour: 0,
      sugar: sugar,
      sugar0: sugar,
      sugarAdded: 0,
      abv: 0,
      temp: T0,
      ambient: recipe.ambient,
      cells: (recipe.yeastG / 400) * viability,
      viability: viability,
      nutrient: nutrient,
      capacity: clamp(nutrient, 0.25, 1.1),
      fusel: 0,
      infection: ((1 - clean) * 0.03 * (recipe.airlock ? 1 : 2) + 0.0005) * mods.infection,
      mods: mods,
      tol: y.tol + mods.tol,
      energyCost: 0,
      oxidation: 0,
      restHours: 0,
      stirs: 0,
      activity: 0,
      peakTemp: T0,
      events: [],
      history: [],
      eventFlags: {},
      rand: rng(recipe.seed || 12345),
      done: false
    };
    if (viability <= 0) addEvent(b, 'bad', 'Kuuma vesi keitti hiivat hengiltä. Ämpärissä on nyt makeaa vettä.');
    else if (viability < 1) addEvent(b, 'warn', 'Vesi oli liian kuumaa, osa hiivasta kuoli heti.');
    if (T0 < 12) addEvent(b, 'warn', 'Kylmä vesi: hiiva heräilee hitaasti.');
    if (sugar > 320) addEvent(b, 'warn', 'Todella paljon sokeria kerralla. Hiiva kärsii osmoottisesta stressistä.');
    record(b);
    return b;
  }

  function addEvent(b, kind, text) {
    b.events.push({ day: Math.floor(b.hour / 24) + 1, kind: kind, text: text });
  }

  function record(b) {
    b.history.push({ day: b.hour / 24, sugar: b.sugar, abv: b.abv, temp: b.temp, activity: b.activity });
  }

  function tempFactor(y, T) {
    if (T >= 45) return 0;
    var f = Math.exp(-Math.pow((T - y.opt) / 12, 2));
    if (T > 38) f *= clamp((45 - T) / 7, 0, 1);
    return f;
  }

  function stepHour(b) {
    var y = b.yeast;
    var T = b.temp;
    var tf = tempFactor(y, T);
    var alcFactor = Math.sqrt(clamp(1 - b.abv / b.tol, 0, 1));
    var sugarFactor = b.sugar / (b.sugar + 6);
    var osmotic = b.sugar > 300 ? clamp(1 - (b.sugar - 300) / 250, 0.15, 1) : 1;
    var nutFactor = clamp(0.4 + b.nutrient * 0.6, 0.4, 1.2);

    // Hiivan kasvu ja kuolema
    var growth = 0.09 * b.cells * (1 - b.cells / b.capacity) * tf * alcFactor * osmotic * Math.min(1, sugarFactor * 3);
    var death = b.cells * (0.002 + (T > 40 ? 0.05 * (T - 40) : 0) + (alcFactor < 0.1 ? 0.01 : 0));
    b.cells = clamp(b.cells + growth - death, 0, 2);

    // Sokerin syönti
    var activity = b.cells * tf * alcFactor * sugarFactor * osmotic * nutFactor;
    var eaten = Math.min(b.sugar, 2.8 * activity);
    b.sugar -= eaten;
    b.abv += eaten / G_PER_ABV;
    b.activity = activity;

    // Käyminen tuottaa lämpöä, ämpäri tasaantuu kohti huoneenlämpöä
    var target = b.ambient + 5 * activity;
    b.temp += (target - b.temp) * 0.07;
    if (b.temp > b.peakTemp) b.peakTemp = b.temp;

    // Liian lämmin käyminen = fuseliöljyjä ja liuotinmakua
    if (T > y.clean) b.fusel += activity * (T - y.clean) * 0.0025 * b.mods.fusel;
    // Hapekas ja ravinneköyhä käyminen stressaa myös hiivaa
    if (b.nutrient < 0.4) b.fusel += activity * 0.0008;

    // Bakteerit ja villihiivat: menestyvät kun hiivaa on vähän ja alkoholia vähän
    var protect = clamp(1 - b.abv / 9, 0, 1) / (1 + 10 * b.cells);
    var airlock = b.recipe.airlock ? 1 : 1.8;
    var warmth = clamp((T - 5) / 20, 0.1, 1.5);
    b.infection += 0.035 * b.infection * (1 - b.infection) * protect * airlock * warmth * b.mods.infection;
    if (!b.recipe.airlock && b.activity < 0.05) b.oxidation += 0.0015;

    // Käymisen jälkeen hiiva laskeutuu ja alkaa vähitellen hajota
    if (activity < 0.03 && b.hour > 24) b.restHours += 1;
    else b.restHours = Math.max(0, b.restHours - 2);

    // Lämmitys tai jäähdytys poikkeamana normaalista 18 asteen huoneesta maksaa sähköä
    b.energyCost += Math.abs(b.ambient - 18) * ENERGY_EUR_PER_DEG_DAY / 24;

    b.hour += 1;
    events(b);
  }

  function events(b) {
    var f = b.eventFlags, day = b.hour / 24;
    if (!f.start && b.activity > 0.15) { f.start = 1; addEvent(b, 'good', 'Ilmalukko alkoi pulputtaa. Käyminen on käynnissä!'); }
    if (!f.hot && b.temp > b.yeast.clean + 1 && b.activity > 0.2) {
      f.hot = 1; addEvent(b, 'warn', 'Ämpäri on kuuma (' + b.temp.toFixed(1) + ' °C). Hiiva tuottaa nyt fuselimakuja.');
    }
    if (!f.boil && b.temp > 40) { f.boil = 1; addEvent(b, 'bad', 'Yli 40 °C! Hiivat alkavat kuolla.'); }
    if (!f.infect && b.infection > 0.08) { f.infect = 1; addEvent(b, 'bad', 'Pinnalla kelluu epäilyttävä kalvo ja haistuu etikka...'); }
    if (!f.flies && b.infection > 0.03 && !b.recipe.airlock) { f.flies = 1; addEvent(b, 'warn', 'Banaanikärpäsiä parveilee ämpärin ympärillä.'); }
    if (!f.tol && b.abv > b.tol * 0.95 && b.sugar > 10) {
      f.tol = 1; addEvent(b, 'warn', 'Hiiva väsyy alkoholiin (' + b.abv.toFixed(1) + ' %). Sokeria jää käymättä.');
    }
    if (!f.dry && b.sugar < 3 && b.abv > 2) { f.dry = 1; addEvent(b, 'good', 'Sokerit on syöty loppuun. Kilju alkaa kirkastua.'); }
    if (!f.slow && day > 3 && !f.start) { f.slow = 1; addEvent(b, 'warn', 'Kolme päivää eikä juuri mitään tapahdu. Onko hiiva hengissä?'); }
    if (!f.autol && b.restHours > 24 * 9) { f.autol = 1; addEvent(b, 'warn', 'Pohjasakka on lojunut kauan. Haju muuttuu hiivaiseksi.'); }
    if (!f.flavor && b.rand() < 0.004 && b.activity > 0.2) {
      f.flavor = 1;
      var jokes = ['Naapuri kysyi, mikä täällä haisee niin hyvältä.', 'Kissa istuu ämpärin vieressä ja tuijottaa ilmalukkoa.',
                   'Mummo soitti ja kysyi, onko kilju jo valmista.', 'Ilmalukko soittaa iloista rytmiä.'];
      addEvent(b, 'info', jokes[Math.floor(b.rand() * jokes.length)]);
    }
  }

  function stepDay(b) {
    for (var i = 0; i < 24; i++) stepHour(b);
    record(b);
  }

  /* Pelaajan toimet käymisen aikana */
  function setAmbient(b, t) { b.ambient = clamp(t, 5, 40); }

  function addSugar(b, kg) {
    var gpl = kg * 1000 / VOLUME_L;
    b.sugar += gpl;
    b.sugarAdded += kg;
    b.restHours = 0;
    addEvent(b, 'info', 'Lisäsit ' + String(kg).replace('.', ',') + ' kg sokeria.');
  }

  function stir(b) {
    b.stirs += 1;
    if (b.hour < 48) {
      // Alussa happi auttaa hiivaa lisääntymään
      b.capacity = Math.min(b.capacity + 0.08, 1.3);
      b.cells = Math.min(b.cells * 1.15, b.capacity);
      addEvent(b, 'good', 'Sekoitit. Happi piristää nuorta hiivaa.');
    } else {
      b.oxidation += 0.05;
      b.infection += 0.003;
      addEvent(b, 'warn', 'Sekoitit kesken käymisen. Happi alkaa hapettaa kiljua.');
    }
  }

  /* Lopputuloksen arviointi */
  /* cost: erän kokonaiskustannus euroina (valinnainen). Hinta-laatu lasketaan alkoholilitran hinnasta. */
  function evaluate(b, cost) {
    var r = b.recipe, y = b.yeast;
    var notes = [];
    var taste = 50;

    // Hedelmät
    var fruitFlavor = 0, acid = 0;
    r.fruits.forEach(function (k) { fruitFlavor += FRUITS[k].flavor; acid += FRUITS[k].acid; });
    // Lisäys väljähtyy, jos hedelmiä on paljon: pieni laimennus
    fruitFlavor = fruitFlavor > 25 ? 25 + (fruitFlavor - 25) * 0.3 : fruitFlavor;
    // Kuuma käyminen haihduttaa hedelmäaromit
    if (b.peakTemp > 30) fruitFlavor *= clamp(1 - (b.peakTemp - 30) / 20, 0.4, 1);
    taste += fruitFlavor;
    if (r.fruits.length === 0) notes.push({ kind: 'warn', text: 'Pelkkä sokeri ja vesi: maku jää lattean viinamaiseksi. Hedelmät antavat makua.' });

    // Mausteet
    var spiceFlavor = 0;
    r.spices.forEach(function (k) { spiceFlavor += SPICES[k].flavor; });
    if (r.spices.length > 2) {
      spiceFlavor -= (r.spices.length - 2) * 7;
      notes.push({ kind: 'warn', text: 'Liikaa mausteita: maku on sekava keitos.' });
    }
    taste += spiceFlavor;

    // Yhdistelmät
    var all = r.fruits.concat(r.spices), combo = 0;
    for (var i = 0; i < all.length; i++) {
      for (var j = i + 1; j < all.length; j++) {
        var c = COMBOS[comboKey(all[i], all[j])];
        if (c) {
          combo += c;
          var nameA = (FRUITS[all[i]] || SPICES[all[i]]).name, nameB = (FRUITS[all[j]] || SPICES[all[j]]).name;
          notes.push(c > 0 ? { kind: 'good', text: nameA + ' ja ' + nameB.toLowerCase() + ' sopivat yhteen loistavasti.' }
                           : { kind: 'bad', text: nameA + ' ja ' + nameB.toLowerCase() + ' riitelevät keskenään.' });
        }
      }
    }
    taste += combo;
    if (r.spices.indexOf('chili') >= 0) notes.push({ kind: 'info', text: 'Chili polttaa kurkussa. Rohkea valinta.' });

    // Hiivan oma luonne
    taste += y.base + b.mods.taste;
    if (y.base <= -8) notes.push({ kind: 'warn', text: y.name + ' jättää leipäisen sivumaun.' });

    // Makeus ja happo
    var rs = b.sugar, sweet = 0;
    if (rs < 3) { sweet = acid > 0.4 ? -12 : -6; notes.push({ kind: 'info', text: 'Täysin kuiva kilju. Hiukan jäännössokeria pehmentäisi makua.' }); }
    else if (rs <= 40) { sweet = 8; notes.push({ kind: 'good', text: 'Makeus on kohdallaan.' }); }
    else if (rs <= 70) sweet = 2;
    else { sweet = -clamp((rs - 70) * 0.25, 0, 30); notes.push({ kind: 'bad', text: 'Liian makeaa, kuin siirappia. Hiiva ei jaksanut syödä kaikkea.' }); }
    taste += sweet;
    if (acid >= 0.2 && acid <= 0.55) taste += 5;
    else if (acid > 0.75) { taste -= (acid - 0.75) * 30 + 5; notes.push({ kind: 'warn', text: 'Hapan. Liian monta happamaa hedelmää.' }); }

    // Alkoholin polte
    var burn = 0;
    if (b.abv > 13) {
      burn = (b.abv - 13) * 1.6;
      if (rs > 10) burn *= 0.6; // makeus peittää
      if (fruitFlavor + spiceFlavor > 25) burn *= 0.8;
      if (burn > 4) notes.push({ kind: 'info', text: 'Alkoholi polttaa selvästi. Vahvaa tavaraa!' });
    }
    taste -= burn;

    // Hiivan määrä
    if (r.yeastG > 60) {
      taste -= (r.yeastG - 60) * 0.3;
      notes.push({ kind: 'warn', text: 'Liikaa hiivaa: maistuu hiivaiselta.' });
    } else if (r.yeastG < 10) {
      notes.push({ kind: 'info', text: 'Hiivaa oli niukasti, käyminen lähti hitaasti.' });
    }

    // Virheet
    var fuselPen = clamp(b.fusel * 30, 0, 40);
    if (fuselPen > 3) notes.push({ kind: 'bad', text: 'Liuotinmainen fuselimaku: käyminen oli liian kuuma (huippu ' + b.peakTemp.toFixed(1) + ' °C).' });
    taste -= fuselPen;

    var infPen = clamp((b.infection - 0.01) * 120, 0, 60);
    if (infPen > 15) notes.push({ kind: 'bad', text: 'Etikkainen ja homeinen. Puhtaus ja ilmalukko ratkaisevat!' });
    else if (infPen > 4) notes.push({ kind: 'warn', text: 'Lievä hapan sivumaku: bakteereita pääsi mukaan. Parempi puhtaus auttaisi.' });
    else if (CLEANING[r.cleaning].value >= 0.9) notes.push({ kind: 'good', text: 'Puhdas työskentely kannatti: ei bakteerimakuja.' });
    taste -= infPen;

    var oxPen = clamp(b.oxidation * 60, 0, 20);
    if (oxPen > 3) notes.push({ kind: 'warn', text: 'Hapettunut, vanhan omenan maku.' });
    taste -= oxPen;

    var autolysis = b.restHours > 24 * 8 ? (b.restHours / 24 - 8) * 1.5 : 0;
    autolysis = clamp(autolysis, 0, 20);
    if (autolysis > 2) notes.push({ kind: 'warn', text: 'Seisoi liian kauan sakan päällä: hiivainen, kumimainen maku.' });
    taste -= autolysis;

    // Kirkkaus
    var clarity = clamp((b.restHours / 24) / 5 * b.mods.clarity, 0, 1) * y.floc + (b.activity < 0.03 ? 0.1 : 0);
    clarity = clamp(clarity, 0, 1);
    taste += clarity * 8;
    if (clarity < 0.3) notes.push({ kind: 'info', text: 'Sameaa kuin lätäkkövesi. Odota muutama päivä käymisen jälkeen, niin kilju kirkastuu.' });
    else if (clarity > 0.7) notes.push({ kind: 'good', text: 'Kirkasta ja kaunista.' });

    if (b.abv < 1) {
      taste = Math.min(taste, 25);
      notes.unshift({ kind: 'bad', text: 'Käymistä ei käytännössä tapahtunut. Tämä on sokerivettä.' });
    } else if (b.abv < 4) {
      notes.push({ kind: 'warn', text: 'Pullotettu liian aikaisin: miedompaa kuin kotikalja.' });
    }

    taste = clamp(Math.round(taste), 0, 100);
    // Pisteet: vahvuus 40, maku 40, hinta-laatu 20
    var alcLitres = VOLUME_L * b.abv / 100;
    var costPerAlcL = cost === undefined ? null : (alcLitres > 0.05 ? cost / alcLitres : Infinity);
    var efficiency = costPerAlcL === null ? 0.5 : clamp((15 - costPerAlcL) / 12, 0, 1);
    var abvScore = clamp(b.abv / 18, 0, 1.05) * 40;
    var score = Math.round(clamp(abvScore + taste * 0.4 + efficiency * 20, 0, 100));
    if (costPerAlcL !== null && isFinite(costPerAlcL)) {
      if (efficiency > 0.75) notes.push({ kind: 'good', text: 'Edullista: alkoholilitra maksoi vain ' + costPerAlcL.toFixed(2).replace('.', ',') + ' €.' });
      else if (efficiency < 0.3) notes.push({ kind: 'warn', text: 'Kallis erä: alkoholilitra maksoi ' + costPerAlcL.toFixed(2).replace('.', ',') + ' €.' });
    }

    return {
      abv: Math.round(b.abv * 10) / 10,
      residualSugar: Math.round(rs),
      taste: taste,
      clarity: clarity,
      score: score,
      efficiency: efficiency,
      costPerAlcL: costPerAlcL,
      alcLitres: alcLitres,
      title: titleFor(score, b, taste),
      notes: notes,
      days: Math.round(b.hour / 24),
      color: liquidColor(r, clarity, b.infection)
    };
  }

  function titleFor(score, b, taste) {
    if (b.abv < 1) return 'Sokerivettä';
    if (b.infection > 0.25) return 'Etikkaämpäri';
    if (b.fusel > 0.8) return 'Akkuhappo';
    if (score >= 90) return 'Legendaarinen mestarikilju';
    if (score >= 80) return 'Juhannuksen kuningaskilju';
    if (score >= 70) return 'Kunnon kilju';
    if (score >= 58) return 'Ihan juotavaa';
    if (b.abv > 12 && taste < 40) return 'Vahvaa mutta kamalaa';
    if (taste > 60 && b.abv < 8) return 'Mummon mehu';
    if (score >= 45) return 'Opiskelijabileiden peruskilju';
    return 'Kaatakaa viemäriin';
  }

  function liquidColor(r, clarity, infection) {
    var c = [245, 235, 200], n = 1;
    r.fruits.forEach(function (k) {
      var fc = FRUITS[k].color;
      c[0] += fc[0]; c[1] += fc[1]; c[2] += fc[2]; n++;
    });
    c = c.map(function (v) { return Math.round(v / n); });
    if (infection > 0.1) c = [Math.round(c[0] * 0.8 + 30), Math.round(c[1] * 0.8 + 30), Math.round(c[2] * 0.6)];
    var alpha = 0.95 - clarity * 0.35;
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha.toFixed(2) + ')';
  }

  /* Ajaa koko käymisen kerralla (testeihin ja tasapainotukseen) */
  function simulate(recipe, days) {
    var b = createBatch(recipe);
    for (var d = 0; d < days; d++) stepDay(b);
    return { batch: b, result: evaluate(b) };
  }

  var api = {
    VOLUME_L: VOLUME_L, FRUITS: FRUITS, SPICES: SPICES, YEASTS: YEASTS, CLEANING: CLEANING,
    createBatch: createBatch, stepDay: stepDay, stepHour: stepHour, evaluate: evaluate,
    setAmbient: setAmbient, addSugar: addSugar, stir: stir, simulate: simulate, liquidColor: liquidColor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KiljuSim = api;
})(this);
