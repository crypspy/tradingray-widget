/*! TradingRay Crypto Chart Widget v1.0.0 | MIT License | https://tradingray.com */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.TradingRayWidget = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

// ---- constants.js ----
/**
 * Core constants, themes, timeframes, and option parsers for TradingRay Widget.
 * Zero external dependencies.
 */

const VERSION = '1.0.0';
const BRAND_NAME = 'TradingRay';
const BRAND_URL = 'https://tradingray.com';

// Pure monochrome TradingRay mark (from official tradingray-logo.svg, white via currentColor, no frame, no green)
const BRAND_LOGO_SVG =
  '<svg viewBox="34 41 235 235" width="18" height="18" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M189.7 76.3c-1.6-.1-3.1-.2-4.7-.2H36.5L60 103.6h37.5v94.7l31-37.2v-57.5H185c2.5.1 4.7.2 6.5.6 1.2.2 2.3.5 3.5.8l24.7-17.6c-8.7-6.5-18.7-10.2-30-11.1Z"/>' +
  '<path fill="currentColor" d="M183.8 160.2 266.2 65l-108.7 83.1-89.6 103.3 94.2-71.9 44.8 44.7H247c.1-.1.3-.2.4-.4l-63.6-63.6Z"/>' +
  '</svg>';

const INTERVAL_SECONDS = Object.freeze({
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800
});

const SUPPORTED_INTERVALS = Object.freeze(Object.keys(INTERVAL_SECONDS));
const TOOLBAR_INTERVALS = Object.freeze(['1m', '5m', '15m', '1h', '4h', '1d']);

const INTERVAL_ALIASES = Object.freeze({
  '1': '1m',
  '1min': '1m',
  '5': '5m',
  '5min': '5m',
  '15': '15m',
  '15min': '15m',
  '30': '30m',
  '30min': '30m',
  '60': '1h',
  '1hr': '1h',
  '240': '4h',
  '4hr': '4h',
  'd': '1d',
  '1day': '1d',
  'day': '1d',
  '1440': '1d',
  'w': '1w',
  '1wk': '1w',
  'week': '1w',
  '10080': '1w'
});

const THEMES = Object.freeze({
  dark: Object.freeze({
    name: 'dark',
    bg: '#08090c',
    surface: '#101218',
    controlBg: 'rgba(255, 255, 255, 0.045)',
    controlHover: 'rgba(255, 255, 255, 0.075)',
    controlActive: 'rgba(255, 255, 255, 0.115)',
    grid: 'rgba(255, 255, 255, 0.032)',
    text: '#f3f3f5',
    textSecondary: '#a1a5b2',
    textMuted: '#686d7a',
    logoColor: '#ffffff',
    up: '#16c784',
    down: '#ea364f',
    volUp: 'rgba(22, 199, 132, 0.19)',
    volDown: 'rgba(234, 54, 79, 0.19)',
    accent: '#6798ff',
    crosshair: 'rgba(161, 165, 178, 0.36)',
    crosshairBg: '#1c202b',
    crosshairText: '#f3f3f5'
  }),
  light: Object.freeze({
    name: 'light',
    bg: '#ffffff',
    surface: '#f4f6f9',
    controlBg: 'rgba(15, 23, 42, 0.045)',
    controlHover: 'rgba(15, 23, 42, 0.075)',
    controlActive: 'rgba(15, 23, 42, 0.11)',
    grid: 'rgba(15, 23, 42, 0.045)',
    text: '#11141c',
    textSecondary: '#4e5566',
    textMuted: '#848c9e',
    logoColor: '#16181f',
    up: '#10b981',
    down: '#e02d47',
    volUp: 'rgba(16, 185, 129, 0.18)',
    volDown: 'rgba(224, 45, 71, 0.18)',
    accent: '#3b82f6',
    crosshair: 'rgba(78, 85, 102, 0.34)',
    crosshairBg: '#1b1f2b',
    crosshairText: '#ffffff'
  })
});

function normalizeInterval(value, fallback = '1h') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (INTERVAL_SECONDS[raw]) return raw;
  if (INTERVAL_ALIASES[raw]) return INTERVAL_ALIASES[raw];
  return INTERVAL_SECONDS[fallback] ? fallback : '1h';
}

function normalizeChartType(value, fallback = 'candles') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'line' || raw === 'area' || raw === 'price' || raw === 'sparkline') {
    return 'line';
  }
  if (raw === 'candles' || raw === 'candle' || raw === 'candlestick' || raw === 'candlesticks' || raw === 'ohlc') {
    return 'candles';
  }
  return fallback === 'line' ? 'line' : 'candles';
}

function normalizeThemeName(value, fallback = 'dark') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'dark' || raw === 'light' || raw === 'auto') return raw;
  return fallback;
}

function normalizeLineStyle(value, fallback = 'dashed') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'solid' || raw === 'dashed' || raw === 'dotted') return raw;
  return fallback;
}

function clampNumber(value, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseBool(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const raw = String(value).trim().toLowerCase();
  if (raw === '') return true;
  if (raw === 'on' || raw === 'true' || raw === '1' || raw === 'yes' || raw === 'show') return true;
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'no' || raw === 'hide' || raw === 'none') return false;
  return fallback;
}

// ---- format.js ----
/**
 * Zero-allocation numeric, symbol, and calendar-aware date formatters for real-time chart rendering.
 */

const KNOWN_QUOTES = Object.freeze([
  'USDT', 'USDC', 'FDUSD', 'PYUSD', 'BUSD', 'DAI',
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'TRY', 'BRL',
  'BTC', 'ETH', 'BNB', 'SOL'
]);

const dtfCache = new Map();

function resolveTimeZoneOption(timezone, forceUtc = false) {
  if (forceUtc) return 'UTC';
  if (!timezone) return undefined;
  const raw = String(timezone).trim();
  if (!raw || raw.toLowerCase() === 'local') return undefined;
  if (raw.toUpperCase() === 'UTC') return 'UTC';
  return raw;
}

function getDateFormatter(locale, key, options, timezone) {
  const tzKey = timezone || 'local';
  const cacheKey = `${locale || 'en'}|${tzKey}|${key}`;
  let fmt = dtfCache.get(cacheKey);
  if (!fmt) {
    const opts = timezone ? { ...options, timeZone: timezone } : options;
    try {
      fmt = new Intl.DateTimeFormat(locale || undefined, opts);
    } catch {
      const safeOpts = timezone === 'UTC' ? { ...options, timeZone: 'UTC' } : options;
      fmt = new Intl.DateTimeFormat('en-US', safeOpts);
    }
    dtfCache.set(cacheKey, fmt);
  }
  return fmt;
}

function getCalendarDayKey(date, tz) {
  if (tz === 'UTC') {
    return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  }
  if (!tz) {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }
  // Custom IANA timezone day key
  return getDateFormatter('en-CA', 'ymdKey', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }, tz).format(date);
}

/**
 * Splits a user-provided symbol like "BTCUSDT", "btc/usdt", "SOL-USD", "BINANCE:ETHUSDT", or "BTC"
 * into normalized base & quote components.
 */
function parseSymbolInput(rawSymbol, defaultQuote = 'USDT') {
  let raw = String(rawSymbol || 'BTCUSDT').trim();
  const colonIdx = raw.indexOf(':');
  if (colonIdx !== -1) {
    raw = raw.slice(colonIdx + 1).trim();
  }
  raw = raw.replace(/-(?:SWAP|PERP|PERPETUAL)$/i, '');

  const preserveLeadingK = /^k[A-Z0-9]{2,}$/.test(raw);
  const upper = raw.toUpperCase();

  const sepMatch = upper.match(/^([A-Z0-9.]+)\s*[/\-_]\s*([A-Z0-9]+)$/);
  if (sepMatch) {
    const base = preserveLeadingK && raw[0] === 'k' ? 'k' + sepMatch[1].slice(1) : sepMatch[1];
    const quote = sepMatch[2];
    return {
      base,
      quote,
      explicitQuote: true,
      displayPair: `${base}/${quote}`
    };
  }

  const clean = upper.replace(/[^A-Z0-9]/g, '');
  for (let i = 0; i < KNOWN_QUOTES.length; i++) {
    const q = KNOWN_QUOTES[i];
    if (clean.length > q.length && clean.endsWith(q)) {
      const baseUpper = clean.slice(0, clean.length - q.length);
      const base = preserveLeadingK && raw[0] === 'k' ? 'k' + baseUpper.slice(1) : baseUpper;
      return {
        base,
        quote: q,
        explicitQuote: true,
        displayPair: `${base}/${q}`
      };
    }
  }

  const base = (preserveLeadingK && raw[0] === 'k' ? 'k' + clean.slice(1) : clean) || 'BTC';
  const quote = String(defaultQuote || 'USDT').toUpperCase();
  return {
    base,
    quote,
    explicitQuote: false,
    displayPair: `${base}/${quote}`
  };
}

function getPriceDecimals(price) {
  const abs = Math.abs(Number(price) || 0);
  if (abs === 0) return 2;
  if (abs >= 1000) return 2;
  if (abs >= 100) return 2;
  if (abs >= 10) return 3;
  if (abs >= 1) return 4;
  if (abs >= 0.1) return 5;
  const leadingZeros = Math.max(0, -Math.floor(Math.log10(abs)) - 1);
  return Math.min(10, leadingZeros + 4);
}

function addThousandsCommas(intPart) {
  const negative = intPart[0] === '-';
  const digits = negative ? intPart.slice(1) : intPart;
  if (digits.length <= 3) return intPart;
  let out = '';
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) out = ',' + out;
    out = digits[i] + out;
    count++;
  }
  return negative ? '-' + out : out;
}

function formatPrice(price, decimalsOverride) {
  const num = Number(price);
  if (!Number.isFinite(num)) return '—';
  const decimals = typeof decimalsOverride === 'number' ? decimalsOverride : getPriceDecimals(num);
  const fixed = num.toFixed(decimals);
  const dot = fixed.indexOf('.');
  if (dot === -1) return addThousandsCommas(fixed);
  const intPart = addThousandsCommas(fixed.slice(0, dot));
  return `${intPart}.${fixed.slice(dot + 1)}`;
}

function formatSignedPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00%';
  const sign = num > 0.00005 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function formatCompactVolume(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '0';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  if (num >= 10) return num.toFixed(1);
  return num.toFixed(3);
}

/**
 * Formats a timeline tick with contextual Year / Month / Day / HH:mm hierarchy.
 */
function formatTimelineTick(tsSec, prevTsSec, stepSec, intervalSec, locale, timezone) {
  const date = new Date(tsSec * 1000);
  if (Number.isNaN(date.getTime())) return '';

  const isDailyOrHigher = intervalSec >= 86400 || stepSec >= 86400;
  const tz = resolveTimeZoneOption(timezone, isDailyOrHigher && !timezone);
  const prevDate = prevTsSec !== null && prevTsSec !== undefined ? new Date(prevTsSec * 1000) : null;

  // Yearly ticks
  if (stepSec >= 31536000) {
    return getDateFormatter(locale, 'axisYear', { year: 'numeric' }, 'UTC').format(date);
  }

  // Monthly / Quarterly ticks
  if (stepSec >= 2592000) {
    const yearChanged = prevDate && date.getUTCFullYear() !== prevDate.getUTCFullYear();
    if ((yearChanged && date.getUTCMonth() === 0) || (!prevDate && date.getUTCMonth() === 0)) {
      return getDateFormatter(locale, 'axisYear', { year: 'numeric' }, 'UTC').format(date);
    }
    if (yearChanged) {
      return getDateFormatter(locale, 'axisMonthYear', { month: 'short', year: '2-digit' }, 'UTC').format(date);
    }
    return getDateFormatter(locale, 'axisMonth', { month: 'short' }, 'UTC').format(date);
  }

  // Daily / Multi-day / Weekly ticks
  if (isDailyOrHigher) {
    const curY = tz === 'UTC' ? date.getUTCFullYear() : date.getFullYear();
    const prevY = prevDate ? (tz === 'UTC' ? prevDate.getUTCFullYear() : prevDate.getFullYear()) : curY;
    if (prevDate && curY !== prevY) {
      return getDateFormatter(locale, 'axisDayYear', { month: 'short', day: 'numeric', year: '2-digit' }, tz).format(date);
    }
    return getDateFormatter(locale, 'axisDay', { month: 'short', day: 'numeric' }, tz).format(date);
  }

  // Intraday ticks (1m .. 12h): detect calendar day rollover regardless of timezone offset
  if (prevDate) {
    const curDay = getCalendarDayKey(date, tz);
    const prevDay = getCalendarDayKey(prevDate, tz);
    if (curDay !== prevDay) {
      return getDateFormatter(locale, 'axisDay', { month: 'short', day: 'numeric' }, tz).format(date);
    }
  } else {
    const isMidnight = tz === 'UTC'
      ? (date.getUTCHours() === 0 && date.getUTCMinutes() === 0)
      : (!tz && date.getHours() === 0 && date.getMinutes() === 0);
    if (isMidnight) {
      return getDateFormatter(locale, 'axisDay', { month: 'short', day: 'numeric' }, tz).format(date);
    }
  }

  return getDateFormatter(locale, 'axisTime', { hour: '2-digit', minute: '2-digit', hour12: false }, tz).format(date);
}

function formatAxisTime(tsSec, intervalSec, locale, timezone) {
  return formatTimelineTick(tsSec, null, intervalSec, intervalSec, locale, timezone);
}

function formatCrosshairTime(tsSec, intervalSec, locale, timezone) {
  const date = new Date(tsSec * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const isDaily = intervalSec >= 86400;
  const tz = resolveTimeZoneOption(timezone, isDaily && !timezone);

  if (isDaily) {
    return getDateFormatter(locale, 'crossDay', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }, tz).format(date);
  }
  return getDateFormatter(locale, 'crossFull', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }, tz).format(date);
}

// ---- exchanges.js ----
/**
 * Direct browser-to-exchange market data adapters (REST/WS-RPC snapshots + real-time WebSocket streams).
 * Supports Binance (Spot & Futures), Bybit (Spot & Futures), OKX (Spot & Futures),
 * Coinbase, Kraken, and Hyperliquid with zero API keys and zero backend dependencies.
 */

const BYBIT_INTERVALS = Object.freeze({
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': 'D',
  '1w': 'W'
});

const OKX_INTERVALS = Object.freeze({
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
  '1w': '1W'
});

const KRAKEN_INTERVALS = Object.freeze({
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
  '1w': 10080
});

const COINBASE_GRANULARITY = Object.freeze({
  '1m': { gran: 60, bucketSec: 60 },
  '5m': { gran: 300, bucketSec: 300 },
  '15m': { gran: 900, bucketSec: 900 },
  '30m': { gran: 900, bucketSec: 1800 },
  '1h': { gran: 3600, bucketSec: 3600 },
  '4h': { gran: 3600, bucketSec: 14400 },
  '1d': { gran: 86400, bucketSec: 86400 },
  '1w': { gran: 86400, bucketSec: 604800 }
});

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function toFinite(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function applyProxyUrl(targetUrl, proxyUrl) {
  if (!proxyUrl) return targetUrl;
  const p = String(proxyUrl).trim();
  if (!p) return targetUrl;
  if (p.includes('{url}')) {
    return p.replace('{url}', encodeURIComponent(targetUrl));
  }
  if (p.endsWith('?') || p.endsWith('=')) {
    return `${p}${encodeURIComponent(targetUrl)}`;
  }
  const sep = p.includes('?') ? '&' : '?';
  return `${p}${sep}url=${encodeURIComponent(targetUrl)}`;
}

async function fetchJson(url, options = {}) {
  const { proxyUrl, fetchImpl, method = 'GET', body, timeoutMs = 10000 } = options;
  const fn = fetchImpl || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
  if (!fn) throw new Error('Fetch API is unavailable in this environment.');

  const finalUrl = applyProxyUrl(url, proxyUrl);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const init = { method };
    if (controller) init.signal = controller.signal;
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fn(finalUrl, init);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function dedupeAndSortCandles(candles) {
  if (!candles.length) return [];
  candles.sort((a, b) => a.time - b.time);
  const out = [candles[0]];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = out[out.length - 1];
    if (cur.time === prev.time) {
      out[out.length - 1] = cur;
    } else if (cur.time > prev.time) {
      out.push(cur);
    }
  }
  return out;
}

function aggregateCandles(candles, bucketSec) {
  if (!candles.length) return [];
  const sorted = dedupeAndSortCandles(candles);
  const buckets = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const bucketTime = Math.floor(c.time / bucketSec) * bucketSec;
    const last = buckets[buckets.length - 1];
    if (!last || last.time !== bucketTime) {
      buckets.push({
        time: bucketTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      });
    } else {
      if (c.high > last.high) last.high = c.high;
      if (c.low < last.low) last.low = c.low;
      last.close = c.close;
      last.volume += c.volume;
    }
  }
  return buckets;
}

/**
 * Shared transient WebSocket JSON-RPC client for Binance Spot & Futures WebSocket API.
 * Multiplexes concurrent `klines` & `ticker.24hr` snapshot queries over a single socket
 * with zero browser CORS issues, then auto-closes after idle so only 1 stream WS remains open.
 */
class SharedWsRpcPool {
  constructor(urls, idleCloseMs = 1800) {
    this.urls = urls;
    this.idleCloseMs = idleCloseMs;
    this.ws = null;
    this.openPromise = null;
    this.pending = new Map();
    this.seq = 0;
    this.idleTimer = null;
    this.urlIndex = 0;
  }

  _scheduleIdleClose() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.pending.size > 0) return;
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0 && this.ws) {
        const sock = this.ws;
        this.ws = null;
        this.openPromise = null;
        try {
          sock.close(1000, 'idle');
        } catch {
          // ignore close errors
        }
      }
    }, this.idleCloseMs);
  }

  _ensureSocket(WebSocketImpl) {
    const WS = WebSocketImpl || globalThis.WebSocket;
    if (!WS) return Promise.reject(new Error('WebSocket is unavailable.'));
    if (this.ws && this.ws.readyState === 1) return Promise.resolve(this.ws);
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      let settled = false;
      const url = this.urls[this.urlIndex % this.urls.length];
      let sock;
      try {
        sock = new WS(url);
      } catch (err) {
        this.openPromise = null;
        reject(err);
        return;
      }

      const connectTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.urlIndex++;
          this.openPromise = null;
          try {
            sock.close();
          } catch {
            // ignore
          }
          reject(new Error('WebSocket RPC connection timeout'));
        }
      }, 6500);

      sock.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        this.ws = sock;
        resolve(sock);
      };

      sock.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data));
        } catch {
          return;
        }
        if (!msg || msg.id === undefined) return;
        const entry = this.pending.get(String(msg.id));
        if (!entry) return;
        this.pending.delete(String(msg.id));
        clearTimeout(entry.timer);
        this._scheduleIdleClose();
        if (msg.status && msg.status !== 200) {
          const errText = msg.error?.msg || `RPC status ${msg.status}`;
          entry.reject(new Error(errText));
        } else if (msg.error) {
          entry.reject(new Error(msg.error.msg || 'RPC error'));
        } else {
          entry.resolve(msg.result);
        }
      };

      const failAll = (reason) => {
        clearTimeout(connectTimer);
        if (this.ws === sock) this.ws = null;
        this.openPromise = null;
        if (!settled) {
          settled = true;
          this.urlIndex++;
          reject(reason);
        }
        if (this.pending.size > 0) {
          const entries = [...this.pending.values()];
          this.pending.clear();
          for (let i = 0; i < entries.length; i++) {
            clearTimeout(entries[i].timer);
            entries[i].reject(reason);
          }
        }
      };

      sock.onerror = () => {
        failAll(new Error('WebSocket RPC network error'));
      };

      sock.onclose = () => {
        failAll(new Error('WebSocket RPC closed'));
      };
    });

    return this.openPromise;
  }

  async request(method, params, WebSocketImpl, timeoutMs = 8000) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    const sock = await this._ensureSocket(WebSocketImpl);
    const id = `tr_${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this._scheduleIdleClose();
        reject(new Error(`RPC ${method} timeout`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      try {
        sock.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        this._scheduleIdleClose();
        reject(err);
      }
    });
  }
}

const binanceSpotRpc = new SharedWsRpcPool([
  'wss://ws-api.binance.com:443/ws-api/v3',
  'wss://ws-api.binance.com:9443/ws-api/v3',
  'wss://ws-api.binance.vision/ws-api/v3'
]);

const binanceFuturesRpc = new SharedWsRpcPool([
  'wss://ws-fapi.binance.com/ws-fapi/v1'
]);

function parseBinanceKlineRows(rows) {
  if (!Array.isArray(rows)) return [];
  const candles = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!Array.isArray(r) || r.length < 6) continue;
    const time = Math.floor(toFinite(r[0]) / 1000);
    const open = toFinite(r[1]);
    const high = toFinite(r[2]);
    const low = toFinite(r[3]);
    const close = toFinite(r[4]);
    const volume = toFinite(r[5]);
    if (time > 0 && close > 0) {
      candles.push({ time, open, high, low, close, volume });
    }
  }
  return dedupeAndSortCandles(candles);
}

function parseBinanceTickerObj(t) {
  if (!t || typeof t !== 'object') return null;
  const price = toFinite(t.lastPrice);
  if (!(price > 0)) return null;
  const open24h = toFinite(t.openPrice);
  const pct = t.priceChangePercent !== undefined
    ? toFinite(t.priceChangePercent)
    : (open24h > 0 ? ((price - open24h) / open24h) * 100 : 0);
  return {
    price,
    change24h: pct,
    open24h,
    high24h: toFinite(t.highPrice),
    low24h: toFinite(t.lowPrice),
    volume24h: toFinite(t.quoteVolume)
  };
}

function createBinanceAdapter({ id, name, badge, wsUrls, restBases, klinePath, tickerPath, rpcPool }) {
  return {
    id,
    name,
    badge,
    wsUrls,
    pingIntervalMs: 0,
    supportsBackfill: true,

    resolveSymbol(rawSymbol) {
      const parsed = parseSymbolInput(rawSymbol, 'USDT');
      return {
        symbol: `${parsed.base}${parsed.quote}`,
        base: parsed.base,
        quote: parsed.quote,
        displayPair: parsed.displayPair
      };
    },

    async fetchSnapshot({ symbol, interval, limit = 300, endTimeMs, proxyUrl, WebSocketImpl, fetchImpl }) {
      const tf = normalizeInterval(interval);
      const klineParams = { symbol, interval: tf, limit };
      if (endTimeMs) klineParams.endTime = endTimeMs;

      // When no custom HTTP proxy is forced and WebSocket is available, prefer shared WS-RPC
      // so browsers never emit CORS preflight/console errors across origins or file://.
      if (!proxyUrl && (WebSocketImpl || typeof globalThis.WebSocket === 'function')) {
        try {
          const calls = [rpcPool.request('klines', klineParams, WebSocketImpl)];
          if (!endTimeMs) {
            calls.push(rpcPool.request('ticker.24hr', { symbol }, WebSocketImpl).catch(() => null));
          }
          const [rawKlines, rawTicker] = await Promise.all(calls);
          const candles = parseBinanceKlineRows(rawKlines);
          if (candles.length > 0) {
            return {
              candles,
              ticker: rawTicker ? parseBinanceTickerObj(rawTicker) : null
            };
          }
        } catch {
          // Fall through to REST endpoints below
        }
      }

      let lastErr = null;
      for (let i = 0; i < restBases.length; i++) {
        const base = restBases[i];
        const qs = new URLSearchParams({
          symbol,
          interval: tf,
          limit: String(limit)
        });
        if (endTimeMs) qs.set('endTime', String(endTimeMs));
        try {
          const requests = [fetchJson(`${base}${klinePath}?${qs}`, { proxyUrl, fetchImpl })];
          if (!endTimeMs) {
            requests.push(
              fetchJson(`${base}${tickerPath}?symbol=${encodeURIComponent(symbol)}`, { proxyUrl, fetchImpl }).catch(() => null)
            );
          }
          const [klineData, tickerData] = await Promise.all(requests);
          const candles = parseBinanceKlineRows(klineData);
          if (!candles.length) throw new Error(`No candles found for ${symbol}`);
          return {
            candles,
            ticker: tickerData ? parseBinanceTickerObj(tickerData) : null
          };
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error(`Failed to load ${symbol} from ${name}`);
    },

    getStreamTopics(symbol, interval) {
      const s = symbol.toLowerCase();
      const tf = normalizeInterval(interval);
      return [`${s}@kline_${tf}`, `${s}@miniTicker`];
    },

    buildSubscribeMessages(topics, nextId) {
      return chunkArray(topics, 100).map((params) => ({
        method: 'SUBSCRIBE',
        params,
        id: nextId()
      }));
    },

    buildUnsubscribeMessages(topics, nextId) {
      return chunkArray(topics, 100).map((params) => ({
        method: 'UNSUBSCRIBE',
        params,
        id: nextId()
      }));
    },

    parseWsMessage(rawText) {
      let msg;
      try {
        msg = JSON.parse(rawText);
      } catch {
        return [];
      }
      const data = msg?.data && msg?.stream ? msg.data : msg;
      if (!data || typeof data !== 'object') return [];

      if (data.e === 'kline' && data.k) {
        const k = data.k;
        const sym = String(data.s || k.s || '').toLowerCase();
        const tf = String(k.i || '');
        const close = toFinite(k.c);
        const time = Math.floor(toFinite(k.t) / 1000);
        if (!sym || !tf || !(close > 0) || !(time > 0)) return [];
        return [{
          kind: 'candle',
          topic: `${sym}@kline_${tf}`,
          candle: {
            time,
            open: toFinite(k.o),
            high: toFinite(k.h),
            low: toFinite(k.l),
            close,
            volume: toFinite(k.v)
          }
        }];
      }

      if (data.e === '24hrMiniTicker') {
        const sym = String(data.s || '').toLowerCase();
        const price = toFinite(data.c);
        if (!sym || !(price > 0)) return [];
        const open24h = toFinite(data.o);
        return [{
          kind: 'ticker',
          topic: `${sym}@miniTicker`,
          ticker: {
            price,
            open24h,
            high24h: toFinite(data.h),
            low24h: toFinite(data.l),
            volume24h: toFinite(data.q),
            change24h: open24h > 0 ? ((price - open24h) / open24h) * 100 : undefined
          }
        }];
      }

      return [];
    }
  };
}

function createBybitAdapter({ id, name, badge, category, wsUrls }) {
  const restBases = ['https://api.bybit.com', 'https://api.bytick.com'];
  return {
    id,
    name,
    badge,
    wsUrls,
    pingIntervalMs: 20000,
    supportsBackfill: true,

    buildPing() {
      return JSON.stringify({ op: 'ping' });
    },

    resolveSymbol(rawSymbol) {
      const parsed = parseSymbolInput(rawSymbol, 'USDT');
      return {
        symbol: `${parsed.base}${parsed.quote}`,
        base: parsed.base,
        quote: parsed.quote,
        displayPair: parsed.displayPair
      };
    },

    async fetchSnapshot({ symbol, interval, limit = 300, endTimeMs, proxyUrl, fetchImpl }) {
      const tf = BYBIT_INTERVALS[normalizeInterval(interval)] || '60';
      let lastErr = null;
      for (let i = 0; i < restBases.length; i++) {
        const base = restBases[i];
        const qs = new URLSearchParams({
          category,
          symbol,
          interval: tf,
          limit: String(Math.min(limit, 1000))
        });
        if (endTimeMs) qs.set('end', String(endTimeMs));
        try {
          const calls = [fetchJson(`${base}/v5/market/kline?${qs}`, { proxyUrl, fetchImpl })];
          if (!endTimeMs) {
            const tQs = new URLSearchParams({ category, symbol });
            calls.push(fetchJson(`${base}/v5/market/tickers?${tQs}`, { proxyUrl, fetchImpl }).catch(() => null));
          }
          const [kRes, tRes] = await Promise.all(calls);
          if (kRes?.retCode && kRes.retCode !== 0) {
            throw new Error(kRes.retMsg || `Bybit error ${kRes.retCode}`);
          }
          const list = kRes?.result?.list || [];
          const candles = [];
          for (let j = 0; j < list.length; j++) {
            const r = list[j];
            const time = Math.floor(toFinite(r[0]) / 1000);
            const close = toFinite(r[4]);
            if (time > 0 && close > 0) {
              candles.push({
                time,
                open: toFinite(r[1]),
                high: toFinite(r[2]),
                low: toFinite(r[3]),
                close,
                volume: toFinite(r[5])
              });
            }
          }
          const sorted = dedupeAndSortCandles(candles);
          if (!sorted.length) throw new Error(`No candles found for ${symbol} on ${name}`);

          let ticker = null;
          const tItem = tRes?.result?.list?.[0];
          if (tItem && toFinite(tItem.lastPrice) > 0) {
            ticker = {
              price: toFinite(tItem.lastPrice),
              change24h: tItem.price24hPcnt !== undefined ? toFinite(tItem.price24hPcnt) * 100 : undefined,
              high24h: toFinite(tItem.highPrice24h) || undefined,
              low24h: toFinite(tItem.lowPrice24h) || undefined,
              volume24h: toFinite(tItem.turnover24h) || undefined
            };
          }
          return { candles: sorted, ticker };
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error(`Failed to load ${symbol} from ${name}`);
    },

    getStreamTopics(symbol, interval) {
      const tf = BYBIT_INTERVALS[normalizeInterval(interval)] || '60';
      return [`kline.${tf}.${symbol}`, `tickers.${symbol}`];
    },

    buildSubscribeMessages(topics) {
      // Bybit Spot limits each subscribe frame to 10 args on a single connection
      return chunkArray(topics, 10).map((args) => ({ op: 'subscribe', args }));
    },

    buildUnsubscribeMessages(topics) {
      return chunkArray(topics, 10).map((args) => ({ op: 'unsubscribe', args }));
    },

    parseWsMessage(rawText) {
      let msg;
      try {
        msg = JSON.parse(rawText);
      } catch {
        return [];
      }
      if (!msg || msg.op === 'pong' || msg.ret_msg === 'pong' || !msg.topic) return [];
      const topic = String(msg.topic);
      const events = [];

      if (topic.startsWith('kline.')) {
        const items = Array.isArray(msg.data) ? msg.data : [msg.data];
        for (let i = 0; i < items.length; i++) {
          const k = items[i];
          if (!k) continue;
          const time = Math.floor(toFinite(k.start) / 1000);
          const close = toFinite(k.close);
          if (time > 0 && close > 0) {
            events.push({
              kind: 'candle',
              topic,
              candle: {
                time,
                open: toFinite(k.open),
                high: toFinite(k.high),
                low: toFinite(k.low),
                close,
                volume: toFinite(k.volume)
              }
            });
          }
        }
      } else if (topic.startsWith('tickers.')) {
        const d = Array.isArray(msg.data) ? msg.data[0] : msg.data;
        if (d && typeof d === 'object') {
          const patch = {};
          if (d.lastPrice !== undefined && toFinite(d.lastPrice) > 0) patch.price = toFinite(d.lastPrice);
          if (d.price24hPcnt !== undefined && d.price24hPcnt !== '') patch.change24h = toFinite(d.price24hPcnt) * 100;
          if (d.highPrice24h !== undefined && toFinite(d.highPrice24h) > 0) patch.high24h = toFinite(d.highPrice24h);
          if (d.lowPrice24h !== undefined && toFinite(d.lowPrice24h) > 0) patch.low24h = toFinite(d.lowPrice24h);
          if (d.turnover24h !== undefined && toFinite(d.turnover24h) >= 0) patch.volume24h = toFinite(d.turnover24h);
          if (Object.keys(patch).length > 0) {
            events.push({ kind: 'ticker', topic, ticker: patch });
          }
        }
      }
      return events;
    }
  };
}

function createOkxAdapter({ id, name, badge, isSwap }) {
  return {
    id,
    name,
    badge,
    wsUrls: ['wss://ws.okx.com:8443/ws/v5/business', 'wss://wsaws.okx.com:8443/ws/v5/business'],
    pingIntervalMs: 25000,
    supportsBackfill: true,

    buildPing() {
      return 'ping';
    },

    resolveSymbol(rawSymbol) {
      const parsed = parseSymbolInput(rawSymbol, 'USDT');
      const symbol = isSwap
        ? `${parsed.base}-${parsed.quote}-SWAP`
        : `${parsed.base}-${parsed.quote}`;
      return {
        symbol,
        base: parsed.base,
        quote: parsed.quote,
        displayPair: parsed.displayPair
      };
    },

    async fetchSnapshot({ symbol, interval, limit = 300, endTimeMs, proxyUrl, fetchImpl }) {
      const bar = OKX_INTERVALS[normalizeInterval(interval)] || '1H';
      const qs = new URLSearchParams({
        instId: symbol,
        bar,
        limit: String(Math.min(limit, 300))
      });
      if (endTimeMs) qs.set('after', String(endTimeMs));

      const calls = [fetchJson(`https://www.okx.com/api/v5/market/candles?${qs}`, { proxyUrl, fetchImpl })];
      if (!endTimeMs) {
        calls.push(
          fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(symbol)}`, { proxyUrl, fetchImpl }).catch(() => null)
        );
      }
      const [kRes, tRes] = await Promise.all(calls);
      if (kRes?.code && String(kRes.code) !== '0') {
        throw new Error(kRes.msg || `OKX error ${kRes.code}`);
      }
      const rows = Array.isArray(kRes?.data) ? kRes.data : [];
      const candles = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const time = Math.floor(toFinite(r[0]) / 1000);
        const close = toFinite(r[4]);
        if (time > 0 && close > 0) {
          candles.push({
            time,
            open: toFinite(r[1]),
            high: toFinite(r[2]),
            low: toFinite(r[3]),
            close,
            volume: toFinite(r[5])
          });
        }
      }
      const sorted = dedupeAndSortCandles(candles);
      if (!sorted.length) throw new Error(`No candles found for ${symbol} on ${name}`);

      let ticker = null;
      const t = tRes?.data?.[0];
      if (t && toFinite(t.last) > 0) {
        const price = toFinite(t.last);
        const open24h = toFinite(t.open24h);
        ticker = {
          price,
          open24h: open24h || undefined,
          change24h: open24h > 0 ? ((price - open24h) / open24h) * 100 : undefined,
          high24h: toFinite(t.high24h) || undefined,
          low24h: toFinite(t.low24h) || undefined,
          volume24h: toFinite(t.volCcy24h) || undefined
        };
      }
      return { candles: sorted, ticker };
    },

    getStreamTopics(symbol, interval) {
      const bar = OKX_INTERVALS[normalizeInterval(interval)] || '1H';
      return [`candle${bar}|${symbol}`];
    },

    buildSubscribeMessages(topics) {
      const args = topics.map((t) => {
        const [channel, instId] = t.split('|');
        return { channel, instId };
      });
      return chunkArray(args, 40).map((chunk) => ({ op: 'subscribe', args: chunk }));
    },

    buildUnsubscribeMessages(topics) {
      const args = topics.map((t) => {
        const [channel, instId] = t.split('|');
        return { channel, instId };
      });
      return chunkArray(args, 40).map((chunk) => ({ op: 'unsubscribe', args: chunk }));
    },

    parseWsMessage(rawText) {
      if (rawText === 'pong') return [];
      let msg;
      try {
        msg = JSON.parse(rawText);
      } catch {
        return [];
      }
      const ch = msg?.arg?.channel;
      const instId = msg?.arg?.instId;
      if (!ch || !instId || !ch.startsWith('candle') || !Array.isArray(msg.data)) return [];
      const topic = `${ch}|${instId}`;
      const events = [];
      for (let i = 0; i < msg.data.length; i++) {
        const r = msg.data[i];
        const time = Math.floor(toFinite(r[0]) / 1000);
        const close = toFinite(r[4]);
        if (time > 0 && close > 0) {
          events.push({
            kind: 'candle',
            topic,
            candle: {
              time,
              open: toFinite(r[1]),
              high: toFinite(r[2]),
              low: toFinite(r[3]),
              close,
              volume: toFinite(r[5])
            }
          });
        }
      }
      return events;
    }
  };
}

const coinbaseAdapter = {
  id: 'coinbase',
  name: 'Coinbase',
  badge: 'Coinbase',
  wsUrls: ['wss://ws-feed.exchange.coinbase.com'],
  pingIntervalMs: 0,
  supportsBackfill: false,

  resolveSymbol(rawSymbol) {
    const parsed = parseSymbolInput(rawSymbol, 'USD');
    // Coinbase primary liquidity is -USD; map implicit USDT shorthand (e.g. BTCUSDT) to USD with fallback
    const hadDash = String(rawSymbol || '').includes('-') || String(rawSymbol || '').includes('/');
    const quote = !hadDash && parsed.quote === 'USDT' ? 'USD' : parsed.quote;
    return {
      symbol: `${parsed.base}-${quote}`,
      altSymbol: quote === 'USDT' ? `${parsed.base}-USD` : `${parsed.base}-USDT`,
      base: parsed.base,
      quote,
      displayPair: `${parsed.base}/${quote}`
    };
  },

  async fetchSnapshot({ symbol, interval, proxyUrl, fetchImpl }) {
    const tf = normalizeInterval(interval);
    const cfg = COINBASE_GRANULARITY[tf] || COINBASE_GRANULARITY['1h'];
    const base = 'https://api.exchange.coinbase.com';

    const loadProduct = async (prodId) => {
      const [cRes, sRes] = await Promise.all([
        fetchJson(`${base}/products/${encodeURIComponent(prodId)}/candles?granularity=${cfg.gran}`, { proxyUrl, fetchImpl }),
        fetchJson(`${base}/products/${encodeURIComponent(prodId)}/stats`, { proxyUrl, fetchImpl }).catch(() => null)
      ]);
      if (!Array.isArray(cRes) || !cRes.length) {
        throw new Error(`No candles found for ${prodId}`);
      }
      // Coinbase tuple order: [timeSec, low, high, open, close, volume]
      const rawCandles = [];
      for (let i = 0; i < cRes.length; i++) {
        const r = cRes[i];
        const time = Math.floor(toFinite(r[0]));
        const close = toFinite(r[4]);
        if (time > 0 && close > 0) {
          rawCandles.push({
            time,
            low: toFinite(r[1]),
            high: toFinite(r[2]),
            open: toFinite(r[3]),
            close,
            volume: toFinite(r[5])
          });
        }
      }
      const candles = cfg.bucketSec > cfg.gran
        ? aggregateCandles(rawCandles, cfg.bucketSec)
        : dedupeAndSortCandles(rawCandles);

      let ticker = null;
      if (sRes && toFinite(sRes.last) > 0) {
        const price = toFinite(sRes.last);
        const open24h = toFinite(sRes.open);
        ticker = {
          price,
          open24h: open24h || undefined,
          change24h: open24h > 0 ? ((price - open24h) / open24h) * 100 : undefined,
          high24h: toFinite(sRes.high) || undefined,
          low24h: toFinite(sRes.low) || undefined,
          volume24h: toFinite(sRes.volume) * price
        };
      }
      return { candles, ticker, resolvedSymbol: prodId };
    };

    try {
      return await loadProduct(symbol);
    } catch (err) {
      if (symbol.endsWith('-USDT')) {
        return await loadProduct(symbol.replace(/-USDT$/, '-USD'));
      }
      throw err;
    }
  },

  getStreamTopics(symbol) {
    return [`ticker|${symbol}`];
  },

  buildSubscribeMessages(topics) {
    const productIds = [...new Set(topics.map((t) => t.split('|')[1]).filter(Boolean))];
    if (!productIds.length) return [];
    return [{ type: 'subscribe', product_ids: productIds, channels: ['ticker'] }];
  },

  buildUnsubscribeMessages(topics) {
    const productIds = [...new Set(topics.map((t) => t.split('|')[1]).filter(Boolean))];
    if (!productIds.length) return [];
    return [{ type: 'unsubscribe', product_ids: productIds, channels: ['ticker'] }];
  },

  parseWsMessage(rawText) {
    let msg;
    try {
      msg = JSON.parse(rawText);
    } catch {
      return [];
    }
    if (!msg || msg.type !== 'ticker' || !msg.product_id) return [];
    const price = toFinite(msg.price);
    if (!(price > 0)) return [];
    const open24h = toFinite(msg.open_24h);
    const tsMs = msg.time ? Date.parse(msg.time) : Date.now();
    return [{
      kind: 'ticker',
      topic: `ticker|${msg.product_id}`,
      ticker: {
        price,
        open24h: open24h || undefined,
        change24h: open24h > 0 ? ((price - open24h) / open24h) * 100 : undefined,
        high24h: toFinite(msg.high_24h) || undefined,
        low24h: toFinite(msg.low_24h) || undefined,
        volume24h: toFinite(msg.volume_24h) > 0 ? toFinite(msg.volume_24h) * price : undefined,
        tradeSize: toFinite(msg.last_size),
        tsSec: Math.floor((Number.isFinite(tsMs) ? tsMs : Date.now()) / 1000)
      }
    }];
  }
};

const krakenAdapter = {
  id: 'kraken',
  name: 'Kraken',
  badge: 'Kraken',
  wsUrls: ['wss://ws.kraken.com/v2'],
  pingIntervalMs: 25000,
  supportsBackfill: false,

  buildPing() {
    return JSON.stringify({ method: 'ping' });
  },

  resolveSymbol(rawSymbol) {
    const parsed = parseSymbolInput(rawSymbol, 'USD');
    const hadSep = String(rawSymbol || '').includes('/') || String(rawSymbol || '').includes('-');
    const quote = !hadSep && parsed.quote === 'USDT' ? 'USD' : parsed.quote;
    return {
      symbol: `${parsed.base}/${quote}`,
      base: parsed.base,
      quote,
      displayPair: `${parsed.base}/${quote}`
    };
  },

  async fetchSnapshot({ symbol, interval, proxyUrl, fetchImpl }) {
    const mins = KRAKEN_INTERVALS[normalizeInterval(interval)] || 60;
    const restPair = symbol.replace('/', '');
    const [oRes, tRes] = await Promise.all([
      fetchJson(`https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(restPair)}&interval=${mins}`, { proxyUrl, fetchImpl }),
      fetchJson(`https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(restPair)}`, { proxyUrl, fetchImpl }).catch(() => null)
    ]);
    if (Array.isArray(oRes?.error) && oRes.error.length > 0) {
      throw new Error(oRes.error.join(', '));
    }
    const resultObj = oRes?.result || {};
    const entry = Object.entries(resultObj).find(([k, v]) => k !== 'last' && Array.isArray(v));
    const rows = entry ? entry[1] : [];
    const candles = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const time = Math.floor(toFinite(r[0]));
      const close = toFinite(r[4]);
      if (time > 0 && close > 0) {
        candles.push({
          time,
          open: toFinite(r[1]),
          high: toFinite(r[2]),
          low: toFinite(r[3]),
          close,
          volume: toFinite(r[6])
        });
      }
    }
    const sorted = dedupeAndSortCandles(candles);
    if (!sorted.length) throw new Error(`No candles found for ${symbol} on Kraken`);

    let ticker = null;
    if (tRes?.result) {
      const tEntry = Object.values(tRes.result)[0];
      if (tEntry && Array.isArray(tEntry.c)) {
        const price = toFinite(tEntry.c[0]);
        const open24h = toFinite(tEntry.o);
        if (price > 0) {
          ticker = {
            price,
            open24h: open24h || undefined,
            change24h: open24h > 0 ? ((price - open24h) / open24h) * 100 : undefined,
            high24h: Array.isArray(tEntry.h) ? toFinite(tEntry.h[1]) : undefined,
            low24h: Array.isArray(tEntry.l) ? toFinite(tEntry.l[1]) : undefined,
            volume24h: Array.isArray(tEntry.v) ? toFinite(tEntry.v[1]) * price : undefined
          };
        }
      }
    }
    return { candles: sorted.slice(-400), ticker };
  },

  getStreamTopics(symbol, interval) {
    const mins = KRAKEN_INTERVALS[normalizeInterval(interval)] || 60;
    return [`ohlc|${mins}|${symbol}`, `ticker|${symbol}`];
  },

  buildSubscribeMessages(topics) {
    const ohlcByInterval = new Map();
    const tickerSymbols = new Set();
    for (let i = 0; i < topics.length; i++) {
      const parts = topics[i].split('|');
      if (parts[0] === 'ohlc') {
        const mins = Number(parts[1]);
        const sym = parts[2];
        if (!ohlcByInterval.has(mins)) ohlcByInterval.set(mins, new Set());
        ohlcByInterval.get(mins).add(sym);
      } else if (parts[0] === 'ticker') {
        tickerSymbols.add(parts[1]);
      }
    }
    const msgs = [];
    for (const [mins, set] of ohlcByInterval.entries()) {
      msgs.push({
        method: 'subscribe',
        params: { channel: 'ohlc', symbol: [...set], interval: mins, snapshot: false }
      });
    }
    if (tickerSymbols.size > 0) {
      msgs.push({
        method: 'subscribe',
        params: { channel: 'ticker', symbol: [...tickerSymbols], snapshot: true }
      });
    }
    return msgs;
  },

  buildUnsubscribeMessages(topics) {
    const ohlcByInterval = new Map();
    const tickerSymbols = new Set();
    for (let i = 0; i < topics.length; i++) {
      const parts = topics[i].split('|');
      if (parts[0] === 'ohlc') {
        const mins = Number(parts[1]);
        const sym = parts[2];
        if (!ohlcByInterval.has(mins)) ohlcByInterval.set(mins, new Set());
        ohlcByInterval.get(mins).add(sym);
      } else if (parts[0] === 'ticker') {
        tickerSymbols.add(parts[1]);
      }
    }
    const msgs = [];
    for (const [mins, set] of ohlcByInterval.entries()) {
      msgs.push({
        method: 'unsubscribe',
        params: { channel: 'ohlc', symbol: [...set], interval: mins }
      });
    }
    if (tickerSymbols.size > 0) {
      msgs.push({
        method: 'unsubscribe',
        params: { channel: 'ticker', symbol: [...tickerSymbols] }
      });
    }
    return msgs;
  },

  parseWsMessage(rawText) {
    let msg;
    try {
      msg = JSON.parse(rawText);
    } catch {
      return [];
    }
    if (!msg || !Array.isArray(msg.data)) return [];
    const events = [];

    if (msg.channel === 'ohlc') {
      for (let i = 0; i < msg.data.length; i++) {
        const d = msg.data[i];
        const tsMs = Date.parse(d.interval_begin || d.timestamp || '');
        const time = Math.floor(tsMs / 1000);
        const close = toFinite(d.close);
        if (d.symbol && d.interval && time > 0 && close > 0) {
          events.push({
            kind: 'candle',
            topic: `ohlc|${d.interval}|${d.symbol}`,
            candle: {
              time,
              open: toFinite(d.open),
              high: toFinite(d.high),
              low: toFinite(d.low),
              close,
              volume: toFinite(d.volume)
            }
          });
        }
      }
    } else if (msg.channel === 'ticker') {
      for (let i = 0; i < msg.data.length; i++) {
        const d = msg.data[i];
        const price = toFinite(d.last);
        if (d.symbol && price > 0) {
          events.push({
            kind: 'ticker',
            topic: `ticker|${d.symbol}`,
            ticker: {
              price,
              change24h: d.change_pct !== undefined ? toFinite(d.change_pct) : undefined,
              high24h: toFinite(d.high) || undefined,
              low24h: toFinite(d.low) || undefined,
              volume24h: toFinite(d.volume) > 0 ? toFinite(d.volume) * price : undefined
            }
          });
        }
      }
    }
    return events;
  }
};

const hyperliquidAdapter = {
  id: 'hyperliquid',
  name: 'Hyperliquid',
  badge: 'Hyperliquid',
  wsUrls: ['wss://api.hyperliquid.xyz/ws'],
  pingIntervalMs: 30000,
  supportsBackfill: true,

  buildPing() {
    return JSON.stringify({ method: 'ping' });
  },

  resolveSymbol(rawSymbol) {
    const parsed = parseSymbolInput(rawSymbol, 'USDC');
    let coin = parsed.base;
    if (/^1000[A-Z]+$/.test(coin)) {
      coin = 'k' + coin.slice(4);
    }
    return {
      symbol: coin,
      base: coin,
      quote: 'USDC',
      displayPair: `${coin}/USDC`
    };
  },

  async fetchSnapshot({ symbol, interval, limit = 300, endTimeMs, proxyUrl, fetchImpl }) {
    const tf = normalizeInterval(interval);
    const stepMs = (INTERVAL_SECONDS[tf] || 3600) * 1000;
    const end = endTimeMs || Date.now();
    const start = end - limit * stepMs;

    const data = await fetchJson('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      body: {
        type: 'candleSnapshot',
        req: { coin: symbol, interval: tf, startTime: start, endTime: end }
      },
      proxyUrl,
      fetchImpl
    });

    if (!Array.isArray(data) || !data.length) {
      throw new Error(`No candles found for ${symbol} on Hyperliquid`);
    }
    const candles = [];
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      const time = Math.floor(toFinite(c.t) / 1000);
      const close = toFinite(c.c);
      if (time > 0 && close > 0) {
        candles.push({
          time,
          open: toFinite(c.o),
          high: toFinite(c.h),
          low: toFinite(c.l),
          close,
          volume: toFinite(c.v)
        });
      }
    }
    const sorted = dedupeAndSortCandles(candles);
    const last = sorted[sorted.length - 1];

    // Derive 24h change cleanly from candles if spanning >=24h, otherwise first visible open
    let ticker = null;
    if (last) {
      const target24hSec = last.time - 86400;
      let refOpen = sorted[0].open;
      let high24h = last.high;
      let low24h = last.low;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const bar = sorted[i];
        if (bar.time >= target24hSec) {
          refOpen = bar.open;
          if (bar.high > high24h) high24h = bar.high;
          if (bar.low < low24h) low24h = bar.low;
        } else {
          break;
        }
      }
      ticker = {
        price: last.close,
        open24h: refOpen,
        change24h: refOpen > 0 ? ((last.close - refOpen) / refOpen) * 100 : 0,
        high24h,
        low24h
      };
    }
    return { candles: sorted, ticker };
  },

  getStreamTopics(symbol, interval) {
    const tf = normalizeInterval(interval);
    return [`candle|${tf}|${symbol}`];
  },

  buildSubscribeMessages(topics) {
    return topics.map((t) => {
      const [, interval, coin] = t.split('|');
      return {
        method: 'subscribe',
        subscription: { type: 'candle', coin, interval }
      };
    });
  },

  buildUnsubscribeMessages(topics) {
    return topics.map((t) => {
      const [, interval, coin] = t.split('|');
      return {
        method: 'unsubscribe',
        subscription: { type: 'candle', coin, interval }
      };
    });
  },

  parseWsMessage(rawText) {
    let msg;
    try {
      msg = JSON.parse(rawText);
    } catch {
      return [];
    }
    if (!msg || msg.channel !== 'candle' || !msg.data) return [];
    const list = Array.isArray(msg.data) ? msg.data : [msg.data];
    const events = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d || !d.s || !d.i) continue;
      const time = Math.floor(toFinite(d.t) / 1000);
      const close = toFinite(d.c);
      if (time > 0 && close > 0) {
        events.push({
          kind: 'candle',
          topic: `candle|${d.i}|${d.s}`,
          candle: {
            time,
            open: toFinite(d.o),
            high: toFinite(d.h),
            low: toFinite(d.l),
            close,
            volume: toFinite(d.v)
          }
        });
      }
    }
    return events;
  }
};

const BUILTIN_EXCHANGES = [
  createBinanceAdapter({
    id: 'binance',
    name: 'Binance',
    badge: 'Binance',
    wsUrls: [
      'wss://stream.binance.com:9443/stream',
      'wss://stream.binance.com:443/stream',
      'wss://data-stream.binance.vision/stream'
    ],
    restBases: [
      'https://data-api.binance.vision',
      'https://api.binance.com',
      'https://api-gcp.binance.com'
    ],
    klinePath: '/api/v3/klines',
    tickerPath: '/api/v3/ticker/24hr',
    rpcPool: binanceSpotRpc
  }),
  createBinanceAdapter({
    id: 'binance_futures',
    name: 'Binance Futures',
    badge: 'Binance Perp',
    wsUrls: ['wss://fstream.binance.com/stream'],
    restBases: ['https://fapi.binance.com'],
    klinePath: '/fapi/v1/klines',
    tickerPath: '/fapi/v1/ticker/24hr',
    rpcPool: binanceFuturesRpc
  }),
  createBybitAdapter({
    id: 'bybit',
    name: 'Bybit',
    badge: 'Bybit',
    category: 'spot',
    wsUrls: ['wss://stream.bybit.com/v5/public/spot', 'wss://stream.bytick.com/v5/public/spot']
  }),
  createBybitAdapter({
    id: 'bybit_futures',
    name: 'Bybit Futures',
    badge: 'Bybit Perp',
    category: 'linear',
    wsUrls: ['wss://stream.bybit.com/v5/public/linear', 'wss://stream.bytick.com/v5/public/linear']
  }),
  createOkxAdapter({
    id: 'okx',
    name: 'OKX',
    badge: 'OKX',
    isSwap: false
  }),
  createOkxAdapter({
    id: 'okx_futures',
    name: 'OKX Futures',
    badge: 'OKX Perp',
    isSwap: true
  }),
  coinbaseAdapter,
  krakenAdapter,
  hyperliquidAdapter
];

const EXCHANGE_REGISTRY = new Map();
const EXCHANGE_ALIASES = new Map([
  ['binance_spot', 'binance'],
  ['binance-spot', 'binance'],
  ['bn', 'binance'],
  ['binance-futures', 'binance_futures'],
  ['binance_perp', 'binance_futures'],
  ['binancef', 'binance_futures'],
  ['bybit_spot', 'bybit'],
  ['bybit-spot', 'bybit'],
  ['bybit-futures', 'bybit_futures'],
  ['bybit_linear', 'bybit_futures'],
  ['bybit_perp', 'bybit_futures'],
  ['okx_spot', 'okx'],
  ['okx-spot', 'okx'],
  ['okx-futures', 'okx_futures'],
  ['okx_swap', 'okx_futures'],
  ['okx_perp', 'okx_futures'],
  ['coinbase_spot', 'coinbase'],
  ['cb', 'coinbase'],
  ['kraken_spot', 'kraken'],
  ['hl', 'hyperliquid'],
  ['hyperliquid_perp', 'hyperliquid']
]);

for (let i = 0; i < BUILTIN_EXCHANGES.length; i++) {
  EXCHANGE_REGISTRY.set(BUILTIN_EXCHANGES[i].id, BUILTIN_EXCHANGES[i]);
}

function registerExchange(adapter) {
  if (!adapter || typeof adapter.id !== 'string' || !adapter.id.trim()) {
    throw new Error('Exchange adapter requires a valid string `id`.');
  }
  const id = adapter.id.trim().toLowerCase();
  EXCHANGE_REGISTRY.set(id, { ...adapter, id });
}

function resolveExchangeId(value, fallback = 'binance') {
  const raw = String(value || '').trim().toLowerCase();
  if (EXCHANGE_REGISTRY.has(raw)) return raw;
  if (EXCHANGE_ALIASES.has(raw)) return EXCHANGE_ALIASES.get(raw);
  return EXCHANGE_REGISTRY.has(fallback) ? fallback : 'binance';
}

function getExchangeAdapter(value) {
  return EXCHANGE_REGISTRY.get(resolveExchangeId(value));
}

function listExchanges() {
  return [...EXCHANGE_REGISTRY.values()].map((a) => ({
    id: a.id,
    name: a.name,
    badge: a.badge
  }));
}

// ---- hub.js ----
/**
 * Global WebSocket Multiplexer (ExchangeHub) & Coalesced VSync Render Scheduler.
 *
 * Guarantees that embedding 20+ charts for an exchange opens ONLY ONE WebSocket connection,
 * batches subscriptions into minimal frames, deduplicates identical streams via reference counting,
 * and coalesces all Canvas repaints into a single requestAnimationFrame pass per display frame.
 */

class ExchangeStreamConnection {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.WebSocketImpl = options.WebSocketImpl || null;
    this.batchDelayMs = options.batchDelayMs ?? 16;
    this.idleCloseMs = options.idleCloseMs ?? 3500;

    this.ws = null;
    this.state = 'idle'; // 'idle' | 'connecting' | 'live' | 'reconnecting'
    this.urlIndex = 0;
    this.reconnectAttempts = 0;
    this.msgIdSeq = 0;
    this.messagesReceived = 0;

    /** @type {Map<string, Set<object>>} topic -> Set<subscriberRecord> */
    this.topicListeners = new Map();
    /** @type {Set<object>} all active subscriber records on this exchange */
    this.subscribers = new Set();
    /** @type {Set<string>} topics currently active on the open wire */
    this.wireTopics = new Set();
    this.pendingSub = new Set();
    this.pendingUnsub = new Set();

    this.flushTimer = null;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.idleCloseTimer = null;
  }

  _nextId() {
    this.msgIdSeq = (this.msgIdSeq + 1) % 1000000000;
    return this.msgIdSeq;
  }

  _setState(nextState) {
    if (this.state === nextState) return;
    this.state = nextState;
    for (const sub of this.subscribers) {
      if (typeof sub.onStatus === 'function') {
        try {
          sub.onStatus(nextState);
        } catch {
          // isolate subscriber callback errors
        }
      }
    }
  }

  addSubscriber(record) {
    if (this.idleCloseTimer) {
      clearTimeout(this.idleCloseTimer);
      this.idleCloseTimer = null;
    }

    this.subscribers.add(record);
    for (let i = 0; i < record.topics.length; i++) {
      const topic = record.topics[i];
      let set = this.topicListeners.get(topic);
      if (!set) {
        set = new Set();
        this.topicListeners.set(topic, set);
      }
      set.add(record);

      this.pendingUnsub.delete(topic);
      if (!this.wireTopics.has(topic)) {
        this.pendingSub.add(topic);
      }
    }

    if (typeof record.onStatus === 'function') {
      record.onStatus(this.state === 'idle' ? 'connecting' : this.state);
    }

    this._ensureConnected();
    this._scheduleFlush();
  }

  removeSubscriber(record) {
    if (!this.subscribers.delete(record)) return;

    for (let i = 0; i < record.topics.length; i++) {
      const topic = record.topics[i];
      const set = this.topicListeners.get(topic);
      if (!set) continue;
      set.delete(record);
      if (set.size === 0) {
        this.topicListeners.delete(topic);
        this.pendingSub.delete(topic);
        if (this.wireTopics.has(topic)) {
          this.pendingUnsub.add(topic);
        }
      }
    }

    if (this.subscribers.size === 0) {
      this._scheduleIdleShutdown();
    } else {
      this._scheduleFlush();
    }
  }

  _ensureConnected() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) {
      return;
    }
    if (this.reconnectTimer) return;

    const WS = this.WebSocketImpl || globalThis.WebSocket;
    if (!WS) {
      this._setState('offline');
      return;
    }

    const urls = this.adapter.wsUrls || [];
    if (!urls.length) return;
    const url = urls[this.urlIndex % urls.length];

    this._setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    let sock;
    try {
      sock = new WS(url);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this.ws = sock;

    sock.onopen = () => {
      if (this.ws !== sock) return;
      this.reconnectAttempts = 0;
      this.wireTopics.clear();
      this.pendingUnsub.clear();
      for (const topic of this.topicListeners.keys()) {
        this.pendingSub.add(topic);
      }
      this._setState('live');
      this._startHeartbeat();
      this._flushNow();
    };

    sock.onmessage = (event) => {
      if (this.ws !== sock) return;
      this.messagesReceived++;
      const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
      if (!raw) return;
      const events = this.adapter.parseWsMessage(raw);
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const listeners = this.topicListeners.get(ev.topic);
        if (!listeners || listeners.size === 0) continue;
        for (const sub of listeners) {
          try {
            if (ev.kind === 'candle' && typeof sub.onCandle === 'function') {
              sub.onCandle(ev.candle);
            } else if (ev.kind === 'ticker' && typeof sub.onTicker === 'function') {
              sub.onTicker(ev.ticker);
            }
          } catch {
            // isolate widget listener errors
          }
        }
      }
    };

    sock.onerror = () => {
      // Handled uniformly in onclose
    };

    sock.onclose = () => {
      if (this.ws !== sock) return;
      this.ws = null;
      this._stopHeartbeat();
      this.wireTopics.clear();
      if (this.subscribers.size > 0) {
        this.urlIndex++;
        this._scheduleReconnect();
      } else {
        this._setState('idle');
      }
    };
  }

  _scheduleFlush() {
    if (this.flushTimer) return;
    if (!this.ws || this.ws.readyState !== 1) return;
    if (this.pendingSub.size === 0 && this.pendingUnsub.size === 0) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this._flushNow();
    }, this.batchDelayMs);
  }

  _flushNow() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.ws || this.ws.readyState !== 1) return;

    if (this.pendingUnsub.size > 0) {
      const toUnsub = [...this.pendingUnsub].filter((t) => this.wireTopics.has(t) && !this.topicListeners.has(t));
      this.pendingUnsub.clear();
      if (toUnsub.length > 0) {
        for (let i = 0; i < toUnsub.length; i++) {
          this.wireTopics.delete(toUnsub[i]);
        }
        const frames = this.adapter.buildUnsubscribeMessages(toUnsub, () => this._nextId());
        this._sendFrames(frames);
      }
    }

    if (this.pendingSub.size > 0) {
      const toSub = [...this.pendingSub].filter((t) => !this.wireTopics.has(t) && this.topicListeners.has(t));
      this.pendingSub.clear();
      if (toSub.length > 0) {
        for (let i = 0; i < toSub.length; i++) {
          this.wireTopics.add(toSub[i]);
        }
        const frames = this.adapter.buildSubscribeMessages(toSub, () => this._nextId());
        this._sendFrames(frames);
      }
    }
  }

  _sendFrames(frames) {
    if (!this.ws || this.ws.readyState !== 1 || !Array.isArray(frames)) return;
    for (let i = 0; i < frames.length; i++) {
      const payload = typeof frames[i] === 'string' ? frames[i] : JSON.stringify(frames[i]);
      try {
        this.ws.send(payload);
      } catch {
        break;
      }
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    const interval = this.adapter.pingIntervalMs;
    if (!(interval > 0) || typeof this.adapter.buildPing !== 'function') return;
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        try {
          this.ws.send(this.adapter.buildPing());
        } catch {
          // ignore
        }
      }
    }, interval);
  }

  _stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer || this.subscribers.size === 0) return;
    this.reconnectAttempts++;
    this._setState('reconnecting');
    const baseDelay = Math.min(15000, 800 * Math.pow(1.8, Math.min(6, this.reconnectAttempts - 1)));
    const jitter = Math.floor(Math.random() * 300);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.subscribers.size > 0) {
        this._ensureConnected();
      }
    }, baseDelay + jitter);
  }

  _scheduleIdleShutdown() {
    if (this.idleCloseTimer) clearTimeout(this.idleCloseTimer);
    this.idleCloseTimer = setTimeout(() => {
      this.idleCloseTimer = null;
      if (this.subscribers.size === 0) {
        this.closeNow();
      }
    }, this.idleCloseMs);
  }

  wakeIfNeeded() {
    if (this.subscribers.size === 0) return;
    if (!this.ws || (this.ws.readyState !== 0 && this.ws.readyState !== 1)) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      this._ensureConnected();
    }
  }

  closeNow() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.idleCloseTimer) {
      clearTimeout(this.idleCloseTimer);
      this.idleCloseTimer = null;
    }
    this._stopHeartbeat();
    this.pendingSub.clear();
    this.pendingUnsub.clear();
    this.wireTopics.clear();
    const sock = this.ws;
    this.ws = null;
    this._setState('idle');
    if (sock) {
      try {
        sock.onclose = null;
        sock.onerror = null;
        sock.onmessage = null;
        sock.close(1000, 'idle');
      } catch {
        // ignore
      }
    }
  }
}

class ExchangeHub {
  constructor(options = {}) {
    this.WebSocketImpl = options.WebSocketImpl || null;
    this.fetchImpl = options.fetchImpl || null;
    this.batchDelayMs = options.batchDelayMs ?? 16;
    this.idleCloseMs = options.idleCloseMs ?? 3500;

    /** @type {Map<string, ExchangeStreamConnection>} */
    this.connections = new Map();
    /** @type {Map<string, Promise<object>>} */
    this.inflightSnapshots = new Map();

    if (typeof globalThis.window !== 'undefined' && typeof globalThis.window.addEventListener === 'function') {
      this._onOnline = () => this.wakeAll();
      this._onVisibility = () => {
        if (globalThis.document?.visibilityState === 'visible') {
          this.wakeAll();
        }
      };
      globalThis.window.addEventListener('online', this._onOnline, { passive: true });
      globalThis.document?.addEventListener('visibilitychange', this._onVisibility, { passive: true });
    }
  }

  _getConnection(exchangeId) {
    const id = resolveExchangeId(exchangeId);
    let conn = this.connections.get(id);
    if (!conn) {
      const adapter = getExchangeAdapter(id);
      conn = new ExchangeStreamConnection(adapter, {
        WebSocketImpl: this.WebSocketImpl,
        batchDelayMs: this.batchDelayMs,
        idleCloseMs: this.idleCloseMs
      });
      this.connections.set(id, conn);
    }
    return conn;
  }

  /**
   * Fetches initial historical candles + 24h ticker snapshot, deduplicating identical concurrent requests.
   */
  async fetchSnapshot({ exchange, symbol, interval, limit = 300, endTimeMs, proxyUrl }) {
    const exId = resolveExchangeId(exchange);
    const adapter = getExchangeAdapter(exId);
    const tf = normalizeInterval(interval);
    const key = `${exId}|${symbol}|${tf}|${limit}|${endTimeMs || 0}|${proxyUrl || ''}`;

    let promise = this.inflightSnapshots.get(key);
    if (!promise) {
      promise = adapter.fetchSnapshot({
        symbol,
        interval: tf,
        limit,
        endTimeMs,
        proxyUrl,
        WebSocketImpl: this.WebSocketImpl,
        fetchImpl: this.fetchImpl
      }).finally(() => {
        this.inflightSnapshots.delete(key);
      });
      this.inflightSnapshots.set(key, promise);
    }

    const res = await promise;
    return {
      resolvedSymbol: res.resolvedSymbol || symbol,
      candles: res.candles.map((c) => ({ ...c })),
      ticker: res.ticker ? { ...res.ticker } : null
    };
  }

  /**
   * Subscribes a chart instance to live updates through the shared single-WebSocket pool.
   * Returns an `unsubscribe()` cleanup function.
   */
  subscribe({ exchange, symbol, interval, onCandle, onTicker, onStatus }) {
    const exId = resolveExchangeId(exchange);
    const adapter = getExchangeAdapter(exId);
    const tf = normalizeInterval(interval);
    const topics = adapter.getStreamTopics(symbol, tf);
    const conn = this._getConnection(exId);

    const record = {
      exchange: exId,
      symbol,
      interval: tf,
      topics,
      onCandle,
      onTicker,
      onStatus
    };

    conn.addSubscriber(record);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      conn.removeSubscriber(record);
    };
  }

  wakeAll() {
    for (const conn of this.connections.values()) {
      conn.wakeIfNeeded();
    }
  }

  /**
   * Returns live multiplexer telemetry (active sockets, subscribed topics, total widgets).
   */
  getStats() {
    let activeSockets = 0;
    let connectingSockets = 0;
    let totalTopics = 0;
    let totalSubscribers = 0;
    const exchanges = {};

    for (const [id, conn] of this.connections.entries()) {
      const readyState = conn.ws ? conn.ws.readyState : -1;
      if (readyState === 1) activeSockets++;
      else if (readyState === 0) connectingSockets++;

      const topics = conn.topicListeners.size;
      const subscribers = conn.subscribers.size;
      totalTopics += topics;
      totalSubscribers += subscribers;

      if (subscribers > 0 || readyState === 0 || readyState === 1) {
        exchanges[id] = {
          state: conn.state,
          readyState,
          topics,
          wireTopics: conn.wireTopics.size,
          subscribers,
          messagesReceived: conn.messagesReceived
        };
      }
    }

    return {
      activeSockets,
      connectingSockets,
      totalSockets: activeSockets + connectingSockets,
      totalTopics,
      totalSubscribers,
      exchanges
    };
  }

  destroyAll() {
    for (const conn of this.connections.values()) {
      conn.closeNow();
    }
    this.connections.clear();
    this.inflightSnapshots.clear();
  }
}

const GLOBAL_HUB_KEY = Symbol.for('tradingray.widget.hub.v1');

function getGlobalHub() {
  if (!globalThis[GLOBAL_HUB_KEY]) {
    globalThis[GLOBAL_HUB_KEY] = new ExchangeHub();
  }
  return globalThis[GLOBAL_HUB_KEY];
}

/**
 * Shared vsync render scheduler so 20+ charts coalesce repaints into a single animation frame.
 */
class VSyncScheduler {
  constructor() {
    this.queue = new Set();
    this.rafId = 0;
    this._flush = this._flush.bind(this);
  }

  schedule(fn) {
    this.queue.add(fn);
    if (!this.rafId) {
      const raf = typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame
        : (cb) => setTimeout(cb, 16);
      this.rafId = raf(this._flush);
    }
  }

  cancel(fn) {
    this.queue.delete(fn);
  }

  _flush() {
    this.rafId = 0;
    if (this.queue.size === 0) return;
    const tasks = [...this.queue];
    this.queue.clear();
    for (let i = 0; i < tasks.length; i++) {
      try {
        tasks[i]();
      } catch {
        // isolate frame callback errors
      }
    }
  }
}

const frameScheduler = new VSyncScheduler();

// ---- renderer.js ----
/**
 * High-performance zero-GC HTML5 Canvas 2D renderer for Candlesticks & Price Line charts.
 * Features calendar/clock-aligned timeline ticks, 1:1 natural panning, cursor-anchored time zoom,
 * timeline & price-axis drag scaling, and full color/style customization.
 */

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

function parseCssRgb(color) {
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

function colorWithAlpha(color, alpha) {
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

class ChartCanvasRenderer {
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

// ---- widget.js ----
/**
 * TradingRayChartWidget — Encapsulated Shadow DOM crypto chart widget controller.
 * Frameless minimalist UI (max font-weight 500), logo-only watermark, responsive ResizeObserver,
 * viewport hibernation (IntersectionObserver), 1:1 pan, timeline & price-axis drag scaling,
 * cursor-anchored wheel/pinch zoom, fullscreen (native + iOS fallback), and full color customization.
 */

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

class TradingRayChartWidget {
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

// ---- index.js ----
/**
 * TradingRay Crypto Chart Widget — Public Entry Point.
 * Provides:
 *   1. `<tradingray-chart>` Web Component (Custom Element)
 *   2. `[data-tradingray]` declarative HTML auto-initializer
 *   3. `createChart(container, options)` programmatic JavaScript API
 *   4. `getHubStats()` shared WebSocket multiplexer telemetry
 */

const mountedElements = new WeakMap();

const OBSERVED_ATTRS = [
  'exchange',
  'symbol',
  'interval',
  'timeframe',
  'type',
  'theme',
  'watermark',
  'toolbar',
  'volume',
  'axes',
  'grid',
  'legend',
  'crosshair',
  'fullscreen',
  'compact',
  'borderless',
  'hollow-candles',
  'up-color',
  'down-color',
  'wick-up-color',
  'wick-down-color',
  'line-color',
  'line-width',
  'area-fill',
  'area-top-color',
  'area-bottom-color',
  'pulse',
  'price-line',
  'price-line-color',
  'price-line-style',
  'bg-color',
  'text-color',
  'grid-color',
  'volume-up-color',
  'volume-down-color',
  'crosshair-color',
  'radius',
  'initial-bars',
  'locale',
  'timezone',
  'proxy-url',
  'height',
  'title'
];

function attrToOptionKey(attr) {
  return attr.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

const DATA_OPTION_KEYS = OBSERVED_ATTRS.map(attrToOptionKey);

function readDataOptions(el) {
  const d = el.dataset || {};
  const opts = {};
  for (let i = 0; i < DATA_OPTION_KEYS.length; i++) {
    const key = DATA_OPTION_KEYS[i];
    if (d[key] !== undefined) {
      opts[key] = d[key];
    }
  }
  if (opts.interval === undefined && d.timeframe !== undefined) {
    opts.interval = d.timeframe;
  }
  if (opts.type === undefined && d.chartType !== undefined) {
    opts.type = d.chartType;
  }
  return opts;
}

function createChart(target, options = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) {
    throw new Error(`TradingRayWidget.createChart: target "${target}" not found.`);
  }
  const existing = mountedElements.get(el);
  if (existing && !existing.destroyed) {
    existing.destroy();
  }
  const merged = { ...readDataOptions(el), ...options };
  const widget = new TradingRayChartWidget(el, merged);
  mountedElements.set(el, widget);
  return widget;
}

function getInstance(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return null;
  if (el._widget && !el._widget.destroyed) return el._widget;
  const inst = mountedElements.get(el);
  return inst && !inst.destroyed ? inst : null;
}

function scan(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const nodes = root.querySelectorAll('[data-tradingray], [data-tradingray-chart]');
  const created = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const existing = mountedElements.get(el);
    if (existing && !existing.destroyed) continue;
    const widget = new TradingRayChartWidget(el, readDataOptions(el));
    mountedElements.set(el, widget);
    created.push(widget);
  }
  return created;
}

function getHubStats() {
  return getGlobalHub().getStats();
}

function registerCustomElement() {
  if (
    typeof globalThis.HTMLElement !== 'function' ||
    !globalThis.customElements ||
    globalThis.customElements.get('tradingray-chart')
  ) {
    return;
  }

  class TradingRayChartElement extends globalThis.HTMLElement {
    static get observedAttributes() {
      return OBSERVED_ATTRS;
    }

    constructor() {
      super();
      this._widget = null;
    }

    _collectAttributes() {
      const opts = readDataOptions(this);
      for (let i = 0; i < OBSERVED_ATTRS.length; i++) {
        const attr = OBSERVED_ATTRS[i];
        if (this.hasAttribute(attr)) {
          opts[attrToOptionKey(attr)] = this.getAttribute(attr);
        }
      }
      return opts;
    }

    connectedCallback() {
      if (!this._widget || this._widget.destroyed) {
        this._widget = new TradingRayChartWidget(this, this._collectAttributes());
        mountedElements.set(this, this._widget);
      }
    }

    disconnectedCallback() {
      queueMicrotask(() => {
        if (!this.isConnected && this._widget) {
          this._widget.destroy();
          this._widget = null;
        }
      });
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal || !this._widget || this._widget.destroyed) return;
      const key = attrToOptionKey(name);
      this._widget.updateOptions({ [key]: newVal });
    }

    get widget() {
      return this._widget;
    }
  }

  globalThis.customElements.define('tradingray-chart', TradingRayChartElement);
}

// Auto-initialize Web Component & `[data-tradingray]` nodes in browser environments
if (typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined') {
  registerCustomElement();
  if (globalThis.document.readyState === 'loading') {
    globalThis.document.addEventListener('DOMContentLoaded', () => scan(globalThis.document), { once: true });
  } else {
    queueMicrotask(() => scan(globalThis.document));
  }
}

const TradingRayWidget = Object.freeze({
  VERSION,
  SUPPORTED_INTERVALS,
  createChart,
  scan,
  getInstance,
  getHubStats,
  listExchanges,
  registerExchange,
  resolveExchangeId,
  getExchangeAdapter,
  parseSymbolInput,
  formatPrice,
  formatSignedPercent,
  formatCompactVolume,
  TradingRayChartWidget,
  ExchangeHub
});

  return TradingRayWidget;
});
