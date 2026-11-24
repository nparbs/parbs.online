import * as THREE from 'three';
import { TAU, V3, lathe, mesh, rod } from '../geo.js?v=4';

export function buildShaft(M) {
  const group = new THREE.Group();

  // 1. Stepped shaft
  const shaftProfile = [
    [-6.6, 0],
    [-6.6, 0.2],
    [-2.75, 0.24],
    [-2.75, 0.32],
    [2.3, 0.32],
    [2.3, 0.38],
    [2.6, 0.38],
    [2.6, 0],
    [-6.6, 0]
  ];
  const shaftGeo = lathe(shaftProfile, { segs: 32 });
  group.add(mesh(shaftGeo, M.steel));

  // 2. Thread
  const threadGroup = new THREE.Group();
  const threadCount = 20;
  const startX = -6.55;
  const endX = -5.6;
  for (let i = 0; i < threadCount; i++) {
    const x = startX + (endX - startX) * (i / (threadCount - 1));
    const torusGeo = new THREE.TorusGeometry(0.215, 0.025, 6, 20);
    torusGeo.rotateY(Math.PI / 2);
    torusGeo.translate(x, 0, 0);
    threadGroup.add(mesh(torusGeo, M.darkSteel));
  }
  group.add(threadGroup);

  // 3. Piston-ring seals
  const sealPositions = [-2.5, 2.15];
  sealPositions.forEach(x => {
    const sealGeo = new THREE.TorusGeometry(0.33, 0.035, 8, 32);
    sealGeo.rotateY(Math.PI / 2);
    sealGeo.translate(x, 0, 0);
    group.add(mesh(sealGeo, M.darkSteel));
  });

  // 4. Oil slinger
  const slingerProfile = [
    [-2.6, 0.62],
    [-2.6, 0.32],
    [-2.2, 0.32],
    [-2.2, 0.62],
    [-2.6, 0.62]
  ];
  const slingerGeo = lathe(slingerProfile, { segs: 48 });
  group.add(mesh(slingerGeo, M.alu));

  group.userData.spin = group;
  group.userData.anchors = {
    shaft: V3(0.0, 0.32, 0),
    thread: V3(-6.1, 0.22, 0),
    seal: V3(2.15, 0.36, 0)
  };

  return group;
}

export function buildBearing(M) {
  const group = new THREE.Group();

  // 1. Outer sleeve
  const sleeveProfile = [
    [-1.25, 0.8],
    [-1.25, 0.62],
    [1.25, 0.62],
    [1.25, 0.8],
    [-1.25, 0.8]
  ];
  const sleeveGeo = lathe(sleeveProfile, { segs: 64 });
  group.add(mesh(sleeveGeo, M.steel));

  // 2. Bearing ends
  const cages = [];
  [-1, 1].forEach(s => {
    const endGroup = new THREE.Group();
    const center = s * 1.45;

    // Outer race
    const outerRaceProfile = [
      [s * 1.25, 0.8],
      [s * 1.25, 0.62],
      [s * 1.3, 0.62],
      [s * 1.3, 0.8],
      [s * 1.25, 0.8]
    ];
    const orGeo = lathe(outerRaceProfile.map(([x, r]) => [Math.abs(x), r]), { segs: 48 });
    orGeo.rotateY(s > 0 ? 0 : Math.PI);
    endGroup.add(mesh(orGeo, M.steel));

    const outerRaceProfile2 = [
      [s * 1.6, 0.8],
      [s * 1.6, 0.62],
      [s * 1.7, 0.62],
      [s * 1.7, 0.8],
      [s * 1.6, 0.8]
    ];
    const orGeo2 = lathe(outerRaceProfile2.map(([x, r]) => [Math.abs(x), r]), { segs: 48 });
    orGeo2.rotateY(s > 0 ? 0 : Math.PI);
    endGroup.add(mesh(orGeo2, M.steel));

    // Inner race
    const innerRaceProfile = [
      [s * 1.25, 0.38],
      [s * 1.25, 0.32],
      [s * 1.7, 0.32],
      [s * 1.7, 0.38],
      [s * 1.25, 0.38]
    ];
    const irGeo = lathe(innerRaceProfile.map(([x, r]) => [Math.abs(x), r]), { segs: 48 });
    irGeo.rotateY(s > 0 ? 0 : Math.PI);
    endGroup.add(mesh(irGeo, M.steel));

    // Balls
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * TAU;
      const ballPos = V3(center, 0.5 * Math.cos(angle), 0.5 * Math.sin(angle));
      const ballGeo = new THREE.SphereGeometry(0.14, 16, 12);
      const ball = mesh(ballGeo, M.chrome);
      ball.position.copy(ballPos);
      endGroup.add(ball);
    }

    // Cage
    const cagePositions = [s * 1.33, s * 1.57];
    cagePositions.forEach(cx => {
      const cageGeo = new THREE.TorusGeometry(0.5, 0.03, 6, 40);
      cageGeo.rotateY(Math.PI / 2);
      cageGeo.translate(cx, 0, 0);
      endGroup.add(mesh(cageGeo, M.brass));
    });

    group.add(endGroup);
    cages.push(endGroup);
  });

  // 3. Anti-rotation pin
  const pinGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 16);
  const pin = mesh(pinGeo, M.brass);
  pin.position.set(0.4, 1.05, 0);
  group.add(pin);

  group.userData.cages = cages;
  group.userData.anchors = {
    balls: V3(-1.45, 0.64, 0),
    sleeve: V3(0.3, 0.8, 0)
  };

  return group;
}
