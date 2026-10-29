/**
 * TypeScript type definitions for `tradingray-widget`.
 * MIT License | https://tradingray.com
 */

export type ExchangeId =
  | 'binance'
  | 'binance_futures'
  | 'bybit'
  | 'bybit_futures'
  | 'okx'
  | 'okx_futures'
  | 'coinbase'
  | 'kraken'
  | 'hyperliquid'
  | (string & {});

export type ChartInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
export type ChartType = 'candles' | 'line';
export type ThemeMode = 'dark' | 'light' | 'auto';
export type PriceLineStyle = 'dashed' | 'dotted' | 'solid';
export type BooleanToggle = boolean | 'on' | 'off' | 'true' | 'false';

export interface CandleBar {
  /** Unix timestamp in seconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerPatch {
  price?: number;
  change24h?: number;
  open24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  tradeSize?: number;
  tsSec?: number;
}

export interface TradingRayWidgetOptions {
  /** Exchange source. Default: `'binance'` */
  exchange?: ExchangeId;
  /** Trading pair symbol (e.g. `'BTCUSDT'`, `'ETH/USDT'`, `'SOL-USD'`, `'BTC'`). Default: `'BTCUSDT'` */
  symbol?: string;
  /** Initial timeframe. Default: `'1h'` */
  interval?: ChartInterval;
  /** Chart style: `'candles'` (candlesticks) or `'line'` (price line). Default: `'candles'` */
  type?: ChartType;
  /** Color theme: `'dark'`, `'light'`, or `'auto'`. Default: `'dark'` */
  theme?: ThemeMode;
  /** Toggle TradingRay micro-logo link (`true`/`'on'` or `false`/`'off'`). Default: `true` */
  watermark?: BooleanToggle;
  /** Show top header bar with live price, timeframe, type & fullscreen buttons. Default: `true` */
  toolbar?: BooleanToggle;
  /** Show volume histogram in candlestick mode. Default: `true` */
  volume?: BooleanToggle;
  /** Show right price axis and bottom time axis. Default: `true` */
  axes?: BooleanToggle;
  /** Show subtle background grid lines. Default: `true` */
  grid?: BooleanToggle;
  /** Show top-left OHLCV hover legend. Default: `true` */
  legend?: BooleanToggle;
  /** Enable interactive crosshair lines & axis pills. Default: `true` */
  crosshair?: BooleanToggle;
  /** Show horizontal live current-price line & right-axis price tag. Default: `true` */
  priceLine?: BooleanToggle;
  /** Show fullscreen toggle button in header. Default: `true` */
  fullscreen?: BooleanToggle;
  /** Ultra-compact sparkline / mini-ticker mode. Default: `false` */
  compact?: BooleanToggle;
  /** Set zero corner radius for flush edge-to-edge embedding. Default: `false` */
  borderless?: BooleanToggle;
  /** Render hollow (outlined) bullish candles instead of solid filled bodies. Default: `false` */
  hollowCandles?: BooleanToggle;
  /** Custom bullish candle & positive % color (e.g. `'#16c784'`, `'#ffffff'`, `'#3b82f6'`). */
  upColor?: string;
  /** Custom bearish candle & negative % color (e.g. `'#ea364f'`, `'#6b7280'`). */
  downColor?: string;
  /** Optional custom bullish candle wick color (defaults to `upColor`). */
  wickUpColor?: string;
  /** Optional custom bearish candle wick color (defaults to `downColor`). */
  wickDownColor?: string;
  /** Custom stroke color in `'line'` mode (`'auto'`, `'accent'`, or CSS color `'#3b82f6'`). Default: `'auto'` */
  lineColor?: string;
  /** Stroke thickness in `'line'` mode (`1` to `5`). Default: `2` */
  lineWidth?: number | string;
  /** Fill gradient area beneath the line in `'line'` mode. Default: `true` */
  areaFill?: BooleanToggle;
  /** Optional top gradient color beneath the line in `'line'` mode. */
  areaTopColor?: string;
  /** Optional bottom gradient color beneath the line in `'line'` mode. */
  areaBottomColor?: string;
  /** Show live beacon dot on the latest data point in `'line'` mode. Default: `true` */
  pulse?: BooleanToggle;
  /** Custom color for the horizontal current-price guide line & live price pill (`'auto'` or CSS color). Default: `'auto'` */
  priceLineColor?: string;
  /** Line style for the horizontal current-price line (`'dashed'`, `'dotted'`, or `'solid'`). Default: `'dashed'` */
  priceLineStyle?: PriceLineStyle;
  /** Custom chart & header background color (e.g. `'#000000'`, `'#0b0e14'`, `'transparent'`). */
  bgColor?: string;
  /** Custom axis and UI text color. */
  textColor?: string;
  /** Custom background grid line color (e.g. `'rgba(255,255,255,0.04)'`). */
  gridColor?: string;
  /** Custom bullish volume bar color. */
  volumeUpColor?: string;
  /** Custom bearish volume bar color. */
  volumeDownColor?: string;
  /** Custom crosshair dashed line color. */
  crosshairColor?: string;
  /** Outer card corner radius in px (`0` to `40`). Default: `12` */
  radius?: number | string;
  /** Target number of visible candles on initial load (`10` to `500`). */
  initialBars?: number | string;
  /** BCP-47 locale for date/time labels (e.g. `'en-US'`, `'ru-RU'`). */
  locale?: string;
  /** Display timezone (`'local'`, `'UTC'`, or IANA timezone like `'Europe/Kyiv'`). */
  timezone?: string;
  /** Optional CORS/HTTP proxy prefix for REST historical queries. */
  proxyUrl?: string;
  /** Explicit container height (e.g. `380` or `'420px'`). */
  height?: number | string;
  /** Optional custom header pair display title (e.g. `'Bitcoin'`). */
  title?: string;
}

export interface WidgetRuntimeState {
  exchange: string;
  symbol: string;
  displayPair: string;
  interval: ChartInterval;
  type: ChartType;
  theme: 'dark' | 'light';
  watermark: boolean;
  wsState: 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline';
  livePrice: number;
  change24h: number;
  candleCount: number;
  isFullscreen: boolean;
}

export interface HubStats {
  activeSockets: number;
  connectingSockets: number;
  totalSockets: number;
  totalTopics: number;
  totalSubscribers: number;
  exchanges: Record<
    string,
    {
      state: string;
      readyState: number;
      topics: number;
      wireTopics: number;
      subscribers: number;
      messagesReceived: number;
    }
  >;
}

export interface ExchangeInfo {
  id: string;
  name: string;
  badge: string;
}

export declare class TradingRayChartWidget {
  constructor(target: HTMLElement | string, options?: TradingRayWidgetOptions);
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  toggleFullscreen(): Promise<void>;
  setSymbol(symbol: string, exchange?: ExchangeId): this;
  setExchange(exchange: ExchangeId): this;
  setInterval(interval: ChartInterval): this;
  setType(type: ChartType): this;
  setTheme(theme: ThemeMode): this;
  setWatermark(enabled: BooleanToggle): this;
  updateOptions(patch: Partial<TradingRayWidgetOptions>): this;
  getState(): WidgetRuntimeState;
  requestRender(): void;
  destroy(): void;
}

export declare class ExchangeHub {
  constructor(options?: {
    WebSocketImpl?: typeof WebSocket;
    fetchImpl?: typeof fetch;
    batchDelayMs?: number;
    idleCloseMs?: number;
  });
  getStats(): HubStats;
  wakeAll(): void;
  destroyAll(): void;
}

export declare const VERSION: string;
export declare const SUPPORTED_INTERVALS: readonly ChartInterval[];

export declare function createChart(
  target: HTMLElement | string,
  options?: TradingRayWidgetOptions
): TradingRayChartWidget;

export declare function scan(root?: ParentNode): TradingRayChartWidget[];
export declare function getInstance(target: HTMLElement | string): TradingRayChartWidget | null;
export declare function getHubStats(): HubStats;
export declare function listExchanges(): ExchangeInfo[];
export declare function registerExchange(adapter: Record<string, unknown>): void;
export declare function resolveExchangeId(value: string, fallback?: string): string;
export declare function formatPrice(price: number, decimalsOverride?: number): string;
export declare function formatSignedPercent(value: number): string;
export declare function formatCompactVolume(value: number): string;

export declare const TradingRayWidget: {
  readonly VERSION: string;
  readonly SUPPORTED_INTERVALS: readonly ChartInterval[];
  createChart: typeof createChart;
  scan: typeof scan;
  getInstance: typeof getInstance;
  getHubStats: typeof getHubStats;
  listExchanges: typeof listExchanges;
  registerExchange: typeof registerExchange;
  resolveExchangeId: typeof resolveExchangeId;
  formatPrice: typeof formatPrice;
  formatSignedPercent: typeof formatSignedPercent;
  formatCompactVolume: typeof formatCompactVolume;
  TradingRayChartWidget: typeof TradingRayChartWidget;
  ExchangeHub: typeof ExchangeHub;
};

export default TradingRayWidget;
