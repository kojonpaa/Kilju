const S = require('../js/sim.js'), E = require('../js/economy.js');
const names = { yeasts: S.YEASTS, fruits: S.FRUITS, spices: S.SPICES, cleaning: S.CLEANING };
const base = { fruits: [], spices: [], yeast: 'leivin', sugarKg: 4, yeastG: 25, nutrient: false,
  waterTemp: 25, ambient: 22, cleaning: 'huuhdo', airlock: false, seed: 7 };
const cases = {
  halpa: {},
  halpaLukko: { airlock: true },
  halpaPesu: { airlock: true, cleaning: 'pesu', fruits: ['sitruuna'] },
  halpaLampin: { ambient: 26, sugarKg: 3, fruits: ['rusina'] },
  turbo: { yeast: 'turbo', sugarKg: 6, yeastG: 30, cleaning: 'pesu', airlock: true },
  hyva: { yeast: 'samppanja', sugarKg: 7, yeastG: 25, nutrient: true, fruits: ['omena'], spices: ['kaneli'], cleaning: 'desinf', airlock: true, ambient: 18 },
  viini: { yeast: 'viini', sugarKg: 5, yeastG: 20, fruits: ['herukka'], spices: ['vanilja'], cleaning: 'pesu', airlock: true, ambient: 20 },
};
let assert = require('assert');
for (const [n, c] of Object.entries(cases)) {
  const st = E.newState(); st.owned = {};
  const rec = { ...base, ...c };
  const cost = E.recipeCost(rec, st, names);
  const b = S.createBatch(rec, E.mods(st));
  for (let d = 0; d < 14; d++) S.stepDay(b);
  const r = S.evaluate(b, cost.total + b.energyCost);
  st.money -= cost.total;
  const s = E.settle(st, { result: r, drinkLitres: 5, volume: 25, energyCost: b.energyCost, totalCost: cost.total });
  console.log(n.padEnd(12), 'cost', cost.total, 'abv', r.abv, 'taste', r.taste, 'score', r.score, '€/alcL', r.costPerAlcL.toFixed(2),
    'price/L', s.price, 'income', s.income, 'energy', s.energy, 'profit', s.profit, 'xp', s.xp);
}
// taitopuu
const st = E.newState(); st.xp = 100;
assert.strictEqual(E.earnedPoints(100), 5);
assert.ok(!E.canLearn(st, 'lampo'));
assert.ok(E.learn(st, 'siisteys')); assert.ok(E.canLearn(st, 'lampo'));
assert.ok(!E.canLearn(st, 'mestari'));
console.log('ok', E.minimumBatchCost(E.newState()));
