# Инструкция по публикации `tradingray-widget` на GitHub (и подключению бесплатного CDN)

Эта папка (`tradingray-widget/`) — **полностью готовый, автономный open-source пакет** с лицензией **MIT** (максимально свободные права для любых разработчиков и коммерческих сайтов), готовыми сборками в `dist/`, TypeScript-типами, тестами, демо-страницей с конструктором кода вставки и английской документацией `README.md`.

> Папка `tradingray-widget/` уже добавлена в список исключений локального деплоера (`deploy/lib/sync-rules.mjs` и `deploy/lib/policy.mjs`), поэтому ваш рабочий деплой основного сайта `tradingray.com` не зальёт случайно исходники репозитория на продакшен.

---

## Шаг 1. Быстрая локальная проверка (по желанию)

1. Откройте файл `tradingray-widget/examples/demo.html` двойным кликом в любом браузере:
   - Сверху в шапке в реальном времени показывается счётчик **`Active WebSockets`** — нажмите кнопку **«Launch 20 Live Charts (1 WS)»** внизу страницы и убедитесь, что все 20 графиков тикают в реальном времени через **1 общий WebSocket** без малейших подтормаживаний страницы.
   - Проверьте переключатель **`Candlesticks` / `Price Line`** (свечи / просто полосой цена), выбор бирж, полноэкранный режим, мобильное сужение окна и тумблер **`Watermark (on/off)`** (микро-логотип со ссылкой на `https://tradingray.com`).
2. Чтобы прогнать автотесты и пересборку в **Git Bash** (внутри папки `tradingray-widget`):
   ```bash
   cd /c/laragon/www/crypspy_new/tradingray-widget
   npm test
   npm run build
   ```
   *(Никакой `npm install` не нужен — библиотека и сборщик имеют **0 внешних зависимостей**.)*

---

## Шаг 2. Выкладка репозитория на GitHub

1. Зайдите на [github.com/new](https://github.com/new) и создайте публичный репозиторий:
   - **Repository name:** `tradingray-widget`
   - **Description:** `Ultra-lightweight zero-dependency crypto chart widget (Candlesticks & Price Line) with direct exchange WebSocket multiplexing.`
   - **Visibility:** `Public`
   - Галочки *Add a README file*, *Add .gitignore*, *Choose a license* **не ставьте** — эти файлы уже лежат в папке.
2. Перед пушем (по желанию) проверьте поле `"repository"` в `package.json`: там сейчас указан `https://github.com/tradingray/tradingray-widget.git`. Если ваш аккаунт/организация на GitHub называется иначе (например, `github.com/myname/tradingray-widget`), замените `tradingray` на ваш логин.
   > **Примечание:** файл `PUBLISH_GUIDE_RU.md` уже добавлен в `.gitignore`, поэтому при `git add .` ваша личная шпаргалка не попадёт в публичный англоязычный репозиторий на GitHub.
3. Выполните в **Git Bash** именно внутри папки `tradingray-widget` (важно: **внутри `tradingray-widget`**, чтобы создался отдельный чистый git-репозиторий для библиотеки):

```bash
cd /c/laragon/www/crypspy_new/tradingray-widget

git init
git add .
git commit -m "Initial open-source release v1.0.0"
git branch -M main
git remote add origin https://github.com/<ВАШ_ЛОГИН_GITHUB>/tradingray-widget.git
git push -u origin main
```

---

## Шаг 3. Бесплатный глобальный CDN для вставки на сайты (2 способа)

Чтобы любой веб-разработчик мог подключить ваш виджет одной строкой `<script src="...">`, есть два бесплатных CDN-варианта через **jsDelivr**:

### Вариант А — Сразу через GitHub Tag (без регистрации в npm, работает мгновенно)

Создайте релизный тег `v1.0.0`:

```bash
cd /c/laragon/www/crypspy_new/tradingray-widget
git tag v1.0.0
git push origin v1.0.0
```

Через 10–30 секунд сеть **jsDelivr CDN** автоматически начнёт раздавать минифицированный скрипт по всему миру:

```html
<script src="https://cdn.jsdelivr.net/gh/<ВАШ_ЛОГИН_GITHUB>/tradingray-widget@1.0.0/dist/tradingray-widget.min.js" defer></script>

<tradingray-chart
  exchange="binance"
  symbol="BTCUSDT"
  interval="1h"
  type="candles"
  theme="dark"
  watermark="on"
  height="380"
></tradingray-chart>
```

*(Также на GitHub во вкладке **Releases → Draft a new release** выберите тег `v1.0.0`, напишите заголовок `v1.0.0 — Initial Release` и нажмите **Publish release** — репозиторий сразу станет выглядеть профессионально.)*

### Вариант Б — Публикация в npm (рекомендуется для красивой ссылки и `npm install`)

Если опубликовать пакет в официальном реестре [npmjs.com](https://www.npmjs.com/), разработчики смогут ставить его через `npm install tradingray-widget`, и заработает короткая CDN-ссылка из `README.md` и `demo.html` (`https://cdn.jsdelivr.net/npm/tradingray-widget@1/dist/tradingray-widget.min.js`):

```bash
cd /c/laragon/www/crypspy_new/tradingray-widget
npm login
npm publish --access public
```

---

## Шаг 4. Включение живого демо и генератора кода на GitHub Pages

В папке `examples/demo.html` уже встроен интерактивный **Playground + генератор кода вставки** (Web Component / `data-*` / ES Module) + стресс-тест на 20 графиков. Чтобы дать разработчикам живую ссылку прямо в шапке GitHub:

1. В репозитории на GitHub откройте **Settings → Pages**.
2. В разделе **Build and deployment → Source** выберите **Deploy from a branch**.
3. Выберите ветку **`main`** и папку **`/ (root)`**, нажмите **Save**.
4. Через 1 минуту живое демо будет доступно по адресу:
   `https://<ВАШ_ЛОГИН_GITHUB>.github.io/tradingray-widget/examples/demo.html`
5. Вставьте эту ссылку в поле **Website** в настройках правой колонки репозитория (**About → ⚙️**) и добавьте теги (*Topics*):
   `crypto`, `chart`, `candlestick`, `trading`, `websocket`, `web-component`, `javascript`, `bitcoin`, `binance`, `bybit`.

---

## Шаг 5 (Опционально). Раздача скрипта прямо с вашего домена `tradingray.com`

Если вы захотите, чтобы сторонние сайты могли подключать скрипт ещё и напрямую с вашего домена (например, `https://tradingray.com/widget/tradingray-widget.min.js`), достаточно положить один файл `dist/tradingray-widget.min.js` в отдельную публичную папку сайта (например, `widget/`). Сам виджет не нагружает ваш сервер вообще — все котировки и свечи браузер посетителя берёт напрямую с выбранной биржи.
