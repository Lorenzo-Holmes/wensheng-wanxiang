# 《纹生万象》QA 报告

- 测试日期：2026-08-30
- 测试入口：本地静态服务器 `http://127.0.0.1:8787/`
- 浏览器：Playwright 驱动的 Chromium
- 范围：真实浏览器、移动端布局、核心交互、下载、存储、容器适配与外部请求检查

## 结果摘要

| 项目 | 结果 | 证据 |
|---|---|---|
| 页面启动 | 通过 | 标题为“纹生万象 · 中式纹样生成实验室” |
| JavaScript 语法 | 通过 | `node --check app.js` |
| 控制台 | 通过 | 0 errors / 0 warnings |
| 外部请求 | 通过 | 仅加载本地 HTML、CSS、JS、SVG |
| 320px | 通过 | clientWidth 320，scrollWidth 320 |
| 375px | 通过 | clientWidth 375，scrollWidth 375 |
| 390px | 通过 | clientWidth 390，scrollWidth 390 |
| 手势与生成 | 通过 | 示范笔迹 35 点；动画结束显示“已生长完成” |
| 纹样 / 结构 / 配色 | 通过 | 缠枝莲 + 二方连续 + 石青切换后结果与标签一致 |
| Seed | 通过 | 生成 32 字符 Seed；输入后恢复同一体系、结构、配色和 11 个采样点 |
| 古纹修复 | 通过 | 第一关点击缺失单元，得分从 0 变为 100 |
| 本地纹谱 | 通过 | 收藏后 DOM 卡片数 1，localStorage 记录数 1 |
| 3:4 导出 | 通过 | `export-card.png`，900×1200 RGBA |
| 无缝 Tile | 通过 | `export-tile.png`，960×960 RGBA；左右/上下边缘差异 bbox 均为空 |
| 默认保存 | 通过 | `save-default.png`，900×1200 RGBA |
| 小红书适配 | 通过 | 模拟 `window.xhs.miniTool.publishNote`，收到标题和 PNG Data URL |
| Gemini MCP 视觉红队 | 通过 | High-effort 审查完成；字体、卡片、海报质感与水墨揭示建议已落实 |
| 生成流畅度 | 通过 | 390px Chromium 实测 0 个 Long Task（>50ms） |
| 云雷结果视觉重构 | 通过 | 移除单元内重复手势与调试感轴线，改为中心盘纹、双环、阶梯回纹与单一手势主线 |
| 重构后回归 | 通过 | 云雷镜像、团花放射均完成真实生成；320/375/390px 无溢出，控制台 0 errors / 0 warnings |
| Gemini MCP 纹路专项审查 | 通过 | High-effort 审查确认应从“贴图阵列”重构为“手势骨架生长”，建议已编码落实 |
| 连续骨架生成 | 通过 | 手势经平滑、弧长重采样、切法线与曲率计算后派生五种结构 |
| Seed 字符表 | 通过 | 字符表补足 32 位；新 Seed 无 `undefined`，旧 Seed 成功恢复为 11 个采样点 |

## 网络请求明细

```text
GET /            200
GET /styles.css  200/304
GET /app.js      200/304
GET /favicon.svg 200
```

未出现 CDN、远程字体、外部 API、埋点或后端请求。页面中的故宫来源是用户主动点击的普通链接，不参与应用加载。

## 导出样张

- `desktop-home.png`：1280×2382，桌面端完整页
- `mobile-390.png`：390×2976，390px 移动端完整页
- `export-card.png`：900×1200，3:4 导出
- `export-tile.png`：960×960，无缝 Tile 导出
- `save-default.png`：900×1200，默认保存
- `result-poster-polished.png`：最终海报画布视觉验收图
- `mobile-390-polished-final.png`：高级感优化后的 390px 全页图
- `export-card-polished.png`：优化后的 900×1200 海报导出
- `export-tile-polished.png`：优化后的 960×960 无缝 Tile
- `result-poster-redesign-v4.png`：云雷中心盘纹最终移动端验收图
- `result-poster-tuanhua-radial.png`：团花放射结构回归样张
- `export-card-final-redesign.png`：最终云雷 3:4 海报，900×1200
- `export-tile-final-redesign.png`：最终云雷无缝 Tile，960×960；左右/上下边缘完全一致
- `result-poster-gemini-final-v2.png`：Gemini 骨架方案最终移动端云雷验收图
- `result-poster-gemini-tuanhua.png`：骨架派生的团花放射验收图
- `result-poster-gemini-lotus-vine.png`：骨架派生的缠枝莲二方连续验收图
- `export-card-gemini-backbone-final.png`：最终 900×1200 连续骨架海报
- `export-tile-gemini-backbone-final.png`：最终 960×960 连续骨架 Tile，四边像素一致

## 本轮视觉修订

1. 删除每个纹样单元内部重复出现的青色手势回声，避免“复制图标”观感。
2. 云雷镜像改为专属中心式盘纹构图：四个主回纹、四个角回纹、中心菱形纹眼、圆形与阶梯回纹骨架。
3. 加粗主纹、压低辅助线与宣纸水印对比度，让朱砂主纹成为第一视觉焦点。
4. 手势只保留为一条穿过纹心的细线，不再与镜像线交叉成调试图。
5. 扩大纹样主体占比，同时保留约三成留白，兼顾小红书卡片的视觉冲击和高级感。

## Gemini 骨架生成重构

1. 主作品生成已停止使用 `motifPositions` 的散点盖印模式。
2. 用户笔迹会真实改变骨架弯曲、旋向、枝叶位置、回纹节奏与结构展开。
3. 云雷使用连续回纹带；缠枝莲使用连续藤蔓与切向萌叶；莲瓣和团花使用法向包络；如意云使用骨架长柄与端点云头。
4. 已移除主作品中的虚线圆、同心圆、调试轴和重复手势回声。
5. 390px Chromium 实测生成动画 0 个 Long Task，控制台 0 errors / 0 warnings。

## 已验证核心路径

1. 打开应用。
2. 选择缠枝莲、二方连续、石青。
3. 放入示范笔迹并生成，等待动画完成。
4. 复制 Seed，在传纹页输入并恢复。
5. 打开古纹修复，完成第一关并计分。
6. 收藏纹样，进入纹谱并检查本地持久化。
7. 下载 3:4、无缝 Tile 和默认 PNG。
8. 模拟小红书容器 `publishNote` 调用。

## 真机提交前复核

- Builder Hub 实际 `window.xhs.miniTool` 方法名和参数仍需以平台当日文档/真机返回为准。
- 登录、扫码、验证码和相册授权由提交者在真机完成。
- 平台 WebView 若禁用 Blob 下载，应使用容器保存接口；当前页面会保留本地降级逻辑。
