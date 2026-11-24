import * as THREE from 'three';
import { TAU, V3, lathe, volute, hex, mesh, merge } from '../geo.js?v=4';

export function buildCompressorHousing(M) {
  const group = new THREE.Group();

  // 1. Inlet + shroud
  const shroudCurve = [];
  for (let i = 0; i <= 12; i++) {
    const w = i / 12;
    const x = -3.4 + 2.65 * (1 - Math.pow(1 - w, 1.6));
    const r = 3.2 + 1.05 * Math.pow(w, 3);
    shroudCurve.push([x, r]);
  }
  const profile = [
    [-1.4, 4.8], [-2.2, 3.75], [-6.6, 3.75], [-6.75, 3.95], [-6.95, 3.95], [-7.1, 3.75], [-7.6, 3.75],
    [-7.6, 3.35], [-3.4, 3.2], ...shroudCurve, [-0.75, 5.4], [-1.4, 4.8]
  ];
  const inletGeo = lathe(profile, { segs: 96 });
  group.add(mesh(inletGeo, M.castAlu));

  // 2. Back flange
  const flangeProfile = [[-0.35, 4.35], [-0.35, 6.3], [0, 6.3], [0, 4.35], [-0.35, 4.35]];
  const flangeGeo = lathe(flangeProfile, { segs: 96 });
  group.add(mesh(flangeGeo, M.alu));

  // 3. Volute & Web
  const v = volute({
    x: -0.95, rc0: 5.75, rc1: 6.45, tr0: 0.55, tr1: 1.55,
    th0: -Math.PI / 2 + 0.4, th1: 3 * Math.PI / 2, dir: -1, outLen: 4.2, outR: 1.3
  });
  group.add(mesh(v.geo, M.castAlu));

  const webProfile = [[-0.35, 6.3], [-0.35, 5.4], [-1.4, 4.8], [-1.9, 5.6], [-0.35, 6.3]];
  const webGeo = lathe(webProfile, { segs: 48 });
  group.add(mesh(webGeo, M.castAlu));

  // 4. Outlet mouth
  const mouthGroup = new THREE.Group();
  const mouthRing1 = lathe([[-0.35, 1.2], [-0.35, 1.5], [0, 1.5], [0, 1.2], [-0.35, 1.2]], { segs: 48 });
  const mouthRing2 = lathe([[-0.55, 1.5], [-0.55, 1.65], [-0.4, 1.65], [-0.4, 1.5], [-0.55, 1.5]], { segs: 48 });
  mouthGroup.add(mesh(mouthRing1, M.alu));
  mouthGroup.add(mesh(mouthRing2, M.alu));
  mouthGroup.position.copy(v.end.p);
  mouthGroup.quaternion.setFromUnitVectors(V3(1, 0, 0), v.end.t);
  group.add(mouthGroup);

  // 5. Bolts
  for (let k = 0; k < 8; k++) {
    const psi = (k + 0.5) * TAU / 8;
    const bMesh = mesh(hex(0.26, 0.18), M.steel);
    bMesh.position.set(-0.53, 5.95 * Math.cos(psi), 5.95 * Math.sin(psi));
    group.add(bMesh);
  }

  // 6. Actuator bracket boss
  const bossGeo = new THREE.BoxGeometry(2.2, 0.3, 1.6);
  const boss = mesh(bossGeo, M.castAlu);
  boss.position.set(-1.0, -1.5, -7.4);
  group.add(boss);

  // 7. Cast name pad
  const padGeo = new THREE.BoxGeometry(2.4, 0.06, 0.9);
  const pad = mesh(padGeo, M.alu);
  pad.position.set(-5.0, 3.78, 0);
  group.add(pad);

  // Anchors
  const P = (x, r, psi) => V3(x, r * Math.cos(psi), r * Math.sin(psi));
  const vPath = v.path(0.6);
  const t_val = 0.6;
  const spiralFrac = 0.78;
  const th_at_t = (-Math.PI / 2 + 0.4) + (3 * Math.PI / 2 - (-Math.PI / 2 + 0.4)) * (t_val / spiralFrac);
  const radialDir = V3(0, Math.cos(th_at_t * -1), Math.sin(th_at_t * -1));
  
  group.userData.anchors = {
    inlet: P(-7.3, 3.8, 0.9),
    shroud: P(-3.0, 3.75, 2.4),
    volute: vPath.p.clone().add(radialDir.multiplyScalar(vPath.r)),
    outlet: v.end.p,
    diffuser: P(-0.5, 6.25, -1.0)
  };

  return group;
}
