/**
 * Zero-dependency bundler for TradingRay Widget.
 * Concatenates modular ES sources in topological order into:
 *   - dist/tradingray-widget.esm.js (ES Module)
 *   - dist/tradingray-widget.js     (UMD / Browser global `window.TradingRayWidget`)
 *   - dist/tradingray-widget.min.js (Compact production UMD script)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

const MODULE_ORDER = [
  'constants.js',
  'format.js',
  'exchanges.js',
  'hub.js',
  'renderer.js',
  'widget.js',
  'index.js'
];

function stripModuleSyntax(code) {
  return code
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"]\.\/[^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+[\w$]+;?\s*$/gm, '')
    .replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '')
    .replace(/^\s*export\s+(const|let|var|function|async\s+function|class)\s+/gm, '$1 ')
    .trim();
}

const REGEX_PREFIX_KEYWORDS = new Set([
  'return', 'throw', 'case', 'delete', 'do', 'else', 'in', 'instanceof', 'new', 'of', 'typeof', 'void', 'yield', 'await'
]);

/**
 * Regex-aware whitespace & comment compactor that safely preserves strings, template literals, and regexes.
 */
function compactJs(source) {
  let out = '';
  let i = 0;
  let canStartRegex = true;
  const len = source.length;

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < len) {
        const c = source[i];
        out += c;
        if (c === '\\') {
          i++;
          if (i < len) out += source[i];
        } else if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      canStartRegex = false;
      continue;
    }

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < len && source[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      const keep = source[i + 2] === '!';
      if (keep) out += '/*';
      i += 2;
      while (i < len && !(source[i] === '*' && source[i + 1] === '/')) {
        if (keep) out += source[i];
        i++;
      }
      if (keep) out += '*/\n';
      i += 2;
      continue;
    }

    if (ch === '/' && canStartRegex) {
      out += ch;
      i++;
      let inClass = false;
      while (i < len) {
        const c = source[i];
        out += c;
        if (c === '\\') {
          i++;
          if (i < len) out += source[i];
        } else if (c === '[') {
          inClass = true;
        } else if (c === ']') {
          inClass = false;
        } else if (c === '/' && !inClass) {
          i++;
          while (i < len && /[a-z]/i.test(source[i])) {
            out += source[i++];
          }
          break;
        }
        i++;
      }
      canStartRegex = false;
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      while (i < len && /[A-Za-z0-9_$]/.test(source[i])) i++;
      const word = source.slice(start, i);
      out += word;
      canStartRegex = REGEX_PREFIX_KEYWORDS.has(word);
      continue;
    }

    if (/[0-9]/.test(ch)) {
      while (i < len && /[A-Za-z0-9_.]/.test(source[i])) {
        out += source[i++];
      }
      canStartRegex = false;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      const prev = out[out.length - 1] || '';
      while (i < len && (source[i] === ' ' || source[i] === '\t')) i++;
      const upcoming = source[i] || '';
      if (/[A-Za-z0-9_$]/.test(prev) && /[A-Za-z0-9_$]/.test(upcoming)) {
        out += ' ';
      }
      continue;
    }

    if (ch === '\r') {
      i++;
      continue;
    }

    if (ch === '\n') {
      while (i < len && (source[i] === '\n' || source[i] === '\r' || source[i] === ' ' || source[i] === '\t')) {
        i++;
      }
      const prev = out[out.length - 1] || '';
      if (out.length > 0 && prev !== '\n' && prev !== '{' && prev !== ';' && prev !== ',') {
        out += '\n';
      }
      continue;
    }

    out += ch;
    if (ch === ')' || ch === ']' || ch === '}') canStartRegex = false;
    else if (ch === '.') canStartRegex = false;
    else canStartRegex = true;
    i++;
  }
  return out.trim() + '\n';
}

const banner = `/*! TradingRay Crypto Chart Widget v1.0.0 | MIT License | https://tradingray.com */`;

const chunks = MODULE_ORDER.map((file) => {
  const raw = fs.readFileSync(path.join(srcDir, file), 'utf8');
  return `// ---- ${file} ----\n${stripModuleSyntax(raw)}`;
});

const coreBody = chunks.join('\n\n');

const esmBundle = `${banner}
${coreBody}

export {
  VERSION,
  SUPPORTED_INTERVALS,
  TradingRayWidget,
  TradingRayChartWidget,
  ExchangeHub,
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
  formatCompactVolume
};
export default TradingRayWidget;
`;

const umdBundle = `${banner}
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.TradingRayWidget = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

${coreBody}

  return TradingRayWidget;
});
`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'tradingray-widget.esm.js'), esmBundle, 'utf8');
fs.writeFileSync(path.join(distDir, 'tradingray-widget.js'), umdBundle, 'utf8');
fs.writeFileSync(path.join(distDir, 'tradingray-widget.min.js'), compactJs(umdBundle), 'utf8');

console.log('Built dist/tradingray-widget.{esm.js,js,min.js} successfully.');
