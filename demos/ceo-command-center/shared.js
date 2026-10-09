/*
 * Shared JS — Unified Design System v2, Step 1 (see MIGRATION_NOTES.md).
 *
 * Currently contains only dsCountUp(), the vanilla count-up animation the v2 spec calls for on
 * every KPI/stat-card value app-wide. No dependency, no library — this stays a vanilla-JS app.
 *
 * NOT YET linked from any page's <head>/<body> — this file is written as part of "the system
 * exists" (Step 1), same as shared.css's v2 additions. It gets wired in per-page as each page
 * migrates onto .ds-stat, starting with Sales Dashboard.
 */

/**
 * Animates a numeric text value from 0 (or a `from` you pass) up to `target` over `duration`ms,
 * writing through `format` (default: plain integer with no separators — pass a formatter like
 * fmtNum/inrOv/toLocaleString wrapping for anything fancier). Uses requestAnimationFrame, not
 * setInterval, so it stays smooth and self-throttles on inactive/backgrounded tabs.
 *
 * @param {HTMLElement} el - element whose textContent gets updated every frame
 * @param {number} target - final value to land on
 * @param {object} [opts]
 * @param {number} [opts.duration=600] - total animation time in ms, per the v2 spec's ~600ms
 * @param {number} [opts.from=0] - starting value
 * @param {(n:number)=>string} [opts.format] - formatter applied to the in-progress value each
 *   frame; receives a number, must return a string. Defaults to Math.round(n) as a plain string.
 */
function dsCountUp(el, target, opts) {
  if (!el) return;
  opts = opts || {};
  var duration = opts.duration != null ? opts.duration : 600;
  var from = opts.from != null ? opts.from : 0;
  var format = opts.format || function (n) { return String(Math.round(n)); };

  // Respect a user's reduced-motion preference — jump straight to the final value.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = format(target);
    return;
  }

  var startTime = null;
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function step(timestamp) {
    if (startTime === null) startTime = timestamp;
    var elapsed = timestamp - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var eased = easeOutCubic(progress);
    var current = from + (target - from) * eased;
    el.textContent = format(current);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.textContent = format(target); // guarantee exact final value, not a rounding artifact
    }
  }
  window.requestAnimationFrame(step);
}

/**
 * Chart.js v4 inline plugin factory: draws a hero total (DM Mono, bold) plus an optional small
 * label in a donut chart's center hole — v3 "wow factor" pass. Turns dead space a plain pie
 * chart wastes into a free extra hero number. Pass the returned object in a Chart's own
 * `options.plugins` array (per-chart, not globally registered) via `plugins:[dsCenterLabel(...)]`.
 *
 * @param {string} text - main line, typically an already-formatted number/currency string
 * @param {string} [sub] - small caption below the main line
 */
function dsCenterLabel(text, sub) {
  return {
    id: 'dsCenterLabel',
    afterDraw: function (chart) {
      var ctx = chart.ctx, w = chart.width, h = chart.height;
      // Font sized relative to the donut's own hole, not a fixed px value: a fixed size that
      // fits a large donut (e.g. OS Ageing's ~160px+ chart) will overflow past the ring on a
      // small one (Gross Margin's, ~120-150px) and visually collide with whatever sits next to
      // it. cutout is read off the chart's own config so this stays correct if that ever changes.
      var cutout = chart.options && chart.options.cutout ? parseFloat(chart.options.cutout) / 100 : 0.65;
      var holeD = Math.min(w, h) * cutout;
      var mainPx = Math.max(10, Math.round(holeD * 0.24));
      var subPx = Math.max(7, Math.round(holeD * 0.11));
      // Shrink further if the text still wouldn't fit the hole width at that size, rather than
      // letting it spill past the ring — better a slightly smaller hero number than an
      // overlapping one.
      ctx.save();
      ctx.font = "700 " + mainPx + "px 'DM Mono',monospace";
      var maxTextW = holeD * 0.92;
      while (ctx.measureText(text).width > maxTextW && mainPx > 9) {
        mainPx -= 1;
        ctx.font = "700 " + mainPx + "px 'DM Mono',monospace";
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#191917';
      ctx.fillText(text, w / 2, h / 2 - (sub ? mainPx * 0.42 : 0));
      if (sub) {
        ctx.font = "600 " + subPx + "px 'DM Sans',sans-serif";
        ctx.fillStyle = '#857f75';
        ctx.fillText(sub, w / 2, h / 2 + mainPx * 0.6);
      }
      ctx.restore();
    }
  };
}

/**
 * Shared Chart.js tooltip config matching the app's card system (white bg, hairline border,
 * DM Mono body) instead of Chart.js's black-box default — v3 "wow factor" pass. Chart.js
 * tooltips are canvas-rendered so they can't take a real box-shadow; this is as close as that
 * allows. Spread into a chart's own `options.plugins.tooltip`, e.g.
 * `tooltip: {...DS_CHART_TOOLTIP, callbacks: {...}}`.
 */
/**
 * Tiny hand-rolled inline SVG sparkline — v3 "wow factor" pass. No Chart.js needed for a
 * "direction over time" indicator sitting next to a single number; a whole canvas chart would
 * be overkill. Returns an SVG string ready to drop into innerHTML.
 *
 * @param {number[]} values - series, oldest first
 * @param {object} [opts]
 * @param {number} [opts.width=56]
 * @param {number} [opts.height=20]
 * @param {string} [opts.color='#0d1f3c'] - stroke color
 * @param {number} [opts.strokeWidth=1.75]
 */
function dsSparkline(values, opts) {
  opts = opts || {};
  var w = opts.width != null ? opts.width : 56;
  var h = opts.height != null ? opts.height : 20;
  var color = opts.color || '#0d1f3c';
  var sw = opts.strokeWidth != null ? opts.strokeWidth : 1.75;
  var fill = opts.fill !== false; // soft gradient area under the line by default
  if (!values || values.length < 2) return '';
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  var range = max - min || 1;
  var pad = sw;
  var pts = values.map(function (v, i) {
    var x = pad + (i / (values.length - 1)) * (w - pad * 2);
    var y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  // A raw polyline between points reads as a jagged EKG line, not a designed element — build a
  // smooth cubic-Bezier path through the same points instead (Catmull-Rom-derived control
  // points), same technique as the app's Chart.js line charts' own `tension`, just done by hand
  // since this is plain SVG with no charting library involved.
  var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
  for (var i = 0; i < pts.length - 1; i++) {
    var p0 = pts[i - 1] || pts[i];
    var p1 = pts[i];
    var p2 = pts[i + 1];
    var p3 = pts[i + 2] || p2;
    var c1x = p1[0] + (p2[0] - p0[0]) / 6;
    var c1y = p1[1] + (p2[1] - p0[1]) / 6;
    var c2x = p2[0] - (p3[0] - p1[0]) / 6;
    var c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ' C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
  }
  var gradId = 'dsSparkGrad' + Math.random().toString(36).slice(2, 9);
  var fillPath = fill
    ? '<path d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ',' + h + ' L' + pts[0][0].toFixed(1) + ',' + h + ' Z" fill="url(#' + gradId + ')" stroke="none"/>'
    : '';
  var defs = fill
    ? '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity=".28"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>'
    : '';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" ' +
    'fill="none" style="display:block">' + defs + fillPath +
    '<path d="' + d + '" stroke="' + color + '" stroke-width="' + sw + '" ' +
    'stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>';
}

var DS_CHART_TOOLTIP = {
  backgroundColor: '#ffffff',
  titleColor: '#191917',
  bodyColor: '#4a4844',
  borderColor: 'rgba(25,25,23,0.14)',
  borderWidth: 1,
  cornerRadius: 10,
  padding: 10,
  titleFont: { family: "'DM Sans',sans-serif", weight: '700', size: 11 },
  bodyFont: { family: "'DM Mono',monospace", size: 11 },
  displayColors: false
};
