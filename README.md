# 移調小幫手

歌曲列表與 ABC 樂譜的檢視、移調工具。純靜態網站，沒有 build 步驟，任何靜態主機都能部署
（學校個人網頁、Google App Engine 靜態站等）。

## 功能

- 從 Google 試算表載入歌曲列表（編號、歌名、調號…），可搜尋；載入後搜尋框自動取得焦點
- 回訪時先用 localStorage 的快取資料渲染列表，再用試算表的最新資料更新。網址指定的歌在快取裡就有譜時
  立刻開啟；快取裡沒有（或沒有譜）時等最新資料再判斷。已開啟的譜只有在最新資料的譜不同時才重新渲染
- 列表每首歌有譜面連結（圖示區分「含和弦」與「僅旋律」），點一列則跳出該首的資訊彈窗
  （編號、歌名、調性、拍號、速度、開啟譜面）
- 開啟 ABC 樂譜（abcjs 渲染），可移調、列印、播放 MIDI
- 「檢視」選單：譜面可切換整頁可見／符合高度／符合寬度（預設符合寬度）；
  設定記在 localStorage 的 `score_fit_mode`，不放進網址 hash
- 「檢視」選單也可切換譜紙：分頁（預設）或不分頁；設定記在 localStorage 的 `score_paper_mode`，不放進網址 hash。
  - 分頁：譜紙是 A4 直式（寬:高 = 1:√2），一頁放不下就換頁，一行譜不會切開（單一行比一頁還高時自己一頁，那一頁往下延伸，不縮小）。
    一次顯示一頁：點畫面下半部換下一頁、上半部回上一頁，鍵盤用 →／PageDown、←／PageUp（第一頁、最後一頁再點不動；有選單開著時只收起選單）；
    超過一頁時畫面下方顯示頁碼（例如 `1 / 3`）。「整頁可見」「符合高度」以一頁為準。
    換歌或重新打開時回到第一頁；移調、改排版時留在原本這頁第一行所在的那一頁。行間距均等化仍是整首歌一起算
  - 不分頁：譜紙高度依譜的內容，上下捲動
  - 列印時每行譜不會從中間切開；分頁時在螢幕上的分頁位置換頁
- 工具列「排版」選單的面板（沒有遮罩，點外面或按 Esc 收起）：行間距均等化開／關（預設開：除了最後一行，
  每行譜下方的空間都取最大值；關掉時每行只占自己需要的高度）、行距（行與行之間再加的空間，預設 0）、
  譜面寬度（abcjs 的 `staffwidth`，預設 740，300～1500，越寬每行在畫面上越小；換行位置仍依 ABC 原本的換行。
  有行塞不下時用最寬那行的寬度重新渲染，每行才會一樣大，面板顯示的是實際用的寬度，已經是這首歌最小的寬度時「−」不能按；每個數值設定到了上下限時「−」／「＋」都不能按）、
  歌詞字級（abcjs `vocalfont`，預設 13 粗體）、和弦字級（`gchordfont`，預設 12）、重設。
  設定所有歌共用，整包存在 localStorage 的 `score_layout`（JSON），不放進網址 hash。
  渲染時在 ABC 加上 `%%stretchlast`，每行（包括短的行與最後一行）都拉滿；`abcjs_midi_5.8.0-min-mod.js` 也改成譜面寬度大於 740 時放寬音符間距上限。
  均等化、行距只改行高不重新渲染；譜面寬度、字級會重新渲染（之後再套用均等化與行距）。兩種都讓畫面最上面的那一行留在原位
- 譜面工具列：調性就是移調按鈕（有移調時右上角浮出半音數），點了才出現 −／半音數／＋；關閉是 X icon
- 上一首／下一首、曲號鍵盤快速跳轉
- 「編輯」選單：和弦編輯器、進階編輯器（在新分頁開啟）
- 螢幕寬度小於 450px（或工具列放不下）時，列印、播放、編輯、排版收進「⋮」選單（「排版…」打開的面板出現在「⋮」旁邊），「檢視」換成 icon
- 點擊頁面任何地方，會短暫顯示「找不到想找的歌嗎？」的意見回饋提示
- 狀態都記在網址 hash，例如 `#song_id=12&transpose=2`，方便分享與存書籤

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 頁面結構 |
| `js/main.js` | 進入點：載入資料、註冊事件（`index.html` 以 `<script type="module">` 載入） |
| `js/data.js`, `js/cache.js` | 資料載入（先用 localStorage 快取渲染，再用試算表最新資料更新）與快取 |
| `js/list.js` | 歌曲列表、選取、搜尋 |
| `js/score.js`, `js/score-layout.js` | 譜面渲染、移調、換歌、關閉；渲染後的版面修正 |
| `js/song-id-input.js` | 譜面上方的歌號小鍵盤與鍵盤操作 |
| `js/popups.js` | 歌曲資訊彈窗、意見回饋提示 |
| `js/route.js` | 網址 hash 的讀寫與執行 |
| `js/score-view.js` | 「檢視」選單：譜面的顯示方式與譜紙 |
| `js/score-pages.js` | 分頁顯示：量每行高度、分頁、一次顯示一頁、點擊換頁、頁碼 |
| `js/layout-panel.js` | 工具列「排版」選單的面板（行間距均等化、行距、譜面寬度、歌詞與和弦字級） |
| `js/editor-links.js` | 「編輯」與「⋮」選單的開關、編輯器連結 |
| `js/toolbar.js` | 螢幕寬度小於 450px（或工具列放不下）時切換成精簡版面（「⋮」選單） |
| `js/state.js`, `js/dom.js` | 共用狀態、DOM 小工具 |
| `js/hash.js`, `js/abc.js`, `js/song-data.js`, `js/search.js`, `js/keypad.js`, `js/score-fit.js`, `js/render-params.js`, `js/line-heights.js`, `js/layout-settings.js`, `js/pagination.js` | 純函式（不碰 DOM，有單元測試） |
| `js/abc-rewrite.js` | 把 ABC 改寫成和弦／旋律兩聲部（目前未使用） |
| `style.css`, `abcjs-midi.css`, `fix-abcjs-midi.css` | 樣式（後者修正 abcjs 播放器的圖示） |
| `score_chord.png`, `score_note.png` | 列表中譜面連結的圖示 |
| `abcjs_midi_5.8.0-min-mod.js` | 實際使用的 abcjs（修改版；譜面寬度大於 740 時放寬音符間距上限，搜尋 `song_helper:`）。其餘 `abcjs_midi_*.js` 為舊版，目前沒有被引用 |

資料來源是 Google 試算表：`js/data.js` 直接 `fetch` 試算表的 gviz 查詢（`js/song-data.js` 的 `SHEET_QUERY_URL`），
不需要載入 Google 的 JavaScript。試算表必須維持「知道連結的人都能檢視」。
欄位以固定索引對應：0 編號、1 歌名、2 調號、3 拍號、4 首句旋律、10 abc。
快取存在 localStorage 的 `song_data`（歌曲陣列的 JSON）與 `song_data_timestamp`。

### songs.json 快照（選用）

`npm run update-songs` 會抓試算表，在網站根目錄產生 `songs.json`，可以當作試算表的備份，也可以跟網站一起部署。
有部署這個檔案時，第一次來的訪客（沒有 localStorage 快取）會先看到快照的列表，再更新成試算表的最新資料；
連不上試算表時，網站也能靠它顯示。沒有這個檔案時，網站照常運作。

`songs.json` 含整份歌譜與歌詞，而 repo 是公開的，所以它列在 `.gitignore`，**不要 commit**。
部署出去的 `songs.json` 任何人都能下載（內容和網站上看得到的一樣）；快照不會自己更新，部署前請重新執行一次 `npm run update-songs`。

## 網址 hash（對外介面）

使用者可能已把網址存成書籤，所以這個格式要保持相容：

- `#song_id=N`：開啟第 N 首的譜面
- `#song_id=N&transpose=M`：同時套用 M 個半音的移調（M 為整數，可為負）
- 其他不認識的參數會被保留

## 本機執行

```sh
npm run serve        # 靜態伺服器，預設 http://127.0.0.1:4173
```

不想用 npm 的話，`python3 -m http.server` 之類任何靜態伺服器都可以。
因為用了 ES modules，直接用 `file://` 開 `index.html` 會被瀏覽器擋下，一定要透過伺服器。

## 測試

`npm test` 會先跑單元測試再跑 E2E 測試，也可以分開跑：

- `npm run test:unit`：`js/` 純函式的單元測試（`tests/unit/`，用 Node 內建的 `node --test`，不需要瀏覽器）
- `npm run test:e2e`：整個頁面的 E2E 測試

E2E 測試使用 [Playwright](https://playwright.dev/)，測試完全不連外部網路：

- 試算表查詢由 `tests/app.js` 回應假的 gviz 資料（可模擬查詢錯誤、連不上與延遲）
- 歌曲資料來自 `tests/fixtures/songs.js`（自編的短 ABC，不是真實歌曲）
- 其他非本機的請求一律中止

```sh
npm ci
npx playwright install chromium   # 第一次需要
npm test
```

PR 與推到 `dev`／`master` 時，GitHub Actions（`.github/workflows/test.yml`）會自動跑同樣的測試。

測試分成幾個檔案（`tests/e2e/`）：列表、搜尋、譜面、移調、曲號鍵盤、網址 hash、
快取、資訊彈窗、列表選取與意見回饋、排版設定、分頁顯示，以及已知問題。

### 測試的寫法約定

- 標示「（現況）」或放在「現況行為」區塊的測試，記錄的是**目前的行為**，不一定是刻意的設計。
  之後若決定改變行為，直接修改那個測試即可。
- 已知的問題寫在 `known-issues.spec.js`，內容是「應有的行為」並標成 `test.fail()`，
  `test.fail()` 的說明文字寫了原因。修好之後 Playwright 會回報「預期失敗卻通過」，
  這時把 `test.fail()` 那行刪掉，它就變成一般的回歸測試。
- 預設任何未捕捉的頁面錯誤都會讓測試失敗。

### 目前已知的問題

詳見 `tests/e2e/known-issues.spec.js`（標成 `test.fail()` 的才是尚未修好的）。
