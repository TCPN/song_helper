# 維護備註（給 Claude 與其他維護者）

專案概況、檔案與測試用法請先看 `README.md`。這份只記維護時要注意的事。

## 新 session 快速上手

1. 讀 `README.md`（功能、hash 契約、測試）和這份。接著看你被指派的 issue；整體路線在 #9。
2. 確認在 `dev` 的最新狀態上開分支：`git fetch origin && git switch -c claude/<主題> origin/dev`。
3. 先 `npm install`（有網路時）、`npx playwright install chromium`、`npm test`，確認動手前是綠燈。
   預期結果：全部通過，其中 8 個是預期失敗的 `test.fail()`（見下表）。
4. 一個 PR 做一件事：先寫或確認紅燈測試，再做最小改動，最後全綠。PR 目標是 `dev`，描述寫「改了什麼、為什麼、哪些「現況」測試被改」，並連結 issue（`Closes #N`）。
5. 不確定該保持還是改變某個行為時，看測試是否標了「（現況）」：有的話可以改，但要在 PR 說明；
   沒有的話視為契約，先問使用者。

### 已知問題與 issue 對照

| issue | 內容 | 對應的 `test.fail()`（known-issues.spec.js） |
| --- | --- | --- |
| #2 | 有快取＋指向無譜／不存在的歌 → 啟動 TypeError（最嚴重） | 「回訪（有快取）且網址指向無法開啟的歌」前 3 個 |
| #3 | `exec_hash` 重複呼叫 → 提示重複、重複渲染 | 同上第 4 個、「譜面渲染次數」的有快取案例 |
| #4 | 搜尋輸入 `(` 丟 SyntaxError | 「已知問題：搜尋」 |
| #5 | 資訊彈窗速度顯示 `undefined=80` | 「速度單位不在對照表」 |
| #6 | 資訊彈窗 innerHTML（XSS） | 「歌名含 HTML 字元」 |
| #7 | lockfile、CI | — |
| #8 | 小清理（favicon、`staff_tops`、編輯選單） | — |
| #9 | 重構總計畫 | — |

修好一個問題：刪掉對應測試的 `test.fail()`，並更新上表（或移除該列）。

## 工作方式

- 改程式前後都跑 `npm test`（Playwright E2E）。目前的測試是重構的安全網，先綠燈才能動 `script.js`。
- 網址 hash（`#song_id=…&transpose=…`）是對外契約，格式與行為不可無故改變。
- 標示「現況」的測試記錄的是目前行為，改行為時連同測試一起改，並在 PR 說明裡講清楚。
- `known-issues.spec.js` 裡的 `test.fail()` 是待辦清單：修好一個，就刪掉它的 `test.fail()`，讓它變成一般回歸測試。
- 日常使用與開發的分支是 `dev`。用 `claude/…` 開頭的分支加 PR，PR 目標預設是 `dev`（除非另有說明），
  不直接推 `dev` 或 `master`。
- 計畫中的方向：先以測試固定行為，再把 `script.js` 依功能拆成 ES modules（不引入 bundler），
  最後才加新功能。HTML 裡的 `onclick=` 之後改成 `addEventListener`。
- 拆模組時要特別注意初始化順序：`script.js` 頂層的 `renderWithCachedData()` 會在檔案其餘部分
  （`var` 初始化、檔尾的事件監聽）之前執行，這正是目前最嚴重的已知問題的成因。

## 環境注意事項

- 在受限的沙盒裡 `npm install` 可能被網路政策擋住（registry 回 403），不要試圖繞過。
  若機器上已有全域安裝的 Playwright，可在被忽略的 `node_modules/@playwright/test/index.js`
  放一行 `module.exports = require('<全域 playwright>/test');` 當替身來執行測試，不要提交 `node_modules`。
- 沙盒裡 `gh pr create` 走 GraphQL 會被擋，改用 REST：`gh api -X POST repos/{owner}/{repo}/pulls …`。
- 資料來源是公開的 Google 試算表，測試一律不連外部網路（google API 被替身取代）。不要為了測試去連真實試算表。
- 目前沒有提交 `package-lock.json`（當時無法連到 registry 產生）。有網路時請執行 `npm install` 並提交 lock 檔。
- 測試用的歌曲請維持自編或公有領域的短 ABC，不要把有版權的歌詞放進公開 repo。

## 慣例

- 溝通與 PR／issue 說明用繁體中文；程式碼識別字維持英文。
- commit 與 PR 說明依 Claude Code 的附註規則加上結尾，不要自行刪掉。
- 不要為了讓測試通過而放寬斷言；測試與實際行為不符時，先判斷是 bug（加進 `known-issues.spec.js`）還是現況（標「現況」）。
- 動到 `index.html`／`script.js` 的 DOM 結構或 id／class 時，同步檢查 `tests/app.js` 的 helper 選擇器。
