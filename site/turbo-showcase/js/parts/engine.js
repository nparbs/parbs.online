import * as THREE from 'three';
import { V3, mesh, rod, TAU } from '../geo.js?v=4';

export function buildEngine(M) {
  const group = new THREE.Group();

  // Material clones
  const mGlass = M.glass.clone();
  const mGlassEdge = M.glassEdge.clone();
  const mAlu = M.alu.clone();
  const mDarkSteel = M.darkSteel.clone();
  const mSteel = M.steel.clone();
  const mAccent = M.accent.clone();
  const mFlame = M.flame.clone();
  const mChra = M.chra.clone();

  // 1. Block, Head, Valve Cover, Oil Pan
  const boxGeo = new THREE.BoxGeometry(15, 6, 6.5);
  const block = mesh(boxGeo, mGlass);
  group.add(block);

  const headGeo = new THREE.BoxGeometry(15, 2.5, 6.5);
  const head = mesh(headGeo, mGlass);
  head.position.set(0, 4.25, 0);
  group.add(head);
  head.add(new THREE.LineSegments(new THREE.EdgesGeometry(headGeo), mGlassEdge));

  const coverGeo = new THREE.BoxGeometry(13.6, 1.0, 4.6);
  const cover = mesh(coverGeo, mGlass);
  cover.position.set(0, 6.0, 0);
  group.add(cover);
  cover.add(new THREE.LineSegments(new THREE.EdgesGeometry(coverGeo), mGlassEdge));

  const accentGeo = new THREE.BoxGeometry(12, 0.06, 0.5);
  const accent = mesh(accentGeo, mAccent);
  accent.position.set(0, 6.53, 0);
  group.add(accent);

  const panGeo = new THREE.BoxGeometry(14, 2.0, 5.5);
  const pan = mesh(panGeo, mGlass);
  pan.position.set(0, -4.0, 0);
  group.add(pan);
  pan.add(new THREE.LineSegments(new THREE.EdgesGeometry(panGeo), mGlassEdge));

  // 2. Cylinders
  const cylX = [-5.25, -1.75, 1.75, 5.25];
  const cylinders = [];

  cylX.forEach((x, i) => {
    const cylGroup = new THREE.Group();
    cylGroup.position.x = x;
    group.add(cylGroup);

    // Bore liner
    const linerGeo = new THREE.CylinderGeometry(1.45, 1.45, 4.6, 32, 1, true);
    const liner = mesh(linerGeo, mGlass);
    liner.position.y = 0.7;
    cylGroup.add(liner);

    // Piston
    const pistonGroup = new THREE.Group();
    pistonGroup.position.y = 0.35; 
    cylGroup.add(pistonGroup);

    const pistonBody = mesh(new THREE.CylinderGeometry(1.38, 1.38, 1.2, 32), mAlu);
    pistonBody.position.y = 0.6;
    pistonGroup.add(pistonBody);

    const ringGeo = new THREE.TorusGeometry(1.385, 0.03, 6, 40);
    ringGeo.rotateX(Math.PI / 2);
    const r1 = mesh(ringGeo, mDarkSteel);
    r1.position.y = 0.3 + 0.6;
    pistonGroup.add(r1);
    const r2 = mesh(ringGeo, mDarkSteel);
    r2.position.y = 0.42 + 0.6;
    pistonGroup.add(r2);

    // Connecting Rod
    const rodGeo = new THREE.BoxGeometry(0.42, 1, 0.3);
    const conRod = mesh(rodGeo, mSteel);
    conRod.position.y = 0.5; 
    cylGroup.add(conRod);

    // Flash
    const flashGeo = new THREE.SphereGeometry(1.25, 24, 12);
    const flash = mesh(flashGeo, mFlame.clone());
    flash.scale.set(1, 0.45, 1);
    flash.position.set(0, 2.75 - 0.35, 0);
    cylGroup.add(flash);

    // Valves
    function createValve(mat) {
      const vG = new THREE.Group();
      const stem = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), mat);
      stem.position.y = 0.8;
      const head = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), mat);
      head.position.y = 0;
      vG.add(stem);
      vG.add(head);
      return vG;
    }

    const valveGroupIntake = new THREE.Group();
    valveGroupIntake.position.set(0, 2.9, 0.6);
    cylGroup.add(valveGroupIntake);
    const valveIntake = createValve(mSteel);
    valveGroupIntake.add(valveIntake);

    const valveGroupExhaust = new THREE.Group();
    valveGroupExhaust.position.set(0, 2.9, -0.6);
    cylGroup.add(valveGroupExhaust);
    const valveExhaust = createValve(mSteel);
    valveGroupExhaust.add(valveExhaust);

    cylinders.push({ 
      x, 
      pistonGroup, 
      conRod, 
      flash, 
      valveGroupIntake, 
      valveGroupExhaust, 
      throwAngle: (i === 1 || i === 2) ? Math.PI : 0 
    });
  });

  // 3. Crankshaft
  const crank = new THREE.Group();
  crank.position.y = -2.6;
  group.add(crank);

  const mainJournal = mesh(rod(0.45, -7.2, 7.2), mSteel);
  crank.add(mainJournal);

  cylinders.forEach((cyl, i) => {
    const phi = cyl.throwAngle;
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);

    [ -0.45, 0.45 ].forEach(offsetX => {
      const web = mesh(new THREE.BoxGeometry(0.3, 2.0, 1.4), mSteel);
      web.position.set(cyl.x + offsetX, 0.45 * cosP, 0.45 * sinP);
      web.rotation.x = phi;
      crank.add(web);
    });

    const pin = mesh(rod(0.4, cyl.x - 0.3, cyl.x + 0.3), mSteel);
    pin.position.set(0, 0.9 * cosP, 0.9 * sinP);
    crank.add(pin);
  });

  // 4. Animation API
  group.userData.setCrank = (theta, flashes = []) => {
    crank.rotation.x = theta;

    cylinders.forEach((cyl, i) => {
      const a = theta + cyl.throwAngle;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      
      const crankPin = new THREE.Vector3(cyl.x, -2.6 + 0.9 * cosA, 0.9 * sinA);
      const pistonPinY = -2.6 + 0.9 * cosA + Math.sqrt(Math.pow(2.9, 2) - Math.pow(0.9 * sinA, 2));
      const pistonPin = new THREE.Vector3(cyl.x, pistonPinY, 0);

      // Piston
      cyl.pistonGroup.position.y = pistonPinY + 0.35;

      // Rod
      const rodMid = new THREE.Vector3().addVectors(crankPin, pistonPin).multiplyScalar(0.5);
      cyl.conRod.position.set(0, rodMid.y, rodMid.z); 
      const dist = crankPin.distanceTo(pistonPin);
      cyl.conRod.scale.set(1, dist, 1);
      const d = pistonPin.clone().sub(crankPin);
      cyl.conRod.rotation.set(Math.atan2(d.z, d.y), 0, 0);

      // Flash
      const f = flashes[i] ?? 0;
      cyl.flash.material.opacity = f * 0.9;
      cyl.flash.scale.set(1 + f * 0.2, 0.45 * (1 + f * 0.2), 1 + f * 0.2);

      // Valves
      const cycleAngle = (theta + cyl.throwAngle + (i === 1 || i === 3 ? 2 * Math.PI : 0)) % (4 * Math.PI);
      const exhaustOpen = (cycleAngle >= 3 * Math.PI && cycleAngle < 4 * Math.PI);
      const intakeOpen = (cycleAngle >= 0 && cycleAngle < Math.PI);

      cyl.valveGroupExhaust.position.y = 2.9 - (exhaustOpen ? 0.25 : 0);
      cyl.valveGroupIntake.position.y = 2.9 - (intakeOpen ? 0.25 : 0);
    });
  };

  // 5. Ports
  group.userData.ports = {
    intake: cylX.map(x => V3(x, 4.0, 3.25)),
    exhaust: cylX.map(x => V3(x, 4.0, -3.25))
  };

  // 6. Anchors
  group.userData.anchors = {
    block: V3(0, 3.0, 3.25),
    crank: V3(0, -2.6, 0.5)
  };

  group.userData.setCrank(0, [0, 0, 0, 0]);

  return group;
}
