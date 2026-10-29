import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BRAND_LOGO_SVG,
  clampNumber,
  normalizeChartType,
  normalizeInterval,
  normalizeLineStyle,
  parseBool
} from '../src/constants.js';
import {
  formatCompactVolume,
  formatPrice,
  formatSignedPercent,
  formatTimelineTick,
  parseSymbolInput
} from '../src/format.js';
import {
  ChartCanvasRenderer,
  colorWithAlpha,
  parseCssRgb
} from '../src/renderer.js';
import {
  getExchangeAdapter,
  listExchanges,
  resolveExchangeId
} from '../src/exchanges.js';
import { ExchangeHub } from '../src/hub.js';

test('parseBool handles watermark on/off, true/false, 1/0, and empty attributes', () => {
  assert.equal(parseBool('on', false), true);
  assert.equal(parseBool('ON', false), true);
  assert.equal(parseBool('true', false), true);
  assert.equal(parseBool('1', false), true);
  assert.equal(parseBool('', false), true);
  assert.equal(parseBool(true, false), true);

  assert.equal(parseBool('off', true), false);
  assert.equal(parseBool('OFF', true), false);
  assert.equal(parseBool('false', true), false);
  assert.equal(parseBool('0', true), false);
  assert.equal(parseBool('no', true), false);
  assert.equal(parseBool(false, true), false);

  assert.equal(parseBool(undefined, true), true);
  assert.equal(parseBool(null, false), false);
});

test('normalizeInterval and normalizeChartType accept common aliases', () => {
  assert.equal(normalizeInterval('1h'), '1h');
  assert.equal(normalizeInterval('60'), '1h');
  assert.equal(normalizeInterval('240'), '4h');
  assert.equal(normalizeInterval('D'), '1d');
  assert.equal(normalizeInterval('invalid', '15m'), '15m');

  assert.equal(normalizeChartType('candles'), 'candles');
  assert.equal(normalizeChartType('candlestick'), 'candles');
  assert.equal(normalizeChartType('line'), 'line');
  assert.equal(normalizeChartType('price'), 'line');
  assert.equal(normalizeChartType('area'), 'line');
});

test('symbol normalization resolves native exchange formats cleanly', () => {
  assert.equal(parseSymbolInput('btcusdt').displayPair, 'BTC/USDT');
  assert.equal(parseSymbolInput('BINANCE:eth/usdc').displayPair, 'ETH/USDC');

  assert.equal(getExchangeAdapter('binance').resolveSymbol('solusdt').symbol, 'SOLUSDT');
  assert.equal(getExchangeAdapter('okx').resolveSymbol('BTCUSDT').symbol, 'BTC-USDT');
  assert.equal(getExchangeAdapter('okx_futures').resolveSymbol('BTCUSDT').symbol, 'BTC-USDT-SWAP');
  assert.equal(getExchangeAdapter('coinbase').resolveSymbol('BTCUSDT').symbol, 'BTC-USD');
  assert.equal(getExchangeAdapter('coinbase').resolveSymbol('ETH-USDT').symbol, 'ETH-USDT');
  assert.equal(getExchangeAdapter('kraken').resolveSymbol('BTCUSDT').symbol, 'BTC/USD');
  assert.equal(getExchangeAdapter('hyperliquid').resolveSymbol('SOLUSDT').symbol, 'SOL');
  assert.equal(getExchangeAdapter('hyperliquid').resolveSymbol('1000PEPEUSDT').symbol, 'kPEPE');

  assert.equal(resolveExchangeId('bybit-perp'), 'binance'); // unknown falls back
  assert.equal(resolveExchangeId('bybit_perp'), 'bybit_futures');
  assert.ok(listExchanges().length >= 9);
});

test('price, percent, and volume formatters handle wide crypto magnitudes', () => {
  assert.equal(formatPrice(94250.5), '94,250.50');
  assert.equal(formatPrice(1.2458), '1.2458');
  assert.equal(formatPrice(0.00001842), '0.00001842');
  assert.equal(formatSignedPercent(2.456), '+2.46%');
  assert.equal(formatSignedPercent(-1.2), '-1.20%');
  assert.equal(formatCompactVolume(1_450_000_000), '1.45B');
  assert.equal(formatCompactVolume(42_300_000), '42.30M');
});

test('ExchangeHub multiplexes 20+ charts onto a SINGLE WebSocket connection with ref-counted topics', async () => {
  class MockWebSocket {
    static instances = [];
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      MockWebSocket.instances.push(this);
      queueMicrotask(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        if (this.onopen) this.onopen();
      });
    }
    send(payload) {
      this.sent.push(JSON.parse(payload));
    }
    close() {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    }
    emitServerJson(obj) {
      if (this.onmessage) {
        this.onmessage({ data: JSON.stringify(obj) });
      }
    }
  }

  const hub = new ExchangeHub({
    WebSocketImpl: MockWebSocket,
    batchDelayMs: 5,
    idleCloseMs: 30
  });

  const unsubs = [];
  const receivedCandles = new Map();

  // Mount 20 distinct charts + 2 duplicate charts on Binance simultaneously
  for (let i = 0; i < 20; i++) {
    const sym = `COIN${i}USDT`;
    const unsub = hub.subscribe({
      exchange: 'binance',
      symbol: sym,
      interval: '1h',
      onCandle: (c) => receivedCandles.set(sym, c.close)
    });
    unsubs.push(unsub);
  }

  let dupHits = 0;
  const unsubDup1 = hub.subscribe({
    exchange: 'binance',
    symbol: 'COIN0USDT',
    interval: '1h',
    onCandle: () => { dupHits++; }
  });

  // Allow microtask socket open + flush
  await new Promise((r) => setTimeout(r, 20));

  const stats = hub.getStats();
  assert.equal(MockWebSocket.instances.length, 1, '20+ charts must share exactly 1 WebSocket');
  assert.equal(stats.activeSockets, 1);
  assert.equal(stats.totalSubscribers, 21);
  assert.equal(stats.totalTopics, 40, '20 unique symbols * 2 topics (kline + miniTicker) = 40 deduplicated topics');

  const sock = MockWebSocket.instances[0];
  assert.equal(sock.sent.length, 1, 'All 20 initial chart subscriptions must batch into 1 SUBSCRIBE frame');
  assert.equal(sock.sent[0].method, 'SUBSCRIBE');
  assert.equal(sock.sent[0].params.length, 40);

  // Deliver live kline update for COIN0USDT -> both COIN0 subscribers receive it, others untouched
  sock.emitServerJson({
    e: 'kline',
    s: 'COIN0USDT',
    k: { s: 'COIN0USDT', i: '1h', t: 1700000000000, o: '100', h: '110', l: '99', c: '105.5', v: '500' }
  });
  assert.equal(receivedCandles.get('COIN0USDT'), 105.5);
  assert.equal(dupHits, 1);
  assert.equal(receivedCandles.has('COIN1USDT'), false);

  // Unsubscribing duplicate COIN0USDT chart must NOT send UNSUBSCRIBE while primary chart still watches it
  unsubDup1();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sock.sent.length, 1, 'Ref-counted stream stays subscribed while 1 widget still uses it');

  // Unsubscribe all remaining 20 charts -> idle close shuts down the single socket cleanly
  for (const fn of unsubs) fn();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(hub.getStats().activeSockets, 0);
  hub.destroyAll();
});

test('Bybit Spot adapter chunks 15 charts (30 topics) into <=10-arg frames on 1 single WebSocket', async () => {
  class MockBybitWs {
    static instances = [];
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      MockBybitWs.instances.push(this);
      queueMicrotask(() => {
        this.readyState = 1;
        if (this.onopen) this.onopen();
      });
    }
    send(payload) {
      this.sent.push(JSON.parse(payload));
    }
    close() {
      this.readyState = 3;
    }
  }

  const hub = new ExchangeHub({
    WebSocketImpl: MockBybitWs,
    batchDelayMs: 5,
    idleCloseMs: 50
  });

  const unsubs = [];
  for (let i = 0; i < 15; i++) {
    unsubs.push(
      hub.subscribe({
        exchange: 'bybit',
        symbol: `TOKEN${i}USDT`,
        interval: '15m'
      })
    );
  }

  await new Promise((r) => setTimeout(r, 20));
  assert.equal(MockBybitWs.instances.length, 1);
  const frames = MockBybitWs.instances[0].sent;
  assert.equal(frames.length, 3, '30 Bybit topics chunked by 10 = 3 frames over 1 WebSocket');
  for (const frame of frames) {
    assert.equal(frame.op, 'subscribe');
    assert.ok(frame.args.length <= 10);
  }

  for (const fn of unsubs) fn();
  hub.destroyAll();
});

test('BRAND_LOGO_SVG is pure monochrome currentColor with zero green or lime colors', () => {
  assert.ok(BRAND_LOGO_SVG.includes('viewBox="34 41 235 235"'));
  assert.ok(BRAND_LOGO_SVG.includes('fill="currentColor"'));
  assert.equal(/#0ad2a6|lime|green/i.test(BRAND_LOGO_SVG), false);
});

test('option helpers and CSS color parsers handle custom chart colors and line styles', () => {
  assert.equal(normalizeLineStyle('solid'), 'solid');
  assert.equal(normalizeLineStyle('DOTTED'), 'dotted');
  assert.equal(normalizeLineStyle('unknown', 'dashed'), 'dashed');

  assert.equal(clampNumber('12', 1, 20, 5), 12);
  assert.equal(clampNumber(-4, 0, 28, 0), 0);
  assert.equal(clampNumber('bad', 1, 10, 4), 4);

  assert.deepEqual(parseCssRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(parseCssRgb('#16c784'), [22, 199, 132]);
  assert.deepEqual(parseCssRgb('rgb(234, 54, 79)'), [234, 54, 79]);
  assert.equal(colorWithAlpha('#3b82f6', 0.25), 'rgba(59, 130, 246, 0.25)');
});

test('ChartCanvasRenderer pans 1:1 with drag direction, anchors zoom, scales timeline, and aligns ticks', () => {
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      measureText: (s) => ({ width: String(s).length * 6.5 })
    })
  };

  const renderer = new ChartCanvasRenderer(mockCanvas);
  renderer.resize(700, 380);
  renderer.plotW = 640;
  renderer.plotH = 358;
  renderer.resetView(700, 0);

  const total = 200;
  const baseTime = 1704067200; // 2024-01-01T00:00:00Z
  const candles = Array.from({ length: total }, (_, i) => ({
    time: baseTime + i * 3600,
    open: 42000 + i * 10,
    high: 42100 + i * 10,
    low: 41950 + i * 10,
    close: 42050 + i * 10,
    volume: 120
  }));

  // 1:1 horizontal panning: dragging right (+90px) shifts candles right by +90px
  const xBefore = renderer.xForIndex(150, total);
  renderer.panByPixels(90, total);
  const xAfterRightDrag = renderer.xForIndex(150, total);
  assert.ok(Math.abs((xAfterRightDrag - xBefore) - 90) < 1e-6, 'Dragging right (+90px) must shift candles right by +90px');

  // Dragging left (-90px) shifts candles left by -90px back to original coordinate
  renderer.panByPixels(-90, total);
  const xAfterLeftDrag = renderer.xForIndex(150, total);
  assert.ok(Math.abs(xAfterLeftDrag - xBefore) < 1e-6, 'Dragging left (-90px) must return candles to original X');

  // Cursor-anchored zoom keeps the float bar index under anchorX invariant
  const anchorX = 280;
  const floatIdxBefore = renderer.floatIndexAtX(anchorX, total);
  renderer.zoomAtX(anchorX, 1.5, total);
  const floatIdxAfter = renderer.floatIndexAtX(anchorX, total);
  assert.ok(Math.abs(floatIdxAfter - floatIdxBefore) < 1e-6, 'Cursor-anchored zoom must keep bar index under cursor stationary');

  // Bottom timeline horizontal drag scaling: left drag stretches (zooms in), right drag compresses (zooms out)
  const spacingBeforeScale = renderer.barSpacing;
  renderer.scaleTimeAxis(-80, total);
  assert.ok(renderer.barSpacing > spacingBeforeScale, 'Dragging left on timeline must increase barSpacing (zoom in)');
  const spacingZoomedIn = renderer.barSpacing;
  renderer.scaleTimeAxis(80, total);
  assert.ok(renderer.barSpacing < spacingZoomedIn, 'Dragging right on timeline must decrease barSpacing (zoom out)');

  // Timeline ticks are clock-aligned, ascending, and spaced >= 68px apart even when panned into future space
  renderer.panByPixels(-180, total); // pan left so right half shows future space beyond latest candle
  const { ticks, stepSec } = renderer._computeTimeTicks(candles, 3600, 640);
  assert.ok(ticks.length >= 2, 'Should generate visible timeline ticks across history and future space');
  assert.equal(stepSec % 3600, 0);
  for (let i = 0; i < ticks.length; i++) {
    assert.equal(ticks[i].time % stepSec, 0, 'Intraday/hourly ticks must align cleanly to clock step boundaries');
    if (i > 0) {
      assert.ok(ticks[i].x - ticks[i - 1].x >= 68 - 1e-6, 'Adjacent timeline labels must never overlap');
    }
  }

  // Vertical manual scale + vertical pan
  renderer.lastTotalPriceSpan = 1000;
  renderer.scalePriceAxis(-40);
  assert.equal(renderer.manualPriceScale, true);
  renderer.panPriceByPixels(35.8);
  assert.ok(Math.abs(renderer.priceShiftSpan - 100) < 1e-4);
});

test('formatTimelineTick formats intraday HH:mm, day rollovers, and UTC daily dates cleanly', () => {
  const jan1_18h = 1704132000; // 2024-01-01T18:00:00Z
  const jan1_21h = 1704142800; // 2024-01-01T21:00:00Z
  const jan2_00h = 1704153600; // 2024-01-02T00:00:00Z

  const sameDayLabel = formatTimelineTick(jan1_21h, jan1_18h, 10800, 3600, 'en-US', 'UTC');
  assert.equal(sameDayLabel, '21:00');

  const rolloverLabel = formatTimelineTick(jan2_00h, jan1_21h, 10800, 3600, 'en-US', 'UTC');
  assert.ok(rolloverLabel.includes('Jan') && rolloverLabel.includes('2'), `Expected Jan 2 on day rollover, got ${rolloverLabel}`);

  const dailyLabel = formatTimelineTick(jan2_00h, jan1_18h, 86400, 86400, 'en-US');
  assert.ok(dailyLabel.includes('Jan') && dailyLabel.includes('2'));
});
