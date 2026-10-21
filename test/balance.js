const S = require('../js/sim.js');
const base = { fruits: [], spices: [], yeast: 'turbo', sugarKg: 6, yeastG: 30, nutrient: false,
  waterTemp: 25, ambient: 22, cleaning: 'desinf', airlock: true, seed: 7 };
const cases = {
  perus: {},
  hyva: { fruits: ['omena'], spices: ['kaneli'], sugarKg: 7, nutrient: true, ambient: 20 },
  viini: { yeast: 'viini', fruits: ['herukka'], spices: ['vanilja'], sugarKg: 5, nutrient: true, ambient: 19 },
  samppanja: { yeast: 'samppanja', fruits: ['sitruuna','ananas'], spices: ['inkivaari'], sugarKg: 7.5, nutrient: true, ambient: 17 },
  leivin: { yeast: 'leivin', sugarKg: 5 },
  kuuma: { ambient: 32 },
  likainen: { cleaning: 'ei', airlock: false, yeastG: 5 },
  keitto: { waterTemp: 55 },
  sokerihirvio: { sugarKg: 10 },
};
for (const [n, c] of Object.entries(cases)) {
  for (const days of [7, 12, 20]) {
    const { batch, result: r } = S.simulate({ ...base, ...c }, days);
    console.log(n.padEnd(13), days, 'abv', r.abv, 'rs', r.residualSugar, 'taste', r.taste, 'score', r.score, r.title,
      'peak', batch.peakTemp.toFixed(1), 'fus', batch.fusel.toFixed(2), 'inf', batch.infection.toFixed(3), 'cl', r.clarity.toFixed(2));
  }
}
console.log('---');
for (const [n,c] of Object.entries({
  huuhdo: { cleaning: 'huuhdo' }, huuhdoEiLukkoa: { cleaning: 'huuhdo', airlock: false }, pesu: {cleaning:'pesu', airlock:false},
  leivinRavinne: { yeast:'leivin', sugarKg: 4, nutrient: true, ambient: 26, fruits:['rusina'] },
  olut: { yeast:'olut', sugarKg: 4, ambient: 19, fruits:['herukka'] },
  kylma: { ambient: 12, waterTemp: 8 },
})) for (const days of [7, 14]) { const { batch, result: r } = S.simulate({ ...base, ...c }, days);
  console.log(n.padEnd(15), days, 'abv', r.abv, 'rs', r.residualSugar, 'taste', r.taste, 'score', r.score, r.title, 'inf', batch.infection.toFixed(3)); }
