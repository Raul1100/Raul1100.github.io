// Demand forecasting engine: synthetic weekly demand, 6 models, rolling-origin backtest.
// Runs in the browser and in Node (`node core.js` prints the leaderboard).
(function (g) {
  const H = 8, SEASON = 52, WEEKS = 156, FOLDS = 4;

  /* ---------- data: 10 SKUs x 156 weeks, seeded ---------- */
  const SKUS = [
    ['160MM WOODEN FORK', 'cutlery'], ['160MM WOODEN SPOON', 'cutlery'], ['160MM WOODEN KNIFE', 'cutlery'], ['95MM ICE CREAM SCOOP', 'icecream'],
    ['140MM WOODEN SPORK', 'cutlery'], ['6MM PAPER STRAW', 'straw'], ['8MM PAPER STRAW', 'straw'], ['12MM BUBBLE TEA STRAW', 'straw'],
    ['CUTLERY KIT 3-IN-1', 'cutlery'], ['140MM COFFEE STIRRER', 'stirrer'],
  ];
  function makeData(seed) {
    const r = g.rng(seed || 7);
    return SKUS.map(([name, kind], k) => {
      const base = 250 + r() * 900, trend = (r() - .35) * .004, noise = .07 + r() * .08;
      const amp = kind === 'icecream' ? .45 : kind === 'straw' ? .3 : .15, peak = kind === 'icecream' || kind === 'straw' ? 17 : 40; // Apr–May vs festive season
      const y = [];
      for (let t = 0; t < WEEKS; t++) {
        const woy = t % SEASON;
        const season = amp * Math.cos(2 * Math.PI * (woy - peak) / SEASON);
        const festival = kind === 'cutlery' && woy >= 41 && woy <= 44 ? .35 : 0; // Diwali / wedding orders
        const promo = r() < .03 ? .4 * r() : 0;
        const v = base * (1 + trend * t) * (1 + season + festival + promo) * (1 + g.gauss(r) * noise);
        y.push(Math.max(0, Math.round(v)));
      }
      return { name, kind, y };
    });
  }

  /* ---------- linear algebra for ridge ---------- */
  function solve(A, b) { // Gaussian elimination with partial pivoting
    const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
      [M[c], M[p]] = [M[p], M[c]];
      for (let i = c + 1; i < n; i++) { const f = M[i][c] / M[c][c]; for (let j = c; j <= n; j++) M[i][j] -= f * M[c][j]; }
    }
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }

  /* ---------- models: f(history, h) -> h forecasts; they only ever see `history` ---------- */
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const MODELS = {
    'Naive (last week)': (y, h) => Array(h).fill(y[y.length - 1]),
    'Seasonal naive': (y, h) => Array.from({ length: h }, (_, i) => y[y.length - SEASON + i]),
    'Moving average (8w)': (y, h) => Array(h).fill(mean(y.slice(-8))),
    'Holt-Winters': holtWinters,
    'Ridge regression': ridge,
    'Ensemble (HW + Ridge)': (y, h) => { const a = holtWinters(y, h), b = ridge(y, h); return a.map((v, i) => (v + b[i]) / 2); },
  };

  function hwRun(y, a, b, c) {
    const m = SEASON, s0 = y.slice(0, m), s1 = y.slice(m, 2 * m);
    let L = mean(s0), T = (mean(s1) - mean(s0)) / m; const S = s0.map(v => v - L);
    let sse = 0;
    for (let t = m; t < y.length; t++) {
      const f = L + T + S[t % m]; sse += (y[t] - f) ** 2;
      const Lp = L; L = a * (y[t] - S[t % m]) + (1 - a) * (L + T); T = b * (L - Lp) + (1 - b) * T; S[t % m] = c * (y[t] - L) + (1 - c) * S[t % m];
    }
    return { sse, L, T, S };
  }
  function holtWinters(y, h) {
    let best = null;
    for (const a of [.1, .2, .35, .5]) for (const b of [.01, .05, .1]) for (const c of [.05, .15, .3]) {
      const r = hwRun(y, a, b, c); if (!best || r.sse < best.sse) best = r;
    }
    const n = y.length;
    return Array.from({ length: h }, (_, i) => Math.max(0, best.L + (i + 1) * best.T + best.S[(n + i) % SEASON]));
  }

  // features for predicting y[t] from values strictly before t (+ calendar terms)
  function feats(series, t) {
    const w = t % SEASON;
    return [series[t - 1], series[t - 2], series[t - 3], series[t - 4], mean(series.slice(t - 4, t)), series[t - SEASON],
            Math.sin(2 * Math.PI * w / SEASON), Math.cos(2 * Math.PI * w / SEASON), t / SEASON];
  }
  function ridge(y, h, lambda) {
    lambda = lambda == null ? 2 : lambda;
    const X = [], Y = [];
    for (let t = SEASON; t < y.length; t++) { X.push(feats(y, t)); Y.push(y[t]); }
    const k = X[0].length, mu = Array(k).fill(0), sd = Array(k).fill(0);
    X.forEach(r => r.forEach((v, j) => mu[j] += v / X.length));
    X.forEach(r => r.forEach((v, j) => sd[j] += (v - mu[j]) ** 2 / X.length)); for (let j = 0; j < k; j++) sd[j] = Math.sqrt(sd[j]) || 1;
    const ym = mean(Y), Z = X.map(r => r.map((v, j) => (v - mu[j]) / sd[j]));
    const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0)));
    const bv = Array.from({ length: k }, (_, i) => Z.reduce((s, r, n) => s + r[i] * (Y[n] - ym), 0));
    const wv = solve(A, bv);
    const ext = y.slice(), out = [];
    for (let i = 0; i < h; i++) { // recursive: later steps use earlier predictions, never future actuals
      const t = ext.length, z = feats(ext, t).map((v, j) => (v - mu[j]) / sd[j]);
      const p = Math.max(0, ym + z.reduce((s, v, j) => s + v * wv[j], 0)); out.push(p); ext.push(p);
    }
    return out;
  }

  /* ---------- rolling-origin backtest ---------- */
  function backtest(data) {
    const origins = Array.from({ length: FOLDS }, (_, f) => WEEKS - H * (FOLDS - f));
    const res = {};
    for (const [name, fn] of Object.entries(MODELS)) {
      let absErr = 0, err = 0, act = 0; const perSku = data.map(() => ({ abs: 0, act: 0 })); const folds = [];
      origins.forEach(o => {
        let fa = 0, fs = 0;
        data.forEach((s, k) => {
          const fc = fn(s.y.slice(0, o), H);
          for (let i = 0; i < H; i++) { const a = s.y[o + i], e = fc[i] - a; absErr += Math.abs(e); err += e; act += a; perSku[k].abs += Math.abs(e); perSku[k].act += a; fa += Math.abs(e); fs += a; }
        });
        folds.push(fa / fs);
      });
      res[name] = { wape: absErr / act, bias: err / act, folds, perSku: perSku.map(p => p.abs / p.act) };
    }
    return { origins, res };
  }

  // Leakage test: scramble everything after the origin; forecasts must not change.
  function leakageTest(data) {
    const s = data[0].y, o = WEEKS - H * FOLDS, rr = g.rng(99);
    const tampered = s.map((v, i) => i >= o ? Math.round(v * (0.2 + rr() * 3)) : v);
    return Object.entries(MODELS).map(([name, fn]) => {
      const a = fn(s.slice(0, o), H), b = fn(tampered.slice(0, o), H);
      return { name, pass: a.every((v, i) => Math.abs(v - b[i]) < 1e-9) };
    });
  }

  g.Forecast = { makeData, MODELS, backtest, leakageTest, H, SEASON, WEEKS, FOLDS, SKUS };

  if (typeof module !== 'undefined' && require.main === module) {
    const d = makeData(7), bt = backtest(d), base = bt.res['Seasonal naive'].wape;
    Object.entries(bt.res).sort((a, b) => a[1].wape - b[1].wape).forEach(([n, r]) =>
      console.log(n.padEnd(24), 'WAPE', (r.wape * 100).toFixed(1) + '%', ' bias', (r.bias * 100).toFixed(1) + '%', ' vs seasonal naive', ((1 - r.wape / base) * 100).toFixed(1) + '%'));
    console.log('leakage:', leakageTest(d).map(x => x.name + ':' + (x.pass ? 'pass' : 'FAIL')).join(', '));
  }
})(typeof window !== 'undefined' ? window : (require('../_shared/demo.js'), globalThis));
