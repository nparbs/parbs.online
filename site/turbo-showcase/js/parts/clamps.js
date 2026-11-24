import * as THREE from 'three';
import { TAU, V3, lathe, sweep, mesh, merge } from '../geo.js?v=4';

export function buildVband(M, r) {
  const group = new THREE.Group();

  // 1. Band
  const bandProfile = [
    [-0.32, r + 0.35],
    [0.32, r + 0.35],
    [0.32, r + 0.2],
    [0, r],
    [-0.32, r + 0.2],
    [-0.32, r + 0.35]
  ];
  const bandGeo = lathe(bandProfile, { segs: 96, phi0: 0.25, phiLen: TAU - 0.5 });
  const band = mesh(bandGeo, M.steel);
  group.add(band);

  // 2. T-bolt latch
  const latchGroup = new THREE.Group();
  
  // Two blocks
  const blockGeo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
  const block1 = mesh(blockGeo, M.steel);
  block1.position.set(0, r + 0.5, 0.55);
  const block2 = mesh(blockGeo, M.steel);
  block2.position.set(0, r + 0.5, -0.55);
  latchGroup.add(block1, block2);

  // Bolt
  const boltGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.6, 16);
  boltGeo.rotateX(Math.PI / 2);
  const bolt = mesh(boltGeo, M.darkSteel);
  bolt.position.set(0, r + 0.55, 0);
  latchGroup.add(bolt);

  // Nut
  const nutGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.22, 6);
  nutGeo.rotateX(Math.PI / 2);
  const nut = mesh(nutGeo, M.darkSteel);
  nut.position.set(0, r + 0.55, 0.85);
  latchGroup.add(nut);

  group.add(latchGroup);

  group.userData.anchors = {
    band: V3(0, (r + 0.35) * Math.cos(1.2), (r + 0.35) * Math.sin(1.2)),
    latch: V3(0, r + 0.75, 0)
  };

  return group;
}

export function buildOilLines(M) {
  const group = new THREE.Group();

  // 1. Feed group
  const feedGroup = new THREE.Group();
  const feedCurve = new THREE.CatmullRomCurve3([
    V3(-0.3, 3.8, 0),
    V3(-0.3, 5.0, 0),
    V3(-0.8, 6.2, 0.6),
    V3(-2.0, 6.9, 1.6),
    V3(-3.0, 7.1, 2.2)
  ]);
  const feedPath = (t) => ({ p: feedCurve.getPoint(t), r: 0.22 });
  const feedTubeGeo = sweep(feedPath, { nt: 96, nr: 24 });
  feedGroup.add(mesh(feedTubeGeo, M.braid));

  // AN fittings
  const fittingGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 6);

  const pStart = feedCurve.getPoint(0.03);
  const tStart = feedCurve.getTangent(0.03).normalize();
  const fitting1 = mesh(fittingGeo, M.accent);
  fitting1.position.copy(pStart);
  fitting1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tStart);
  // Adjust position so center of cylinder is at point
  fitting1.position.add(tStart.clone().multiplyScalar(0.25));
  feedGroup.add(fitting1);

  const pEnd = feedCurve.getPoint(0.97);
  const tEnd = feedCurve.getTangent(0.97).normalize();
  const fitting2 = mesh(fittingGeo, M.accent);
  fitting2.position.copy(pEnd);
  fitting2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tEnd);
  fitting2.position.add(tEnd.clone().multiplyScalar(-0.25));
  feedGroup.add(fitting2);

  group.add(feedGroup);

  // 2. Drain group
  const drainGroup = new THREE.Group();
  const drainCurve = new THREE.CatmullRomCurve3([
    V3(0.2, -2.6, 0),
    V3(0.2, -4.0, 0),
    V3(0.5, -5.2, 0),
    V3(1.6, -6.2, 0)
  ]);
  const drainPath = (t) => ({ p: drainCurve.getPoint(t), r: 0.42 });
  const drainTubeGeo = sweep(drainPath, { nt: 96, nr: 24 });
  drainGroup.add(mesh(drainTubeGeo, M.steel));

  // Flange
  const flangeGeo = new THREE.BoxGeometry(2.0, 0.25, 2.0);
  const flange = mesh(flangeGeo, M.steel);
  flange.position.set(0.2, -2.72, 0);
  drainGroup.add(flange);

  // Rubber joiner
  const rubberPath = (t) => {
    const u = 0.8 + (t * 0.2);
    return { p: drainCurve.getPoint(u), r: 0.48 };
  };
  const rubberTubeGeo = sweep(rubberPath, { nt: 48, nr: 16 });
  drainGroup.add(mesh(rubberTubeGeo, M.rubber));

  group.add(drainGroup);

  group.userData.feed = feedGroup;
  group.userData.drain = drainGroup;
  group.userData.anchors = {
    feed: V3(-0.3, 5.0, 0.22),
    drain: V3(0.62, -4.2, 0)
  };

  return group;
}
