/*
 * Kiljutalous: hinnat, myynti, kokemus ja taitopuu.
 * Ei riippuvuutta DOMiin, joten toimii myös Nodessa.
 */
(function (root) {
  'use strict';

  var START_MONEY = 15;
  var SUGAR_EUR_PER_KG = 1.2;
  var NUTRIENT_EUR = 1.5;

  var PRICES = {
    fruits: { sitruuna: 1.5, omena: 2.5, herukka: 3.5, puolukka: 3, rusina: 2, ananas: 3 },
    spices: { vanilja: 3.5, kaneli: 1, inkivaari: 1.5, minttu: 1.2, humala: 2.5, chili: 0.8 },
    // €/g
    yeasts: { leivin: 0.02, olut: 0.1, viini: 0.1, samppanja: 0.13, turbo: 0.15 },
    cleaning: { ei: 0, huuhdo: 0, pesu: 0.3, desinf: 2 }
  };

  // Kertaostokset, jotka jäävät omiksi
  var EQUIPMENT = {
    airlock: { name: 'Kansi ja ilmalukko', price: 6 }
  };

  var SKILLS = {
    siisteys: { name: 'Siisteysintoilija', emoji: '🧽', max: 3, requires: {},
                desc: 'Bakteerit pärjäävät huonommin: infektioriski −25 % per taso.' },
    maistelu: { name: 'Maistelija', emoji: '👅', max: 3, requires: {},
                desc: 'Tiedät mikä toimii: maku +2 per taso.' },
    kauppa:   { name: 'Kaupparatsu', emoji: '🤝', max: 3, requires: {},
                desc: 'Saat kiljusta paremman hinnan: myyntihinta +12 % per taso.' },
    lampo:    { name: 'Lämpövelho', emoji: '🌡️', max: 3, requires: { siisteys: 1 },
                desc: 'Hallitset lämpöä: fuselit −25 % ja sähkölasku −25 % per taso.' },
    hiiva:    { name: 'Hiivakuiskaaja', emoji: '🦠', max: 3, requires: { maistelu: 1 },
                desc: 'Hiiva jaksaa pidempään: alkoholinsieto +1 %-yks. ja kirkastuminen +30 % per taso.' },
    tukku:    { name: 'Tukkuostaja', emoji: '📦', max: 3, requires: { kauppa: 1 },
                desc: 'Ostat isommissa erissä: raaka-aineet −10 % per taso.' },
    mestari:  { name: 'Kiljumestari', emoji: '👑', max: 1, requires: { lampo: 2, hiiva: 2 },
                desc: 'Legendaarinen taito: maku +5, alkoholinsieto +1 %-yks. ja myyntihinta +10 %.' }
  };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lvl(state, k) { return (state.skills && state.skills[k]) || 0; }
  function round2(v) { return Math.round(v * 100) / 100; }

  function newState() {
    return { money: START_MONEY, batch: 1, xp: 0, spentPoints: 0, skills: {}, owned: {}, history: [], bestScore: 0, bestMoney: START_MONEY };
  }

  /* Taitopuun vaikutukset simulaatioon */
  function mods(state) {
    return {
      infection: 1 - 0.25 * lvl(state, 'siisteys'),
      fusel: 1 - 0.25 * lvl(state, 'lampo'),
      tol: lvl(state, 'hiiva') + lvl(state, 'mestari'),
      taste: 2 * lvl(state, 'maistelu') + 5 * lvl(state, 'mestari'),
      clarity: 1 + 0.3 * lvl(state, 'hiiva')
    };
  }

  function ingredientDiscount(state) { return 1 - 0.1 * lvl(state, 'tukku'); }
  function energyMultiplier(state) { return 1 - 0.25 * lvl(state, 'lampo'); }

  function sugarCost(state, kg) { return round2(kg * SUGAR_EUR_PER_KG * ingredientDiscount(state)); }

  /* Erän aloituskustannus eriteltynä */
  function recipeCost(recipe, state, names) {
    var d = ingredientDiscount(state), items = [];
    function add(label, eur, equipment) { if (eur > 0) items.push({ label: label, cost: round2(equipment ? eur : eur * d) }); }
    add('Sokeri ' + String(recipe.sugarKg).replace('.', ',') + ' kg', recipe.sugarKg * SUGAR_EUR_PER_KG);
    add((names ? names.yeasts[recipe.yeast].name : recipe.yeast) + ' ' + recipe.yeastG + ' g', recipe.yeastG * PRICES.yeasts[recipe.yeast]);
    if (recipe.nutrient) add('Hiivaravinne', NUTRIENT_EUR);
    recipe.fruits.forEach(function (f) { add(names ? names.fruits[f].name : f, PRICES.fruits[f]); });
    recipe.spices.forEach(function (s) { add(names ? names.spices[s].name : s, PRICES.spices[s]); });
    add(names ? names.cleaning[recipe.cleaning].name : recipe.cleaning, PRICES.cleaning[recipe.cleaning]);
    if (recipe.airlock && !(state.owned && state.owned.airlock)) add(EQUIPMENT.airlock.name + ' (kertaosto)', EQUIPMENT.airlock.price, true);
    var total = 0;
    items.forEach(function (i) { total += i.cost; });
    return { items: items, total: round2(total) };
  }

  /* Halvin mahdollinen erä: alle tämän rahan on konkurssi */
  function minimumBatchCost(state) {
    return recipeCost({ sugarKg: 1, yeast: 'leivin', yeastG: 10, nutrient: false, fruits: [], spices: [],
                        cleaning: 'ei', airlock: false }, state).total;
  }

  /* Myyntihinta €/l: vahvuus nostaa hintaa, huono maku tiputtaa sen nollaan */
  function salePricePerL(result, state) {
    var quality = clamp((result.taste - 15) / 50, 0, 1.6);
    var mult = 1 + 0.12 * lvl(state, 'kauppa') + 0.1 * lvl(state, 'mestari');
    return round2((0.5 + result.abv * 0.1) * quality * mult);
  }

  /* Itse juominen kerryttää kokemusta: hyvä ja vahva kilju opettaa eniten */
  function drinkXp(result, litres) {
    if (result.abv < 1) return 0;
    return Math.round(litres * (0.5 + result.taste / 50) * clamp(result.abv / 10, 0.1, 2));
  }

  /* Taitopisteitä kertyy kokemuksesta, jokainen piste vaatii vähän edellistä enemmän */
  function xpForPoint(n) { return 10 * n + 5 * n * (n - 1) / 2; }
  function earnedPoints(xp) { var n = 0; while (xpForPoint(n + 1) <= xp) n++; return n; }
  function availablePoints(state) { return earnedPoints(state.xp) - state.spentPoints; }
  function nextPointXp(state) { return xpForPoint(earnedPoints(state.xp) + 1); }

  function canLearn(state, key) {
    var s = SKILLS[key];
    if (lvl(state, key) >= s.max || availablePoints(state) < 1) return false;
    return Object.keys(s.requires).every(function (r) { return lvl(state, r) >= s.requires[r]; });
  }

  function learn(state, key) {
    if (!canLearn(state, key)) return false;
    state.skills[key] = lvl(state, key) + 1;
    state.spentPoints += 1;
    return true;
  }

  /*
   * Erän tilitys. startCost on jo maksettu erää aloittaessa.
   * Palauttaa tiedot ja päivittää tilan.
   */
  function settle(state, info) {
    var r = info.result, drink = clamp(info.drinkLitres, 0, info.volume);
    var sold = info.volume - drink;
    var price = salePricePerL(r, state);
    var income = round2(sold * price);
    var energy = round2(info.energyCost * energyMultiplier(state));
    var xp = drinkXp(r, drink);
    var pointsBefore = earnedPoints(state.xp);
    state.money = round2(state.money + income - energy);
    state.xp += xp;
    var profit = round2(income - energy - info.totalCost);
    state.history.push({ batch: state.batch, title: r.title, abv: r.abv, taste: r.taste, score: r.score, profit: profit });
    if (state.history.length > 30) state.history.shift();
    if (r.score > state.bestScore) state.bestScore = r.score;
    if (state.money > state.bestMoney) state.bestMoney = state.money;
    state.batch += 1;
    return {
      sold: sold, drink: drink, price: price, income: income, energy: energy, xp: xp,
      profit: profit, newPoints: earnedPoints(state.xp) - pointsBefore,
      bankrupt: state.money < minimumBatchCost(state)
    };
  }

  var api = {
    START_MONEY: START_MONEY, PRICES: PRICES, EQUIPMENT: EQUIPMENT, SKILLS: SKILLS,
    newState: newState, mods: mods, recipeCost: recipeCost, sugarCost: sugarCost, minimumBatchCost: minimumBatchCost,
    salePricePerL: salePricePerL, drinkXp: drinkXp, energyMultiplier: energyMultiplier,
    earnedPoints: earnedPoints, availablePoints: availablePoints, nextPointXp: nextPointXp, xpForPoint: xpForPoint,
    canLearn: canLearn, learn: learn, level: lvl, settle: settle
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KiljuEconomy = api;
})(this);
