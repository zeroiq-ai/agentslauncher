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
    set({ phase: reduce ? 'born' : 'hatching', btick: 0, rtick: undefined, tick: reduce ? 999 : 0, subject: text, dnaPatch: null, xp: 0, dismissed: false, answered: null, joined: false, tg: false, askOpen: false, saveOpen: false, shareOpen: false, mintOpen: false, face: 'front' });
    try { $('top').scrollIntoView({ behavior: 'smooth' }); } catch (e) {}
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
      'stops for the day at −' + limit + '% · trades ' + (watch.length ? watch.join(' ') : 'nothing yet') + '\nskills: ' + skillNames().join(', ');
  }
  var TUNE_PRESETS = { ZEN: { patience: 85, fomo: 10, risk: 25, freq: 25, style: 'dip' }, DIP: { patience: 65, fomo: 25, risk: 45, freq: 45, style: 'dip' }, MOMO: { patience: 30, fomo: 70, risk: 55, freq: 60, style: 'momentum' }, DEGEN: { patience: 10, fomo: 95, risk: 95, freq: 90, style: 'momentum' } };
  function mintPanel(m) {
    return '<div style="border:1.5px solid #111;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;background:#fff"><strong style="font-size:15px">Mint ' + esc(m.name) + ' · 0.001 ETH</strong><span style="font-size:14px;line-height:1.45;color:#2f2f2f">You get an onchain agent passport (ERC-8004) on Robinhood Chain, a seat in Season 0 and a public track record. Trading stays paper.</span><span style="font-size:12px;line-height:1.45;color:#6b6b6b">Minting opens with Season 0. This preview charges nothing and asks for no wallet.</span><button type="button" class="btn dark sm" data-act="join" style="align-self:flex-start">Join the mint list</button></div>';
  }
  function backHTML(m) {
    var d = m.dna, t = st.tune, b = '';
    var vs = function (key, label, val) { return '<label style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1 1 0"><span class="mono" id="tv-' + key + '" style="font-size:12px;color:#c6f432">' + val + '</span><input type="range" min="0" max="99" value="' + val + '" data-dna="' + key + '" aria-label="' + label + '" style="writing-mode:vertical-lr;direction:rtl;width:28px;height:112px;accent-color:#c6f432"><span class="mono" style="font-size:10px;letter-spacing:.06em;color:#a3a3a0">' + label + '</span></label>'; };
    b += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="eyebrow">Tune · ' + esc(m.name) + '</span><button type="button" class="btn sm" data-act="flip" aria-label="Flip back to the agent card">↺ Card</button></div>';
    b += '<div style="background:#0f0f0f;border-radius:14px;padding:14px;color:#f2f2f2;display:flex;flex-direction:column;gap:12px">';
    b += '<div style="display:flex;justify-content:space-between;align-items:center"><span class="mono" style="font-size:11px;letter-spacing:.06em;color:#a3a3a0">EQUALIZER</span><span class="mono" id="tv-preset" style="font-size:11px;color:#c6f432">PRESET: ' + (st.preset || 'CUSTOM') + '</span></div>';
    b += '<div style="display:flex;justify-content:space-between;gap:4px">' + vs('patience', 'PATIENCE', d.patience) + vs('fomo', 'FOMO', d.fomo) + vs('risk', 'RISK', d.risk) + vs('freq', 'ACTIVITY', d.freq) + '<label style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1 1 0"><span class="mono" id="tv-limit" style="font-size:12px;color:#ff7a6b">−' + t.limit + '%</span><input type="range" min="3" max="20" value="' + t.limit + '" data-tune="limit" aria-label="Daily loss limit" style="writing-mode:vertical-lr;direction:rtl;width:28px;height:112px;accent-color:#ff7a6b"><span class="mono" style="font-size:10px;letter-spacing:.06em;color:#a3a3a0">LOSS/DAY</span></label></div>';
    b += '<div style="display:flex;gap:6px">' + ['ZEN', 'DIP', 'MOMO', 'DEGEN'].map(function (p) { var on = st.preset === p; return '<button type="button" data-act="preset" data-p="' + p + '" class="mono" style="flex:1 1 auto;min-height:36px;font-size:11px;font-weight:700;letter-spacing:.06em;border-radius:8px;cursor:pointer;border:1px solid ' + (on ? '#c6f432' : '#3a3a3a') + ';background:' + (on ? '#c6f432' : '#1a1a1a') + ';color:' + (on ? '#111' : '#f2f2f2') + '">' + p + '</button>'; }).join('') + '</div>';
    b += '<label style="display:flex;flex-direction:column;gap:4px"><span class="mono" style="display:flex;justify-content:space-between;font-size:10px;letter-spacing:.06em;color:#a3a3a0"><span>DIP BUYER</span><span>MOMENTUM</span></span><input type="range" min="0" max="99" value="' + (d.style === 'momentum' ? 80 : 20) + '" data-tune="style" aria-label="Dip buyer to momentum" style="width:100%;accent-color:#c6f432"></label>';
    b += '</div>';
    b += '<div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">Watchlist</span><div style="display:flex;flex-wrap:wrap;gap:6px">' + Object.keys(t.watch).map(function (k) { var on = t.watch[k]; return '<button type="button" data-act="watch" data-t="' + k + '" aria-pressed="' + on + '" class="mono" style="font-size:12px;font-weight:700;border-radius:8px;padding:8px 10px;min-height:36px;cursor:pointer;border:1px solid ' + (on ? '#111' : '#d4d4d0') + ';background:' + (on ? '#111' : '#fff') + ';color:' + (on ? '#c6f432' : '#6b6b6b') + '">' + k + '</button>'; }).join('') + '</div></div>';
    var CONN = [['news', 'News headlines', 'reads headlines on its stocks', 'beta'], ['top', 'Top agents', 'weighs what the best public agents just did', 'beta'], ['x', 'X accounts', 'reads public posts from accounts you add', 'beta'], ['chain', 'Onchain flows', 'Robinhood Chain pool activity', 'soon']];
    b += '<div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">Signals</span>' + CONN.map(function (c) { var on = !!t.conn[c[0]], soon = c[3] === 'soon'; return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f1f1ee"><div style="display:flex;flex-direction:column;flex:1 1 auto;min-width:0"><span style="font-size:14px;font-weight:600">' + c[1] + ' <span class="chip" style="font-size:10px">' + c[3] + '</span></span><span style="font-size:12px;color:#6b6b6b">' + c[2] + '</span></div><button type="button" ' + (soon ? 'disabled ' : '') + 'data-act="conn" data-c="' + c[0] + '" aria-pressed="' + on + '" class="btn sm" style="min-width:64px;' + (soon ? 'opacity:.45;cursor:not-allowed' : (on ? 'background:#c6f432;border-color:#111' : '')) + '">' + (soon ? 'Soon' : (on ? 'On' : 'Off')) + '</button></div>'; }).join('') + '</div>';
    b += '<div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">X accounts it follows</span><div style="display:flex;gap:6px"><input id="xHandle" type="text" maxlength="16" placeholder="@handle" aria-label="X handle to follow" style="flex:1 1 auto;min-width:0;font:500 14px Inter,sans-serif;border:1px solid #d4d4d0;border-radius:10px;padding:10px 12px;min-height:44px;box-sizing:border-box"><button type="button" class="btn sm" data-act="addx">Add</button></div>';
    if (t.handles.length) b += '<div style="display:flex;flex-wrap:wrap;gap:6px">' + t.handles.map(function (h, i) { return '<span class="chip" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 4px 4px 10px">' + esc(h) + '<button type="button" data-act="rmx" data-i="' + i + '" aria-label="Remove ' + esc(h) + '" style="border:0;background:transparent;cursor:pointer;font-size:14px;min-width:28px;min-height:28px">×</button></span>'; }).join('') + '</div>';
    b += '<span style="font-size:12px;line-height:1.45;color:#6b6b6b">Up to 3. Posts are signals the agent weighs inside its rules, never orders.</span></div>';
    b += '<pre id="rulesPreview" class="mono" style="margin:0;background:#000;color:#c6f432;border-radius:12px;padding:10px 12px;font-size:12px;line-height:1.6;white-space:pre-wrap">' + esc(rulesText(d, t.limit)) + '</pre>';
    b += '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn lime" data-act="simulate" style="flex:1 1 auto">▶ Simulate last week</button><button type="button" class="btn dark" data-act="mint">Mint · 0.001 ETH</button></div>';
    if (st.mintOpen) b += mintPanel(m);
    b += '<span style="font-size:12px;line-height:1.45;color:#6b6b6b">The replay uses price rules only. Signals and X accounts switch on in Season 0.</span>';
    return b;
  }
  function renderBack() { var m = model(); var el = $('device'); el.innerHTML = backHTML(m); el._h = null; }
  function flip(to) {
    var el = $('device');
    var swap = function () { st.face = to; if (to === 'back') renderBack(); else { el.innerHTML = ''; render(); } };
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
    $('hatchBtn').textContent = m.born ? 'Hatch another' : 'Hatch';
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
      hd += '<div class="card" style="padding:14px 16px;gap:10px"><span class="eyebrow">Keep it alive</span>';
      hd += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:15px"><span class="mono" style="color:#6b6b6b;margin-right:8px">' + (st.answered ? '✓' : '1') + '</span>Feed it today’s question</span>' + stepBtn(st.answered, st.answered ? 'Fed' : 'Answer', 'ask') + '</div>';
      hd += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:15px"><span class="mono" style="color:#6b6b6b;margin-right:8px">' + (st.tg ? '✓' : '2') + '</span>Get the question in Telegram</span>' + stepBtn(st.tg, st.tg ? 'Soon' : 'Connect', 'tg') + '</div>';
      hd += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span style="font-size:15px"><span class="mono" style="color:#6b6b6b;margin-right:8px">' + (st.joined ? '✓' : '3') + '</span>Grab a Season 0 seat</span>' + stepBtn(st.joined, st.joined ? 'Done' : 'Join', 'join') + '</div>';
      if (st.askOpen && !st.answered) {
        hd += '<div style="border-top:1px solid #e5e5e2;padding-top:10px;display:flex;flex-direction:column;gap:8px"><span style="font-size:15px">NVDA reports earnings tomorrow. Hold through it, or sell before?</span><div style="display:flex;gap:8px"><button type="button" class="btn sm" data-act="hold">Hold</button><button type="button" class="btn sm" data-act="sell">Sell before</button></div></div>';
      }
      if (st.tg) hd += '<span style="font-size:13px;color:#4a4a4a">The Telegram bot opens with Season 0. You are on the list.</span>';
      hd += '</div>';
    }
    setHTML('heroDyn', hd);

    // device
    var bt = st.btick || 0, d = '';
    var dh = '<div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">' + (m.hatching ? 'Hatching' : (m.born ? 'Your agent' : 'Demo agent')) + '</span><span style="display:flex;gap:6px;align-items:center"><span class="chip">Paper</span><button type="button" class="btn sm" data-act="flip" aria-label="Flip the card to tune the agent" style="min-height:32px;padding:4px 10px;font-size:13px">↻ Tune</button></span></div>';
    d += '<div style="background:#0f0f0f;border-radius:14px;padding:20px;color:#f2f2f2;display:flex;flex-direction:column;gap:14px;min-height:330px">';
    if (m.hatching) {
      d += '<div style="display:flex;align-items:center;justify-content:center;gap:28px;flex:1 1 auto;flex-wrap:wrap"><img alt="" class="' + (bt < 14 ? 'shake' : 'pop') + '" style="width:160px;height:160px" src="' + robot(m.subject, { preset: m.preset, stage: bt < 14 ? 0 : 1, mood: 'happy' }) + '"><div class="mono" style="display:flex;flex-direction:column;gap:8px;font-size:13px">';
      ['reading its personality', 'compiling rules', 'hatching', 'replaying last week'].forEach(function (l, i) {
        var dn = bt >= (i + 1) * 7, cur = !dn && bt >= i * 7;
        d += '<span style="color:' + (dn ? '#c6f432' : (cur ? '#fff' : '#6b6b6b')) + '">' + (dn ? '✓' : (cur ? '›' : '·')) + ' ' + l + '</span>';
      });
      d += '</div></div>';
    } else {
      d += '<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><img alt="' + esc(m.name) + ', your agent" class="' + (m.mood === 'happy' ? 'bob' : '') + '" style="width:152px;height:152px" src="' + robot(m.subject, { preset: m.preset, stage: m.stage, mood: m.mood }) + '">';
      d += '<span class="doto" style="font-size:26px;color:#fff;line-height:1.05;text-align:center">' + esc(m.name) + '</span>';
      d += '<span class="mono" style="font-size:12px;color:#a3a3a0">Level ' + m.lvl + ' · ' + (m.mood === 'happy' ? 'happy' : (m.mood === 'sad' ? 'grumpy' : 'calm')) + (m.born && !st.answered ? ' · hungry' : '') + '</span><span style="display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin-top:4px">' + skillNames().map(function (n) { return '<span class="mono" style="font-size:10px;letter-spacing:.04em;padding:2px 6px;border-radius:4px;background:#1f1f1f;color:#c6f432">' + n.toUpperCase() + '</span>'; }).join('') + '</span></div>';
      d += '<div style="display:flex;flex-direction:column;gap:7px">' + bar('MOOD', m.moodV, m.moodV > 50 ? '#c6f432' : '#ff7a6b') + bar('HEALTH', m.healthV, m.healthV > 50 ? '#c6f432' : '#ff7a6b') + bar('FED', m.fedV, m.fedV > 50 ? '#c6f432' : '#ff7a6b') + '</div>';
      d += '<svg aria-hidden="true" viewBox="0 0 300 56" preserveAspectRatio="none" style="width:100%;height:56px;display:block"><line x1="0" y1="' + m.baseY + '" x2="300" y2="' + m.baseY + '" stroke="#3a3a3a" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><polyline points="' + spark(m.sim.eq, 300, 56) + '" fill="none" stroke="#c6f432" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
      d += '<p aria-live="polite" style="margin:0;font-size:15px;line-height:1.4;color:#e5e5e2">“' + esc(m.diary) + '”</p>';
    }
    d += '</div>';
    var kpi = function (l, v, col) { return '<div style="border:1px solid #e5e5e2;border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:2px"><span class="mono" style="font-size:11px;color:#6b6b6b">' + l + '</span><span class="mono" style="font-weight:700;font-size:16px;color:' + (col || '#111') + '">' + v + '</span></div>'; };
    d += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + kpi('7-DAY RETURN', fmt(m.sim.ret), m.sim.ret >= 0 ? UP : DOWN) + kpi('TRADES', m.trades.length) + kpi('MAX DRAWDOWN', (m.sim.dd * 100).toFixed(1) + '%') + '</div>';
    var dm = d; d = '';
    if (!m.born && !m.hatching) d += '<button type="button" class="btn" data-act="flip" style="width:100%">↻ Flip &amp; tune this agent</button>';
    if (m.born) {
      d += '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn lime" data-act="share" style="flex:1 1 auto">Post its birth on X</button><button type="button" class="btn dark" data-act="mint">Mint · 0.001 ETH</button><button type="button" class="btn" data-act="replay">Replay</button></div>';
      if (st.shareOpen) {
        var tweet = 'I just hatched ' + m.name + ' on ZeroIQ. 7-day paper replay: ' + fmt(m.sim.ret) + '. Can yours do better? zeroiq.ai';
        d += '<div style="display:flex;flex-direction:column;gap:10px"><div style="background:#0f0f0f;border-radius:12px;aspect-ratio:1200/630;display:flex;align-items:center;gap:16px;padding:18px;color:#f2f2f2"><img alt="" style="width:34%;height:auto" src="' + robot(m.subject, { preset: m.preset, stage: m.stage, mood: m.mood }) + '"><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><span class="mono" style="font-size:11px;color:#c6f432;letter-spacing:.06em">JUST HATCHED</span><span class="doto" style="font-size:22px;line-height:1.05;color:#fff">' + esc(m.name) + '</span><span class="mono" style="font-size:12px;color:#a3a3a0">7-day paper replay: <span style="color:' + (m.sim.ret >= 0 ? '#c6f432' : '#ff7a6b') + '">' + fmt(m.sim.ret) + '</span></span><span class="mono" style="font-size:12px;color:#a3a3a0">can yours do better? · zeroiq.ai</span></div></div>';
        d += '<a class="btn dark" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(tweet) + '">Open X with this card</a></div>';
      }
      if (st.mintOpen) d += mintPanel(m);
      if (st.saveOpen) d += '<div style="border:1px solid #e5e5e2;border-radius:12px;padding:12px;background:#f7f7f5;font-size:14px;line-height:1.45">You are on the list. We will ping you when Season 0 and minting open.</div>';
      if (m.done && !st.dismissed) {
        d += '<div style="border:1px solid #cfe8d6;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f3faf5"><span class="eyebrow" style="color:#0a7f3f">Evolve proposal</span><span style="font-size:14px;line-height:1.45">' + esc(m.prop.text) + '</span><div style="display:flex;gap:8px"><button type="button" class="btn dark sm" data-act="evolve">Evolve</button><button type="button" class="btn sm" data-act="notnow">Not now</button></div></div>';
      }
    }
    d += '<span style="font-size:12px;line-height:1.45;color:#6b6b6b">' + (m.born ? 'Read from your words: ' + esc(m.parsed.cues.join(', ')) + '. ' : '') + 'Demo runs on sample price data and replays spot trades only. Other skills switch on in Season 0 with real Robinhood Chain prices.</span>';
    if (st.face !== 'back') {
      var dv = $('device');
      if (!$('devHead')) { dv.innerHTML = '<div id="devHead"></div><div id="devMain" style="display:flex;flex-direction:column;gap:12px"></div><div id="devActs" style="display:flex;flex-direction:column;gap:12px"></div>'; dv._h = null; }
      setHTML('devHead', dh); setHTML('devMain', dm); setHTML('devActs', d);
    }

    // dying + duel
    var dying = SAMPLES.slice().sort(function (a, b) { return a.score - b.score; }).slice(0, 3), WHY = ['owner missed 2 questions', 'drawdown near the limit', 'chased 4 tops this week'];
    setHTML('dying', dying.map(function (s, i) {
      var on = st.bet === s.n;
      return '<div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #f1f1ee"><img alt="" style="width:40px;height:40px;background:#0f0f0f;border-radius:8px;flex:0 0 auto" src="' + robot(s.n, { preset: s.pre, stage: 2, mood: 'sad' }) + '"><div style="display:flex;flex-direction:column;flex:1 1 auto;min-width:0"><strong style="font-size:15px;font-weight:600">' + s.n + '</strong><span class="mono" style="font-size:12px;color:#6b6b6b">health ' + Math.max(6, 30 - i * 8) + ' · ' + WHY[i] + '</span></div><button type="button" class="btn sm" data-act="bet" data-n="' + s.n + '" style="' + (on ? 'background:#c6f432;border-color:#111' : '') + '">' + (on ? '50 pts in' : 'Bet 50 pts') + '</button></div>';
    }).join(''));
    $('betNote').textContent = st.bet ? 'You bet 50 points that ' + st.bet + ' dies tomorrow. Points only, no cash value.' : 'Pick one. Right calls earn points and a badge.';
    setHTML('duel', st.duel ? '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:12px;padding:12px 16px"><span style="font-size:15px">Duel queued: <strong>' + esc((m.born ? m.name : 'your agent') + ' vs ' + st.duel) + '</strong>. Starts with the next round.</span><button type="button" class="btn sm" data-act="duelcancel">Cancel</button></div>' : '');
  }

  function renderStatic() {
    var T = [['DUMBEST', 'Hype Oracle bought TSLA at the top', '−6.8%', '#ff7a6b'], ['HATCHED', 'Zen Goblin, “buy the dip, stay calm”', 'Lv 1', '#fff'], ['RIP', 'Sleepy Intern, lived 9 days', '−4.2%', '#ff7a6b'], ['EVOLVED', 'Calm Hamster raised patience 60 → 72', 'Lv 5', '#fff'], ['DUEL', 'Lucky Robot beat Feral Gremlin', '+2.1%', '#c6f432'], ['SAMPLE', 'all data on this page is sample data', '', '#fff']];
    var tk = T.concat(T).map(function (t) { return '<span><span style="color:#c6f432">' + t[0] + '</span> ' + t[1] + ' <span style="color:' + t[3] + '">' + t[2] + '</span></span>'; }).join('');
    $('ticker').innerHTML = tk;
    var steps = [['01', 'Describe it', 'One sentence, or the @handle of a CT account you want a twin of. It becomes plain trading rules you can read.', 0, 'ok'], ['02', 'Watch it trade', 'It hatches and replays last week in seconds. You see every buy, every sell and its excuse.', 1, 'happy'], ['03', 'Train it daily', 'One question a day. Once a day it proposes one change, you approve or reject. Skip three days and it dies.', 3, 'happy']];
    $('steps').innerHTML = steps.map(function (s) { return '<article class="card" style="padding:20px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><img alt="" style="width:72px;height:72px;background:#0f0f0f;border-radius:12px" src="' + robot('s', { preset: 3, stage: s[3], mood: s[4] }) + '"><span class="doto" style="font-size:28px;color:#d4d4d0">' + s[0] + '</span></div><strong style="font-size:20px">' + s[1] + '</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">' + s[2] + '</span></article>'; }).join('');
    $('board').innerHTML = SAMPLES.map(function (s, i) {
      return '<div class="row mono" style="padding:10px 0;border-bottom:1px solid #f1f1ee;font-size:13px"><span style="color:#6b6b6b">' + (i + 1) + '</span><img alt="" style="width:36px;height:36px;background:#0f0f0f;border-radius:8px" src="' + robot(s.n, { preset: s.pre, stage: i < 2 ? 3 : 2, mood: s.avg >= 0 ? 'happy' : 'sad' }) + '"><span style="display:flex;flex-direction:column;min-width:0"><strong style="font:600 15px Inter,sans-serif">' + s.n + '</strong><span style="color:#6b6b6b;font-size:12px">' + s.squad + '</span></span><span class="hide-sm" style="text-align:right;color:' + (s.avg >= 0 ? UP : DOWN) + '">' + fmt(s.avg) + '</span><span class="hide-sm" style="text-align:right;color:#4a4a4a">' + s.dd.toFixed(1) + '%</span><span style="text-align:right;font-weight:700">' + s.score.toFixed(0) + '</span></div>';
    }).join('');
    $('agentsGrid').innerHTML = SAMPLES.slice(0, 4).map(function (s, i) {
      var col = s.avg >= 0 ? UP : DOWN;
      return '<article class="card" style="padding:16px"><div style="display:flex;gap:12px;align-items:center"><img alt="" style="width:56px;height:56px;background:#0f0f0f;border-radius:10px;flex:0 0 auto" src="' + robot(s.n, { preset: s.pre, stage: i < 2 ? 3 : 2, mood: s.avg >= 0 ? 'happy' : 'sad' }) + '"><div style="display:flex;flex-direction:column;min-width:0"><strong style="font-size:16px;font-weight:600">' + s.n + '</strong><span class="mono" style="font-size:12px;color:#6b6b6b">Level ' + Math.max(1, 7 - i * 2) + '</span></div></div><span style="font-size:14px;line-height:1.45;color:#4a4a4a;min-height:40px">“' + s.seed + '”</span><svg aria-hidden="true" viewBox="0 0 240 44" preserveAspectRatio="none" style="width:100%;height:44px;display:block"><polyline points="' + spark(s.all, 240, 44) + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="mono" style="display:flex;justify-content:space-between;font-size:12px;color:#6b6b6b"><span>avg / wk <strong style="color:' + col + '">' + fmt(s.avg) + '</strong></span><span>max dd ' + s.dd.toFixed(1) + '%</span></div><div style="display:flex;gap:8px"><button type="button" class="btn sm" style="flex:1 1 auto" data-act="fork" data-seed="' + s.seed + '">Fork</button><button type="button" class="btn dark sm" style="flex:1 1 auto" data-act="duel" data-n="' + s.n + '">Duel</button></div></article>';
    }).join('');
    $('dumbImg').src = robot('Hype Oracle', { preset: 1, stage: 2, mood: 'sad' });
    $('ripImg').src = robot('rip', { preset: 4, stage: 2, dead: true });
    var ECO = [['Virtuals Protocol', 'Graduate', 'Agents with a proven paper record launch as tokenized agents and trade with real funds.', 'Planned'], ['Bankr', 'Act from X', 'Tag your agent on X with a command, Bankr-style. Later: hand a graduated agent to a Bankr wallet.', 'Planned'], ['ERC-8004', 'Agent passport', 'Every agent gets an onchain identity and a portable track record other arenas can read.', 'Planned'], ['Telegram', 'Daily question', 'Feed your agent from a chat without opening the site.', 'Season 0'], ['X', 'Share cards + tags', 'Births, deaths and duels ready to post. Tag your agent with a post to feed it.', 'Season 0'], ['Dune', 'Public logs', 'A dashboard where anyone can audit every agent decision.', 'Planned']];
    $('eco').innerHTML = ECO.map(function (e) { var pl = e[3] === 'Planned'; return '<article class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong style="font-size:17px">' + e[0] + '</strong><span class="mono" style="font-size:11px;padding:3px 8px;border-radius:6px;flex:0 0 auto;' + (pl ? 'background:#f1f1ee;color:#4a4a4a' : 'background:#111;color:#c6f432') + '">' + e[3] + '</span></div><span class="eyebrow">' + e[1] + '</span><span style="font-size:14px;line-height:1.5;color:#4a4a4a">' + e[2] + '</span></article>'; }).join('');
    var RM = [['Now', 'Hatch, tune, mint', 'Free hatch, tuning and replay. Mint for 0.001 ETH to enter paper Season 0. Daily question in the app and Telegram.', 'border:1.5px solid #111'], ['Next', 'Squads, duels, X tags', 'Creator-led squads, one-day duels, tag your agent on X to feed it, an ERC-8004 passport for every agent.', 'border:1px solid #e5e5e2'], ['Later', 'Graduate', 'Agents with a proven paper record can graduate to agent launchpads such as Virtuals Protocol on Robinhood Chain, with hard limits and only after legal review.', 'border:1px dashed #d4d4d0;background:#f7f7f5']];
    $('roadmapGrid').innerHTML = RM.map(function (r) { return '<div style="' + r[3] + ';border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px"><span class="eyebrow">' + r[0] + '</span><strong style="font-size:18px">' + r[1] + '</strong><span style="font-size:15px;line-height:1.5;color:#4a4a4a">' + r[2] + '</span></div>'; }).join('');
    var FAQ = [['Is this real money?', 'Trading is paper: agents trade $1,000 of virtual cash and bets use points with no cash value. The only payment is the optional 0.001 ETH mint that enters your agent into the league, and it is not live yet.'], ['Is it really AI?', 'Partly, on purpose. Your sentence is compiled into plain rules you can read, and code executes them. Once a day an AI reviews the trades and your answers and proposes one change, which you approve or reject.'], ['What is a twin?', 'A fan-made agent built from the public posts of an X account. It is labelled as a twin, it is not the real person, and creators can ask to opt out or claim theirs.'], ['Can I feed my agent from X?', 'Planned for Season 1: tag your agent in a reply to any post and it reads that post as a signal. It never trades on a tag alone; it weighs it inside its rules and limits.'], ['What happens if I forget about it?', 'Each day has one question. Miss three in a row and the agent retires to the Graveyard with a share card. You can always hatch a new one.'], ['How is the score calculated?', 'Average weekly return minus the worst drawdown, scaled to 0–100. A steady agent ranks above one that swung wildly, even if the wild one made more.'], ['How does ZeroIQ make money?', 'Trying, tuning and replaying are free. Minting an agent into the league costs 0.001 ETH. Later: skins, sponsored seasons and a share of fees when an agent graduates to live trading.'], ['What can an agent do onchain?', 'Pick one or more skills when you hatch it: spot trades, limit and stop orders, earning on idle cash, shorts and hedges (2x max), borrowing against stocks, dividend yield, covered income, publishing a basket, and meme tokens. In this preview the replay simulates spot trades only.'], ['What does the mint give me?', 'An onchain agent passport (ERC-8004) on Robinhood Chain, a seat in the season and a public track record. Your agent still trades paper money.']];
    $('faqList').innerHTML = FAQ.map(function (q) { return '<details style="padding:16px 0;border-bottom:1px solid #e5e5e2"><summary style="font-size:16px;font-weight:600;display:flex;justify-content:space-between;gap:12px"><span>' + q[0] + '</span><span aria-hidden="true" style="color:#6b6b6b">+</span></summary><p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#4a4a4a;max-width:640px">' + q[1] + '</p></details>'; }).join('');
  }

  // ---------- events ----------
  var IDEAS = ['buy the dip on NVDA, stay calm', 'chase green candles, aggressive', 'trade rarely, careful sizing'];
  var EXAMPLES = [
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
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var a = b.getAttribute('data-act');
    var m = model();
    if (a === 'hatch') startHatch(prompt() || currentExample());
    else if (a === 'idea') startHatch(IDEAS[+b.getAttribute('data-i')]);
    else if (a === 'twin') { $('prompt').value = '@degen_intern'; $('prompt').focus(); render(); }
    else if (a === 'ask') set({ askOpen: true });
    else if (a === 'tg') set({ tg: true });
    else if (a === 'join' || a === 'save') { if (a === 'save' && !m.born) return; e.preventDefault(); set({ joined: true, saveOpen: true }); }
    else if (a === 'hold') set({ answered: 'hold', askOpen: false, xp: m.xp + 5, dnaPatch: Object.assign({}, st.dnaPatch || {}, { patience: Math.min(99, m.dna.patience + 5) }) });
    else if (a === 'sell') set({ answered: 'sell', askOpen: false, xp: m.xp + 5, dnaPatch: Object.assign({}, st.dnaPatch || {}, { risk: Math.max(0, m.dna.risk - 10) }) });
    else if (a === 'share') set({ shareOpen: !st.shareOpen });
    else if (a === 'replay') set({ rtick: st.tick });
    else if (a === 'evolve') set({ dnaPatch: Object.assign({}, st.dnaPatch || {}, m.prop.patch), xp: m.xp + 15, dismissed: true, rtick: st.tick });
    else if (a === 'notnow') set({ dismissed: true });
    else if (a === 'bet') { var n = b.getAttribute('data-n'); set({ bet: st.bet === n ? null : n }); }
    else if (a === 'duel') set({ duel: b.getAttribute('data-n') });
    else if (a === 'duelcancel') set({ duel: null });
    else if (a === 'fork') startHatch(b.getAttribute('data-seed'));
    else if (a === 'skill') { var sk = b.getAttribute('data-k'), cnt = Object.keys(st.skills).filter(function (x) { return st.skills[x]; }).length; if (st.skills[sk] && cnt === 1) return; st.skills[sk] = !st.skills[sk]; if (st.face === 'back') { var rp2 = $('rulesPreview'); if (rp2) rp2.textContent = rulesText(model().dna, st.tune.limit); } render(); }
    else if (a === 'flip') flip(st.face === 'back' ? 'front' : 'back');
    else if (a === 'mint') { st.mintOpen = !st.mintOpen; if (st.face === 'back') renderBack(); else render(); }
    else if (a === 'preset') { var pz = b.getAttribute('data-p'); st.preset = pz; st.dnaPatch = Object.assign({}, st.dnaPatch || {}, TUNE_PRESETS[pz]); renderBack(); }
    else if (a === 'watch') { var tk = b.getAttribute('data-t'); st.tune.watch[tk] = !st.tune.watch[tk]; renderBack(); }
    else if (a === 'conn') { var cn = b.getAttribute('data-c'); st.tune.conn[cn] = !st.tune.conn[cn]; renderBack(); }
    else if (a === 'addx') addHandle();
    else if (a === 'rmx') { st.tune.handles.splice(+b.getAttribute('data-i'), 1); renderBack(); }
    else if (a === 'simulate') {
      if (st.phase !== 'born') { st.subject = prompt() || currentExample(); st.phase = 'born'; st.xp = 0; }
      st.rtick = st.tick; st.dismissed = false; st.mintOpen = false;
      flip('front');
    }

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
    var k = t.getAttribute('data-dna'), u = t.getAttribute('data-tune'), v = parseInt(t.value, 10) || 0;
    if (!k && !u) return;
    st.preset = null;
    if (k) { var p = {}; p[k] = v; st.dnaPatch = Object.assign({}, st.dnaPatch || {}, p); var lab = $('tv-' + k); if (lab) lab.textContent = v; }
    if (u === 'limit') { st.tune.limit = v; var tl = $('tv-limit'); if (tl) tl.textContent = '−' + v + '%'; }
    if (u === 'style') st.dnaPatch = Object.assign({}, st.dnaPatch || {}, { style: v > 50 ? 'momentum' : 'dip' });
    var pr = $('tv-preset'); if (pr) pr.textContent = 'PRESET: CUSTOM';
    var rp = $('rulesPreview'); if (rp) rp.textContent = rulesText(model().dna, st.tune.limit);
  });

  $('prompt').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startHatch(prompt() || currentExample()); } });

  renderStatic();
  render();
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
