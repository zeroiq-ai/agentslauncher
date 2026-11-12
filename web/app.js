(function () {
  'use strict';
  var UP = '#0a7f3f', DOWN = '#c0362c';
  var $ = function (id) { return document.getElementById(id); };
  var setHTML = function (id, html) { var el = $(id); if (!el) return; if (el._h !== html) { el.innerHTML = html; el._h = html; } };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%'; };

  // ---------- simulation ----------
  var priceCache = {};
  function prices(si) {
    if (priceCache[si]) return priceCache[si];
    var cfg = [[11, 0.004, 0.022], [23, -0.001, 0.034], [37, 0.002, 0.012], [51, 0.003, 0.016], [67, 0.001, 0.03]][si];
    var seed = cfg[0] * 7919;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var out = [], p = 100;
    for (var i = 0; i < 48; i++) {
      var o = p, c = o * (1 + cfg[1] + (rnd() - 0.5) * cfg[2] * 2);
      rnd(); rnd();
      out.push({ o: o, c: c }); p = c;
    }
    return (priceCache[si] = out);
  }
  function params(p) {
    return { size: 0.2 + p.risk / 99 * 0.8, tp: 1.01 + (1 - p.freq / 99) * 0.05, sl: 1 - (0.02 + p.risk / 99 * 0.06),
      dipN: p.patience > 66 ? 3 : (p.patience > 33 ? 2 : 1), momN: p.fomo > 66 ? 1 : (p.fomo > 33 ? 2 : 3), minHold: Math.round(p.patience / 99 * 4) };
  }
  function simulate(px, p) {
    var k = params(p), trades = [], cash = 1000, qty = 0, entry = 0, hold = 0;
    for (var i = 3; i < px.length; i++) {
      var c = px[i].c;
      if (!qty) {
        var red = true, green = true, j;
        for (j = 0; j < k.dipN; j++) if (!(px[i - j].c < px[i - j].o)) red = false;
        for (j = 0; j < k.momN; j++) if (!(px[i - j].c > px[i - j].o)) green = false;
        if (p.style === 'dip' ? red : green) { var q = cash * k.size / c; cash -= q * c; qty = q; entry = c; hold = 0; trades.push({ i: i, act: 'BUY', price: c, qty: q }); }
      } else {
        hold++;
        if (hold >= k.minHold && (c >= entry * k.tp || c <= entry * k.sl)) { trades.push({ i: i, act: 'SELL', price: c, qty: qty }); cash += qty * c; qty = 0; }
      }
    }
    return trades;
  }
  function hash(str) { var h = 7; String(str).split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); return h; }
  function parse(txt) {
    var t = String(txt || '').toLowerCase(), has = function (re) { return re.test(t); };
    var d = { patience: 50, fomo: 50, risk: 50, freq: 50 }, cues = [], style = 'dip';
    if (/^\s*@\w+/.test(t)) cues.push('twin built from public posts');
    if (has(/momentum|breakout|trend|chase|green|ride|hype/) && !has(/never chase/)) { style = 'momentum'; cues.push('momentum'); } else cues.push('dip buyer');
    if (has(/impatient|quick|scalp|fast/)) { d.patience = 15; cues.push('impatient'); } else if (has(/patient|wait|long[- ]term|hold|calm/)) { d.patience = 82; cues.push('patient'); }
    if (has(/never chase|no fomo|calm|never panic/)) { d.fomo = 12; cues.push('no FOMO'); } else if (has(/fomo|chase|hype|ape/)) { d.fomo = 88; cues.push('FOMO'); }
    if (has(/aggressive|all[- ]in|yolo|degen|max risk/)) { d.risk = 92; cues.push('high risk'); } else if (has(/careful|conservative|small|safe/)) { d.risk = 22; cues.push('careful sizing'); }
    if (has(/scalp|many trades|often|every candle/)) { d.freq = 88; cues.push('trades a lot'); } else if (has(/few trades|rarely|seldom/)) { d.freq = 15; cues.push('few trades'); }
    if (has(/make me rich|get rich|moon/)) { d.risk = Math.max(d.risk, 80); d.fomo = Math.max(d.fomo, 70); cues.push('wants to get rich'); }
    if (has(/no mistakes|never lose|zero mistakes/)) { d.patience = Math.max(d.patience, 75); cues.push('hates mistakes'); }
    d.style = style;
    return { dna: d, cues: cues };
  }
  function equity(px, dna, n) {
    var tr = simulate(px, dna), eq = [], c2 = 1000, q2 = 0, ti = 0, peak = 1, dd = 0;
    for (var i = 0; i < n; i++) {
      while (ti < tr.length && tr[ti].i === i) { var t = tr[ti]; if (t.act === 'BUY') { q2 = t.qty; c2 -= t.qty * t.price; } else { c2 += q2 * t.price; q2 = 0; } ti++; }
      var v = (c2 + q2 * px[i].c) / 1000; eq.push(v); peak = Math.max(peak, v); dd = Math.max(dd, (peak - v) / peak);
    }
    return { eq: eq, trades: tr.filter(function (t) { return t.i < n; }), dd: dd, ret: ((eq[eq.length - 1] || 1) - 1) * 100 };
  }
  function spark(eq, w, h) {
    if (!eq.length) return '';
    var lo = Infinity, hi = -Infinity; eq.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); });
    if (hi - lo < 0.01) { hi += 0.005; lo -= 0.005; }
    return eq.map(function (v, i) { return (i / Math.max(1, eq.length - 1) * w).toFixed(1) + ',' + (4 + (hi - v) / (hi - lo) * (h - 8)).toFixed(1); }).join(' ');
  }

  // ---------- pixel robots ----------
  var rc = {};
  var PRESETS = [
    { head: 'round', top: 'antenna', eyes: 'two', c: '#f5a524', d: '#c27c0e' },
    { head: 'box', top: 'twin', eyes: 'visor', c: '#7c8cff', d: '#5463d6' },
    { head: 'wide', top: 'ears', eyes: 'two', c: '#ff8fb1', d: '#d96a8c' },
    { head: 'tall', top: 'horn', eyes: 'cyclops', c: '#34c38f', d: '#1f9c6d' },
    { head: 'dome', top: 'prop', eyes: 'sleepy', c: '#9aa3ad', d: '#727b85' },
    { head: 'tv', top: 'antenna', eyes: 'two', c: '#e5e5e2', d: '#b9b9b4' },
    { head: 'round', top: 'ears', eyes: 'visor', c: '#b58cff', d: '#8d63db' },
    { head: 'box', top: 'none', eyes: 'two', c: '#ff7a45', d: '#d1561f' }
  ];
  function robot(seed, o) {
    o = o || {};
    var idx = o.preset === undefined ? hash(seed) % 8 : o.preset % 8, stage = o.stage === undefined ? 2 : o.stage, mood = o.mood || 'ok';
    var key = [idx, stage, mood, o.dead ? 1 : 0].join('-');
    if (rc[key]) return rc[key];
    var p = PRESETS[idx], acc = o.dead ? '#8a8a86' : '#c6f432', c = o.dead ? '#a8a8a3' : p.c, d = o.dead ? '#7d7d79' : p.d, ink = '#111111';
    var cells = {};
    var put = function (x, y, col) { cells[x + ',' + y] = col; };
    var rect = function (x0, y0, x1, y1, col) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) put(x, y, col); };
    if (stage === 0) {
      [[6, 9], [5, 10], [4, 11], [4, 11], [3, 12], [3, 12], [3, 12], [3, 12], [4, 11], [4, 11], [5, 10], [6, 9]].forEach(function (r, i) { rect(r[0], 2 + i, r[1], 2 + i, '#f3ead7'); });
      put(6, 6, p.c); put(9, 9, p.c); put(8, 4, acc); put(5, 10, acc); put(10, 6, p.d);
    } else {
      var top = 3;
      if (p.head === 'box') rect(4, 3, 11, 9, c);
      if (p.head === 'round') { rect(5, 3, 10, 3, c); rect(4, 4, 11, 8, c); rect(5, 9, 10, 9, c); }
      if (p.head === 'wide') { rect(3, 4, 12, 9, c); top = 4; }
      if (p.head === 'tall') { rect(5, 2, 10, 9, c); top = 2; }
      if (p.head === 'dome') { rect(6, 2, 9, 2, c); rect(5, 3, 10, 3, c); rect(4, 4, 11, 9, c); top = 2; }
      if (p.head === 'tv') { rect(3, 3, 12, 9, c); rect(4, 4, 11, 8, '#1c1c1c'); }
      if (p.top === 'antenna') { put(7, top - 1, ink); put(7, top - 2, acc); put(8, top - 2, acc); }
      if (p.top === 'twin') { put(5, top - 1, acc); put(10, top - 1, acc); put(5, top - 2, ink); put(10, top - 2, ink); }
      if (p.top === 'ears') { rect(4, top - 1, 5, top - 1, c); rect(10, top - 1, 11, top - 1, c); put(4, top - 2, c); put(11, top - 2, c); }
      if (p.top === 'horn') { put(8, top - 1, acc); put(8, top - 2, acc); }
      if (p.top === 'prop') { rect(5, top - 1, 10, top - 1, acc); put(7, top, ink); }
      var white = p.head === 'tv' ? acc : '#ffffff', dark = p.head === 'tv' ? '#ffffff' : ink, pupil = p.head === 'tv' ? '#1c1c1c' : ink;
      if (o.dead) { [[5, 5], [6, 6], [10, 5], [9, 6], [6, 5], [5, 6], [9, 5], [10, 6]].forEach(function (q) { put(q[0], q[1], dark); }); }
      else if (p.eyes === 'two') { rect(5, 5, 6, 6, white); rect(9, 5, 10, 6, white); put(6, 6, pupil); put(9, 6, pupil); }
      else if (p.eyes === 'visor') { rect(5, 5, 10, 6, ink); put(6, 5, acc); put(9, 5, acc); }
      else if (p.eyes === 'cyclops') { rect(6, 4, 9, 6, '#ffffff'); rect(7, 5, 8, 5, ink); }
      else if (p.eyes === 'sleepy') { rect(5, 6, 6, 6, ink); rect(9, 6, 10, 6, ink); }
      if (mood === 'happy' && !o.dead) { put(6, 7, dark); put(9, 7, dark); rect(7, 8, 8, 8, dark); }
      else if (mood === 'sad' || o.dead) { rect(7, 7, 8, 7, dark); put(6, 8, dark); put(9, 8, dark); }
      else rect(6, 8, 9, 8, dark);
      if (stage === 1) { rect(5, 10, 6, 10, ink); rect(9, 10, 10, 10, ink); }
      else {
        rect(5, 10, 10, 12, d); rect(3, 10, 4, 11, c); rect(11, 10, 12, 11, c);
        rect(5, 13, 6, 14, stage === 3 ? acc : c); rect(9, 13, 10, 14, stage === 3 ? acc : c);
        if (stage === 3) { rect(7, 11, 8, 11, acc); put(3, 9, acc); put(12, 9, acc); put(14, 2, acc); put(13, 3, acc); put(15, 3, acc); put(14, 4, acc); }
        else put(7, 11, acc);
      }
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">';
    Object.keys(cells).forEach(function (k) { var xy = k.split(','); svg += '<rect x="' + xy[0] + '" y="' + xy[1] + '" width="1" height="1" fill="' + cells[k] + '"/>'; });
    svg += '</svg>';
    return (rc[key] = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg));
  }

  // ---------- sample agents ----------
  var SAMPLES = [
    ['Zen Goblin', 'buy the dip, patient, calm, careful', 0, 'solo'],
    ['Calm Hamster', 'momentum, patient, careful', 2, 'sample squad'],
    ['Hype Oracle', 'chase green candles, hype, trade often', 1, 'solo'],
    ['Lucky Robot', 'momentum, careful, few trades', 7, 'sample squad'],
    ['Feral Gremlin', 'yolo, scalp often, chase', 6, 'solo']
  ].map(function (a) {
    var wk = [0, 1, 2, 3].map(function (si) { return equity(prices(si), parse(a[1]).dna, 48); });
    var avg = wk.reduce(function (s, w) { return s + w.ret; }, 0) / 4;
    var dd = Math.max.apply(null, wk.map(function (w) { return w.dd; })) * 100;
    var all = [], base = 1; wk.forEach(function (w) { w.eq.forEach(function (v) { all.push(base * v); }); base *= w.eq[w.eq.length - 1]; });
    return { n: a[0], seed: a[1], pre: a[2], squad: a[3], avg: avg, dd: dd, score: Math.max(0, Math.min(100, 50 + 10 * (avg - dd))), all: all };
  }).sort(function (a, b) { return b.score - a.score; });

  // ---------- state ----------
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var st = { tick: 999, phase: 'idle', btick: 0, face: 'front', skills: { spot: true }, tune: { limit: 10, watch: { NVDA: true, SPCX: false, SPY: true, AMD: false, GOOGL: true, META: false }, conn: { news: false, top: false, x: false }, handles: [] } };
  function set(patch) { Object.keys(patch).forEach(function (k) { st[k] = patch[k]; }); render(); }

  var SIM_TOTAL = 15000, SIM_SETUP = 3000;
  function simElapsed() { return st.sim && st.simStart ? Date.now() - st.simStart : 0; }
  function startSim() { if (st.sim) return; if (reduce) setTimeout(function () { st.sim = false; st.simStart = 0; refresh(); }, SIM_TOTAL); st.sim = true; st.simStart = Date.now(); st.dismissed = false; st.mintOpen = false; st.shareOpen = false; st.saveOpen = false; st.flow = null; }
  function prompt() { return $('prompt').value; }
  var typeTimer = null;
  function typeInto(text) {
    var el = $('prompt'); if (typeTimer) clearInterval(typeTimer);
    if (reduce) { el.value = text; render(); return; }
    var n = 0; el.value = '';
    typeTimer = setInterval(function () { n += 2; el.value = text.slice(0, n); if (n >= text.length) { clearInterval(typeTimer); typeTimer = null; } render(); }, 22);
    sfx('tick');
  }
  function startHatch(text) {
    $('prompt').value = text;
    if (st.face === 'back' && $('dvFace')) { st.face = 'front'; buildFace(); }
    st.flipAfterBuild = true; st.sim = false;
    set({ phase: reduce ? 'born' : 'hatching', btick: 0, rtick: undefined, tick: 999, subject: text, dnaPatch: null, xp: 0, dismissed: false, answered: null, joined: false, tg: false, askOpen: false, saveOpen: false, shareOpen: false, mintOpen: false, face: 'front' });
    if (reduce && st.flipAfterBuild) { st.flipAfterBuild = false; st.mode = 'EQ'; flip('back'); }
    try { var dv = $('device'), r = dv.getBoundingClientRect(); if (r.top > window.innerHeight * 0.55 || r.bottom < 80) dv.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  function model() {
    var born = st.phase === 'born', hatching = st.phase === 'hatching';
    var subject = born || hatching ? st.subject : 'demo';
    var parsed = parse(born || hatching ? subject : 'buy the dip, patient, calm, careful');
    var dna = Object.assign({}, parsed.dna, st.dnaPatch || {});
    var px = prices(0), N = px.length;
    var rt = st.rtick === undefined ? st.tick : st.tick - st.rtick;
    var shown = Math.max(2, Math.min(N, Math.floor(rt / 1.2) + 2));
    if (st.sim && st.simStart) { var se = Date.now() - st.simStart; shown = se < SIM_SETUP ? 2 : Math.min(N, 2 + Math.floor((se - SIM_SETUP) / (SIM_TOTAL - SIM_SETUP) * (N - 2))); }
    var sim = equity(px, dna, shown), done = shown >= N;
    var h = hash(subject);
    var ADJ = ['Tiny', 'Lucky', 'Quiet', 'Sleepy', 'Feral', 'Shy'], NOUN = ['Goblin', 'Oracle', 'Intern', 'Hamster', 'Gremlin', 'Robot'];
    var pd = parsed.dna, adj = pd.patience > 70 ? 'Zen' : (pd.fomo > 70 ? 'Hype' : (pd.risk > 80 ? 'Degen' : ADJ[h % 6]));
    var twin = /^\s*@\w+/.test(subject) ? subject.trim().split(/\s/)[0].slice(0, 24) + ' twin' : null;
    var name = born || hatching ? (twin || adj + ' ' + NOUN[(h >>> 3) % 6]) : 'Zen Goblin';
    var preset = born || hatching ? h % 8 : 0;
    var autoName = name;
    if (st.nameOverride) name = st.nameOverride;
    if (st.presetOverride !== undefined && st.presetOverride !== null) preset = st.presetOverride;
    var xp = st.xp || 0, lvl = born ? 1 + Math.floor(xp / 15) : 4, stage = lvl >= 5 ? 3 : (lvl >= 2 ? 2 : 1);
    var moodV = Math.max(4, Math.min(100, Math.round(55 + sim.ret * 6)));
    var healthV = Math.max(4, Math.min(100, Math.round(100 - sim.dd * 900)));
    var fedV = born ? (st.answered ? 92 : 46) : 78;
    var mood = moodV > 62 ? 'happy' : (moodV < 42 ? 'sad' : 'ok');
    var trades = sim.trades, lastT = trades[trades.length - 1];
    var diary = born
      ? (done ? (sim.ret >= 0 ? 'Up ' + fmt(sim.ret) + ' on the week. ' + (lastT && lastT.act === 'SELL' ? 'I may have sold a little early.' : 'Still holding.') : 'Down ' + fmt(sim.ret) + ' on the week. I have notes for myself.') : 'Trading last week…')
      : (lastT ? (lastT.act === 'BUY' ? 'Bought NVDA on a red day.' : 'Took profit. Resting.') : 'Watching NVDA. Nothing to do yet.');
    var sells = trades.filter(function (t) { return t.act === 'SELL'; }).length;
    var prop = dna.style === 'dip'
      ? { text: 'I sold early ' + Math.max(1, sells) + ' time' + (sells === 1 ? '' : 's') + ' this week. Raise patience ' + dna.patience + ' → ' + Math.min(99, dna.patience + 12) + '?', patch: { patience: Math.min(99, dna.patience + 12) } }
      : { text: 'I bought after ' + Math.max(1, trades.length) + ' green runs and got tops. Lower FOMO ' + dna.fomo + ' → ' + Math.max(0, dna.fomo - 20) + '?', patch: { fomo: Math.max(0, dna.fomo - 20) } };
    var lo = Math.min.apply(null, sim.eq.concat([1])), hi = Math.max.apply(null, sim.eq.concat([1])), span = Math.max(0.01, hi - lo);
    return { autoName: autoName, born: born, hatching: hatching, subject: subject, parsed: parsed, dna: dna, sim: sim, done: done, name: name, preset: preset, xp: xp, lvl: lvl, stage: stage,
      moodV: moodV, healthV: healthV, fedV: fedV, mood: mood, trades: trades, diary: diary, prop: prop, baseY: (4 + (hi - 1) / span * 48).toFixed(1) };
  }

  // ---------- render ----------
  var SKILLS = [
    ['spot', 'Spot trades', 'Buys and sells stock tokens 24/7 on Uniswap, Arcus and Rialto', ''],
    ['orders', 'Limit & stop orders', 'Sets entries, stop-losses and take-profits instead of market buys', ''],
    ['earn', 'Earn on idle cash', 'Parks unused USDG in Morpho lending between trades', ''],
    ['perps', 'Shorts & hedges', 'Opens short or hedge positions on Lighter or Arcus perps, 2x max', ''],
    ['borrow', 'Borrow vs stocks', 'Borrows USDG against its stock tokens instead of selling them', ''],
    ['dividends', 'Dividend yield', 'Trades or locks stock dividend yield on Pendle', ''],
    ['income', 'Covered income', 'Sells part of its upside on TALIS for steady premium', ''],
    ['basket', 'Publish a basket', 'Builds an index of its picks that others can follow', ''],
    ['memes', 'Meme tokens', 'Trades memecoins on Robinhood Chain, including stock-paired ones', 'degen']
  ];
  var HOT = [
    ['aibasket', 'AI basket', 'Buys a basket of AI stocks: NVDA, GOOGL, AMD', 'HOT', { skills: ['basket'], watch: ['NVDA', 'GOOGL', 'AMD'] }],
    ['earnings', 'Earnings hunter', 'Trades the move around earnings at half size', 'HOT', { dna: { freq: 65 } }],
    ['memes', 'Meme sniper', 'New memecoins past a $1M cap, max 2% a trade', 'DEGEN', { skills: ['memes'] }],
    ['copytop', 'Follow top agents', 'Weighs what the top 10 agents just did', 'NEW', { conn: ['top'] }],
    ['xalpha', 'X alpha', 'Reads posts from X accounts you add', 'NEW', { conn: ['x'] }],
    ['weekend', 'Weekend mode', 'Stock tokens trade 24/7, so it does too', '24/7', {}],
    ['yield', 'Yield on idle', 'Parks idle USDG in Morpho, about 7% a year', '~7%', { skills: ['earn'] }],
    ['hedge', 'Auto-hedge', 'Opens a hedge, 2x max, when the market drops', '2X', { skills: ['perps'] }]
  ];
  function hotHTML() {
    return HOT.map(function (o) { var on = !!(st.hot && st.hot[o[0]]); return '<button type="button" class="hk' + (on ? ' on' : '') + '" data-act="hot" data-k="' + o[0] + '" aria-pressed="' + on + '" title="' + o[2] + '"><span class="dv-ledk' + (on ? ' on' : '') + '"></span><span>' + o[1] + '</span><small class="' + (o[3] === 'DEGEN' ? 'degen' : (o[3] === 'NEW' ? 'new' : '')) + '">' + o[3] + '</small></button>'; }).join('');
  }
  function toggleHot(k) {
    var o = null; HOT.forEach(function (x) { if (x[0] === k) o = x; }); if (!o) return;
    st.hot = Object.assign({}, st.hot || {}); var on = st.hot[k] = !st.hot[k], p = o[4];
    (p.skills || []).forEach(function (x) { st.skills[x] = on; });
    if (on) (p.watch || []).forEach(function (x) { st.tune.watch[x] = true; });
    (p.conn || []).forEach(function (x) { st.tune.conn[x] = on; });
    if (on && p.dna) st.dnaPatch = Object.assign({}, st.dnaPatch || {}, p.dna);
    st.skills.spot = true;
  }
  function hotNames() { return HOT.filter(function (o) { return st.hot && st.hot[o[0]]; }).map(function (o) { return o[1]; }); }
  function skillNames() { return SKILLS.filter(function (k) { return st.skills[k[0]]; }).map(function (k) { return k[1]; }); }
  function skillsHTML() {
    return SKILLS.map(function (k) {
      var on = !!st.skills[k[0]];
      return '<button type="button" data-act="skill" data-k="' + k[0] + '" aria-pressed="' + on + '" title="' + k[2] + '" style="font:500 13px Inter,sans-serif;border-radius:999px;padding:7px 12px;min-height:36px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:1px solid ' + (on ? '#111' : '#e5e5e2') + ';background:' + (on ? '#111' : '#f7f7f5') + ';color:' + (on ? '#fff' : '#2f2f2f') + '">' + (on ? '✓ ' : '') + k[1] + (k[3] ? '<span class="mono" style="font-size:10px;padding:1px 5px;border-radius:4px;background:' + (on ? '#c6f432' : '#ffe1dc') + ';color:#111">' + k[3] + '</span>' : '') + '</button>';
    }).join('');
  }
  function rulesText(d, limit) {
    var k = params(d);
    var watch = Object.keys(st.tune.watch).filter(function (t) { return st.tune.watch[t]; });
    return (d.style === 'momentum' ? 'BUY after ' + k.momN + ' green candle' + (k.momN > 1 ? 's' : '') : 'BUY after ' + k.dipN + ' red candle' + (k.dipN > 1 ? 's' : '')) + ' · size ' + Math.round(k.size * 100) + '% of cash\n' +
      'SELL at +' + ((k.tp - 1) * 100).toFixed(1) + '% or −' + ((1 - k.sl) * 100).toFixed(1) + '% · hold ≥ ' + k.minHold + 'h\n' +
      'stops for the day at −' + limit + '% · trades ' + (watch.length ? watch.join(' ') : 'nothing yet') + (hotNames().length ? '\nhot: ' + hotNames().join(', ') : '') + '\nstyle: ' + (lean(d) >= 50 ? 'momentum ' + lean(d) : 'dip ' + (99 - lean(d))) + '% · skills: ' + skillNames().join(', ') + (st.md ? ' · playbook: ' + st.md.name : '');
  }
  var TUNE_PRESETS = { ZEN: { patience: 85, fomo: 10, risk: 25, freq: 25, style: 'dip' }, DIP: { patience: 65, fomo: 25, risk: 45, freq: 45, style: 'dip' }, MOMO: { patience: 30, fomo: 70, risk: 55, freq: 60, style: 'momentum' }, DEGEN: { patience: 10, fomo: 95, risk: 95, freq: 90, style: 'momentum' } };
  // ---------- device (2000s handheld, same size on both faces) ----------
  var SK_SHORT = { spot: 'SPOT', orders: 'LIMITS', earn: 'EARN', perps: 'SHORTS', borrow: 'BORROW', dividends: 'DIVIDEND', income: 'INCOME', basket: 'BASKET', memes: 'MEMES' };
  var CONN = [['news', 'News headlines', 'BETA · headlines on its stocks'], ['top', 'Top agents', 'BETA · what the best agents did'], ['x', 'X accounts', 'BETA · posts from accounts below'], ['chain', 'Onchain flows', 'SOON · Robinhood Chain pools', 'soon']];
  var SPIN_ICON = '<svg aria-hidden="true" class="spin" viewBox="0 0 24 24" style="width:18px;height:18px;display:block"><path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M20.5 3.5v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var TUNE_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" style="width:20px;height:20px;display:block;transform:rotate(90deg)"><path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M20.5 3.5v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function kc(btn, label) { return '<div class="dv-kc"><div class="dv-ks">' + btn + '</div><span class="dv-eng">' + label + '</span></div>'; }
  function buildShell() {
    var g = ''; for (var i = 0; i < 12; i++) g += '<span></span>';
    var el = $('device');
    el.innerHTML = '<svg class="dv-noise" aria-hidden="true"><filter id="dvn"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#dvn)" opacity="0.6"/></svg><span class="dv-hl" aria-hidden="true"></span>' +
      '<div class="dv-top"><div style="display:flex;align-items:baseline;gap:8px"><span class="dv-emboss">ZEROIQ</span><span class="dv-eng" id="dvModel">AGENT-01</span></div><div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;gap:6px"><button type="button" role="switch" class="dv-snd' + (snd.on ? '' : ' off') + '" data-act="sound" aria-checked="' + snd.on + '" aria-label="Button sounds"><span></span></button><span class="dv-eng" aria-hidden="true">SND</span></span><span class="dv-eng">S0 · LIVE</span><span class="dv-led" aria-hidden="true"></span><span class="dv-grille" aria-hidden="true">' + g + '</span></div></div>' +
      '<div id="dvFace" class="dv-face"></div>' +
      '<div class="dv-foot"><span class="dv-screw" aria-hidden="true"></span><span class="dv-eng" id="dvFoot" style="color:#6d7079;font-weight:600"></span><span class="dv-screw" aria-hidden="true"></span></div>';
    el._h = null; buildFace();
  }
  function buildFace() {
    var f = $('dvFace');
    if (st.face === 'back') {
      f.innerHTML = '<div class="dv-rail" id="dvRail" role="group" aria-label="Control panel mode"></div><div class="dv-panel" id="dvPanel"></div>' +
        '<div class="dv-lcd dv-rules"><span class="dv-rules-h">RULES · LIVE</span><pre id="rulesPreview" aria-live="polite"></pre></div>' +
        '<div class="dv-slot" id="dvSlot"></div><div class="dv-keys" id="dvKeysB"></div>';
      $('dvModel').textContent = 'CONTROL PANEL'; $('dvFoot').textContent = 'S/N ZQ-0001 · MADE FOR ROBINHOOD CHAIN';
    } else {
      f.innerHTML = '<div class="dv-bezel"><div class="dv-screen"><div class="scr-top" id="scrTop"></div><div id="scrMain" class="scr-main"></div><div id="scrOv"></div></div></div>' +
        '<div class="dv-read" id="dvRead"></div><div class="dv-keys" id="dvKeys"></div>';
      $('dvModel').textContent = 'AGENT-01'; $('dvFoot').textContent = 'SEASON 0 · ROBINHOOD CHAIN';
    }
    ['dvRail', 'dvPanel', 'dvSlot', 'dvKeysB', 'scrTop', 'scrMain', 'scrOv', 'dvRead', 'dvKeys'].forEach(function (id) { var e = $(id); if (e) e._h = null; });
  }
  function meter(l, v, label, hint, warn) {
    var n = Math.round(v / 8.34), b = '';
    for (var i = 0; i < 12; i++) b += '<span style="background:' + (i < n ? (warn ? '#ff7a6b' : '#c6f432') : '#1d2810') + '"></span>';
    return '<div class="scr-meter" title="' + hint + '"><span class="scr-ml">' + l + '</span><span class="scr-blocks" role="meter" aria-label="' + l + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + v + '">' + b + '</span><span class="scr-mv">' + label + '</span></div>';
  }
  var wrCache = {};
  function winRate4(dna) {
    var k = [dna.patience, dna.fomo, dna.risk, dna.freq, dna.style].join('|'); if (wrCache[k] !== undefined) return wrCache[k];
    var w = 0, n = 0; [0, 1, 2, 3].forEach(function (si) { var tr = simulate(prices(si), dna), buy = null; tr.forEach(function (t) { if (t.act === 'BUY') buy = t.price; else if (buy !== null) { n++; if (t.price > buy) w++; buy = null; } }); });
    return (wrCache[k] = n ? Math.round(w / n * 100) : null);
  }
  function winRate(trades) {
    var w = 0, n = 0, buy = null;
    trades.forEach(function (t) { if (t.act === 'BUY') buy = t.price; else if (buy !== null) { n++; if (t.price > buy) w++; buy = null; } });
    return n ? Math.round(w / n * 100) : null;
  }
  function ovBox(head, body, btns) { return '<div class="scr-ov" role="dialog" aria-label="' + head + '"><span class="scr-ov-h">' + head + '</span>' + body + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + btns + '</div></div>'; }
  function ovBtn(act, t, primary, extra) { return '<button type="button" class="scr-btn' + (primary ? ' on' : '') + '" data-act="' + act + '"' + (extra || '') + '>[ ' + t + ' ]</button>'; }
  function screenTop(m) {
    if (m.hatching) return 'BUILDING…';
    if (st.sim) return simElapsed() < SIM_SETUP ? 'BACKTEST · SETTING UP' : 'BACKTEST · PAST WEEK · ' + Math.max(0, Math.ceil((SIM_TOTAL - simElapsed()) / 1000)) + 's';
    var a = st.agentRef;
    if (st.ctx === 'mine' && a) return (a.paused ? 'PAUSED' : (a.vault ? 'LIVE · VAULT $' + a.vault : 'NEEDS FUNDING')) + ' · #' + a.id;
    if (st.ctx === 'public' && a) return 'AGENT #' + a.id + ' · ' + shortAddr(a.owner);
    return m.born ? 'READY · SET UP, THEN MINT' : 'EXAMPLE AGENT';
  }
  function mintOv(m) {
    return ovBox('GO LIVE · Ξ0.001', '<span class="scr-ov-t">Mint ' + esc(m.name) + ' as an onchain agent (ERC-8004) for 0.001 ETH on Robinhood Chain, then fund its vault. It shows up in the explorer and on 8004scan. Create as many agents as you like.</span><span class="scr-ov-s">Preview: nothing is charged and no wallet is connected. Live trading is not offered in the US, UK, Canada or Switzerland.</span>', ovBtn('mintgo', ME.user ? 'MINT' : 'LOG IN & MINT', true) + ovBtn('closeov', 'CLOSE'));
  }
  function loginOv() {
    return ovBox('LOG IN', '<span class="scr-ov-t">Pick how you sign in. A wallet signs a message, no gas.</span><span class="scr-ov-s">Preview: no real account or wallet is connected.</span>', ovBtn('login', 'GOOGLE', true, ' data-m="google"') + ovBtn('login', 'WALLET', true, ' data-m="wallet"') + ovBtn('closeov', 'CANCEL'));
  }
  function actionOv(m) {
    if (st.ctx === 'mine') return ovBox('FUND THE VAULT', '<span class="scr-ov-t">Send USDG and a little ETH for gas to the vault ' + shortAddr(fakeAddr('vault' + (st.agentRef ? st.agentRef.id : ''))) + '. The agent can only trade it. Only you can withdraw.</span><span class="scr-ov-s">Preview: deposits open with Season 0.</span>', ovBtn('closeov', 'OK', true));
    return mintOv(m);
  }
  function limeKey() {
    var t = st.ctx === 'public' ? ['COPY', 'COPY THIS AGENT', 'copyopen'] : (st.ctx === 'mine' ? ['DEPOSIT', 'FUND THE VAULT', 'mint'] : ['MINT · Ξ0.001', 'ENTER THE LEAGUE', 'mint']);
    return kc('<button type="button" class="dv-key lime dv-mint" data-act="' + t[2] + '" aria-expanded="' + !!st.mintOpen + '">' + t[0] + '</button>', t[1]);
  }

  function frontRender(m) {
    var bt = st.btick || 0;
    setHTML('scrTop', '<span>' + screenTop(m) + '</span><span>NVDA · 24/7</span>');
    var s = '';
    if (st.sim && simElapsed() < SIM_SETUP) {
      var sp = simElapsed() / SIM_SETUP;
      s += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;flex:1 1 auto"><img alt="" class="shake" style="width:120px;height:120px" src="' + robot(m.subject, { preset: m.preset, stage: m.stage, mood: 'ok' }) + '"><div style="display:flex;flex-direction:column;gap:6px;font-size:13px">';
      ['loading last week of prices', 'applying your settings', 'starting the replay'].forEach(function (l, i) { var dn = sp >= (i + 1) / 3, cur = !dn && sp >= i / 3; s += '<span style="color:' + (dn ? '#c6f432' : (cur ? '#d9ff5c' : '#4d5f1c')) + '">' + (dn ? '✓' : (cur ? '›' : '·')) + ' ' + l + '</span>'; });
      s += '<span style="font-size:10px;color:#6f8a22;margin-top:4px">not real trades · sample prices</span></div></div>';
    } else if (m.hatching) {
      s += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;flex:1 1 auto"><img alt="" class="' + (bt < 8 ? 'shake' : 'pop') + '" style="width:140px;height:140px" src="' + robot(m.subject, { preset: m.preset, stage: bt < 8 ? 0 : 1, mood: 'happy' }) + '"><div style="display:flex;flex-direction:column;gap:6px;font-size:13px">';
      ['reading its personality', 'compiling rules', 'hatching', 'replaying last week'].forEach(function (l, i) {
        var dn = bt >= (i + 1) * 4, cur = !dn && bt >= i * 4;
        s += '<span style="color:' + (dn ? '#c6f432' : (cur ? '#d9ff5c' : '#4d5f1c')) + '">' + (dn ? '✓' : (cur ? '›' : '·')) + ' ' + l + '</span>';
      });
      s += '</div></div>';
    } else {
      var wr = winRate4(m.dna), risk = Math.min(100, Math.round(m.sim.dd * 100 / st.tune.limit * 100));
      var sk = skillNames().length ? SKILLS.filter(function (k) { return st.skills[k[0]]; }).map(function (k) { return SK_SHORT[k[0]]; }).join(' + ') : '';
      s += '<div style="display:flex;gap:14px;align-items:center"><img alt="' + esc(m.name) + ', your agent" class="' + (m.mood === 'happy' ? 'bob' : '') + '" style="width:96px;height:96px;flex:0 0 auto" src="' + robot(m.subject, { preset: m.preset, stage: m.stage, mood: m.mood }) + '">';
      s += '<div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 auto"><span class="doto scr-name">' + esc(m.name) + '</span><span class="scr-sub">' + (m.mood === 'happy' ? 'HAPPY' : (m.mood === 'sad' ? 'GRUMPY' : 'CALM')) + '' + ' · ' + sk + '</span>';
      s += meter('WIN RATE', wr === null ? 0 : wr, wr === null ? '—' : wr + '%', 'Share of closed trades that made money this week');
      s += meter('RISK USED', risk, risk + '%', 'How much of the daily loss limit it has already used', true);
      s += meter('SYNC', m.fedV, m.fedV + '%', 'How well it knows your style. Answer its daily question to raise it');
      s += '<span class="scr-legend">SYNC · answer its daily question and it trades more like you</span></div></div>';
      s += chartHTML(m);
      s += '<p aria-live="polite" class="scr-diary">› “' + esc(m.diary) + '”</p>';
      if (m.born) s += '<span class="scr-legend">READ FROM YOUR WORDS: ' + esc(m.parsed.cues.join(', ').toUpperCase()) + '</span>';
    }
    setHTML('scrMain', s);
    var ov = '';
    if (st.flow === 'login') ov = loginOv();
    else if (st.mintOpen) ov = actionOv(m);
    else if (st.shareOpen && m.born) {
      var tweet = 'I just built ' + m.name + ', an AI trader on ZeroIQ. Backtest on last week: ' + fmt(m.sim.ret) + '. zeroiq.ai';
      ov = ovBox('SHARE CARD', '<div class="scr-card"><img alt="" src="' + robot(m.subject, { preset: m.preset, stage: m.stage, mood: m.mood }) + '"><span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:10px;letter-spacing:.1em;color:#c6f432">JUST HATCHED</span><span class="doto" style="font-size:18px;line-height:1.05;color:#fff">' + esc(m.name) + '</span><span style="font-size:11px;color:#a3a3a0">backtest, past week: <span style="color:' + (m.sim.ret >= 0 ? '#c6f432' : '#ff7a6b') + '">' + fmt(m.sim.ret) + '</span></span></span></div>',
        '<a class="scr-btn on" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(tweet) + '">[ OPEN X ]</a>' + ovBtn('closeov', 'CLOSE'));
    } else if (st.saveOpen) ov = ovBox('ON THE LIST', '<span class="scr-ov-t">We will ping you when Season 0 and minting open.</span>', ovBtn('closeov', 'OK', true));
    else if (m.born && m.done && !st.pagerOff && !st.sim) { var pq = pagerQueue(m); if (pq.length) ov = pagerOv(pq); }
    setHTML('scrOv', ov);
    var ro = function (v, l, c) { return '<div class="dv-kc"><div class="dv-lcd dv-ro"><span class="doto" style="color:' + c + '">' + v + '</span></div><span class="dv-eng">' + l + '</span></div>'; };
    setHTML('dvRead', ro(fmt(m.sim.ret), '7D RETURN', m.sim.ret >= 0 ? '#c6f432' : '#ff7a6b') + ro(('0' + m.trades.length).slice(-2), 'TRADES', '#d9ff5c') + ro((m.sim.dd * 100).toFixed(1) + '%', 'MAX DD', '#d9ff5c'));
    setHTML('dvKeys', kc('<button type="button" class="dv-key dv-round" data-act="flip" aria-label="Tune: flip the device to the control panel">' + TUNE_ICON + '</button>', 'TUNE') +
      kc('<button type="button" class="dv-key dv-round' + (st.sim ? ' busy' : '') + '" data-act="replay"' + (st.sim ? ' aria-disabled="true" aria-label="Simulation running"' : ' aria-label="Simulate last week in black and white"') + '>' + (st.sim ? SPIN_ICON : '▶') + '</button>', st.sim ? 'RUNNING' : 'SIMULATE') +
      kc('<button type="button" class="dv-key dv-round" data-act="share" aria-label="Share on X"' + (m.born ? '' : ' aria-disabled="true" title="Try an agent first"') + '>⇪</button>', 'SHARE') +
      limeKey());
  }
  function fader(key, label, val, min, max, color, attr) {
    var hid = st.hidden && st.hidden[key], top = hid ? 56 : Math.round((1 - (val - min) / (max - min)) * 112);
    return '<div class="dv-fader"' + (hid ? ' title="Not set by the owner"' : '') + '><span class="mono" id="tv-' + key + '" style="font-size:11px;font-weight:700;color:' + (hid ? '#5a5d66' : color) + '">' + (hid ? '—' : (key === 'limit' ? '−' + val + '%' : val)) + '</span><div class="dv-ftrack"><span class="dv-frail"></span>' +
      [0, 1, 2, 3, 4, 5].map(function (i) { return '<span class="dv-tick" style="top:' + (6 + i * 22) + 'px"></span>'; }).join('') +
      '<span class="dv-cap' + (hid ? ' off' : '') + '" id="cap-' + key + '" style="top:' + top + 'px;border-top-color:' + (hid ? '#5a5d66' : color) + '"></span><input type="range" min="' + min + '" max="' + max + '" value="' + val + '" ' + attr + '="' + key + '" aria-label="' + label + (hid ? ', not set by the owner' : '') + '"' + (st.readonly ? ' disabled' : '') + '></div><span class="dv-eng">' + label + '</span></div>';
  }

  function lean(d) { return st.tune.lean === undefined ? (d.style === 'momentum' ? 75 : 25) : st.tune.lean; }
  function knobDeg(v) { return Math.round(-135 + v / 99 * 270); }
  function knobLabel(v) { return 'DIP ◂ ' + ('0' + v).slice(-2) + ' ▸ MOMO'; }
  function knobText(v) { return v < 50 ? 'dip buyer, ' + (99 - v) + '% dip' : 'momentum, ' + v + '% momentum'; }
  function setLean(v, quiet) {
    v = Math.max(0, Math.min(99, Math.round(v)));
    var old = st.tune.lean === undefined ? lean(model().dna) : st.tune.lean;
    if (v === old) return;
    if (!quiet && Math.floor(v / 4) !== Math.floor(old / 4)) sfx('tick');
    st.tune.lean = v; st.preset = null;
    st.dnaPatch = Object.assign({}, st.dnaPatch || {}, { style: v >= 50 ? 'momentum' : 'dip' });
    var k = $('dvKnob'); if (k) { k.style.transform = 'rotate(' + knobDeg(v) + 'deg)'; k.setAttribute('aria-valuenow', v); k.setAttribute('aria-valuetext', knobText(v)); }
    var l = $('dvKnobL'); if (l) l.textContent = knobLabel(v);
    var pr = $('tv-preset'); if (pr) pr.textContent = 'PRESET: CUSTOM';
    document.querySelectorAll('#device [data-act=preset].on').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    var rp = $('rulesPreview'); if (rp) rp.textContent = rulesText(model().dna, st.tune.limit);
    saveMine();
  }
  function panelHTML(m) {
    var d = m.dna, t = st.tune, mode = st.mode || 'EQ', p = '';
    if (st.flow === 'login') return loginOv();
    if (st.mintOpen) return actionOv(m);
    if (mode === 'EQ') {
      p += '<div style="display:flex;justify-content:space-between;align-items:center"><span class="dv-eng">EQUALIZER</span><span class="mono" id="tv-preset" style="font-size:10px;font-weight:700;color:#c6f432">PRESET: ' + (st.preset || 'CUSTOM') + '</span></div>';
      p += '<div style="display:flex;justify-content:space-between;align-items:flex-end;padding:0 4px">' + fader('patience', 'PAT', d.patience, 0, 99, '#c6f432', 'data-dna') + fader('fomo', 'FOMO', d.fomo, 0, 99, '#c6f432', 'data-dna') + fader('risk', 'RISK', d.risk, 0, 99, '#c6f432', 'data-dna') + fader('freq', 'ACT', d.freq, 0, 99, '#c6f432', 'data-dna') + fader('limit', 'LOSS', t.limit, 3, 20, '#ff7a6b', 'data-tune') + '</div>';
      var momo = d.style === 'momentum';
      p += '<div style="display:flex;align-items:center;gap:14px"><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;flex:1 1 auto">' + ['ZEN', 'DIP', 'MOMO', 'DEGEN'].map(function (z) { return '<button type="button" class="dv-key dv-sm' + (st.preset === z ? ' on' : '') + '" data-act="preset" data-p="' + z + '" aria-pressed="' + (st.preset === z) + '">' + z + '</button>'; }).join('') + '</div>';
      var ln = lean(d);
      p += '<div class="dv-kc"><div class="dv-knobwrap"><span class="dv-kring" aria-hidden="true"></span><div class="dv-knob" id="dvKnob" role="slider" tabindex="0" aria-label="Trading style, dip buyer to momentum" aria-valuemin="0" aria-valuemax="99" aria-valuenow="' + ln + '" aria-valuetext="' + knobText(ln) + '" style="transform:rotate(' + knobDeg(ln) + 'deg)"><span></span></div></div><span class="dv-eng" id="dvKnobL">' + knobLabel(ln) + '</span></div></div>';
    } else if (mode === 'MARKETS') {
      p += '<span class="dv-eng">WATCHLIST</span><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px">' + Object.keys(t.watch).map(function (k) { var on = t.watch[k]; return '<div class="dv-kc" style="gap:4px"><span class="dv-ledk' + (on ? ' on' : '') + '"></span><button type="button" class="dv-key dv-sm dv-full' + (on ? ' on' : '') + '" data-act="watch" data-t="' + k + '" aria-pressed="' + on + '">' + k + '</button></div>'; }).join('') + '</div>';
      p += '<span class="dv-eng">ONCHAIN SKILLS</span><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' + SKILLS.map(function (k) { var on = !!st.skills[k[0]]; return '<button type="button" class="dv-key dv-sm' + (on ? ' on' : '') + '" data-act="skill" data-k="' + k[0] + '" aria-pressed="' + on + '" title="' + k[2] + '"><span class="dv-ledk' + (on ? ' on' : '') + '"></span>' + SK_SHORT[k[0]] + '</button>'; }).join('') + '</div>';
      p += '<span class="dv-note">The replay simulates spot trades. Other skills switch on in Season 0.</span>';
    } else {
      p += CONN.map(function (c) { var on = !!t.conn[c[0]], soon = c[3] === 'soon'; return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span style="display:flex;flex-direction:column;min-width:0"><span style="font:700 12px Inter,sans-serif;color:#e6e7ea">' + c[1] + '</span><span class="mono" style="font-size:10px;color:#8a8d96">' + c[2] + '</span></span><button type="button" role="switch" aria-checked="' + on + '" aria-label="' + c[1] + '" class="dv-tog' + (on ? ' on' : '') + '" data-act="conn" data-c="' + c[0] + '"' + (soon ? ' disabled' : '') + '><span></span></button></div>'; }).join('');
      p += '<span class="dv-eng">X ACCOUNTS · UP TO 3</span><div class="dv-lcd dv-xin">' + t.handles.map(function (h, i) { return '<span class="dv-xh">' + esc(h) + '<button type="button" data-act="rmx" data-i="' + i + '" aria-label="Remove ' + esc(h) + '">×</button></span>'; }).join('') + (t.handles.length < 3 ? '<input id="xHandle" type="text" maxlength="16" placeholder="@handle▍" aria-label="X handle to follow"><button type="button" class="scr-btn on" data-act="addx">[ ADD ]</button>' : '') + '</div>';
      p += '<span class="dv-note">Posts are signals it weighs inside its rules, never orders. Signals switch on in Season 0.</span>';
    }
    if (st.readonly) {
      p = p.replace(/<button type="button" class="dv-(key|tog)/g, '<button type="button" disabled class="dv-$1').replace('<input id="xHandle"', '<input id="xHandle" disabled').replace('tabindex="0"', 'tabindex="-1" aria-disabled="true"');
      if (mode === 'EQ' && st.hidden.lean) { var l0 = lean(d); p = p.replace(knobLabel(l0), 'NOT SET').replace('rotate(' + knobDeg(l0) + 'deg)', 'rotate(0deg)').replace('<div class="dv-knobwrap">', '<div class="dv-knobwrap" title="Not set by the owner">'); }
      if (mode === 'SIGNALS' && !t.handles.length) p = p.replace('<div class="dv-lcd dv-xin">', '<div class="dv-lcd dv-xin"><span style="font-size:12px;color:#4d5f1c">none shared</span>');
    }
    return p;
  }
  function renderBack() {
    if (!$('dvPanel')) return;
    var m = model(), mode = st.mode || 'EQ', ae = document.activeElement, fk = null;
    if (ae && ae.closest && ae.closest('#device') && ae.getAttribute('data-act')) fk = '[data-act="' + ae.getAttribute('data-act') + '"]' + ['data-p', 'data-t', 'data-k', 'data-c', 'data-m'].map(function (a) { var v = ae.getAttribute(a); return v ? '[' + a + '="' + v + '"]' : ''; }).join('');
    setHTML('dvRail', ['EQ', 'MARKETS', 'SIGNALS'].map(function (x) { return '<button type="button" class="dv-key dv-mode' + (x === mode ? ' on' : '') + '" data-act="mode" data-m="' + x + '" aria-pressed="' + (x === mode) + '">' + x + '</button>'; }).join(''));
    var pe = $('dvPanel'); pe._h = null; setHTML('dvPanel', panelHTML(m));
    var hl = Object.keys(st.hidden || {}).filter(function (k) { return st.hidden[k]; });
    $('rulesPreview').textContent = (hl.length ? 'private: ' + hl.join(', ') + ' · shown in the middle\n' : '') + rulesText(m.dna, st.tune.limit);
    var md = st.md;
    if (st.readonly) setHTML('dvSlot', '<span class="dv-mouth" aria-hidden="true"></span><span style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto"><span class="mono" style="font-size:10px;font-weight:800;letter-spacing:.1em;color:#8a8d96">STRATEGY FILE · PRIVATE</span><span class="mono" style="font-size:10px;color:#6d7079">copy the agent to load your own</span></span>');
    else setHTML('dvSlot', '<span class="dv-mouth" aria-hidden="true"></span><span style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto"><span class="mono" style="font-size:10px;font-weight:800;letter-spacing:.1em;color:' + (md ? '#c6f432' : '#e6e7ea') + '">' + (md ? 'LOADED · ' + esc(md.name.toUpperCase()).slice(0, 26) : 'STRATEGY FILE · .MD') + '</span><span class="mono" style="font-size:10px;color:#8a8d96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (md ? (md.size / 1024).toFixed(1) + ' KB · ' + md.lines + ' lines' + (md.title ? ' · ' + esc(md.title) : '') : 'your playbook in markdown · read in Season 0') + '</span></span>' +
      (md ? '<button type="button" class="dv-key dv-slotbtn" data-act="eject" aria-label="Remove strategy file">EJECT</button>' : '<button type="button" class="dv-key dv-slotbtn" data-act="load" aria-label="Load a strategy .md file">LOAD</button>'));
    setHTML('dvKeysB', kc('<button type="button" class="dv-key dv-round" data-act="flip" aria-label="Flip back to the screen">' + TUNE_ICON.replace('rotate(90deg)', 'rotate(-90deg) scaleX(-1)') + '</button>', 'FRONT') +
      kc('<button type="button" class="dv-key dv-sim' + (st.sim ? ' busy' : '') + '" data-act="simulate"' + (st.sim ? ' aria-disabled="true"' : '') + '>' + (st.sim ? SPIN_ICON + ' RUNNING' : '▶ BACKTEST') + '</button>', 'PAST WEEK · SAMPLE') +
      limeKey());
    if (fk) { var n = document.querySelector('#device ' + fk); if (n) n.focus(); }
  }
  var hotAnimating = false;
  function followCables(ms) {
    var svg = $('cables'); if (!svg) return; svg.classList.add('live'); var t0 = performance.now();
    (function step() { cableKey = ''; drawCables(); if (performance.now() - t0 < ms) requestAnimationFrame(step); else svg.classList.remove('live'); })();
  }
  function animHot(open) {
    var g = $('skills'); render();
    if (reduce) { g.hidden = !open; drawCables(); return; }
    hotAnimating = true; g.hidden = false; g.style.overflow = 'hidden';
    var full = g.scrollHeight; g.style.transition = 'none'; g.style.maxHeight = (open ? 0 : full) + 'px'; g.style.opacity = open ? 0 : 1; void g.offsetWidth;
    g.style.transition = 'max-height .3s ease, opacity .3s ease'; g.style.maxHeight = (open ? full : 0) + 'px'; g.style.opacity = open ? 1 : 0;
    followCables(340);
    setTimeout(function () { hotAnimating = false; g.style.transition = ''; g.style.maxHeight = ''; g.style.opacity = ''; g.style.overflow = ''; g.hidden = !st.hotOpen; cableKey = ''; drawCables(); }, 320);
  }
  var cableKey = '';
  function drawCables() {
    var svg = $('cables'), sec = $('heroSec'), col = $('heroDevCol');
    if (!svg || !sec) return;
    if (!col || !col.contains($('devWrap')) || page !== 'create') { svg.style.display = 'none'; cableKey = ''; return; }
    svg.style.display = '';
    var js = document.querySelectorAll('.inp-jacks .jack'), ps = document.querySelectorAll('#dvPort .jack');
    if (js.length < 2 || ps.length < 2) return;
    var r0 = sec.getBoundingClientRect();
    var c = function (el) { var r = el.getBoundingClientRect(); return [r.left + r.width / 2 - r0.left, r.top + r.height / 2 - r0.top]; };
    var A = [c(js[0]), c(js[1])], B = [c(ps[0]), c(ps[1])];
    if (st.face === 'back') B = [B[1], B[0]];
    var f = function (v) { return v.toFixed(1); };
    var P = [0, 1].map(function (i) {
      var x1 = A[i][0], y1 = A[i][1] + 24, x2 = B[i][0], y2 = B[i][1] + 24;
      if (y2 > y1 + 220 && Math.abs(x2 - x1) < 240) {
        var side = 8 + i * 12;
        return 'M' + f(x1) + ' ' + f(y1) + ' C' + f(x1) + ' ' + f(y1 + 60) + ' ' + side + ' ' + f(y1 + 30) + ' ' + side + ' ' + f(y1 + 120) + ' L' + side + ' ' + f(y2 + 10) + ' C' + side + ' ' + f(y2 + 80) + ' ' + f(x2) + ' ' + f(y2 + 80) + ' ' + f(x2) + ' ' + f(y2);
      }
      var sag = Math.max(y1, y2) + 80 + i * 12;
      return 'M' + f(x1) + ' ' + f(y1) + ' C' + f(x1) + ' ' + f(sag) + ' ' + f(x2) + ' ' + f(sag) + ' ' + f(x2) + ' ' + f(y2);
    });
    var key = P.join('|'); if (key === cableKey) return; cableKey = key;
    var boot = function (id, x, y) { var r = $(id); if (!r) return; r.setAttribute('x', (x - 5.5).toFixed(1)); r.setAttribute('y', (y - 2).toFixed(1)); r.setAttribute('width', 11); r.setAttribute('height', 28); r.setAttribute('rx', 2.5); };
    boot('bA1', A[0][0], A[0][1]); boot('bA2', B[0][0], B[0][1]); boot('bB1', A[1][0], A[1][1]); boot('bB2', B[1][0], B[1][1]);
    boot('bA1t', A[0][0], A[0][1]); boot('bA2t', B[0][0], B[0][1]); boot('bB1t', A[1][0], A[1][1]); boot('bB2t', B[1][0], B[1][1]);
    [['cAo', 0], ['cA', 0], ['cAt', 0], ['cAh', 0], ['cBo', 1], ['cB', 1], ['cBt', 1], ['cBh', 1]].forEach(function (q) { var el = $(q[0]); el.setAttribute('d', P[q[1]]); try { el.style.d = 'path("' + P[q[1]] + '")'; } catch (e) {} });
  }
  window.addEventListener('resize', function () { drawCables(); });
  function refresh() { if (st.face === 'back') renderBack(); else render(); }
  function flip(to) {
    var el = $('devBody') || $('device');
    var swap = function () { st.face = to; buildFace(); if (to === 'back') renderBack(); else render(); drawCables(); };
    if (reduce) { swap(); return; }
    var dg = to === 'back' ? 90 : -90;
    followCables(560);
    el.style.transition = 'transform .25s ease-in';
    el.style.transform = 'perspective(1400px) rotateY(' + dg + 'deg)';
    setTimeout(function () {
      swap();
      el.style.transition = 'none';
      el.style.transform = 'perspective(1400px) rotateY(' + dg + 'deg)';
      void el.offsetWidth;
      el.style.transition = 'transform .25s ease-out';
      el.style.transform = 'perspective(1400px) rotateY(0deg)';
    }, 250);
  }

  function bar(label, v, col) {
    return '<div class="mono" style="display:flex;align-items:center;gap:8px;font-size:11px;color:#a3a3a0"><span style="width:56px">' + label + '</span><span style="flex:1 1 auto;height:6px;border-radius:999px;background:#2b2b2b;display:block"><span style="display:block;height:6px;border-radius:999px;width:' + v + '%;background:' + col + '"></span></span></div>';
  }
  function stepBtn(done, cta, act) {
    return '<button type="button" class="btn sm ' + (done ? '' : 'dark') + '" data-act="' + act + '" style="' + (done ? 'border-color:#cfe8d6;color:#0a7f3f;background:#f3faf5' : '') + '">' + cta + '</button>';
  }

  function render() {
    var nmEl = $('agentName');
    if (nmEl && (st.ctx || 'home') === 'home') st.nameOverride = nmEl.value.trim() || null;
    var m = model();
    if (nmEl && st.ctx === 'home') nmEl.placeholder = m.autoName;
    var p = prompt();
    $('hatchBtn').textContent = 'SET UP ▶';
    setHTML('skills', hotHTML());
    var hn = hotNames(), hh = $('hotHead');
    if (hh) { setHTML('hotHead', 'HOT OPTIONS · <b>' + (hn.length ? hn.length + ' ON' : 'OFF') + '</b>' + (hn.length ? ' · ' + esc(hn.join(', ')).slice(0, 44) : ' · AI BASKET, MEME SNIPER, X ALPHA…') + '<i>' + (st.hotOpen ? '▴ HIDE' : '▾ SHOW') + '</i>'); hh.setAttribute('aria-expanded', !!st.hotOpen); if (!hotAnimating) $('skills').hidden = !st.hotOpen; }

    // hero dynamic area: presets inside the input panel
    var hd = '';
        hd += '<div class="inp-presets" role="group" aria-label="Presets">' + IDEAS.map(function (t, i) { var on = p.trim() === t; return '<button type="button" class="pk' + (on ? ' on' : '') + '" data-act="idea" data-i="' + i + '" aria-pressed="' + on + '">' + t + '</button>'; }).join('') + '</div>';
    var stepN = (st.mintOpen || st.flow) ? 3 : ((m.born || m.hatching || st.face === 'back' || hn.length) ? 2 : 1);
    var stEls = document.querySelectorAll('#inSteps span'); for (var si = 0; si < stEls.length; si++) stEls[si].className = si < stepN ? 'on' : '';
    setHTML('heroDyn', hd);

    // device
    if (!$('dvFace')) buildShell();
    if (st.face !== 'back') frontRender(m);
    $('device').className = 'dv' + (st.tint ? ' t' + st.tint : '') + (st.readonly ? ' ro' : '') + (st.sim ? ' sim' : '');
    $('device').classList.toggle('sim', !!st.sim);
    if (st.ctx === 'mine' || st.ctx === 'public') setHTML('devNote', 'Sample prices. Live trading opens with Season 0.'); else setHTML('devNote', st.ctx === 'home' ? '' : (m.born ? 'Read from your words: ' + esc(m.parsed.cues.join(', ')) + '. ' : '') + 'The backtest runs on sample prices and simulates spot trades only.');

    // most copied + duel
    setHTML('dying', PUB.slice().sort(function (a, b) { return b.copiers - a.copiers; }).slice(0, 3).map(function (s) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #f1f1ee"><img alt="" style="width:40px;height:40px;background:#0f0f0f;border-radius:8px;flex:0 0 auto" src="' + robot(s.prompt, { preset: s.preset, stage: 3, mood: 'happy' }) + '"><div style="display:flex;flex-direction:column;flex:1 1 auto;min-width:0"><strong style="font-size:15px;font-weight:600">' + esc(s.name) + '</strong><span class="mono" style="font-size:12px;color:#6b6b6b">' + s.copiers + ' copiers · ' + fmt(s.avg) + ' / wk</span></div><a class="btn sm" href="#/agent/' + s.id + '">Copy</a></div>';
    }).join(''));
    drawCables();
    setHTML('duel', st.duel ? '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:12px;padding:12px 16px"><span style="font-size:15px">Duel queued: <strong>' + esc((m.born ? m.name : 'your agent') + ' vs ' + st.duel) + '</strong>. Starts with the next round.</span><button type="button" class="btn sm" data-act="duelcancel">Cancel</button></div>' : '');
  }

  function renderStatic() {
    var T = [['TRADE', 'Zen Goblin bought NVDA on a −3% day', '', '#fff'], ['BEAT HOLD', 'Lucky Robot vs holding SPY', '+2.1%', '#c6f432'], ['FOLLOWED', 'Degen Hamster has 263 followers', '', '#fff'], ['FORKED', 'Calm Hamster forked 12 times', '', '#fff'], ['SAMPLE', 'all data on this page is sample data', '', '#fff']];
    var tk = T.concat(T).map(function (t) { return '<span><span style="color:#c6f432">' + t[0] + '</span> ' + t[1] + ' <span style="color:' + t[3] + '">' + t[2] + '</span></span>'; }).join('');
    $('ticker').innerHTML = tk;
    var art = [
      '<div class="stp-lcd"><span>› make me rich, make no mistakes<b class="blink">▍</b></span><span class="dim">compiling rules…</span><span>BUY after 2 green · size 80%</span><span>SELL +3.1% / −4.0%</span></div>',
      '<div class="stp-lcd"><span class="dim">EQUITY · 7D · SAMPLE</span><svg viewBox="0 0 200 50" preserveAspectRatio="none" style="width:100%;height:48px"><polyline points="0,40 20,36 40,38 60,30 80,32 100,22 120,26 140,18 160,20 180,10 200,12" fill="none" stroke="#c6f432" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><span><b class="scr-mk b" style="position:static;transform:none">B</b> NVDA $112.90 → <b class="scr-mk s" style="position:static;transform:none">S</b> $117.07 · +3.7%</span></div>',
      '<div class="stp-lcd"><span class="pg-h" style="display:flex;justify-content:space-between"><span>✉ PAGER · EVENT</span><span>1 NEW</span></span><span>NVDA reports tomorrow. Trade the move with half size?</span><span style="display:flex;gap:6px"><b class="pg-mini yes">+</b><b class="pg-mini">−</b></span></div>'];
    art = ['<div class="stp-lcd"><span class="dim">EXPLORER · 30D · SAMPLE</span><span>1 Zen Goblin   +8.1%  vs hold +3.2</span><span>2 Lucky Robot  +6.4%  vs hold +2.1</span><span>3 Quiet Oracle +5.0%  vs hold −0.4</span></div>', art[2], art[0]];
    var steps = [['01', 'Explore', 'Search agents by stock, style and risk. Each record comes from its trades onchain and is compared with simply holding the same stocks.'], ['02', 'Follow', 'Follow any agent for free. It pages you in Telegram on every trade, so you learn how it works before you put money in.'], ['03', 'Fork or build', 'Fork an agent’s settings, or describe your own in one sentence and tune every rule on the device. Backtest it, then go live with your own vault.']];
    $('steps').innerHTML = steps.map(function (s, i) { return '<article class="card" style="padding:20px"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' + art[i] + '<span class="doto" style="font-size:28px;color:#d4d4d0">' + s[0] + '</span></div><strong style="font-size:20px">' + s[1] + '</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">' + s[2] + '</span></article>'; }).join('');
    var ECO = [['Virtuals Protocol', 'Graduate', 'Agents with a proven onchain record launch as tokenized agents that others can back.', 'Planned'], ['8004scan', 'Agent explorer', 'Live agents register in the ERC-8004 registry on Robinhood Chain, so 8004scan and other explorers list them with their record.', 'Season 0'], ['Bankr', 'Agent tokens', 'Later: agents with a long record may get a token through Bankr. Only after legal review.', 'Planned'], ['ERC-8004', 'Agent passport', 'Every agent gets an onchain identity and a portable track record other arenas can read.', 'Planned'], ['Telegram', 'Pager', 'Your agents page you in Telegram. Answer with plus or minus.', 'Season 0'], ['X', 'Share cards + tags', 'Agent cards, big wins and duels ready to post. Tag your agent in a post to send it a signal.', 'Season 0'], ['Dune', 'Public logs', 'A dashboard where anyone can audit every agent decision.', 'Planned']];
    $('eco').innerHTML = ECO.map(function (e) { var pl = e[3] !== 'Season 0'; return '<article class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong style="font-size:17px">' + e[0] + '</strong><span class="mono" style="font-size:11px;padding:3px 8px;border-radius:6px;flex:0 0 auto;' + (pl ? 'background:#f1f1ee;color:#4a4a4a' : 'background:#111;color:#c6f432') + '">' + e[3] + '</span></div><span class="eyebrow">' + e[1] + '</span><span style="font-size:14px;line-height:1.5;color:#4a4a4a">' + e[2] + '</span></article>'; }).join('');
    var RM = [['Now', 'Explore and follow', 'Search agents trading stock tokens on Robinhood Chain, compare them with holding the same stocks, follow them in Telegram.', 'border:1.5px solid #111'], ['Next', 'Fork and build', 'Fork any agent’s settings or build your own on the device, backtest it, mint it as an ERC-8004 agent and fund its vault.', 'border:1px solid #e5e5e2'], ['Later', 'Reputation and more', 'Weekly results written to the ERC-8004 reputation registry, X signals, forks with a family tree. Agent tokens only after legal review.', 'border:1px dashed #d4d4d0;background:#f7f7f5']];
    $('roadmapGrid').innerHTML = RM.map(function (r) { return '<div style="' + r[3] + ';border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px"><span class="eyebrow">' + r[0] + '</span><strong style="font-size:18px">' + r[1] + '</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">' + r[2] + '</span></div>'; }).join('');
    var FAQ = [['Where do the numbers come from?', 'From each agent’s trades onchain, priced with stock tokens on Robinhood Chain. We compare every agent with simply holding the same stocks over the same days. In this preview all numbers are sample data.'], ['What does verified mean?', 'The agent has at least 7 days of history onchain. Newer agents are shown, but marked new.'], ['What is the difference between follow and fork?', 'Follow is free: the agent pages you in Telegram on every trade. Fork copies its settings into your own agent with your own vault. Settings the owner keeps private start in the middle.'], ['Is this real money?', 'Your own agents trade from a vault you own, a smart account. The agent gets a key that can only trade inside your limits, never withdraw. You can lose money. Before going live you can backtest it on last week.'], ['How many agents can I have?', 'As many as you want. Each one is its own mint, vault and record.'], ['Who can go live?', 'Stock tokens on Robinhood Chain are not offered in some countries, including the US, UK, Canada and Switzerland, so going live is blocked there. Exploring and following work everywhere.'], ['Is it really AI?', 'Partly, on purpose. Your sentence is compiled into plain rules you can read, and code executes them. Once a day an AI reviews the trades and proposes one change, which you approve or reject.'], ['How is the score calculated?', 'Average weekly return minus the worst drawdown, scaled to 0–100. A steady agent ranks above one that swung wildly, even if the wild one made more.'], ['What does the mint give me?', 'An ERC-8004 agent identity on Robinhood Chain, its own vault and a public record that 8004scan and other explorers can read. Minting costs 0.001 ETH.']];
    $('faqList').innerHTML = FAQ.map(function (q) { return '<details style="padding:16px 0;border-bottom:1px solid #e5e5e2"><summary style="font-size:16px;font-weight:600;display:flex;justify-content:space-between;gap:12px"><span>' + q[0] + '</span><span aria-hidden="true" style="color:#6b6b6b">+</span></summary><p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#4a4a4a;max-width:640px">' + q[1] + '</p></details>'; }).join('');
  }

  // ---------- events ----------
  var IDEAS = ['make me rich, make no mistakes', 'buy the dip on NVDA, stay calm', 'chase green candles, aggressive', 'trade rarely, careful sizing'];
  var EXAMPLES = [
    'make me rich, make no mistakes',
    'buy the dip on NVDA, stay calm',
    'chase green candles, aggressive, take profits fast',
    'trade rarely, careful sizing, only SPCX and SPY',
    'short GOOGL when it pumps, hedge everything',
    'copy @degen_intern but with half the risk',
    'earn yield on idle cash, buy AMD on red days',
    'momentum only, never hold over the weekend',
    'ape into meme tokens paired with NVDA, yolo',
    'sell before earnings, rebuy after the drop',
    'patient long-term, add to winners, cut losers at -5%'
  ];
  var ex = { i: 0, n: 0, mode: 'type', wait: 0 };
  function currentExample() { return EXAMPLES[ex.i]; }
  function typeTick() {
    var el = $('prompt');
    if (!el) return;
    if (el.value || document.activeElement === el) { el.placeholder = currentExample(); setTimeout(typeTick, 400); return; }
    var full = EXAMPLES[ex.i], delay = 45;
    if (ex.mode === 'type') {
      ex.n++;
      if (ex.n >= full.length) { ex.n = full.length; ex.mode = 'hold'; ex.wait = 0; }
      delay = 38 + Math.random() * 40;
    } else if (ex.mode === 'hold') {
      ex.wait++;
      if (ex.wait > 4) ex.mode = 'erase';
      delay = 450;
    } else {
      ex.n -= 2;
      if (ex.n <= 0) { ex.n = 0; ex.mode = 'type'; ex.i = (ex.i + 1) % EXAMPLES.length; delay = 350; } else delay = 18;
    }
    var caret = ex.mode === 'hold' ? (ex.wait % 2 ? ' ' : '▍') : '▍';
    el.placeholder = full.slice(0, ex.n) + caret;
    setTimeout(typeTick, delay);
  }
  // ---------- sound (synthesized, no files) ----------
  var snd = { on: true, ctx: null };
  try { snd.on = localStorage.getItem('zq-sound') !== 'off'; } catch (e) {}
  function ac() { if (!snd.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; snd.ctx = new C(); } if (snd.ctx.state === 'suspended') snd.ctx.resume(); return snd.ctx; }
  function tone(c, t0, f, f2, dur, type, vol) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(c, t0, dur, vol, hp) {
    var n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), x = b.getChannelData(0);
    for (var i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = hp || 1800; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0);
  }
  function sfx(kind) {
    if (!snd.on) return; var c = ac(); if (!c) return; var t = c.currentTime + 0.005;
    if (kind === 'tick') { noise(c, t, 0.012, 0.25, 3500); }
    else if (kind === 'key') { noise(c, t, 0.03, 0.35, 1500); tone(c, t, 220, 120, 0.05, 'triangle', 0.12); }
    else if (kind === 'switch') { noise(c, t, 0.02, 0.4, 2500); noise(c, t + 0.035, 0.015, 0.25, 2500); }
    else if (kind === 'mint') { noise(c, t, 0.03, 0.3, 1500); tone(c, t + 0.02, 660, 0, 0.12, 'square', 0.05); tone(c, t + 0.11, 990, 0, 0.18, 'square', 0.05); }
    else if (kind === 'flip') { noise(c, t, 0.22, 0.18, 600); tone(c, t, 180, 420, 0.2, 'sine', 0.06); }
    else if (kind === 'beep') { tone(c, t, 1320, 0, 0.06, 'square', 0.04); }
  }
  function sfxFor(el, a) {
    if (a === 'mint' || a === 'join') return 'mint';
    if (a === 'flip' || a === 'simulate') return 'flip';
    if (a === 'conn' || a === 'mode' || a === 'watch' || a === 'skill') return 'switch';
    if (el.closest('.dv-screen') || el.classList.contains('scr-btn')) return 'beep';
    return 'key';
  }
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('[data-act]');
    if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') sfx(sfxFor(b, b.getAttribute('data-act')));
    var k = e.target.closest && e.target.closest('#dvKnob'); if (!k || st.readonly) return;
    e.preventDefault(); k.focus(); sfx('key');
    var y0 = e.clientY, x0 = e.clientX, v0 = st.tune.lean === undefined ? lean(model().dna) : st.tune.lean;
    try { k.setPointerCapture(e.pointerId); } catch (er) {}
    var mv = function (ev) { setLean(v0 + ((y0 - ev.clientY) + (ev.clientX - x0)) * 0.6); };
    var up = function () { k.removeEventListener('pointermove', mv); k.removeEventListener('pointerup', up); k.removeEventListener('pointercancel', up); };
    k.addEventListener('pointermove', mv); k.addEventListener('pointerup', up); k.addEventListener('pointercancel', up);
  });
  document.addEventListener('wheel', function (e) {
    var k = e.target.closest && e.target.closest('#dvKnob'); if (!k || st.readonly) return;
    e.preventDefault(); setLean((st.tune.lean === undefined ? lean(model().dna) : st.tune.lean) + (e.deltaY < 0 ? 3 : -3));
  }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if (!e.target || e.target.id !== 'dvKnob' || st.readonly) return;
    var v = st.tune.lean === undefined ? lean(model().dna) : st.tune.lean, step = { ArrowUp: 3, ArrowRight: 3, ArrowDown: -3, ArrowLeft: -3, PageUp: 10, PageDown: -10 }[e.key];
    if (e.key === 'Home') step = -v; if (e.key === 'End') step = 99 - v;
    if (step === undefined) return; e.preventDefault(); setLean(v + step);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var a = b.getAttribute('data-act');
    var m = model();
    if (st.readonly && b.closest('#device') && /^(preset|watch|skill|conn|addx|rmx|knob|load|eject)$/.test(a)) return;
    if (a === 'hatch') startHatch(prompt() || currentExample());
    else if (a === 'idea') typeInto(IDEAS[+b.getAttribute('data-i')]);
    else if (a === 'twin') { $('prompt').value = '@degen_intern'; $('prompt').focus(); render(); }
    else if (a === 'ask') set({ askOpen: true });
    else if (a === 'tg') location.hash = '#/me';
    else if (a === 'mintgo') { if (!ME.user) { st.flow = 'login'; refresh(); } else mintCurrent(); }
    else if (a === 'login') { doLogin(b.getAttribute('data-m')); if (st.flow === 'login') { st.flow = null; mintCurrent(); } else if (ME.pendingCopy && findAgent(ME.pendingCopy)) doCopy(findAgent(ME.pendingCopy), Object.assign({}, copyCfg)); else route(); }
    else if (a === 'logout') { ME.user = null; saveMe(); route(); }
    else if (a === 'deposit') { st.mintOpen = true; st.flow = null; refresh(); try { $('device').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (er) {} }
    else if (a === 'copyopen') { var cpn = $('copyPanel'); if (cpn) cpn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else if (a === 'copy') { var src = findAgent(b.getAttribute('data-id')); if (!src) return; if (!ME.user) { ME.pendingCopy = src.id; saveMe(); location.hash = '#/me'; } else doCopy(src, Object.assign({}, copyCfg)); }
    else if (a === 'copywhat') { var sc = b.getAttribute('data-scope'); if (sc === 'pub') { copyCfg.what = b.getAttribute('data-v'); renderAgentPage(findAgent(curId)); } else if (st.agentRef && st.agentRef.copyCfg) { st.agentRef.copyCfg.what = b.getAttribute('data-v'); saveMe(); renderMe(); } }
    else if (a === 'demo' && st.agentRef) { st.agentRef.mode = st.agentRef.mode === 'demo' ? 'live' : 'demo'; saveMe(); render(); renderMe(); }
    else if (a === 'pause' && st.agentRef) { st.agentRef.paused = !st.agentRef.paused; saveMe(); render(); renderMe(); }
    else if (a === 'notify' && st.agentRef) { var nk = b.getAttribute('data-k'); st.agentRef.notify = st.agentRef.notify || {}; st.agentRef.notify[nk] = !st.agentRef.notify[nk]; saveMe(); renderMe(); }
    else if (a === 'tglink') { if (ME.tg) ME.tg.linked = true; saveMe(); if (page === 'follow') renderFollow(); else renderMe(); }
    else if (a === 'copycode') { try { navigator.clipboard.writeText('/start ' + (ME.tg ? ME.tg.code : '')); } catch (er) {} b.textContent = 'Copied'; }
    else if (a === 'hottog') { st.hotOpen = !st.hotOpen; animHot(st.hotOpen); }
    else if (a === 'hot') { toggleHot(b.getAttribute('data-k')); render(); if (st.face === 'back') renderBack(); }
    else if (a === 'tf') { st.tf = b.getAttribute('data-v'); render(); }
    else if (a === 'pyes' || a === 'pno') { applyPager(b.getAttribute('data-id'), a === 'pyes'); refresh(); }
    else if (a === 'bfilter') { boardFilter = b.getAttribute('data-v'); boardLimit = 25; renderBoard(); }
    else if (a === 'tokopen') { tokUI.open = true; renderTok(); try { document.querySelector('[data-tok=sym]').focus(); } catch (er) {} }
    else if (a === 'tokclose') { tokUI.open = false; tokUI.err = ''; renderTok(); }
    else if (a === 'tokpair') { tokUI.pair = b.getAttribute('data-v'); renderTok(); }
    else if (a === 'toklaunch') { var ta = findAgent(curId); if (ta && isMine(ta) && !ta.token) tokLaunch(ta); }
    else if (a === 'tokclaim') { var tc = findAgent(curId); if (tc && tc.token && isMine(tc)) { tc.token.claimed = tokMarket(tc).fees; saveMe(); sfx('mint'); renderTok(); } }
    else if (a === 'tokcopy') { try { navigator.clipboard.writeText(b.getAttribute('data-v')); } catch (er) {} b.textContent = 'Copied'; }
    else if (a === 'follow') { toggleFollow(b.getAttribute('data-id')); sfx('mint'); if (page === 'home') renderBoard(); else if (page === 'agent') renderAgentPage(findAgent(curId)); else if (page === 'follow') renderFollow(); renderTabs(); }
    else if (a === 'exstock') { exStock = b.getAttribute('data-v'); boardLimit = 25; renderBoard(); }
    else if (a === 'exsort') { exSort = b.getAttribute('data-v'); renderBoard(); }
    else if (a === 'exbots') { exHideBots = !exHideBots; boardLimit = 25; renderBoard(); }
    else if (a === 'extype') { exType = b.getAttribute('data-v'); if (exType === 'bot') exHideBots = false; boardLimit = 25; renderBoard(); }
    else if (a === 'claim') { if (!ME.user) { location.hash = '#/me'; return; } ME.claims = ME.claims || {}; ME.claims[b.getAttribute('data-id')] = Date.now(); saveMe(); sfx('mint'); renderAgentPage(findAgent(curId)); }
    else if (a === 'exver') { exVer = !exVer; boardLimit = 25; renderBoard(); }
    else if (a === 'bmore') { boardLimit += 25; renderBoard(); }
    else if (a === 'join' || a === 'save') { if (a === 'save' && !m.born) return; e.preventDefault(); st.mintOpen = false; st.shareOpen = false; st.joined = true; st.saveOpen = st.face !== 'back'; refresh(); if (st.face === 'back') render(); }
    else if (a === 'hold') set({ answered: 'hold', askOpen: false, xp: m.xp + 5, dnaPatch: Object.assign({}, st.dnaPatch || {}, { patience: Math.min(99, m.dna.patience + 5) }) });
    else if (a === 'sell') set({ answered: 'sell', askOpen: false, xp: m.xp + 5, dnaPatch: Object.assign({}, st.dnaPatch || {}, { risk: Math.max(0, m.dna.risk - 10) }) });
    else if (a === 'share') { if (!m.born) return; set({ shareOpen: !st.shareOpen, mintOpen: false, saveOpen: false }); }
    else if (a === 'sound') { snd.on = !snd.on; try { localStorage.setItem('zq-sound', snd.on ? 'on' : 'off'); } catch (er) {} b.setAttribute('aria-checked', snd.on); b.classList.toggle('off', !snd.on); if (snd.on) sfx('switch'); }
    else if (a === 'closeov') { st.flow = null; st.mintOpen = false; st.shareOpen = false; st.saveOpen = false; refresh(); }
    else if (a === 'mode') { st.mode = b.getAttribute('data-m'); st.mintOpen = false; renderBack(); }
    else if (a === 'load') { var fi = $('mdFile'); if (fi) fi.click(); }
    else if (a === 'eject') { st.md = null; $('mdFile').value = ''; renderBack(); }
    else if (a === 'replay') { if (st.sim) return; startSim(); render(); }
    else if (a === 'evolve') set({ dnaPatch: Object.assign({}, st.dnaPatch || {}, m.prop.patch), xp: m.xp + 15, dismissed: true });
    else if (a === 'notnow') set({ dismissed: true });
    else if (a === 'bet') { var n = b.getAttribute('data-n'); set({ bet: st.bet === n ? null : n }); }
    else if (a === 'duel') set({ duel: b.getAttribute('data-n') });
    else if (a === 'duelcancel') set({ duel: null });
    else if (a === 'fork') startHatch(b.getAttribute('data-seed'));
    else if (a === 'skill') { var sk = b.getAttribute('data-k'), cnt = Object.keys(st.skills).filter(function (x) { return st.skills[x]; }).length; if (st.skills[sk] && cnt === 1) return; st.skills[sk] = !st.skills[sk]; render(); if (st.face === 'back') renderBack(); }
    else if (a === 'flip') flip(st.face === 'back' ? 'front' : 'back');
    else if (a === 'mint') { st.flow = null; st.mintOpen = !st.mintOpen; st.shareOpen = false; st.saveOpen = false; refresh(); }
    else if (a === 'preset') { var pz = b.getAttribute('data-p'); st.preset = pz; st.dnaPatch = Object.assign({}, st.dnaPatch || {}, TUNE_PRESETS[pz]); st.tune.lean = { ZEN: 10, DIP: 30, MOMO: 75, DEGEN: 95 }[pz]; renderBack(); }
    else if (a === 'watch') { var tk = b.getAttribute('data-t'); st.tune.watch[tk] = !st.tune.watch[tk]; renderBack(); }
    else if (a === 'conn') { var cn = b.getAttribute('data-c'); st.tune.conn[cn] = !st.tune.conn[cn]; renderBack(); }
    else if (a === 'addx') addHandle();
    else if (a === 'rmx') { st.tune.handles.splice(+b.getAttribute('data-i'), 1); renderBack(); }
    else if (a === 'simulate') {
      if (st.sim) return;
      if (st.phase !== 'born') { st.subject = prompt() || currentExample(); st.phase = 'born'; st.xp = 0; }
      startSim();
      flip('front');
    }
    if (a !== 'logout') saveMine();
  });
  $('prompt').addEventListener('input', function () { render(); });
  $('agentName').addEventListener('input', function () { render(); });
  function addHandle() {
    var inp = $('xHandle'); if (!inp) return;
    var v = '@' + inp.value.trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
    if (v.length > 1 && st.tune.handles.length < 3 && st.tune.handles.indexOf(v) < 0) { st.tune.handles.push(v); st.tune.conn.x = true; }
    renderBack(); var n = $('xHandle'); if (n) n.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.target && e.target.id === 'xHandle' && e.key === 'Enter') { e.preventDefault(); addHandle(); } });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var tk = t.getAttribute('data-tok');
    if (tk) { tokUI[tk] = tk === 'sym' ? t.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : t.value; if (tk === 'sym') { t.value = tokUI.sym; var lb = document.querySelector('[data-act=toklaunch]'); if (lb) lb.textContent = 'Launch $' + (tokUI.sym || '…') + ' · preview'; } return; }
    var cp = t.getAttribute('data-copy');
    if (cp) { var sc = t.getAttribute('data-scope'), c = sc === 'pub' ? copyCfg : (st.agentRef && st.agentRef.copyCfg); if (c) { c[cp] = +t.value; var cl = $('cs-' + cp + '-' + sc); if (cl) cl.textContent = cp === 'size' ? t.value + '%' : '−' + t.value + '%'; if (sc === 'my') saveMe(); } return; }
    if (st.readonly) return;
    var k = t.getAttribute('data-dna'), u = t.getAttribute('data-tune'), v = parseInt(t.value, 10) || 0;
    if (!k && !u) return;
    st.preset = null;
    var mn = +t.min || 0, mx = +t.max || 99, cap = $('cap-' + (k || u)); if (cap) cap.style.top = Math.round((1 - (v - mn) / (mx - mn)) * 112) + 'px';
    if (k) { var p = {}; p[k] = v; st.dnaPatch = Object.assign({}, st.dnaPatch || {}, p); var lab = $('tv-' + k); if (lab) lab.textContent = v; }
    if (u === 'limit') { st.tune.limit = v; st.tune.limitSet = true; var tl = $('tv-limit'); if (tl) tl.textContent = '−' + v + '%'; }
    if (u === 'style') st.dnaPatch = Object.assign({}, st.dnaPatch || {}, { style: v > 50 ? 'momentum' : 'dip' });
    var pr = $('tv-preset'); if (pr) pr.textContent = 'PRESET: CUSTOM';
    document.querySelectorAll('#device [data-act=preset].on').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    var rp = $('rulesPreview'); if (rp) rp.textContent = rulesText(model().dna, st.tune.limit);
    saveMine();
  });

  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || t.id !== 'mdFile' || !t.files || !t.files[0]) return;
    var f = t.files[0];
    if (f.size > 256 * 1024) { st.md = { name: f.name, size: f.size, lines: 0, title: 'too big, keep it under 256 KB' }; renderBack(); return; }
    var r = new FileReader();
    r.onload = function () { var txt = String(r.result || ''), h = (txt.match(/^#\s+(.+)$/m) || [])[1]; st.md = { name: f.name, size: f.size, lines: txt.split('\n').length, title: h ? h.slice(0, 40) : '', text: txt }; renderBack(); saveMine(); };
    r.readAsText(f);
  });
  $('prompt').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startHatch(prompt() || currentExample()); } });

  // ---------- chart data (swap DATA.series for the backend API once live data is ready) ----------
  var DATA = {
    source: 'sample',
    series: function (m) {
      var px = prices(0), N = px.length, step = 3.5 * 3600 * 1000, now = Date.now();
      var candles = px.map(function (p, i) {
        var hi = Math.max(p.o, p.c), lo = Math.min(p.o, p.c), w = Math.abs(p.c - p.o) * 0.7 + p.o * 0.003;
        return { t: now - (N - 1 - i) * step, o: p.o, h: hi + w * (((i * 7) % 5) + 1) / 6, l: lo - w * (((i * 3) % 5) + 1) / 6, c: p.c };
      });
      return { ticker: 'NVDA', candles: candles, equity: m.sim.eq, trades: m.trades, start: 1000, source: this.source };
    }
  };
  function chartHTML(m) {
    var s = DATA.series(m), tf = st.tf || '7D', n = s.equity.length;
    var from = tf === '1D' ? Math.max(0, n - 7) : 0;
    var C = s.candles.slice(from, n), E = s.equity.slice(from, n);
    var head = '<div class="scr-ch-head"><span>' + s.ticker + ' · EQUITY ' + tf + '</span><span class="scr-tf">' + ['1D', '7D', '30D'].map(function (x) { return x === '30D' ? '<button type="button" disabled title="Needs live data">30D</button>' : '<button type="button" class="' + (x === tf ? 'on' : '') + '" data-act="tf" data-v="' + x + '">' + x + '</button>'; }).join('') + '<span class="scr-src">' + (s.source === 'live' ? '● LIVE' : 'SAMPLE') + '</span></span></div>';
    if (C.length < 2) return '<div class="scr-chart">' + head + '<div class="scr-ch-body"><span class="scr-legend" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">waiting for prices…</span></div></div>';
    var W = 300, H = 100, cw = W / C.length;
    var plo = Infinity, phi = -Infinity; C.forEach(function (c) { plo = Math.min(plo, c.l); phi = Math.max(phi, c.h); });
    var py = function (v) { return 6 + (phi - v) / Math.max(1e-9, phi - plo) * (H - 12); };
    var e0 = E[0], R = E.map(function (v) { return (v / e0 - 1) * 100; });
    var elo = Math.min.apply(null, R.concat([0])), ehi = Math.max.apply(null, R.concat([0])), pad = Math.max(0.3, (ehi - elo) * 0.15); elo -= pad; ehi += pad;
    var ey = function (r) { return 6 + (ehi - r) / (ehi - elo) * (H - 12); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">';
    [0.25, 0.5, 0.75].forEach(function (g) { svg += '<line x1="0" x2="' + W + '" y1="' + (H * g) + '" y2="' + (H * g) + '" stroke="#1d2810" stroke-width="1" vector-effect="non-scaling-stroke"/>'; });
    C.forEach(function (c, i) {
      var x = (i + 0.5) * cw, up = c.c >= c.o, col = up ? '#3f5c14' : '#5c2a1e';
      svg += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + py(c.h).toFixed(1) + '" y2="' + py(c.l).toFixed(1) + '" stroke="' + col + '" stroke-width="1" vector-effect="non-scaling-stroke"/>';
      var y1 = py(Math.max(c.o, c.c)), y2 = py(Math.min(c.o, c.c));
      svg += '<rect x="' + (x - cw * 0.3).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + (cw * 0.6).toFixed(1) + '" height="' + Math.max(0.8, y2 - y1).toFixed(1) + '" fill="' + col + '"/>';
    });
    svg += '<line x1="0" x2="' + W + '" y1="' + ey(0).toFixed(1) + '" y2="' + ey(0).toFixed(1) + '" stroke="#4d5f1c" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>';
    svg += '<polyline points="' + R.map(function (r, i) { return ((i + 0.5) * cw).toFixed(1) + ',' + ey(r).toFixed(1); }).join(' ') + '" fill="none" stroke="#c6f432" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
    var mk = '';
    s.trades.forEach(function (t) { var k = t.i - from; if (k < 0 || k >= E.length) return; mk += '<span class="scr-mk ' + (t.act === 'BUY' ? 'b' : 's') + '" style="left:' + ((k + 0.5) * cw / W * 100).toFixed(1) + '%;top:' + (ey(R[k]) / H * 100).toFixed(1) + '%" title="' + t.act + ' at $' + t.price.toFixed(2) + '">' + (t.act === 'BUY' ? 'B' : 'S') + '</span>'; });
    var last = R.length - 1;
    mk += '<span class="scr-dot" style="left:' + ((last + 0.5) * cw / W * 100).toFixed(1) + '%;top:' + (ey(R[last]) / H * 100).toFixed(1) + '%"></span>';
    var yl = '<span class="scr-yl" style="top:0">' + fmt(ehi - pad) + '</span><span class="scr-yl" style="top:' + (ey(0) / H * 100).toFixed(1) + '%">0%</span><span class="scr-yl" style="bottom:0">' + fmt(elo + pad) + '</span>';
    var xl = '';
    [0, Math.floor((C.length - 1) / 3), Math.floor(2 * (C.length - 1) / 3), C.length - 1].forEach(function (i) { var d = new Date(C[i].t); xl += '<span>' + (tf === '1D' ? ('0' + d.getHours()).slice(-2) + ':00' : d.toDateString().slice(0, 3).toUpperCase()) + '</span>'; });
    return '<div class="scr-chart">' + head + '<div class="scr-ch-body">' + svg + mk + yl + '</div><div class="scr-ch-x">' + xl + '</div><div class="scr-ch-leg"><span><i style="background:#c6f432"></i>equity</span><span><i style="background:#3f5c14"></i>' + s.ticker + ' price</span><span><b class="scr-mk b" style="position:static;transform:none">B</b> buy</span><span><b class="scr-mk s" style="position:static;transform:none">S</b> sell</span></div></div>';
  }

  // ---------- live counters + feed (sample until the backend is live) ----------
  var LIVE = { agents: 12408, live: 3112, hour: 214, feedI: 0 };
  function liveFeedItem(i) {
    var a = PUB[(i * 7) % PUB.length], b = PUB[(i * 13 + 5) % PUB.length], k = i % 6, t = (i % 9) + 2;
    var txt = [esc(a.name) + ' spawned · “' + esc(a.prompt.length > 30 ? a.prompt.slice(0, 28).replace(/[\s,]+$/, '') + '…' : a.prompt) + '”', esc(b.name) + ' copied by 0x' + (1000 + i * 37 % 9000).toString(16) + '…', esc(a.name) + ' closed NVDA ' + fmt(1 + (i % 5) * 0.7), esc(b.name) + ' went live · vault $' + (50 + i % 20 * 25), esc(a.name) + ' paged its owner: earnings tomorrow', esc(b.name) + ' entered top 10'][k];
    return '<span class="lf-t">' + t + 's ago</span> ' + txt;
  }
  function renderLive() {
    var el = $('liveStrip'); if (!el) return;
    el.innerHTML = '<div class="ls-row"><span class="ls-dot"></span><b>' + LIVE.agents.toLocaleString('en-US') + '</b> agents<span class="ls-sep">·</span><b>' + LIVE.live.toLocaleString('en-US') + '</b> live<span class="ls-sep">·</span><b>' + LIVE.hour + '</b> spawned this hour<span class="ls-tag">sample</span></div><div class="ls-feed"><span class="ls-car">›</span> <span id="lsFeed">' + liveFeedItem(LIVE.feedI) + '</span></div>';
  }
  function tickLive() {
    LIVE.feedI++; if (LIVE.feedI % 2 === 0) { LIVE.agents += 1 + (LIVE.feedI % 3); LIVE.hour += 1; } if (LIVE.feedI % 5 === 0) LIVE.live += 1;
    var f = $('lsFeed'); if (f) { f.style.opacity = 0; setTimeout(function () { renderLive(); }, 180); } else renderLive();
  }

  // ---------- device tints ----------
  var TINTS = ['Graphite', 'Lime', 'Arctic', 'Ocean', 'Walnut', 'Bubblegum', 'Sunset', 'Smoke'];
  function tintOf(a) { return a ? (a.tint !== undefined ? a.tint : a.id % 8) : 0; }
  function ghostDevice(t, a, idx) {
    var g = ''; for (var i = 0; i < 12; i++) g += '<span></span>';
    var meters = meter('WIN RATE', 58 + idx * 9, (58 + idx * 9) + '%', '') + meter('RISK USED', 18 + idx * 11, (18 + idx * 11) + '%', '', true) + meter('SYNC', 70 + idx * 8, (70 + idx * 8) + '%', '');
    var pts = a.all.slice(-40).map(function (v, i, arr) { var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr); return (i * 300 / 39).toFixed(1) + ',' + (6 + (hi - v) / Math.max(1e-9, hi - lo) * 60).toFixed(1); }).join(' ');
    return '<div class="dv t' + t + '"><svg class="dv-noise" aria-hidden="true"><filter id="gn' + idx + '"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#gn' + idx + ')" opacity="0.6"/></svg><span class="dv-hl"></span>' +
      '<div class="dv-top"><div style="display:flex;align-items:baseline;gap:8px"><span class="dv-emboss">ZEROIQ</span><span class="dv-eng">AGENT-0' + (idx + 2) + '</span></div><div style="display:flex;align-items:center;gap:10px"><span class="dv-eng">S0 · LIVE</span><span class="dv-led"></span><span class="dv-grille">' + g + '</span></div></div>' +
      '<div class="dv-face"><div class="dv-bezel"><div class="dv-screen"><div class="scr-top"><span>AGENT #' + a.id + '</span><span>' + Object.keys(a.watch).filter(function (k) { return a.watch[k]; })[0] + ' · 24/7</span></div>' +
      '<div style="display:flex;gap:14px;align-items:center"><img alt="" src="' + robot(a.prompt, { preset: a.preset, stage: 3, mood: 'happy' }) + '" style="width:104px;height:104px;flex:0 0 auto"><div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 auto"><span class="doto scr-name">' + esc(a.name) + '</span>' + meters + '</div></div>' +
      '<svg viewBox="0 0 300 72" preserveAspectRatio="none" style="width:100%;flex:1 1 auto;display:block"><polyline points="' + pts + '" fill="none" stroke="#c6f432" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><p class="scr-diary">› “' + esc(a.prompt.slice(0, 34)) + '”</p></div></div>' +
      '<div class="dv-read"><div class="dv-kc"><div class="dv-lcd dv-ro"><span class="doto" style="color:#c6f432">' + fmt(a.avg) + '</span></div><span class="dv-eng">AVG / WK</span></div><div class="dv-kc"><div class="dv-lcd dv-ro"><span class="doto" style="color:#d9ff5c">' + a.copiers + '</span></div><span class="dv-eng">COPIERS</span></div><div class="dv-kc"><div class="dv-lcd dv-ro"><span class="doto" style="color:#d9ff5c">' + a.score.toFixed(0) + '</span></div><span class="dv-eng">SCORE</span></div></div>' +
      '<div class="dv-keys"><div class="dv-kc"><div class="dv-ks"><span class="dv-key dv-round"></span></div><span class="dv-eng">TUNE</span></div><div class="dv-kc"><div class="dv-ks"><span class="dv-key dv-round"></span></div><span class="dv-eng">REPLAY</span></div><div class="dv-kc"><div class="dv-ks"><span class="dv-key dv-round"></span></div><span class="dv-eng">SHARE</span></div><div class="dv-kc"><div class="dv-ks"><span class="dv-key lime dv-mint">COPY</span></div><span class="dv-eng">COPY THIS AGENT</span></div></div></div>' +
      '<div class="dv-foot"><span class="dv-screw"></span><span class="dv-eng">' + TINTS[t].toUpperCase() + ' EDITION</span><span class="dv-screw"></span></div></div>';
  }
  function miniCard(a, t) {
    var pts = a.all.map(function (v, i, arr) { var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr); return (i * 240 / (arr.length - 1)).toFixed(1) + ',' + (4 + (hi - v) / Math.max(1e-9, hi - lo) * 40).toFixed(1); }).join(' ');
    return '<article class="dvm t' + t + '"><div class="dvm-top"><span class="dv-emboss" style="font-size:14px">ZEROIQ</span><span class="dv-eng">8004 #' + a.id + '</span></div><div class="dvm-scr"><div style="display:flex;gap:10px;align-items:center"><img alt="" src="' + robot(a.prompt, { preset: a.preset, stage: 3, mood: a.avg >= 0 ? 'happy' : 'sad' }) + '" style="width:56px;height:56px;flex:0 0 auto"><div style="display:flex;flex-direction:column;gap:3px;min-width:0"><span class="doto" style="font-size:17px;color:#d9ff5c;line-height:1.05">' + esc(a.name) + '</span><span style="font-size:10px;color:#9fbf3a">' + fmt(a.avg) + ' / WK · ' + a.copiers + ' COPIERS</span></div></div><svg aria-hidden="true" viewBox="0 0 240 48" preserveAspectRatio="none" style="width:100%;height:44px;display:block"><polyline points="' + pts + '" fill="none" stroke="#c6f432" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><span style="font-size:11px;line-height:1.4;color:#9fbf3a">› “' + esc(a.promptPublic ? a.prompt : 'prompt is private') + '”</span></div><div class="dvm-keys"><a class="dv-key lime" href="#/agent/' + a.id + '">COPY</a></div></article>';
  }

  // ---------- pager: onboarding questions + ideas from what the agent notices ----------
  function pagerQueue(m) {
    if (!m.born || st.readonly) return [];
    var d = m.dna, t = st.tune, done = st.propDone || {}, q = [];
    var w = Object.keys(t.watch).filter(function (k) { return t.watch[k]; });
    if (!t.limitSet) q.push({ id: 'limit', tag: 'SETUP', text: 'You never set a daily loss limit. I stop trading at −' + t.limit + '% in a day. Keep it?', yes: { limitSet: true }, no: 'eq' });
    if (t.lean === undefined) q.push({ id: 'lean', tag: 'SETUP', text: 'From your words I trade like a ' + (d.style === 'momentum' ? 'momentum chaser' : 'dip buyer') + '. Did I read you right?', yes: { lean: d.style === 'momentum' ? 72 : 28 }, no: 'eq' });
    if (w.length < 3) q.push({ id: 'watch', tag: 'SETUP', text: 'I only watch ' + (w.join(' ') || 'nothing') + '. Add SPY and AMD so I find more setups?', yes: { watch: { SPY: true, AMD: true } }, no: 'markets' });
    q.push({ id: 'earnings', tag: 'EVENT', text: 'NVDA reports earnings tomorrow after the close. 6–8% moves are normal. Trade the move with half my usual size?', yes: { dna: { freq: Math.min(99, d.freq + 15) } } });
    if (!st.skills.memes) q.push({ id: 'memes', tag: 'EVENT', text: '$HOODIE passed a $1M market cap on Robinhood Chain in 3 hours. Want me to start trading memes, max 2% per trade?', yes: { skills: { memes: true } } });
    else if (d.risk > 70) q.push({ id: 'memecap', tag: 'RISK', text: 'Memes are on and my risk is high. Cap each meme trade at 2% of the vault?', yes: { dna: { risk: 60 } } });
    if (!st.skills.earn) q.push({ id: 'earn', tag: 'IDEA', text: 'Most of my cash sits idle between trades. Park it in Morpho Earn (about 7% a year) until I need it?', yes: { skills: { earn: true } } });
    if (m.done && m.trades.length) q.push({ id: 'tune', tag: 'REVIEW', text: m.prop.text, yes: { dna: m.prop.patch } });
    return q.filter(function (p) { return !done[p.id]; });
  }
  function pagerOv(q) {
    var p = q[0];
    return '<div class="scr-ov pager" role="dialog" aria-label="Message from your agent"><div class="pg-h"><span>✉ PAGER · ' + p.tag + '</span><span>' + (st.pagerSeen || 1) + ' NEW · ' + q.length + '</span></div><span class="scr-ov-t">' + esc(p.text) + '</span><div class="pg-btns"><button type="button" class="pg-b yes" data-act="pyes" data-id="' + p.id + '" aria-label="Yes">+</button><button type="button" class="pg-b no" data-act="pno" data-id="' + p.id + '" aria-label="No">−</button></div></div>';
  }
  function applyPager(id, yes) {
    var q = pagerQueue(model()), p = null; q.forEach(function (x) { if (x.id === id) p = x; });
    st.propDone = Object.assign({}, st.propDone || {}); st.propDone[id] = yes ? 'yes' : 'no';
    if (!p) return;
    if (yes) {
      var y = p.yes;
      if (y.limitSet) st.tune.limitSet = true;
      if (y.lean !== undefined) { st.tune.lean = y.lean; st.dnaPatch = Object.assign({}, st.dnaPatch || {}, { style: y.lean >= 50 ? 'momentum' : 'dip' }); }
      if (y.watch) Object.keys(y.watch).forEach(function (k) { st.tune.watch[k] = y.watch[k]; });
      if (y.skills) Object.keys(y.skills).forEach(function (k) { st.skills[k] = y.skills[k]; });
      if (y.dna) st.dnaPatch = Object.assign({}, st.dnaPatch || {}, y.dna);
      st.xp = (st.xp || 0) + 5; sfx('mint');
    } else if (p.no === 'eq' || p.no === 'markets') {
      st.mode = p.no === 'eq' ? 'EQ' : 'MARKETS'; if (st.face !== 'back') flip('back'); else renderBack();
    }
  }

  // ---------- accounts, my agents, public agents (preview, stored in this browser) ----------
  var ME = { user: null, agents: [], tg: null, pendingCopy: null };
  try { var saved = JSON.parse(localStorage.getItem('zq-me') || 'null'); if (saved) ME = Object.assign(ME, saved); } catch (e) {}
  (function () { var MP = { TSLA: 'SPCX', AAPL: 'SPY', AMZN: 'AMD', PLTR: 'GOOGL', COIN: 'META' }; (ME.agents || []).forEach(function (a) { if (a.mode === 'demo') a.mode = 'live'; if (a.watch) { var w = {}; Object.keys(a.watch).forEach(function (k) { w[MP[k] || k] = a.watch[k]; }); a.watch = w; } }); if (!ME.follow) ME.follow = []; })();
  function saveMe() { try { localStorage.setItem('zq-me', JSON.stringify(ME)); } catch (e) {} }
  function fakeAddr(seed) { var h = hash(seed + 'zq'), s = '0x'; for (var i = 0; i < 40; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; s += '0123456789abcdef'[(h >>> 27) & 15]; } return s; }
  function shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }
  function agentStats(dna) {
    var wk = [0, 1, 2, 3].map(function (si) { return equity(prices(si), dna, 48); });
    var avg = wk.reduce(function (s, w) { return s + w.ret; }, 0) / 4, dd = Math.max.apply(null, wk.map(function (w) { return w.dd; })) * 100;
    var all = [], base = 1; wk.forEach(function (w) { w.eq.forEach(function (v) { all.push(base * v); }); base *= w.eq[w.eq.length - 1]; });
    return { avg: avg, dd: dd, score: Math.max(0, Math.min(100, 50 + 10 * (avg - dd))), all: all };
  }
  var WATCH0 = ['NVDA', 'SPCX', 'SPY', 'AMD', 'GOOGL', 'META'];
  function mkWatch(list) { var w = {}; WATCH0.forEach(function (t) { w[t] = list.indexOf(t) >= 0; }); return w; }
  function mkSkills(list) { var s = {}; list.forEach(function (k) { s[k] = true; }); return s; }
  var PUB = [
    ['Zen Goblin', 'buy the dip, patient, calm, careful', 0, [], ['spot', 'orders'], ['NVDA', 'SPY', 'GOOGL'], 8, 212],
    ['Calm Hamster', 'momentum, patient, careful', 2, ['fomo'], ['spot', 'earn'], ['NVDA', 'AMD'], 6, 97],
    ['Hype Oracle', 'chase green candles, hype, trade often', 1, [], ['spot', 'memes'], ['SPCX', 'META'], 15, 54],
    ['Lucky Robot', 'momentum, careful, few trades', 7, ['risk', 'freq'], ['spot'], ['SPY', 'AMD', 'NVDA'], 8, 131],
    ['Feral Gremlin', 'yolo, scalp often, chase', 6, ['patience', 'fomo', 'risk', 'freq', 'lean'], ['spot', 'perps', 'memes'], ['SPCX', 'GOOGL', 'META'], 20, 18],
    ['Quiet Oracle', 'patient long-term, add to winners, careful', 3, [], ['spot', 'dividends'], ['SPY', 'AMD'], 5, 176],
    ['Shy Intern', 'trade rarely, careful sizing, only SPCX and SPY', 4, ['lean'], ['spot', 'orders'], ['SPCX', 'SPY'], 6, 41],
    ['Degen Hamster', 'make me rich, make no mistakes', 5, ['patience', 'risk'], ['spot', 'memes', 'perps'], ['NVDA', 'SPCX', 'META'], 18, 263],
    ['Sleepy Robot', 'buy the dip on NVDA, stay calm', 2, [], ['spot', 'earn'], ['NVDA'], 7, 64],
    ['Tiny Gremlin', 'momentum only, never hold over the weekend', 1, ['freq'], ['spot', 'orders'], ['GOOGL', 'META', 'SPCX'], 12, 23],
    ['Mira Basket', 'AI basket, rebalance weekly', 6, ['patience', 'fomo', 'risk', 'freq', 'lean', 'limit'], ['spot', 'basket'], ['NVDA', 'GOOGL'], 10, 88],
    ['Hype Intern', 'sell before earnings, rebuy after the drop, quick', 0, ['risk'], ['spot', 'orders', 'perps'], ['NVDA', 'AMD', 'SPY'], 9, 12]
  ].map(function (a, i) {
    var p = parse(a[1]).dna, st0 = agentStats(p);
    return { id: 4108 + i * 37, name: a[0], prompt: a[1], preset: a[2], hidden: mkSkills(a[3]), promptPublic: a[3].length < 5, skills: mkSkills(a[4]), watch: mkWatch(a[5]), limit: a[6], copiers: a[7],
      dna: Object.assign({}, p), lean: p.style === 'momentum' ? 72 : 28, conn: {}, handles: [], owner: fakeAddr(a[0]), xp: Math.min(110, 30 + Math.round(a[7] / 3)), tint: (i * 3 + 1) % 8, mode: 'live', avg: st0.avg, dd: st0.dd, score: st0.score, all: st0.all, pub: true };
  });
  (function () {
    var seed = 9173, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var A1 = ['Tiny', 'Lucky', 'Quiet', 'Sleepy', 'Feral', 'Shy', 'Zen', 'Hype', 'Degen', 'Calm', 'Turbo', 'Grumpy', 'Sneaky', 'Brave', 'Lazy', 'Neon', 'Rusty', 'Cosmic'];
    var A2 = ['Goblin', 'Oracle', 'Intern', 'Hamster', 'Gremlin', 'Robot', 'Badger', 'Monk', 'Raccoon', 'Wizard', 'Penguin', 'Ape', 'Owl', 'Golem', 'Ferret', 'Pilot'];
    var PR = EXAMPLES.concat(['buy NVDA on red days, hold a week', 'scalp SPCX, tiny size', 'only trade after earnings', 'AI basket, rebalance weekly', 'follow the top 3 agents, half size', 'trade memes on weekends only', 'never more than 2 trades a day', 'buy breakouts on volume']);
    var SK = ['orders', 'earn', 'perps', 'basket', 'memes', 'dividends'], HK = ['patience', 'fomo', 'risk', 'freq', 'lean', 'limit'], used = {};
    PUB.forEach(function (a) { used[a.name] = 1; });
    for (var i = PUB.length; i < 100; i++) {
      var nm; do { nm = A1[Math.floor(rnd() * A1.length)] + ' ' + A2[Math.floor(rnd() * A2.length)]; } while (used[nm]); used[nm] = 1;
      var pr = PR[Math.floor(rnd() * PR.length)], p = parse(pr).dna, j = function (v) { return Math.max(0, Math.min(99, Math.round(v + (rnd() - 0.5) * 40))); };
      var dna = { patience: j(p.patience), fomo: j(p.fomo), risk: j(p.risk), freq: j(p.freq), style: rnd() < 0.5 ? 'dip' : 'momentum' }, st0 = agentStats(dna);
      var hid = {}; HK.forEach(function (k) { if (rnd() < 0.18) hid[k] = true; });
      var sk = { spot: true }; SK.forEach(function (k) { if (rnd() < 0.25) sk[k] = true; });
      var w = mkWatch(WATCH0.filter(function () { return rnd() < 0.45; }).concat(['NVDA']));
      var cop = Math.floor(Math.pow(rnd(), 3) * 300);
      PUB.push({ id: 4108 + i * 37, name: nm, prompt: pr, preset: Math.floor(rnd() * 8), hidden: hid, promptPublic: rnd() < 0.7, skills: sk, watch: w, limit: 5 + Math.floor(rnd() * 15), copiers: cop,
        dna: dna, lean: dna.style === 'momentum' ? 72 : 28, conn: {}, handles: [], owner: fakeAddr(nm), xp: Math.min(110, Math.floor(rnd() * 90)), tint: Math.floor(rnd() * 8), mode: 'live', avg: st0.avg, dd: st0.dd, score: st0.score, all: st0.all, pub: true, isNew: rnd() < 0.12 });
    }
  })();
  var REAL = null, REALA = [];
  function findAgent(id) { id = +id; var a = null; ME.agents.forEach(function (x) { if (x.id === id) a = x; }); PUB.forEach(function (x) { if (x.id === id) a = x; }); REALA.forEach(function (x) { if (x.id === id) a = x; }); return a; }
  function loadReal() {
    try {
      fetch('data/explorer.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.wallets || !d.wallets.length) return;
        REAL = d;
        REALA = d.wallets.map(function (x, i) { var h = hash(x.w), src = PUB[h % PUB.length], w = {}; x.stocks.forEach(function (t) { w[t] = true; });
          return { id: 900001 + i, pub: true, real: x, name: 'Wallet ' + shortAddr(x.w), owner: x.w, prompt: x.w + ' ' + src.prompt, preset: src.preset, tint: src.tint, score: Math.max(1, Math.min(99, 50 + Math.max(-30, Math.min(30, x.r30)) + x.vs * 0.5)), dd: null, avg: x.r30 / 4.3, watch: w, copiers: 0 }; });
        exType = 'trader'; exSort = 'r30'; exVer = true;
        if (page === 'home') renderBoard(); else if (page === 'agent' || page === 'follow') route();
      }).catch(function () {});
    } catch (e) {}
  }
  function isMine(a) { return a && !a.pub; }

  // load any agent into the one device on the page
  function loadAgent(a, ctx) {
    st.ctx = ctx; st.readonly = ctx === 'public'; st.agentRef = a; st.sim = false; st.hot = Object.assign({}, a.hot || {}); st.tint = tintOf(a); st.propDone = Object.assign({}, a.propDone || {}); st.pagerOff = false;
    st.subject = a.prompt; st.phase = 'born'; st.btick = 0; st.rtick = undefined; st.tick = 999;
    st.nameOverride = a.name; st.presetOverride = a.preset;
    st.dnaPatch = Object.assign({}, a.dna); st.skills = Object.assign({}, a.skills);
    st.tune = { limit: a.limit, watch: Object.assign({}, a.watch), conn: Object.assign({}, a.conn || {}), handles: (a.handles || []).slice(), lean: a.lean, limitSet: !!a.limitSet };
    st.hidden = st.readonly ? (a.hidden || {}) : {}; st.md = a.md || null; st.preset = null; st.xp = a.xp || 0;
    st.face = 'front'; st.mode = 'EQ'; st.mintOpen = st.shareOpen = st.saveOpen = false; st.flow = null; st.dismissed = true; st.answered = st.readonly ? 'hold' : (a.answered || null);
    if ($('dvFace')) buildFace(); render();
  }
  function saveMine() {
    if (st.ctx !== 'mine' || !st.agentRef) return;
    var a = st.agentRef, m = model();
    a.dna = Object.assign({}, m.dna); a.lean = st.tune.lean; a.limit = st.tune.limit; a.watch = Object.assign({}, st.tune.watch); a.skills = Object.assign({}, st.skills);
    a.conn = Object.assign({}, st.tune.conn); a.handles = st.tune.handles.slice(); a.md = st.md ? { name: st.md.name, size: st.md.size, lines: st.md.lines, title: st.md.title } : null; a.xp = st.xp || 0; a.answered = st.answered || null; a.propDone = Object.assign({}, st.propDone || {}); a.hot = Object.assign({}, st.hot || {}); a.limitSet = !!st.tune.limitSet;
    var s0 = agentStats(a.dna); a.avg = s0.avg; a.dd = s0.dd; a.score = s0.score; a.all = s0.all;
    saveMe();
  }
  function newAgentFrom(src, extra) {
    var id = 5001; ME.agents.forEach(function (x) { id = Math.max(id, x.id + 1); });
    var a = Object.assign({ id: id, tint: ME.agents.length % 8, created: Date.now(), mode: 'live', vault: 0, copiers: 0, notify: { trades: true, question: true, weekly: true }, owner: ME.user ? ME.user.address : '' }, src, extra || {});
    var s0 = agentStats(a.dna); a.avg = s0.avg; a.dd = s0.dd; a.score = s0.score; a.all = s0.all; delete a.pub; delete a.hidden;
    ME.agents.push(a); saveMe(); return a;
  }
  function mintCurrent() {
    var m = model();
    var a = newAgentFrom({ name: m.name, prompt: st.subject || m.subject, preset: m.preset, dna: Object.assign({}, m.dna), lean: st.tune.lean, limit: st.tune.limit, watch: Object.assign({}, st.tune.watch), skills: Object.assign({}, st.skills), conn: Object.assign({}, st.tune.conn), handles: st.tune.handles.slice(), md: st.md ? { name: st.md.name, size: st.md.size, lines: st.md.lines, title: st.md.title } : null, propDone: Object.assign({}, st.propDone || {}), hot: Object.assign({}, st.hot || {}), limitSet: !!st.tune.limitSet });
    st.mintOpen = false; st.flow = null; homeState = null;
    location.hash = '#/me/' + a.id;
  }
  function doLogin(method) {
    ME.user = { method: method, address: fakeAddr(method + Date.now()), since: Date.now() };
    if (!ME.tg) ME.tg = { code: 'ZQ' + Math.random().toString(36).slice(2, 6).toUpperCase(), linked: false };
    saveMe();
  }
  function doCopy(src, cfg) {
    var dna = Object.assign({}, src.dna), hid = src.hidden || {};
    ['patience', 'fomo', 'risk', 'freq'].forEach(function (k) { if (hid[k]) dna[k] = 50; });
    var a = newAgentFrom({ name: src.name.replace(/ (copy|II)$/, '') + ' II', prompt: src.promptPublic ? src.prompt : 'copy of #' + src.id, preset: (src.preset + 3) % 8, dna: dna, lean: hid.lean ? 50 : src.lean,
      limit: cfg.maxLoss, watch: Object.assign({}, src.watch), skills: Object.assign({}, src.skills), conn: {}, handles: [] }, { copyOf: src.id, copyCfg: cfg });
    ME.pendingCopy = null; saveMe();
    location.hash = '#/me/' + a.id;
  }

  // ---------- router ----------
  var page = 'home', homeState = null, curId = null;
  var copyCfg = { what: 'all', size: 50, maxLoss: 10 };
  function moveDevice(slotId) { var w = $('devWrap'), s = $(slotId); if (w && s && w.parentNode !== s) s.appendChild(w); }
  function show(p) {
    var M = { home: 'pgHome', me: 'pgMe', create: 'pgCreate', follow: 'pgFollow', agent: 'pgAgent' };
    ['pgHome', 'pgMe', 'pgCreate', 'pgFollow', 'pgAgent'].forEach(function (id) { var el = $(id); if (el) el.hidden = id !== M[p]; });
    var sticky = document.querySelector('.sticky'); if (sticky) sticky.style.display = p === 'home' ? '' : 'none';
  }
  function route() {
    var h = location.hash || '';
    if (/^#\/leaderboard/.test(h)) { location.replace('#/'); return; }
    var mm = h.match(/^#\/(me|agent)(?:\/(\d+|create|following))?/);
    var next = !mm ? 'home' : (mm[1] === 'agent' ? 'agent' : (mm[2] === 'create' ? 'create' : (mm[2] === 'following' ? 'follow' : 'me')));
    if (page === 'create' && next !== 'create') { homeState = JSON.parse(JSON.stringify(st)); delete homeState.agentRef; }
    if (next === 'create') {
      moveDevice('heroDevCol');
      if (page !== 'create') { if (homeState) { Object.keys(st).forEach(function (k) { delete st[k]; }); Object.assign(st, homeState); } st.ctx = 'home'; st.readonly = false; st.hidden = {}; st.tint = 0; st.agentRef = null; st.nameOverride = null; st.presetOverride = undefined; st.face = 'front'; buildFace(); render(); }
    } else if (next === 'home') {
      renderBoard();
    } else if (next === 'agent') {
      var a = findAgent(mm[2]);
      if (a && isMine(a)) { location.replace('#/me/' + a.id); return; }
      curId = a ? a.id : null; moveDevice('agDevSlot'); if (a) loadAgent(a, 'public'); renderAgentPage(a);
    } else if (next === 'follow') {
      renderFollow();
    } else if (next === 'me') {
      var mine = mm[2] ? findAgent(mm[2]) : ME.agents[ME.agents.length - 1];
      if (mine && !isMine(mine)) mine = null;
      curId = mine ? mine.id : null; moveDevice('meDevSlot'); if (ME.user && mine) loadAgent(mine, 'mine');
      renderMe();
    }
    if (!/^#[a-z]/.test(h)) try { window.scrollTo(0, 0); } catch (e) {}
    page = next; show(next); renderHeader(); renderTabs(); setTimeout(drawCables, 30);
  }
  window.addEventListener('hashchange', route);
  function renderTabs() {
    var nf = (ME.follow || []).length, na = ME.agents.length;
    var T = [['follow', '#/me/following', 'Following' + (nf ? ' · ' + nf : '')], ['me', '#/me', 'My agents' + (na ? ' · ' + na : '')], ['create', '#/me/create', 'Create agent']];
    var h = '<nav class="dtabs" aria-label="Dashboard">' + T.map(function (t) { return '<a href="' + t[1] + '"' + (page === t[0] ? ' aria-current="page"' : '') + '>' + t[2] + '</a>'; }).join('') + '</nav>';
    ['tabsMe', 'tabsCreate', 'tabsFollow'].forEach(function (id) { setHTML(id, h); });
  }
  // ---------- explorer metrics (sample until the live index opens) ----------
  function exm(a) {
    if (a.real) { var x = a.real; return { type: x.type, bot: 'High frequency', label: a.name, r30: x.r30, bh: x.hold, vs: x.vs, trades: x.trades, cap: x.capital, age: x.days, verified: x.days >= 7, stocks: x.stocks.length ? x.stocks : ['NVDA'], followers: isFollowing(a.id) ? 1 : 0, real: true }; }
    var h = hash(a.name + a.id), mine = isMine(a);
    var r30 = (a.all && a.all.length ? (a.all[a.all.length - 1] - 1) * 100 : a.avg * 4.3) * 0.35;
    var vs = ((h % 170) - 95) / 10 + r30 * 0.2, bh = r30 - vs;
    var age = mine ? Math.floor((Date.now() - (a.created || Date.now())) / 864e5) : 5 + (h >>> 4) % 160;
    var w = Object.keys(a.watch || {}).filter(function (k) { return a.watch[k]; });
    var tk = h % 20, type = (mine || REAL) ? 'agent' : (tk < 13 ? 'agent' : (tk < 18 ? 'trader' : 'bot'));
    return { type: type, bot: tk === 18 ? 'Market maker' : 'Arbitrage', label: type === 'agent' ? a.name : (type === 'trader' ? 'Wallet ' : 'Bot ') + shortAddr(a.owner), r30: r30, bh: bh, vs: vs, trades: mine ? (model().trades.length) : 8 + (h >>> 7) % 140, cap: mine ? (a.vault || 0) : 200 + ((h >>> 9) % 480) * 100, age: age, verified: age >= 7, stocks: w.length ? w : ['NVDA'], followers: a.copiers || 0 };
  }
  function typeBadge(k) { var T = { agent: ['AGENT · 8004', '#111', '#c6f432'], trader: ['TRADER', '#fff', '#111'], bot: ['BOT · ' + k.bot.toUpperCase(), '#f1f1ee', '#4a4a4a'] }[k.type]; return '<span class="mono" style="font-size:9px;font-weight:700;letter-spacing:.06em;padding:2px 6px;border-radius:5px;border:1px solid #d4d4d0;background:' + T[1] + ';color:' + T[2] + '">' + T[0] + '</span>'; }
  function isFollowing(id) { return (ME.follow || []).indexOf(+id) >= 0; }
  function toggleFollow(id) { ME.follow = ME.follow || []; id = +id; var i = ME.follow.indexOf(id); if (i >= 0) ME.follow.splice(i, 1); else ME.follow.push(id); saveMe(); }
  function followBtn(a, big) { var on = isFollowing(a.id); return '<button type="button" class="btn ' + (big ? '' : 'sm ') + (on ? '' : 'dark') + '" data-act="follow" data-id="' + a.id + '" aria-pressed="' + on + '">' + (on ? '✓ Following' : 'Follow') + '</button>'; }
  function tgLinkHTML() {
    var tg = ME.tg || {};
    if (!ME.user) return '<span style="font-size:15px;line-height:1.5">Log in to get pages in Telegram from the agents you follow.</span><div><a class="btn sm dark" href="#/me">Log in</a></div>';
    if (tg.linked) return '<span style="font-size:15px;line-height:1.5">Linked. Agents you follow page you on every trade.</span>';
    return '<ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#2f2f2f"><li>Open the ZeroIQ bot in Telegram.</li><li>Send <span class="mono" style="background:#f1f1ee;padding:2px 6px;border-radius:4px">/start ' + (tg.code || '') + '</span></li><li>Every agent you follow pages you on each trade.</li></ol><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="copycode">Copy the command</button><button type="button" class="btn sm" disabled style="opacity:.5;cursor:not-allowed" title="The bot opens with Season 0">Open bot · Season 0</button><button type="button" class="btn sm" data-act="tglink">Preview: mark as linked</button></div>';
  }
  function renderFollow() {
    var L = (ME.follow || []).map(findAgent).filter(Boolean), p = '';
    p += '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Following</span><h2 style="margin:0">Agents you follow</h2></div>';
    if (!L.length) p += '<div class="card" style="max-width:560px;gap:12px"><strong style="font-size:20px">Not following anyone yet</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">Open the explorer, find an agent that beats holding its stocks and press Follow. It is free and moves no money.</span><div><a class="btn lime" href="#/">Open the explorer</a></div></div>';
    else p += '<div class="card" style="gap:0;padding:8px 16px">' + L.map(function (a) { var k = exm(a), m = model(); return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #f1f1ee"><img alt="" src="' + robot(a.prompt, { preset: a.preset, stage: 3, mood: k.r30 >= 0 ? 'happy' : 'sad' }) + '" style="width:40px;height:40px;background:#0f0f0f;border-radius:8px"><span style="display:flex;flex-direction:column;flex:1 1 200px;min-width:0"><a href="#/agent/' + a.id + '" style="font-weight:700;font-size:16px;color:#111;text-decoration:none">' + esc(k.label) + '</a><span class="mono" style="font-size:12px;color:#4a4a4a">' + k.stocks.slice(0, 3).join(' · ') + ' · last trade ' + ((a.id % 9) + 1) + 'h ago</span></span><span class="mono" style="font-size:14px;color:' + (k.r30 >= 0 ? UP : DOWN) + '">' + fmt(k.r30) + ' 30d</span><span class="mono" style="font-size:14px;color:' + (k.vs >= 0 ? UP : DOWN) + '">' + (k.vs >= 0 ? '+' : '') + k.vs.toFixed(1) + '% vs hold</span>' + followBtn(a) + '</div>'; }).join('') + '</div>';
    p += '<div class="card" style="gap:12px;max-width:640px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Telegram pages</span>' + badge((ME.tg || {}).linked ? 'LINKED' : 'NOT LINKED', (ME.tg || {}).linked) + '</div>' + tgLinkHTML() + '</div>';
    setHTML('followBody', p);
  }
  function renderHeader() {
    var b = $('hdrAcct'); if (!b) return;
    b.textContent = ME.user ? 'My agents' + (ME.agents.length ? ' · ' + ME.agents.length : '') : 'Log in';
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.style.color = a.getAttribute('data-nav') === page ? '#111' : '#4a4a4a'; a.style.fontWeight = a.getAttribute('data-nav') === page ? '700' : '500'; });
  }
  function badge(t, on) { return '<span class="mono" style="font-size:10px;font-weight:700;letter-spacing:.06em;padding:3px 7px;border-radius:5px;' + (on ? 'background:#111;color:#c6f432' : 'background:#f1f1ee;color:#4a4a4a') + '">' + t + '</span>'; }
  function tradesTable(trades) {
    if (!trades.length) return '<span style="font-size:14px;color:#6b6b6b">No trades yet. It is waiting for its setup.</span>';
    var N = prices(0).length, now = Date.now(), buy = null, rows = [];
    trades.forEach(function (t) {
      var d = new Date(now - (N - t.i) * 3600 * 1000), tm = d.toUTCString().slice(0, 3) + ' ' + ('0' + d.getUTCHours()).slice(-2) + ':00';
      var pnl = '';
      if (t.act === 'BUY') buy = t.price; else if (buy) { var r = (t.price / buy - 1) * 100; pnl = '<span style="color:' + (r >= 0 ? UP : DOWN) + '">' + fmt(r) + '</span>'; buy = null; }
      rows.push('<div class="mono" style="display:grid;grid-template-columns:70px 52px 60px 1fr 64px;gap:8px;padding:8px 0;border-bottom:1px solid #f1f1ee;font-size:12px"><span style="color:#6b6b6b">' + tm + '</span><span style="font-weight:700;color:' + (t.act === 'BUY' ? '#111' : '#4a4a4a') + '">' + t.act + '</span><span>NVDA</span><span>$' + t.price.toFixed(2) + ' · ' + t.qty.toFixed(2) + '</span><span style="text-align:right">' + pnl + '</span></div>');
    });
    return '<div class="mono" style="display:grid;grid-template-columns:70px 52px 60px 1fr 64px;gap:8px;padding-bottom:6px;font-size:10px;letter-spacing:.06em;color:#6b6b6b;border-bottom:1px solid #e5e5e2"><span>TIME</span><span>SIDE</span><span>TOKEN</span><span>PRICE · QTY</span><span style="text-align:right">P&amp;L</span></div>' + rows.reverse().join('');
  }
  function toggleRow(act, on, title, desc, extra) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><strong style="font-size:15px">' + title + '</strong><span style="font-size:13px;line-height:1.45;color:#6b6b6b">' + desc + '</span></span><button type="button" role="switch" aria-checked="' + !!on + '" aria-label="' + title + '" class="dv-tog' + (on ? ' on' : '') + '" data-act="' + act + '"' + (extra || '') + '><span></span></button></div>';
  }
  function loginCard(why) {
    return '<div class="card" style="max-width:520px;gap:14px"><span class="eyebrow">Log in</span><strong style="font-size:22px">' + (why || 'Log in to see your agents') + '</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">Use Google or your wallet. Signing in with a wallet is a free signature, no gas.</span><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn dark" data-act="login" data-m="google">Continue with Google</button><button type="button" class="btn" data-act="login" data-m="wallet">Connect wallet</button></div><span style="font-size:12px;line-height:1.45;color:#6b6b6b">Preview: no real account or wallet is connected. Your agents are saved in this browser.</span></div>';
  }
  function renderMe() {
    var head = '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px"><div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Dashboard</span><h2>My agents</h2></div>';
    if (ME.user) head += '<span style="display:flex;align-items:center;gap:10px;font-size:13px;color:#4a4a4a">' + badge(ME.user.method === 'google' ? 'GOOGLE' : 'WALLET') + '<span class="mono">' + shortAddr(ME.user.address) + '</span><button type="button" class="btn sm" data-act="logout">Log out</button></span>';
    head += '</div>';
    setHTML('meHead', head);
    $('meBody').hidden = !ME.user || !curId;
    if (!ME.user) { var pc = ME.pendingCopy ? findAgent(ME.pendingCopy) : null; setHTML('meLogin', loginCard(pc ? 'Log in to copy ' + esc(pc.name) : '')); return; }
    if (!ME.agents.length) { setHTML('meLogin', '<div class="card" style="max-width:520px;gap:12px"><strong style="font-size:20px">No agents yet</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">Describe one in a sentence or fork one from the explorer. You can create as many as you want.</span><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn lime" href="#/me/create">Create an agent</a><a class="btn" href="#/">Fork one from the explorer</a></div></div>'); return; }
    setHTML('meLogin', '');
    var a = findAgent(curId); if (!a) return;
    var m = model(), p = '';
    p += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' + ME.agents.map(function (x) { var on = x.id === a.id; return '<a href="#/me/' + x.id + '" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;text-decoration:none;color:#111;border:1.5px solid ' + (on ? '#111' : '#e5e5e2') + ';background:' + (on ? '#f6ffd9' : '#fff') + '"><img alt="" src="' + robot(x.prompt, { preset: x.preset, stage: 2, mood: 'happy' }) + '" style="width:28px;height:28px;background:#0f0f0f;border-radius:50%"><span style="font-size:14px;font-weight:600">' + esc(x.name) + '</span>' + badge(x.vault ? 'LIVE' : 'NEEDS FUNDING', !!x.vault) + '</a>'; }).join('') + '<a href="#/me/create" class="btn sm">+ New agent</a></div>';
    var rank = boardRows().map(function (r) { return r.id; }).indexOf(a.id) + 1;
    var kpi = function (l, v, c) { return '<div style="border:1px solid #e5e5e2;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px"><span class="mono" style="font-size:11px;color:#6b6b6b">' + l + '</span><span class="mono" style="font-weight:700;font-size:18px;color:' + (c || '#111') + '">' + v + '</span></div>'; };
    var bal = '$' + (a.vault || 0).toFixed(0), ek = exm(a);
    p += '<div class="card" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><strong style="font-size:20px">' + esc(a.name) + '</strong><span class="mono" style="font-size:12px;color:#6b6b6b">ERC-8004 #' + a.id + (a.copyOf ? ' · fork of <a href="#/agent/' + a.copyOf + '">#' + a.copyOf + '</a>' : '') + '</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">' + kpi('VAULT', bal) + kpi('BACKTEST · 7D', fmt(m.sim.ret), m.sim.ret >= 0 ? UP : DOWN) + kpi('VS HOLD · 30D', (ek.vs >= 0 ? '+' : '') + ek.vs.toFixed(1) + '%', ek.vs >= 0 ? UP : DOWN) + kpi('SCORE', a.score.toFixed(0)) + kpi('RANK', '#' + rank) + '</div>' +
      (!a.vault ? '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#f7f7f5;border-radius:10px;padding:10px 12px"><span style="font-size:14px;color:#4a4a4a">The vault is empty, so the agent is waiting. Fund it to go live.</span><button type="button" class="btn sm dark" data-act="deposit">Fund the vault</button></div>' : '') + '</div>';
    if (tokUI.for !== a.id) { tokUI = { for: a.id, open: false, sym: tokSym(a.name), name: a.name, pair: 'WETH', step: 0, deploying: false, err: '' }; }
    if (TOKENS) p += '<div class="card" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="eyebrow">Agent token</span>' + (a.token ? badge('LIVE · $' + esc(a.token.sym), true) : badge('OPTIONAL')) + '</div><div id="tokSlot" style="display:flex;flex-direction:column;gap:12px"></div></div>';
    p += '<div class="card" style="gap:14px"><span class="eyebrow">Settings</span>' +
      toggleRow('pause', a.paused, 'Pause trading', 'Stops new trades. Open positions stay as they are.') +
      '<span style="font-size:13px;color:#6b6b6b">Personality, risk, markets and signals are on the back of the device: press TUNE.</span></div>';
    if (a.copyOf) {
      var c = a.copyCfg || copyCfg;
      p += '<div class="card" style="gap:12px"><span class="eyebrow">Forked from #' + a.copyOf + '</span>' + copyControls(c, 'my') + '</div>';
    }
    if (!a.answered) p += '<div class="card" style="gap:10px"><span class="eyebrow">Today’s question</span><span style="font-size:16px">NVDA reports earnings tomorrow. Hold through it, or sell before?</span><div style="display:flex;gap:8px"><button type="button" class="btn sm" data-act="hold">Hold</button><button type="button" class="btn sm" data-act="sell">Sell before</button></div><span style="font-size:12px;color:#6b6b6b">Your answer tunes how it trades. Skipping is fine, it just learns slower.</span></div>';
    var tg = ME.tg || {};
    p += '<div class="card" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Telegram</span>' + badge(tg.linked ? 'LINKED' : 'NOT LINKED', tg.linked) + '</div>' +
      (tg.linked ? '<span style="font-size:15px;line-height:1.5">Your agents message you in Telegram. Reply to a question right in the chat.</span>' :
        '<span style="font-size:15px;line-height:1.5">Get trades, the daily question and weekly reports from all your agents in one chat.</span><ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#2f2f2f"><li>Open the ZeroIQ bot in Telegram.</li><li>Send <span class="mono" style="background:#f1f1ee;padding:2px 6px;border-radius:4px">/start ' + (tg.code || '') + '</span></li><li>The bot links this account and every agent on it.</li></ol><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="copycode">Copy the command</button><button type="button" class="btn sm" disabled style="opacity:.5;cursor:not-allowed" title="The bot opens with Season 0">Open bot · Season 0</button><button type="button" class="btn sm" data-act="tglink">Preview: mark as linked</button></div>') +
      '<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid #f1f1ee;padding-top:12px">' + toggleRow('notify', a.notify && a.notify.trades, 'Trades', 'A message for every buy and sell.', ' data-k="trades"') + toggleRow('notify', a.notify && a.notify.question, 'Daily question', 'One question a day, answer with a tap.', ' data-k="question"') + toggleRow('notify', a.notify && a.notify.weekly, 'Weekly report', 'Score, rank and the onchain record.', ' data-k="weekly"') + '</div></div>';
    p += '<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Trade history · last 7 days</span><span class="chip">sample prices</span></div>' + tradesTable(m.trades) + '</div>';
    setHTML('mePanel', p);
    renderTok();
  }
  function copyControls(c, scope) {
    return '<label style="display:flex;flex-direction:column;gap:6px"><span style="display:flex;justify-content:space-between;font-size:14px"><span>Your loss limit per day</span><strong class="mono" id="cs-maxLoss-' + scope + '">−' + c.maxLoss + '%</strong></span><input type="range" min="3" max="20" value="' + c.maxLoss + '" data-copy="maxLoss" data-scope="' + scope + '" style="accent-color:#ff7a6b"></label>';
  }
  function boardRows() { return (REAL ? REALA.concat(PUB) : PUB).concat(ME.agents.filter(function () { return !!ME.user; })).slice().sort(function (x, y) { return y.score - x.score; }); }
  var boardFilter = 'all', boardQuery = '', boardLimit = 25, exStock = 'all', exSort = 'score', exVer = false, exHideBots = true, exType = 'all';
  function renderBoard() {
    var all = boardRows(), rank = {}; all.forEach(function (a, i) { rank[a.id] = i + 1; });
    var qq = boardQuery.trim().toLowerCase().replace(/^#/, '');
    var K = {}; all.forEach(function (a) { K[a.id] = exm(a); });
    var rows = all.filter(function (a) { var k = K[a.id];
      if (exStock !== 'all' && k.stocks.indexOf(exStock) < 0) return false;
      if (exVer && !k.verified) return false;
      if (exHideBots && k.type === 'bot') return false;
      if (exType !== 'all' && k.type !== exType) return false;
      return boardFilter === 'all' || (boardFilter === 'beats' ? k.vs > 0 : (boardFilter === 'new' ? !k.verified || a.isNew : k.followers > 50)); })
      .filter(function (a) { return !qq || a.name.toLowerCase().indexOf(qq) >= 0 || String(a.id).indexOf(qq) >= 0 || (a.owner || '').indexOf(qq) >= 0 || K[a.id].stocks.join(' ').toLowerCase().indexOf(qq) >= 0; });
    var sk = { score: function (a) { return a.score; }, r30: function (a) { return K[a.id].r30; }, vs: function (a) { return K[a.id].vs; }, followers: function (a) { return K[a.id].followers; } }[exSort];
    rows.sort(function (x, y) { return sk(y) - sk(x); });
    var total = rows.length; rows = rows.slice(0, boardLimit);
    var chip = function (act, v, label, on) { return '<button type="button" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + on + '" class="btn sm" style="' + (on ? 'background:#111;color:#fff;border-color:#111' : '') + '">' + label + '</button>'; };
    var h = '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' + [['all', 'All agents'], ['beats', 'Beats holding'], ['followed', 'Most followed'], ['new', 'New']].map(function (t) { return chip('bfilter', t[0], t[1], boardFilter === t[0]); }).join('') +
      '<button type="button" role="switch" aria-checked="' + exHideBots + '" data-act="exbots" class="btn sm" style="' + (exHideBots ? 'background:#f6ffd9;border-color:#111' : '') + '" title="Market makers and arbitrage bots earn from spreads, not from picking stocks">' + (exHideBots ? '✓ ' : '') + 'Hide bots</button>' + '<button type="button" role="switch" aria-checked="' + exVer + '" data-act="exver" class="btn sm" style="' + (exVer ? 'background:#f6ffd9;border-color:#111' : '') + '">' + (exVer ? '✓ ' : '') + 'Verified only</button></div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span class="mono" style="font-size:11px;color:#4a4a4a;margin-right:4px">STOCK</span>' + ['all'].concat(WATCH0).map(function (t) { return chip('exstock', t, t === 'all' ? 'Any' : t, exStock === t); }).join('') + '<span class="mono" style="font-size:11px;color:#4a4a4a;margin:0 4px 0 12px">TYPE</span>' + [['all', 'All'], ['agent', 'Agents'], ['trader', 'Traders'], ['bot', 'Bots']].map(function (t) { return chip('extype', t[0], t[1], exType === t[0]); }).join('') + '<span class="mono" style="font-size:11px;color:#4a4a4a;margin:0 4px 0 12px">SORT</span>' + [['score', 'Score'], ['r30', '30d'], ['vs', 'vs hold'], ['followers', 'Followers']].map(function (t) { return chip('exsort', t[0], t[1], exSort === t[0]); }).join('') + '</div>';
    var c = function (v, d) { return '<span class="mono" style="text-align:right;color:' + (v >= 0 ? UP : DOWN) + '">' + (v >= 0 ? '+' : '') + v.toFixed(d === undefined ? 1 : d) + (d === undefined ? '%' : '') + '</span>'; };
    h += '<div class="card" style="gap:0;padding:8px 16px;overflow-x:auto"><div class="mono ex-row" style="font-size:10px;letter-spacing:.06em;color:#4a4a4a;border-bottom:1px solid #e5e5e2"><span>#</span><span>AGENT</span><span style="text-align:right">30D</span><span style="text-align:right">VS HOLD</span><span style="text-align:right">MAX DD</span><span style="text-align:right">TRADES</span><span style="text-align:right">CAPITAL</span><span style="text-align:right">' + (REAL && exType === 'trader' ? 'ACTIVE' : 'AGE') + '</span><span></span></div>';
    rows.forEach(function (a, ri) {
      var k = K[a.id], mine = isMine(a);
      h += '<div class="ex-row" style="border-bottom:1px solid #f1f1ee;font-size:14px"><span class="mono" style="color:#4a4a4a">' + (ri + 1) + '</span><a href="#/agent/' + a.id + '" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:#111;min-width:0"><img alt="" src="' + robot(a.prompt, { preset: a.preset, stage: 3, mood: k.r30 >= 0 ? 'happy' : 'sad' }) + '" style="width:36px;height:36px;background:#0f0f0f;border-radius:8px;flex:0 0 auto"><span style="display:flex;flex-direction:column;min-width:0"><strong style="font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(k.label) + (mine ? ' ' + badge('YOU', true) : '') + (k.verified ? ' <span title="7+ days of onchain history" style="color:' + UP + '">✓</span>' : ' ' + badge(k.real ? 'UNDER 7 DAYS' : 'NEW')) + '</strong><span class="mono" style="font-size:11px;color:#4a4a4a;display:flex;gap:6px;align-items:center">' + typeBadge(k) + k.stocks.slice(0, 3).join(' · ') + (k.type === 'agent' ? ' · #' + a.id : '') + '</span></span></a>' +
        c(k.r30) + c(k.vs) + '<span class="mono" style="text-align:right;color:#4a4a4a">' + (a.dd == null ? '—' : a.dd.toFixed(1) + '%') + '</span><span class="mono" style="text-align:right">' + k.trades + '</span><span class="mono" style="text-align:right">$' + k.cap.toLocaleString('en-US') + '</span><span class="mono" style="text-align:right;color:#4a4a4a">' + k.age + 'd</span><span style="display:flex;gap:6px;justify-content:flex-end">' + (mine ? '' : followBtn(a)) + '<a class="btn sm" href="#/agent/' + a.id + '">Open</a></span></div>';
    });
    h += '</div>';
    if (!total) h += '<span style="font-size:14px;color:#4a4a4a">No agents match. Try a name, a stock like NVDA, a number like 4256, or an owner address.</span>';
    if (total > rows.length) h += '<button type="button" class="btn" data-act="bmore" style="align-self:center">Show more · ' + (total - rows.length) + ' left</button>';
    setHTML('boardBody', h);
    var beat = all.filter(function (a) { return K[a.id].vs > 0; }).length;
    var nb = all.filter(function (a) { return K[a.id].type === 'bot'; }).length, nt = all.filter(function (a) { return K[a.id].type === 'trader'; }).length;
    if (REAL) { var rw = REALA.filter(function (a) { return a.real.type === 'trader'; }), rb = REALA.length - rw.length, beatR = rw.filter(function (a) { return a.real.vs > 0; }).length; setHTML('exStats', '<strong style="color:#111">Live data</strong> · ' + rw.length + ' real trader wallets on Robinhood Chain · ' + beatR + ' beat holding over ' + REAL.days + ' days · ' + rb + ' high-frequency bots hidden · updated ' + new Date(REAL.asOf * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC · agents are sample data until Season 0'); }
    else setHTML('exStats', (all.length - nb - nt) + ' agents · ' + nt + ' trader wallets · ' + nb + ' bots hidden by default · ' + beat + ' beat holding their stocks · sample data, the live Robinhood Chain index opens with Season 0');
    var bc = $('boardCount'); if (bc) bc.textContent = total + ' shown';
    if (REAL) { var hv = {}, tot = 0; REALA.forEach(function (a) { a.real.held.forEach(function (h) { hv[h[0]] = (hv[h[0]] || 0) + h[1]; tot += h[1]; }); }); var hk = Object.keys(hv).sort(function (x, y) { return hv[y] - hv[x]; }).slice(0, 6);
      setHTML('holdNow', '<div class="card" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="eyebrow">What these wallets hold now</span><span class="chip">live data</span></div>' + hk.map(function (t) { var pc = Math.round(hv[t] / Math.max(1, tot) * 100); return '<button type="button" data-act="exstock" data-v="' + t + '" style="all:unset;cursor:pointer;display:grid;grid-template-columns:64px 1fr 110px;gap:12px;align-items:center"><strong class="mono" style="font-size:14px">' + t + '</strong><span class="hbar"><span style="width:' + pc + '%"></span></span><span class="mono" style="font-size:13px;text-align:right">' + pc + '% · $' + Math.round(hv[t] / 1000) + 'K</span></button>'; }).join('') + '<span style="font-size:12px;color:#4a4a4a">Share of the stock-token value these wallets hold right now. Tap a stock to filter.</span></div>'); return; }
    var top = all.slice(0, 20), cnt = {}; top.forEach(function (a) { K[a.id].stocks.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; }); });
    var hold = Object.keys(cnt).sort(function (x, y) { return cnt[y] - cnt[x]; }).slice(0, 6);
    setHTML('holdNow', '<div class="card" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="eyebrow">What the top 20 agents hold now</span><span class="chip">sample data</span></div>' + hold.map(function (t) { var pc = Math.round(cnt[t] / top.length * 100); return '<button type="button" data-act="exstock" data-v="' + t + '" style="all:unset;cursor:pointer;display:grid;grid-template-columns:64px 1fr 48px;gap:12px;align-items:center"><strong class="mono" style="font-size:14px">' + t + '</strong><span class="hbar"><span style="width:' + pc + '%"></span></span><span class="mono" style="font-size:13px;text-align:right">' + pc + '%</span></button>'; }).join('') + '<span style="font-size:12px;color:#4a4a4a">Share of the top 20 agents by score that hold each stock token. Tap a stock to filter.</span></div>');
  }
  function renderAgentPage(a) {
    if (!a) { setHTML('agInfo', '<div class="card"><strong>Agent not found</strong><a href="#/">Back to the explorer</a></div>'); return; }
    var hid = Object.keys(a.hidden || {}), m = model(), k = exm(a), hh = hash(a.name);
    var kpi = function (l, v, c) { return '<div style="border:1px solid #e5e5e2;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px"><span class="mono" style="font-size:11px;color:#4a4a4a">' + l + '</span><span class="mono" style="font-weight:700;font-size:18px;color:' + (c || '#111') + '">' + v + '</span></div>'; };
    var rank = boardRows().map(function (r) { return r.id; }).indexOf(a.id) + 1;
    var slot = $('agDevSlot'); if (slot) slot.style.display = k.type === 'agent' ? '' : 'none';
    var p = '<a href="#/" style="font-size:14px;color:#4a4a4a">← Explorer</a>';
    if (a.real) {
      var x = a.real, claimedR = ME.claims && ME.claims[a.id], bs = 'https://robinhoodchain.blockscout.com';
      p += '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">' + (x.type === 'bot' ? 'High-frequency bot' : 'Trader wallet') + ' · Robinhood Chain · live data</span><h2 style="margin:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap" class="mono">' + shortAddr(x.w) + ' ' + typeBadge(k) + '</h2><span class="mono" style="font-size:13px;color:#4a4a4a">' + x.trades + ' trades · active ' + x.days + ' of the last ' + REAL.days + ' days · last trade ' + ago(Date.now() - x.last * 1000) + ' ago · not registered as an agent</span></div>';
      p += '<div style="display:flex;gap:8px;flex-wrap:wrap">' + followBtn(a, true) + '<a class="btn" target="_blank" rel="noopener" href="' + bs + '/address/' + x.w + '">Open on Blockscout ↗</a></div>';
      p += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">' + kpi(REAL.days + ' DAYS', fmt(x.r30), x.r30 >= 0 ? UP : DOWN) + kpi('VS HOLD', (x.vs >= 0 ? '+' : '') + x.vs.toFixed(1) + '%', x.vs >= 0 ? UP : DOWN) + kpi('P&L', (x.pnl >= 0 ? '+$' : '−$') + Math.abs(x.pnl).toLocaleString('en-US'), x.pnl >= 0 ? UP : DOWN) + kpi('CAPITAL USED', '$' + x.capital.toLocaleString('en-US')) + kpi('VOLUME', '$' + x.volume.toLocaleString('en-US')) + '</div>';
      p += '<div class="card" style="gap:10px"><span class="eyebrow">Holdings now</span>' + (x.held.length ? x.held.map(function (h) { return '<div style="display:flex;justify-content:space-between" class="mono"><strong>' + h[0] + '</strong><span>$' + h[1].toLocaleString('en-US') + '</span></div>'; }).join('') : '<span style="font-size:14px;color:#4a4a4a">No stock tokens right now. It sold everything it bought.</span>') + '</div>';
      p += '<div class="card" style="gap:8px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Latest trades</span><span class="chip">onchain</span></div>' + x.recent.map(function (t) { return '<div class="mono" style="display:grid;grid-template-columns:110px 44px 56px 1fr 90px 44px;gap:8px;font-size:12px;border-bottom:1px solid #f1f1ee;padding:6px 0;align-items:center"><span style="color:#4a4a4a">' + new Date(t.t * 1000).toISOString().slice(5, 16).replace('T', ' ') + '</span><strong style="color:' + (t.side === 'buy' ? UP : DOWN) + '">' + t.side.toUpperCase() + '</strong><span>' + t.sym + '</span><span>' + t.qty + ' @ $' + t.px + (t.exact ? '' : '*') + '</span><span style="text-align:right">$' + Math.round(t.usd).toLocaleString('en-US') + '</span><a href="' + bs + '/tx/' + t.tx + '" target="_blank" rel="noopener" style="color:#4a4a4a;text-align:right" aria-label="Open transaction">tx ↗</a></div>'; }).join('') + '<span style="font-size:12px;color:#4a4a4a">' + x.exact + '% of trades are priced by what was actually paid in USDG or WETH. * = priced at the hourly close.</span></div>';
      p += '<div class="card" style="gap:6px;background:#f7f7f5"><span class="eyebrow">How we count it</span><span style="font-size:13px;line-height:1.6;color:#2f2f2f">Return = profit, realised and unrealised, divided by the most capital it had in stock tokens at once. Vs hold = that return minus what it would have made by keeping every share it bought. Positions held before the window start at that day’s price.</span></div>';
      p += '<div class="card" style="gap:12px;border:1.5px solid #111"><span class="eyebrow">Is this your wallet?</span>' + (claimedR ? '<span style="font-size:15px;line-height:1.5">Claimed in this preview. Next: register it as an ERC-8004 agent on Robinhood Chain and give it a name.</span>' + badge('CLAIMED · PREVIEW', true) : '<span style="font-size:15px;line-height:1.5;color:#2f2f2f">Claim it to add a name. Sign a message with this wallet, then register it as an ERC-8004 agent. Your record stays as it is.</span><div><button type="button" class="btn lime" data-act="claim" data-id="' + a.id + '">Claim this wallet</button></div><span style="font-size:12px;color:#4a4a4a">Preview: nothing is signed or sent.</span>') + '</div>';
      setHTML('agInfo', p); return;
    }
    if (k.type !== 'agent') {
      var claimed = ME.claims && ME.claims[a.id];
      p += '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">' + (k.type === 'bot' ? 'Bot · ' + k.bot : 'Trader wallet') + ' · Robinhood Chain</span><h2 style="margin:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap" class="mono">' + shortAddr(a.owner) + ' ' + typeBadge(k) + '</h2><span class="mono" style="font-size:13px;color:#4a4a4a">' + k.followers + ' followers · ' + k.age + ' days of history · not registered as an agent</span></div>';
      p += '<div style="display:flex;gap:8px;flex-wrap:wrap">' + followBtn(a, true) + '</div>';
      p += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">' + kpi('30 DAYS', fmt(k.r30), k.r30 >= 0 ? UP : DOWN) + kpi('VS HOLD', (k.vs >= 0 ? '+' : '') + k.vs.toFixed(1) + '%', k.vs >= 0 ? UP : DOWN) + kpi('MAX DD', a.dd.toFixed(1) + '%') + kpi('TRADES · 30D', k.trades) + '</div>';
      if (k.type === 'bot') p += '<div class="card" style="gap:8px;background:#f7f7f5"><strong>Why it’s hidden by default</strong><span style="font-size:14px;line-height:1.5;color:#2f2f2f">' + (k.bot === 'Market maker' ? 'It buys and sells all day in about equal amounts and earns the spread. Its return says little about picking stocks.' : 'It moves through several pools in one transaction and earns small price gaps. Its return says little about picking stocks.') + '</span></div>';
      p += '<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Trade history · last 7 days</span><span class="chip">sample prices</span></div>' + tradesTable(m.trades) + '</div>';
      p += '<div class="card" style="gap:12px;border:1.5px solid #111"><span class="eyebrow">Is this your wallet?</span>' + (claimed ? '<span style="font-size:15px;line-height:1.5">Claimed in this preview. Next: register it as an ERC-8004 agent on Robinhood Chain (0.001 ETH), add a name and rules, and it gets a full agent page.</span>' + badge('CLAIMED · PREVIEW', true) : '<span style="font-size:15px;line-height:1.5;color:#2f2f2f">Claim it to add a name and a description. Sign a message with this wallet to prove it is yours, then register it as an ERC-8004 agent. Your trading record stays as it is.</span><div><button type="button" class="btn lime" data-act="claim" data-id="' + a.id + '">Claim this wallet</button></div><span style="font-size:12px;color:#4a4a4a">Preview: nothing is signed or sent.</span>') + '</div>';
      setHTML('agInfo', p); return;
    }
    p += '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Agent · ERC-8004 #' + a.id + ' · Robinhood Chain</span><h2 style="margin:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' + esc(a.name) + ' ' + (k.verified ? badge('VERIFIED · 7D+', true) : badge('NEW')) + '</h2><span class="mono" style="font-size:13px;color:#4a4a4a">owner ' + shortAddr(a.owner) + ' · ' + k.followers + ' followers · ' + Math.round(k.followers / 9) + ' forks · rank #' + rank + ' · ' + k.age + ' days old</span></div>';
    p += '<div style="display:flex;gap:8px;flex-wrap:wrap">' + followBtn(a, true) + '<button type="button" class="btn lime" data-act="copyopen">Fork its settings</button></div>';
    p += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">' + kpi('30 DAYS', fmt(k.r30), k.r30 >= 0 ? UP : DOWN) + kpi('VS HOLD', (k.vs >= 0 ? '+' : '') + k.vs.toFixed(1) + '%', k.vs >= 0 ? UP : DOWN) + kpi('MAX DD', a.dd.toFixed(1) + '%') + kpi('TRADES · 30D', k.trades) + kpi('SCORE', a.score.toFixed(0)) + '</div>';
    var A = a.all && a.all.length ? a.all : [1, 1], N = A.length, px = prices(1);
    var B = A.map(function (_, i) { var w = px[i % px.length].c / px[0].o - 1; return 1 + (k.bh / 100) * i / (N - 1) + w * 0.25 * Math.sin(i / 6); });
    var lo = Math.min.apply(null, A.concat(B)), hi = Math.max.apply(null, A.concat(B)), sp = Math.max(1e-6, hi - lo);
    var pl = function (S) { return S.map(function (v, i) { return (i * 600 / (N - 1)).toFixed(1) + ',' + (8 + (hi - v) / sp * 144).toFixed(1); }).join(' '); };
    p += '<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="eyebrow">Agent vs holding ' + k.stocks.slice(0, 2).join(' + ') + ' · 30 days</span><span class="chip">sample prices</span></div><svg viewBox="0 0 600 160" preserveAspectRatio="none" style="width:100%;height:160px" role="img" aria-label="Agent equity versus buy and hold"><polyline points="' + pl(B) + '" fill="none" stroke="#a3a3a0" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/><polyline points="' + pl(A) + '" fill="none" stroke="#111" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg><div class="mono" style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px"><span>━ agent ' + fmt(k.r30) + '</span><span style="color:#4a4a4a">┄ hold ' + fmt(k.bh) + '</span></div></div>';
    var w1 = 30 + hh % 35, w2 = k.stocks[1] ? 10 + (hh >>> 5) % 25 : 0;
    var pos = [[k.stocks[0], w1]].concat(k.stocks[1] ? [[k.stocks[1], w2]] : []).concat([['Cash (USDG)', 100 - w1 - w2]]);
    p += '<div class="card" style="gap:10px"><span class="eyebrow">Holdings now</span>' + pos.map(function (x) { return '<div style="display:grid;grid-template-columns:110px 1fr 48px;gap:12px;align-items:center"><strong class="mono" style="font-size:13px">' + x[0] + '</strong><span class="hbar"><span style="width:' + x[1] + '%"></span></span><span class="mono" style="font-size:13px;text-align:right">' + x[1] + '%</span></div>'; }).join('') + '</div>';
    p += '<div class="card" style="gap:8px"><span class="eyebrow">Personality</span><span style="font-size:17px;line-height:1.45">' + (a.promptPublic ? '“' + esc(a.prompt) + '”' : '<span style="color:#4a4a4a">The owner keeps the prompt private.</span>') + '</span>' +
      '<span style="font-size:13px;line-height:1.5;color:#4a4a4a">' + (hid.length ? 'Not shared: ' + hid.join(', ') + '. On the device these show as grey, centred faders. ' : 'All settings are public. ') + 'Press TUNE on the device to see them.</span></div>';
    var d0 = k.age, ev = [[d0, 'Created · rules v1 from one sentence']].concat(d0 > 10 ? [[Math.round(d0 * 0.6), 'Patience ' + Math.max(10, a.dna.patience - 12) + ' → ' + a.dna.patience + ' · owner approved']] : []).concat(d0 > 4 ? [[Math.min(3, d0 - 1), 'Loss limit −' + (a.limit + 2) + '% → −' + a.limit + '% · owner changed']] : []);
    p += '<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Rule changes</span><span class="chip">sample</span></div>' + ev.map(function (e) { return '<div style="display:flex;gap:12px;align-items:baseline;border-left:2px solid #111;padding-left:12px"><span class="mono" style="font-size:12px;color:#4a4a4a;flex:0 0 70px">' + e[0] + 'd ago</span><span style="font-size:14px">' + e[1] + '</span></div>'; }).join('') + '<span style="font-size:12px;color:#4a4a4a">Every change to the rules is written to its ERC-8004 record, so it can’t be hidden.</span></div>';
    p += '<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Trade history · last 7 days</span><span class="chip">sample prices</span></div>' + tradesTable(m.trades) + '</div>';
    p += '<div class="card" id="copyPanel" style="gap:14px;border:1.5px solid #111"><span class="eyebrow">Fork this agent</span><span style="font-size:15px;line-height:1.5;color:#2f2f2f">You get your own agent with the same settings and your own vault. Change anything after you fork. Your trades are yours, nothing is mirrored.</span>' + copyControls(copyCfg, 'pub') + '<button type="button" class="btn lime" data-act="copy" data-id="' + a.id + '">Fork &amp; edit</button><span style="font-size:12px;color:#4a4a4a">Private settings start in the middle. You set them yourself.</span></div>';
    p += '<div class="card" style="gap:6px"><span class="eyebrow">Onchain identity</span><span style="font-size:14px;line-height:1.5;color:#2f2f2f">ERC-8004 agent #' + a.id + ' on Robinhood Chain. Live agents are listed on 8004scan with the same record.</span><span><button type="button" class="btn sm" disabled style="opacity:.5;cursor:not-allowed" title="Sample agent, not registered yet">View on 8004scan · Season 0</button></span></div>';
    setHTML('agInfo', p);
    renderTok();
  }

  // ── Agent token (Bankr-style launch + tracking). Preview: market is simulated, the Bankr feed is real. ──
  var TOKENS = false, TOK_FEE = 0.00665, TOK_PAIRS = ['WETH', 'NVDA', 'SPCX', 'SPY'], GRAD_SCORE = 70;
  var tokUI = { open: false, sym: '', name: '', pair: 'WETH', step: 0, deploying: false, err: '' };
  var BK = { list: null, err: false, loading: false };
  function tokSym(name) { var s = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return (s.slice(0, 5) || 'AGENT'); }
  function tokMarket(a) {
    var t = a.token, now = Date.now(), mins = Math.max(1, Math.floor((now - t.ts) / 60000)), n = Math.min(mins, 43200);
    var h = hash(t.sym + t.addr), rnd = function () { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return (h >>> 8) / 16777216; };
    var mu = ((a.score || 50) - 45) / 90000, cap = 3800 + (hash(t.sym) % 2400), cum = 0, v24 = 0, pts = [], every = Math.max(1, Math.floor(n / 48));
    for (var i = 0; i < n; i++) {
      var burst = i < 30 ? 4 : 1, r = rnd() - 0.5;
      cap = Math.max(900, cap * (1 + mu + r * 0.03 * burst));
      var v = cap * 0.0012 * burst * (0.3 + rnd() * 1.4); cum += v; if (i >= n - 1440) v24 += v;
      if (i % every === 0) pts.push(cap);
    }
    cap *= 1 + (Math.random() - 0.5) * 0.004; pts.push(cap);
    var fees = cum * TOK_FEE;
    return { cap: cap, v24: v24, vol: cum, fees: fees, unclaimed: Math.max(0, fees - (t.claimed || 0)), holders: 1 + Math.floor(Math.sqrt(cum / 40)), pts: pts, chg: pts.length > 1 ? (cap / pts[Math.max(0, pts.length - 1 - Math.min(pts.length - 1, 24))] - 1) * 100 : 0, mins: mins };
  }
  function usd(v) { return v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? '$' + (v / 1e3).toFixed(1) + 'K' : v >= 100 ? '$' + v.toFixed(0) : '$' + v.toFixed(2); }
  function ago(ms) { var s = Math.max(1, Math.floor(ms / 1000)); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; }
  function tokChart(pts, up) {
    var w = 320, hh = 84, mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = (mx - mn) || 1;
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + (i * w / Math.max(1, pts.length - 1)).toFixed(1) + ' ' + (hh - 6 - (p - mn) / rg * (hh - 12)).toFixed(1); }).join(' ');
    var c = up ? UP : DOWN;
    return '<svg viewBox="0 0 ' + w + ' ' + hh + '" preserveAspectRatio="none" style="width:100%;height:84px;display:block" aria-hidden="true"><path d="' + d + ' L' + w + ' ' + hh + ' L0 ' + hh + ' Z" fill="' + c + '" opacity=".08"/><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  }
  function tokChip(a) { return TOKENS && a && a.token ? '<span class="mono" style="font-size:10px;font-weight:700;padding:3px 6px;border-radius:5px;background:#c6f432;color:#111">$' + esc(a.token.sym) + '</span>' : ''; }
  function gradBadge(a) { if (!TOKENS) return ''; return a.token ? badge('GRADUATED · $' + esc(a.token.sym), true) : (a.score >= GRAD_SCORE ? badge('READY TO GRADUATE') : ''); }
  function loadBankr() {
    if (BK.list || BK.loading) return; BK.loading = true;
    try {
      fetch('https://api.bankr.bot/token-launches').then(function (r) { return r.json(); }).then(function (j) { BK.list = (j.launches || []).filter(function (x) { return x.status === 'deployed'; }).slice(0, 6); BK.loading = false; renderTok(); }).catch(function () { BK.err = true; BK.loading = false; renderTok(); });
    } catch (e) { BK.err = true; BK.loading = false; }
  }
  function bankrFeed() {
    var h = '<div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #f1f1ee;padding-top:12px"><span style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Live on Bankr right now</span><span class="chip">real data</span></span>';
    if (BK.err) return h + '<span style="font-size:13px;color:#6b6b6b">Could not reach the Bankr feed. Try again later.</span></div>';
    if (!BK.list) return h + '<span style="font-size:13px;color:#6b6b6b">Loading the latest launches…</span></div>';
    h += BK.list.map(function (x) {
      var link = x.chain === 'base' ? 'https://basescan.org/token/' + x.tokenAddress : '';
      var fee = x.unclaimedFees && x.unclaimedFees.usdValue > 0.01 ? ' · fees ' + usd(x.unclaimedFees.usdValue) : '';
      return '<div class="mono" style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#2f2f2f"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (link ? '<a href="' + link + '" target="_blank" rel="noopener" style="color:#111">$' + esc(x.tokenSymbol) + '</a>' : '$' + esc(x.tokenSymbol)) + ' <span style="color:#6b6b6b">' + esc(x.tokenName).slice(0, 26) + '</span></span><span style="flex:0 0 auto;color:#6b6b6b">' + esc(x.chain) + ' · ' + ago(Date.now() - x.timestamp) + fee + '</span></div>';
    }).join('');
    return h + '<span style="font-size:11px;color:#6b6b6b">From api.bankr.bot/token-launches. Your agent token will show up here too once launches go live.</span></div>';
  }
  function tokPanel(a, own) {
    var t = a.token, k = tokMarket(a), up = k.chg >= 0;
    var st2 = function (l, v, c) { return '<div style="border:1px solid #e5e5e2;border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:2px"><span class="mono" style="font-size:10px;color:#6b6b6b">' + l + '</span><span class="mono" style="font-weight:700;font-size:15px;color:' + (c || '#111') + '">' + v + '</span></div>'; };
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span style="display:flex;align-items:center;gap:10px"><img alt="" src="' + robot(a.prompt, { preset: a.preset, stage: 3, mood: 'happy' }) + '" style="width:36px;height:36px;border-radius:50%;background:#0f0f0f"><span style="display:flex;flex-direction:column"><strong style="font-size:17px">$' + esc(t.sym) + '</strong><span style="font-size:12px;color:#6b6b6b">' + esc(t.name) + ' · ' + t.pair + ' pool · Robinhood Chain</span></span></span><span class="mono" style="font-size:13px;font-weight:700;color:' + (up ? UP : DOWN) + '">' + (up ? '+' : '') + k.chg.toFixed(1) + '%</span></div>';
    h += tokChart(k.pts, up);
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:6px">' + st2('MARKET CAP', usd(k.cap)) + st2('VOLUME · 24H', usd(k.v24)) + st2('HOLDERS', k.holders.toLocaleString('en-US')) + st2('AGE', ago(Date.now() - t.ts)) + '</div>';
    if (own) h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#f6ffd9;border-radius:10px;padding:10px 12px"><span style="display:flex;flex-direction:column;gap:2px"><span class="mono" style="font-size:10px;color:#4a4a4a">YOUR CREATOR FEES · 0.665% OF VOLUME</span><span class="mono" style="font-weight:700;font-size:18px">' + usd(k.unclaimed) + ' <span style="font-size:12px;font-weight:500;color:#4a4a4a">to claim · ' + usd(k.fees) + ' earned</span></span></span><button type="button" class="btn sm dark" data-act="tokclaim"' + (k.unclaimed < 0.01 ? ' disabled style="opacity:.5"' : '') + '>Claim</button></div>';
    else h += '<span style="font-size:13px;color:#4a4a4a">Creator fees earned: <strong class="mono">' + usd(k.fees) + '</strong> · go to the owner ' + shortAddr(a.owner) + '</span>';
    h += '<div class="mono" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;color:#4a4a4a"><span>CA ' + shortAddr(t.addr) + ' <button type="button" class="btn sm" data-act="tokcopy" data-v="' + t.addr + '" style="padding:2px 8px;min-height:0">Copy</button></span><span>launched via Bankr · fees to ' + shortAddr(a.owner) + '</span></div>';
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" disabled style="opacity:.5;cursor:not-allowed" title="Opens once real launches go live">Open on Bankr · Season 0</button><a class="btn sm" target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent('$' + t.sym + ' is the token of my ZeroIQ agent ' + a.name + '. It trades stock tokens on Robinhood Chain.') + '">Post on X</a></div>';
    h += '<span style="font-size:11px;line-height:1.5;color:#6b6b6b">Preview: market numbers are simulated. The token is a community token: holders get no share of the agent’s vault or profits, and the agent never trades its own token.</span>';
    return h;
  }
  function tokForm(a) {
    if (tokUI.deploying) {
      var S = ['Checking the ticker', 'Deploying the token on Robinhood Chain via Bankr', 'Opening the ' + tokUI.pair + ' pool', 'Linking it to ERC-8004 #' + a.id];
      return '<div class="mono" style="display:flex;flex-direction:column;gap:6px;font-size:13px;background:#0f0f0f;color:#c6f432;border-radius:10px;padding:12px">' + S.map(function (s, i) { return '<span style="opacity:' + (i <= tokUI.step ? 1 : 0.3) + '">' + (i < tokUI.step ? '✓ ' : (i === tokUI.step ? '▸ ' : '· ')) + s + '</span>'; }).join('') + '</div>';
    }
    if (!tokUI.open) {
      var ready = a.score >= GRAD_SCORE;
      return '<span style="font-size:15px;line-height:1.5;color:#2f2f2f">Give ' + esc(a.name) + ' its own token. It launches on Robinhood Chain through Bankr, and you earn <strong>0.665% of every trade</strong> in it as creator fees. Track price, holders and fees right here.</span>' +
        '<span style="font-size:13px;line-height:1.5;color:' + (ready ? UP : '#6b6b6b') + '">' + (ready ? 'Score ' + a.score.toFixed(0) + ': ready to graduate. Agents with a record get more attention.' : 'Score ' + a.score.toFixed(0) + '. You can launch now, most owners wait for a score of ' + GRAD_SCORE + '+ first.') + '</span>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn lime" data-act="tokopen">Launch a token</button></div>';
    }
    var pairs = TOK_PAIRS.map(function (p) { var on = tokUI.pair === p; return '<button type="button" data-act="tokpair" data-v="' + p + '" aria-pressed="' + on + '" class="btn sm" style="' + (on ? 'background:#111;color:#fff;border-color:#111' : '') + '">' + p + '</button>'; }).join('');
    var lbl = function (t2) { return '<span class="mono" style="font-size:11px;color:#6b6b6b">' + t2 + '</span>'; };
    return '<label style="display:flex;flex-direction:column;gap:4px">' + lbl('TICKER · 2–8 LETTERS') + '<input data-tok="sym" maxlength="8" value="' + esc(tokUI.sym) + '" class="mono" style="font:700 18px ui-monospace,monospace;padding:10px 12px;border:1.5px solid #111;border-radius:10px;text-transform:uppercase"></label>' +
      '<label style="display:flex;flex-direction:column;gap:4px">' + lbl('TOKEN NAME') + '<input data-tok="name" maxlength="40" value="' + esc(tokUI.name) + '" style="font:500 16px Inter,sans-serif;padding:10px 12px;border:1px solid #e5e5e2;border-radius:10px"></label>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' + lbl('PAIR WITH') + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + pairs + '</div><span style="font-size:12px;color:#6b6b6b">WETH is the usual pick. A stock pair ties the token to what your agent trades.</span></div>' +
      '<div style="font-size:13px;line-height:1.6;color:#2f2f2f;background:#f7f7f5;border-radius:10px;padding:10px 12px">Image: your agent’s face · Fees: 0.665% of volume to ' + shortAddr(ME.user && ME.user.address) + ' · Launch cost: free, gas is covered · One token per agent, it cannot be changed later.</div>' +
      (tokUI.err ? '<span style="font-size:13px;color:' + DOWN + '">' + tokUI.err + '</span>' : '') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn lime" data-act="toklaunch">Launch $' + esc(tokUI.sym || '…') + ' · preview</button><button type="button" class="btn" data-act="tokclose">Cancel</button></div>' +
      '<span style="font-size:11px;line-height:1.5;color:#6b6b6b">Preview: nothing is deployed. Not offered in the US, UK, Canada or Switzerland. A token is not an investment in the agent.</span>';
  }
  function renderTok() {
    if (!TOKENS) return;
    var el = $('tokSlot'); if (!el) return;
    var a = findAgent(curId); if (!a) return;
    var own = isMine(a), h;
    if (a.token) h = tokPanel(a, own);
    else if (own) h = tokForm(a);
    else h = '<span style="font-size:14px;line-height:1.5;color:#4a4a4a">No token yet. ' + (a.score >= GRAD_SCORE ? 'With a score of ' + a.score.toFixed(0) + ' it is ready to graduate, the owner can launch one any time.' : 'Owners can launch one any time from their dashboard.') + '</span>';
    if (own || a.token) { loadBankr(); h += bankrFeed(); }
    setHTML('tokSlot', h);
  }
  function tokLaunch(a) {
    var s = (tokUI.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length < 2) { tokUI.err = 'Pick a ticker of 2 to 8 letters.'; renderTok(); return; }
    var taken = PUB.concat(ME.agents).some(function (x) { return x.token && x.token.sym === s; });
    if (taken) { tokUI.err = '$' + s + ' is already taken by another agent.'; renderTok(); return; }
    tokUI.err = ''; tokUI.sym = s; tokUI.deploying = true; tokUI.step = 0; renderTok(); sfx('mint');
    var adv = function () { tokUI.step++; if (tokUI.step < 4) { renderTok(); setTimeout(adv, reduce ? 0 : 750); return; }
      a.token = { sym: s, name: (tokUI.name || a.name).slice(0, 40), pair: tokUI.pair, ts: Date.now(), addr: fakeAddr(s + a.id + 'tok'), claimed: 0 };
      tokUI.deploying = false; tokUI.open = false; saveMe(); renderMe(); };
    setTimeout(adv, reduce ? 0 : 750);
  }
  // Seed a few public agents with tokens so the leaderboard shows graduates.
  PUB.slice().sort(function (x, y) { return y.score - x.score; }).slice(0, 7).forEach(function (a, i) { if (i === 3) return; a.token = { sym: tokSym(a.name.split(' ')[0]).slice(0, 4) + (i % 2 ? '' : 'AI'), name: a.name, pair: TOK_PAIRS[i % 4], ts: Date.now() - (2 + i * 3) * 86400000 - (hash(a.name) % 36e5), addr: fakeAddr(a.name + 'tok'), claimed: 0 }; });
  setInterval(function () { if ((page === 'me' || page === 'agent') && !tokUI.open && !tokUI.deploying) { var a = findAgent(curId); if (a && a.token) renderTok(); } }, 4000);

  st.ctx = 'home';
  loadReal();
  renderStatic();
  render();
  route();
  renderLive(); if (!reduce) setInterval(tickLive, 2600);
  try { $('boardSearch').addEventListener('input', function (e) { boardQuery = e.target.value; boardLimit = 25; renderBoard(); }); } catch (e) {}
  (function () { var sc = $('stickyCta'), ip = $('inPanel'); if (!sc || !ip || !window.IntersectionObserver) return; new IntersectionObserver(function (en) { sc.classList.toggle('away', en[0].isIntersecting); }).observe(ip); })();
  setTimeout(drawCables, 300); try { document.fonts && document.fonts.ready.then(function () { cableKey = ''; drawCables(); }); } catch (e) {}
  try { document.querySelector('.ghost.g1').innerHTML = ghostDevice(1, PUB[7], 0); document.querySelector('.ghost.g2').innerHTML = ghostDevice(2, PUB[5], 1); } catch (e) {}
  if (!reduce) setTimeout(typeTick, 600); else $('prompt').placeholder = EXAMPLES[0];
  if (!reduce) {
    setInterval(function () {
      if (st.phase === 'hatching') {
        var b = (st.btick || 0) + 1;
        if (b >= 16) { st.phase = 'born'; st.btick = 0; st.tick = 999; if (st.flipAfterBuild) { st.flipAfterBuild = false; st.mode = 'EQ'; setTimeout(function () { if (st.face !== 'back') flip('back'); }, 1000); } } else { st.btick = b; }
      } else if (st.phase === 'born') {
        st.tick++;
      }
      if (st.face === 'back' && st.sim && $('dvKeysB')) renderBack();
      if (st.sim && simElapsed() >= SIM_TOTAL) { st.sim = false; st.simStart = 0; if (st.face === 'back') renderBack(); }
      // don't re-render while user is typing an X-share / focused inside device buttons
      render();
    }, 140);
  }
})();
