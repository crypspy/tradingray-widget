# TradingRay Crypto Chart Widget

[![License: MIT](https://img.shields.io/badge/License-MIT-1c202b.svg)](./LICENSE)
[![Dependencies: 0](https://img.shields.io/badge/dependencies-0-252a38.svg)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](./dist/tradingray-widget.d.ts)
[![Powered by TradingRay](https://img.shields.io/badge/Powered%20by-TradingRay-08090c.svg)](https://tradingray.com)

Ultra-lightweight, zero-dependency, real-time cryptocurrency chart widget for websites and web apps. Built for speed, instant embedding, and zero host-page lag — even with **20+ live charts** running simultaneously on a single page.

Connects **directly from the browser to crypto exchanges** (no backend proxy, no API keys) and supports both **Candlesticks (`candles`)** and **Price Line / Area (`line`)** modes, responsive container sizing, touch pinch-to-zoom, and native fullscreen.

---

## Why `tradingray-widget`?

- **Zero Dependencies & Tiny Footprint** — Pure modern ES modules + Canvas 2D. No React, Vue, D3, Chart.js, or iframe bloat.
- **1 Shared WebSocket per Exchange (`ExchangeHub`)** — Embed 1 or 30 charts from Binance (or Bybit, OKX, Coinbase, Kraken, Hyperliquid) on one page and the library multiplexes all subscriptions over **a single shared WebSocket connection** with reference-counted topics and micro-batched `SUBSCRIBE` / `UNSUBSCRIBE`.
- **Zero-GC HiDPI Canvas 2D Engine** — Batches bull/bear wicks, candle bodies, and volume histograms into minimal Canvas path passes inside a single global `requestAnimationFrame` (`VSyncScheduler`).
- **Viewport Hibernation (`IntersectionObserver`)** — Off-screen charts keep receiving lightweight data patches in memory without wasting GPU/Canvas paint cycles until scrolled into view.
- **Two Visual Styles + Compact Ticker Mode** — Full OHLCV **Candlesticks** (`type="candles"`), clean **Price Line with Gradient Area & Live Pulse Dot** (`type="line"`), plus ultra-compact **Price Strip / Sparkline** (`compact="on"`).
- **Direct Exchange Feeds (9 Markets Built-In)** — Binance Spot, Binance USDⓈ-M Futures, Bybit Spot, Bybit Linear Perp, OKX Spot, OKX Perp Swap, Coinbase, Kraken, and Hyperliquid.
- **Shadow DOM Style Isolation** — Host website CSS never breaks the chart, and widget styles never leak into your site. All instances share a single `CSSStyleSheet` via `adoptedStyleSheets`.
- **Frameless Aesthetic & Deep Visual Customization** — Clean borderless UI with lightweight typography (`font-weight <= 500`) and 25+ styling options for bull/bear candle bodies, wicks, hollow candles, price line color & dash style (`solid` / `dashed` / `dotted`), line/area colors, background, grid, crosshair, and corner radius.
- **Responsive, Touch-Ready & Fullscreen** — Adapts automatically from 180px sidebar cards to 4K monitors (`ResizeObserver`), supports smooth cursor-anchored wheel zoom, 1:1 natural drag pan, bottom-timeline horizontal drag scaling, right-axis vertical price scaling, 1-finger touch pan, 2-finger pinch zoom, infinite historical backfill on left pan, and 1-click Fullscreen (native Fullscreen API + fixed-viewport fallback for iOS Safari and restricted iframes).
- **Optional Logo-Only Watermark (`watermark="on" | "off"`)** — Displays a subtle, frameless monochrome TradingRay logo mark (no text, no background, no border) linking to [tradingray.com](https://tradingray.com) by default, cleanly toggleable via a single attribute or option.
- **100% Free & Open Source (MIT License)** — Free for personal, commercial, SaaS, and open-source projects.

---

## Quick Start

### 1. Drop-In HTML Web Component (CDN, No Build Step)

Add one `<script>` tag and place `<tradingray-chart>` anywhere on your page:

```html
<!-- Load via jsDelivr (npm or GitHub release) -->
<script src="https://cdn.jsdelivr.net/npm/tradingray-widget@1/dist/tradingray-widget.min.js" defer></script>

<!-- Candlestick Chart: Binance BTC/USDT (1h) -->
<tradingray-chart
  exchange="binance"
  symbol="BTCUSDT"
  interval="1h"
  type="candles"
  theme="dark"
  watermark="on"
  height="400"
></tradingray-chart>

<!-- Price Line Chart ("просто полосой цена"): Bybit SOL/USDT (15m) -->
<tradingray-chart
  exchange="bybit"
  symbol="SOLUSDT"
  interval="15m"
  type="line"
  theme="dark"
  volume="off"
  watermark="on"
  height="320"
></tradingray-chart>
```

> **Using GitHub Releases CDN directly (without npm):**
> ```html
> <script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USER/tradingray-widget@1.0.0/dist/tradingray-widget.min.js" defer></script>
> ```

---

### 2. Declarative HTML `data-*` Attributes

Prefer standard `<div>` tags for CMS / Markdown / WordPress embeds? Any element with `data-tradingray` is mounted automatically:

```html
<div
  data-tradingray
  data-exchange="okx"
  data-symbol="ETH-USDT"
  data-interval="4h"
  data-type="candles"
  data-theme="dark"
  data-watermark="on"
  data-height="380"
></div>

<script src="https://cdn.jsdelivr.net/npm/tradingray-widget@1/dist/tradingray-widget.min.js" defer></script>
```

---

### 3. NPM / ES Module / TypeScript

```bash
npm install tradingray-widget
```

```js
import { createChart, getHubStats } from 'tradingray-widget';

const chart = createChart('#btc-chart', {
  exchange: 'binance',
  symbol: 'BTC/USDT',
  interval: '15m',
  type: 'candles',   // 'candles' | 'line'
  theme: 'dark',     // 'dark' | 'light' | 'auto'
  watermark: 'on',   // 'on' | 'off' (or true | false)
  volume: true,
  axes: true,
  fullscreen: true,
  height: 420
});

// Switch coin or exchange dynamically — reuses the shared WebSocket hub!
chart.setSymbol('SOLUSDT', 'bybit');

// Inspect live WebSocket multiplexer telemetry
console.log(getHubStats());
```

---

## Configuration Options & HTML Attributes

Every option works identically as an HTML attribute on `<tradingray-chart>`, a `data-*` attribute on `<div data-tradingray>`, or a camelCase property in `createChart(el, options)`.

| HTML Attribute | JS Option | Values | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `exchange` | `exchange` | `'binance'`, `'binance_futures'`, `'bybit'`, `'bybit_futures'`, `'okx'`, `'okx_futures'`, `'coinbase'`, `'kraken'`, `'hyperliquid'` | `'binance'` | Direct market data source (snapshot + live WebSocket). |
| `symbol` | `symbol` | `'BTCUSDT'`, `'BTC/USDT'`, `'SOL-USD'`, `'ETH'` | `'BTCUSDT'` | Coin or trading pair. Automatically normalized to each exchange's native format. |
| `interval` *(or `timeframe`)* | `interval` | `'1m'`, `'5m'`, `'15m'`, `'30m'`, `'1h'`, `'4h'`, `'1d'`, `'1w'` | `'1h'` | Active candlestick / price bar timeframe. |
| `type` | `type` | `'candles'` \| `'line'` | `'candles'` | `'candles'` renders OHLC candlesticks; `'line'` renders a smooth price curve with optional gradient area & live pulse dot. |
| `theme` | `theme` | `'dark'` \| `'light'` \| `'auto'` | `'dark'` | Base color palette (`'auto'` follows `prefers-color-scheme`). |
| `watermark` | `watermark` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles the frameless monochrome TradingRay logo mark linking to `https://tradingray.com`. |
| `up-color` | `upColor` | CSS color (e.g. `'#16c784'`, `'#00e5ff'`) | Theme `up` | Bullish candle body, positive 24h badge, and auto-bullish color. |
| `down-color` | `downColor` | CSS color (e.g. `'#ea364f'`, `'#ff6d00'`) | Theme `down` | Bearish candle body, negative 24h badge, and auto-bearish color. |
| `wick-up-color` | `wickUpColor` | CSS color | `upColor` | Bullish candle high/low wick stroke color. |
| `wick-down-color` | `wickDownColor` | CSS color | `downColor` | Bearish candle high/low wick stroke color. |
| `hollow-candles` | `hollowCandles` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'off'` | Draws bullish candle bodies hollow (outlined) while bearish candles remain solid. |
| `line-color` | `lineColor` | `'auto'` \| `'accent'` \| CSS color (e.g. `'#3b82f6'`) | `'auto'` | Stroke color in `'line'` mode (`'auto'` uses `upColor` / `downColor` based on 24h change). |
| `line-width` | `lineWidth` | Number `1`–`5` (e.g. `2`, `2.5`) | `2` | Stroke thickness in `'line'` mode (px). |
| `area-fill` | `areaFill` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles gradient area fill beneath the price curve in `'line'` mode. |
| `area-top-color` | `areaTopColor` | CSS color (supports `rgba(...)`) | `lineColor` @ 22% | Custom top gradient stop color in `'line'` mode. |
| `area-bottom-color` | `areaBottomColor` | CSS color (supports `rgba(...)`) | `lineColor` @ 0% | Custom bottom gradient stop color in `'line'` mode. |
| `pulse` | `pulse` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles the live glowing dot at the latest price point in `'line'` mode. |
| `price-line` | `priceLine` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles the horizontal current-price line and live Y-axis price pill. |
| `price-line-color` | `priceLineColor` | CSS color (e.g. `'#f59e0b'`, `'#ffffff'`) | Auto bull/bear | Custom color for the current-price line and live right-axis price pill. |
| `price-line-style` | `priceLineStyle` | `'dashed'` \| `'dotted'` \| `'solid'` | `'dashed'` | Stroke dash pattern of the horizontal current-price line. |
| `bg-color` | `bgColor` | CSS color (e.g. `'#0b0e14'`, `'transparent'`) | Theme `bg` | Custom widget & canvas background color. |
| `text-color` | `textColor` | CSS color | Theme `text` | Custom header & axis label color. |
| `grid` | `grid` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles horizontal & vertical background grid lines. |
| `grid-color` | `gridColor` | CSS color (e.g. `'rgba(255,255,255,0.05)'`) | Theme `grid` | Custom grid line color. |
| `volume` | `volume` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles bottom volume histogram bars. |
| `volume-up-color` | `volumeUpColor` | CSS color | `upColor` @ 19% | Custom bullish volume bar color. |
| `volume-down-color` | `volumeDownColor` | CSS color | `downColor` @ 19% | Custom bearish volume bar color. |
| `crosshair` | `crosshair` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles interactive crosshair guide lines & axis callout pills on hover. |
| `crosshair-color` | `crosshairColor` | CSS color | Theme `crosshair` | Custom crosshair dashed guide line color. |
| `legend` | `legend` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles the floating OHLCV + timestamp readout bar under the header. |
| `toolbar` | `toolbar` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles top header bar (pair, live price, 24h %, timeframes, chart type, fullscreen). |
| `axes` | `axes` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles right price scale and bottom timeline axis. |
| `fullscreen` | `fullscreen` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'on'` | Toggles the fullscreen expand button (`Esc` exits fullscreen). |
| `compact` | `compact` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'off'` | Compact mini-card / price-strip mode (hides axes, grid, volume, legend, and toolbar buttons; default height `130px`). |
| `borderless` | `borderless` | `'on'` \| `'off'` *(or `true` \| `false`)* | `'off'` | Sets corner radius to `0` for flush edge-to-edge embedding inside custom containers. |
| `radius` | `radius` | Number (`0`–`28`, px) | `12` (`0` if `borderless`) | Custom outer corner radius in pixels. |
| `initial-bars` | `initialBars` | Number (`10`–`300`) | Auto by width | Initial number of visible bars fitted into the viewport on load / reset. |
| `height` | `height` | Number or CSS length (e.g. `380`, `'420px'`, `'100%'`) | `360` (`130` if `compact`) | Widget height. Adapts automatically on container resize. |
| `title` | `title` | String (e.g. `'Bitcoin'`) | `''` | Optional custom label replacing the default `BASE/QUOTE` title in the header. |
| `locale` | `locale` | BCP-47 tag (e.g. `'en-US'`, `'ru-RU'`) | Browser locale | Locale used for date/time formatting on the timeline and crosshair. |
| `timezone` | `timezone` | `'local'` \| `'UTC'` \| IANA zone (e.g. `'Europe/Kyiv'`, `'America/New_York'`) | `'local'` (`'UTC'` on `>=1d`) | Timezone used for timeline ticks, day-rollover markers, and crosshair timestamps. |
| `proxy-url` | `proxyUrl` | URL prefix or template with `{url}` | `''` | Optional HTTP proxy prefix for restricted corporate networks. Not needed for normal browser usage. |

---

## Supported Exchanges & Smart Symbol Input

You do **not** need to memorize exchange-specific symbol delimiters. Pass `'BTCUSDT'`, `'BTC/USDT'`, `'btc-usdt'`, or even just `'BTC'`, and the adapter automatically normalizes the pair:

| `exchange` ID | Aliases | Market | Native Example (`symbol="BTC"`) | Transport |
| :--- | :--- | :--- | :--- | :--- |
| `binance` | `bn`, `binance_spot` | Binance Spot | `BTCUSDT` | WS-RPC + `stream.binance.com` WS |
| `binance_futures` | `binance_perp`, `binancef` | Binance USDⓈ-M Perp | `BTCUSDT` | WS-RPC + `fstream.binance.com` WS |
| `bybit` | `bybit_spot` | Bybit Spot v5 | `BTCUSDT` | REST v5 + `stream.bybit.com` WS |
| `bybit_futures` | `bybit_perp`, `bybit_linear` | Bybit Linear Perp v5 | `BTCUSDT` | REST v5 + `stream.bybit.com` WS |
| `okx` | `okx_spot` | OKX Spot v5 | `BTC-USDT` | REST v5 + `ws.okx.com` Business WS |
| `okx_futures` | `okx_perp`, `okx_swap` | OKX Perpetual Swap v5 | `BTC-USDT-SWAP` | REST v5 + `ws.okx.com` Business WS |
| `coinbase` | `cb`, `coinbase_spot` | Coinbase Exchange | `BTC-USD` | REST Candles + `ws-feed.exchange.coinbase.com` |
| `kraken` | `kraken_spot` | Kraken Spot | `BTC/USD` | REST OHLC + `ws.kraken.com/v2` |
| `hyperliquid` | `hl`, `hyperliquid_perp` | Hyperliquid Perp L1 | `BTC` (`BTC/USDC`) | Info API + `api.hyperliquid.xyz/ws` |

> **Zero-CORS Binance Architecture:** Binance Spot and Binance Futures snapshots use a shared, auto-closing WebSocket JSON-RPC pool (`wss://ws-api.binance.com` / `wss://ws-fapi.binance.com`) with automatic REST fallback, so charts load cleanly even from local `file://` pages or strict CSP origins, and close the RPC socket after `1.8s` idle so **only 1 live stream WebSocket** stays open.

---

## Common Embed Recipes

### Minimal Price Strip ("Просто полосой цена")

Ideal for news articles, token headers, dashboards, or comparison tables:

```html
<tradingray-chart
  exchange="binance"
  symbol="ETHUSDT"
  interval="15m"
  type="line"
  compact="on"
  watermark="on"
  height="130"
></tradingray-chart>
```

### Multi-Coin Grid Sharing 1 WebSocket

All 4 charts below share **1 single Binance WebSocket connection** and **1 shared `requestAnimationFrame` loop**:

```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">
  <tradingray-chart exchange="binance" symbol="BTCUSDT" interval="1h" type="candles"></tradingray-chart>
  <tradingray-chart exchange="binance" symbol="ETHUSDT" interval="1h" type="candles"></tradingray-chart>
  <tradingray-chart exchange="binance" symbol="SOLUSDT" interval="15m" type="line"></tradingray-chart>
  <tradingray-chart exchange="binance" symbol="TONUSDT" interval="15m" type="line"></tradingray-chart>
</div>
```

### Custom Candle Colors, Hollow Candles & Price Line Styling

```html
<tradingray-chart
  exchange="binance"
  symbol="BTCUSDT"
  interval="1h"
  type="candles"
  up-color="#00e5ff"
  down-color="#ff4d6d"
  hollow-candles="on"
  price-line-color="#fbbf24"
  price-line-style="dotted"
  bg-color="#0a0c12"
  radius="14"
  height="400"
></tradingray-chart>
```

### Disabling the Watermark

```html
<tradingray-chart
  exchange="bybit"
  symbol="BTCUSDT"
  watermark="off"
></tradingray-chart>
```

---

## Performance Architecture (How 20+ Charts Run Without Lag)

Traditional chart widgets spawn an `<iframe>` + dedicated WebSocket + independent render loop + duplicated CSS/JS bundle per chart. Embedding 20 of them opens 20 WebSockets and 20 JS contexts.

`tradingray-widget` is engineered around four shared primitives:

1. **Global Singleton `ExchangeHub` (`Symbol.for('tradingray.widget.hub.v1')`)**
   - Regardless of whether the library is imported once or multiple times across micro-frontends, all charts on the page coordinate through one `ExchangeHub`.
   - Subscriptions placed within the same `40ms` window are coalesced into a **single batched `SUBSCRIBE` frame** per exchange.
   - If two charts watch the same coin & timeframe, both network snapshot fetches and WebSocket stream topics are **deduplicated via reference counting**.
   - When the last chart for an exchange is removed from the DOM, the socket closes cleanly after an idle grace window (`15s`).
2. **Coalesced `VSyncScheduler`**
   - High-frequency exchange ticks (dozens per second across 20 pairs) mutate lightweight numeric arrays in memory and mark the widget dirty. Actual Canvas redraws execute at most **once per monitor refresh (`requestAnimationFrame`)**.
3. **Viewport Hibernation (`IntersectionObserver`)**
   - Charts scrolled outside the browser viewport pause Canvas rendering completely while staying synchronized in memory. Scrolling back renders the up-to-date frame immediately.
4. **Zero-Allocation Hot Render Path**
   - Bullish wicks, bearish wicks, bullish bodies, and bearish bodies are batched into **4 `ctx.stroke()` / `ctx.fill()` calls** regardless of whether 40 or 400 candles are visible.
   - `Intl.DateTimeFormat` instances and `CSSStyleSheet` objects are cached and shared globally across all widget instances.

---

## JavaScript API

### Top-Level Functions

```js
import TradingRayWidget, {
  createChart,
  scan,
  getInstance,
  getHubStats,
  listExchanges,
  registerExchange
} from 'tradingray-widget';
```

- **`createChart(target, options)`** — Mounts a `TradingRayChartWidget` inside a CSS selector or `HTMLElement` and returns the widget instance.
- **`getInstance(target)`** — Returns the active `TradingRayChartWidget` mounted on `target` (including `<tradingray-chart>` elements), or `null`.
- **`scan(root = document)`** — Scans `root` for unmounted `[data-tradingray]` elements and initializes them.
- **`getHubStats()`** — Returns live WebSocket telemetry (`activeSockets`, `totalTopics`, `totalSubscribers`, and per-exchange message counters).
- **`listExchanges()`** — Returns `[ { id, name, badge }, ... ]` for all registered exchanges.
- **`registerExchange(adapter)`** — Registers a custom exchange data adapter (works immediately with `<tradingray-chart exchange="my_dex">`).

### Widget Instance Methods

```js
const chart = createChart('#chart', { exchange: 'binance', symbol: 'BTCUSDT' });

chart.setSymbol('ETHUSDT');              // Switch symbol on current exchange
chart.setSymbol('SOL-USDT', 'okx');      // Switch symbol & exchange together
chart.setExchange('hyperliquid');        // Switch exchange keeping base coin
chart.setInterval('5m');                 // '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w'
chart.setType('line');                   // 'candles' | 'line'
chart.setTheme('light');                 // 'dark' | 'light' | 'auto'
chart.setWatermark(false);               // true | false | 'on' | 'off'
chart.updateOptions({ volume: false, lineColor: '#269a9b' });

await chart.enterFullscreen();
await chart.exitFullscreen();
await chart.toggleFullscreen();

console.log(chart.getState());
// {
//   exchange: 'hyperliquid',
//   symbol: 'SOL',
//   displayPair: 'SOL/USDC',
//   interval: '5m',
//   type: 'line',
//   theme: 'light',
//   watermark: false,
//   wsState: 'live',
//   livePrice: 178.42,
//   change24h: 3.18,
//   candleCount: 300,
//   isFullscreen: false
// }

chart.destroy();                         // Unsubscribes from hub & cleans up observers/DOM
```

### Interactive User Controls

- **Mouse Wheel / Trackpad Scroll** — Smooth proportional cursor-anchored time zoom (`1.2px` to `64px` per bar), keeping the exact bar under the cursor stationary.
- **Click + Drag on Chart** — Natural 1:1 horizontal pan across history and future space (automatically backfills older candles from the exchange when approaching the left edge), plus vertical pan whenever manual Y-axis scaling is active.
- **Click + Drag on Bottom Timeline Axis** — Horizontally stretch or compress the time scale (`ew-resize`); **double-click** the timeline to reset time zoom.
- **Click + Drag on Right Price Axis** — Vertically stretch or compress the Y-axis price scale (`ns-resize`); **double-click** the price axis (or chart) to reset auto-scale & jump back to live.
- **Touch Devices** — 1-finger horizontal drag pans history (while vertical page scroll remains unblocked when idle); 2-finger pinch zooms anchored around the midpoint between fingers.
- **Fullscreen Button / `Esc`** — Expands chart to full screen and restores exact scroll/layout state on exit.

---

## Registering a Custom Exchange Adapter

Need to connect your own exchange, DEX aggregator, or private brokerage WebSocket? Register a custom adapter before mounting charts:

```js
import { registerExchange } from 'tradingray-widget';

registerExchange({
  id: 'my_exchange',
  name: 'My Exchange',
  badge: 'MYEX',
  wsUrl: 'wss://stream.myexchange.example/ws',
  pingIntervalMs: 20000,
  buildPingMessage: () => ({ op: 'ping' }),

  normalizeSymbol(rawInput) {
    const clean = String(rawInput || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return { symbol: clean, base: clean.replace(/USDT$/, ''), quote: 'USDT', displayPair: clean };
  },

  async fetchSnapshot({ symbol, interval, limit = 300 }) {
    const res = await fetch(`https://api.myexchange.example/candles?symbol=${symbol}&tf=${interval}&limit=${limit}`);
    const data = await res.json();
    // Return ascending array of { time (unix sec), open, high, low, close, volume }
    return { candles: data.candles, ticker: { price: data.lastPrice, change24h: data.changePct } };
  },

  getStreamTopics(symbol, interval) {
    return [`kline.${interval}.${symbol}`];
  },

  buildSubscribeMessages(topics) {
    return [{ op: 'subscribe', args: topics }];
  },

  buildUnsubscribeMessages(topics) {
    return [{ op: 'unsubscribe', args: topics }];
  },

  parseWsMessage(rawText) {
    const msg = JSON.parse(rawText);
    if (!msg.topic || !msg.bar) return [];
    return [{
      topic: msg.topic,
      candle: msg.bar, // { time, open, high, low, close, volume }
      ticker: { price: msg.bar.close }
    }];
  }
});
```

---

## Project Structure & Development

```text
tradingray-widget/
├── src/
│   ├── constants.js     # Themes, intervals, TradingRay brand SVG, option normalizers
│   ├── format.js        # Smart symbol parser, dynamic price/volume/date formatters
│   ├── exchanges.js     # 9 direct exchange adapters + zero-CORS Binance WS-RPC pool
│   ├── hub.js           # ExchangeHub singleton WS multiplexer & VSyncScheduler
│   ├── renderer.js      # Zero-GC HiDPI Canvas 2D candlesticks, line/area & crosshair engine
│   ├── widget.js        # Shadow DOM UI, responsive ResizeObserver, IntersectionObserver, touch/mouse/fullscreen
│   └── index.js         # Public API, <tradingray-chart> Custom Element & [data-tradingray] scanner
├── dist/
│   ├── tradingray-widget.esm.js   # Standalone ES Module bundle
│   ├── tradingray-widget.js       # Standalone UMD bundle (window.TradingRayWidget)
│   ├── tradingray-widget.min.js   # Minified production UMD bundle for <script> / CDN
│   └── tradingray-widget.d.ts     # TypeScript definitions
├── examples/
│   ├── demo.html                  # Interactive Playground, Embed Generator & 20-Chart 1-WS Stress Test
│   └── minimal-embed.html         # Minimal copy-paste HTML example
├── scripts/
│   └── build.mjs                  # Zero-dependency bundle builder
├── test/
│   └── widget.test.mjs            # Node.js unit tests (formatters, adapters, WS multiplexer deduplication)
├── LICENSE                        # MIT License
└── package.json
```

### Build & Run Unit Tests

Requires **Node.js >= 18** (uses built-in `node:test`, zero `npm install` packages required):

```bash
npm test
npm run build
```

Open `examples/demo.html` in any modern browser to try the live configurator, copy generated embed snippets, and run the **20-chart single-WebSocket stress test**.

---

## License

Released under the **[MIT License](./LICENSE)** — completely free and open for personal and commercial use.

Built by **[TradingRay](https://tradingray.com)**.
