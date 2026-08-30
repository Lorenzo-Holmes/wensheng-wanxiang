(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789LU";
  const SYSTEMS = ["yunlei", "lotus-vine", "lotus-petal", "tuanhua", "ruyi"];
  const STRUCTURES = ["mirror", "rotate", "repeat-x", "tile", "radial"];
  const PALETTES = ["cinnabar", "lapis", "daiqing", "ink", "moon"];
  const LABELS = {
    systems: { yunlei: "云雷", "lotus-vine": "缠枝莲", "lotus-petal": "莲瓣", tuanhua: "团花", ruyi: "如意云" },
    structures: { mirror: "镜像", rotate: "旋转", "repeat-x": "二方连续", tile: "四方连续", radial: "放射团花" },
    palettes: { cinnabar: "朱砂", lapis: "石青", daiqing: "黛青", ink: "松烟", moon: "月白" }
  };
  const COLORS = {
    cinnabar: { bg: "#eadcc6", paper: "#f6eee2", primary: "#a83f32", secondary: "#3d5853", accent: "#c18a45", dark: "#352822", pale: "#e7c2a0" },
    lapis: { bg: "#d7d6ce", paper: "#eef0e8", primary: "#285a71", secondary: "#a64d3b", accent: "#c49a56", dark: "#24393d", pale: "#c5d7d4" },
    daiqing: { bg: "#dddacb", paper: "#f1eee4", primary: "#3d5d57", secondary: "#a24e3f", accent: "#b98545", dark: "#293a37", pale: "#c7d3c9" },
    ink: { bg: "#cec7bc", paper: "#e5ded2", primary: "#28312f", secondary: "#a5483d", accent: "#bd934f", dark: "#1e2524", pale: "#c3b8a9" },
    moon: { bg: "#dce7e2", paper: "#f0f4ed", primary: "#4d7775", secondary: "#a44239", accent: "#c39758", dark: "#284449", pale: "#cadbd4" }
  };
  const DENSITY_LABELS = ["疏", "偏疏", "中", "偏密", "密"];
  const RHYTHM_LABELS = ["舒缓", "轻快", "均衡", "起伏", "疾行"];

  const drawCanvas = $("#draw-canvas");
  const drawCtx = drawCanvas.getContext("2d");
  const resultCanvas = $("#result-canvas");
  const resultCtx = resultCanvas.getContext("2d");
  const repairCanvas = $("#repair-canvas");
  const repairCtx = repairCanvas.getContext("2d");

  const state = {
    system: "yunlei",
    structure: "mirror",
    palette: "cinnabar",
    density: 3,
    rhythm: 3,
    stroke: [],
    seed: "WW-000000",
    generating: false,
    archive: []
  };

  const repairState = { level: 1, score: 0, streak: 0, target: 2, solved: false, started: false };
  let isDrawing = false;
  let lastDrawPoint = null;
  let toastTimer = null;
  let strokeUiFrame = 0;
  let controlRenderFrame = 0;

  function hashString(value) {
    let h1 = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
      h1 ^= value.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    return h1 >>> 0;
  }

  function seededRandom(seed) {
    let a = hashString(String(seed)) || 0x6d2b79f5;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function easeInOut(value) {
    return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function copyPoints(points, limit = 11) {
    if (!points.length) return defaultStroke();
    if (points.length <= limit) return points.map((p) => ({ x: p.x, y: p.y }));
    const result = [];
    for (let i = 0; i < limit; i += 1) {
      const index = Math.round((i * (points.length - 1)) / (limit - 1));
      result.push({ x: points[index].x, y: points[index].y });
    }
    return result;
  }

  function defaultStroke() {
    return [
      { x: 0.16, y: 0.68 }, { x: 0.25, y: 0.55 }, { x: 0.36, y: 0.42 },
      { x: 0.49, y: 0.35 }, { x: 0.61, y: 0.39 }, { x: 0.72, y: 0.52 },
      { x: 0.82, y: 0.62 }
    ];
  }

  function effectiveStroke() {
    if (!state.stroke.length) return defaultStroke();
    return state.stroke.map((p) => ({ x: p.x / drawCanvas.width, y: p.y / drawCanvas.height }));
  }

  function strokeMetrics(points = effectiveStroke()) {
    const first = points[0] || { x: .2, y: .5 };
    const last = points[points.length - 1] || { x: .8, y: .5 };
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return { angle: Math.atan2(dy, dx), length, dx, dy, first, last };
  }

  function drawInputBoard() {
    const w = drawCanvas.width;
    const h = drawCanvas.height;
    drawCtx.clearRect(0, 0, w, h);
    drawCtx.fillStyle = "#eee2ce";
    drawCtx.fillRect(0, 0, w, h);
    drawCtx.save();
    drawCtx.strokeStyle = "rgba(83, 61, 42, .06)";
    drawCtx.lineWidth = 1;
    for (let x = 0; x <= w; x += 64) { drawCtx.beginPath(); drawCtx.moveTo(x, 0); drawCtx.lineTo(x, h); drawCtx.stroke(); }
    for (let y = 0; y <= h; y += 64) { drawCtx.beginPath(); drawCtx.moveTo(0, y); drawCtx.lineTo(w, y); drawCtx.stroke(); }
    drawCtx.restore();
    if (!state.stroke.length) return;
    drawCtx.save();
    drawCtx.strokeStyle = "#9f3a30";
    drawCtx.lineWidth = 8;
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.shadowColor = "rgba(142,47,39,.17)";
    drawCtx.shadowBlur = 7;
    drawCtx.beginPath();
    state.stroke.forEach((point, index) => {
      if (index === 0) drawCtx.moveTo(point.x, point.y);
      else drawCtx.lineTo(point.x, point.y);
    });
    drawCtx.stroke();
    drawCtx.restore();
  }

  function eventPoint(event) {
    const rect = drawCanvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) * (drawCanvas.width / rect.width), 0, drawCanvas.width),
      y: clamp((event.clientY - rect.top) * (drawCanvas.height / rect.height), 0, drawCanvas.height)
    };
  }

  function updateStrokeUI() {
    $("#stroke-count").textContent = `${state.stroke.length} 点`;
    $("#stroke-hint").textContent = state.stroke.length ? "笔迹已记录，按生成让它生长" : "还没有笔迹，先画一笔或看示范";
  }

  function setDemoStroke() {
    const points = [];
    for (let i = 0; i <= 34; i += 1) {
      const t = i / 34;
      points.push({
        x: drawCanvas.width * (.14 + t * .72),
        y: drawCanvas.height * (.66 - Math.sin(t * Math.PI) * .28 + Math.sin(t * Math.PI * 2) * .035)
      });
    }
    state.stroke = points;
    drawInputBoard();
    updateStrokeUI();
    toast("示范一笔已放入画布，你也可以直接覆盖它。", "info");
  }

  function startDrawing(event) {
    event.preventDefault();
    drawCanvas.setPointerCapture?.(event.pointerId);
    isDrawing = true;
    state.stroke = [];
    lastDrawPoint = eventPoint(event);
    state.stroke.push(lastDrawPoint);
    drawInputBoard();
    drawCtx.save();
    drawCtx.fillStyle = "#9f3a30";
    drawCtx.beginPath();
    drawCtx.arc(lastDrawPoint.x, lastDrawPoint.y, 4, 0, Math.PI * 2);
    drawCtx.fill();
    drawCtx.restore();
    updateStrokeUI();
  }

  function drawInputSegment(from, to) {
    drawCtx.save();
    drawCtx.strokeStyle = "#9f3a30";
    drawCtx.lineWidth = 8;
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    drawCtx.beginPath();
    drawCtx.moveTo(from.x, from.y);
    drawCtx.lineTo(to.x, to.y);
    drawCtx.stroke();
    drawCtx.restore();
  }

  function moveDrawing(event) {
    if (!isDrawing) return;
    event.preventDefault();
    const point = eventPoint(event);
    if (lastDrawPoint && Math.hypot(point.x - lastDrawPoint.x, point.y - lastDrawPoint.y) < 2) return;
    const previous = lastDrawPoint;
    state.stroke.push(point);
    lastDrawPoint = point;
    drawInputSegment(previous, point);
    if (!strokeUiFrame) {
      strokeUiFrame = requestAnimationFrame(() => {
        strokeUiFrame = 0;
        updateStrokeUI();
      });
    }
  }

  function endDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    lastDrawPoint = null;
    drawInputBoard();
    updateStrokeUI();
    if (state.stroke.length < 3) toast("再多画一点，纹样会更有你的节奏。", "info");
  }

  function encodeNumber(value, count) {
    let result = "";
    let rest = value >>> 0;
    for (let i = 0; i < count; i += 1) { result += ALPHABET[rest & 31]; rest >>>= 5; }
    return result;
  }

  function decodeNumber(value) {
    let result = 0;
    for (let i = value.length - 1; i >= 0; i -= 1) result = result * 32 + ALPHABET.indexOf(value[i]);
    return result >>> 0;
  }

  function makeSeed() {
    const points = copyPoints(effectiveStroke(), 11);
    const meta = 1 | (SYSTEMS.indexOf(state.system) << 3) | (STRUCTURES.indexOf(state.structure) << 6) | (PALETTES.indexOf(state.palette) << 9) | ((state.density - 1) << 12) | ((state.rhythm - 1) << 15);
    let body = encodeNumber(meta, 4) + encodeNumber(points.length, 1);
    points.forEach((point) => {
      body += ALPHABET[Math.round(clamp(point.x, 0, 1) * 31)];
      body += ALPHABET[Math.round(clamp(point.y, 0, 1) * 31)];
    });
    return `WW-${body}${encodeNumber(hashString(body), 2)}`;
  }

  function decodeSeed(seed) {
    const normalized = String(seed || "").trim().replace(/\s+/g, "").toUpperCase();
    if (!/^WW-[A-Z0-9_-]{8,40}$/.test(normalized)) return null;
    const body = normalized.slice(3, -2);
    const checksum = normalized.slice(-2);
    if (encodeNumber(hashString(body), 2).toUpperCase() !== checksum) return null;
    if (body.length < 5) return null;
    const meta = decodeNumber(body.slice(0, 4));
    const count = ALPHABET.indexOf(body[4]);
    if (count < 0 || count > 11 || body.length !== 5 + count * 2) return null;
    const system = SYSTEMS[(meta >>> 3) & 7];
    const structure = STRUCTURES[(meta >>> 6) & 7];
    const palette = PALETTES[(meta >>> 9) & 7];
    const density = ((meta >>> 12) & 7) + 1;
    const rhythm = ((meta >>> 15) & 7) + 1;
    if (!system || !structure || !palette || density > 5 || rhythm > 5) return null;
    const points = [];
    for (let i = 0; i < count; i += 1) {
      const x = ALPHABET.indexOf(body[5 + i * 2]);
      const y = ALPHABET.indexOf(body[6 + i * 2]);
      points.push({ x: (x / 31) * drawCanvas.width, y: (y / 31) * drawCanvas.height });
    }
    return { system, structure, palette, density, rhythm, stroke: points, seed: normalized };
  }

  function syncSelectionUI() {
    $$("[data-system]").forEach((button) => button.classList.toggle("is-selected", button.dataset.system === state.system));
    $$("[data-structure]").forEach((button) => button.classList.toggle("is-selected", button.dataset.structure === state.structure));
    $$("[data-palette]").forEach((button) => button.classList.toggle("is-selected", button.dataset.palette === state.palette));
    $("#density-range").value = String(state.density);
    $("#rhythm-range").value = String(state.rhythm);
    $("#density-value").textContent = DENSITY_LABELS[state.density - 1];
    $("#rhythm-value").textContent = RHYTHM_LABELS[state.rhythm - 1];
    $("#fact-system").textContent = LABELS.systems[state.system];
    $("#fact-structure").textContent = LABELS.structures[state.structure];
    $("#fact-palette").textContent = LABELS.palettes[state.palette];
  }

  function updateSeedUI() {
    state.seed = makeSeed();
    $("#seed-value").textContent = state.seed;
    $("#relay-current-seed").textContent = state.seed;
    const favorite = $("#favorite-pattern");
    if (favorite) favorite.textContent = state.archive.some((item) => item.seed === state.seed) ? "♥ 已收藏" : "♡ 收藏";
  }

  function paperNoise(ctx, w, h, colors, random, amount = 170) {
    ctx.save();
    for (let i = 0; i < amount; i += 1) {
      const x = random() * w;
      const y = random() * h;
      const alpha = 0.025 + random() * .045;
      ctx.fillStyle = `rgba(52, 40, 30, ${alpha})`;
      ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
    }
    ctx.restore();
  }

  function drawPetal(ctx, size, rotation, color, fill = false) {
    ctx.save();
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(size * .45, -size * .08, size * .6, -size * .55, 0, -size);
    ctx.bezierCurveTo(-size * .6, -size * .55, -size * .45, -.08 * size, 0, 0);
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.stroke(); }
    ctx.restore();
  }

  function drawLotus(ctx, size, colors, variant = 0) {
    ctx.save();
    ctx.lineWidth = Math.max(1.4, size * .035);
    ctx.lineJoin = "round";
    ctx.strokeStyle = colors.primary;
    ctx.fillStyle = colors.pale;
    for (let i = 0; i < 7; i += 1) {
      const rotation = -Math.PI * .88 + i * Math.PI * .88 / 6;
      drawPetal(ctx, size * (.58 + (i % 2) * .05), rotation, i % 2 ? colors.secondary : colors.primary, true);
    }
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.ellipse(0, size * .06, size * .28, size * .12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.accent;
    ctx.beginPath();
    ctx.moveTo(-size * .42, size * .13); ctx.quadraticCurveTo(0, size * (.26 + variant * .02), size * .42, size * .13); ctx.stroke();
    ctx.restore();
  }

  function drawCloud(ctx, size, colors, variant = 0) {
    ctx.save();
    ctx.lineWidth = Math.max(1.5, size * .045);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colors.primary;
    ctx.fillStyle = colors.pale;
    ctx.beginPath();
    ctx.moveTo(-size * .78, size * .15);
    ctx.bezierCurveTo(-size * .72, -size * .20, -size * .42, -size * .14, -size * .35, -size * .43);
    ctx.bezierCurveTo(-size * .21, -size * .78, size * .28, -size * .72, size * .26, -size * .35);
    ctx.bezierCurveTo(size * .57, -size * .55, size * .78, -.17 * size, size * .6, size * .14);
    ctx.bezierCurveTo(size * .48, size * .39, size * .1, size * .35, -size * .08, size * .26);
    ctx.bezierCurveTo(-size * .36, size * .52, -size * .68, size * .44, -size * .78, size * .15);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(-size * .48, size * .16);
    ctx.bezierCurveTo(-size * .18, size * .04, -size * .07, size * .18, size * .04, size * .27);
    ctx.bezierCurveTo(size * .15, size * .38, size * .38, size * .28, size * .45, size * .16);
    ctx.stroke();
    if (variant % 2 === 1) {
      ctx.strokeStyle = colors.accent;
      ctx.beginPath(); ctx.moveTo(-size * .72, size * .3); ctx.quadraticCurveTo(-size * .5, size * .62, -size * .27, size * .34); ctx.stroke();
    }
    ctx.restore();
  }

  function drawYunlei(ctx, size, colors, variant = 0) {
    ctx.save();
    ctx.lineWidth = Math.max(1.8, size * .064);
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(-size * .66, size * .52);
    ctx.lineTo(-size * .66, -size * .54);
    ctx.lineTo(size * .62, -size * .54);
    ctx.lineTo(size * .62, size * .48);
    ctx.lineTo(-size * .3, size * .48);
    ctx.lineTo(-size * .3, -size * .17);
    ctx.lineTo(size * .24, -size * .17);
    ctx.lineTo(size * .24, size * .16);
    ctx.lineTo(-size * .02, size * .16);
    ctx.stroke();

    ctx.globalAlpha = .34;
    ctx.lineWidth = Math.max(1, size * .018);
    ctx.strokeStyle = colors.paper;
    ctx.beginPath();
    ctx.moveTo(-size * .66, size * .52);
    ctx.lineTo(-size * .66, -size * .54);
    ctx.lineTo(size * .62, -size * .54);
    ctx.lineTo(size * .62, size * .48);
    ctx.lineTo(-size * .3, size * .48);
    ctx.lineTo(-size * .3, -size * .17);
    ctx.lineTo(size * .24, -size * .17);
    ctx.stroke();

    ctx.globalAlpha = .9;
    ctx.fillStyle = variant % 2 ? colors.accent : colors.secondary;
    ctx.fillRect(-size * .075, size * .085, size * .11, size * .11);
    ctx.restore();
  }

  function drawRosette(ctx, size, colors, variant = 0) {
    ctx.save();
    ctx.lineWidth = Math.max(1.2, size * .035);
    ctx.strokeStyle = colors.primary;
    for (let i = 0; i < 8; i += 1) drawPetal(ctx, size * .48, i * Math.PI / 4 + variant * .04, i % 2 ? colors.secondary : colors.primary, true);
    ctx.fillStyle = colors.accent;
    ctx.beginPath(); ctx.arc(0, 0, size * .17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.dark;
    ctx.beginPath(); ctx.arc(0, 0, size * .28, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawRuyi(ctx, size, colors, variant = 0) {
    ctx.save();
    ctx.lineWidth = Math.max(1.5, size * .04);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colors.primary;
    ctx.fillStyle = colors.pale;
    ctx.beginPath();
    ctx.moveTo(-size * .7, size * .18);
    ctx.bezierCurveTo(-size * .9, -.14 * size, -size * .55, -size * .42, -size * .28, -size * .2);
    ctx.bezierCurveTo(-size * .12, -size * .76, size * .4, -size * .72, size * .43, -size * .28);
    ctx.bezierCurveTo(size * .78, -size * .35, size * .83, size * .1, size * .57, size * .28);
    ctx.bezierCurveTo(size * .38, size * .4, size * .1, size * .22, size * .02, size * .08);
    ctx.bezierCurveTo(-size * .2, size * .36, -size * .52, size * .45, -size * .7, size * .18);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = colors.secondary;
    ctx.beginPath();
    ctx.moveTo(-size * .03, size * .08); ctx.quadraticCurveTo(size * .09, size * (.42 + variant * .03), size * .28, size * .63); ctx.stroke();
    ctx.strokeStyle = colors.accent;
    ctx.beginPath(); ctx.arc(-size * .42, -.08 * size, size * .1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawLeaf(ctx, size, colors, rotation) {
    ctx.save(); ctx.rotate(rotation); ctx.lineWidth = Math.max(1, size * .025); ctx.strokeStyle = colors.secondary; ctx.fillStyle = colors.pale;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(size * .28, -size * .1, size * .4, -size * .42, 0, -size * .58); ctx.bezierCurveTo(-size * .12, -size * .38, -size * .08, -size * .1, 0, 0); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawVine(ctx, size, colors, variant = 0) {
    ctx.save(); ctx.lineWidth = Math.max(1.3, size * .03); ctx.lineCap = "round"; ctx.strokeStyle = colors.secondary;
    ctx.beginPath(); ctx.moveTo(-size * .78, size * .12); ctx.bezierCurveTo(-size * .42, -size * .58, size * .04, size * .58, size * .72, -size * .14); ctx.stroke();
    ctx.strokeStyle = colors.primary;
    ctx.beginPath(); ctx.moveTo(-size * .7, size * .17); ctx.bezierCurveTo(-size * .32, -size * .32, size * .16, size * .36, size * .7, -size * .12); ctx.stroke();
    drawLeaf(ctx, size * .38, colors, -.9 + variant * .08); drawLeaf(ctx, size * .36, colors, 1.0 - variant * .06);
    ctx.translate(-size * .16, -size * .13); drawLotus(ctx, size * .52, colors, variant);
    ctx.restore();
  }

  function drawGestureEcho(ctx, size, colors, points, metrics) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.scale(size * .92, size * .92);
    ctx.translate(-.5, -.5);
    ctx.rotate(metrics.angle * .16);
    ctx.lineWidth = Math.max(.012, .022 * (size / 50));
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = .68;
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
    ctx.stroke();
    ctx.restore();
  }

  function drawMotif(ctx, system, x, y, size, rotation, colors, variant, points, metrics, alpha = 1, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    if (system === "yunlei") drawYunlei(ctx, size, colors, variant);
    if (system === "lotus-vine") drawVine(ctx, size, colors, variant);
    if (system === "lotus-petal") drawLotus(ctx, size, colors, variant);
    if (system === "tuanhua") drawRosette(ctx, size, colors, variant);
    if (system === "ruyi") drawRuyi(ctx, size, colors, variant);
    ctx.restore();
  }

  function motifPositions(w, h, cfg, random) {
    const density = cfg.density;
    const base = Math.min(w, h);
    const positions = [];
    const size = base * (cfg.tileMode ? .18 : .082 + density * .007);
    const angle = strokeMetrics(cfg.points).angle;
    const push = (x, y, rotation = 0, scale = 1, variant = positions.length % 5) => positions.push({ x, y, size, rotation: rotation + angle * .16, scale, variant });
    if (cfg.tileMode) {
      const edgeRotation = -.06;
      push(0, 0, edgeRotation, .92, 0); push(w, 0, edgeRotation, .92, 0);
      push(0, h, edgeRotation, .92, 0); push(w, h, edgeRotation, .92, 0);
      push(w * .5, 0, .06, .92, 1); push(w * .5, h, .06, .92, 1);
      push(0, h * .5, .06, .92, 2); push(w, h * .5, .06, .92, 2);
      push(w * .5, h * .5, edgeRotation, 1.12, 3);
      return positions;
    }
    if (cfg.structure === "mirror") {
      const rows = 2 + Math.floor(density / 3);
      for (let row = 0; row < rows; row += 1) {
        const y = h * (.34 + row * (.32 / Math.max(1, rows - 1)));
        const offset = w * (.22 + Math.abs(row - (rows - 1) / 2) * .025);
        const rowScale = row === Math.floor((rows - 1) / 2) ? 1 : .88;
        push(w * .5 - offset, y, Math.PI + random() * .035, rowScale);
        push(w * .5 + offset, y, random() * .035, rowScale);
      }
      push(w * .5, h * .5, 0, 1.42);
    } else if (cfg.structure === "rotate") {
      const count = 6 + density;
      const radius = base * .26;
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count - Math.PI / 2;
        push(w * .5 + Math.cos(a) * radius, h * .5 + Math.sin(a) * radius, a + Math.PI / 2, .85);
      }
      push(w * .5, h * .5, 0, 1.3);
    } else if (cfg.structure === "repeat-x") {
      const count = 4 + density;
      for (let i = -1; i < count; i += 1) push(w * (.06 + i / (count - 1) * .92), h * .5 + (i % 2 ? size * .18 : -size * .12), i % 2 ? Math.PI : 0, .82);
      for (let i = 0; i < count - 1; i += 1) push(w * (.14 + i / (count - 2) * .72), h * .22, Math.PI / 2, .48);
    } else if (cfg.structure === "tile") {
      const cols = 3 + Math.ceil(density / 2);
      const rows = 3 + Math.floor(density / 2);
      for (let row = -1; row <= rows; row += 1) for (let col = -1; col <= cols; col += 1) {
        push(w * (col + .5) / cols, h * (row + .5) / rows, (row + col) % 2 ? .1 : -.1, .72);
      }
    } else if (cfg.structure === "radial") {
      const count = 8 + density * 2;
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count;
        push(w * .5 + Math.cos(a) * base * .3, h * .5 + Math.sin(a) * base * .3, a + Math.PI / 2, .78);
      }
      push(w * .5, h * .5, angle, 1.35);
    }
    return positions;
  }

  function drawScaffold(ctx, w, h, cfg, colors, metrics) {
    const base = Math.min(w, h);
    ctx.save();
    ctx.lineWidth = Math.max(.8, base * .0022);
    ctx.strokeStyle = colors.primary;
    ctx.globalAlpha = .09;
    ctx.setLineDash([base * .006, base * .024]);
    if (cfg.structure === "mirror" && cfg.system !== "yunlei") {
      ctx.beginPath(); ctx.moveTo(w * .5, h * .12); ctx.lineTo(w * .5, h * .88); ctx.stroke();
    } else if (cfg.structure === "rotate" || cfg.structure === "radial") {
      ctx.beginPath(); ctx.arc(w * .5, h * .5, base * .3, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i += 1) { const a = Math.PI * 2 * i / 8; ctx.beginPath(); ctx.moveTo(w * .5, h * .5); ctx.lineTo(w * .5 + Math.cos(a) * base * .42, h * .5 + Math.sin(a) * base * .42); ctx.stroke(); }
    } else if (cfg.structure === "repeat-x") {
      ctx.beginPath(); ctx.moveTo(w * .05, h * .5); ctx.bezierCurveTo(w * .3, h * (.4 + metrics.dy * .1), w * .7, h * (.6 - metrics.dy * .1), w * .95, h * .5); ctx.stroke();
    } else if (cfg.structure === "tile") {
      for (let x = w * .16; x < w; x += w * .24) { ctx.beginPath(); ctx.moveTo(x, h * .08); ctx.lineTo(x, h * .92); ctx.stroke(); }
      for (let y = h * .16; y < h; y += h * .22) { ctx.beginPath(); ctx.moveTo(w * .08, y); ctx.lineTo(w * .92, y); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawGestureThread(ctx, w, h, cfg, colors, points) {
    if (!points || points.length < 2 || cfg.structure === "tile") return;
    const base = Math.min(w, h);
    const sampled = copyPoints(points, 18);
    const yunleiFocus = cfg.system === "yunlei" && cfg.structure === "mirror";
    const trace = (mirrorY = false, alpha = .3, width = base * .004) => {
      ctx.save();
      ctx.strokeStyle = colors.secondary;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1.2, width);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      sampled.forEach((point, index) => {
        const x = w * ((yunleiFocus ? .255 : .2) + point.x * (yunleiFocus ? .49 : .6));
        const rawY = h * (.5 + (point.y - .5) * (yunleiFocus ? .12 : .24));
        const y = mirrorY ? h - rawY : rawY;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };
    trace(false, yunleiFocus ? .08 : .12, base * (yunleiFocus ? .008 : .012));
    trace(false, yunleiFocus ? .4 : .54, base * (yunleiFocus ? .0023 : .0027));
    if (cfg.structure === "mirror" && !yunleiFocus) {
      trace(true, .08, base * .01);
      trace(true, .34, base * .0022);
    }
  }

  function drawYunleiMedallion(ctx, w, h, cfg, colors, points, metrics, progress = 1) {
    const base = Math.min(w, h);
    const cx = w * .5;
    const cy = h * .5;
    const reveal = easeInOut(clamp(progress, 0, 1));
    const gestureTilt = clamp(metrics.angle, -.8, .8) * .08;

    ctx.save();
    ctx.globalAlpha = .16 * reveal;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = Math.max(1, base * .0022);
    ctx.setLineDash([base * .012, base * .018]);
    ctx.beginPath();
    ctx.arc(cx, cy, base * .355, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = .26 * reveal;
    ctx.beginPath();
    ctx.arc(cx, cy, base * .265, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = .16 * reveal;
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = Math.max(1, base * .0026);
    const stepOuter = base * .275;
    const stepInner = base * .205;
    ctx.beginPath();
    ctx.moveTo(cx - stepInner, cy - stepOuter);
    ctx.lineTo(cx + stepInner, cy - stepOuter);
    ctx.lineTo(cx + stepInner, cy - stepInner);
    ctx.lineTo(cx + stepOuter, cy - stepInner);
    ctx.lineTo(cx + stepOuter, cy + stepInner);
    ctx.lineTo(cx + stepInner, cy + stepInner);
    ctx.lineTo(cx + stepInner, cy + stepOuter);
    ctx.lineTo(cx - stepInner, cy + stepOuter);
    ctx.lineTo(cx - stepInner, cy + stepInner);
    ctx.lineTo(cx - stepOuter, cy + stepInner);
    ctx.lineTo(cx - stepOuter, cy - stepInner);
    ctx.lineTo(cx - stepInner, cy - stepInner);
    ctx.closePath();
    ctx.stroke();

    ctx.globalAlpha = .3 * reveal;
    ctx.lineWidth = Math.max(1.2, base * .0032);
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const x = cx + Math.cos(a) * base * .335;
      const y = cy + Math.sin(a) * base * .335;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-base * .045, -base * .02);
      ctx.lineTo(-base * .045, base * .045);
      ctx.lineTo(base * .045, base * .045);
      ctx.lineTo(base * .045, -base * .02);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    const primaryRing = 4;
    for (let i = 0; i < primaryRing; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 2 + gestureTilt;
      const radius = base * .205;
      const local = clamp((reveal - i * .055) / .78, 0, 1);
      if (local <= 0) continue;
      drawMotif(
        ctx,
        "yunlei",
        cx + Math.cos(a) * radius,
        cy + Math.sin(a) * radius,
        base * .132,
        a + Math.PI / 2,
        colors,
        i,
        points,
        metrics,
        .18 + local * .82,
        .7 + local * .32
      );
    }

    for (let i = 0; i < 4; i += 1) {
      const a = -Math.PI / 4 + i * Math.PI / 2 - gestureTilt;
      const radius = base * .335;
      const local = clamp((reveal - .16 - i * .035) / .68, 0, 1);
      if (local <= 0) continue;
      drawMotif(
        ctx,
        "yunlei",
        cx + Math.cos(a) * radius,
        cy + Math.sin(a) * radius,
        base * .1,
        a + Math.PI / 2,
        colors,
        i + 1,
        points,
        metrics,
        .08 + local * .62,
        .44 + local * .26
      );
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4 + gestureTilt * .5);
    ctx.globalAlpha = .92 * reveal;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = Math.max(1.8, base * .007);
    ctx.strokeRect(-base * .086, -base * .086, base * .172, base * .172);
    ctx.globalAlpha = .3 * reveal;
    ctx.lineWidth = Math.max(1, base * .0022);
    ctx.strokeRect(-base * .064, -base * .064, base * .128, base * .128);
    ctx.rotate(-Math.PI / 4 - gestureTilt * .5);
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = .96 * reveal;
    ctx.beginPath();
    ctx.arc(0, 0, base * .016, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = Math.max(1, base * .0024);
    ctx.globalAlpha = .72 * reveal;
    ctx.beginPath();
    ctx.arc(0, 0, base * .034, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = colors.secondary;
    ctx.globalAlpha = .46 * reveal;
    for (let i = 0; i < 8; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 4;
      const r = base * .267;
      const dot = i % 2 ? base * .005 : base * .007;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dot, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function chaikinGesture(points, iterations = 2) {
    let result = points.map((point) => ({ x: point.x, y: point.y }));
    for (let pass = 0; pass < iterations; pass += 1) {
      if (result.length < 3) break;
      const next = [result[0]];
      for (let i = 0; i < result.length - 1; i += 1) {
        const a = result[i];
        const b = result[i + 1];
        next.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25 });
        next.push({ x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75 });
      }
      next.push(result[result.length - 1]);
      result = next;
    }
    return result;
  }

  function resampleGestureBackbone(rawPoints, targetCount = 72) {
    const safe = (rawPoints?.length ? rawPoints : defaultStroke()).map((point) => ({
      x: clamp(Number(point.x) || 0, 0, 1),
      y: clamp(Number(point.y) || 0, 0, 1)
    }));
    const source = chaikinGesture(safe.length > 1 ? safe : defaultStroke(), 2);
    const lengths = [0];
    for (let i = 1; i < source.length; i += 1) {
      lengths.push(lengths[i - 1] + Math.hypot(source[i].x - source[i - 1].x, source[i].y - source[i - 1].y));
    }
    const total = Math.max(lengths[lengths.length - 1], .001);
    const sampled = [];
    let sourceIndex = 0;
    for (let i = 0; i < targetCount; i += 1) {
      const s = i / Math.max(1, targetCount - 1);
      const target = s * total;
      while (sourceIndex < lengths.length - 2 && lengths[sourceIndex + 1] < target) sourceIndex += 1;
      const a = source[sourceIndex];
      const b = source[Math.min(source.length - 1, sourceIndex + 1)];
      const segment = Math.max(.00001, lengths[sourceIndex + 1] - lengths[sourceIndex]);
      const t = clamp((target - lengths[sourceIndex]) / segment, 0, 1);
      sampled.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s });
    }

    const first = sampled[0];
    const last = sampled[sampled.length - 1];
    const chordX = last.x - first.x;
    const chordY = last.y - first.y;
    const chordLength = Math.max(.001, Math.hypot(chordX, chordY));
    const normalX = -chordY / chordLength;
    const normalY = chordX / chordLength;
    const midX = (first.x + last.x) * .5;
    const midY = (first.y + last.y) * .5;
    const span = Math.max(total, chordLength, .18);
    sampled.forEach((point, index) => {
      const prev = sampled[Math.max(0, index - 1)];
      const next = sampled[Math.min(sampled.length - 1, index + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const tangentLength = Math.max(.0001, Math.hypot(dx, dy));
      const linearX = first.x + chordX * point.s;
      const linearY = first.y + chordY * point.s;
      point.tx = dx / tangentLength;
      point.ty = dy / tangentLength;
      point.nx = -point.ty;
      point.ny = point.tx;
      point.ux = (point.x - midX) / span;
      point.uy = (point.y - midY) / span;
      point.bend = ((point.x - linearX) * normalX + (point.y - linearY) * normalY) / span;
    });
    sampled.forEach((point, index) => {
      const prev = sampled[Math.max(0, index - 1)];
      const next = sampled[Math.min(sampled.length - 1, index + 1)];
      const a0 = Math.atan2(prev.ty, prev.tx);
      const a1 = Math.atan2(next.ty, next.tx);
      let delta = a1 - a0;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      point.curvature = delta;
    });
    return {
      points: sampled,
      angle: Math.atan2(chordY, chordX),
      energy: sampled.reduce((sum, point) => sum + Math.abs(point.bend), 0) / sampled.length,
      total
    };
  }

  function decoratePhysicalSpine(points) {
    return points.map((point, index) => {
      const prev = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const length = Math.max(.001, Math.hypot(dx, dy));
      return {
        ...point,
        tx: dx / length,
        ty: dy / length,
        nx: -dy / length,
        ny: dx / length
      };
    });
  }

  function rotateSpine(points, cx, cy, angle) {
    if (Math.abs(angle) < .0001) return decoratePhysicalSpine(points);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return decoratePhysicalSpine(points.map((point) => {
      const dx = point.x - cx;
      const dy = point.y - cy;
      return { ...point, x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }));
  }

  function buildRepeatSpine(backbone, start, length, center, amplitude, repeats, vertical = false) {
    const points = [];
    const unit = length / repeats;
    for (let repeat = -1; repeat <= repeats; repeat += 1) {
      const reverse = Math.abs(repeat) % 2 === 1;
      const direction = reverse ? -1 : 1;
      backbone.forEach((sourcePoint, index) => {
        const point = reverse ? backbone[backbone.length - 1 - index] : sourcePoint;
        const along = repeat + sourcePoint.s;
        const offset = clamp(point.bend * 2.8, -.46, .46) * amplitude * direction;
        const basePoint = {
          x: vertical ? center + offset : start + along * unit,
          y: vertical ? start + along * unit : center + offset,
          s: clamp((along + 1) / (repeats + 2), 0, 1),
          curvature: point.curvature
        };
        if (!points.length || Math.hypot(basePoint.x - points[points.length - 1].x, basePoint.y - points[points.length - 1].y) > .4) points.push(basePoint);
      });
    }
    return decoratePhysicalSpine(points);
  }

  function deriveStructureSkeletons(structure, model, w, h, cfg, tileMode = false) {
    const base = Math.min(w, h);
    const cx = w * .5;
    const cy = h * .5;
    const density = clamp(cfg.density || 3, 1, 5);
    const rhythm = clamp(cfg.rhythm || 3, 1, 5);
    const backbone = model.points;
    const groups = [];
    const add = (points, weight = 1, role = "main") => groups.push({ points: decoratePhysicalSpine(points), weight, role });

    if (structure === "mirror") {
      const left = w * .15;
      const span = w * .7;
      const amplitude = base * (.36 + rhythm * .03);
      const gap = base * (.055 + density * .008);
      const tilt = clamp(model.angle, -.9, .9) * .11;
      const top = backbone.map((point) => ({
        x: left + point.s * span,
        y: cy - gap + clamp(point.bend * 2.25, -.4, .4) * amplitude,
        s: point.s,
        curvature: point.curvature
      }));
      const bottom = backbone.map((point) => ({
        x: left + point.s * span,
        y: cy + gap - clamp(point.bend * 2.25, -.4, .4) * amplitude,
        s: point.s,
        curvature: -point.curvature
      }));
      groups.push({ points: rotateSpine(top, cx, cy, tilt), weight: 1, role: "mirror-main" });
      groups.push({ points: rotateSpine(bottom, cx, cy, tilt), weight: .92, role: "mirror-main" });

      const core = backbone.map((point) => ({
        x: left + point.s * span,
        y: cy + clamp(point.bend * 2.1, -.38, .38) * base * .24,
        s: point.s,
        curvature: point.curvature
      }));
      groups.push({ points: rotateSpine(core, cx, cy, tilt), weight: cfg.system === "yunlei" ? .52 : .34, role: cfg.system === "yunlei" ? "gesture-core" : "mirror-core" });
    } else if (structure === "rotate" || structure === "radial") {
      const arms = structure === "radial" ? 6 + Math.floor((density - 1) / 2) * 2 : 4 + Math.floor(density / 2);
      const radius = base * (structure === "radial" ? .36 : .33);
      const twist = (.12 + rhythm * .035) * (model.energy > .03 ? Math.sign(backbone[Math.floor(backbone.length / 2)].bend || 1) : 1);
      for (let arm = 0; arm < arms; arm += 1) {
        const origin = -Math.PI / 2 + arm * Math.PI * 2 / arms;
        const path = backbone.map((point) => {
          const bend = clamp(point.bend * 2.5, -.42, .42);
          const angle = origin + bend * 1.15 + point.s * twist;
          const r = base * .018 + point.s * radius;
          return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, s: point.s, curvature: point.curvature };
        });
        add(path, arm % 2 ? .82 : 1, "radial");
      }
    } else if (structure === "repeat-x") {
      const repeats = 3 + Math.floor(density / 2);
      groups.push({
        points: buildRepeatSpine(backbone, -w * .08, w * 1.16, cy, base * (.29 + rhythm * .02), repeats, false),
        weight: 1,
        role: "band"
      });
      if (density >= 4) {
        groups.push({
          points: buildRepeatSpine(backbone, -w * .08, w * 1.16, cy + base * .15, base * .19, repeats, false),
          weight: .46,
          role: "echo"
        });
      }
    } else if (structure === "tile") {
      const rows = tileMode ? 4 : 3 + Math.floor(density / 3);
      const cols = tileMode ? 4 : 3 + Math.floor(density / 3);
      for (let row = -1; row <= rows; row += 1) {
        const y = row * h / rows;
        groups.push({
          points: buildRepeatSpine(backbone, -w * .12, w * 1.24, y, h / rows * .62, cols, false),
          weight: row % 2 ? .82 : 1,
          role: "weft"
        });
      }
      for (let col = -1; col <= cols; col += 1) {
        const x = col * w / cols;
        groups.push({
          points: buildRepeatSpine(backbone, -h * .12, h * 1.24, x, w / cols * .48, rows, true),
          weight: .5,
          role: "warp"
        });
      }
    }
    return groups;
  }

  function visibleSpine(spine, progress) {
    const count = Math.max(2, Math.min(spine.length, 1 + Math.ceil((spine.length - 1) * clamp(progress, 0, 1))));
    return spine.slice(0, count);
  }

  function smoothPath(ctx, spine) {
    if (spine.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(spine[0].x, spine[0].y);
    for (let i = 1; i < spine.length - 1; i += 1) {
      const point = spine[i];
      const next = spine[i + 1];
      ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) * .5, (point.y + next.y) * .5);
    }
    const last = spine[spine.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function strokeSpine(ctx, spine, color, width, alpha = 1) {
    if (spine.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(.8, width);
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    smoothPath(ctx, spine);
    ctx.stroke();
    ctx.restore();
  }

  function meanderPath(ctx, spine) {
    if (spine.length < 2) return;
    const stride = Math.max(2, Math.floor(spine.length / 22));
    const sampled = spine.filter((_, index) => index % stride === 0 || index === spine.length - 1);
    ctx.beginPath();
    ctx.moveTo(sampled[0].x, sampled[0].y);
    let cursor = sampled[0];
    for (let i = 1; i < sampled.length; i += 1) {
      const next = sampled[i];
      if (i % 2) ctx.lineTo(next.x, cursor.y);
      else ctx.lineTo(cursor.x, next.y);
      ctx.lineTo(next.x, next.y);
      cursor = next;
    }
  }

  function facetedPath(ctx, spine, targetSegments = 18) {
    if (spine.length < 2) return;
    const stride = Math.max(1, Math.floor(spine.length / targetSegments));
    ctx.beginPath();
    ctx.moveTo(spine[0].x, spine[0].y);
    for (let index = stride; index < spine.length; index += stride) ctx.lineTo(spine[index].x, spine[index].y);
    const last = spine[spine.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  function yunleiRibbonPath(ctx, spine, cells, depth) {
    if (spine.length < 2) return;
    const count = Math.max(2, Math.min(cells, Math.floor(spine.length / 3)));
    ctx.beginPath();
    for (let cell = 0; cell < count; cell += 1) {
      const startIndex = Math.round(cell * (spine.length - 1) / count);
      const endIndex = Math.round((cell + 1) * (spine.length - 1) / count);
      const start = spine[startIndex];
      const end = spine[endIndex];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.max(.001, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      const side = cell % 2 ? -1 : 1;
      const middleX = start.x + dx * .46;
      const middleY = start.y + dy * .46;
      if (cell === 0) {
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x + nx * depth * side, start.y + ny * depth * side);
      } else {
        ctx.lineTo(start.x + nx * depth * side, start.y + ny * depth * side);
      }
      ctx.lineTo(middleX + nx * depth * side, middleY + ny * depth * side);
      ctx.lineTo(middleX - nx * depth * side, middleY - ny * depth * side);
      ctx.lineTo(end.x - nx * depth * side, end.y - ny * depth * side);
      if (cell === count - 1) ctx.lineTo(end.x, end.y);
    }
  }

  function drawMeanderHook(ctx, point, base, colors, side, alpha) {
    const size = base * .058;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.atan2(point.ty, point.tx));
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = Math.max(1.2, base * .0055);
    ctx.lineJoin = "miter";
    ctx.lineCap = "square";
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * .62, 0);
    ctx.lineTo(size * .62, side * size * .55);
    ctx.lineTo(-size * .28, side * size * .55);
    ctx.lineTo(-size * .28, side * size * .18);
    ctx.lineTo(size * .22, side * size * .18);
    ctx.stroke();
    ctx.restore();
  }

  function renderYunleiOnSpine(ctx, spine, colors, base, progress, cfg, weight, role = "main") {
    const visible = visibleSpine(spine, progress);
    if (visible.length < 2) return;
    ctx.save();
    ctx.lineJoin = "miter";
    ctx.lineCap = "square";
    ctx.strokeStyle = colors.primary;
    const ribbonRole = role === "mirror-main" || role === "band" || role === "radial" || role === "main";
    const cells = role === "radial" ? 3 + Math.floor((cfg.density || 3) / 2) : 5 + (cfg.density || 3);
    const depth = base * (role === "radial" ? .018 : .026 + (cfg.rhythm || 3) * .002);
    ctx.globalAlpha = .1 * weight;
    ctx.lineWidth = Math.max(2, base * .02);
    if (ribbonRole) yunleiRibbonPath(ctx, visible, cells, depth);
    else facetedPath(ctx, visible, 20);
    ctx.stroke();
    ctx.globalAlpha = .96 * weight;
    ctx.lineWidth = Math.max(1.8, base * .0075);
    if (ribbonRole) yunleiRibbonPath(ctx, visible, cells, depth);
    else facetedPath(ctx, visible, 20);
    ctx.stroke();
    ctx.strokeStyle = colors.paper;
    ctx.globalAlpha = .48 * weight;
    ctx.lineWidth = Math.max(.8, base * .0022);
    if (ribbonRole) yunleiRibbonPath(ctx, visible, cells, depth);
    else facetedPath(ctx, visible, 20);
    ctx.stroke();
    ctx.restore();

    const offsetSide = weight < .96 ? -1 : 1;
    const hookCount = ribbonRole ? 0 : role === "main" ? 1 : 0;
    for (let hook = 1; hook <= hookCount; hook += 1) {
      const index = Math.min(visible.length - 2, Math.floor(visible.length * hook / (hookCount + 1)));
      if (index > 1) drawMeanderHook(ctx, visible[index], base, colors, hook % 2 ? 1 : -1, .78 * weight);
    }
    if (role === "mirror-main" && progress > .82 && visible.length > 4) {
      drawMeanderHook(ctx, visible[1], base, colors, offsetSide, .72 * weight);
      drawMeanderHook(ctx, visible[visible.length - 2], base, colors, -offsetSide, .72 * weight);
    }
  }

  function drawLeafAt(ctx, point, base, colors, side, scale = 1, alpha = 1) {
    const length = base * .055 * scale;
    const width = base * .023 * scale;
    const angle = Math.atan2(point.ty, point.tx) + side * (.82 + Math.min(.3, Math.abs(point.curvature || 0) * 2));
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.pale;
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = Math.max(1, base * .0028);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(length * .35, -width, length * .8, -width * .7, length, 0);
    ctx.bezierCurveTo(length * .72, width * .8, length * .28, width * .7, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = alpha * .55;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length * .82, 0); ctx.stroke();
    ctx.restore();
  }

  function drawSpineEnvelope(ctx, spine, base, colors, progress, widthScale = 1, alpha = 1) {
    const visible = visibleSpine(spine, progress);
    if (visible.length < 3) return;
    const left = [];
    const right = [];
    visible.forEach((point, index) => {
      const s = index / Math.max(1, visible.length - 1);
      const width = Math.pow(Math.sin(Math.PI * s), .72) * base * .05 * widthScale + base * .002;
      left.push({ x: point.x + point.nx * width, y: point.y + point.ny * width });
      right.push({ x: point.x - point.nx * width, y: point.y - point.ny * width });
    });
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.pale;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = Math.max(1.2, base * .0035);
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    left.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    right.slice().reverse().forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    strokeSpine(ctx, visible, colors.accent, base * .0022, alpha * .72);
  }

  function renderLotusVineOnSpine(ctx, spine, colors, base, progress, cfg, weight, groupIndex, groupCount) {
    const visible = visibleSpine(spine, progress);
    strokeSpine(ctx, visible, colors.secondary, base * .021, .1 * weight);
    strokeSpine(ctx, visible, colors.primary, base * .0095, .94 * weight);
    strokeSpine(ctx, visible, colors.paper, base * .0022, .46 * weight);
    const interval = Math.max(7, 13 - (cfg.density || 3));
    for (let index = interval; index < visible.length - 4; index += interval) {
      const point = visible[index];
      const side = point.curvature ? Math.sign(point.curvature) || (index % 2 ? 1 : -1) : (index % 2 ? 1 : -1);
      drawLeafAt(ctx, point, base, colors, side, .82 + Math.min(.35, Math.abs(point.curvature || 0) * 4), .82 * weight);
    }
    if (progress > .82 && cfg.structure === "repeat-x" && groupIndex === 0) {
      [.28, .63].forEach((ratio, bloomIndex) => {
        const point = visible[Math.min(visible.length - 2, Math.floor(visible.length * ratio))];
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(Math.atan2(point.ty, point.tx) + (bloomIndex % 2 ? -Math.PI / 2 : Math.PI / 2));
        ctx.globalAlpha = .82 * weight;
        drawLotus(ctx, base * .047, colors, bloomIndex);
        ctx.restore();
      });
    }
    if (progress > .82 && groupCount <= 6 && groupIndex % 2 === 0) {
      const end = visible[visible.length - 1];
      ctx.save();
      ctx.translate(end.x, end.y);
      ctx.rotate(Math.atan2(end.ty, end.tx) + Math.PI / 2);
      ctx.globalAlpha = .86 * weight;
      drawLotus(ctx, base * .055, colors, groupIndex % 3);
      ctx.restore();
    }
  }

  function drawRuyiHeadAt(ctx, point, base, colors, alpha = 1) {
    const size = base * .063;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.atan2(point.ty, point.tx));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.pale;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = Math.max(1.4, base * .0043);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(size * .45, -size * .92, size * 1.25, -size * .62, size * .82, size * .08);
    ctx.bezierCurveTo(size * .54, size * .55, size * .12, size * .32, 0, size * .08);
    ctx.bezierCurveTo(-size * .12, size * .32, -size * .54, size * .55, -size * .82, size * .08);
    ctx.bezierCurveTo(-size * 1.25, -size * .62, -size * .45, -size * .92, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = colors.secondary;
    ctx.globalAlpha = alpha * .62;
    ctx.beginPath(); ctx.arc(0, size * .04, size * .21, -.4, Math.PI * 1.7); ctx.stroke();
    ctx.restore();
  }

  function renderStyleOnSkeleton(ctx, group, cfg, colors, base, progress, index, total, tileMode) {
    const spine = group.points;
    const weight = group.weight ?? 1;
    if (cfg.system === "yunlei") {
      if (group.role === "gesture-core") {
        const visible = visibleSpine(spine, progress);
        strokeSpine(ctx, visible, colors.secondary, base * .012, .06 * weight);
        strokeSpine(ctx, visible, colors.secondary, base * .0032, .74 * weight);
        return;
      }
      renderYunleiOnSpine(ctx, spine, colors, base, progress, cfg, weight, group.role);
      return;
    }
    if (cfg.system === "lotus-vine") {
      renderLotusVineOnSpine(ctx, spine, colors, base, progress, cfg, weight, index, total);
      return;
    }
    if (cfg.system === "lotus-petal") {
      if (cfg.structure === "radial" || cfg.structure === "rotate" || cfg.structure === "mirror") {
        drawSpineEnvelope(ctx, spine, base, colors, progress, .8 + weight * .28, .62 + weight * .24);
      } else {
        const visible = visibleSpine(spine, progress);
        strokeSpine(ctx, visible, colors.primary, base * .006, .84 * weight);
        for (let i = 8; i < visible.length - 3; i += Math.max(8, 14 - (cfg.density || 3))) {
          drawLeafAt(ctx, visible[i], base, colors, i % 2 ? 1 : -1, 1.15, .8 * weight);
        }
      }
      return;
    }
    if (cfg.system === "tuanhua") {
      drawSpineEnvelope(ctx, spine, base, colors, progress, .95, .62 + weight * .2);
      strokeSpine(ctx, visibleSpine(spine, progress), colors.secondary, base * .0025, .68 * weight);
      return;
    }
    if (cfg.system === "ruyi") {
      const visible = visibleSpine(spine, progress);
      strokeSpine(ctx, visible, colors.secondary, base * .018, .1 * weight);
      strokeSpine(ctx, visible, colors.primary, base * .0085, .9 * weight);
      strokeSpine(ctx, visible, colors.paper, base * .002, .42 * weight);
      if (!tileMode && progress > .84 && visible.length > 2) drawRuyiHeadAt(ctx, visible[visible.length - 1], base, colors, .82 * weight);
    }
  }

  function renderContinuousPattern(ctx, w, h, cfg, colors, points, progress, options = {}) {
    const base = Math.min(w, h);
    const model = resampleGestureBackbone(points, 72);
    const groups = deriveStructureSkeletons(cfg.structure, model, w, h, cfg, Boolean(options.tileMode));
    if (!groups.length) return;

    ctx.save();
    if (!options.tileMode) {
      ctx.beginPath();
      ctx.rect(w * .075, h * .12, w * .85, h * .76);
      ctx.clip();
    }
    groups.forEach((group) => strokeSpine(ctx, group.points, colors.secondary, base * .032, .025 * (group.weight ?? 1)));
    groups.forEach((group, index) => {
      const delay = Math.min(.22, index / Math.max(1, groups.length) * .16);
      const localProgress = clamp((progress - delay) / Math.max(.01, 1 - delay), 0, 1);
      renderStyleOnSkeleton(ctx, group, cfg, colors, base, easeInOut(localProgress), index, groups.length, Boolean(options.tileMode));
    });
    ctx.restore();

    if (!options.tileMode && (cfg.structure === "mirror" || cfg.structure === "rotate" || cfg.structure === "radial")) {
      ctx.save();
      ctx.fillStyle = colors.accent;
      ctx.globalAlpha = .9 * clamp(progress, 0, 1);
      ctx.beginPath();
      ctx.arc(w * .5, h * .5, base * .009, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.secondary;
      ctx.lineWidth = Math.max(1, base * .002);
      ctx.globalAlpha = .44 * clamp(progress, 0, 1);
      ctx.beginPath();
      ctx.arc(w * .5, h * .5, base * .02, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPosterBackdrop(ctx, w, h, cfg, colors, points) {
    const base = Math.min(w, h);
    const wash = ctx.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, colors.paper);
    wash.addColorStop(.48, colors.bg);
    wash.addColorStop(1, colors.pale);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const aura = ctx.createRadialGradient(w * .53, h * .43, base * .03, w * .53, h * .43, base * .52);
    aura.addColorStop(0, "rgba(255,255,255,.56)");
    aura.addColorStop(.55, "rgba(255,255,255,.12)");
    aura.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const backdropModel = resampleGestureBackbone(points, 32);
    const backdropSpine = decoratePhysicalSpine(backdropModel.points.map((point) => ({
      x: w * (.16 + point.s * .68),
      y: h * .5 + clamp(point.bend * 2.1, -.42, .42) * base * .42,
      s: point.s
    })));
    strokeSpine(ctx, backdropSpine, colors.primary, base * .085, .026);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(w * .035, h * .025, w * .93, h * .95);
    ctx.restore();
  }

  function drawPosterDetails(ctx, w, h, cfg, colors) {
    const base = Math.min(w, h);
    const insetX = w * .058;
    const insetY = h * .046;
    ctx.save();
    ctx.strokeStyle = colors.primary;
    ctx.globalAlpha = .42;
    ctx.lineWidth = Math.max(1, base * .0022);
    ctx.strokeRect(insetX, insetY, w - insetX * 2, h - insetY * 2);
    ctx.globalAlpha = .13;
    ctx.strokeRect(insetX + base * .012, insetY + base * .012, w - (insetX + base * .012) * 2, h - (insetY + base * .012) * 2);

    ctx.globalAlpha = .78;
    ctx.fillStyle = colors.dark;
    ctx.font = `600 ${Math.max(10, base * .014)}px Georgia, serif`;
    ctx.fillText("PATTERN DNA / " + String(cfg.seed || "").slice(-8), w * .08, h * .09);
    ctx.fillText("WENSHENG WANXIANG", w * .08, h * .925);

    ctx.textAlign = "right";
    ctx.font = `${Math.max(12, base * .021)}px "KaiTi", serif`;
    ctx.fillText(`${LABELS.systems[cfg.system]} · ${LABELS.structures[cfg.structure]}`, w * .91, h * .925);

    const sealSize = base * .075;
    const sealX = w * .84;
    const sealY = h * .075;
    ctx.globalAlpha = .9;
    ctx.fillStyle = "#a84432";
    ctx.fillRect(sealX, sealY, sealSize, sealSize);
    const sealRandom = seededRandom(`${cfg.seed}-seal`);
    ctx.fillStyle = colors.paper;
    ctx.globalAlpha = .34;
    for (let index = 0; index < 5; index += 1) {
      const chip = Math.max(1.5, sealSize * (.025 + sealRandom() * .035));
      ctx.fillRect(sealX + sealRandom() * (sealSize - chip), sealY + sealRandom() * (sealSize - chip), chip, chip * (.6 + sealRandom()));
    }
    ctx.fillStyle = colors.paper;
    ctx.globalAlpha = .94;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.max(16, sealSize * .52)}px "KaiTi", serif`;
    ctx.fillText("纹", w * .84 + sealSize * .5, h * .075 + sealSize * .53);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = .56;
    ctx.fillStyle = colors.primary;
    ctx.font = `700 ${Math.max(12, base * .018)}px "KaiTi", serif`;
    "一笔成纹".split("").forEach((char, index) => ctx.fillText(char, w * .085, h * (.2 + index * .035)));
    ctx.restore();
  }

  function drawPatternToCanvas(canvas, cfg, progress = 1, options = {}) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const colors = COLORS[cfg.palette] || COLORS.cinnabar;
    const random = seededRandom(cfg.seed || "WW-000000");
    const points = cfg.points?.length ? cfg.points : defaultStroke();
    ctx.clearRect(0, 0, w, h);
    if (options.tileMode) { ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, w, h); }
    else drawPosterBackdrop(ctx, w, h, cfg, colors, points);
    if (!options.tileMode) {
      paperNoise(ctx, w, h, colors, random, Math.round((w * h) / 6500));
    }
    renderContinuousPattern(ctx, w, h, cfg, colors, points, progress, options);
    if (!options.tileMode) {
      drawPosterDetails(ctx, w, h, cfg, colors);
    } else {
      const image = ctx.getImageData(0, 0, w, h);
      const data = image.data;
      for (let y = 0; y < h; y += 1) {
        const first = (y * w) * 4;
        const last = (y * w + w - 1) * 4;
        for (let channel = 0; channel < 4; channel += 1) data[last + channel] = data[first + channel];
      }
      for (let x = 0; x < w; x += 1) {
        const first = x * 4;
        const last = ((h - 1) * w + x) * 4;
        for (let channel = 0; channel < 4; channel += 1) data[last + channel] = data[first + channel];
      }
      ctx.putImageData(image, 0, 0);
    }
  }

  function currentConfig() {
    return { ...state, seed: state.seed, points: effectiveStroke() };
  }

  function renderCurrent(progress = 1) {
    drawPatternToCanvas(resultCanvas, currentConfig(), progress);
  }

  function scheduleRenderCurrent() {
    if (controlRenderFrame) return;
    controlRenderFrame = requestAnimationFrame(() => {
      controlRenderFrame = 0;
      renderCurrent(1);
    });
  }

  function drawGenerationReveal(finalCanvas, progress, buffers) {
    const w = resultCanvas.width;
    const h = resultCanvas.height;
    const points = copyPoints(effectiveStroke(), 11);
    const colors = COLORS[state.palette] || COLORS.cinnabar;
    resultCtx.clearRect(0, 0, w, h);
    resultCtx.save();
    resultCtx.globalAlpha = .12 + progress * .08;
    resultCtx.drawImage(finalCanvas, 0, 0);
    resultCtx.restore();

    const maskCtx = buffers.mask.getContext("2d");
    const revealCtx = buffers.reveal.getContext("2d");
    maskCtx.clearRect(0, 0, w, h);
    points.forEach((point, index) => {
      const delay = (index / Math.max(1, points.length - 1)) * .38;
      const local = clamp((progress - delay) / .62, 0, 1);
      if (local <= 0) return;
      const x = w * (.12 + point.x * .76);
      const y = h * (.2 + point.y * .55);
      const radius = Math.max(3, Math.hypot(w, h) * .23 * easeInOut(local));
      const ink = maskCtx.createRadialGradient(x, y, radius * .2, x, y, radius);
      ink.addColorStop(0, "rgba(255,255,255,1)");
      ink.addColorStop(.58, "rgba(255,255,255,.9)");
      ink.addColorStop(.84, "rgba(255,255,255,.34)");
      ink.addColorStop(1, "rgba(255,255,255,0)");
      maskCtx.fillStyle = ink;
      maskCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    });
    const centerReveal = clamp((progress - .08) / .92, 0, 1);
    const centerRadius = Math.max(3, Math.hypot(w, h) * .5 * easeInOut(centerReveal));
    const centerInk = maskCtx.createRadialGradient(w * .5, h * .5, centerRadius * .22, w * .5, h * .5, centerRadius);
    centerInk.addColorStop(0, "rgba(255,255,255,1)");
    centerInk.addColorStop(.7, "rgba(255,255,255,.86)");
    centerInk.addColorStop(.92, "rgba(255,255,255,.2)");
    centerInk.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = centerInk;
    maskCtx.fillRect(w * .5 - centerRadius, h * .5 - centerRadius, centerRadius * 2, centerRadius * 2);

    revealCtx.clearRect(0, 0, w, h);
    revealCtx.globalCompositeOperation = "source-over";
    revealCtx.drawImage(finalCanvas, 0, 0);
    revealCtx.globalCompositeOperation = "destination-in";
    revealCtx.drawImage(buffers.mask, 0, 0);
    revealCtx.globalCompositeOperation = "source-over";
    resultCtx.drawImage(buffers.reveal, 0, 0);

    if (progress < .96 && points.length > 1) {
      const visible = Math.max(2, Math.ceil(points.length * clamp(progress * 1.45, 0, 1)));
      resultCtx.save();
      resultCtx.strokeStyle = colors.accent;
      resultCtx.globalAlpha = .7 * (1 - progress);
      resultCtx.lineWidth = 5;
      resultCtx.lineCap = "round";
      resultCtx.beginPath();
      points.slice(0, visible).forEach((point, index) => {
        const x = w * (.12 + point.x * .76);
        const y = h * (.2 + point.y * .55);
        if (index === 0) resultCtx.moveTo(x, y); else resultCtx.lineTo(x, y);
      });
      resultCtx.stroke();
      resultCtx.restore();
    }
  }

  function animateGeneration() {
    if (state.generating) return;
    state.generating = true;
    const generateButton = $("#generate-pattern");
    const stage = $("#result-stage");
    generateButton.disabled = true;
    generateButton.classList.add("is-loading");
    stage.classList.add("is-generating");
    stage.setAttribute("aria-busy", "true");
    stage.style.setProperty("--growth", "0");
    $("#generation-status").classList.add("is-growing");
    $("#generation-status").innerHTML = "<i></i>生长中";
    $("#growth-label").textContent = "一笔成纹 · GROWING";
    updateSeedUI();
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = resultCanvas.width;
    finalCanvas.height = resultCanvas.height;
    drawPatternToCanvas(finalCanvas, currentConfig(), 1);
    const buffers = { mask: document.createElement("canvas"), reveal: document.createElement("canvas") };
    buffers.mask.width = buffers.reveal.width = resultCanvas.width;
    buffers.mask.height = buffers.reveal.height = resultCanvas.height;
    const startTime = performance.now();
    const duration = 980 + (5 - state.rhythm) * 115;
    if (window.innerWidth <= 760) {
      setTimeout(() => $(".result-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
    }
    const frame = (now) => {
      const progress = clamp((now - startTime) / duration, 0, 1);
      const eased = easeInOut(progress);
      drawGenerationReveal(finalCanvas, eased, buffers);
      stage.style.setProperty("--growth", eased.toFixed(3));
      if (progress < 1) requestAnimationFrame(frame);
      else {
        resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
        resultCtx.drawImage(finalCanvas, 0, 0);
        state.generating = false;
        generateButton.disabled = false;
        generateButton.classList.remove("is-loading");
        stage.classList.remove("is-generating");
        stage.removeAttribute("aria-busy");
        stage.style.setProperty("--growth", "1");
        $("#generation-status").classList.remove("is-growing");
        $("#generation-status").innerHTML = "<i></i>已生长完成";
        $("#growth-label").textContent = "一笔成纹 · COMPLETE";
        updateSeedUI();
        navigator.vibrate?.(12);
      }
    };
    requestAnimationFrame(frame);
  }

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2800);
  }

  function flashAction(button) {
    if (!button) return;
    button.classList.add("is-success");
    setTimeout(() => button.classList.remove("is-success"), 850);
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        const helper = document.createElement("textarea");
        helper.value = value; helper.style.position = "fixed"; helper.style.opacity = "0";
        document.body.appendChild(helper); helper.focus(); helper.select(); document.execCommand("copy"); helper.remove();
      }
      return true;
    } catch (error) { return false; }
  }

  function downloadCanvas(canvas, filename) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  function safeFilePart(value) { return String(value).replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-"); }

  function exportPattern() {
    const format = $("#export-format").value;
    const dims = { card: [900, 1200], wallpaper: [900, 1600], square: [1080, 1080], tile: [960, 960] }[format] || [900, 1200];
    const canvas = document.createElement("canvas"); canvas.width = dims[0]; canvas.height = dims[1];
    const config = currentConfig();
    if (format === "tile") drawPatternToCanvas(canvas, { ...config, structure: "tile" }, 1, { tileMode: true });
    else drawPatternToCanvas(canvas, config, 1);
    downloadCanvas(canvas, `纹生万象-${safeFilePart(LABELS.systems[state.system])}-${format}.png`);
    flashAction($("#export-image"));
    toast(`已导出${format === "tile" ? "无缝 Tile" : $("#export-format").selectedOptions[0].text} PNG。`);
  }

  function saveImage() {
    downloadCanvas(resultCanvas, `纹生万象-${safeFilePart(LABELS.systems[state.system])}-${state.seed}.png`);
    flashAction($("#save-image"));
    toast("图片已准备下载，去设备相册查看。 ");
  }

  function archiveKey() { return "ww-pattern-archive-v1"; }

  function loadArchive() {
    try { state.archive = JSON.parse(localStorage.getItem(archiveKey()) || "[]"); }
    catch (error) { state.archive = []; }
    renderArchive();
    updateSeedUI();
  }

  function saveArchive() {
    try { localStorage.setItem(archiveKey(), JSON.stringify(state.archive.slice(0, 8))); }
    catch (error) { toast("浏览器存储空间已满，请先清理旧纹样。 "); }
  }

  function favoritePattern() {
    const exists = state.archive.find((item) => item.seed === state.seed);
    if (exists) { toast("这幅纹样已经在你的纹谱里。 "); return; }
    state.archive.unshift({
      seed: state.seed,
      system: state.system,
      structure: state.structure,
      palette: state.palette,
      createdAt: new Date().toISOString(),
      thumb: resultCanvas.toDataURL("image/jpeg", .78)
    });
    state.archive = state.archive.slice(0, 8);
    saveArchive(); renderArchive();
    $("#favorite-pattern").textContent = "♥ 已收藏";
    flashAction($("#favorite-pattern"));
    toast("已收入本地纹谱，不会上传。 ");
  }

  function renderArchive() {
    const list = $("#archive-list");
    $("#archive-count").textContent = `${state.archive.length} 幅作品`;
    if (!state.archive.length) {
      list.innerHTML = `<div class="empty-state"><span>纹</span><h3>还没有收藏</h3><p>在造纹页点击“收藏”，你的作品会在这里形成一册本地纹谱。</p><button class="button button-primary" data-jump="maker" type="button">去造第一幅</button></div>`;
      return;
    }
    list.innerHTML = state.archive.map((item, index) => `<article class="archive-card"><img src="${item.thumb}" alt="${LABELS.systems[item.system] || "中式"}纹样缩略图" /><div class="archive-card-body"><div class="archive-card-title"><strong>${LABELS.systems[item.system] || "纹样"}</strong><code>${item.seed}</code></div><div class="archive-card-meta"><span>${LABELS.structures[item.structure] || "结构"}</span><span>${LABELS.palettes[item.palette] || "配色"}</span></div><div class="archive-card-actions"><button type="button" data-load-archive="${index}">继续生长</button><button type="button" data-remove-archive="${index}">移出</button></div></div></article>`).join("");
  }

  function loadArchiveItem(index) {
    const item = state.archive[index];
    if (!item) return;
    restoreSeed(item.seed);
  }

  function removeArchiveItem(index) {
    state.archive.splice(index, 1); saveArchive(); renderArchive(); toast("已从本地纹谱移出。 ");
  }

  async function sharePattern() {
    const title = `纹生万象｜${LABELS.systems[state.system]} ${LABELS.structures[state.structure]}`;
    const message = `${title}\n一笔成纹，把你的手势织进千年。\n纹样 DNA：${state.seed}\n打开《纹生万象》输入 Seed，继续传纹。`;
    const miniTool = window.xhs?.miniTool;
    if (miniTool) {
      const dataUrl = resultCanvas.toDataURL("image/png");
      try {
        if (typeof miniTool.publishNote === "function") {
          await miniTool.publishNote({ title, text: message, image: dataUrl });
          flashAction($("#share-pattern"));
          toast("已调用小红书发笔记能力。 "); return;
        }
        if (typeof miniTool.saveImage === "function") {
          await miniTool.saveImage({ dataUrl, filename: `${state.seed}.png` });
          toast("已调用小红书保存图片能力，Seed 文案也已准备。 ");
        }
      } catch (error) { toast("容器能力暂未响应，已切换为本地分享。 "); }
    }
    const copied = await copyText(message);
    flashAction($("#share-pattern"));
    toast(copied ? "Seed 与投稿文案已复制；图片可先保存再发笔记。 " : "已准备投稿文案，请点击保存图片后发布。 ");
  }

  function restoreSeed(seed) {
    const decoded = decodeSeed(seed);
    if (!decoded) { toast("这个 Seed 未通过校验，请检查是否完整复制。 "); return false; }
    Object.assign(state, decoded);
    syncSelectionUI(); drawInputBoard(); updateStrokeUI(); updateSeedUI();
    switchView("maker");
    renderCurrent(1);
    animateGeneration();
    toast(`已恢复 ${LABELS.systems[state.system]} · ${LABELS.structures[state.structure]}，可以继续加一笔。 `);
    return true;
  }

  function switchView(name) {
    const change = () => {
      $$(".tab-button").forEach((button) => {
        const active = button.dataset.view === name;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      $$(".view-panel").forEach((panel) => {
        const active = panel.dataset.panel === name;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduced) document.startViewTransition(change);
    else change();
    requestAnimationFrame(() => $(`#view-${name}`)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }));
  }

  function setupRevealMotion() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const nodes = $$(".panel, .culture-note, .relay-steps, .repair-fact, .archive-toolbar");
    nodes.forEach((node) => node.classList.add("reveal-block"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-inview");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -6%", threshold: .08 });
    nodes.forEach((node) => observer.observe(node));
  }

  function openInfo() {
    const dialog = $("#info-dialog");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  }

  function closeInfo() { const dialog = $("#info-dialog"); if (dialog.open) dialog.close(); else dialog.removeAttribute("open"); }

  function drawRepairMotif(ctx, x, y, size, type, colors, alpha = 1, rotation = 0) {
    const points = defaultStroke();
    const metrics = strokeMetrics(points);
    drawMotif(ctx, type, x, y, size, rotation, colors, 2, points, metrics, alpha, 1);
  }

  function drawRepairBoard() {
    const ctx = repairCtx;
    const w = repairCanvas.width; const h = repairCanvas.height;
    const colors = COLORS[repairState.level === 2 ? "lapis" : repairState.level === 3 ? "daiqing" : "cinnabar"];
    const type = repairState.level === 1 ? "yunlei" : repairState.level === 2 ? "lotus-vine" : "ruyi";
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colors.paper; ctx.globalAlpha = .65; ctx.fillRect(25, 25, w - 50, h - 50); ctx.globalAlpha = 1;
    const cell = (w - 100) / 5;
    for (let i = 0; i < 5; i += 1) {
      const x = 50 + cell * (i + .5);
      if (i === repairState.target && !repairState.solved) {
        ctx.save(); ctx.strokeStyle = colors.primary; ctx.globalAlpha = .58; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(x, h * .5, 55, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      } else drawRepairMotif(ctx, x, h * .5, 64, type, colors, repairState.solved && i === repairState.target ? 1 : .88, (i % 2 ? .08 : -.08) + (repairState.level === 3 ? i * .08 : 0));
      ctx.save(); ctx.fillStyle = colors.primary; ctx.globalAlpha = .18; ctx.font = "12px Georgia, serif"; ctx.textAlign = "center"; ctx.fillText(String(i + 1).padStart(2, "0"), x, h * .82); ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = colors.primary; ctx.globalAlpha = .3; ctx.lineWidth = 1; ctx.strokeRect(38, 45, w - 76, h - 90); ctx.restore();
  }

  function updateRepairUI() {
    $("#repair-level").textContent = String(repairState.level).padStart(2, "0");
    $("#repair-score").textContent = String(repairState.score);
    $("#repair-streak").textContent = String(repairState.streak);
    $("#repair-next").disabled = !repairState.solved;
  }

  function newRepair(reset = false) {
    if (reset) { repairState.level = 1; repairState.score = 0; repairState.streak = 0; }
    repairState.target = [2, 4, 1][repairState.level - 1];
    repairState.solved = false; repairState.started = true;
    $("#repair-feedback").textContent = "等你落笔";
    $("#repair-prompt").textContent = "点击缺失的纹样单元";
    $("#repair-guide").textContent = "点击画布里的空白格";
    drawRepairBoard(); updateRepairUI();
  }

  function repairClick(event) {
    if (!repairState.started || repairState.solved) return;
    const rect = repairCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * repairCanvas.width / rect.width;
    const cell = (repairCanvas.width - 100) / 5;
    const index = clamp(Math.floor((x - 50) / cell), 0, 4);
    if (index === repairState.target) {
      repairState.solved = true; repairState.score += repairState.level * 100; repairState.streak += 1;
      $("#repair-feedback").textContent = "修复成功 · 节奏闭合";
      $("#repair-prompt").textContent = repairState.level === 3 ? "三关完成，你找回了这条纹谱。" : "这一格回来了，继续下一关。";
      $("#repair-guide").textContent = "单元已补回";
      drawRepairBoard(); updateRepairUI();
    } else {
      repairState.streak = 0; $("#repair-feedback").textContent = "还差一点 · 看左右呼应"; updateRepairUI();
      toast("先观察重复间距，再落点击。 ");
    }
  }

  function repairHint() {
    if (!repairState.started) { toast("先点击“开始修复”。 "); return; }
    $("#repair-feedback").textContent = `提示：第 ${repairState.target + 1} 格的左右方向可以闭合。`;
    $("#repair-guide").textContent = `提示：观察第 ${repairState.target + 1} 格`;
  }

  function bindEvents() {
    drawCanvas.addEventListener("pointerdown", startDrawing);
    drawCanvas.addEventListener("pointermove", moveDrawing);
    drawCanvas.addEventListener("pointerup", endDrawing);
    drawCanvas.addEventListener("pointercancel", endDrawing);
    $("#clear-draw").addEventListener("click", () => { state.stroke = []; drawInputBoard(); updateStrokeUI(); toast("笔迹已清空，可以重新起笔。 "); });
    $("#demo-stroke").addEventListener("click", setDemoStroke);
    $$("[data-system]").forEach((button) => button.addEventListener("click", () => { navigator.vibrate?.(4); state.system = button.dataset.system; syncSelectionUI(); updateSeedUI(); scheduleRenderCurrent(); }));
    $$("[data-structure]").forEach((button) => button.addEventListener("click", () => { navigator.vibrate?.(4); state.structure = button.dataset.structure; syncSelectionUI(); updateSeedUI(); scheduleRenderCurrent(); }));
    $$("[data-palette]").forEach((button) => button.addEventListener("click", () => { navigator.vibrate?.(4); state.palette = button.dataset.palette; syncSelectionUI(); updateSeedUI(); scheduleRenderCurrent(); }));
    $("#density-range").addEventListener("input", (event) => { state.density = Number(event.target.value); syncSelectionUI(); updateSeedUI(); scheduleRenderCurrent(); });
    $("#rhythm-range").addEventListener("input", (event) => { state.rhythm = Number(event.target.value); syncSelectionUI(); updateSeedUI(); });
    $("#generate-pattern").addEventListener("click", animateGeneration);
    $("#copy-seed").addEventListener("click", async () => { const ok = await copyText(state.seed); toast(ok ? "Seed 已复制，发给下一棒吧。 " : "请长按 Seed 手动复制。 "); });
    $("#relay-copy-current").addEventListener("click", async () => { const ok = await copyText(state.seed); toast(ok ? "当前 Seed 已复制。 " : "请长按 Seed 手动复制。 "); });
    $("#relay-restore").addEventListener("click", () => restoreSeed($("#relay-seed-input").value));
    $("#relay-seed-input").addEventListener("keydown", (event) => { if (event.key === "Enter") restoreSeed(event.target.value); });
    $("#relay-to-maker").addEventListener("click", () => switchView("maker"));
    $("#save-image").addEventListener("click", saveImage);
    $("#export-image").addEventListener("click", exportPattern);
    $("#favorite-pattern").addEventListener("click", favoritePattern);
    $("#share-pattern").addEventListener("click", sharePattern);
    $("#clear-archive").addEventListener("click", () => { state.archive = []; saveArchive(); renderArchive(); toast("本地纹谱已清空。 "); });
    $("#new-repair").addEventListener("click", () => newRepair(true));
    $("#repair-next").addEventListener("click", () => { if (!repairState.solved) return; if (repairState.level < 3) repairState.level += 1; else repairState.level = 1; newRepair(false); });
    $("#repair-hint").addEventListener("click", repairHint);
    repairCanvas.addEventListener("click", repairClick);
    $$(".tab-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
    document.addEventListener("click", (event) => {
      const jump = event.target.closest?.("[data-jump]");
      if (jump) switchView(jump.dataset.jump);
      const load = event.target.closest?.("[data-load-archive]");
      if (load) loadArchiveItem(Number(load.dataset.loadArchive));
      const remove = event.target.closest?.("[data-remove-archive]");
      if (remove) removeArchiveItem(Number(remove.dataset.removeArchive));
    });
    $("#open-info").addEventListener("click", openInfo); $("#close-info").addEventListener("click", closeInfo);
    $("#info-dialog").addEventListener("click", (event) => { if (event.target === $("#info-dialog")) closeInfo(); });
  }

  function init() {
    drawInputBoard(); updateStrokeUI(); syncSelectionUI(); updateSeedUI();
    renderCurrent(1); loadArchive(); newRepair(false); bindEvents(); setupRevealMotion();
    window.WenShengWanXiang = { state, restoreSeed, renderCurrent, exportPattern, generate: animateGeneration };
  }

  init();
})();
