/**
 * Global WebSocket Multiplexer (ExchangeHub) & Coalesced VSync Render Scheduler.
 *
 * Guarantees that embedding 20+ charts for an exchange opens ONLY ONE WebSocket connection,
 * batches subscriptions into minimal frames, deduplicates identical streams via reference counting,
 * and coalesces all Canvas repaints into a single requestAnimationFrame pass per display frame.
 */

import { getExchangeAdapter, resolveExchangeId } from './exchanges.js';
import { normalizeInterval } from './constants.js';

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

export class ExchangeHub {
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

export function getGlobalHub() {
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

export const frameScheduler = new VSyncScheduler();
