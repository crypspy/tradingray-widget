/**
 * TradingRay Crypto Chart Widget — Public Entry Point.
 * Provides:
 *   1. `<tradingray-chart>` Web Component (Custom Element)
 *   2. `[data-tradingray]` declarative HTML auto-initializer
 *   3. `createChart(container, options)` programmatic JavaScript API
 *   4. `getHubStats()` shared WebSocket multiplexer telemetry
 */

import { VERSION, SUPPORTED_INTERVALS } from './constants.js';
import {
  getExchangeAdapter,
  listExchanges,
  registerExchange,
  resolveExchangeId
} from './exchanges.js';
import { ExchangeHub, getGlobalHub } from './hub.js';
import { TradingRayChartWidget } from './widget.js';
import {
  formatCompactVolume,
  formatPrice,
  formatSignedPercent,
  parseSymbolInput
} from './format.js';

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

export function createChart(target, options = {}) {
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

export function getInstance(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return null;
  if (el._widget && !el._widget.destroyed) return el._widget;
  const inst = mountedElements.get(el);
  return inst && !inst.destroyed ? inst : null;
}

export function scan(root = globalThis.document) {
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

export function getHubStats() {
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

export const TradingRayWidget = Object.freeze({
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

export {
  VERSION,
  SUPPORTED_INTERVALS,
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
};

export default TradingRayWidget;
