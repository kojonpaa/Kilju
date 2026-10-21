/* Kiljumestari: käyttöliittymä */
(function () {
  'use strict';

  var S = window.KiljuSim;
  var E = window.KiljuEconomy;
  var MAX_DAYS = 30;
  var STORE_KEY = 'kiljumestari.v2';
  var NAMES = { yeasts: S.YEASTS, fruits: S.FRUITS, spices: S.SPICES, cleaning: S.CLEANING };

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { return n.toFixed(d === undefined ? 1 : d).replace('.', ','); }
  function eur(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n), 2) + ' €'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Tallennus: localStorage voi puuttua (yksityinen selaus), joten kaikki try/catchissa */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ei haittaa */ }
  }

  var DEFAULT_RECIPE = {
    fruits: [], spices: [], yeast: 'leivin', sugarKg: 4, yeastG: 25,
    nutrient: false, waterTemp: 25, ambient: 20, cleaning: 'huuhdo', airlock: true
  };

  var store = load();
  var recipe = clone(store.lastRecipe || DEFAULT_RECIPE);
  var game = store.game || null;

  /* ---------- Näytöt ---------- */
  var skillsReturn = 'setup';

  function show(name) {
    document.querySelectorAll('.screen').forEach(function (el) { el.classList.remove('active'); });
    $('screen-' + name).classList.add('active');
    window.scrollTo(0, 0);
    if (name === 'start') renderStart();
    if (name === 'setup') { stopLoop(); renderSetup(); }
    if (name === 'skills') renderSkills();
  }

  document.querySelectorAll('[data-go]').forEach(function (el) {
    el.addEventListener('click', function () {
      var to = el.getAttribute('data-go');
      if (to === 'skills') skillsReturn = document.querySelector('.screen.active').id.replace('screen-', '');
      show(to);
    });
  });
  $('skills-back').addEventListener('click', function () { show(skillsReturn === 'result' ? 'result' : 'setup'); });

  function renderStart() {
    var box = $('save-box');
    var hasGame = game && !game.bankrupt;
    $('continue').classList.toggle('hidden', !hasGame);
    if (game) {
      box.classList.remove('hidden');
      box.innerHTML = (game.bankrupt ? '💸 Edellinen peli päättyi konkurssiin.<br>' : '') +
        'Kassa <b>' + eur(game.money) + '</b> · erä ' + game.batch + ' · paras kilju ' + game.bestScore + '/100' +
        '<br>Suurin kassa: ' + eur(game.bestMoney);
    } else box.classList.add('hidden');
  }

  $('continue').addEventListener('click', function () { show('setup'); });
  $('new-game').addEventListener('click', function () {
    if (game && !game.bankrupt && !confirm('Aloitetaanko alusta? Nykyinen kassa ja taidot nollautuvat.')) return;
    game = E.newState();
    recipe = clone(DEFAULT_RECIPE);
    store.game = game;
    store.lastRecipe = recipe;
    persist();
    show('setup');
  });

  /* ---------- Reseptinäyttö ---------- */
  function chipGroup(containerId, source, prices, key, max) {
    var c = $(containerId);
    c.innerHTML = '';
    Object.keys(source).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (recipe[key].indexOf(k) >= 0 ? ' on' : '');
      b.innerHTML = source[k].emoji + ' ' + source[k].name + ' <small>' + eur(prices[k]) + '</small>';
      b.addEventListener('click', function () {
        var list = recipe[key], i = list.indexOf(k);
        if (i >= 0) list.splice(i, 1);
        else if (list.length < max) list.push(k);
        else { list.shift(); list.push(k); }
        chipGroup(containerId, source, prices, key, max);
        updateHints();
      });
      c.appendChild(b);
    });
  }

  function optionGroup(containerId, source, key, sub, price) {
    var c = $(containerId);
    c.innerHTML = '';
    Object.keys(source).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'option' + (recipe[key] === k ? ' on' : '');
      b.innerHTML = (price ? '<span class="price">' + price(k) + '</span>' : '') +
        '<b>' + source[k].name + '</b>' + (sub ? '<small>' + sub(source[k]) + '</small>' : '');
      b.addEventListener('click', function () {
        recipe[key] = k;
        optionGroup(containerId, source, key, sub, price);
        updateHints();
      });
      c.appendChild(b);
    });
  }

  function renderSetup() {
    if (!game) game = store.game = E.newState();
    $('batch-no').textContent = game.batch;
    $('money').textContent = eur(game.money);
    var pts = E.availablePoints(game);
    $('skills-btn').textContent = '🎓 Taidot' + (pts > 0 ? ' (' + pts + ' uutta)' : '');
    chipGroup('fruits', S.FRUITS, E.PRICES.fruits, 'fruits', 3);
    chipGroup('spices', S.SPICES, E.PRICES.spices, 'spices', 4);
    optionGroup('yeasts', S.YEASTS, 'yeast', function (y) {
      return y.desc + ' Viihtyy n. ' + (y.opt - 8) + '–' + y.clean + ' °C.';
    }, function (k) { return fmt(E.PRICES.yeasts[k] * 10, 2) + ' €/10 g'; });
    optionGroup('cleaning', S.CLEANING, 'cleaning', null, function (k) {
      return E.PRICES.cleaning[k] ? eur(E.PRICES.cleaning[k]) : 'ilmainen';
    });
    $('sugar').value = recipe.sugarKg;
    $('yeastg').value = recipe.yeastG;
    $('water').value = recipe.waterTemp;
    $('ambient').value = recipe.ambient;
    $('nutrient').checked = recipe.nutrient;
    $('airlock').checked = recipe.airlock;
    var owned = game.owned && game.owned.airlock;
    $('airlock').nextElementSibling.textContent = 'Kansi ja ilmalukko ' +
      (owned ? '(omistat jo)' : '(kertaosto ' + eur(E.EQUIPMENT.airlock.price) + ', muuten pyyhe päälle)');
    $('nutrient').nextElementSibling.textContent = 'Lisää hiivaravinnetta (' + eur(1.5) + ')';
    updateHints();
  }

  function updateHints() {
    recipe.sugarKg = parseFloat($('sugar').value);
    recipe.yeastG = parseInt($('yeastg').value, 10);
    recipe.waterTemp = parseInt($('water').value, 10);
    recipe.ambient = parseInt($('ambient').value, 10);
    recipe.nutrient = $('nutrient').checked;
    recipe.airlock = $('airlock').checked;

    $('sugar-val').textContent = fmt(recipe.sugarKg) + ' kg · ' + eur(E.sugarCost(game, recipe.sugarKg));
    $('yeastg-val').textContent = recipe.yeastG + ' g';
    $('water-val').textContent = recipe.waterTemp + ' °C';
    $('ambient-val').textContent = recipe.ambient + ' °C';

    var gpl = recipe.sugarKg * 1000 / S.VOLUME_L;
    var pot = gpl / 17;
    var y = S.YEASTS[recipe.yeast];
    var tol = y.tol + E.mods(game).tol;
    var sh = $('sugar-hint');
    sh.className = 'hint';
    var txt = 'Teoreettinen vahvuus n. ' + fmt(pot) + ' %. ';
    if (pot > tol + 1) { txt += y.name + ' jaksaa vain noin ' + tol + ' %, loput jää makeudeksi.'; sh.className = 'hint warn'; }
    else if (gpl > 300) { txt += 'Kerralla näin paljon sokeria stressaa hiivaa. Voit lisätä sokeria myös kesken käymisen.'; sh.className = 'hint warn'; }
    sh.textContent = txt;

    var th = $('temp-hint');
    th.className = 'hint';
    var energyDay = Math.abs(recipe.ambient - 18) * 0.015 * E.energyMultiplier(game);
    var energyTxt = energyDay > 0 ? ' Lämmitys/viilennys maksaa n. ' + eur(energyDay) + ' päivässä.' : ' 18 °C huone ei maksa sähköä.';
    if (recipe.waterTemp > 40) { th.textContent = 'Yli 40 °C vesi vahingoittaa hiivaa!' + energyTxt; th.className = 'hint bad'; }
    else {
      th.textContent = 'Käyminen lämmittää ämpäriä muutaman asteen huoneenlämpöä kuumemmaksi.' + energyTxt;
      if (recipe.ambient > y.clean - 3) th.className = 'hint warn';
    }

    renderBill();
  }

  function renderBill() {
    var cost = E.recipeCost(recipe, game, NAMES);
    var ul = $('bill');
    ul.innerHTML = '';
    cost.items.forEach(function (i) {
      var li = document.createElement('li');
      li.innerHTML = '<span></span><b>' + eur(i.cost) + '</b>';
      li.firstChild.textContent = i.label;
      ul.appendChild(li);
    });
    var tot = document.createElement('li');
    tot.className = 'total';
    tot.innerHTML = '<span>Yhteensä</span><b>' + eur(cost.total) + '</b>';
    ul.appendChild(tot);
    var left = game.money - cost.total;
    var hint = $('bill-hint');
    var btn = $('start-brew');
    if (left < 0) {
      hint.className = 'hint bad';
      hint.textContent = 'Rahat eivät riitä: puuttuu ' + eur(-left) + '.';
      btn.disabled = true;
      btn.textContent = 'Rahat eivät riitä';
    } else {
      hint.className = 'hint';
      hint.textContent = 'Kassaan jää ' + eur(left) + '. Sähkö laskutetaan pullotuksen yhteydessä.';
      btn.disabled = false;
      btn.textContent = 'Pistä käymään! 🫧';
    }
    return cost;
  }

  ['sugar', 'yeastg', 'water', 'ambient', 'nutrient', 'airlock'].forEach(function (id) {
    $(id).addEventListener('input', updateHints);
  });

  /* ---------- Käyminen ---------- */
  var batch = null, batchCost = 0, timer = null, speed = 1, paused = false, lastLog = 0;
  var result = null, settled = false;

  $('start-brew').addEventListener('click', function () {
    updateHints();
    var cost = E.recipeCost(recipe, game, NAMES);
    if (cost.total > game.money) return;
    game.money = Math.round((game.money - cost.total) * 100) / 100;
    if (recipe.airlock) { game.owned = game.owned || {}; game.owned.airlock = true; }
    batchCost = cost.total;
    store.lastRecipe = clone(recipe);
    persist();

    var r = clone(recipe);
    r.seed = Math.floor(Math.random() * 1e9) + 1;
    batch = S.createBatch(r, E.mods(game));
    lastLog = 0;
    paused = false;
    speed = 1;
    $('log').innerHTML = '';
    $('pause').textContent = '⏸';
    $('speed').textContent = '⏩ Nopeus 1×';
    $('cloth').classList.toggle('hidden', r.airlock);
    $('airlock-g').style.display = r.airlock ? '' : 'none';
    show('brew');
    renderBrew();
    startLoop();
  });

  function interval() { return speed === 1 ? 1400 : speed === 2 ? 700 : 300; }

  function startLoop() {
    stopLoop();
    timer = setInterval(tick, interval());
  }
  function stopLoop() { if (timer) clearInterval(timer); timer = null; }

  function tick() {
    if (!batch || paused) return;
    S.stepDay(batch);
    renderBrew();
    if (batch.hour / 24 >= MAX_DAYS) {
      logEvent({ kind: 'info', day: MAX_DAYS, text: 'Kuukausi täynnä. Pakko pullottaa!' });
      bottle();
    }
  }

  $('pause').addEventListener('click', function () {
    paused = !paused;
    this.textContent = paused ? '▶' : '⏸';
  });
  $('speed').addEventListener('click', function () {
    speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    this.textContent = '⏩ Nopeus ' + speed + '×';
    startLoop();
  });
  $('amb-down').addEventListener('click', function () { S.setAmbient(batch, batch.ambient - 1); renderBrew(); });
  $('amb-up').addEventListener('click', function () { S.setAmbient(batch, batch.ambient + 1); renderBrew(); });
  $('stir').addEventListener('click', function () { S.stir(batch); floatText('Sekoitus!'); renderBrew(); });
  $('add-sugar').addEventListener('click', function () {
    var c = E.sugarCost(game, 0.5);
    if (batch.sugarAdded >= 5 || game.money < c) return;
    game.money = Math.round((game.money - c) * 100) / 100;
    batchCost += c;
    persist();
    S.addSugar(batch, 0.5); floatText('+0,5 kg'); renderBrew();
  });
  $('bottle').addEventListener('click', bottle);

  function floatText(t) {
    var el = $('float-text');
    el.textContent = t;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function logEvent(e) {
    var li = document.createElement('li');
    li.className = e.kind + ' new';
    li.innerHTML = '<span class="d">Päivä ' + e.day + '</span>';
    li.appendChild(document.createTextNode(e.text));
    $('log').insertBefore(li, $('log').firstChild);
  }

  function activityLabel(a) {
    if (a > 0.6) return 'Kuohuu 🔥';
    if (a > 0.3) return 'Vilkas';
    if (a > 0.08) return 'Rauhallinen';
    if (a > 0.02) return 'Hiipuu';
    return 'Pysähtynyt';
  }

  function energyNow() { return batch.energyCost * E.energyMultiplier(game); }

  function renderBrew() {
    var b = batch;
    var day = Math.floor(b.hour / 24) + (b.hour % 24 ? 1 : 0);
    $('day').textContent = Math.max(1, day);
    $('s-abv').textContent = fmt(b.abv) + ' %';
    $('s-sugar').textContent = Math.round(b.sugar) + ' g/l';
    $('s-temp').textContent = fmt(b.temp) + ' °C';
    $('s-temp').style.color = b.temp > b.yeast.clean ? 'var(--bad)' : b.temp < b.yeast.opt - 10 ? 'var(--info)' : '';
    $('s-act').textContent = activityLabel(b.activity);
    $('s-amb').textContent = b.ambient + ' °C';
    var sc = E.sugarCost(game, 0.5);
    $('sugar-price').textContent = eur(sc) + ' · kassa ' + eur(game.money);
    $('add-sugar').disabled = b.sugarAdded >= 5 || game.money < sc;
    var perDay = Math.abs(b.ambient - 18) * 0.015 * E.energyMultiplier(game);
    $('energy').textContent = 'Sähkölasku tähän mennessä ' + eur(energyNow()) +
      (perDay > 0 ? ' (+' + eur(perDay) + '/päivä)' : ' (18 °C on ilmaista)');

    while (lastLog < b.events.length) logEvent(b.events[lastLog++]);

    // Ämpärin visuaalit
    var clarity = Math.min(1, b.restHours / 24 / 5 * b.mods.clarity) * b.yeast.floc;
    $('liquid').setAttribute('fill', S.liquidColor(b.recipe, clarity, b.infection));
    $('foam').setAttribute('opacity', Math.min(1, b.activity * 1.5).toFixed(2));
    $('film').setAttribute('opacity', Math.min(1, b.infection * 6).toFixed(2));
    $('sediment').setAttribute('opacity', Math.min(1, 0.2 + b.restHours / 100).toFixed(2));
    renderBubbles(b.activity);
    if (b.activity > 0.05 && b.recipe.airlock) {
      var ab = $('airlock-bubble');
      ab.classList.remove('blub'); void ab.getBoundingClientRect(); ab.classList.add('blub');
    }
    drawChart(b);
  }

  var bubbleCount = -1;
  function renderBubbles(a) {
    var n = Math.round(Math.min(1, a) * 18);
    if (n === bubbleCount) return;
    bubbleCount = n;
    var g = $('bubbles'), ns = 'http://www.w3.org/2000/svg';
    g.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', 45 + Math.random() * 110);
      c.setAttribute('cy', 200 + Math.random() * 15);
      c.setAttribute('r', 1.5 + Math.random() * 3);
      c.setAttribute('fill', 'rgba(255,255,255,.8)');
      c.setAttribute('class', 'bubble');
      c.style.animationDuration = (1.2 + Math.random() * 1.8) + 's';
      c.style.animationDelay = (-Math.random() * 2) + 's';
      g.appendChild(c);
    }
  }

  function drawChart(b) {
    var cv = $('chart');
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth, h = 110;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var pad = 8, days = Math.max(10, Math.ceil(b.hour / 24));
    var sugarMax = Math.max(b.sugar0, 1);
    for (var k = 0; k < b.history.length; k++) if (b.history[k].sugar > sugarMax) sugarMax = b.history[k].sugar;
    function x(d) { return pad + (w - pad * 2) * d / days; }
    function line(color, val) {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      b.history.forEach(function (p, i) {
        var yv = h - pad - (h - pad * 2) * val(p);
        if (i) ctx.lineTo(x(p.day), yv); else ctx.moveTo(x(p.day), yv);
      });
      ctx.stroke();
    }
    ctx.strokeStyle = '#eadfca'; ctx.lineWidth = 1;
    for (var d = 0; d <= days; d += 5) { ctx.beginPath(); ctx.moveTo(x(d), pad); ctx.lineTo(x(d), h - pad); ctx.stroke(); }
    line('#e8a33a', function (p) { return p.sugar / sugarMax; });
    line('#4a6f8a', function (p) { return Math.min(1, p.temp / 45); });
    line('#c0392b', function (p) { return Math.min(1, p.abv / 20); });
  }

  /* ---------- Pullotus ja tulos ---------- */
  function bottle() {
    if (!batch) return;
    stopLoop();
    var energy = energyNow();
    result = S.evaluate(batch, batchCost + energy);
    result.energyCost = batch.energyCost;
    result.totalCost = batchCost;
    settled = false;
    batch = null;
    renderResult(result);
    show('result');
  }

  function renderResult(r) {
    $('r-title').textContent = r.title;
    $('r-record').classList.toggle('hidden', r.score <= game.bestScore);
    $('r-abv').textContent = fmt(r.abv) + ' %';
    $('r-taste').textContent = r.taste + '/100';
    $('r-clar').textContent = Math.round(r.clarity * 100) + ' %';
    $('r-eff').textContent = isFinite(r.costPerAlcL) ? fmt(r.costPerAlcL, 2) + ' €/l' : '–';
    $('r-meta').textContent = r.days + ' päivää käymistä, jäännössokeria ' + r.residualSugar + ' g/l, puhdasta alkoholia ' + fmt(r.alcLitres) + ' l.';
    $('r-cost').textContent = 'Hinta-laatu = mitä yksi litra puhdasta alkoholia maksoi (ainekset ' + eur(r.totalCost) +
      ' + sähkö ' + eur(r.energyCost * E.energyMultiplier(game)) + ').';
    var fill = $('glass-fill');
    fill.style.background = r.color;
    fill.style.height = '0';
    ['m-abv', 'm-taste', 'm-clar', 'm-eff'].forEach(function (id) { $(id).style.width = '0'; });
    setTimeout(function () {
      fill.style.height = '85%';
      $('m-abv').style.width = Math.min(100, r.abv / 18 * 100) + '%';
      $('m-taste').style.width = r.taste + '%';
      $('m-clar').style.width = r.clarity * 100 + '%';
      $('m-eff').style.width = r.efficiency * 100 + '%';
    }, 50);

    // Pisteet rullaavat
    var el = $('r-score'), cur = 0;
    var t = setInterval(function () {
      cur = Math.min(r.score, cur + Math.max(1, Math.round(r.score / 30)));
      el.textContent = cur;
      if (cur >= r.score) clearInterval(t);
    }, 30);

    var ul = $('r-notes');
    ul.innerHTML = '';
    r.notes.forEach(function (n) {
      var li = document.createElement('li');
      li.className = n.kind;
      li.textContent = n.text;
      ul.appendChild(li);
    });

    $('split-card').classList.remove('hidden');
    $('settle-card').classList.add('hidden');
    $('after-row').classList.add('hidden');
    $('drink').value = r.abv < 1 ? 0 : 5;
    updateSplit();
  }

  function updateSplit() {
    var drink = parseInt($('drink').value, 10), sell = S.VOLUME_L - drink;
    var price = E.salePricePerL(result, game);
    var energy = result.energyCost * E.energyMultiplier(game);
    $('drink-val').textContent = drink + ' l';
    $('sell-l').textContent = sell + ' l';
    $('sell-price').textContent = price > 0 ? eur(price) + '/l' : 'ei kelpaa kenellekään';
    $('sell-eur').textContent = eur(sell * price);
    $('sell-energy').textContent = 'sähkö −' + eur(energy);
    $('drink-xp').textContent = '+' + E.drinkXp(result, drink);
  }
  $('drink').addEventListener('input', updateSplit);

  $('settle').addEventListener('click', function () {
    if (settled) return;
    settled = true;
    var moneyBefore = game.money + result.totalCost;
    var s = E.settle(game, {
      result: result, drinkLitres: parseInt($('drink').value, 10), volume: S.VOLUME_L,
      energyCost: result.energyCost, totalCost: result.totalCost
    });
    if (s.bankrupt) game.bankrupt = true;
    persist();

    var ul = $('settle-list');
    ul.innerHTML = '';
    function row(label, val, cls) {
      var li = document.createElement('li');
      if (cls) li.className = cls;
      li.innerHTML = '<span>' + label + '</span><b>' + val + '</b>';
      ul.appendChild(li);
    }
    row('Myyty ' + s.sold + ' l × ' + eur(s.price), '+' + eur(s.income), 'plus');
    row('Ainekset ja välineet', '−' + eur(result.totalCost), 'minus');
    if (s.energy > 0) row('Sähkö', '−' + eur(s.energy), 'minus');
    row('Erän tulos', (s.profit >= 0 ? '+' : '') + eur(s.profit), 'total ' + (s.profit >= 0 ? 'plus' : 'minus'));
    row('Kassa', eur(moneyBefore) + ' → ' + eur(game.money), 'total');
    if (s.drink > 0) row('Joit itse ' + s.drink + ' l', '+' + s.xp + ' XP', 'plus');

    $('settle-title').textContent = s.profit >= 0 ? '📈 Tilitys: voitolla!' : '📉 Tilitys: tappiolla';
    var hint = $('settle-hint');
    hint.className = 'hint';
    if (s.newPoints > 0) hint.textContent = '🎉 Sait ' + s.newPoints + ' uuden taitopisteen! Käy käyttämässä se taitopuussa.';
    else hint.textContent = 'Seuraavaan taitopisteeseen: ' + game.xp + '/' + E.nextPointXp(game) + ' XP.';

    $('split-card').classList.add('hidden');
    $('settle-card').classList.remove('hidden');
    $('after-row').classList.remove('hidden');

    var next = $('next-batch');
    if (s.bankrupt) {
      $('settle-title').textContent = '💸 Konkurssi!';
      hint.className = 'hint bad';
      hint.textContent = 'Kassassa on ' + eur(game.money) + ', eikä se riitä edes sokeriin ja leivinhiivaan. Peli päättyi erään ' +
        (game.batch - 1) + '. Paras kilju: ' + game.bestScore + '/100.';
      next.textContent = '🔁 Aloita alusta';
    } else next.textContent = '🔁 Seuraava erä';

    $('share').onclick = function () {
      var text = 'Kiljumestari, erä ' + (game.batch - 1) + ': ' + result.title + ' – ' + fmt(result.abv) + ' %, maku ' + result.taste +
        '/100, pisteet ' + result.score + '/100. Kassassa ' + eur(game.money) + '. Pystytkö parempaan?';
      if (navigator.share) navigator.share({ title: 'Kiljumestari', text: text, url: location.href }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + location.href).then(function () { $('share').textContent = '✅ Kopioitu'; });
    };
    $('share').textContent = '📣 Jaa';
  });

  $('next-batch').addEventListener('click', function () {
    if (game.bankrupt) {
      game = store.game = E.newState();
      recipe = clone(DEFAULT_RECIPE);
      store.lastRecipe = recipe;
      persist();
    }
    show('setup');
  });

  /* ---------- Taitopuu ---------- */
  var TIERS = [
    { label: 'Perustaidot', keys: ['siisteys', 'maistelu', 'kauppa'] },
    { label: 'Edistyneet', keys: ['lampo', 'hiiva', 'tukku'] },
    { label: 'Mestaruus', keys: ['mestari'] }
  ];

  function renderSkills() {
    if (!game) game = store.game = E.newState();
    var pts = E.availablePoints(game);
    $('points').textContent = pts;
    var prev = E.xpForPoint(E.earnedPoints(game.xp)), next = E.nextPointXp(game);
    $('xp-fill').style.width = Math.round((game.xp - prev) / (next - prev) * 100) + '%';
    $('xp-text').textContent = 'Kokemus ' + game.xp + ' XP, seuraava piste ' + next + ' XP:n kohdalla.';

    var tree = $('tree');
    tree.innerHTML = '';
    TIERS.forEach(function (tier) {
      var lab = document.createElement('div');
      lab.className = 'tier-label';
      lab.textContent = tier.label;
      tree.appendChild(lab);
      tier.keys.forEach(function (k) {
        var sk = E.SKILLS[k], level = E.level(game, k);
        var reqs = Object.keys(sk.requires);
        var unlocked = reqs.every(function (r) { return E.level(game, r) >= sk.requires[r]; });
        var card = document.createElement('div');
        card.className = 'card skill' + (unlocked ? '' : ' locked');
        var pips = '';
        for (var i = 0; i < sk.max; i++) pips += '<i class="' + (i < level ? 'on' : '') + '"></i>';
        var req = reqs.length && !unlocked ? '<p>🔒 Vaatii: ' + reqs.map(function (r) {
          return E.SKILLS[r].name + ' ' + sk.requires[r];
        }).join(', ') + '</p>' : '';
        card.innerHTML = '<div class="ico">' + sk.emoji + '</div><div><b>' + sk.name + '</b><span class="pips">' + pips +
          '</span><p>' + sk.desc + '</p>' + req + '</div>';
        var btn = document.createElement('button');
        btn.className = 'btn' + (E.canLearn(game, k) ? ' primary' : '');
        btn.textContent = level >= sk.max ? '✓' : 'Opi';
        btn.disabled = !E.canLearn(game, k);
        btn.addEventListener('click', function () {
          if (E.learn(game, k)) { persist(); renderSkills(); }
        });
        card.appendChild(btn);
        tree.appendChild(card);
      });
    });
  }

  renderStart();
})();
