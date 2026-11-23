import * as THREE from 'three';
import { TAU, V3, lathe, skin, hex, merge, mesh } from '../geo.js';

export function buildCompressorWheel(M) {
  const group = new THREE.Group();

  // 1. Hub
  const hubProfile = [[0, 0.3], [0, 4.1], [-0.22, 4.1]];
  const r_hub = (x) => 0.9 + 3.2 * Math.pow((x + 3.1) / 2.88, 2.2);
  for (let x = -0.22; x >= -3.1; x -= 0.15) {
    hubProfile.push([x, r_hub(x)]);
  }
  hubProfile.push([-3.3, 0.75], [-3.3, 0.3], [0, 0.3]);
  const hubGeo = lathe(hubProfile, { segs: 96 });
  group.add(mesh(hubGeo, M.billet));

  // 2. Blades
  const bladeGeos = [];

  const createBlade = (a0, isSplitter) => {
    const surf = (u, v) => {
      let u_eff = u;
      if (isSplitter) {
        // u is 0..1, but we need to map it to 0.38..1.0
        // The task says "u only covers 0.38..1 (remap u inside surf)"
        // This implies the input u to the surf function should be treated as the 0.38..1 range.
        u_eff = 0.38 + u * (1.0 - 0.38);
      }

      const xh = -3.1 + 2.88 * u_eff;
      const rh = 0.9 + 3.2 * Math.pow(u_eff, 2.2);
      const s_u = 1 - Math.pow(1 - u_eff, 1.6);
      const xs = -3.1 + 2.35 * s_u;
      const rs = 3.1 + 1.0 * Math.pow(u_eff, 3);

      const x = xh + (xs - xh) * v;
      const r = rh + (rs - rh) * v;
      const psi = a0 - 1.15 * Math.pow(1 - u_eff, 2) * (0.55 + 0.45 * v) - 0.35 * Math.pow(u_eff, 3);

      return V3(x, r * Math.cos(psi), r * Math.sin(psi));
    };

    const thickFunc = (u, v) => {
      let u_eff = isSplitter ? 0.38 + u * (1.0 - 0.38) : u;
      const base = (0.13 - 0.07 * v);
      const taper = (u_eff < 0.06) ? (0.35 + (u_eff / 0.06) * 0.65) : 1.0;
      return base * taper;
    };

    return skin(surf, { nu: 26, nv: 10, thick: thickFunc });
  };

  // Full blades
  for (let k = 0; k < 6; k++) {
    bladeGeos.push(createBlade((k * TAU) / 6, false));
  }
  // Splitter blades
  for (let k = 0; k < 6; k++) {
    bladeGeos.push(createBlade(((k + 0.5) * TAU) / 6, true));
  }

  const bladesGeo = merge(bladeGeos);
  group.add(mesh(bladesGeo, M.billet));

  // 3. Nose nut & Washer
  const nutGeo = hex(0.48, 0.42);
  nutGeo.translate(-3.72, 0, 0);
  group.add(mesh(nutGeo, M.steel));

  const washerProfile = [[-3.34, 0.3], [-3.34, 0.55], [-3.3, 0.55], [-3.3, 0.3], [-3.34, 0.3]];
  const washerGeo = lathe(washerProfile, { segs: 48 });
  group.add(mesh(washerGeo, M.steel));

  // Metadata
  group.userData.spin = group;

  // Anchors
  const getSurfPoint = (u, v, isSplitter, a0) => {
    let u_eff = u;
    if (isSplitter) u_eff = 0.38 + u * (1.0 - 0.38);
    const xh = -3.1 + 2.88 * u_eff;
    const rh = 0.9 + 3.2 * Math.pow(u_eff, 2.2);
    const s_u = 1 - Math.pow(1 - u_eff, 1.6);
    const xs = -3.1 + 2.35 * s_u;
    const rs = 3.1 + 1.0 * Math.pow(u_eff, 3);
    const x = xh + (xs - xh) * v;
    const r = rh + (rs - rh) * v;
    const psi = a0 - 1.15 * Math.pow(1 - u_eff, 2) * (0.55 + 0.45 * v) - 0.35 * Math.pow(u_eff, 3);
    return V3(x, r * Math.cos(psi), r * Math.sin(psi));
  };

  group.userData.anchors = {
    inducer: getSurfPoint(0, 0.9, false, 0),
    exducer: getSurfPoint(1, 0.5, false, TAU / 6),
    splitter: getSurfPoint(0.6, 0.6, true, (2.5 * TAU) / 6),
    nut: V3(-3.5, 0.48, 0),
    hub: (() => {
      const x = -1.6;
      const r = r_hub(x);
      const psi = 2.0;
      return V3(x, r * Math.cos(psi), r * Math.sin(psi));
    })()
  };

  return group;
}
