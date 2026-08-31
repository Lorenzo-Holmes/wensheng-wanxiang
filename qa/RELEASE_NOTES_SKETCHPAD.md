# 国风随笔画发布核验

发布分支：`feat/guofeng-sketchpad-release`

## 已自动覆盖

- 320 / 375 / 390 px 移动端无横向溢出；
- 固定 3:4 纸张边界；
- 多笔连续绘画；
- Undo / Redo；
- 国风 Pattern Brush（缠枝）；
- WB2 画笔 Seed 编解码 roundtrip；
- 自定义画笔本地保存；
- 按笔擦除；
- 1440×1920 PNG 下载；
- 刷新后作品恢复；
- 静态生产文件体积和无外部资产依赖；
- 生产 ZIP 恰好只含 `index.html`、`styles.css`、`app.js`、`favicon.svg`。

## 当前性能样本

Chromium CI 320 / 375 / 390 px 首笔提交约 4–6 ms；测试流程未观察到 Long Task。实时画布宽度约 540–900 px，高清导出独立重绘为 1440×1920 或 2160×2880。

## 仍需平台真机确认

小红书 WebView 的系统分享/相册接口行为需要在 Builder Hub 真机环境再做一次最终确认；普通浏览器 PNG 下载路径已自动验证。
