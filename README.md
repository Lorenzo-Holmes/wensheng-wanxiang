# 纹生万象 · 国风随笔画

> **一张宣纸，一盒国风画笔；画笔也能作为 Seed 分享。**

《纹生万象》已经从“一笔生成纹样”重构为移动端优先的轻量绘画小工具。打开就是一张固定 3:4 宣纸：一根手指持续绘画，两根手指缩放和移动画布；用户可以不断换笔、换色、撤销、重做和按笔擦除，不再被“一笔结束”限制。

## 核心体验

- 固定 3:4 画布，边界清楚，方便直接构图并用于小红书分享。
- 一指绘画；双指缩放/平移；“适应”按钮一键回到整纸视图。
- 多笔持续创作，每一笔保存自己的画笔配置快照。
- Undo / Redo、按笔擦除、清空画布、本地自动恢复。
- 默认国风画笔：松烟墨、飞白、浓墨、淡墨、朱砂、金线、缠枝、云雷。
- 自定义画笔可修改笔尖、颜色、粗细、透明度、间距与随机感。
- 画笔配置编码为 **WB2 Brush Seed**，别人导入即可获得同一支画笔。
- 作品分享以高清 PNG 为主，画笔分享以 Seed 为主；二者互不混淆。

## 高清与流畅度

编辑和导出使用两套分辨率：

```text
实时绘画：约 540–900 px 宽的 Preview Canvas
             ↓
用户点击导出
             ↓
1440 × 1920 高清 PNG
或
2160 × 2880 超清 PNG
```

绘画区域使用双层 Canvas：

```text
Committed Canvas  已完成笔迹
Preview Canvas    当前正在画的一笔
```

PointerMove 时只重绘当前笔，不重放整张作品；PointerUp 后再把当前笔提交到历史画布。高分辨率 Canvas 只在导出时临时创建，完成后立即释放。

## 画笔种子 WB2

画笔 Seed 只保存画笔配置，不保存作品内容。当前二进制格式包含：

- 笔尖类型；
- RGB 颜色；
- 粗细；
- 透明度；
- Pattern Brush 间距；
- 随机感；
- 直接父画笔指纹；
- CRC16 校验。

典型格式：

```text
WB2-xxxxxxxxxxxxxxxxxxxx
```

Seed 自包含、无需服务器，适合直接放进小红书笔记或评论区传播。

## 生产约束

运行时仍坚持：

- 纯 HTML / CSS / JavaScript；
- 零框架；
- 零 npm runtime；
- 零后端；
- 零 CDN；
- 零远程字体和远程图片；
- 不执行用户提供的 JavaScript；
- 用户画作与自定义画笔默认只保存在本机浏览器。

小红书生产包只需要：

```text
index.html
styles.css
app.js
favicon.svg
```

`.github/`、`qa/`、README 和测试截图只用于开发/CI，不应进入生产 ZIP。

## 本地运行

```powershell
python -m http.server 8787 --directory .
```

然后访问 `http://127.0.0.1:8787/`。

## 调试接口

```js
WenShengWanXiang.state
WenShengWanXiang.encodeBrush(brush)
WenShengWanXiang.decodeBrush(seed)
WenShengWanXiang.fingerprint(seed)
WenShengWanXiang.benchmark()
```

## 产品定位

《纹生万象》现在的重点不是“替用户生成一张纹样”，而是让用户像打开普通绘画软件一样马上开始画，同时提供普通画板没有的国风画笔与 Seed 传播机制：

> **作品用图片传播，画笔用 Seed 传播。**
