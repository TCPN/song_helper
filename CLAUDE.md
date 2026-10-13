# 維護備註（給 Claude 與其他維護者）

專案概況、檔案與測試用法請先看 `README.md`。這份只記維護時要注意的事。

## 工作方式

- 改程式前後都跑 `npm test`（Playwright E2E）。目前的測試是重構的安全網，先綠燈才能動 `script.js`。
- 網址 hash（`#song_id=…&transpose=…`）是對外契約，格式與行為不可無故改變。
- 標示「現況」的測試記錄的是目前行為，改行為時連同測試一起改，並在 PR 說明裡講清楚。
- `known-issues.spec.js` 裡的 `test.fail()` 是待辦清單：修好一個，就刪掉它的 `test.fail()`，讓它變成一般回歸測試。
- 日常使用與開發的分支是 `dev`。用 `claude/…` 開頭的分支加 PR，PR 目標預設是 `dev`（除非另有說明），
  不直接推 `dev` 或 `master`。
- 計畫中的方向：先以測試固定行為，再把 `script.js` 依功能拆成 ES modules（不引入 bundler），
  最後才加新功能。HTML 裡的 `onclick=` 之後改成 `addEventListener`。
- 拆模組時要特別注意初始化順序：`script.js` 的 `renderWithCachedData()` 必須在所有 `var` 初始化
  與事件監聽之後才執行（目前放在檔尾）。以前它在第 16 行就執行，造成 #2 的 TypeError。

## 環境注意事項

- 在受限的沙盒裡 `npm install` 可能被網路政策擋住（registry 回 403），不要試圖繞過。
  若機器上已有全域安裝的 Playwright，可在被忽略的 `node_modules/@playwright/test/index.js`
  放一行 `module.exports = require('<全域 playwright>/test');` 當替身來執行測試，不要提交 `node_modules`。
- 沙盒裡 `gh pr create` 走 GraphQL 會被擋，改用 REST：`gh api -X POST repos/{owner}/{repo}/pulls …`。
- 目前沒有提交 `package-lock.json`（當時無法連到 registry 產生）。有網路時請執行 `npm install` 並提交 lock 檔。
- 測試用的歌曲請維持自編或公有領域的短 ABC，不要把有版權的歌詞放進公開 repo。
