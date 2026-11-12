(function () {
  'use strict';
  var UP = '#0a7f3f', DOWN = '#c0362c';
  var $ = function (id) { return document.getElementById(id); };
  var setHTML = function (id, html) { var el = $(id); if (el._h !== html) { el.innerHTML = html; el._h = html; } };
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
  var st = { tick: reduce ? 999 : 0, phase: 'idle', btick: 0, face: 'front', skills: { spot: true }, tune: { limit: 10, watch: { NVDA: true, TSLA: false, AAPL: true, AMZN: false, PLTR: true, COIN: false }, conn: { news: false, top: false, x: false }, handles: [] } };
  function set(patch) { Object.keys(patch).forEach(function (k) { st[k] = patch[k]; }); render(); }

  function prompt() { return $('prompt').value; }
  function startHatch(text) {
    $('prompt').value = text;
    if (st.face === 'back' && $('dvFace')) { st.face = 'front'; buildFace(); }
    set({ phase: reduce ? 'born' : 'hatching', btick: 0, rtick: undefined, tick: reduce ? 999 : 0, subject: text, dnaPatch: null, xp: 0, dismissed: false, answered: null, joined: false, tg: false, askOpen: false, saveOpen: false, shareOpen: false, mintOpen: false, face: 'front' });
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
    var sim = equity(px, dna, shown), done = shown >= N;
    var h = hash(subject);
    var ADJ = ['Tiny', 'Lucky', 'Quiet', 'Sleepy', 'Feral', 'Shy'], NOUN = ['Goblin', 'Oracle', 'Intern', 'Hamster', 'Gremlin', 'Robot'];
    var pd = parsed.dna, adj = pd.patience > 70 ? 'Zen' : (pd.fomo > 70 ? 'Hype' : (pd.risk > 80 ? 'Degen' : ADJ[h % 6]));
    var twin = /^\s*@\w+/.test(subject) ? subject.trim().split(/\s/)[0].slice(0, 24) + ' twin' : null;
    var name = born || hatching ? (twin || adj + ' ' + NOUN[(h >> 3) % 6]) : 'Zen Goblin';
    var preset = born || hatching ? h % 8 : 0;
    if (st.nameOverride) name = st.nameOverride;
    if (st.presetOverride !== undefined && st.presetOverride !== null) preset = st.presetOverride;
    var xp = st.xp || 0, lvl = born ? 1 + Math.floor(xp / 15) : 4, stage = lvl >= 5 ? 3 : (lvl >= 2 ? 2 : 1);
    var moodV = Math.max(4, Math.min(100, Math.round(55 + sim.ret * 6)));
    var healthV = Math.max(4, Math.min(100, Math.round(100 - sim.dd * 900)));
    var fedV = born ? (st.answered ? 92 : 46) : 78;
    var mood = moodV > 62 ? 'happy' : (moodV < 42 ? 'sad' : 'ok');
    var trades = sim.trades, lastT = trades[trades.length - 1];
    var diary = born
      ? (done ? (sim.ret >= 0 ? 'Up ' + fmt(sim.ret) + ' on the week. ' + (lastT && lastT.act === 'SELL' ? 'I may have sold a little early. Feed me a question?' : 'Still holding. Feed me a question?') : 'Down ' + fmt(sim.ret) + ' on the week. I have notes for myself. And I am hungry.') : 'Trading last week…')
      : (lastT ? (lastT.act === 'BUY' ? 'Bought NVDA on a red day.' : 'Took profit. Resting.') : 'Watching NVDA. Nothing to do yet.');
    var sells = trades.filter(function (t) { return t.act === 'SELL'; }).length;
    var prop = dna.style === 'dip'
      ? { text: 'I sold early ' + Math.max(1, sells) + ' time' + (sells === 1 ? '' : 's') + ' this week. Raise patience ' + dna.patience + ' → ' + Math.min(99, dna.patience + 12) + '?', patch: { patience: Math.min(99, dna.patience + 12) } }
      : { text: 'I bought after ' + Math.max(1, trades.length) + ' green runs and got tops. Lower FOMO ' + dna.fomo + ' → ' + Math.max(0, dna.fomo - 20) + '?', patch: { fomo: Math.max(0, dna.fomo - 20) } };
    var lo = Math.min.apply(null, sim.eq.concat([1])), hi = Math.max.apply(null, sim.eq.concat([1])), span = Math.max(0.01, hi - lo);
    return { born: born, hatching: hatching, subject: subject, parsed: parsed, dna: dna, sim: sim, done: done, name: name, preset: preset, xp: xp, lvl: lvl, stage: stage,
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
      'stops for the day at −' + limit + '% · trades ' + (watch.length ? watch.join(' ') : 'nothing yet') + '\nstyle: ' + (lean(d) >= 50 ? 'momentum ' + lean(d) : 'dip ' + (99 - lean(d))) + '% · skills: ' + skillNames().join(', ') + (st.md ? ' · playbook: ' + st.md.name : '');
  }
  var TUNE_PRESETS = { ZEN: { patience: 85, fomo: 10, risk: 25, freq: 25, style: 'dip' }, DIP: { patience: 65, fomo: 25, risk: 45, freq: 45, style: 'dip' }, MOMO: { patience: 30, fomo: 70, risk: 55, freq: 60, style: 'momentum' }, DEGEN: { patience: 10, fomo: 95, risk: 95, freq: 90, style: 'momentum' } };
  // ---------- device (2000s handheld, same size on both faces) ----------
  var SK_SHORT = { spot: 'SPOT', orders: 'LIMITS', earn: 'EARN', perps: 'SHORTS', borrow: 'BORROW', dividends: 'DIVIDEND', income: 'INCOME', basket: 'BASKET', memes: 'MEMES' };
  var CONN = [['news', 'News headlines', 'BETA · headlines on its stocks'], ['top', 'Top agents', 'BETA · what the best agents did'], ['x', 'X accounts', 'BETA · posts from accounts below'], ['chain', 'Onchain flows', 'SOON · Robinhood Chain pools', 'soon']];
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
  function winRate(trades) {
    var w = 0, n = 0, buy = null;
    trades.forEach(function (t) { if (t.act === 'BUY') buy = t.price; else if (buy !== null) { n++; if (t.price > buy) w++; buy = null; } });
    return n ? Math.round(w / n * 100) : null;
  }
  function ovBox(head, body, btns) { return '<div class="scr-ov" role="dialog" aria-label="' + head + '"><span class="scr-ov-h">' + head + '</span>' + body + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + btns + '</div></div>'; }
  function ovBtn(act, t, primary, extra) { return '<button type="button" class="scr-btn' + (primary ? ' on' : '') + '" data-act="' + act + '"' + (extra || '') + '>[ ' + t + ' ]</button>'; }
  function screenTop(m) {
    if (m.hatching) return 'BUILDING…';
    var a = st.agentRef;
    if (st.ctx === 'mine' && a) return (a.paused ? 'PAUSED' : (a.mode === 'demo' ? 'DEMO · $1,000 VIRTUAL' : 'LIVE · VAULT $' + (a.vault || 0))) + ' · #' + a.id;
    if (st.ctx === 'public' && a) return 'AGENT #' + a.id + ' · ' + shortAddr(a.owner);
    return m.born ? 'BACKTEST · LAST 7 DAYS' : 'DEMO AGENT · REPLAY';
  }
  function mintOv(m) {
    return ovBox('GO LIVE · Ξ0.001', '<span class="scr-ov-t">Mint ' + esc(m.name) + ' as an onchain agent (ERC-8004) for 0.001 ETH. Then fund its vault, or run it in demo mode first. Create as many agents as you like.</span><span class="scr-ov-s">Preview: nothing is charged and no wallet is connected. Live trading is not offered in the US, UK, Canada or Switzerland.</span>', ovBtn('mintgo', ME.user ? 'MINT' : 'LOG IN & MINT', true) + ovBtn('closeov', 'CLOSE'));
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
    if (m.hatching) {
      s += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;flex:1 1 auto"><img alt="" class="' + (bt < 14 ? 'shake' : 'pop') + '" style="width:140px;height:140px" src="' + robot(m.subject, { preset: m.preset, stage: bt < 14 ? 0 : 1, mood: 'happy' }) + '"><div style="display:flex;flex-direction:column;gap:6px;font-size:13px">';
      ['reading its personality', 'compiling rules', 'hatching', 'replaying last week'].forEach(function (l, i) {
        var dn = bt >= (i + 1) * 7, cur = !dn && bt >= i * 7;
        s += '<span style="color:' + (dn ? '#c6f432' : (cur ? '#d9ff5c' : '#4d5f1c')) + '">' + (dn ? '✓' : (cur ? '›' : '·')) + ' ' + l + '</span>';
      });
      s += '</div></div>';
    } else {
      var wr = winRate(m.trades), risk = Math.min(100, Math.round(m.sim.dd * 100 / st.tune.limit * 100));
      var sk = skillNames().length ? SKILLS.filter(function (k) { return st.skills[k[0]]; }).map(function (k) { return SK_SHORT[k[0]]; }).join(' + ') : '';
      s += '<div style="display:flex;gap:14px;align-items:center"><img alt="' + esc(m.name) + ', your agent" class="' + (m.mood === 'happy' ? 'bob' : '') + '" style="width:120px;height:120px;flex:0 0 auto" src="' + robot(m.subject, { preset: m.preset, stage: m.stage, mood: m.mood }) + '">';
      s += '<div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 auto"><span class="doto scr-name">' + esc(m.name) + '</span><span class="scr-sub">LV ' + m.lvl + ' · ' + (m.mood === 'happy' ? 'HAPPY' : (m.mood === 'sad' ? 'GRUMPY' : 'CALM')) + (m.born && !st.answered ? ' · HUNGRY' : '') + ' · ' + sk + '</span>';
      s += meter('WIN RATE', wr === null ? 0 : wr, wr === null ? '—' : wr + '%', 'Share of closed trades that made money this week');
      s += meter('RISK USED', risk, risk + '%', 'How much of the daily loss limit it has already used', true);
      s += meter('SYNC', m.fedV, m.fedV + '%', 'How well it knows your style. Answer its daily question to raise it');
      s += '<span class="scr-legend">SYNC · answer its daily question and it trades more like you</span></div></div>';
      s += '<div style="flex:1 1 auto;min-height:48px;display:flex;flex-direction:column;gap:4px"><span class="scr-legend" style="display:flex;justify-content:space-between"><span>EQUITY · LAST 7 DAYS</span><span>$1,000 START</span></span><svg aria-hidden="true" viewBox="0 0 300 48" preserveAspectRatio="none" style="width:100%;flex:1 1 auto;min-height:40px;display:block"><line x1="0" y1="' + (m.baseY * 48 / 56).toFixed(1) + '" x2="300" y2="' + (m.baseY * 48 / 56).toFixed(1) + '" stroke="#2f3d12" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><polyline points="' + spark(m.sim.eq, 300, 48) + '" fill="none" stroke="#c6f432" stroke-width="2" vector-effect="non-scaling-stroke"/></svg></div>';
      s += '<p aria-live="polite" class="scr-diary">› “' + esc(m.diary) + '”</p>';
      if (m.born) s += '<span class="scr-legend">READ FROM YOUR WORDS: ' + esc(m.parsed.cues.join(', ').toUpperCase()) + '</span>';
    }
    setHTML('scrMain', s);
    var ov = '';
    if (st.flow === 'login') ov = loginOv();
    else if (st.mintOpen) ov = actionOv(m);
    else if (st.shareOpen && m.born) {
      var tweet = 'I just hatched ' + m.name + ' on ZeroIQ. Free trial run on $1,000 virtual: ' + fmt(m.sim.ret) + '. Now it trades for real. zeroiq.ai';
      ov = ovBox('SHARE CARD', '<div class="scr-card"><img alt="" src="' + robot(m.subject, { preset: m.preset, stage: m.stage, mood: m.mood }) + '"><span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:10px;letter-spacing:.1em;color:#c6f432">JUST HATCHED</span><span class="doto" style="font-size:18px;line-height:1.05;color:#fff">' + esc(m.name) + '</span><span style="font-size:11px;color:#a3a3a0">trial run, $1,000 virtual: <span style="color:' + (m.sim.ret >= 0 ? '#c6f432' : '#ff7a6b') + '">' + fmt(m.sim.ret) + '</span></span></span></div>',
        '<a class="scr-btn on" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(tweet) + '">[ OPEN X ]</a>' + ovBtn('closeov', 'CLOSE'));
    } else if (st.saveOpen) ov = ovBox('ON THE LIST', '<span class="scr-ov-t">We will ping you when Season 0 and minting open.</span>', ovBtn('closeov', 'OK', true));
    else if (m.born && m.done && !st.dismissed) ov = ovBox('! EVOLVE PROPOSAL', '<span class="scr-ov-t">' + esc(m.prop.text) + '</span>', ovBtn('evolve', 'YES', true) + ovBtn('notnow', 'NOT NOW'));
    setHTML('scrOv', ov);
    var ro = function (v, l, c) { return '<div class="dv-kc"><div class="dv-lcd dv-ro"><span class="doto" style="color:' + c + '">' + v + '</span></div><span class="dv-eng">' + l + '</span></div>'; };
    setHTML('dvRead', ro(fmt(m.sim.ret), '7D RETURN', m.sim.ret >= 0 ? '#c6f432' : '#ff7a6b') + ro(('0' + m.trades.length).slice(-2), 'TRADES', '#d9ff5c') + ro((m.sim.dd * 100).toFixed(1) + '%', 'MAX DD', '#d9ff5c'));
    setHTML('dvKeys', kc('<button type="button" class="dv-key dv-round" data-act="flip" aria-label="Tune: flip the device to the control panel">' + TUNE_ICON + '</button>', 'TUNE') +
      kc('<button type="button" class="dv-key dv-round" data-act="replay" aria-label="Replay last week">▶</button>', 'REPLAY') +
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
      kc('<button type="button" class="dv-key dv-sim" data-act="simulate">▶ SIMULATE</button>', 'LAST WEEK') +
      limeKey());
    if (fk) { var n = document.querySelector('#device ' + fk); if (n) n.focus(); }
  }
  function refresh() { if (st.face === 'back') renderBack(); else render(); }
  function flip(to) {
    var el = $('device');
    var swap = function () { st.face = to; buildFace(); if (to === 'back') renderBack(); else render(); };
    if (reduce) { swap(); return; }
    el.style.transition = 'transform .16s ease-in';
    el.style.transform = 'perspective(1400px) rotateY(90deg)';
    setTimeout(function () {
      swap();
      el.style.transition = 'none';
      el.style.transform = 'perspective(1400px) rotateY(-90deg)';
      void el.offsetWidth;
      el.style.transition = 'transform .18s ease-out';
      el.style.transform = 'perspective(1400px) rotateY(0deg)';
    }, 170);
  }

  function bar(label, v, col) {
    return '<div class="mono" style="display:flex;align-items:center;gap:8px;font-size:11px;color:#a3a3a0"><span style="width:56px">' + label + '</span><span style="flex:1 1 auto;height:6px;border-radius:999px;background:#2b2b2b;display:block"><span style="display:block;height:6px;border-radius:999px;width:' + v + '%;background:' + col + '"></span></span></div>';
  }
  function stepBtn(done, cta, act) {
    return '<button type="button" class="btn sm ' + (done ? '' : 'dark') + '" data-act="' + act + '" style="' + (done ? 'border-color:#cfe8d6;color:#0a7f3f;background:#f3faf5' : '') + '">' + cta + '</button>';
  }

  function render() {
    var m = model();
    var p = prompt();
    $('hatchBtn').textContent = m.born ? 'Try another' : 'Try it';
    setHTML('skills', skillsHTML());

    // hero dynamic area
    var hd = '';
    if (/^\s*@\w+/.test(p)) hd += '<span style="font-size:13px;line-height:1.45;color:#4a4a4a;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:10px;padding:8px 12px">Fan-made twin, built from public posts. It is not the real account and does not speak for it.</span>';
    if (!m.born && !m.hatching) {
      hd += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px"><span style="font-size:13px;color:#6b6b6b">Try</span>';
      ['buy the dip on NVDA, stay calm', 'chase green candles, aggressive', 'trade rarely, careful sizing'].forEach(function (t, i) {
        hd += '<button type="button" data-act="idea" data-i="' + i + '" style="font:500 13px Inter,sans-serif;color:#2f2f2f;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:999px;padding:8px 12px;min-height:44px;cursor:pointer">' + t + '</button>';
      });
      hd += '<button type="button" data-act="twin" style="font:600 13px Inter,sans-serif;color:#111;background:#fff;border:1.5px dashed #111;border-radius:999px;padding:8px 14px;min-height:44px;cursor:pointer">or hatch a twin of @any_CT_account</button></div>';
    }
    if (m.born) {
      hd += '<div class="card" style="padding:14px 16px;gap:10px"><span class="eyebrow">Next steps</span>';
      hd += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:15px"><span class="mono" style="color:#6b6b6b;margin-right:8px">' + (st.answered ? '✓' : '1') + '</span>Answer its first question</span>' + stepBtn(st.answered, st.answered ? 'Fed' : 'Answer', 'ask') + '</div>';
      hd += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:15px"><span class="mono" style="color:#6b6b6b;margin-right:8px">' + (st.tg ? '✓' : '2') + '</span>Get its messages in Telegram</span>' + stepBtn(st.tg, st.tg ? 'Soon' : 'Connect', 'tg') + '</div>';
      hd += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:15px"><span class="mono" style="color:#6b6b6b;margin-right:8px">' + (st.joined ? '✓' : '3') + '</span>Mint it and go live</span>' + stepBtn(st.joined, st.joined ? 'On the list' : 'Go live', 'mint') + '</div>';
      if (st.askOpen && !st.answered) {
        hd += '<div style="border-top:1px solid #e5e5e2;padding-top:10px;display:flex;flex-direction:column;gap:8px"><span style="font-size:15px">NVDA reports earnings tomorrow. Hold through it, or sell before?</span><div style="display:flex;gap:8px"><button type="button" class="btn sm" data-act="hold">Hold</button><button type="button" class="btn sm" data-act="sell">Sell before</button></div></div>';
      }
      if (st.tg) hd += '<span style="font-size:13px;color:#4a4a4a">The Telegram bot opens with Season 0. You are on the list.</span>';
      hd += '</div>';
    }
    setHTML('heroDyn', hd);

    // device
    if (!$('dvFace')) buildShell();
    if (st.face !== 'back') frontRender(m);
    $('device').classList.toggle('ro', !!st.readonly);
    if (st.ctx === 'mine' || st.ctx === 'public') setHTML('devNote', 'Sample prices. Live trading opens with Season 0.'); else setHTML('devNote', (m.born ? 'Read from your words: ' + esc(m.parsed.cues.join(', ')) + '. ' : '') + 'The backtest runs on sample prices and simulates spot trades only.');

    // most copied + duel
    setHTML('dying', PUB.slice().sort(function (a, b) { return b.copiers - a.copiers; }).slice(0, 3).map(function (s) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #f1f1ee"><img alt="" style="width:40px;height:40px;background:#0f0f0f;border-radius:8px;flex:0 0 auto" src="' + robot(s.prompt, { preset: s.preset, stage: 3, mood: 'happy' }) + '"><div style="display:flex;flex-direction:column;flex:1 1 auto;min-width:0"><strong style="font-size:15px;font-weight:600">' + esc(s.name) + '</strong><span class="mono" style="font-size:12px;color:#6b6b6b">' + s.copiers + ' copiers · ' + fmt(s.avg) + ' / wk</span></div><a class="btn sm" href="#/agent/' + s.id + '">Copy</a></div>';
    }).join(''));
    setHTML('duel', st.duel ? '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:12px;padding:12px 16px"><span style="font-size:15px">Duel queued: <strong>' + esc((m.born ? m.name : 'your agent') + ' vs ' + st.duel) + '</strong>. Starts with the next round.</span><button type="button" class="btn sm" data-act="duelcancel">Cancel</button></div>' : '');
  }

  function renderStatic() {
    var T = [['DUMBEST', 'Hype Oracle bought TSLA at the top', '−6.8%', '#ff7a6b'], ['HATCHED', 'Zen Goblin, “buy the dip, stay calm”', 'Lv 1', '#fff'], ['COPIED', 'Degen Hamster copied by 263 traders', '', '#fff'], ['EVOLVED', 'Calm Hamster raised patience 60 → 72', 'Lv 5', '#fff'], ['DUEL', 'Lucky Robot beat Feral Gremlin', '+2.1%', '#c6f432'], ['SAMPLE', 'all data on this page is sample data', '', '#fff']];
    var tk = T.concat(T).map(function (t) { return '<span><span style="color:#c6f432">' + t[0] + '</span> ' + t[1] + ' <span style="color:' + t[3] + '">' + t[2] + '</span></span>'; }).join('');
    $('ticker').innerHTML = tk;
    var steps = [['01', 'Describe it', 'One sentence, or the @handle of a CT account you want a twin of. It becomes plain trading rules you can read.', 0, 'ok'], ['02', 'See how it trades', 'Press Try it and it backtests last week in seconds. Every buy, every sell and its excuse. Tune it until you like it.', 1, 'happy'], ['03', 'Mint it or copy one', 'Mint it and it trades for you, or run it in demo mode first. Or open any agent on the leaderboard and copy it. Make as many as you want.', 3, 'happy']];
    $('steps').innerHTML = steps.map(function (s) { return '<article class="card" style="padding:20px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><img alt="" style="width:72px;height:72px;background:#0f0f0f;border-radius:12px" src="' + robot('s', { preset: 3, stage: s[3], mood: s[4] }) + '"><span class="doto" style="font-size:28px;color:#d4d4d0">' + s[0] + '</span></div><strong style="font-size:20px">' + s[1] + '</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">' + s[2] + '</span></article>'; }).join('');
    $('board').innerHTML = SAMPLES.map(function (s, i) {
      return '<div class="row mono" style="padding:10px 0;border-bottom:1px solid #f1f1ee;font-size:13px"><span style="color:#6b6b6b">' + (i + 1) + '</span><img alt="" style="width:36px;height:36px;background:#0f0f0f;border-radius:8px" src="' + robot(s.n, { preset: s.pre, stage: i < 2 ? 3 : 2, mood: s.avg >= 0 ? 'happy' : 'sad' }) + '"><span style="display:flex;flex-direction:column;min-width:0"><strong style="font:600 15px Inter,sans-serif">' + s.n + '</strong><span style="color:#6b6b6b;font-size:12px">' + s.squad + '</span></span><span class="hide-sm" style="text-align:right;color:' + (s.avg >= 0 ? UP : DOWN) + '">' + fmt(s.avg) + '</span><span class="hide-sm" style="text-align:right;color:#4a4a4a">' + s.dd.toFixed(1) + '%</span><span style="text-align:right;font-weight:700">' + s.score.toFixed(0) + '</span></div>';
    }).join('');
    $('agentsGrid').innerHTML = SAMPLES.slice(0, 4).map(function (s, i) {
      var col = s.avg >= 0 ? UP : DOWN;
      return '<article class="card" style="padding:16px"><div style="display:flex;gap:12px;align-items:center"><img alt="" style="width:56px;height:56px;background:#0f0f0f;border-radius:10px;flex:0 0 auto" src="' + robot(s.n, { preset: s.pre, stage: i < 2 ? 3 : 2, mood: s.avg >= 0 ? 'happy' : 'sad' }) + '"><div style="display:flex;flex-direction:column;min-width:0"><strong style="font-size:16px;font-weight:600">' + s.n + '</strong><span class="mono" style="font-size:12px;color:#6b6b6b">Level ' + Math.max(1, 7 - i * 2) + '</span></div></div><span style="font-size:14px;line-height:1.45;color:#4a4a4a;min-height:40px">“' + s.seed + '”</span><svg aria-hidden="true" viewBox="0 0 240 44" preserveAspectRatio="none" style="width:100%;height:44px;display:block"><polyline points="' + spark(s.all, 240, 44) + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="mono" style="display:flex;justify-content:space-between;font-size:12px;color:#6b6b6b"><span>avg / wk <strong style="color:' + col + '">' + fmt(s.avg) + '</strong></span><span>max dd ' + s.dd.toFixed(1) + '%</span></div><div style="display:flex;gap:8px"><a class="btn sm" style="flex:1 1 auto" href="#/agent/' + PUB[i].id + '">Copy</a><button type="button" class="btn dark sm" style="flex:1 1 auto" data-act="duel" data-n="' + s.n + '">Duel</button></div></article>';
    }).join('');
    $('dumbImg').src = robot('Hype Oracle', { preset: 1, stage: 2, mood: 'sad' });
    var ECO = [['Virtuals Protocol', 'Graduate', 'Agents with a proven onchain record launch as tokenized agents that others can back.', 'Planned'], ['Bankr', 'Act from X', 'Tag your agent on X with a command, Bankr-style. Later: hand a graduated agent to a Bankr wallet.', 'Planned'], ['ERC-8004', 'Agent passport', 'Every agent gets an onchain identity and a portable track record other arenas can read.', 'Planned'], ['Telegram', 'Daily question', 'Feed your agent from a chat without opening the site.', 'Season 0'], ['X', 'Share cards + tags', 'Births, deaths and duels ready to post. Tag your agent with a post to feed it.', 'Season 0'], ['Dune', 'Public logs', 'A dashboard where anyone can audit every agent decision.', 'Planned']];
    $('eco').innerHTML = ECO.map(function (e) { var pl = e[3] === 'Planned'; return '<article class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong style="font-size:17px">' + e[0] + '</strong><span class="mono" style="font-size:11px;padding:3px 8px;border-radius:6px;flex:0 0 auto;' + (pl ? 'background:#f1f1ee;color:#4a4a4a' : 'background:#111;color:#c6f432') + '">' + e[3] + '</span></div><span class="eyebrow">' + e[1] + '</span><span style="font-size:14px;line-height:1.5;color:#4a4a4a">' + e[2] + '</span></article>'; }).join('');
    var RM = [['Now', 'Create, copy, go live', 'Try any idea free. Mint an agent for 0.001 ETH, fund its vault and it trades stock tokens on Robinhood Chain within your limits, or run it in demo mode. Copy any agent from the leaderboard.', 'border:1.5px solid #111'], ['Next', 'Squads, duels, X tags', 'Creator-led squads, one-day duels, tag your agent on X to feed it, an ERC-8004 passport for every agent.', 'border:1px solid #e5e5e2'], ['Later', 'Graduate', 'Agents with a proven record can graduate to agent launchpads such as Virtuals Protocol on Robinhood Chain, with hard limits and only after legal review.', 'border:1px dashed #d4d4d0;background:#f7f7f5']];
    $('roadmapGrid').innerHTML = RM.map(function (r) { return '<div style="' + r[3] + ';border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px"><span class="eyebrow">' + r[0] + '</span><strong style="font-size:18px">' + r[1] + '</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">' + r[2] + '</span></div>'; }).join('');
    var FAQ = [['Is this real money?', 'From Season 0, yes. You mint an agent for 0.001 ETH and fund its vault with USDG. The vault is a smart account you own: the agent can only trade inside the limits you set, and you can withdraw any time. You can lose money. Want to watch first? Switch on demo mode in its settings and it trades $1,000 of virtual cash instead. Season 0 is not live yet.'], ['Can I copy someone else’s agent?', 'Yes. Every agent on the leaderboard is an ERC-8004 identity with a public record. Open it, pick copy everything or mirror trades only, choose your size and loss limit, then edit whatever you like. Settings the owner keeps private start in the middle.'], ['How many agents can I have?', 'As many as you want. Each one is its own mint, vault and record.'],  ['Who can play with real money?', 'Stock tokens on Robinhood Chain are not offered in some countries, including the US, UK, Canada and Switzerland. Real-money play follows the same rules, so it is blocked there.'], ['Is it really AI?', 'Partly, on purpose. Your sentence is compiled into plain rules you can read, and code executes them. Once a day an AI reviews the trades and your answers and proposes one change, which you approve or reject.'], ['What is a twin?', 'A fan-made agent built from the public posts of an X account. It is labelled as a twin, it is not the real person, and creators can ask to opt out or claim theirs.'], ['Can I feed my agent from X?', 'Planned for Season 1: tag your agent in a reply to any post and it reads that post as a signal. It never trades on a tag alone; it weighs it inside its rules and limits.'], ['What happens if I forget about it?', 'Nothing bad. It keeps trading inside your limits. The daily question only helps it learn your style, so skipping it means it learns slower. Your money stays in your vault.'], ['How is the score calculated?', 'Average weekly return minus the worst drawdown, scaled to 0–100. A steady agent ranks above one that swung wildly, even if the wild one made more.'], ['How does ZeroIQ make money?', 'Hatching, tuning and the trial run are free. Minting an agent costs 0.001 ETH. Later: skins, sponsored seasons and a small share of trading fees.'], ['What can an agent do onchain?', 'Pick one or more skills when you hatch it: spot trades, limit and stop orders, earning on idle cash, shorts and hedges (2x max), borrowing against stocks, dividend yield, covered income, publishing a basket, and meme tokens. In this preview the replay simulates spot trades only.'], ['What does the mint give me?', 'An onchain agent passport (ERC-8004) on Robinhood Chain, its own vault and a public track record. The vault stays yours: the agent gets a key that can only trade, never withdraw.']];
    $('faqList').innerHTML = FAQ.map(function (q) { return '<details style="padding:16px 0;border-bottom:1px solid #e5e5e2"><summary style="font-size:16px;font-weight:600;display:flex;justify-content:space-between;gap:12px"><span>' + q[0] + '</span><span aria-hidden="true" style="color:#6b6b6b">+</span></summary><p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#4a4a4a;max-width:640px">' + q[1] + '</p></details>'; }).join('');
  }

  // ---------- events ----------
  var IDEAS = ['buy the dip on NVDA, stay calm', 'chase green candles, aggressive', 'trade rarely, careful sizing'];
  var EXAMPLES = [
    'make me rich, make no mistakes',
    'buy the dip on NVDA, stay calm',
    'chase green candles, aggressive, take profits fast',
    'trade rarely, careful sizing, only TSLA and AAPL',
    'short PLTR when it pumps, hedge everything',
    'copy @degen_intern but with half the risk',
    'earn yield on idle cash, buy AMZN on red days',
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
    else if (a === 'idea') startHatch(IDEAS[+b.getAttribute('data-i')]);
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
    else if (a === 'tglink') { if (ME.tg) ME.tg.linked = true; saveMe(); renderMe(); }
    else if (a === 'copycode') { try { navigator.clipboard.writeText('/start ' + (ME.tg ? ME.tg.code : '')); } catch (er) {} b.textContent = 'Copied'; }
    else if (a === 'bfilter') { boardFilter = b.getAttribute('data-v'); renderBoard(); }
    else if (a === 'join' || a === 'save') { if (a === 'save' && !m.born) return; e.preventDefault(); st.mintOpen = false; st.shareOpen = false; st.joined = true; st.saveOpen = st.face !== 'back'; refresh(); if (st.face === 'back') render(); }
    else if (a === 'hold') set({ answered: 'hold', askOpen: false, xp: m.xp + 5, dnaPatch: Object.assign({}, st.dnaPatch || {}, { patience: Math.min(99, m.dna.patience + 5) }) });
    else if (a === 'sell') set({ answered: 'sell', askOpen: false, xp: m.xp + 5, dnaPatch: Object.assign({}, st.dnaPatch || {}, { risk: Math.max(0, m.dna.risk - 10) }) });
    else if (a === 'share') { if (!m.born) return; set({ shareOpen: !st.shareOpen, mintOpen: false, saveOpen: false }); }
    else if (a === 'sound') { snd.on = !snd.on; try { localStorage.setItem('zq-sound', snd.on ? 'on' : 'off'); } catch (er) {} b.setAttribute('aria-checked', snd.on); b.classList.toggle('off', !snd.on); if (snd.on) sfx('switch'); }
    else if (a === 'closeov') { st.flow = null; st.mintOpen = false; st.shareOpen = false; st.saveOpen = false; refresh(); }
    else if (a === 'mode') { st.mode = b.getAttribute('data-m'); st.mintOpen = false; renderBack(); }
    else if (a === 'load') { var fi = $('mdFile'); if (fi) fi.click(); }
    else if (a === 'eject') { st.md = null; $('mdFile').value = ''; renderBack(); }
    else if (a === 'replay') set({ rtick: st.tick, mintOpen: false, shareOpen: false, saveOpen: false, flow: null });
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
      if (st.phase !== 'born') { st.subject = prompt() || currentExample(); st.phase = 'born'; st.xp = 0; }
      st.rtick = st.tick; st.dismissed = false; st.mintOpen = false; st.shareOpen = false; st.saveOpen = false;
      flip('front');
    }
    if (a !== 'logout') saveMine();
  });
  $('prompt').addEventListener('input', function () { render(); });
  function addHandle() {
    var inp = $('xHandle'); if (!inp) return;
    var v = '@' + inp.value.trim().replace(/^@+/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
    if (v.length > 1 && st.tune.handles.length < 3 && st.tune.handles.indexOf(v) < 0) { st.tune.handles.push(v); st.tune.conn.x = true; }
    renderBack(); var n = $('xHandle'); if (n) n.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.target && e.target.id === 'xHandle' && e.key === 'Enter') { e.preventDefault(); addHandle(); } });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    var cp = t.getAttribute('data-copy');
    if (cp) { var sc = t.getAttribute('data-scope'), c = sc === 'pub' ? copyCfg : (st.agentRef && st.agentRef.copyCfg); if (c) { c[cp] = +t.value; var cl = $('cs-' + cp + '-' + sc); if (cl) cl.textContent = cp === 'size' ? t.value + '%' : '−' + t.value + '%'; if (sc === 'my') saveMe(); } return; }
    if (st.readonly) return;
    var k = t.getAttribute('data-dna'), u = t.getAttribute('data-tune'), v = parseInt(t.value, 10) || 0;
    if (!k && !u) return;
    st.preset = null;
    var mn = +t.min || 0, mx = +t.max || 99, cap = $('cap-' + (k || u)); if (cap) cap.style.top = Math.round((1 - (v - mn) / (mx - mn)) * 112) + 'px';
    if (k) { var p = {}; p[k] = v; st.dnaPatch = Object.assign({}, st.dnaPatch || {}, p); var lab = $('tv-' + k); if (lab) lab.textContent = v; }
    if (u === 'limit') { st.tune.limit = v; var tl = $('tv-limit'); if (tl) tl.textContent = '−' + v + '%'; }
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

  // ---------- accounts, my agents, public agents (preview, stored in this browser) ----------
  var ME = { user: null, agents: [], tg: null, pendingCopy: null };
  try { var saved = JSON.parse(localStorage.getItem('zq-me') || 'null'); if (saved) ME = Object.assign(ME, saved); } catch (e) {}
  function saveMe() { try { localStorage.setItem('zq-me', JSON.stringify(ME)); } catch (e) {} }
  function fakeAddr(seed) { var h = hash(seed + 'zq'), s = '0x'; for (var i = 0; i < 40; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; s += '0123456789abcdef'[h % 16]; } return s; }
  function shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }
  function agentStats(dna) {
    var wk = [0, 1, 2, 3].map(function (si) { return equity(prices(si), dna, 48); });
    var avg = wk.reduce(function (s, w) { return s + w.ret; }, 0) / 4, dd = Math.max.apply(null, wk.map(function (w) { return w.dd; })) * 100;
    var all = [], base = 1; wk.forEach(function (w) { w.eq.forEach(function (v) { all.push(base * v); }); base *= w.eq[w.eq.length - 1]; });
    return { avg: avg, dd: dd, score: Math.max(0, Math.min(100, 50 + 10 * (avg - dd))), all: all };
  }
  var WATCH0 = ['NVDA', 'TSLA', 'AAPL', 'AMZN', 'PLTR', 'COIN'];
  function mkWatch(list) { var w = {}; WATCH0.forEach(function (t) { w[t] = list.indexOf(t) >= 0; }); return w; }
  function mkSkills(list) { var s = {}; list.forEach(function (k) { s[k] = true; }); return s; }
  var PUB = [
    ['Zen Goblin', 'buy the dip, patient, calm, careful', 0, [], ['spot', 'orders'], ['NVDA', 'AAPL', 'PLTR'], 8, 212],
    ['Calm Hamster', 'momentum, patient, careful', 2, ['fomo'], ['spot', 'earn'], ['NVDA', 'AMZN'], 6, 97],
    ['Hype Oracle', 'chase green candles, hype, trade often', 1, [], ['spot', 'memes'], ['TSLA', 'COIN'], 15, 54],
    ['Lucky Robot', 'momentum, careful, few trades', 7, ['risk', 'freq'], ['spot'], ['AAPL', 'AMZN', 'NVDA'], 8, 131],
    ['Feral Gremlin', 'yolo, scalp often, chase', 6, ['patience', 'fomo', 'risk', 'freq', 'lean'], ['spot', 'perps', 'memes'], ['TSLA', 'PLTR', 'COIN'], 20, 18],
    ['Quiet Oracle', 'patient long-term, add to winners, careful', 3, [], ['spot', 'dividends'], ['AAPL', 'AMZN'], 5, 176],
    ['Shy Intern', 'trade rarely, careful sizing, only TSLA and AAPL', 4, ['lean'], ['spot', 'orders'], ['TSLA', 'AAPL'], 6, 41],
    ['Degen Hamster', 'make me rich, make no mistakes', 5, ['patience', 'risk'], ['spot', 'memes', 'perps'], ['NVDA', 'TSLA', 'COIN'], 18, 263],
    ['Sleepy Robot', 'buy the dip on NVDA, stay calm', 2, [], ['spot', 'earn'], ['NVDA'], 7, 64],
    ['Tiny Gremlin', 'momentum only, never hold over the weekend', 1, ['freq'], ['spot', 'orders'], ['PLTR', 'COIN', 'TSLA'], 12, 23],
    ['@mira_cap twin', '@mira_cap', 6, ['patience', 'fomo', 'risk', 'freq', 'lean', 'limit'], ['spot', 'basket'], ['NVDA', 'PLTR'], 10, 88],
    ['Hype Intern', 'sell before earnings, rebuy after the drop, quick', 0, ['risk'], ['spot', 'orders', 'perps'], ['NVDA', 'AMZN', 'AAPL'], 9, 12]
  ].map(function (a, i) {
    var p = parse(a[1]).dna, st0 = agentStats(p);
    return { id: 4108 + i * 37, name: a[0], prompt: a[1], preset: a[2], hidden: mkSkills(a[3]), promptPublic: a[3].length < 5, skills: mkSkills(a[4]), watch: mkWatch(a[5]), limit: a[6], copiers: a[7],
      dna: Object.assign({}, p), lean: p.style === 'momentum' ? 72 : 28, conn: {}, handles: [], owner: fakeAddr(a[0]), mode: 'live', avg: st0.avg, dd: st0.dd, score: st0.score, all: st0.all, pub: true };
  });
  function findAgent(id) { id = +id; var a = null; ME.agents.forEach(function (x) { if (x.id === id) a = x; }); PUB.forEach(function (x) { if (x.id === id) a = x; }); return a; }
  function isMine(a) { return a && !a.pub; }

  // load any agent into the one device on the page
  function loadAgent(a, ctx) {
    st.ctx = ctx; st.readonly = ctx === 'public'; st.agentRef = a;
    st.subject = a.prompt; st.phase = 'born'; st.btick = 0; st.rtick = undefined; st.tick = 999;
    st.nameOverride = a.name; st.presetOverride = a.preset;
    st.dnaPatch = Object.assign({}, a.dna); st.skills = Object.assign({}, a.skills);
    st.tune = { limit: a.limit, watch: Object.assign({}, a.watch), conn: Object.assign({}, a.conn || {}), handles: (a.handles || []).slice(), lean: a.lean };
    st.hidden = st.readonly ? (a.hidden || {}) : {}; st.md = a.md || null; st.preset = null; st.xp = a.xp || 0;
    st.face = 'front'; st.mode = 'EQ'; st.mintOpen = st.shareOpen = st.saveOpen = false; st.flow = null; st.dismissed = true; st.answered = st.readonly ? 'hold' : (a.answered || null);
    if ($('dvFace')) buildFace(); render();
  }
  function saveMine() {
    if (st.ctx !== 'mine' || !st.agentRef) return;
    var a = st.agentRef, m = model();
    a.dna = Object.assign({}, m.dna); a.lean = st.tune.lean; a.limit = st.tune.limit; a.watch = Object.assign({}, st.tune.watch); a.skills = Object.assign({}, st.skills);
    a.conn = Object.assign({}, st.tune.conn); a.handles = st.tune.handles.slice(); a.md = st.md ? { name: st.md.name, size: st.md.size, lines: st.md.lines, title: st.md.title } : null; a.xp = st.xp || 0; a.answered = st.answered || null;
    var s0 = agentStats(a.dna); a.avg = s0.avg; a.dd = s0.dd; a.score = s0.score; a.all = s0.all;
    saveMe();
  }
  function newAgentFrom(src, extra) {
    var id = 5001; ME.agents.forEach(function (x) { id = Math.max(id, x.id + 1); });
    var a = Object.assign({ id: id, created: Date.now(), mode: 'live', vault: 0, copiers: 0, notify: { trades: true, question: true, weekly: true }, owner: ME.user ? ME.user.address : '' }, src, extra || {});
    var s0 = agentStats(a.dna); a.avg = s0.avg; a.dd = s0.dd; a.score = s0.score; a.all = s0.all; delete a.pub; delete a.hidden;
    ME.agents.push(a); saveMe(); return a;
  }
  function mintCurrent() {
    var m = model();
    var a = newAgentFrom({ name: m.name, prompt: st.subject || m.subject, preset: m.preset, dna: Object.assign({}, m.dna), lean: st.tune.lean, limit: st.tune.limit, watch: Object.assign({}, st.tune.watch), skills: Object.assign({}, st.skills), conn: Object.assign({}, st.tune.conn), handles: st.tune.handles.slice(), md: st.md ? { name: st.md.name, size: st.md.size, lines: st.md.lines, title: st.md.title } : null });
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
    ['pgHome', 'pgMe', 'pgBoard', 'pgAgent'].forEach(function (id) { var el = $(id); if (el) el.hidden = id !== { home: 'pgHome', me: 'pgMe', board: 'pgBoard', agent: 'pgAgent' }[p]; });
    var sticky = document.querySelector('.sticky'); if (sticky) sticky.style.display = p === 'home' ? '' : 'none';
  }
  function route() {
    var h = location.hash || '';
    var mm = h.match(/^#\/(me|leaderboard|agent)(?:\/(\d+))?/);
    var next = mm ? { me: 'me', leaderboard: 'board', agent: 'agent' }[mm[1]] : 'home';
    if (page === 'home' && next !== 'home') { homeState = JSON.parse(JSON.stringify(st)); delete homeState.agentRef; }
    if (next === 'home') {
      moveDevice('heroDevCol');
      if (page !== 'home') { if (homeState) { Object.keys(st).forEach(function (k) { delete st[k]; }); Object.assign(st, homeState); } st.ctx = 'home'; st.readonly = false; st.hidden = {}; st.agentRef = null; st.nameOverride = null; st.presetOverride = undefined; st.face = 'front'; buildFace(); render(); }
      if (h === '#/') try { window.scrollTo(0, 0); } catch (e) {}
    } else if (next === 'board') {
      renderBoard();
    } else if (next === 'agent') {
      var a = findAgent(mm[2]);
      if (a && isMine(a)) { location.replace('#/me/' + a.id); return; }
      curId = a ? a.id : null; moveDevice('agDevSlot'); if (a) loadAgent(a, 'public'); renderAgentPage(a);
    } else if (next === 'me') {
      var mine = mm[2] ? findAgent(mm[2]) : ME.agents[ME.agents.length - 1];
      if (mine && !isMine(mine)) mine = null;
      curId = mine ? mine.id : null; moveDevice('meDevSlot'); if (ME.user && mine) loadAgent(mine, 'mine');
      renderMe();
    }
    if (next !== 'home') try { window.scrollTo(0, 0); } catch (e) {}
    page = next; show(next); renderHeader();
  }
  window.addEventListener('hashchange', route);
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
    if (!ME.agents.length) { setHTML('meLogin', '<div class="card" style="max-width:520px;gap:12px"><strong style="font-size:20px">No agents yet</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">Describe one in a sentence or copy one from the leaderboard. You can create as many as you want.</span><div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn lime" href="#/">Create an agent</a><a class="btn" href="#/leaderboard">Browse the leaderboard</a></div></div>'); return; }
    setHTML('meLogin', '');
    var a = findAgent(curId); if (!a) return;
    var m = model(), p = '';
    p += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' + ME.agents.map(function (x) { var on = x.id === a.id; return '<a href="#/me/' + x.id + '" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;text-decoration:none;color:#111;border:1.5px solid ' + (on ? '#111' : '#e5e5e2') + ';background:' + (on ? '#f6ffd9' : '#fff') + '"><img alt="" src="' + robot(x.prompt, { preset: x.preset, stage: 2, mood: 'happy' }) + '" style="width:28px;height:28px;background:#0f0f0f;border-radius:50%"><span style="font-size:14px;font-weight:600">' + esc(x.name) + '</span>' + badge(x.mode === 'demo' ? 'DEMO' : 'LIVE', x.mode !== 'demo') + '</a>'; }).join('') + '<a href="#/" class="btn sm">+ New agent</a></div>';
    var rank = boardRows().map(function (r) { return r.id; }).indexOf(a.id) + 1;
    var kpi = function (l, v, c) { return '<div style="border:1px solid #e5e5e2;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px"><span class="mono" style="font-size:11px;color:#6b6b6b">' + l + '</span><span class="mono" style="font-weight:700;font-size:18px;color:' + (c || '#111') + '">' + v + '</span></div>'; };
    var bal = a.mode === 'demo' ? '$' + (1000 * (m.sim.eq[m.sim.eq.length - 1] || 1)).toFixed(0) + ' virtual' : '$' + (a.vault || 0).toFixed(0);
    p += '<div class="card" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><strong style="font-size:20px">' + esc(a.name) + '</strong><span class="mono" style="font-size:12px;color:#6b6b6b">ERC-8004 #' + a.id + (a.copyOf ? ' · copy of <a href="#/agent/' + a.copyOf + '">#' + a.copyOf + '</a>' : '') + '</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">' + kpi(a.mode === 'demo' ? 'DEMO BALANCE' : 'VAULT', bal) + kpi('7-DAY', fmt(m.sim.ret), m.sim.ret >= 0 ? UP : DOWN) + kpi('SCORE', a.score.toFixed(0)) + kpi('RANK', '#' + rank) + '</div>' +
      (a.mode !== 'demo' && !a.vault ? '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#f7f7f5;border-radius:10px;padding:10px 12px"><span style="font-size:14px;color:#4a4a4a">The vault is empty, so the agent is waiting. Fund it or switch on demo mode.</span><button type="button" class="btn sm dark" data-act="deposit">Fund the vault</button></div>' : '') + '</div>';
    p += '<div class="card" style="gap:14px"><span class="eyebrow">Settings</span>' +
      toggleRow('demo', a.mode === 'demo', 'Demo mode', 'Trades $1,000 of virtual cash instead of the vault. Switch it off to go live.') +
      toggleRow('pause', a.paused, 'Pause trading', 'Stops new trades. Open positions stay as they are.') +
      '<span style="font-size:13px;color:#6b6b6b">Personality, risk, markets and signals are on the back of the device: press TUNE.</span></div>';
    if (a.copyOf) {
      var c = a.copyCfg || copyCfg;
      p += '<div class="card" style="gap:12px"><span class="eyebrow">Copying #' + a.copyOf + '</span>' + copyControls(c, 'my') + '</div>';
    }
    if (!a.answered) p += '<div class="card" style="gap:10px"><span class="eyebrow">Today’s question</span><span style="font-size:16px">NVDA reports earnings tomorrow. Hold through it, or sell before?</span><div style="display:flex;gap:8px"><button type="button" class="btn sm" data-act="hold">Hold</button><button type="button" class="btn sm" data-act="sell">Sell before</button></div><span style="font-size:12px;color:#6b6b6b">Your answer tunes how it trades. Skipping is fine, it just learns slower.</span></div>';
    var tg = ME.tg || {};
    p += '<div class="card" style="gap:12px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Telegram</span>' + badge(tg.linked ? 'LINKED' : 'NOT LINKED', tg.linked) + '</div>' +
      (tg.linked ? '<span style="font-size:15px;line-height:1.5">Your agents message you in Telegram. Reply to a question right in the chat.</span>' :
        '<span style="font-size:15px;line-height:1.5">Get trades, the daily question and weekly reports from all your agents in one chat.</span><ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#2f2f2f"><li>Open the ZeroIQ bot in Telegram.</li><li>Send <span class="mono" style="background:#f1f1ee;padding:2px 6px;border-radius:4px">/start ' + (tg.code || '') + '</span></li><li>The bot links this account and every agent on it.</li></ol><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-act="copycode">Copy the command</button><button type="button" class="btn sm" disabled style="opacity:.5;cursor:not-allowed" title="The bot opens with Season 0">Open bot · Season 0</button><button type="button" class="btn sm" data-act="tglink">Preview: mark as linked</button></div>') +
      '<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid #f1f1ee;padding-top:12px">' + toggleRow('notify', a.notify && a.notify.trades, 'Trades', 'A message for every buy and sell.', ' data-k="trades"') + toggleRow('notify', a.notify && a.notify.question, 'Daily question', 'One question a day, answer with a tap.', ' data-k="question"') + toggleRow('notify', a.notify && a.notify.weekly, 'Weekly report', 'Score, rank and the onchain record.', ' data-k="weekly"') + '</div></div>';
    p += '<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Trade history · last 7 days</span><span class="chip">sample prices</span></div>' + tradesTable(m.trades) + '</div>';
    setHTML('mePanel', p);
  }
  function copyControls(c, scope) {
    var opt = function (v, t, d) { var on = c.what === v; return '<button type="button" data-act="copywhat" data-v="' + v + '" data-scope="' + scope + '" aria-pressed="' + on + '" style="flex:1 1 0;text-align:left;cursor:pointer;border-radius:12px;padding:10px 12px;font:inherit;border:1.5px solid ' + (on ? '#111' : '#e5e5e2') + ';background:' + (on ? '#f6ffd9' : '#fff') + '"><strong style="display:block;font-size:14px">' + t + '</strong><span style="font-size:12px;color:#6b6b6b">' + d + '</span></button>'; };
    return '<div style="display:flex;gap:8px;flex-wrap:wrap">' + opt('all', 'Copy everything', 'its settings, markets and skills') + opt('trades', 'Mirror trades only', 'it trades, your vault follows') + '</div>' +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="display:flex;justify-content:space-between;font-size:14px"><span>Size vs. its positions</span><strong class="mono" id="cs-size-' + scope + '">' + c.size + '%</strong></span><input type="range" min="5" max="200" step="5" value="' + c.size + '" data-copy="size" data-scope="' + scope + '" style="accent-color:#111"></label>' +
      '<label style="display:flex;flex-direction:column;gap:6px"><span style="display:flex;justify-content:space-between;font-size:14px"><span>Your loss limit per day</span><strong class="mono" id="cs-maxLoss-' + scope + '">−' + c.maxLoss + '%</strong></span><input type="range" min="3" max="20" value="' + c.maxLoss + '" data-copy="maxLoss" data-scope="' + scope + '" style="accent-color:#ff7a6b"></label>';
  }
  function boardRows() { return PUB.concat(ME.agents.filter(function () { return !!ME.user; })).slice().sort(function (x, y) { return y.score - x.score; }); }
  var boardFilter = 'all';
  function renderBoard() {
    var rows = boardRows().filter(function (a) { return boardFilter === 'all' || (boardFilter === 'public' ? !Object.keys(a.hidden || {}).length : a.copiers > 50); });
    var tabs = [['all', 'All agents'], ['public', 'Fully public settings'], ['copied', 'Most copied']].map(function (t) { var on = boardFilter === t[0]; return '<button type="button" data-act="bfilter" data-v="' + t[0] + '" aria-pressed="' + on + '" class="btn sm" style="' + (on ? 'background:#111;color:#fff;border-color:#111' : '') + '">' + t[1] + '</button>'; }).join('');
    var h = '<div style="display:flex;flex-wrap:wrap;gap:8px">' + tabs + '</div><div class="card" style="gap:0;padding:8px 16px;overflow-x:auto"><div class="mono lb-row" style="font-size:10px;letter-spacing:.06em;color:#6b6b6b;border-bottom:1px solid #e5e5e2"><span>#</span><span>AGENT</span><span class="hide-sm">OWNER</span><span style="text-align:right">AVG / WK</span><span class="hide-sm" style="text-align:right">MAX DD</span><span style="text-align:right">SCORE</span><span class="hide-sm" style="text-align:right">COPIERS</span><span class="hide-sm">SETTINGS</span><span></span></div>';
    rows.forEach(function (a, i) {
      var hid = Object.keys(a.hidden || {}).length, mine = isMine(a);
      h += '<div class="lb-row" style="border-bottom:1px solid #f1f1ee;font-size:14px"><span class="mono" style="color:#6b6b6b">' + (i + 1) + '</span><a href="#/agent/' + a.id + '" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:#111;min-width:0"><img alt="" src="' + robot(a.prompt, { preset: a.preset, stage: 3, mood: a.avg >= 0 ? 'happy' : 'sad' }) + '" style="width:36px;height:36px;background:#0f0f0f;border-radius:8px;flex:0 0 auto"><span style="display:flex;flex-direction:column;min-width:0"><strong style="font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(a.name) + (mine ? ' ' + badge('YOU', true) : '') + '</strong><span class="mono" style="font-size:11px;color:#6b6b6b">8004 #' + a.id + '</span></span></a>' +
        '<span class="mono hide-sm" style="font-size:12px;color:#4a4a4a">' + shortAddr(a.owner) + '</span><span class="mono" style="text-align:right;color:' + (a.avg >= 0 ? UP : DOWN) + '">' + fmt(a.avg) + '</span><span class="mono hide-sm" style="text-align:right;color:#4a4a4a">' + a.dd.toFixed(1) + '%</span><span class="mono" style="text-align:right;font-weight:700">' + a.score.toFixed(0) + '</span><span class="mono hide-sm" style="text-align:right">' + (a.copiers || 0) + '</span><span class="hide-sm">' + badge(hid ? hid + ' PRIVATE' : 'PUBLIC', !hid) + '</span><a class="btn sm" href="#/agent/' + a.id + '">Open</a></div>';
    });
    h += '</div>';
    setHTML('boardBody', h);
  }
  function renderAgentPage(a) {
    if (!a) { setHTML('agInfo', '<div class="card"><strong>Agent not found</strong><a href="#/leaderboard">Back to the leaderboard</a></div>'); return; }
    var hid = Object.keys(a.hidden || {}), m = model();
    var kpi = function (l, v, c) { return '<div style="border:1px solid #e5e5e2;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px"><span class="mono" style="font-size:11px;color:#6b6b6b">' + l + '</span><span class="mono" style="font-weight:700;font-size:18px;color:' + (c || '#111') + '">' + v + '</span></div>'; };
    var rank = boardRows().map(function (r) { return r.id; }).indexOf(a.id) + 1;
    var p = '<a href="#/leaderboard" style="font-size:14px;color:#4a4a4a">← Leaderboard</a>';
    p += '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Agent · ERC-8004 #' + a.id + '</span><h2 style="margin:0">' + esc(a.name) + '</h2><span class="mono" style="font-size:13px;color:#4a4a4a">owner ' + shortAddr(a.owner) + ' · ' + (a.copiers || 0) + ' copiers · rank #' + rank + '</span></div>';
    p += '<div class="card" style="gap:8px"><span class="eyebrow">Personality</span><span style="font-size:17px;line-height:1.45">' + (a.promptPublic ? '“' + esc(a.prompt) + '”' : '<span style="color:#6b6b6b">The owner keeps the prompt private.</span>') + '</span>' +
      '<span style="font-size:13px;line-height:1.5;color:#6b6b6b">' + (hid.length ? 'Not shared: ' + hid.join(', ') + '. On the device these show as grey, centred faders. ' : 'All settings are public. ') + 'Press TUNE on the device to see them.</span></div>';
    p += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">' + kpi('AVG / WEEK', fmt(a.avg), a.avg >= 0 ? UP : DOWN) + kpi('MAX DD', a.dd.toFixed(1) + '%') + kpi('SCORE', a.score.toFixed(0)) + kpi('TRADES · 7D', m.trades.length) + '</div>';
    p += '<div class="card" id="copyPanel" style="gap:14px;border:1.5px solid #111"><span class="eyebrow">Copy this agent</span><span style="font-size:15px;line-height:1.5;color:#2f2f2f">You get your own agent with its own vault. Change anything after you copy.</span>' + copyControls(copyCfg, 'pub') + '<button type="button" class="btn lime" data-act="copy" data-id="' + a.id + '">Copy &amp; edit</button><span style="font-size:12px;color:#6b6b6b">Private settings start in the middle. You set them yourself.</span></div>';
    p += '<div class="card" style="gap:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Trade history · last 7 days</span><span class="chip">sample prices</span></div>' + tradesTable(m.trades) + '</div>';
    setHTML('agInfo', p);
  }

  st.ctx = 'home';
  renderStatic();
  render();
  route();
  try { $('ghostImg1').src = robot('make me rich', { preset: 5, stage: 2, mood: 'happy' }); $('ghostImg2').src = robot('quiet oracle', { preset: 3, stage: 3, mood: 'ok' }); } catch (e) {}
  if (!reduce) setTimeout(typeTick, 600); else $('prompt').placeholder = EXAMPLES[0];
  if (!reduce) {
    setInterval(function () {
      if (st.phase === 'hatching') {
        var b = (st.btick || 0) + 1;
        if (b >= 28) { st.phase = 'born'; st.btick = 0; st.tick = 0; } else { st.btick = b; st.tick++; }
      } else if (st.phase === 'born') {
        st.tick++;
      } else st.tick = st.tick > 150 ? 0 : st.tick + 1;
      // don't re-render while user is typing an X-share / focused inside device buttons
      render();
    }, 140);
  }
})();
