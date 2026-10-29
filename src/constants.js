/**
 * Core constants, themes, timeframes, and option parsers for TradingRay Widget.
 * Zero external dependencies.
 */

export const VERSION = '1.0.0';
export const BRAND_NAME = 'TradingRay';
export const BRAND_URL = 'https://tradingray.com';

// Pure monochrome TradingRay mark (from official tradingray-logo.svg, white via currentColor, no frame, no green)
export const BRAND_LOGO_SVG =
  '<svg viewBox="34 41 235 235" width="18" height="18" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M189.7 76.3c-1.6-.1-3.1-.2-4.7-.2H36.5L60 103.6h37.5v94.7l31-37.2v-57.5H185c2.5.1 4.7.2 6.5.6 1.2.2 2.3.5 3.5.8l24.7-17.6c-8.7-6.5-18.7-10.2-30-11.1Z"/>' +
  '<path fill="currentColor" d="M183.8 160.2 266.2 65l-108.7 83.1-89.6 103.3 94.2-71.9 44.8 44.7H247c.1-.1.3-.2.4-.4l-63.6-63.6Z"/>' +
  '</svg>';

export const INTERVAL_SECONDS = Object.freeze({
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800
});

export const SUPPORTED_INTERVALS = Object.freeze(Object.keys(INTERVAL_SECONDS));
export const TOOLBAR_INTERVALS = Object.freeze(['1m', '5m', '15m', '1h', '4h', '1d']);

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

export const THEMES = Object.freeze({
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

export function normalizeInterval(value, fallback = '1h') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (INTERVAL_SECONDS[raw]) return raw;
  if (INTERVAL_ALIASES[raw]) return INTERVAL_ALIASES[raw];
  return INTERVAL_SECONDS[fallback] ? fallback : '1h';
}

export function normalizeChartType(value, fallback = 'candles') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'line' || raw === 'area' || raw === 'price' || raw === 'sparkline') {
    return 'line';
  }
  if (raw === 'candles' || raw === 'candle' || raw === 'candlestick' || raw === 'candlesticks' || raw === 'ohlc') {
    return 'candles';
  }
  return fallback === 'line' ? 'line' : 'candles';
}

export function normalizeThemeName(value, fallback = 'dark') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'dark' || raw === 'light' || raw === 'auto') return raw;
  return fallback;
}

export function normalizeLineStyle(value, fallback = 'dashed') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'solid' || raw === 'dashed' || raw === 'dotted') return raw;
  return fallback;
}

export function clampNumber(value, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function parseBool(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const raw = String(value).trim().toLowerCase();
  if (raw === '') return true;
  if (raw === 'on' || raw === 'true' || raw === '1' || raw === 'yes' || raw === 'show') return true;
  if (raw === 'off' || raw === 'false' || raw === '0' || raw === 'no' || raw === 'hide' || raw === 'none') return false;
  return fallback;
}
