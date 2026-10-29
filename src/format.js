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
export function parseSymbolInput(rawSymbol, defaultQuote = 'USDT') {
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

export function getPriceDecimals(price) {
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

export function formatPrice(price, decimalsOverride) {
  const num = Number(price);
  if (!Number.isFinite(num)) return '—';
  const decimals = typeof decimalsOverride === 'number' ? decimalsOverride : getPriceDecimals(num);
  const fixed = num.toFixed(decimals);
  const dot = fixed.indexOf('.');
  if (dot === -1) return addThousandsCommas(fixed);
  const intPart = addThousandsCommas(fixed.slice(0, dot));
  return `${intPart}.${fixed.slice(dot + 1)}`;
}

export function formatSignedPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00%';
  const sign = num > 0.00005 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function formatCompactVolume(value) {
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
export function formatTimelineTick(tsSec, prevTsSec, stepSec, intervalSec, locale, timezone) {
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

export function formatAxisTime(tsSec, intervalSec, locale, timezone) {
  return formatTimelineTick(tsSec, null, intervalSec, intervalSec, locale, timezone);
}

export function formatCrosshairTime(tsSec, intervalSec, locale, timezone) {
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
