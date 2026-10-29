/**
 * Direct browser-to-exchange market data adapters (REST/WS-RPC snapshots + real-time WebSocket streams).
 * Supports Binance (Spot & Futures), Bybit (Spot & Futures), OKX (Spot & Futures),
 * Coinbase, Kraken, and Hyperliquid with zero API keys and zero backend dependencies.
 */

import { INTERVAL_SECONDS, normalizeInterval } from './constants.js';
import { parseSymbolInput } from './format.js';

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

export function registerExchange(adapter) {
  if (!adapter || typeof adapter.id !== 'string' || !adapter.id.trim()) {
    throw new Error('Exchange adapter requires a valid string `id`.');
  }
  const id = adapter.id.trim().toLowerCase();
  EXCHANGE_REGISTRY.set(id, { ...adapter, id });
}

export function resolveExchangeId(value, fallback = 'binance') {
  const raw = String(value || '').trim().toLowerCase();
  if (EXCHANGE_REGISTRY.has(raw)) return raw;
  if (EXCHANGE_ALIASES.has(raw)) return EXCHANGE_ALIASES.get(raw);
  return EXCHANGE_REGISTRY.has(fallback) ? fallback : 'binance';
}

export function getExchangeAdapter(value) {
  return EXCHANGE_REGISTRY.get(resolveExchangeId(value));
}

export function listExchanges() {
  return [...EXCHANGE_REGISTRY.values()].map((a) => ({
    id: a.id,
    name: a.name,
    badge: a.badge
  }));
}
