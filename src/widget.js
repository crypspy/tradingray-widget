/**
 * TradingRayChartWidget — Encapsulated Shadow DOM crypto chart widget controller.
 * Frameless minimalist UI (max font-weight 500), logo-only watermark, responsive ResizeObserver,
 * viewport hibernation (IntersectionObserver), 1:1 pan, timeline & price-axis drag scaling,
 * cursor-anchored wheel/pinch zoom, fullscreen (native + iOS fallback), and full color customization.
 */

import {
  BRAND_LOGO_SVG,
  BRAND_NAME,
  BRAND_URL,
  INTERVAL_SECONDS,
  SUPPORTED_INTERVALS,
  THEMES,
  TOOLBAR_INTERVALS,
  clampNumber,
  normalizeChartType,
  normalizeInterval,
  normalizeLineStyle,
  normalizeThemeName,
  parseBool
} from './constants.js';
import {
  formatCompactVolume,
  formatPrice,
  formatSignedPercent
} from './format.js';
import { getExchangeAdapter, resolveExchangeId } from './exchanges.js';
import { frameScheduler, getGlobalHub } from './hub.js';
import { ChartCanvasRenderer } from './renderer.js';

const ICON_CANDLES =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M4.5 2v2.5M4.5 11.5V14"/>' +
  '<rect x="2.9" y="4.5" width="3.2" height="7" rx="0.7" fill="currentColor" fill-opacity="0.2"/>' +
  '<path d="M11.5 2.5v3M11.5 10.5v3"/>' +
  '<rect x="9.9" y="5.5" width="3.2" height="5" rx="0.7"/>' +
  '</svg>';

const ICON_LINE =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M1.8 11.2 5.4 7.6l3 2.6 5.8-6.2"/>' +
  '</svg>';

const ICON_EXPAND =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>' +
  '</svg>';

const ICON_COMPRESS =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/>' +
  '</svg>';

const WIDGET_CSS = `
:host {
  display: block;
  width: 100%;
  height: var(--trw-height, var(--trw-default-h, 380px));
  min-height: 88px;
  box-sizing: border-box;
  contain: layout style paint;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
:host([compact]:not([compact="off"]):not([compact="false"]):not([compact="0"])),
:host([data-compact]:not([data-compact="off"]):not([data-compact="false"]):not([data-compact="0"])) {
  --trw-default-h: 128px;
}
*, *::before, *::after {
  box-sizing: border-box;
}
[hidden] {
  display: none !important;
}
.trw-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--trw-bg);
  color: var(--trw-text);
  border: 0;
  border-radius: var(--trw-radius, 12px);
  overflow: hidden;
}
.trw-card.is-borderless {
  border-radius: 0;
}
.trw-card.is-fullscreen,
.trw-card:fullscreen {
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  border-radius: 0 !important;
  border: 0 !important;
}
.trw-card.is-pseudo-fullscreen {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  z-index: 2147483647 !important;
  border-radius: 0 !important;
  border: 0 !important;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
}
.trw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 40px;
  min-height: 40px;
  padding: 0 12px;
  background: transparent;
  border: 0;
  flex-shrink: 0;
}
.trw-card[data-size="mini"] .trw-header {
  height: 30px;
  min-height: 30px;
  padding: 0 9px;
}
.trw-market {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}
.trw-pair {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--trw-text);
  white-space: nowrap;
}
.trw-card[data-size="mini"] .trw-pair {
  font-size: 12px;
}
.trw-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--trw-text-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}
.trw-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--trw-text-muted);
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}
.trw-dot[data-state="live"] {
  background: var(--trw-up);
}
.trw-dot[data-state="offline"] {
  background: var(--trw-down);
}
.trw-price {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  color: var(--trw-text);
  white-space: nowrap;
  transition: color 0.18s ease;
}
.trw-card[data-size="mini"] .trw-price {
  font-size: 12px;
}
.trw-price.is-flash-up {
  color: var(--trw-up);
}
.trw-price.is-flash-down {
  color: var(--trw-down);
}
.trw-pct {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}
.trw-pct.is-up {
  color: var(--trw-up);
}
.trw-pct.is-down {
  color: var(--trw-down);
}
.trw-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.trw-tf-group,
.trw-type-group {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0;
  gap: 2px;
  background: none;
  border: 0;
}
.trw-tf-btn,
.trw-type-btn,
.trw-fs-btn {
  appearance: none;
  border: 0;
  margin: 0;
  background: transparent;
  color: var(--trw-text-muted);
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  transition: background-color 0.12s ease, color 0.12s ease;
}
.trw-tf-btn {
  min-width: 26px;
  padding: 0 6px;
}
.trw-type-btn,
.trw-fs-btn {
  width: 26px;
  padding: 0;
}
.trw-type-btn svg,
.trw-fs-btn svg {
  width: 14px;
  height: 14px;
  display: block;
  flex-shrink: 0;
}
.trw-tf-btn:hover,
.trw-type-btn:hover,
.trw-fs-btn:hover {
  color: var(--trw-text);
  background: var(--trw-control-hover);
}
.trw-tf-btn.is-active,
.trw-type-btn.is-active {
  background: var(--trw-control-active);
  color: var(--trw-text);
  font-weight: 500;
}
.trw-tf-select {
  display: none;
  appearance: none;
  height: 26px;
  padding: 0 20px 0 8px;
  border-radius: 6px;
  border: 0;
  outline: none;
  background-color: var(--trw-control-bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10' fill='none' stroke='%238890a4' stroke-width='1.4' stroke-linecap='round'%3E%3Cpath d='M2.5 3.8 5 6.3l2.5-2.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  color: var(--trw-text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
}
.trw-card[data-size="medium"] .trw-tf-group,
.trw-card[data-size="compact"] .trw-tf-group {
  display: none;
}
.trw-card[data-size="medium"] .trw-tf-select,
.trw-card[data-size="compact"] .trw-tf-select {
  display: inline-block;
}
.trw-card[data-size="compact"] .trw-badge-text,
.trw-card[data-size="mini"] .trw-badge-text {
  display: none;
}
.trw-card[data-size="mini"] .trw-controls {
  display: none;
}
.trw-stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}
.trw-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
}
.trw-legend {
  position: absolute;
  top: 4px;
  left: 12px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--trw-text-secondary);
  pointer-events: none;
  background: none;
  border: 0;
  padding: 0;
}
.trw-legend i {
  font-style: normal;
  font-weight: 400;
  color: var(--trw-text-muted);
  margin-right: 3px;
}
.trw-card[data-size="compact"] .trw-legend,
.trw-card[data-size="mini"] .trw-legend {
  display: none;
}
.trw-watermark {
  position: absolute;
  left: 12px;
  bottom: 28px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--trw-logo);
  text-decoration: none;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}
.trw-watermark:hover {
  opacity: 0.95;
}
.trw-watermark svg {
  width: 18px;
  height: 18px;
  display: block;
  flex-shrink: 0;
}
.trw-card[data-axes="off"] .trw-watermark,
.trw-card[data-size="mini"] .trw-watermark {
  bottom: 8px;
  left: 9px;
  width: 16px;
  height: 16px;
}
.trw-card[data-axes="off"] .trw-watermark svg,
.trw-card[data-size="mini"] .trw-watermark svg {
  width: 15px;
  height: 15px;
}
.trw-reset-btn {
  position: absolute;
  right: 72px;
  bottom: 28px;
  z-index: 3;
  appearance: none;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 0;
  background: var(--trw-control-active);
  color: var(--trw-text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.trw-reset-btn:hover {
  background: var(--trw-control-hover);
}
.trw-card[data-axes="off"] .trw-reset-btn {
  bottom: 8px;
}
.trw-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
  background: var(--trw-bg);
  color: var(--trw-text-muted);
  font-size: 12px;
  font-weight: 400;
}
.trw-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--trw-control-active);
  border-top-color: var(--trw-text-secondary);
  animation: trw-spin 0.75s linear infinite;
}
.trw-retry-btn {
  appearance: none;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  border: 0;
  background: var(--trw-control-active);
  color: var(--trw-text);
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  cursor: pointer;
}
.trw-retry-btn:hover {
  background: var(--trw-control-hover);
}
@keyframes trw-spin {
  to { transform: rotate(360deg); }
}
@media (pointer: coarse) {
  .trw-tf-group,
  .trw-type-group { height: 28px; }
  .trw-tf-btn { min-width: 30px; height: 28px; }
  .trw-type-btn,
  .trw-fs-btn { width: 28px; height: 28px; }
  .trw-tf-select { height: 28px; }
}
`;

let sharedStyleSheet = null;
function applyShadowStyles(shadowRoot) {
  if (
    typeof CSSStyleSheet === 'function' &&
    'adoptedStyleSheets' in shadowRoot &&
    typeof CSSStyleSheet.prototype.replaceSync === 'function'
  ) {
    if (!sharedStyleSheet) {
      sharedStyleSheet = new CSSStyleSheet();
      sharedStyleSheet.replaceSync(WIDGET_CSS);
    }
    shadowRoot.adoptedStyleSheets = [sharedStyleSheet];
    return;
  }
  const styleEl = document.createElement('style');
  styleEl.textContent = WIDGET_CSS;
  shadowRoot.appendChild(styleEl);
}

function cleanColorOpt(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

export class TradingRayChartWidget {
  constructor(target, options = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host || typeof host !== 'object') {
      throw new Error('TradingRayWidget: valid container element or selector is required.');
    }

    this.host = host;
    this.hub = options.hub || getGlobalHub();
    this.destroyed = false;

    this.options = this._normalizeOptions(options);

    // Runtime state
    this.candles = [];
    this.livePrice = 0;
    this.change24h = 0;
    this.open24h = 0;
    this.high24h = 0;
    this.low24h = 0;
    this.volume24h = 0;
    this.wsState = 'connecting';
    this.isFullscreen = false;
    this.isPseudoFullscreen = false;
    this.isIntersecting = true;
    this.loadToken = 0;
    this.unsubscribeStream = null;
    this.backfillLoading = false;
    this.backfillExhausted = false;
    this.flashTimer = null;

    this.pointer = { active: false, x: 0, y: 0 };
    this.dragState = null;
    this.activeTouches = new Map();
    this.touchGesture = null;
    this.pinchStartDist = 0;
    this.pinchPrevMidX = 0;

    this._renderFrame = this._renderFrame.bind(this);
    this._onFsChange = this._onFsChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);

    this._mountDom();
    this._applyTheme();
    this._syncUiControls();
    this._bindEvents();
    this._connectMarket(true);
  }

  _normalizeOptions(raw = {}) {
    const exchange = resolveExchangeId(raw.exchange || 'binance');
    const adapter = getExchangeAdapter(exchange);
    const resolvedSym = adapter.resolveSymbol(raw.symbol || 'BTCUSDT');

    return {
      exchange,
      rawSymbol: String(raw.symbol || 'BTCUSDT').trim(),
      symbol: resolvedSym.symbol,
      displayPair: raw.title || resolvedSym.displayPair,
      interval: normalizeInterval(raw.interval || raw.timeframe || '1h'),
      type: normalizeChartType(raw.type || raw.chartType || 'candles'),
      theme: normalizeThemeName(raw.theme || 'dark'),
      watermark: parseBool(raw.watermark, true),
      toolbar: parseBool(raw.toolbar ?? raw.header, true),
      volume: parseBool(raw.volume, true),
      axes: parseBool(raw.axes, true),
      grid: parseBool(raw.grid, true),
      legend: parseBool(raw.legend, true),
      crosshair: parseBool(raw.crosshair, true),
      priceLine: parseBool(raw.priceLine, true),
      areaFill: parseBool(raw.areaFill, true),
      pulse: parseBool(raw.pulse, true),
      hollowCandles: parseBool(raw.hollowCandles, false),
      fullscreenButton: parseBool(raw.fullscreen ?? raw.allowFullscreen, true),
      compact: parseBool(raw.compact ?? raw.minimal, false),
      borderless: parseBool(raw.borderless, false),

      // Flexible style & color overrides
      upColor: cleanColorOpt(raw.upColor),
      downColor: cleanColorOpt(raw.downColor),
      wickUpColor: cleanColorOpt(raw.wickUpColor),
      wickDownColor: cleanColorOpt(raw.wickDownColor),
      lineColor: cleanColorOpt(raw.lineColor) || 'auto',
      lineWidth: clampNumber(raw.lineWidth, 1, 5, 2),
      areaTopColor: cleanColorOpt(raw.areaTopColor),
      areaBottomColor: cleanColorOpt(raw.areaBottomColor),
      priceLineColor: cleanColorOpt(raw.priceLineColor) || 'auto',
      priceLineStyle: normalizeLineStyle(raw.priceLineStyle, 'dashed'),
      bgColor: cleanColorOpt(raw.bgColor),
      textColor: cleanColorOpt(raw.textColor),
      gridColor: cleanColorOpt(raw.gridColor),
      volumeUpColor: cleanColorOpt(raw.volumeUpColor),
      volumeDownColor: cleanColorOpt(raw.volumeDownColor),
      crosshairColor: cleanColorOpt(raw.crosshairColor),
      radius: raw.radius !== undefined && raw.radius !== null && raw.radius !== ''
        ? clampNumber(raw.radius, 0, 40, 12)
        : null,
      initialBars: clampNumber(raw.initialBars, 0, 500, 0),

      locale: raw.locale ? String(raw.locale).trim() : '',
      timezone: raw.timezone ? String(raw.timezone).trim() : '',
      proxyUrl: raw.proxyUrl ? String(raw.proxyUrl).trim() : '',
      height: raw.height ? String(raw.height).trim() : ''
    };
  }

  _resolveActiveTheme() {
    if (this.options.theme === 'auto') {
      const prefersLight =
        typeof globalThis.matchMedia === 'function' &&
        globalThis.matchMedia('(prefers-color-scheme: light)').matches;
      return prefersLight ? THEMES.light : THEMES.dark;
    }
    return this.options.theme === 'light' ? THEMES.light : THEMES.dark;
  }

  _mountDom() {
    if (this.options.height) {
      const h = /^\d+$/.test(this.options.height) ? `${this.options.height}px` : this.options.height;
      this.host.style.setProperty('--trw-height', h);
    }

    const shadow = this.host.shadowRoot || this.host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';
    applyShadowStyles(shadow);
    this.shadow = shadow;

    const card = document.createElement('div');
    card.className = 'trw-card';
    card.dataset.size = this.options.compact ? 'mini' : 'wide';

    // Header
    const header = document.createElement('div');
    header.className = 'trw-header';

    const market = document.createElement('div');
    market.className = 'trw-market';

    const pairEl = document.createElement('span');
    pairEl.className = 'trw-pair';

    const badgeEl = document.createElement('span');
    badgeEl.className = 'trw-badge';
    const dotEl = document.createElement('i');
    dotEl.className = 'trw-dot';
    dotEl.dataset.state = 'connecting';
    const badgeTextEl = document.createElement('span');
    badgeTextEl.className = 'trw-badge-text';
    badgeEl.append(dotEl, badgeTextEl);

    const priceEl = document.createElement('span');
    priceEl.className = 'trw-price';
    priceEl.textContent = '—';

    const pctEl = document.createElement('span');
    pctEl.className = 'trw-pct is-up';
    pctEl.hidden = true;

    market.append(pairEl, badgeEl, priceEl, pctEl);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'trw-controls';

    const tfGroup = document.createElement('div');
    tfGroup.className = 'trw-tf-group';
    tfGroup.setAttribute('role', 'group');
    tfGroup.setAttribute('aria-label', 'Timeframe');

    this.tfButtons = new Map();
    for (let i = 0; i < TOOLBAR_INTERVALS.length; i++) {
      const tf = TOOLBAR_INTERVALS[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'trw-tf-btn';
      btn.dataset.tf = tf;
      btn.textContent = tf;
      btn.addEventListener('click', () => this.setInterval(tf));
      tfGroup.appendChild(btn);
      this.tfButtons.set(tf, btn);
    }

    const tfSelect = document.createElement('select');
    tfSelect.className = 'trw-tf-select';
    tfSelect.setAttribute('aria-label', 'Timeframe');
    for (let i = 0; i < SUPPORTED_INTERVALS.length; i++) {
      const tf = SUPPORTED_INTERVALS[i];
      const opt = document.createElement('option');
      opt.value = tf;
      opt.textContent = tf;
      tfSelect.appendChild(opt);
    }
    tfSelect.addEventListener('change', () => this.setInterval(tfSelect.value));

    const typeGroup = document.createElement('div');
    typeGroup.className = 'trw-type-group';
    typeGroup.setAttribute('role', 'group');
    typeGroup.setAttribute('aria-label', 'Chart type');

    const btnCandles = document.createElement('button');
    btnCandles.type = 'button';
    btnCandles.className = 'trw-type-btn';
    btnCandles.title = 'Candlesticks';
    btnCandles.setAttribute('aria-label', 'Candlesticks');
    btnCandles.innerHTML = ICON_CANDLES;
    btnCandles.addEventListener('click', () => this.setType('candles'));

    const btnLine = document.createElement('button');
    btnLine.type = 'button';
    btnLine.className = 'trw-type-btn';
    btnLine.title = 'Price Line';
    btnLine.setAttribute('aria-label', 'Price Line');
    btnLine.innerHTML = ICON_LINE;
    btnLine.addEventListener('click', () => this.setType('line'));

    typeGroup.append(btnCandles, btnLine);

    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.className = 'trw-fs-btn';
    fsBtn.title = 'Fullscreen';
    fsBtn.setAttribute('aria-label', 'Toggle fullscreen');
    fsBtn.innerHTML = ICON_EXPAND;
    fsBtn.addEventListener('click', () => this.toggleFullscreen());

    controls.append(tfGroup, tfSelect, typeGroup, fsBtn);
    header.append(market, controls);

    // Stage
    const stage = document.createElement('div');
    stage.className = 'trw-stage';

    const canvas = document.createElement('canvas');
    canvas.className = 'trw-canvas';

    const legend = document.createElement('div');
    legend.className = 'trw-legend';
    legend.hidden = true;

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'trw-reset-btn';
    resetBtn.textContent = 'Live ▸';
    resetBtn.title = 'Jump to latest candle';
    resetBtn.hidden = true;
    resetBtn.addEventListener('click', () => {
      this.renderer.scrollToRealtime();
      this.requestRender();
    });

    // Logo-only frameless, backgroundless TradingRay watermark
    const watermark = document.createElement('a');
    watermark.className = 'trw-watermark';
    watermark.href = BRAND_URL;
    watermark.target = '_blank';
    watermark.rel = 'noopener';
    watermark.title = BRAND_NAME;
    watermark.setAttribute('aria-label', BRAND_NAME);
    watermark.innerHTML = BRAND_LOGO_SVG;

    const overlay = document.createElement('div');
    overlay.className = 'trw-overlay';
    overlay.innerHTML = '<div class="trw-spinner"></div><span>Loading market data…</span>';

    stage.append(canvas, legend, resetBtn, watermark, overlay);
    card.append(header, stage);
    shadow.appendChild(card);

    this.els = {
      card,
      header,
      pairEl,
      badgeEl,
      dotEl,
      badgeTextEl,
      priceEl,
      pctEl,
      tfGroup,
      tfSelect,
      btnCandles,
      btnLine,
      fsBtn,
      stage,
      canvas,
      legend,
      resetBtn,
      watermark,
      overlay
    };

    this.renderer = new ChartCanvasRenderer(canvas);
  }

  _applyTheme() {
    const t = this._resolveActiveTheme();
    this.activeTheme = t;
    const o = this.options;
    const s = this.els.card.style;
    s.setProperty('--trw-bg', o.bgColor || t.bg);
    s.setProperty('--trw-surface', t.surface);
    s.setProperty('--trw-control-bg', t.controlBg);
    s.setProperty('--trw-control-hover', t.controlHover);
    s.setProperty('--trw-control-active', t.controlActive);
    s.setProperty('--trw-text', o.textColor || t.text);
    s.setProperty('--trw-text-secondary', o.textColor || t.textSecondary);
    s.setProperty('--trw-text-muted', o.textColor || t.textMuted);
    s.setProperty('--trw-logo', t.logoColor);
    s.setProperty('--trw-up', o.upColor || t.up);
    s.setProperty('--trw-down', o.downColor || t.down);

    if (o.radius !== null) {
      s.setProperty('--trw-radius', `${o.radius}px`);
    } else {
      s.removeProperty('--trw-radius');
    }
  }

  _syncUiControls() {
    const {
      exchange,
      displayPair,
      interval,
      type,
      watermark,
      toolbar,
      axes,
      fullscreenButton,
      borderless
    } = this.options;
    const adapter = getExchangeAdapter(exchange);

    this.els.pairEl.textContent = displayPair;
    this.els.badgeTextEl.textContent = adapter.badge || adapter.name;
    this.els.badgeEl.title = `${adapter.name} (${this.options.symbol}) — real-time WebSocket`;

    this.els.header.hidden = !toolbar;
    this.els.watermark.hidden = !watermark;
    this.els.fsBtn.hidden = !fullscreenButton;
    this.els.card.classList.toggle('is-borderless', Boolean(borderless));
    this.els.card.dataset.axes = axes ? 'on' : 'off';

    for (const [tf, btn] of this.tfButtons.entries()) {
      btn.classList.toggle('is-active', tf === interval);
    }
    this.els.tfSelect.value = interval;
    this.els.btnCandles.classList.toggle('is-active', type === 'candles');
    this.els.btnLine.classList.toggle('is-active', type === 'line');
  }

  _updateResponsiveTier(width, height) {
    if (this.options.compact || height < 145) {
      this.els.card.dataset.size = 'mini';
    } else if (width < 350) {
      this.els.card.dataset.size = 'compact';
    } else if (width < 540) {
      this.els.card.dataset.size = 'medium';
    } else {
      this.els.card.dataset.size = 'wide';
    }
  }

  _getZone(x, y) {
    if (this.renderer.axisW > 0 && x > this.renderer.plotW) {
      return 'priceAxis';
    }
    if (this.renderer.timeAxisH > 0 && y > this.renderer.plotH) {
      return 'timeAxis';
    }
    return 'plot';
  }

  _cursorForZone(zone) {
    if (zone === 'priceAxis') return 'ns-resize';
    if (zone === 'timeAxis') return 'ew-resize';
    return 'crosshair';
  }

  _bindEvents() {
    // 1. Container ResizeObserver
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.destroyed) return;
        this._measureAndResize();
      });
      this.resizeObserver.observe(this.els.card);
      this.resizeObserver.observe(this.els.stage);
    }

    // 2. Viewport Hibernation IntersectionObserver
    if (typeof IntersectionObserver === 'function') {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          const wasVisible = this.isIntersecting;
          this.isIntersecting = entry.isIntersecting;
          if (!wasVisible && this.isIntersecting) {
            this._measureAndResize();
          }
        },
        { threshold: 0.01 }
      );
      this.intersectionObserver.observe(this.host);
    }

    // 3. Auto dark/light system theme listener
    if (typeof globalThis.matchMedia === 'function') {
      this.mediaQuery = globalThis.matchMedia('(prefers-color-scheme: light)');
      this._onSchemeChange = () => {
        if (this.options.theme === 'auto') {
          this._applyTheme();
          this.requestRender();
        }
      };
      if (typeof this.mediaQuery.addEventListener === 'function') {
        this.mediaQuery.addEventListener('change', this._onSchemeChange);
      }
    }

    // 4. Fullscreen events
    document.addEventListener('fullscreenchange', this._onFsChange);
    document.addEventListener('webkitfullscreenchange', this._onFsChange);
    document.addEventListener('keydown', this._onKeyDown);

    // 5. Mouse, Timeline/Price-Axis Scaling & Wheel Interactions
    const canvas = this.els.canvas;

    canvas.addEventListener('mousemove', (e) => {
      if (this.dragState) return; // Window drag listener owns active drags
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const zone = this._getZone(x, y);

      canvas.style.cursor = this._cursorForZone(zone);
      if (zone === 'plot') {
        this.pointer.active = true;
        this.pointer.x = x;
        this.pointer.y = y;
      } else {
        this.pointer.active = false;
      }
      this.requestRender();
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.candles.length) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const zone = this._getZone(x, y);

      this.dragState = {
        zone,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        startRightOffset: this.renderer.rightOffsetBars,
        startBarSpacing: this.renderer.barSpacing,
        timeAnchorX: this.renderer.getTimeScaleAnchorX(this.candles.length)
      };

      this.pointer.active = false;
      canvas.style.cursor = zone === 'plot' ? 'grabbing' : this._cursorForZone(zone);
      this.requestRender();

      const onWindowMove = (ev) => {
        const st = this.dragState;
        if (!st) return;
        const r = canvas.getBoundingClientRect();
        const mx = ev.clientX - r.left;
        const my = ev.clientY - r.top;

        if (st.zone === 'plot') {
          const totalDx = mx - st.startX;
          this.renderer.setRightOffsetBars(
            st.startRightOffset - totalDx / this.renderer.barSpacing,
            this.candles.length
          );
          if (this.renderer.manualPriceScale) {
            this.renderer.panPriceByPixels(my - st.lastY);
          }
        } else if (st.zone === 'timeAxis') {
          const totalDx = mx - st.startX;
          const targetSpacing = st.startBarSpacing * Math.exp(-totalDx * 0.0045);
          this.renderer.setBarSpacingAnchored(targetSpacing, st.timeAnchorX, this.candles.length);
        } else if (st.zone === 'priceAxis') {
          this.renderer.scalePriceAxis(my - st.lastY);
        }

        st.lastX = mx;
        st.lastY = my;
        this.requestRender();
      };

      const onWindowUp = (ev) => {
        this.dragState = null;
        window.removeEventListener('mousemove', onWindowMove);
        window.removeEventListener('mouseup', onWindowUp);

        const r = canvas.getBoundingClientRect();
        const mx = ev.clientX - r.left;
        const my = ev.clientY - r.top;
        const inside = mx >= 0 && mx <= r.width && my >= 0 && my <= r.height;
        if (inside) {
          const hoverZone = this._getZone(mx, my);
          canvas.style.cursor = this._cursorForZone(hoverZone);
          if (hoverZone === 'plot') {
            this.pointer.active = true;
            this.pointer.x = mx;
            this.pointer.y = my;
          }
        } else {
          canvas.style.cursor = 'crosshair';
          this.pointer.active = false;
        }
        this.requestRender();
      };

      window.addEventListener('mousemove', onWindowMove);
      window.addEventListener('mouseup', onWindowUp);
    });

    canvas.addEventListener('mouseleave', () => {
      if (!this.dragState) {
        this.pointer.active = false;
        this.requestRender();
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const zone = this._getZone(x, y);

      if (zone === 'priceAxis') {
        this.renderer.resetPriceScale();
      } else if (zone === 'timeAxis') {
        this.renderer.resetTimeScale(this.renderer.cssWidth, this.options.initialBars);
      } else {
        this.renderer.resetView(this.renderer.cssWidth, this.options.initialBars);
      }
      this.requestRender();
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.candles.length) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const zone = this._getZone(x, y);

        const modeScale = e.deltaMode === 1 ? 32 : (e.deltaMode === 2 ? 240 : 1);
        const normX = e.deltaX * modeScale;
        const normY = e.deltaY * modeScale;

        if (zone === 'priceAxis') {
          if (Math.abs(normY) > 0.05) {
            this.renderer.scalePriceAxis(Math.max(-160, Math.min(160, normY)) * 0.55);
          }
        } else if (zone === 'timeAxis') {
          const delta = Math.abs(normY) >= Math.abs(normX) ? normY : normX;
          if (Math.abs(delta) > 0.05) {
            const clamped = Math.max(-180, Math.min(180, delta));
            const factor = Math.exp(-clamped * 0.0022);
            this.renderer.zoomAtX(
              this.renderer.getTimeScaleAnchorX(this.candles.length),
              factor,
              this.candles.length
            );
          }
        } else if (Math.abs(normX) > Math.abs(normY) * 1.15 && Math.abs(normX) > 0.5) {
          // Natural horizontal trackpad two-finger pan
          this.renderer.panByPixels(-normX, this.candles.length);
        } else if (Math.abs(normY) > 0.05) {
          // Smooth cursor-anchored time zoom
          const clampedY = Math.max(-180, Math.min(180, normY));
          const factor = Math.exp(-clampedY * 0.0022);
          this.renderer.zoomAtX(x, factor, this.candles.length);
        } else {
          return;
        }
        this.requestRender();
      },
      { passive: false }
    );

    // 6. Touch Pan, Axis Drag & 2-Finger Pinch Zoom
    let lastTapTime = 0;
    canvas.addEventListener(
      'touchstart',
      (e) => {
        const rect = canvas.getBoundingClientRect();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const tx = t.clientX - rect.left;
          const ty = t.clientY - rect.top;
          this.activeTouches.set(t.identifier, {
            startX: tx,
            startY: ty,
            x: tx,
            y: ty
          });
        }

        if (this.activeTouches.size === 1) {
          const pt = [...this.activeTouches.values()][0];
          const zone = this._getZone(pt.x, pt.y);
          if (zone === 'priceAxis') this.touchGesture = 'priceAxis';
          else if (zone === 'timeAxis') this.touchGesture = 'timeAxis';
          else this.touchGesture = 'pending';

          const now = Date.now();
          if (now - lastTapTime < 280) {
            this.renderer.resetView(this.renderer.cssWidth, this.options.initialBars);
            this.pointer.active = false;
            this.requestRender();
          }
          lastTapTime = now;
        } else if (this.activeTouches.size >= 2) {
          this.touchGesture = 'pinch';
          this.pointer.active = false;
          const pts = [...this.activeTouches.values()];
          this.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          this.pinchPrevMidX = (pts[0].x + pts[1].x) * 0.5;
        }
      },
      { passive: true }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (!this.candles.length || this.activeTouches.size === 0) return;
        const rect = canvas.getBoundingClientRect();

        if (this.activeTouches.size === 1 && this.touchGesture !== 'pinch') {
          const t = e.changedTouches[0];
          const state = this.activeTouches.get(t.identifier);
          if (!state) return;
          const nx = t.clientX - rect.left;
          const ny = t.clientY - rect.top;
          const stepDx = nx - state.x;
          const stepDy = ny - state.y;

          if (this.touchGesture === 'pending') {
            const totalDx = Math.abs(nx - state.startX);
            const totalDy = Math.abs(ny - state.startY);
            if (totalDx < 4 && totalDy < 4) return;
            if (totalDx >= totalDy * 0.85 || this.renderer.manualPriceScale) {
              this.touchGesture = 'pan';
            } else {
              this.touchGesture = 'pageScroll';
              return;
            }
          }

          if (this.touchGesture === 'pageScroll') return;

          if (e.cancelable) e.preventDefault();
          state.x = nx;
          state.y = ny;
          this.pointer.active = false;

          if (this.touchGesture === 'pan') {
            this.renderer.panByPixels(stepDx, this.candles.length);
            if (this.renderer.manualPriceScale) {
              this.renderer.panPriceByPixels(stepDy);
            }
          } else if (this.touchGesture === 'timeAxis') {
            this.renderer.scaleTimeAxis(stepDx, this.candles.length);
          } else if (this.touchGesture === 'priceAxis') {
            this.renderer.scalePriceAxis(stepDy);
          }
          this.requestRender();
        } else if (this.activeTouches.size >= 2) {
          if (e.cancelable) e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const prev = this.activeTouches.get(t.identifier);
            if (prev) {
              prev.x = t.clientX - rect.left;
              prev.y = t.clientY - rect.top;
            }
          }
          const pts = [...this.activeTouches.values()];
          const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const midX = (pts[0].x + pts[1].x) * 0.5;

          if (Math.abs(midX - this.pinchPrevMidX) > 0.2) {
            this.renderer.panByPixels(midX - this.pinchPrevMidX, this.candles.length);
          }
          if (this.pinchStartDist > 8 && dist > 8) {
            this.renderer.zoomAtX(midX, dist / this.pinchStartDist, this.candles.length);
            this.pinchStartDist = dist;
          }
          this.pinchPrevMidX = midX;
          this.requestRender();
        }
      },
      { passive: false }
    );

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.activeTouches.delete(e.changedTouches[i].identifier);
      }
      if (this.activeTouches.size < 2) {
        this.pinchStartDist = 0;
      }
      if (this.activeTouches.size === 0) {
        this.touchGesture = null;
      }
    };
    canvas.addEventListener('touchend', endTouch, { passive: true });
    canvas.addEventListener('touchcancel', endTouch, { passive: true });

    // Initial synchronous size measurement
    this._measureAndResize();
  }

  _measureAndResize() {
    if (this.destroyed) return;
    const cardRect = this.els.card.getBoundingClientRect();
    const stageRect = this.els.stage.getBoundingClientRect();
    if (cardRect.width > 0 && cardRect.height > 0) {
      this._updateResponsiveTier(cardRect.width, cardRect.height);
    }
    if (stageRect.width > 0 && stageRect.height > 0) {
      const firstInit = this.renderer.cssWidth === 0;
      this.renderer.resize(stageRect.width, stageRect.height);
      if (firstInit) {
        this.renderer.resetView(stageRect.width, this.options.initialBars);
      }
      this.requestRender();
    }
  }

  _showLoading() {
    this.els.overlay.hidden = false;
    this.els.overlay.innerHTML = '<div class="trw-spinner"></div><span>Loading market data…</span>';
  }

  _showError(message) {
    this.els.overlay.hidden = false;
    this.els.overlay.innerHTML = '';
    const msgEl = document.createElement('span');
    msgEl.textContent = message || 'Unable to load market data';
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'trw-retry-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => this._connectMarket(true));
    this.els.overlay.append(msgEl, retryBtn);
  }

  _hideOverlay() {
    this.els.overlay.hidden = true;
  }

  async _connectMarket(resetViewport = false) {
    if (this.destroyed) return;
    const token = ++this.loadToken;

    if (this.unsubscribeStream) {
      this.unsubscribeStream();
      this.unsubscribeStream = null;
    }

    this.backfillLoading = false;
    this.backfillExhausted = false;
    if (resetViewport) {
      this.candles = [];
      this.pointer.active = false;
      this._showLoading();
    }

    const { exchange, symbol, interval, proxyUrl } = this.options;

    const subscribeLive = (targetSymbol) => {
      if (this.destroyed || token !== this.loadToken) return;
      if (this.unsubscribeStream) this.unsubscribeStream();
      this.unsubscribeStream = this.hub.subscribe({
        exchange,
        symbol: targetSymbol,
        interval,
        onStatus: (st) => {
          this.wsState = st;
          this.els.dotEl.dataset.state = st === 'live' ? 'live' : (st === 'offline' ? 'offline' : 'connecting');
        },
        onCandle: (candle) => this._handleIncomingCandle(candle),
        onTicker: (ticker) => this._handleIncomingTicker(ticker)
      });
    };

    subscribeLive(symbol);

    try {
      const snap = await this.hub.fetchSnapshot({
        exchange,
        symbol,
        interval,
        limit: 300,
        proxyUrl
      });
      if (this.destroyed || token !== this.loadToken) return;

      if (snap.resolvedSymbol && snap.resolvedSymbol !== this.options.symbol) {
        this.options.symbol = snap.resolvedSymbol;
        subscribeLive(snap.resolvedSymbol);
      }

      this._mergeSnapshotCandles(snap.candles);
      if (snap.ticker) {
        this._applyTickerStats(snap.ticker, false);
      } else if (this.candles.length > 0) {
        const first = this.candles[0];
        const last = this.candles[this.candles.length - 1];
        this._applyTickerStats({
          price: last.close,
          open24h: first.open,
          change24h: first.open > 0 ? ((last.close - first.open) / first.open) * 100 : 0
        }, false);
      }

      if (resetViewport) {
        this.renderer.resetView(this.renderer.cssWidth, this.options.initialBars);
      }
      this._hideOverlay();
      this.requestRender();
    } catch {
      if (this.destroyed || token !== this.loadToken) return;
      if (this.candles.length === 0) {
        const adapter = getExchangeAdapter(exchange);
        this._showError(`Could not load ${this.options.displayPair} from ${adapter.name}`);
      }
    }
  }

  _mergeSnapshotCandles(snapshotCandles) {
    if (!Array.isArray(snapshotCandles) || snapshotCandles.length === 0) return;
    if (this.candles.length === 0) {
      this.candles = snapshotCandles;
      return;
    }
    const byTime = new Map();
    for (let i = 0; i < snapshotCandles.length; i++) {
      byTime.set(snapshotCandles[i].time, snapshotCandles[i]);
    }
    for (let i = 0; i < this.candles.length; i++) {
      byTime.set(this.candles[i].time, this.candles[i]);
    }
    this.candles = [...byTime.values()].sort((a, b) => a.time - b.time);
  }

  _handleIncomingCandle(candle) {
    if (this.destroyed || !candle || !(candle.close > 0)) return;
    if (!this.els.overlay.hidden) {
      this._hideOverlay();
    }

    const list = this.candles;
    const len = list.length;
    if (len === 0) {
      list.push({ ...candle });
    } else {
      const last = list[len - 1];
      if (candle.time === last.time) {
        last.open = candle.open;
        last.high = candle.high;
        last.low = candle.low;
        last.close = candle.close;
        last.volume = candle.volume;
      } else if (candle.time > last.time) {
        list.push({ ...candle });
        if (list.length > 1500 && !this.renderer.isPannedAway()) {
          list.shift();
        }
      } else {
        for (let i = len - 2; i >= Math.max(0, len - 10); i--) {
          if (list[i].time === candle.time) {
            list[i] = { ...candle };
            break;
          }
        }
      }
    }

    const patch = { price: candle.close };
    if (this.open24h > 0) {
      patch.change24h = ((candle.close - this.open24h) / this.open24h) * 100;
    }
    this._applyTickerStats(patch, true);
    this.requestRender();
  }

  _handleIncomingTicker(ticker) {
    if (this.destroyed || !ticker) return;
    this._applyTickerStats(ticker, true);

    const price = ticker.price;
    if (price > 0 && this.candles.length > 0) {
      const intervalSec = INTERVAL_SECONDS[this.options.interval] || 3600;
      const nowSec = ticker.tsSec || Math.floor(Date.now() / 1000);
      const bucketTime = Math.floor(nowSec / intervalSec) * intervalSec;
      const last = this.candles[this.candles.length - 1];

      if (bucketTime === last.time) {
        last.close = price;
        if (price > last.high) last.high = price;
        if (price < last.low) last.low = price;
        if (ticker.tradeSize > 0) last.volume += ticker.tradeSize;
        this.requestRender();
      } else if (bucketTime > last.time && bucketTime - last.time <= intervalSec * 4) {
        this.candles.push({
          time: bucketTime,
          open: last.close,
          high: Math.max(last.close, price),
          low: Math.min(last.close, price),
          close: price,
          volume: ticker.tradeSize > 0 ? ticker.tradeSize : 0
        });
        this.requestRender();
      }
    }
  }

  _applyTickerStats(t, animateFlash) {
    const prevPrice = this.livePrice;
    if (t.open24h > 0) this.open24h = t.open24h;
    if (t.high24h > 0) this.high24h = t.high24h;
    if (t.low24h > 0) this.low24h = t.low24h;
    if (t.volume24h >= 0 && t.volume24h !== undefined) this.volume24h = t.volume24h;

    if (t.price > 0) {
      this.livePrice = t.price;
      this.els.priceEl.textContent = formatPrice(t.price);

      if (animateFlash && prevPrice > 0 && t.price !== prevPrice) {
        const cls = t.price > prevPrice ? 'is-flash-up' : 'is-flash-down';
        this.els.priceEl.classList.remove('is-flash-up', 'is-flash-down');
        this.els.priceEl.classList.add(cls);
        if (this.flashTimer) clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => {
          this.els.priceEl.classList.remove('is-flash-up', 'is-flash-down');
        }, 240);
      }
    }

    if (t.change24h !== undefined && Number.isFinite(t.change24h)) {
      this.change24h = t.change24h;
      this.els.pctEl.hidden = false;
      this.els.pctEl.textContent = formatSignedPercent(t.change24h);
      const isUp = t.change24h >= 0;
      this.els.pctEl.classList.toggle('is-up', isUp);
      this.els.pctEl.classList.toggle('is-down', !isUp);
    }
  }

  async _maybeBackfillHistory() {
    if (this.backfillLoading || this.backfillExhausted || this.candles.length === 0) return;
    const adapter = getExchangeAdapter(this.options.exchange);
    if (!adapter.supportsBackfill) return;

    this.backfillLoading = true;
    const token = this.loadToken;
    const earliestSec = this.candles[0].time;

    try {
      const snap = await this.hub.fetchSnapshot({
        exchange: this.options.exchange,
        symbol: this.options.symbol,
        interval: this.options.interval,
        limit: 300,
        endTimeMs: earliestSec * 1000 - 1,
        proxyUrl: this.options.proxyUrl
      });
      if (this.destroyed || token !== this.loadToken) return;
      const older = snap.candles.filter((c) => c.time < earliestSec);
      if (older.length === 0) {
        this.backfillExhausted = true;
      } else {
        this.candles = older.concat(this.candles);
        this.requestRender();
      }
    } catch {
      this.backfillExhausted = true;
    } finally {
      this.backfillLoading = false;
    }
  }

  requestRender() {
    if (this.destroyed) return;
    if (!this.isIntersecting && !this.isFullscreen) return;
    frameScheduler.schedule(this._renderFrame);
  }

  _renderFrame() {
    if (this.destroyed) return;
    const o = this.options;
    const intervalSec = INTERVAL_SECONDS[o.interval] || 3600;
    const result = this.renderer.render({
      candles: this.candles,
      type: o.type,
      theme: this.activeTheme,
      intervalSec,
      locale: o.locale,
      timezone: o.timezone,
      showVolume: o.volume,
      showAxes: o.axes,
      showGrid: o.grid,
      showPriceLine: o.priceLine,
      showCrosshair: o.crosshair,
      showPulse: o.pulse,
      areaFill: o.areaFill,
      hollowCandles: o.hollowCandles,
      lineColor: o.lineColor,
      lineWidth: o.lineWidth,
      areaTopColor: o.areaTopColor,
      areaBottomColor: o.areaBottomColor,
      upColor: o.upColor,
      downColor: o.downColor,
      wickUpColor: o.wickUpColor,
      wickDownColor: o.wickDownColor,
      priceLineColor: o.priceLineColor,
      priceLineStyle: o.priceLineStyle,
      bgColor: o.bgColor,
      textColor: o.textColor,
      gridColor: o.gridColor,
      volumeUpColor: o.volumeUpColor,
      volumeDownColor: o.volumeDownColor,
      crosshairColor: o.crosshairColor,
      pointer: this.pointer
    });

    // Update "Jump to Live" button visibility & position
    const panned = this.renderer.isPannedAway();
    this.els.resetBtn.hidden = !panned || o.compact;
    if (panned) {
      this.els.resetBtn.style.right = `${Math.max(10, this.renderer.axisW + 10)}px`;
    }

    // Update frameless OHLCV hover legend (weight 400, no <b> bold)
    const bar = result.hoveredCandle || (this.candles.length ? this.candles[this.candles.length - 1] : null);
    if (bar && o.legend && !o.compact && o.axes) {
      const dec = this.renderer.decimals;
      if (o.type === 'line') {
        if (result.hoveredCandle) {
          this.els.legend.hidden = false;
          this.els.legend.innerHTML = `<span><i>Price</i>${formatPrice(bar.close, dec)}</span>`;
        } else {
          this.els.legend.hidden = true;
        }
      } else {
        const chg = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
        const upCol = o.upColor || this.activeTheme.up;
        const downCol = o.downColor || this.activeTheme.down;
        const color = bar.close >= bar.open ? upCol : downCol;
        this.els.legend.hidden = false;
        this.els.legend.innerHTML =
          `<span><i>O</i>${formatPrice(bar.open, dec)}</span>` +
          `<span><i>H</i>${formatPrice(bar.high, dec)}</span>` +
          `<span><i>L</i>${formatPrice(bar.low, dec)}</span>` +
          `<span style="color:${color}"><i>C</i>${formatPrice(bar.close, dec)} (${formatSignedPercent(chg)})</span>` +
          (bar.volume > 0 ? `<span><i>Vol</i>${formatCompactVolume(bar.volume)}</span>` : '');
      }
    } else {
      this.els.legend.hidden = true;
    }

    if (result.nearLeftEdge) {
      this._maybeBackfillHistory();
    }
  }

  _onFsChange() {
    const fsEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      this.shadow?.fullscreenElement ||
      null;
    const activeNative = fsEl === this.els.card || fsEl === this.host;
    if (!activeNative && !this.isPseudoFullscreen) {
      this.isFullscreen = false;
      this.els.card.classList.remove('is-fullscreen');
    } else if (activeNative) {
      this.isFullscreen = true;
      this.els.card.classList.add('is-fullscreen');
    }
    this.els.fsBtn.innerHTML = this.isFullscreen ? ICON_COMPRESS : ICON_EXPAND;
    this.els.fsBtn.title = this.isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
    this._measureAndResize();
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' && this.isPseudoFullscreen) {
      this.exitFullscreen();
    }
  }

  // ---- Public Imperative API ----

  async enterFullscreen() {
    if (this.destroyed || this.isFullscreen) return;
    const card = this.els.card;
    const req = card.requestFullscreen || card.webkitRequestFullscreen;
    if (typeof req === 'function') {
      try {
        await req.call(card);
        this.isFullscreen = true;
        card.classList.add('is-fullscreen');
        this._onFsChange();
        return;
      } catch {
        // Fall through to pseudo-fullscreen fallback (iOS Safari / sandboxed iframes)
      }
    }
    this.isPseudoFullscreen = true;
    this.isFullscreen = true;
    card.classList.add('is-pseudo-fullscreen');
    this._onFsChange();
  }

  async exitFullscreen() {
    if (this.destroyed || !this.isFullscreen) return;
    if (this.isPseudoFullscreen) {
      this.isPseudoFullscreen = false;
      this.isFullscreen = false;
      this.els.card.classList.remove('is-pseudo-fullscreen');
      this._onFsChange();
      return;
    }
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (typeof exit === 'function') {
      try {
        await exit.call(document);
      } catch {
        // ignore
      }
    }
    this.isFullscreen = false;
    this.els.card.classList.remove('is-fullscreen');
    this._onFsChange();
  }

  toggleFullscreen() {
    return this.isFullscreen ? this.exitFullscreen() : this.enterFullscreen();
  }

  setSymbol(symbol, exchange) {
    const nextEx = exchange ? resolveExchangeId(exchange) : this.options.exchange;
    const adapter = getExchangeAdapter(nextEx);
    const resolved = adapter.resolveSymbol(symbol || this.options.rawSymbol);
    if (nextEx === this.options.exchange && resolved.symbol === this.options.symbol) return this;

    this.options.exchange = nextEx;
    this.options.rawSymbol = String(symbol || this.options.rawSymbol).trim();
    this.options.symbol = resolved.symbol;
    this.options.displayPair = resolved.displayPair;
    this._resetMarketStats();
    this._syncUiControls();
    this._connectMarket(true);
    return this;
  }

  _resetMarketStats() {
    this.livePrice = 0;
    this.change24h = 0;
    this.open24h = 0;
    this.high24h = 0;
    this.low24h = 0;
    this.volume24h = 0;
    this.els.priceEl.textContent = '—';
    this.els.pctEl.hidden = true;
  }

  setExchange(exchange) {
    return this.setSymbol(this.options.rawSymbol, exchange);
  }

  setInterval(interval) {
    const next = normalizeInterval(interval, this.options.interval);
    if (next === this.options.interval) return this;
    this.options.interval = next;
    this._syncUiControls();
    this._connectMarket(true);
    return this;
  }

  setType(type) {
    const next = normalizeChartType(type, this.options.type);
    if (next === this.options.type) return this;
    this.options.type = next;
    this._syncUiControls();
    this.requestRender();
    return this;
  }

  setTheme(theme) {
    this.options.theme = normalizeThemeName(theme, this.options.theme);
    this._applyTheme();
    this.requestRender();
    return this;
  }

  setWatermark(enabled) {
    this.options.watermark = parseBool(enabled, true);
    this.els.watermark.hidden = !this.options.watermark;
    return this;
  }

  updateOptions(patch = {}) {
    let reconnect = false;
    let retheme = false;
    let resetTime = false;

    if (patch.exchange !== undefined || patch.symbol !== undefined) {
      const nextEx = patch.exchange !== undefined ? resolveExchangeId(patch.exchange) : this.options.exchange;
      const nextRawSym = patch.symbol !== undefined ? String(patch.symbol).trim() : this.options.rawSymbol;
      const resolved = getExchangeAdapter(nextEx).resolveSymbol(nextRawSym);
      if (nextEx !== this.options.exchange || resolved.symbol !== this.options.symbol) {
        this.options.exchange = nextEx;
        this.options.rawSymbol = nextRawSym;
        this.options.symbol = resolved.symbol;
        this.options.displayPair = patch.title || resolved.displayPair;
        this._resetMarketStats();
        reconnect = true;
      }
    }
    if (patch.title !== undefined && patch.title !== null) {
      this.options.displayPair = String(patch.title);
    }
    if (patch.interval !== undefined || patch.timeframe !== undefined) {
      const nextTf = normalizeInterval(patch.interval ?? patch.timeframe, this.options.interval);
      if (nextTf !== this.options.interval) {
        this.options.interval = nextTf;
        reconnect = true;
      }
    }
    if (patch.type !== undefined) this.options.type = normalizeChartType(patch.type, this.options.type);
    if (patch.theme !== undefined) {
      this.options.theme = normalizeThemeName(patch.theme, this.options.theme);
      retheme = true;
    }

    if (patch.watermark !== undefined) this.options.watermark = parseBool(patch.watermark, true);
    if (patch.toolbar !== undefined) this.options.toolbar = parseBool(patch.toolbar, true);
    if (patch.volume !== undefined) this.options.volume = parseBool(patch.volume, true);
    if (patch.axes !== undefined) this.options.axes = parseBool(patch.axes, true);
    if (patch.grid !== undefined) this.options.grid = parseBool(patch.grid, true);
    if (patch.legend !== undefined) this.options.legend = parseBool(patch.legend, true);
    if (patch.crosshair !== undefined) this.options.crosshair = parseBool(patch.crosshair, true);
    if (patch.priceLine !== undefined) this.options.priceLine = parseBool(patch.priceLine, true);
    if (patch.areaFill !== undefined) this.options.areaFill = parseBool(patch.areaFill, true);
    if (patch.pulse !== undefined) this.options.pulse = parseBool(patch.pulse, true);
    if (patch.hollowCandles !== undefined) this.options.hollowCandles = parseBool(patch.hollowCandles, false);
    if (patch.fullscreen !== undefined) this.options.fullscreenButton = parseBool(patch.fullscreen, true);
    if (patch.compact !== undefined) this.options.compact = parseBool(patch.compact, false);
    if (patch.borderless !== undefined) this.options.borderless = parseBool(patch.borderless, false);

    // Visual & color overrides
    if (patch.upColor !== undefined) { this.options.upColor = cleanColorOpt(patch.upColor); retheme = true; }
    if (patch.downColor !== undefined) { this.options.downColor = cleanColorOpt(patch.downColor); retheme = true; }
    if (patch.wickUpColor !== undefined) this.options.wickUpColor = cleanColorOpt(patch.wickUpColor);
    if (patch.wickDownColor !== undefined) this.options.wickDownColor = cleanColorOpt(patch.wickDownColor);
    if (patch.lineColor !== undefined) this.options.lineColor = cleanColorOpt(patch.lineColor) || 'auto';
    if (patch.lineWidth !== undefined) this.options.lineWidth = clampNumber(patch.lineWidth, 1, 5, 2);
    if (patch.areaTopColor !== undefined) this.options.areaTopColor = cleanColorOpt(patch.areaTopColor);
    if (patch.areaBottomColor !== undefined) this.options.areaBottomColor = cleanColorOpt(patch.areaBottomColor);
    if (patch.priceLineColor !== undefined) this.options.priceLineColor = cleanColorOpt(patch.priceLineColor) || 'auto';
    if (patch.priceLineStyle !== undefined) this.options.priceLineStyle = normalizeLineStyle(patch.priceLineStyle, 'dashed');
    if (patch.bgColor !== undefined) { this.options.bgColor = cleanColorOpt(patch.bgColor); retheme = true; }
    if (patch.textColor !== undefined) { this.options.textColor = cleanColorOpt(patch.textColor); retheme = true; }
    if (patch.gridColor !== undefined) this.options.gridColor = cleanColorOpt(patch.gridColor);
    if (patch.volumeUpColor !== undefined) this.options.volumeUpColor = cleanColorOpt(patch.volumeUpColor);
    if (patch.volumeDownColor !== undefined) this.options.volumeDownColor = cleanColorOpt(patch.volumeDownColor);
    if (patch.crosshairColor !== undefined) this.options.crosshairColor = cleanColorOpt(patch.crosshairColor);
    if (patch.radius !== undefined) {
      this.options.radius = patch.radius === null || patch.radius === ''
        ? null
        : clampNumber(patch.radius, 0, 40, 12);
      retheme = true;
    }
    if (patch.initialBars !== undefined) {
      const nextBars = clampNumber(patch.initialBars, 0, 500, 0);
      if (nextBars !== this.options.initialBars) {
        this.options.initialBars = nextBars;
        resetTime = true;
      }
    }
    if (patch.locale !== undefined) this.options.locale = String(patch.locale || '').trim();
    if (patch.timezone !== undefined) this.options.timezone = String(patch.timezone || '').trim();
    if (patch.proxyUrl !== undefined) {
      const nextProxy = String(patch.proxyUrl || '').trim();
      if (nextProxy !== this.options.proxyUrl) {
        this.options.proxyUrl = nextProxy;
        reconnect = true;
      }
    }
    if (patch.height !== undefined) {
      if (patch.height === null || patch.height === '') {
        this.host.style.removeProperty('--trw-height');
      } else {
        const h = /^\d+$/.test(String(patch.height)) ? `${patch.height}px` : String(patch.height);
        this.host.style.setProperty('--trw-height', h);
      }
    }

    if (retheme) this._applyTheme();
    this._syncUiControls();
    this._measureAndResize();
    if (resetTime && !reconnect) {
      this.renderer.resetTimeScale(this.renderer.cssWidth, this.options.initialBars);
    }
    if (reconnect) {
      this._connectMarket(true);
    } else {
      this.requestRender();
    }
    return this;
  }

  getState() {
    return {
      exchange: this.options.exchange,
      symbol: this.options.symbol,
      displayPair: this.options.displayPair,
      interval: this.options.interval,
      type: this.options.type,
      theme: this.activeTheme?.name || 'dark',
      watermark: this.options.watermark,
      wsState: this.wsState,
      livePrice: this.livePrice,
      change24h: this.change24h,
      candleCount: this.candles.length,
      isFullscreen: this.isFullscreen
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loadToken++;
    frameScheduler.cancel(this._renderFrame);

    if (this.flashTimer) clearTimeout(this.flashTimer);
    if (this.unsubscribeStream) {
      this.unsubscribeStream();
      this.unsubscribeStream = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.mediaQuery && this._onSchemeChange && typeof this.mediaQuery.removeEventListener === 'function') {
      this.mediaQuery.removeEventListener('change', this._onSchemeChange);
    }
    document.removeEventListener('fullscreenchange', this._onFsChange);
    document.removeEventListener('webkitfullscreenchange', this._onFsChange);
    document.removeEventListener('keydown', this._onKeyDown);

    if (this.shadow) {
      this.shadow.innerHTML = '';
    }
  }
}
