/**
 * High-performance zero-GC HTML5 Canvas 2D renderer for Candlesticks & Price Line charts.
 * Features calendar/clock-aligned timeline ticks, 1:1 natural panning, cursor-anchored time zoom,
 * timeline & price-axis drag scaling, and full color/style customization.
 */

import {
  formatCrosshairTime,
  formatPrice,
  formatTimelineTick,
  getPriceDecimals
} from './format.js';

const NICE_TIME_STEPS_SEC = Object.freeze([
  60,        // 1m
  120,       // 2m
  300,       // 5m
  600,       // 10m
  900,       // 15m
  1800,      // 30m
  3600,      // 1h
  7200,      // 2h
  10800,     // 3h
  14400,     // 4h
  21600,     // 6h
  28800,     // 8h
  43200,     // 12h
  86400,     // 1d
  172800,    // 2d
  259200,    // 3d
  604800,    // 1w
  1209600,   // 2w
  2592000,   // ~1mo (calendar-aligned)
  5184000,   // ~2mo (calendar-aligned)
  7776000,   // ~3mo (calendar-aligned)
  15552000,  // ~6mo (calendar-aligned)
  31536000   // ~1y  (calendar-aligned)
]);

function computeNiceStep(range, targetTicks) {
  if (!(range > 0) || !(targetTicks > 0)) return 1;
  const rough = range / targetTicks;
  const exp = Math.floor(Math.log10(rough));
  const pow = Math.pow(10, exp);
  const frac = rough / pow;
  let niceFrac;
  if (frac <= 1.2) niceFrac = 1;
  else if (frac <= 2.2) niceFrac = 2;
  else if (frac <= 3.5) niceFrac = 2.5;
  else if (frac <= 7) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * pow;
}

export function parseCssRgb(color) {
  if (typeof color !== 'string') return null;
  const s = color.trim();
  if (!s) return null;
  if (s[0] === '#') {
    if (s.length === 4) {
      const r = parseInt(s[1] + s[1], 16);
      const g = parseInt(s[2] + s[2], 16);
      const b = parseInt(s[3] + s[3], 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
    } else if (s.length === 7 || s.length === 9) {
      const r = parseInt(s.slice(1, 3), 16);
      const g = parseInt(s.slice(3, 5), 16);
      const b = parseInt(s.slice(5, 7), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
    }
    return null;
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

export function colorWithAlpha(color, alpha) {
  const rgb = parseCssRgb(color);
  if (rgb) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }
  return `rgba(22, 199, 132, ${alpha})`;
}

function contrastTextForBg(bgColor) {
  const rgb = parseCssRgb(bgColor);
  if (!rgb) return '#ffffff';
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return lum > 0.64 ? '#090b0f' : '#ffffff';
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class ChartCanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = 1;

    // Viewport state
    this.barSpacing = 9;
    this.minBarSpacing = 1.2;
    this.maxBarSpacing = 64;
    this.rightOffsetBars = 3.5;

    // Vertical scale & pan state
    this.priceScaleFactor = 1;
    this.manualPriceScale = false;
    this.priceShiftSpan = 0;
    this.lastTotalPriceSpan = 1;

    // Layout metrics cached on last draw
    this.plotW = 0;
    this.plotH = 0;
    this.axisW = 60;
    this.timeAxisH = 22;
    this.minPrice = 0;
    this.maxPrice = 1;
    this.decimals = 2;
  }

  _defaultBarSpacing(containerWidth, initialBars = 0) {
    const usableW = Math.max(120, (containerWidth || this.cssWidth || 600) - (this.axisW || 60));
    if (initialBars > 4) {
      const raw = usableW / (initialBars + 3.5);
      return Math.max(this.minBarSpacing, Math.min(this.maxBarSpacing, raw));
    }
    return containerWidth > 0 && containerWidth < 380 ? 7 : 9;
  }

  resetView(containerWidth = this.cssWidth, initialBars = 0) {
    this.barSpacing = this._defaultBarSpacing(containerWidth, initialBars);
    this.rightOffsetBars = 3.5;
    this.resetPriceScale();
  }

  resetTimeScale(containerWidth = this.cssWidth, initialBars = 0) {
    this.barSpacing = this._defaultBarSpacing(containerWidth, initialBars);
    this.rightOffsetBars = 3.5;
  }

  resetPriceScale() {
    this.priceScaleFactor = 1;
    this.manualPriceScale = false;
    this.priceShiftSpan = 0;
  }

  isPannedAway() {
    const farPast = this.rightOffsetBars < -2.5;
    const maxLiveOffset = this.plotW > 0 && this.barSpacing > 0
      ? Math.max(14, (this.plotW / this.barSpacing) * 0.55)
      : 24;
    const farFuture = this.rightOffsetBars > maxLiveOffset;
    return farPast || farFuture;
  }

  scrollToRealtime() {
    this.rightOffsetBars = 3.5;
    this.resetPriceScale();
  }

  xForIndex(index, totalBars) {
    return this.plotW - (totalBars - 1 - index + this.rightOffsetBars) * this.barSpacing;
  }

  floatIndexAtX(x, totalBars) {
    if (totalBars <= 0 || this.barSpacing <= 0) return 0;
    return totalBars - 1 + this.rightOffsetBars - (this.plotW - x) / this.barSpacing;
  }

  indexAtX(x, totalBars) {
    if (totalBars <= 0 || this.barSpacing <= 0) return -1;
    return Math.round(this.floatIndexAtX(x, totalBars));
  }

  priceAtY(y) {
    if (this.plotH <= 0) return this.minPrice;
    const ratio = 1 - Math.max(0, Math.min(1, y / this.plotH));
    return this.minPrice + ratio * (this.maxPrice - this.minPrice);
  }

  yForPrice(price) {
    const span = this.maxPrice - this.minPrice;
    if (!(span > 0)) return this.plotH * 0.5;
    return this.plotH - ((price - this.minPrice) / span) * this.plotH;
  }

  setRightOffsetBars(nextOffset, totalBars) {
    if (this.barSpacing <= 0 || totalBars <= 0) return;
    const effectivePlotW = this.plotW > 0 ? this.plotW : Math.max(120, this.cssWidth - 60);
    const keepPx = Math.min(effectivePlotW * 0.2, Math.max(24, this.barSpacing * 2));
    const keepBars = keepPx / this.barSpacing;

    const minOffset = -(totalBars - 1) + keepBars;
    const maxOffset = Math.max(minOffset + 1, effectivePlotW / this.barSpacing - keepBars);

    this.rightOffsetBars = Math.max(minOffset, Math.min(maxOffset, nextOffset));
  }

  /**
   * Pans horizontally by `deltaX` screen pixels.
   * Dragging right (`deltaX > 0`) moves candles right (+deltaX px) to reveal older history.
   * Dragging left (`deltaX < 0`) moves candles left (-|deltaX| px) toward future space.
   */
  panByPixels(deltaX, totalBars) {
    if (this.barSpacing <= 0 || totalBars <= 0 || !Number.isFinite(deltaX)) return;
    this.setRightOffsetBars(this.rightOffsetBars - deltaX / this.barSpacing, totalBars);
  }

  /**
   * Pans vertically by `deltaY` screen pixels when manual Y-axis scaling is active.
   */
  panPriceByPixels(deltaY) {
    if (!this.manualPriceScale || !(this.plotH > 0) || !Number.isFinite(deltaY)) return;
    this.priceShiftSpan += (deltaY / this.plotH) * this.lastTotalPriceSpan;
  }

  setBarSpacingAnchored(targetSpacing, anchorX, totalBars) {
    if (totalBars <= 0) return;
    const effectivePlotW = this.plotW > 0 ? this.plotW : Math.max(120, this.cssWidth - 60);
    const clampedX = Math.max(0, Math.min(effectivePlotW, anchorX));
    const oldSpacing = this.barSpacing;
    const nextSpacing = Math.max(
      this.minBarSpacing,
      Math.min(this.maxBarSpacing, targetSpacing)
    );
    if (Math.abs(nextSpacing - oldSpacing) < 1e-5) return;

    const anchorFloatIndex = totalBars - 1 + this.rightOffsetBars - (effectivePlotW - clampedX) / oldSpacing;
    this.barSpacing = nextSpacing;
    const nextOffset = anchorFloatIndex - (totalBars - 1) + (effectivePlotW - clampedX) / nextSpacing;
    this.setRightOffsetBars(nextOffset, totalBars);
  }

  zoomAtX(anchorX, scaleMultiplier, totalBars) {
    if (!(scaleMultiplier > 0)) return;
    this.setBarSpacingAnchored(this.barSpacing * scaleMultiplier, anchorX, totalBars);
  }

  getTimeScaleAnchorX(totalBars) {
    const effectivePlotW = this.plotW > 0 ? this.plotW : Math.max(120, this.cssWidth - 60);
    if (totalBars <= 0) return effectivePlotW;
    const latestX = this.xForIndex(totalBars - 1, totalBars);
    if (latestX >= effectivePlotW * 0.35 && latestX <= effectivePlotW) {
      return latestX;
    }
    return effectivePlotW;
  }

  /**
   * Scales time when dragging horizontally along the bottom timeline axis.
   * Dragging left (`deltaX < 0`) stretches time (zooms in); dragging right (`deltaX > 0`) compresses time (zooms out).
   */
  scaleTimeAxis(deltaX, totalBars) {
    if (totalBars <= 0 || !Number.isFinite(deltaX) || deltaX === 0) return;
    const anchorX = this.getTimeScaleAnchorX(totalBars);
    const factor = Math.exp(-deltaX * 0.0045);
    this.zoomAtX(anchorX, factor, totalBars);
  }

  scalePriceAxis(deltaY) {
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    this.manualPriceScale = true;
    const factor = Math.exp(deltaY * 0.005);
    this.priceScaleFactor = Math.max(0.18, Math.min(6, this.priceScaleFactor * factor));
  }

  timeAtIndex(index, candles, intervalSec) {
    const total = candles.length;
    if (total === 0) return 0;
    const i = Math.round(index);
    if (i >= 0 && i < total) return candles[i].time;
    if (i >= total) return candles[total - 1].time + (i - (total - 1)) * intervalSec;
    return candles[0].time + i * intervalSec;
  }

  indexForTime(targetSec, candles, intervalSec) {
    const total = candles.length;
    if (total === 0 || !(intervalSec > 0)) return 0;
    const firstT = candles[0].time;
    const lastT = candles[total - 1].time;
    if (targetSec >= lastT) {
      return (total - 1) + (targetSec - lastT) / intervalSec;
    }
    if (targetSec <= firstT) {
      return (targetSec - firstT) / intervalSec;
    }
    let lo = 0;
    let hi = total - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (candles[mid].time <= targetSec) lo = mid;
      else hi = mid - 1;
    }
    const t0 = candles[lo].time;
    if (t0 === targetSec || lo + 1 >= total) return lo;
    const span = candles[lo + 1].time - t0;
    return span > 0 ? lo + (targetSec - t0) / span : lo;
  }

  _computeTimeTicks(candles, intervalSec, plotW) {
    const total = candles.length;
    if (total === 0 || !(this.barSpacing > 0) || !(intervalSec > 0) || plotW < 60) {
      return { ticks: [], stepSec: intervalSec || 3600 };
    }

    const minLabelSpacingPx = 88;
    const minStepSec = Math.max(intervalSec, (minLabelSpacingPx / this.barSpacing) * intervalSec);

    let stepSec = NICE_TIME_STEPS_SEC[NICE_TIME_STEPS_SEC.length - 1];
    let found = false;
    for (let i = 0; i < NICE_TIME_STEPS_SEC.length; i++) {
      const candidate = NICE_TIME_STEPS_SEC[i];
      if (candidate < minStepSec) continue;
      if (candidate < 86400 && candidate % intervalSec !== 0) continue;
      stepSec = candidate;
      found = true;
      break;
    }
    if (!found) {
      const years = Math.max(1, Math.ceil(minStepSec / 31536000));
      stepSec = years * 31536000;
    }

    const leftIdx = this.floatIndexAtX(0, total);
    const rightIdx = this.floatIndexAtX(plotW, total);
    const tLeft = this.timeAtIndex(Math.floor(leftIdx), candles, intervalSec);
    const tRight = this.timeAtIndex(Math.ceil(rightIdx), candles, intervalSec);
    if (!(tRight >= tLeft)) {
      return { ticks: [], stepSec };
    }

    const rawCandidates = [];

    if (stepSec >= 2592000) {
      // Calendar-aligned month / quarter / year boundaries in UTC
      const monthStep = stepSec >= 31536000
        ? 12 * Math.max(1, Math.round(stepSec / 31536000))
        : Math.max(1, Math.round(stepSec / 2592000));
      const dStart = new Date(tLeft * 1000);
      const startYear = dStart.getUTCFullYear();
      const startMonth = Math.floor(dStart.getUTCMonth() / monthStep) * monthStep;

      for (let k = -1; k < 160; k++) {
        const ts = Math.floor(Date.UTC(startYear, startMonth + k * monthStep, 1) / 1000);
        if (ts > tRight + stepSec) break;
        if (ts >= tLeft - stepSec) rawCandidates.push(ts);
      }
    } else {
      // Clock / candle-epoch aligned boundaries
      const anchor = intervalSec >= 14400
        ? ((candles[0].time % stepSec) + stepSec) % stepSec
        : 0;
      const firstTick = Math.floor((tLeft - anchor) / stepSec) * stepSec + anchor;
      const maxCount = Math.min(80, Math.ceil((tRight - firstTick) / stepSec) + 2);
      for (let k = 0; k <= maxCount; k++) {
        rawCandidates.push(firstTick + k * stepSec);
      }
    }

    const ticks = [];
    let lastAcceptedX = -1e9;
    const minGapPx = 68;
    const edgePadPx = 28;

    for (let i = 0; i < rawCandidates.length; i++) {
      const ts = rawCandidates[i];
      const fIdx = this.indexForTime(ts, candles, intervalSec);
      const x = this.xForIndex(fIdx, total);
      if (x < edgePadPx || x > plotW - edgePadPx) continue;
      if (x - lastAcceptedX < minGapPx) continue;
      ticks.push({ x, time: ts });
      lastAcceptedX = x;
    }

    return { ticks, stepSec };
  }

  resize(cssWidth, cssHeight) {
    const w = Math.max(1, Math.floor(cssWidth));
    const h = Math.max(1, Math.floor(cssHeight));
    const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    const backingW = Math.round(w * dpr);
    const backingH = Math.round(h * dpr);

    this.cssWidth = w;
    this.cssHeight = h;
    this.dpr = dpr;

    if (this.canvas.width !== backingW || this.canvas.height !== backingH) {
      this.canvas.width = backingW;
      this.canvas.height = backingH;
    }
  }

  /**
   * Renders the full chart frame and returns metadata (hovered candle, visible state, backfill trigger).
   */
  render(state) {
    const {
      candles,
      type,
      theme,
      intervalSec,
      locale,
      timezone,
      showVolume,
      showAxes,
      showGrid,
      showPriceLine = true,
      showCrosshair = true,
      showPulse = true,
      areaFill = true,
      hollowCandles = false,
      lineColor,
      lineWidth = 2,
      areaTopColor,
      areaBottomColor,
      upColor,
      downColor,
      wickUpColor,
      wickDownColor,
      priceLineColor,
      priceLineStyle = 'dashed',
      bgColor,
      textColor,
      gridColor,
      volumeUpColor,
      volumeDownColor,
      crosshairColor,
      pointer
    } = state;

    const ctx = this.ctx;
    const W = this.cssWidth;
    const H = this.cssHeight;
    if (!ctx || W <= 4 || H <= 4) {
      return { hoveredCandle: null, nearLeftEdge: false };
    }

    const effBg = bgColor || theme.bg;
    const effUp = upColor || theme.up;
    const effDown = downColor || theme.down;
    const effWickUp = wickUpColor || effUp;
    const effWickDown = wickDownColor || effDown;
    const effVolUp = volumeUpColor || (upColor ? colorWithAlpha(effUp, 0.2) : theme.volUp);
    const effVolDown = volumeDownColor || (downColor ? colorWithAlpha(effDown, 0.2) : theme.volDown);
    const effGrid = gridColor || theme.grid;
    const effAxisText = textColor || theme.textMuted;
    const effCrosshair = crosshairColor || theme.crosshair;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Clear canvas background (supports `bg-color="transparent"`)
    ctx.clearRect(0, 0, W, H);
    if (effBg !== 'transparent') {
      ctx.fillStyle = effBg;
      ctx.fillRect(0, 0, W, H);
    }

    const total = candles ? candles.length : 0;
    if (total === 0) {
      return { hoveredCandle: null, nearLeftEdge: false };
    }

    const lastCandle = candles[total - 1];
    this.decimals = getPriceDecimals(lastCandle.close);

    const fontStack = '400 11px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.font = fontStack;

    const compactHeight = H < 145;
    const effectiveAxes = showAxes && !compactHeight && W >= 210;
    this.timeAxisH = effectiveAxes ? 22 : 0;

    if (effectiveAxes) {
      const sampleText = formatPrice(lastCandle.close * 1.08, this.decimals);
      const measured = ctx.measureText(sampleText).width;
      this.axisW = Math.max(54, Math.min(96, Math.ceil(measured + 16)));
    } else {
      this.axisW = 0;
    }

    const plotW = Math.max(10, W - this.axisW);
    const plotH = Math.max(10, H - this.timeAxisH);
    this.plotW = plotW;
    this.plotH = plotH;

    // Determine visible candle index range
    const halfBar = this.barSpacing * 0.6;
    const rawFirst = Math.floor(total - 1 + this.rightOffsetBars - (plotW + halfBar) / this.barSpacing);
    const rawLast = Math.ceil(total - 1 + this.rightOffsetBars + halfBar / this.barSpacing);
    const startIdx = Math.max(0, rawFirst);
    const endIdx = Math.min(total - 1, rawLast);

    // Compute visible min/max price & max volume (fallback to nearest edge bar if panned beyond range)
    let rawMin = Infinity;
    let rawMax = -Infinity;
    let maxVol = 0;
    const isLine = type === 'line';

    if (startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (isLine) {
          if (c.close < rawMin) rawMin = c.close;
          if (c.close > rawMax) rawMax = c.close;
        } else {
          if (c.low < rawMin) rawMin = c.low;
          if (c.high > rawMax) rawMax = c.high;
        }
        if (c.volume > maxVol) maxVol = c.volume;
      }
    }

    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
      const ref = rawFirst >= total ? lastCandle : candles[0];
      rawMin = ref.close * 0.99;
      rawMax = ref.close * 1.01;
    }
    if (rawMax - rawMin < rawMax * 0.0004) {
      const pad = (rawMax || 1) * 0.002;
      rawMin -= pad;
      rawMax += pad;
    }

    const hasVol = showVolume && !isLine && !compactHeight && maxVol > 0;
    const topPadRatio = compactHeight ? 0.10 : 0.09;
    const botPadRatio = hasVol ? 0.21 : (compactHeight ? 0.10 : 0.09);

    const baseSpan = rawMax - rawMin;
    const midPrice = (rawMax + rawMin) * 0.5;
    const scaledSpan = baseSpan * this.priceScaleFactor;
    const contentRatio = Math.max(0.2, 1 - topPadRatio - botPadRatio);
    const totalPriceSpan = scaledSpan / contentRatio;
    this.lastTotalPriceSpan = totalPriceSpan;

    const centerShift = (botPadRatio - topPadRatio) * 0.5 * totalPriceSpan;
    const verticalShift = this.manualPriceScale ? this.priceShiftSpan : 0;
    this.minPrice = midPrice - totalPriceSpan * 0.5 - centerShift + verticalShift;
    this.maxPrice = midPrice + totalPriceSpan * 0.5 - centerShift + verticalShift;

    // Compute Y-axis nice ticks
    const targetYTicks = Math.max(2, Math.min(7, Math.floor(plotH / 48)));
    const yStep = computeNiceStep(this.maxPrice - this.minPrice, targetYTicks);
    const firstTick = Math.ceil(this.minPrice / yStep) * yStep;

    const yTicks = [];
    for (let p = firstTick; p <= this.maxPrice + yStep * 0.001; p += yStep) {
      const y = this.yForPrice(p);
      if (y >= 8 && y <= plotH - 8) {
        yTicks.push({ price: p, y });
      }
      if (yTicks.length > 16) break;
    }

    // Compute calendar/clock-aligned X-axis time ticks across entire plotW (including future space)
    const { ticks: xTicks, stepSec: xStepSec } = this._computeTimeTicks(candles, intervalSec, plotW);

    // Draw subtle grid lines (single batched path, no outer frame)
    if (showGrid && !compactHeight) {
      ctx.beginPath();
      ctx.strokeStyle = effGrid;
      ctx.lineWidth = 1;
      for (let i = 0; i < yTicks.length; i++) {
        const py = Math.round(yTicks[i].y) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(plotW, py);
      }
      for (let i = 0; i < xTicks.length; i++) {
        const px = Math.round(xTicks[i].x) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, plotH);
      }
      ctx.stroke();
    }

    // Clip plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotW, plotH);
    ctx.clip();

    // Draw volume histogram in 2 batched passes
    if (hasVol && startIdx <= endIdx) {
      const volMaxH = plotH * 0.16;
      const bodyW = Math.max(1, Math.floor(this.barSpacing * 0.68));
      const halfW = Math.floor(bodyW * 0.5);

      ctx.fillStyle = effVolUp;
      ctx.beginPath();
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (c.close < c.open || !(c.volume > 0)) continue;
        const cx = Math.round(this.xForIndex(i, total));
        const vh = Math.max(1, (c.volume / maxVol) * volMaxH);
        ctx.rect(cx - halfW, plotH - vh, bodyW, vh);
      }
      ctx.fill();

      ctx.fillStyle = effVolDown;
      ctx.beginPath();
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (c.close >= c.open || !(c.volume > 0)) continue;
        const cx = Math.round(this.xForIndex(i, total));
        const vh = Math.max(1, (c.volume / maxVol) * volMaxH);
        ctx.rect(cx - halfW, plotH - vh, bodyW, vh);
      }
      ctx.fill();
    }

    const resolvedSeriesStroke = this._resolveLineStroke(candles, startIdx, endIdx, theme, lineColor, effUp, effDown);

    if (startIdx <= endIdx) {
      if (isLine) {
        this._drawPriceLineSeries(ctx, candles, startIdx, endIdx, total, plotH, {
          stroke: resolvedSeriesStroke,
          lineWidth,
          areaFill,
          areaTopColor,
          areaBottomColor,
          showPulse
        });
      } else {
        this._drawCandles(ctx, candles, startIdx, endIdx, total, {
          upColor: effUp,
          downColor: effDown,
          wickUpColor: effWickUp,
          wickDownColor: effWickDown,
          hollowCandles,
          cutoutBg: effBg === 'transparent' ? theme.bg : effBg
        });
      }
    }

    // Current live price horizontal line ("price line")
    const liveY = this.yForPrice(lastCandle.close);
    const defaultLiveColor = isLine
      ? resolvedSeriesStroke
      : (lastCandle.close >= lastCandle.open ? effUp : effDown);
    const liveLineColor = priceLineColor && priceLineColor !== 'auto'
      ? priceLineColor
      : defaultLiveColor;

    if (showPriceLine && liveY >= 0 && liveY <= plotH) {
      ctx.save();
      ctx.strokeStyle = priceLineColor && priceLineColor !== 'auto'
        ? priceLineColor
        : colorWithAlpha(liveLineColor, 0.58);
      ctx.lineWidth = 1;
      if (priceLineStyle === 'dotted') {
        ctx.setLineDash([1.5, 3]);
      } else if (priceLineStyle === 'dashed') {
        ctx.setLineDash([4, 4]);
      }
      const snapLiveY = Math.round(liveY) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, snapLiveY);
      ctx.lineTo(plotW, snapLiveY);
      ctx.stroke();
      ctx.restore();
    }

    // Crosshair lines inside plot area (tracks seamlessly across bars AND future/past space)
    let hoveredCandle = null;
    let crossX = -1;
    let crossY = -1;
    let crossPrice = 0;
    let crossTimeSec = 0;
    let hasCrosshair = false;

    if (
      showCrosshair &&
      pointer &&
      pointer.active &&
      pointer.x >= 0 &&
      pointer.x <= plotW &&
      pointer.y >= 0 &&
      pointer.y <= plotH
    ) {
      const rawIdx = this.indexAtX(pointer.x, total);
      hoveredCandle = rawIdx >= 0 && rawIdx < total ? candles[rawIdx] : null;
      crossTimeSec = this.timeAtIndex(rawIdx, candles, intervalSec);
      crossX = Math.round(this.xForIndex(rawIdx, total)) + 0.5;

      if (crossX >= 0 && crossX <= plotW + 0.5) {
        hasCrosshair = true;
        if (isLine && hoveredCandle) {
          crossPrice = hoveredCandle.close;
          crossY = Math.round(this.yForPrice(crossPrice)) + 0.5;
        } else {
          crossY = Math.round(pointer.y) + 0.5;
          crossPrice = this.priceAtY(pointer.y);
        }

        ctx.save();
        ctx.strokeStyle = effCrosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(crossX, 0);
        ctx.lineTo(crossX, plotH);
        ctx.moveTo(0, crossY);
        ctx.lineTo(plotW, crossY);
        ctx.stroke();
        ctx.restore();

        if (isLine && hoveredCandle) {
          ctx.beginPath();
          ctx.fillStyle = resolvedSeriesStroke;
          ctx.arc(crossX - 0.5, crossY - 0.5, 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = effBg === 'transparent' ? theme.bg : effBg;
          ctx.stroke();
        }
      }
    }

    ctx.restore(); // End plot clip

    // Draw frameless axes & clean weight-400 pills
    if (effectiveAxes) {
      ctx.font = fontStack;
      ctx.fillStyle = effAxisText;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < yTicks.length; i++) {
        const t = yTicks[i];
        if (showPriceLine && Math.abs(t.y - liveY) < 13) continue;
        ctx.fillText(formatPrice(t.price, this.decimals), plotW + 7, t.y);
      }

      // X-axis calendar/clock-aligned tick labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const timeLabelY = plotH + this.timeAxisH * 0.5 + 0.5;
      for (let i = 0; i < xTicks.length; i++) {
        const xt = xTicks[i];
        const prevTs = i > 0 ? xTicks[i - 1].time : null;
        const label = formatTimelineTick(xt.time, prevTs, xStepSec, intervalSec, locale, timezone);
        ctx.fillText(label, xt.x, timeLabelY);
      }

      // Live price badge on right Y-axis
      if (showPriceLine) {
        const clampedLiveY = Math.max(10, Math.min(plotH - 10, liveY));
        this._drawYAxisPill(
          ctx,
          plotW,
          clampedLiveY,
          this.axisW,
          formatPrice(lastCandle.close, this.decimals),
          liveLineColor,
          contrastTextForBg(liveLineColor),
          fontStack
        );
      }

      // Crosshair Y-axis price pill & X-axis timestamp pill
      if (hasCrosshair && crossX >= 0) {
        const clampedCrossY = Math.max(10, Math.min(plotH - 10, crossY));
        this._drawYAxisPill(
          ctx,
          plotW,
          clampedCrossY,
          this.axisW,
          formatPrice(crossPrice, this.decimals),
          theme.crosshairBg,
          theme.crosshairText,
          fontStack
        );

        const timeText = formatCrosshairTime(crossTimeSec, intervalSec, locale, timezone);
        if (timeText) {
          ctx.font = fontStack;
          const tw = Math.ceil(ctx.measureText(timeText).width) + 14;
          const pillX = Math.max(2, Math.min(plotW - tw - 2, crossX - tw * 0.5));
          drawRoundedRect(ctx, pillX, plotH + 2, tw, this.timeAxisH - 4, 4);
          ctx.fillStyle = theme.crosshairBg;
          ctx.fill();
          ctx.fillStyle = theme.crosshairText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(timeText, pillX + tw * 0.5, timeLabelY);
        }
      }
    }

    return {
      hoveredCandle,
      firstVisibleCandle: candles[startIdx] || null,
      nearLeftEdge: rawFirst <= 15
    };
  }

  _drawCandles(ctx, candles, startIdx, endIdx, total, palette) {
    const { upColor, downColor, wickUpColor, wickDownColor, hollowCandles, cutoutBg } = palette;
    let bodyW = Math.max(1, Math.floor(this.barSpacing * 0.72));
    if (bodyW >= 4 && bodyW % 2 === 0) bodyW -= 1;
    const halfBody = Math.floor(bodyW * 0.5);

    // 1. Bullish wicks
    ctx.strokeStyle = wickUpColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = startIdx; i <= endIdx; i++) {
      const c = candles[i];
      if (c.close < c.open) continue;
      const wx = Math.round(this.xForIndex(i, total)) + 0.5;
      ctx.moveTo(wx, Math.round(this.yForPrice(c.high)));
      ctx.lineTo(wx, Math.round(this.yForPrice(c.low)));
    }
    ctx.stroke();

    // 2. Bearish wicks
    ctx.strokeStyle = wickDownColor;
    ctx.beginPath();
    for (let i = startIdx; i <= endIdx; i++) {
      const c = candles[i];
      if (c.close >= c.open) continue;
      const wx = Math.round(this.xForIndex(i, total)) + 0.5;
      ctx.moveTo(wx, Math.round(this.yForPrice(c.high)));
      ctx.lineTo(wx, Math.round(this.yForPrice(c.low)));
    }
    ctx.stroke();

    // 3. Bullish bodies (filled or hollow)
    if (hollowCandles && bodyW >= 3) {
      ctx.fillStyle = cutoutBg;
      ctx.strokeStyle = upColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (c.close < c.open) continue;
        const cx = Math.round(this.xForIndex(i, total));
        const yOpen = this.yForPrice(c.open);
        const yClose = this.yForPrice(c.close);
        const top = Math.round(Math.min(yOpen, yClose)) + 0.5;
        const h = Math.max(1, Math.round(Math.abs(yClose - yOpen)));
        ctx.rect(cx - halfBody + 0.5, top, Math.max(1, bodyW - 1), h);
      }
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = upColor;
      ctx.beginPath();
      for (let i = startIdx; i <= endIdx; i++) {
        const c = candles[i];
        if (c.close < c.open) continue;
        const cx = Math.round(this.xForIndex(i, total));
        const yOpen = this.yForPrice(c.open);
        const yClose = this.yForPrice(c.close);
        const top = Math.round(Math.min(yOpen, yClose));
        const h = Math.max(1.5, Math.round(Math.abs(yClose - yOpen)));
        ctx.rect(cx - halfBody, top, bodyW, h);
      }
      ctx.fill();
    }

    // 4. Bearish bodies
    ctx.fillStyle = downColor;
    ctx.beginPath();
    for (let i = startIdx; i <= endIdx; i++) {
      const c = candles[i];
      if (c.close >= c.open) continue;
      const cx = Math.round(this.xForIndex(i, total));
      const yOpen = this.yForPrice(c.open);
      const yClose = this.yForPrice(c.close);
      const top = Math.round(Math.min(yOpen, yClose));
      const h = Math.max(1.5, Math.round(Math.abs(yClose - yOpen)));
      ctx.rect(cx - halfBody, top, bodyW, h);
    }
    ctx.fill();
  }

  _resolveLineStroke(candles, startIdx, endIdx, theme, lineColor, effUp, effDown) {
    if (lineColor && lineColor !== 'auto') {
      if (lineColor === 'accent') return theme.accent;
      return lineColor;
    }
    const safeStart = Math.max(0, Math.min(candles.length - 1, startIdx));
    const safeEnd = Math.max(0, Math.min(candles.length - 1, endIdx));
    const first = candles[safeStart];
    const last = candles[safeEnd];
    return !first || !last || last.close >= first.close ? effUp : effDown;
  }

  _drawPriceLineSeries(ctx, candles, startIdx, endIdx, total, plotH, opts) {
    const { stroke, lineWidth, areaFill, areaTopColor, areaBottomColor, showPulse } = opts;
    const drawStart = Math.max(0, startIdx - 1);
    const drawEnd = Math.min(total - 1, endIdx + 1);
    if (drawEnd < drawStart) return;

    const firstX = this.xForIndex(drawStart, total);
    const firstY = this.yForPrice(candles[drawStart].close);
    let lastX = firstX;
    let lastY = firstY;

    // Optional area gradient fill beneath price line
    if (areaFill) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      for (let i = drawStart + 1; i <= drawEnd; i++) {
        lastX = this.xForIndex(i, total);
        lastY = this.yForPrice(candles[i].close);
        ctx.lineTo(lastX, lastY);
      }
      ctx.lineTo(lastX, plotH);
      ctx.lineTo(firstX, plotH);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, 0, plotH);
      grad.addColorStop(0, areaTopColor || colorWithAlpha(stroke, 0.22));
      if (!areaBottomColor) {
        grad.addColorStop(0.88, colorWithAlpha(stroke, 0.02));
      }
      grad.addColorStop(1, areaBottomColor || colorWithAlpha(stroke, 0.0));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Crisp anti-aliased price line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(firstX, firstY);
    for (let i = drawStart + 1; i <= drawEnd; i++) {
      ctx.lineTo(this.xForIndex(i, total), this.yForPrice(candles[i].close));
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, Math.min(5, Number(lineWidth) || 2));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Live beacon dot on latest bar if visible
    if (showPulse && drawEnd === total - 1) {
      const tipX = this.xForIndex(total - 1, total);
      const tipY = this.yForPrice(candles[total - 1].close);
      if (tipX >= 0 && tipX <= this.plotW) {
        ctx.beginPath();
        ctx.fillStyle = colorWithAlpha(stroke, 0.22);
        ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = stroke;
        ctx.arc(tipX, tipY, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawYAxisPill(ctx, plotW, centerY, axisW, text, bgColor, textColor, fontStack) {
    const pillH = 19;
    const pillY = Math.round(centerY - pillH * 0.5);
    const pillW = Math.max(44, axisW - 4);
    drawRoundedRect(ctx, plotW + 2, pillY, pillW, pillH, 4);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.font = fontStack;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, plotW + 7, pillY + pillH * 0.5 + 0.5);
  }
}
