import * as THREE from 'three';
import { TAU, V3, lathe, skin, rod, merge, mesh } from '../geo.js';

export function buildTurbineWheel(M) {
  const group = new THREE.Group();

  // 1. Hub
  const hubProfile = [[0, 0], [0, 3.25], [0.18, 3.3]];
  const r_hub = (x) => 1.0 + 2.3 * Math.pow(1 - (x - 0.18) / 2.77, 2.4);
  for (let x = 0.18; x <= 2.95; x += 2.95 / 20) {
    hubProfile.push([x, r_hub(x)]);
  }
  hubProfile.push([3.2, 0.8], [3.35, 0.45], [3.35, 0]);
  const hubGeo = lathe(hubProfile, { segs: 96 });
  group.add(mesh(hubGeo, M.inconel));

  // 2. Blades
  const bladeGeos = [];
  const numBlades = 11;
  const xh = (u) => 0.18 + 2.77 * u;
  const rh = (u) => r_hub(xh(u));
  const xs = (u) => 0.8 + 2.15 * Math.pow(u, 1.5);
  const rs = (u) => 3.4 - 0.5 * Math.pow(u, 2.5);

  for (let k = 0; k < numBlades; k++) {
    const a0 = (k * TAU) / numBlades;
    const bladeSurf = (u, v) => {
      const x = (1 - v) * xh(u) + v * xs(u);
      const r = (1 - v) * rh(u) + v * rs(u);
      const psi = a0 + 0.95 * Math.pow(u, 3) * (0.35 + 0.65 * v);
      return V3(x, r * Math.cos(psi), r * Math.sin(psi));
    };
    const bladeThick = (u, v) => (u > 0.95 ? 0.05 : 0.1);
    const bGeo = skin(bladeSurf, { nu: 24, nv: 9, thick: bladeThick });
    bladeGeos.push(bGeo);
  }
  group.add(mesh(merge(bladeGeos), M.inconel));

  // 3. Weld and Shaft
  const weldGeo = new THREE.TorusGeometry(0.42, 0.07, 10, 40);
  weldGeo.rotateY(Math.PI / 2);
  weldGeo.translate(-0.05, 0, 0);
  group.add(mesh(weldGeo, M.darkSteel));

  const shaftStubGeo = rod(0.32, -0.3, 0);
  group.add(mesh(shaftStubGeo, M.steel));

  // Metadata
  group.userData.spin = group;

  // Anchors
  const getBladeSurfPoint = (k, u, v) => {
    const a0 = (k * TAU) / numBlades;
    const x = (1 - v) * xh(u) + v * xs(u);
    const r = (1 - v) * rh(u) + v * rs(u);
    const psi = a0 + 0.95 * Math.pow(u, 3) * (0.35 + 0.65 * v);
    return V3(x, r * Math.cos(psi), r * Math.sin(psi));
  };

  group.userData.anchors = {
    inducer: getBladeSurfPoint(0, 0, 0.6),
    exducer: getBladeSurfPoint(3, 1, 0.6),
    weld: V3(-0.05, 0.45, 0),
    nose: V3(3.3, 0.45, 0)
  };

  return group;
}
