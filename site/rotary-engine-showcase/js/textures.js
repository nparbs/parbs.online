// Procedural PBR textures (canvas-based) and racecar sponsor decal sheets.
// Zero external asset dependencies; every texture is deterministic and fast to build.

import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(canvas, { repeat = [1, 1], srgb = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

// Fast deterministic PRNG (Mulberry32) so textures look consistent every reload
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Engine & Metal PBR Textures
// ---------------------------------------------------------------------------

/** Sand-cast aluminum / cast iron granular bump & roughness map */
export function castMetalTexture(seed = 101, scale = 1, repeat = [3, 3]) {
  const N = 256;
  const [c, g] = makeCanvas(N, N);
  const img = g.createImageData(N, N);
  const d = img.data;
  const rand = rng(seed);
  // Tileable multi-octave grain via grid + high-freq speckle
  const grid = new Float32Array(32 * 32);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const sample = (u, v) => {
    const x = ((u % 32) + 32) % 32, y = ((v % 32) + 32) % 32;
    const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) & 31, y1 = (y0 + 1) & 31;
    const fx = x - x0, fy = y - y0;
    const a = grid[y0 * 32 + x0], b = grid[y0 * 32 + x1];
    const c0 = grid[y1 * 32 + x0], d0 = grid[y1 * 32 + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c0 * (1 - fx) + d0 * fx) * fy;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const coarse = sample((x / N) * 32, (y / N) * 32);
      const med = sample((x / N) * 64, (y / N) * 64);
      const fine = rand();
      const v = Math.max(0, Math.min(255, ((coarse * 0.42 + med * 0.33 + fine * 0.25) * 255 * scale) | 0));
      const idx = (y * N + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTex(c, { repeat, srgb: false });
}

/** Linear brushed metal texture (aluminum runners, shaft journals, chrome) */
export function brushedMetalTexture(seed = 202, repeat = [2, 2]) {
  const W = 256, H = 256;
  const [c, g] = makeCanvas(W, H);
  const rand = rng(seed);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    const base = 115 + ((rand() * 28) | 0);
    g.fillStyle = `rgb(${base},${base},${base})`;
    g.fillRect(0, y, W, 1);
  }
  for (let i = 0; i < 600; i++) {
    const y = rand() * H;
    const x = rand() * W;
    const len = 30 + rand() * 140;
    const lum = rand() > 0.5 ? 165 + ((rand() * 50) | 0) : 65 + ((rand() * 45) | 0);
    g.fillStyle = `rgba(${lum},${lum},${lum},0.32)`;
    g.fillRect(x, y, len, 1);
    if (x + len > W) g.fillRect(0, y, x + len - W, 1);
  }
  return toTex(c, { repeat, srgb: false });
}

/** Radial CNC-machined / lathe-turned texture (side housing faces, flywheel, brake rotors) */
export function radialMachinedTexture(seed = 303, withDrilled = false) {
  const N = 512;
  const [c, g] = makeCanvas(N, N);
  const rand = rng(seed);
  const cx = N / 2, cy = N / 2;
  g.fillStyle = '#8e9298';
  g.fillRect(0, 0, N, N);
  for (let r = 8; r < N * 0.5; r += 1.4) {
    const lum = 128 + ((rand() - 0.5) * 38) | 0;
    g.strokeStyle = `rgb(${lum},${lum},${lum})`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  if (withDrilled) {
    // Slotted & cross-drilled race brake rotor pattern
    g.strokeStyle = '#25282c';
    g.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 105, cy + Math.sin(a) * 105);
      g.lineTo(cx + Math.cos(a + 0.22) * 235, cy + Math.sin(a + 0.22) * 235);
      g.stroke();
    }
    g.fillStyle = '#181a1d';
    for (let i = 0; i < 8; i++) {
      const a0 = ((i + 0.48) / 8) * Math.PI * 2;
      for (let j = 0; j < 3; j++) {
        const rr = 126 + j * 38;
        const a = a0 + j * 0.08;
        g.beginPath();
        g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 6.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  return toTex(c, { repeat: [1, 1], srgb: withDrilled });
}

/** Wrinkle-coat performance paint texture (intake plenum, oil sump) */
export function wrinkleCoatTexture(seed = 404, repeat = [6, 6]) {
  const N = 128;
  const [c, g] = makeCanvas(N, N);
  const rand = rng(seed);
  g.fillStyle = '#666';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 1800; i++) {
    const x = rand() * N, y = rand() * N, r = 0.8 + rand() * 1.9;
    const v = 50 + ((rand() * 155) | 0);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return toTex(c, { repeat, srgb: false });
}

/** Braided stainless steel hose texture (AN fuel lines) */
export function braidedHoseTexture(repeat = [16, 3]) {
  const N = 128;
  const [c, g] = makeCanvas(N, N);
  g.fillStyle = '#4e5258';
  g.fillRect(0, 0, N, N);
  g.lineWidth = 7;
  for (let i = -N; i < N * 2; i += 16) {
    g.strokeStyle = '#c8cdd4';
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + N, N); g.stroke();
    g.strokeStyle = '#9aa0a8';
    g.beginPath(); g.moveTo(i + 8, 0); g.lineTo(i + 8 - N, N); g.stroke();
  }
  g.lineWidth = 2;
  for (let i = -N; i < N * 2; i += 16) {
    g.strokeStyle = '#22252a';
    g.beginPath(); g.moveTo(i + 4, 0); g.lineTo(i + 4 + N, N); g.stroke();
  }
  return toTex(c, { repeat, srgb: true });
}

// ---------------------------------------------------------------------------
// Car PBR Textures
// ---------------------------------------------------------------------------

/** 2x2 Twill Carbon Fiber weave (albedo + bump) */
export function carbonFiberTextures(repeat = [14, 14]) {
  const N = 64;
  const [cCol, gCol] = makeCanvas(N, N);
  const [cBump, gBump] = makeCanvas(N, N);
  const step = 16;

  gCol.fillStyle = '#0e1013';
  gCol.fillRect(0, 0, N, N);
  gBump.fillStyle = '#404040';
  gBump.fillRect(0, 0, N, N);

  for (let y = 0; y < N; y += step) {
    for (let x = 0; x < N; x += step) {
      const diag = ((x / step) + (y / step)) % 2 === 0;
      const grad = diag
        ? gCol.createLinearGradient(x, y, x + step, y)
        : gCol.createLinearGradient(x, y, x, y + step);
      grad.addColorStop(0, '#12151a');
      grad.addColorStop(0.5, diag ? '#2e333c' : '#23272f');
      grad.addColorStop(1, '#101216');
      gCol.fillStyle = grad;
      gCol.fillRect(x + 1, y + 1, step - 2, step - 2);

      const bGrad = diag
        ? gBump.createLinearGradient(x, y, x + step, y)
        : gBump.createLinearGradient(x, y, x, y + step);
      bGrad.addColorStop(0, '#484848');
      bGrad.addColorStop(0.5, '#d8d8d8');
      bGrad.addColorStop(1, '#484848');
      gBump.fillStyle = bGrad;
      gBump.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }
  return {
    map: toTex(cCol, { repeat, srgb: true }),
    bumpMap: toTex(cBump, { repeat, srgb: false }),
  };
}

/** Intercooler aluminum fin core texture */
export function intercoolerTexture() {
  const W = 512, H = 256;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#8b9199';
  g.fillRect(0, 0, W, H);
  // Horizontal tubes
  for (let y = 0; y < H; y += 16) {
    g.fillStyle = '#cdd3da';
    g.fillRect(0, y, W, 5);
    g.fillStyle = '#2c3036';
    g.fillRect(0, y + 5, W, 11);
    // Zig-zag fins inside each row
    g.strokeStyle = '#9aa1aa';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = 0; x < W; x += 6) {
      g.moveTo(x, y + 5);
      g.lineTo(x + 3, y + 15);
      g.lineTo(x + 6, y + 5);
    }
    g.stroke();
  }
  // Subtle "TRIAD" stencil spray across the intercooler core!
  g.save();
  g.globalAlpha = 0.42;
  g.fillStyle = '#0c0e11';
  g.font = '900 72px Archivo, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('TRIAD R3', W / 2, H / 2 + 4);
  g.restore();
  return toTex(c, { repeat: [1, 1], srgb: true });
}

/** Racing slick tire sidewall texture with painted stencil lettering */
export function tireSidewallTexture() {
  const N = 512;
  const [c, g] = makeCanvas(N, N);
  const cx = N / 2, cy = N / 2;
  g.fillStyle = '#17181b';
  g.fillRect(0, 0, N, N);
  // Subtle rubber concentric mold lines
  for (let r = 165; r < 248; r += 3) {
    g.strokeStyle = r % 6 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.22)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  // Racing stencil arcs (yellow/white)
  const drawArcText = (text, radius, startAngle, color, fontSize = 20) => {
    g.save();
    g.font = `800 ${fontSize}px Archivo, "Arial Black", sans-serif`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const step = 0.115;
    for (let i = 0; i < text.length; i++) {
      const a = startAngle + (i - (text.length - 1) / 2) * step;
      g.save();
      g.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      g.rotate(a + Math.PI / 2);
      g.fillText(text[i], 0, 0);
      g.restore();
    }
    g.restore();
  };
  drawArcText('PARBS SPORT', 210, -Math.PI / 2, '#f5c418', 21);
  drawArcText('R3 SLICK', 210, Math.PI / 2, '#eaecef', 19);
  // Red accent stripes between lettering
  g.strokeStyle = '#ff4b1f';
  g.lineWidth = 5;
  for (const a of [0, Math.PI]) {
    g.beginPath();
    g.arc(cx, cy, 210, a - 0.16, a + 0.16);
    g.stroke();
  }
  return toTex(c, { repeat: [1, 1], srgb: true });
}

// ---------------------------------------------------------------------------
// Racecar Sponsorship Stickers & Livery Decals (related to user's projects!)
// ---------------------------------------------------------------------------

function makeDecalTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Load a Nano Banana generated decal image relative to this module (works from both / and /dev/),
 * optionally cropping a vertical slice and/or alpha-keying pure black (#000000) to transparent.
 */
function loadDecalImage(relPath, { w = 1024, h = 1024, cropY0 = 0, cropY1 = 1, keyBlack = false, fallbackDraw = null } = {}) {
  const [c, g] = makeCanvas(w, h);
  if (fallbackDraw) fallbackDraw(g, w, h);
  const tex = makeDecalTex(c);
  const url = new URL(relPath, import.meta.url).href;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    g.clearRect(0, 0, w, h);
    const sy = Math.round(img.height * cropY0);
    const sh = Math.round(img.height * (cropY1 - cropY0));
    g.drawImage(img, 0, sy, img.width, sh, 0, 0, w, h);
    if (keyBlack) {
      const id = g.getImageData(0, 0, w, h);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        if (mx < 16) {
          d[i + 3] = 0;
        } else if (mx < 42) {
          d[i + 3] = Math.round(((mx - 16) / 26) * 255);
        }
      }
      g.putImageData(id, 0, 0);
    }
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

/** Helper to draw a crisp rotary rotor triangle mark */
function drawRotorMark(g, cx, cy, r, stroke, fill = null) {
  g.save();
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const a1 = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / 3;
    const am = (a0 + a1) / 2;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    const xm = cx + Math.cos(am) * (r * 0.82), ym = cy + Math.sin(am) * (r * 0.82);
    if (i === 0) g.moveTo(x0, y0);
    g.quadraticCurveTo(xm, ym, x1, y1);
  }
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = r * 0.16; g.lineJoin = 'round'; g.stroke(); }
  g.beginPath();
  g.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  g.fillStyle = stroke || '#ff5b1f';
  g.fill();
  g.restore();
}

/** Windshield Sunstrip Banner: Nano Banana PARBS.ONLINE // TRIAD R3 banner (cropped to center strip) */
export function windshieldBannerTexture() {
  return loadDecalImage('../assets/decals/windshield-banner.jpg', {
    w: 1024, h: 256, cropY0: 0.33, cropY1: 0.67, keyBlack: false,
    fallbackDraw(g, W, H) {
      g.fillStyle = '#0b0d11';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ff4d1a';
      g.fillRect(0, H - 10, W, 10);
      drawRotorMark(g, 215, H / 2 - 4, 44, '#ff4d1a');
      g.fillStyle = '#ffffff';
      g.font = 'italic 900 84px Archivo, "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('PARBS.ONLINE', W / 2 + 28, H / 2 - 6);
    },
  });
}

/**
 * Main Door Livery Decal (transparent background so car paint shows through!)
 * Features JGTC/IMSA number plate #78, SCRAP RIOT main sponsor, CRUNCH RALLY,
 * ABYSSAL, PERMAFROST, MAGMA HOP, DRAFTBORNE, SHUDEN, GROWLOG, MARKET TERMINAL.
 * Pass mirror=true for the opposite side so text reads left-to-right on BOTH sides!
 */
export function sideDoorDecalTexture(isRightSide = true) {
  const W = 1024, H = 512;
  const [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);

  // Subtle translucent racing stripe graphics along lower door
  g.save();
  g.fillStyle = 'rgba(12, 14, 18, 0.84)';
  g.beginPath();
  g.moveTo(20, 365); g.lineTo(995, 315); g.lineTo(980, 445); g.lineTo(10, 468);
  g.closePath(); g.fill();

  g.fillStyle = '#ff4d1a';
  g.beginPath();
  g.moveTo(22, 352); g.lineTo(996, 302); g.lineTo(995, 317); g.lineTo(20, 367);
  g.closePath(); g.fill();

  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(15, 466); g.lineTo(982, 443); g.lineTo(980, 456); g.lineTo(13, 478);
  g.closePath(); g.fill();
  g.restore();

  // Number plate (#78) placed toward the front half of the door
  const plateX = isRightSide ? 660 : 80;
  g.save();
  g.fillStyle = '#f5f6f8';
  g.fillRect(plateX, 46, 260, 232);
  g.fillStyle = '#111318';
  g.fillRect(plateX, 46, 260, 44);
  g.fillStyle = '#ff4d1a';
  g.fillRect(plateX, 90, 260, 8);
  g.fillStyle = '#ffffff';
  g.font = '800 24px Archivo, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('TRIAD R3 · GT', plateX + 130, 68);
  g.fillStyle = '#101216';
  g.font = 'italic 900 144px Archivo, "Arial Black", sans-serif';
  g.fillText('78', plateX + 126, 198);
  g.restore();

  // Primary Door Sponsor: SCRAP RIOT (bold motorsport badge)
  const mainX = isRightSide ? 315 : 675;
  g.save();
  g.fillStyle = 'rgba(10, 12, 16, 0.88)';
  g.beginPath();
  g.moveTo(mainX - 270, 88); g.lineTo(mainX + 275, 72);
  g.lineTo(mainX + 255, 224); g.lineTo(mainX - 290, 240);
  g.closePath(); g.fill();
  g.strokeStyle = '#ffae00';
  g.lineWidth = 6;
  g.stroke();

  g.fillStyle = '#ffae00';
  g.font = 'italic 900 76px Archivo, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SCRAP RIOT', mainX - 6, 146);

  g.fillStyle = '#ffffff';
  g.font = '700 24px "JetBrains Mono", Consolas, monospace';
  g.fillText('HEAVY MECH · ARENA WORKS', mainX - 10, 200);
  g.restore();

  // Secondary lower-door sponsors along the black/orange rocker band:
  // CRUNCH RALLY | ABYSSAL | PERMAFROST | MAGMA HOP
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  // CRUNCH RALLY
  g.fillStyle = '#ffe033';
  g.font = 'italic 900 40px Archivo, "Arial Black", sans-serif';
  g.fillText('CRUNCH RALLY', 180, 408);

  // ABYSSAL (high-gain metal amp style)
  g.fillStyle = '#e5e8ef';
  g.font = '900 38px Archivo, "Arial Black", sans-serif';
  g.fillText('ABYSSAL', 435, 396);
  g.fillStyle = '#ff4d1a';
  g.font = '700 15px "JetBrains Mono", Consolas, monospace';
  g.fillText('AMP SUITE', 435, 422);

  // PERMAFROST
  g.fillStyle = '#5ee2ff';
  g.font = 'italic 900 35px Archivo, "Arial Black", sans-serif';
  g.fillText('PERMAFROST', 670, 386);
  g.fillStyle = '#b9f3ff';
  g.font = '600 14px "JetBrains Mono", Consolas, monospace';
  g.fillText('CRYO COOLING', 670, 412);

  // MAGMA HOP
  g.fillStyle = '#ff6a1a';
  g.font = 'italic 900 34px Archivo, "Arial Black", sans-serif';
  g.fillText('MAGMA HOP', 882, 376);
  g.restore();

  return makeDecalTex(c);
}

/** Front Fender Contingency Sticker Stack (classic JDM/GT300 vertical stack behind front wheel) */
export function fenderStackDecalTexture() {
  const W = 512, H = 512;
  const [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);

  const stickers = [
    { name: 'DRAFTBORNE', sub: 'TACTICAL DECK', bg: '#15121d', fg: '#e9d8ff', acc: '#9b5cff' },
    { name: 'SHUDEN', sub: 'TOKYO MOTORSPORT', bg: '#111419', fg: '#ffffff', acc: '#ff3344' },
    { name: 'GROWLOG', sub: 'BOTANICAL LABS', bg: '#0f1c14', fg: '#6eff9b', acc: '#2fd86b' },
    { name: 'SEESTAR', sub: 'OPTICS & TELEMETRY', bg: '#0c1524', fg: '#92c8ff', acc: '#3c8dff' },
    { name: 'QUICKCUT', sub: 'AERO COMPOSITES', bg: '#18181b', fg: '#ffdf4d', acc: '#ff6600' },
  ];

  stickers.forEach((st, i) => {
    const y = 18 + i * 96;
    g.save();
    g.fillStyle = st.bg;
    g.fillRect(28, y, 456, 78);
    g.fillStyle = st.acc;
    g.fillRect(28, y, 16, 78);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 3;
    g.strokeRect(28, y, 456, 78);

    g.fillStyle = st.fg;
    g.font = 'italic 900 40px Archivo, "Arial Black", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(st.name, 62, y + 32);

    g.fillStyle = '#c4cbd4';
    g.font = '600 16px "JetBrains Mono", Consolas, monospace';
    g.fillText(st.sub, 64, y + 60);
    g.restore();
  });

  return makeDecalTex(c);
}

/** Rear Quarter Panel Sponsor Decal: MARKET TERMINAL, RIFT DAILY, PUTT DAILY, LORACROP */
export function rearQuarterDecalTexture() {
  const W = 512, H = 384;
  const [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);

  // MARKET TERMINAL pill badge
  g.fillStyle = 'rgba(10, 14, 18, 0.9)';
  g.fillRect(24, 24, 464, 108);
  g.fillStyle = '#00e676';
  g.fillRect(24, 24, 464, 10);
  g.fillStyle = '#00e676';
  g.font = '800 42px "JetBrains Mono", Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('MARKET TERMINAL', 256, 74);
  g.fillStyle = '#c7d0da';
  g.font = '600 18px "JetBrains Mono", Consolas, monospace';
  g.fillText('LIVE TELEMETRY · ECU DATA', 256, 110);

  // Lower trio: RIFT DAILY, PUTT DAILY, LORACROP
  const row = [
    { t: 'RIFT DAILY', bg: '#161b2e', fg: '#ffd166' },
    { t: 'PUTT DAILY', bg: '#102418', fg: '#80ed99' },
    { t: 'LORACROP', bg: '#221426', fg: '#f497da' },
  ];
  row.forEach((it, i) => {
    const y = 154 + i * 72;
    g.fillStyle = it.bg;
    g.fillRect(48, y, 416, 56);
    g.strokeStyle = it.fg;
    g.lineWidth = 3;
    g.strokeRect(48, y, 416, 56);
    g.fillStyle = it.fg;
    g.font = 'italic 900 32px Archivo, "Arial Black", sans-serif';
    g.fillText(it.t, 256, y + 30);
  });

  return makeDecalTex(c);
}

/** Hood Center Decal: Nano Banana 3-Rotor TRIAD R3 / PARBS.ONLINE RACING die-cut sticker */
export function hoodDecalTexture() {
  return loadDecalImage('../assets/decals/hood-triad-r3.jpg', {
    w: 1024, h: 1024, cropY0: 0.08, cropY1: 0.92, keyBlack: true,
    fallbackDraw(g, W, H) {
      drawRotorMark(g, W / 2, H * 0.4, 180, '#ff4d1a');
      g.fillStyle = '#ffffff';
      g.font = 'italic 900 120px Archivo, "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('TRIAD R3', W / 2, H * 0.72);
    },
  });
}

/** GT Wing Endplate Decal: Nano Banana interlocking 3-rotor emblem cropped tight */
export function wingEndplateDecalTexture() {
  return loadDecalImage('../assets/decals/hood-triad-r3.jpg', {
    w: 512, h: 512, cropY0: 0.14, cropY1: 0.62, keyBlack: true,
    fallbackDraw(g, W, H) {
      drawRotorMark(g, W / 2, H / 2, 160, '#ff4d1a');
    },
  });
}
