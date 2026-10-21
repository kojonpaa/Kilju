/* Kiljumestari: käyttöliittymä */
(function () {
  'use strict';

  var S = window.KiljuSim;
  var MAX_DAYS = 30;
  var STORE_KEY = 'kiljumestari.v1';

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { return n.toFixed(d === undefined ? 1 : d).replace('.', ','); }

  /* Tallennus: localStorage voi puuttua (yksityinen selaus), joten kaikki try/catchissa */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ei haittaa */ }
  }

  var store = load();
  var recipe = store.lastRecipe || {
    fruits: ['sitruuna'], spices: [], yeast: 'leivin', sugarKg: 5, yeastG: 25,
    nutrient: false, waterTemp: 25, ambient: 22, cleaning: 'huuhdo', airlock: true
  };

  /* ---------- Näytöt ---------- */
  function show(name) {
    document.querySelectorAll('.screen').forEach(function (el) { el.classList.remove('active'); });
    $('screen-' + name).classList.add('active');
    window.scrollTo(0, 0);
    if (name === 'start') renderBest();
    if (name === 'setup') { stopLoop(); renderSetup(); }
  }

  document.querySelectorAll('[data-go]').forEach(function (el) {
    el.addEventListener('click', function () { show(el.getAttribute('data-go')); });
  });

  function renderBest() {
    var box = $('best-box');
    if (store.best) {
      box.classList.remove('hidden');
      box.innerHTML = '🏆 Paras kiljusi: <b>' + store.best.score + '/100</b> – ' + store.best.title +
        ' (' + fmt(store.best.abv) + ' %)';
    } else box.classList.add('hidden');
  }

  /* ---------- Reseptinäyttö ---------- */
  function chipGroup(containerId, source, key, max) {
    var c = $(containerId);
    c.innerHTML = '';
    Object.keys(source).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (recipe[key].indexOf(k) >= 0 ? ' on' : '');
      b.textContent = source[k].emoji + ' ' + source[k].name;
      b.addEventListener('click', function () {
        var list = recipe[key], i = list.indexOf(k);
        if (i >= 0) list.splice(i, 1);
        else if (list.length < max) list.push(k);
        else { list.shift(); list.push(k); }
        chipGroup(containerId, source, key, max);
      });
      c.appendChild(b);
    });
  }

  function optionGroup(containerId, source, key, sub) {
    var c = $(containerId);
    c.innerHTML = '';
    Object.keys(source).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'option' + (recipe[key] === k ? ' on' : '');
      b.innerHTML = '<b>' + source[k].name + '</b>' + (sub ? '<small>' + sub(source[k]) + '</small>' : '');
      b.addEventListener('click', function () {
        recipe[key] = k;
        optionGroup(containerId, source, key, sub);
        updateHints();
      });
      c.appendChild(b);
    });
  }

  function renderSetup() {
    chipGroup('fruits', S.FRUITS, 'fruits', 3);
    chipGroup('spices', S.SPICES, 'spices', 4);
    optionGroup('yeasts', S.YEASTS, 'yeast', function (y) {
      return y.desc + ' Viihtyy n. ' + (y.opt - 8) + '–' + y.clean + ' °C.';
    });
    optionGroup('cleaning', S.CLEANING, 'cleaning');
    $('sugar').value = recipe.sugarKg;
    $('yeastg').value = recipe.yeastG;
    $('water').value = recipe.waterTemp;
    $('ambient').value = recipe.ambient;
    $('nutrient').checked = recipe.nutrient;
    $('airlock').checked = recipe.airlock;
    updateHints();
  }

  function updateHints() {
    recipe.sugarKg = parseFloat($('sugar').value);
    recipe.yeastG = parseInt($('yeastg').value, 10);
    recipe.waterTemp = parseInt($('water').value, 10);
    recipe.ambient = parseInt($('ambient').value, 10);
    recipe.nutrient = $('nutrient').checked;
    recipe.airlock = $('airlock').checked;

    $('sugar-val').textContent = fmt(recipe.sugarKg) + ' kg / 25 l';
    $('yeastg-val').textContent = recipe.yeastG + ' g';
    $('water-val').textContent = recipe.waterTemp + ' °C';
    $('ambient-val').textContent = recipe.ambient + ' °C';

    var gpl = recipe.sugarKg * 1000 / S.VOLUME_L;
    var pot = gpl / 17;
    var y = S.YEASTS[recipe.yeast];
    var sh = $('sugar-hint');
    sh.className = 'hint';
    var txt = 'Teoreettinen vahvuus n. ' + fmt(pot) + ' %. ';
    if (pot > y.tol + 1) { txt += y.name + ' jaksaa vain noin ' + y.tol + ' %, loput jää makeudeksi.'; sh.className = 'hint warn'; }
    else if (gpl > 300) { txt += 'Kerralla näin paljon sokeria stressaa hiivaa. Voit lisätä sokeria myös kesken käymisen.'; sh.className = 'hint warn'; }
    sh.textContent = txt;

    var th = $('temp-hint');
    th.className = 'hint';
    if (recipe.waterTemp > 40) { th.textContent = 'Yli 40 °C vesi vahingoittaa hiivaa!'; th.className = 'hint bad'; }
    else if (recipe.ambient > y.clean - 3) { th.textContent = 'Käyminen lämmittää ämpäriä muutaman asteen huoneenlämpöä kuumemmaksi.'; th.className = 'hint warn'; }
    else th.textContent = 'Käyminen lämmittää ämpäriä muutaman asteen huoneenlämpöä kuumemmaksi.';
  }

  ['sugar', 'yeastg', 'water', 'ambient', 'nutrient', 'airlock'].forEach(function (id) {
    $(id).addEventListener('input', updateHints);
  });

  /* ---------- Käyminen ---------- */
  var batch = null, timer = null, speed = 1, paused = false, lastLog = 0;

  $('start-brew').addEventListener('click', function () {
    updateHints();
    store.lastRecipe = JSON.parse(JSON.stringify(recipe));
    save(store);
    var r = JSON.parse(JSON.stringify(recipe));
    r.seed = Math.floor(Math.random() * 1e9) + 1;
    batch = S.createBatch(r);
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
    if (batch.sugarAdded >= 5) return;
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
    $('add-sugar').disabled = b.sugarAdded >= 5;

    while (lastLog < b.events.length) logEvent(b.events[lastLog++]);

    // Ämpärin visuaalit
    var clarity = Math.min(1, b.restHours / 24 / 5) * b.yeast.floc;
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
    var res = S.evaluate(batch);
    var isRecord = !store.best || res.score > store.best.score;
    if (isRecord) store.best = { score: res.score, title: res.title, abv: res.abv };
    store.plays = (store.plays || 0) + 1;
    save(store);
    renderResult(res, isRecord);
    batch = null;
    show('result');
  }

  function renderResult(r, isRecord) {
    $('r-title').textContent = r.title;
    $('r-record').classList.toggle('hidden', !isRecord);
    $('r-abv').textContent = fmt(r.abv) + ' %';
    $('r-taste').textContent = r.taste + '/100';
    $('r-clar').textContent = Math.round(r.clarity * 100) + ' %';
    $('r-meta').textContent = r.days + ' päivää käymistä, jäännössokeria ' + r.residualSugar + ' g/l.';
    var fill = $('glass-fill');
    fill.style.background = r.color;
    fill.style.height = '0';
    $('m-abv').style.width = '0'; $('m-taste').style.width = '0'; $('m-clar').style.width = '0';
    setTimeout(function () {
      fill.style.height = '85%';
      $('m-abv').style.width = Math.min(100, r.abv / 18 * 100) + '%';
      $('m-taste').style.width = r.taste + '%';
      $('m-clar').style.width = r.clarity * 100 + '%';
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

    $('share').onclick = function () {
      var text = 'Tein kiljua: ' + r.title + ' – ' + fmt(r.abv) + ' %, maku ' + r.taste + '/100, pisteet ' + r.score + '/100. Pystytkö parempaan?';
      if (navigator.share) navigator.share({ title: 'Kiljumestari', text: text, url: location.href }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + location.href).then(function () { $('share').textContent = '✅ Kopioitu'; });
    };
    $('share').textContent = '📣 Jaa';
  }

  renderBest();
})();
