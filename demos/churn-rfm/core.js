// B2B churn prediction + RFM: simulated order history, monthly snapshots, logistic regression
// with a time-based split. Runs in the browser and in Node (`node core.js`).
(function (g) {
  const DAYS = 900, LABEL = 90, HIST = 180;
  const NAMES = ['Café', 'Kitchen', 'Foods', 'Caterers', 'Gelato', 'Brew', 'Bistro', 'Grill', 'Bakes', 'Juice Bar', 'Hotels', 'Dhaba', 'Canteen', 'Tiffins', 'Creamery'];
  const PRE = ['Aroma', 'Urban', 'Green', 'Coastal', 'Metro', 'Royal', 'Sunrise', 'Leaf', 'Spice', 'Berry', 'Frost', 'Daily', 'Golden', 'Blue', 'Maple', 'Lotus', 'Tandoor', 'Nimbu', 'Saffron', 'Peppy'];

  function simulate(seed, n) {
    const r = g.rng(seed || 11), custs = [];
    for (let c = 0; c < (n || 520); c++) {
      const start = Math.floor(r() * 560), mu = 10 + r() * 50, val = 15000 + r() ** 2 * 260000;
      const churnAt = r() < .45 ? start + 120 + Math.floor(r() * (DAYS - start)) : Infinity;
      const lumpy = r() < .18; // occasional long gaps without churning: the 60-day rule's false alarms
      const orders = []; let t = start;
      while (t < DAYS && t < churnAt) {
        const fade = churnAt - t < 110 ? 1.7 : 1;          // slows down before leaving
        const shrink = churnAt - t < 110 ? .65 : 1;         // smaller orders before leaving
        orders.push({ day: Math.round(t), value: Math.round(val * shrink * (0.7 + r() * 0.6)) });
        let gap = mu * fade * (0.6 + r() * 0.8);
        if (lumpy && r() < .15) gap += 50 + r() * 60;
        t += gap;
      }
      custs.push({ id: 'C' + String(1000 + c), name: PRE[c % PRE.length] + ' ' + NAMES[(c * 7) % NAMES.length] + (c >= PRE.length ? ' ' + (Math.floor(c / PRE.length) + 1) : ''), orders });
    }
    return custs;
  }

  const FEATS = ['Days since last order', 'Orders (last 180d)', 'Spend (last 180d, ₹L)', 'Gap vs own rhythm', 'Recent gap trend', 'Order size trend', 'Tenure (months)'];
  function snapshot(custs, s) { // features use only orders on/before day s; label uses (s, s+90]
    const rows = [];
    for (const c of custs) {
      const past = c.orders.filter(o => o.day <= s);
      if (past.length < 3) continue;
      const last = past[past.length - 1].day;
      if (s - last > HIST) continue; // already lapsed: not an "active" customer at this snapshot
      const gaps = past.slice(1).map((o, i) => o.day - past[i].day), avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const recentGap = gaps.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, gaps.length);
      const avgVal = past.reduce((a, o) => a + o.value, 0) / past.length, recentVal = past.slice(-3).reduce((a, o) => a + o.value, 0) / 3;
      const win = past.filter(o => o.day > s - HIST);
      const spend = win.reduce((a, o) => a + o.value, 0);
      const x = [s - last, win.length, spend / 1e5, (s - last) / avgGap, recentGap / avgGap, recentVal / avgVal, (s - past[0].day) / 30];
      const churn = !c.orders.some(o => o.day > s && o.day <= s + LABEL);
      rows.push({ id: c.id, name: c.name, x, y: churn ? 1 : 0, recency: s - last, freq: win.length, monetary: spend });
    }
    return rows;
  }

  function train(rows, iters, l2) {
    const k = rows[0].x.length, mu = Array(k).fill(0), sd = Array(k).fill(0);
    rows.forEach(r => r.x.forEach((v, j) => mu[j] += v / rows.length));
    rows.forEach(r => r.x.forEach((v, j) => sd[j] += (v - mu[j]) ** 2 / rows.length)); for (let j = 0; j < k; j++) sd[j] = Math.sqrt(sd[j]) || 1;
    const Z = rows.map(r => r.x.map((v, j) => (v - mu[j]) / sd[j])), w = Array(k).fill(0); let b = 0;
    const sig = z => 1 / (1 + Math.exp(-z)), lr = .3;
    for (let it = 0; it < (iters || 600); it++) {
      const gw = Array(k).fill(0); let gb = 0;
      Z.forEach((z, n) => { const e = sig(b + z.reduce((s, v, j) => s + v * w[j], 0)) - rows[n].y; gb += e; z.forEach((v, j) => gw[j] += e * v); });
      for (let j = 0; j < k; j++) w[j] -= lr * (gw[j] / Z.length + (l2 || .01) * w[j]);
      b -= lr * gb / Z.length;
    }
    return { w, b, mu, sd, predict(x) { const z = x.map((v, j) => (v - mu[j]) / sd[j]); return { p: sig(b + z.reduce((s, v, j) => s + v * w[j], 0)), contrib: z.map((v, j) => v * w[j]) }; } };
  }

  function auc(scores, ys) {
    const pos = [], neg = []; scores.forEach((s, i) => (ys[i] ? pos : neg).push(s));
    let wins = 0; for (const p of pos) for (const q of neg) wins += p > q ? 1 : p === q ? .5 : 0;
    return wins / (pos.length * neg.length);
  }
  const quint = (vals, v, desc) => { const s = [...vals].sort((a, b) => a - b), q = i => s[Math.floor(i * (s.length - 1) / 5)]; let k = 1; for (let i = 1; i < 5; i++) if (v > q(i)) k++; return desc ? 6 - k : k; };
  function rfm(rows) {
    const R = rows.map(r => r.recency), F = rows.map(r => r.freq), M = rows.map(r => r.monetary);
    return rows.map(r => {
      const rs = quint(R, r.recency, true), fs = quint(F, r.freq), ms = quint(M, r.monetary);
      const seg = rs >= 4 && fs >= 4 ? 'Champions' : fs >= 4 ? 'Loyal' : rs >= 4 ? 'Promising' : rs <= 2 && fs >= 3 ? 'At Risk' : rs <= 2 ? 'Hibernating' : 'Needs Attention';
      return { rs, fs, ms, seg };
    });
  }

  function run(seed) {
    const custs = simulate(seed), testDay = DAYS - LABEL;            // last snapshot whose 90-day label is fully observed
    const trainDays = []; for (let s = 240; s + LABEL <= testDay; s += 30) trainDays.push(s); // label windows end before the test snapshot
    const trainRows = trainDays.flatMap(s => snapshot(custs, s)), test = snapshot(custs, testDay);
    const model = train(trainRows);
    test.forEach(r => { const o = model.predict(r.x); r.p = o.p; r.contrib = o.contrib; });
    const seg = rfm(test); test.forEach((r, i) => Object.assign(r, seg[i]));
    const churners = test.filter(r => r.y), budget = Math.round(test.length * .2);
    const capture = (sorted) => sorted.slice(0, budget).filter(r => r.y).length / churners.length;
    const revAtRisk = (sorted) => sorted.slice(0, budget).filter(r => r.y).reduce((a, r) => a + r.monetary, 0) / churners.reduce((a, r) => a + r.monetary, 0);
    const byModel = [...test].sort((a, b) => b.p - a.p), byRecency = [...test].sort((a, b) => b.recency - a.recency);
    const ruleFlag = test.filter(r => r.recency > 60), rand = g.rng(5), byRandom = [...test].sort(() => rand() - .5);
    const segs = {}; test.forEach(r => { const s = segs[r.seg] ??= { n: 0, churn: 0 }; s.n++; s.churn += r.y; });
    const curve = k => [byModel, byRecency].map(list => list.slice(0, Math.round(test.length * k)).filter(r => r.y).length / churners.length);
    return {
      custs, trainRows: trainRows.length, trainSnapshots: trainDays.length, test, model, churners: churners.length, budget,
      capture: { model: capture(byModel), recency: capture(byRecency), random: capture(byRandom) },
      revenue: { model: revAtRisk(byModel), recency: revAtRisk(byRecency) },
      rule: { flagged: ruleFlag.length, caught: ruleFlag.filter(r => r.y).length / churners.length, precision: ruleFlag.filter(r => r.y).length / (ruleFlag.length || 1) },
      auc: { model: auc(test.map(r => r.p), test.map(r => r.y)), recency: auc(test.map(r => r.recency), test.map(r => r.y)) },
      segs, curve: Array.from({ length: 21 }, (_, i) => [i / 20, ...curve(i / 20)]), ranked: byModel, FEATS,
    };
  }
  g.Churn = { run, FEATS };

  if (typeof module !== 'undefined' && require.main === module) {
    const r = run(11), P = v => (v * 100).toFixed(1) + '%';
    console.log('train rows', r.trainRows, 'from', r.trainSnapshots, 'snapshots | test customers', r.test.length, 'churners', r.churners, '(' + P(r.churners / r.test.length) + ')');
    console.log('top-20% capture  model', P(r.capture.model), ' recency-rank', P(r.capture.recency), ' random', P(r.capture.random));
    console.log('revenue-at-risk captured  model', P(r.revenue.model), ' recency', P(r.revenue.recency));
    console.log('60-day rule: flags', r.rule.flagged, 'catches', P(r.rule.caught), 'precision', P(r.rule.precision));
    console.log('AUC model', r.auc.model.toFixed(3), ' recency', r.auc.recency.toFixed(3));
    console.log('segments', JSON.stringify(Object.fromEntries(Object.entries(r.segs).map(([k, v]) => [k, v.n + ' / ' + P(v.churn / v.n)]))));
    console.log('weights', r.model.w.map((w, j) => r.FEATS[j] + ' ' + w.toFixed(2)).join(' | '));
  }
})(typeof window !== 'undefined' ? window : (require('../_shared/demo.js'), globalThis));
