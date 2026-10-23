# 維護備註（給 Claude 與其他維護者）

專案概況、檔案與測試用法請先看 `README.md`。這份只記維護時要注意的事。

## 工作方式

- 改程式前後都跑 `npm test`（`node --test` 單元測試 + Playwright E2E）。目前的測試是重構的安全網，先綠燈才能動程式。
- 網址 hash（`#song_id=…&transpose=…`）是對外契約，格式與行為不可無故改變。
- 標示「現況」的測試記錄的是目前行為，改行為時連同測試一起改，並在 PR 說明裡講清楚。
- `known-issues.spec.js` 裡的 `test.fail()` 是待辦清單：修好一個，就刪掉它的 `test.fail()`，讓它變成一般回歸測試。
- 用 `claude/…` 開頭的分支加 PR，PR 目標是 `master`（除非另有說明），不直接推 `master`。
- 計畫中的方向（#9）：先以測試固定行為，再把程式依功能拆成 ES modules（不引入 bundler），
  最後才加新功能。
- 進度：程式都在 `js/` 的 ES modules，進入點是 `js/main.js`。純函式（`hash.js`、`abc.js`、`song-data.js`、
  `search.js`、`keypad.js`、`score-fit.js`、`render-params.js`、`line-heights.js`）不碰 DOM，有 `tests/unit/` 的單元測試；新的純函式也照這樣放，模組頂層不要碰 DOM。
  HTML 裡不寫 `onclick=` 等事件屬性：每個模組有自己的 `setup_*()` 用 `addEventListener` 註冊，由 `main.js` 呼叫；
  模組的函式不掛到 `window`。
  `js/package.json` 的 `"type": "module"` 是讓 Node 把 `js/*.js` 當 ES modules 載入，不要刪。
- 初始化順序：`main.js` 的 `renderWithCachedData()` 要放在事件監聽註冊之後（以前太早執行造成 #2 的 TypeError）。
- 部署時 `js/` 整個資料夾都要上傳；網站要透過伺服器開，`file://` 無法載入 ES modules。
- `songs.json`（`npm run update-songs` 產生的試算表快照）含整份歌譜與歌詞，repo 是公開的，絕對不要 commit；
  測試不讀本機的 `songs.json`，要用快照就在測試裡設 `snapshot` 選項。

## 環境注意事項

- 在受限的沙盒裡 `npm install` 可能被網路政策擋住（registry 回 403），不要試圖繞過。
  若機器上已有全域安裝的 Playwright，可在被忽略的 `node_modules/@playwright/test/index.js`
  放一行 `module.exports = require('<全域 playwright>/test');` 當替身來執行測試，不要提交 `node_modules`。
- 沙盒裡 `gh pr create` 走 GraphQL 會被擋，改用 REST：`gh api -X POST repos/{owner}/{repo}/pulls …`。
- `package-lock.json` 已提交；CI（`.github/workflows/test.yml`）用 `npm ci` 安裝，改依賴時記得一起更新 lock 檔。
- PR 與推到 `dev`／`master` 時 GitHub Actions 會跑 `npm test`（只裝 Chromium）。
- 開 PR 或推新 commit 時，`.github/workflows/claude-code-review.yml` 會讓 Claude 自動 review。
  這支 workflow 必須和 `master` 上的版本一字不差才會跑（claude-code-action 的檢查），改它時要同步進 `master`。
- 測試用的歌曲請維持自編或公有領域的短 ABC，不要把有版權的歌詞放進公開 repo。
