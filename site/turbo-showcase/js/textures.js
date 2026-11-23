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
