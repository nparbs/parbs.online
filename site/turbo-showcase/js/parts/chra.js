import * as THREE from 'three';
import { TAU, V3, lathe, merge, mesh, hex } from '../geo.js?v=4';

export function buildChra(M) {
  const group = new THREE.Group();

  // 1. Main body
  const bodyProfile = [
    [-2.45, 0.85], [-2.45, 3.0], [-2.05, 3.0], [-1.85, 2.15],
    [1.4, 2.15], [1.6, 3.6], [2.3, 3.6], [2.3, 0.85], [-2.45, 0.85]
  ];
  const bodyGeo = lathe(bodyProfile, { segs: 96 });
  group.add(mesh(bodyGeo, M.chra));

  // Machined end faces
  const face1Profile = [[-2.47, 0.85], [-2.47, 3.02], [-2.3, 3.02], [-2.3, 0.85], [-2.47, 0.85]];
  group.add(mesh(lathe(face1Profile, { segs: 64 }), M.alu));
  const face2Profile = [[2.15, 0.85], [2.15, 3.62], [2.32, 3.62], [2.32, 0.85], [2.15, 0.85]];
  group.add(mesh(lathe(face2Profile, { segs: 64 }), M.alu));

  // 2. Ribs
  for (let k = 0; k <= 5; k++) {
    const x = -1.4 + k * 0.5;
    const ribProfile = [[x, 2.15], [x, 2.4], [x + 0.12, 2.4], [x + 0.12, 2.15], [x, 2.15]];
    group.add(mesh(lathe(ribProfile, { segs: 48 }), M.chra));
  }

  // 3. Oil inlet boss (+Y)
  const oilInBoss = mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 32, 1), M.chra);
  oilInBoss.position.set(-0.3, 2.5, 0);
  group.add(oilInBoss);

  const fitting = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 6, 1), M.brass);
  fitting.position.set(-0.3, 3.175, 0);
  group.add(fitting);

  const nipple = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.45, 16, 1), M.brass);
  nipple.position.set(-0.3, 3.575, 0);
  group.add(nipple);

  // 4. Oil drain (-Y)
  const drainBoss = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 32, 1), M.chra);
  drainBoss.position.set(0.2, -2.15, 0);
  group.add(drainBoss);

  const flange = mesh(new THREE.BoxGeometry(2.0, 0.3, 2.0), M.steel);
  flange.position.set(0.2, -2.45, 0);
  group.add(flange);

  const boltHeadGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 6, 1);
  const bh1 = mesh(boltHeadGeo, M.steel);
  bh1.position.set(0.2, -2.69, 0.75);
  const bh2 = mesh(boltHeadGeo, M.steel);
  bh2.position.set(0.2, -2.69, -0.75);
  group.add(bh1);
  group.add(bh2);

  // 5. Coolant ports (+Z and -Z)
  const coolantBossGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.7, 32, 1);
  coolantBossGeo.rotateX(-Math.PI / 2);
  const cb1 = mesh(coolantBossGeo, M.chra);
  cb1.position.set(0.6, 0, 2.35);
  const cb2 = mesh(coolantBossGeo, M.chra);
  cb2.position.set(0.6, 0, -2.35);
  group.add(cb1);
  group.add(cb2);

  const banjoGeo = new THREE.TorusGeometry(0.32, 0.12, 10, 24);
  const b1 = mesh(banjoGeo, M.brass);
  b1.position.set(0.6, 0, 2.85);
  const b2 = mesh(banjoGeo, M.brass);
  b2.position.set(0.6, 0, -2.85);
  group.add(b1);
  group.add(b2);

  const boltHeadZGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 6, 1);
  boltHeadZGeo.rotateX(-Math.PI / 2);
  const bz1 = mesh(boltHeadZGeo, M.brass);
  bz1.position.set(0.6, 0, 3.05);
  const bz2 = mesh(boltHeadZGeo, M.brass);
  bz2.position.set(0.6, 0, -3.05);
  group.add(bz1);
  group.add(bz2);

  // 6. Accent band
  const accentProfile = [[1.25, 2.15], [1.38, 2.15], [1.38, 2.18], [1.25, 2.18], [1.25, 2.15]];
  group.add(mesh(lathe(accentProfile, { segs: 48 }), M.accent));

  group.userData.anchors = {
    oilIn: V3(-0.3, 3.7, 0),
    oilOut: V3(0.2, -2.45, 1.0),
    coolant: V3(0.6, 0, 3.1),
    housing: V3(-0.8, 1.52, 1.52),
    shield: V3(1.95, 2.55, -2.55)
  };

  return group;
}

export function buildBackplate(M) {
  const group = new THREE.Group();

  // 1. Plate
  const plateProfile = [
    [0, 0.5], [0, 5.8], [-0.2, 5.8], [-0.2, 4.3], [-0.28, 4.2], [-0.28, 0.75], [-0.2, 0.5], [0, 0.5]
  ];
  group.add(mesh(lathe(plateProfile, { segs: 64 }), M.alu));

  // 2. Six screw heads
  for (let k = 0; k < 6; k++) {
    const angle = k * TAU / 6;
    const s = mesh(hex(0.2, 0.08), M.darkSteel);
    s.position.set(-0.36, 3.5 * Math.cos(angle), 3.5 * Math.sin(angle));
    group.add(s);
  }

  // 3. Seal ring
  const sealGeo = new THREE.TorusGeometry(0.52, 0.035, 8, 32);
  sealGeo.rotateY(Math.PI / 2);
  const seal = mesh(sealGeo, M.darkSteel);
  seal.position.set(-0.14, 0, 0);
  group.add(seal);

  group.userData.anchors = {
    plate: V3(-0.28, 2.8, 1.0),
    seal: V3(-0.14, 0.55, 0)
  };

  return group;
}
