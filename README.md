# 移調小幫手

歌曲列表與 ABC 樂譜的檢視、移調工具。純靜態網站，沒有 build 步驟，任何靜態主機都能部署
（學校個人網頁、Google App Engine 靜態站等）。

## 功能

- 從 Google 試算表載入歌曲列表（編號、歌名、調號…），可搜尋；載入後搜尋框自動取得焦點
- 回訪時先用 localStorage 的快取資料渲染列表，再用試算表的最新資料更新
- 列表每首歌有譜面連結（圖示區分「含和弦」與「僅旋律」），點一列則跳出該首的資訊彈窗
  （編號、歌名、調性、拍號、速度、開啟譜面）
- 開啟 ABC 樂譜（abcjs 渲染），可移調、列印、播放 MIDI
- 上一首／下一首、曲號鍵盤快速跳轉
- 「編輯」選單：和弦編輯器、進階編輯器（在新分頁開啟）
- 點擊頁面任何地方，會短暫顯示「找不到想找的歌嗎？」的意見回饋提示
- 狀態都記在網址 hash，例如 `#song_id=12&transpose=2`，方便分享與存書籤

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 頁面結構 |
| `script.js` | 全部的程式邏輯（資料載入與快取、列表、搜尋、譜面渲染、移調、鍵盤、彈窗、hash 處理） |
| `style.css`, `abcjs-midi.css`, `fix-abcjs-midi.css` | 樣式（後者修正 abcjs 播放器的圖示） |
| `score_chord.png`, `score_note.png` | 列表中譜面連結的圖示 |
| `abcjs_midi_5.8.0-min-mod.js` | 實際使用的 abcjs（修改版）。其餘 `abcjs_midi_*.js` 為舊版，目前沒有被引用 |

資料來源是 `script.js` 開頭的 Google 試算表查詢（`docs.google.com/spreadsheet/tq?key=…`），
欄位以固定索引對應：0 編號、1 歌名、2 調號、3 拍號、4 首句旋律、10 abc。
快取存在 localStorage 的 `song_data`（歌曲陣列的 JSON）與 `song_data_timestamp`。

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

## 測試

E2E 測試使用 [Playwright](https://playwright.dev/)，測試完全不連外部網路：

- `https://www.google.com/jsapi` 會被換成 `tests/support/google-stub.js`（可模擬查詢失敗與延遲）
- 歌曲資料來自 `tests/fixtures/songs.js`（自編的短 ABC，不是真實歌曲）
- 其他非本機的請求一律中止

```sh
npm install
npx playwright install chromium   # 第一次需要
npm test
```

測試分成幾個檔案（`tests/e2e/`）：列表、搜尋、譜面、移調、曲號鍵盤、網址 hash、
快取、資訊彈窗、列表選取與意見回饋，以及已知問題。

### 測試的寫法約定

- 標示「（現況）」或放在「現況行為」區塊的測試，記錄的是**目前的行為**，不一定是刻意的設計。
  之後若決定改變行為，直接修改那個測試即可。
- 已知的問題寫在 `known-issues.spec.js`，內容是「應有的行為」並標成 `test.fail()`，
  `test.fail()` 的說明文字寫了原因。修好之後 Playwright 會回報「預期失敗卻通過」，
  這時把 `test.fail()` 那行刪掉，它就變成一般的回歸測試。
- 預設任何未捕捉的頁面錯誤都會讓測試失敗。

### 目前已知的問題

詳見 `tests/e2e/known-issues.spec.js`。重點是：回訪（有快取）時，若網址指向「沒有譜」或「不存在」的歌，
`script.js` 會在載入途中丟出 TypeError 而中止，之後改網址、點連結都不會開譜面。
原因是第 16 行的 `renderWithCachedData()` 在檔案後面的初始化（例如 `var scroll_tmp = {}`）之前就執行了。
