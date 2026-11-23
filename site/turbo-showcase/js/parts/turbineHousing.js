import * as THREE from 'three';
import { TAU, V3, lathe, volute, rod, rodBetween, mesh, merge } from '../geo.js';

export function buildTurbineHousing(M) {
  const group = new THREE.Group();

  // 1. Shroud + outlet
  const shroudProfile = [
    [0.3, 4.4],
    [0.45, 3.5],
    [1.1, 3.5]
  ];
  for (let w = 0; w <= 8; w++) {
    const fw = w / 8;
    const fx = 1.1 + 2.1 * fw;
    const fr = 3.5 - 0.5 * Math.pow(fw, 1.5);
    shroudProfile.push([fx, fr]);
  }
  shroudProfile.push([3.2, 3.0]); // end of curve
  shroudProfile.push([4.7, 3.0]); // bore
  shroudProfile.push([4.7, 4.25]); // flange face
  shroudProfile.push([4.4, 4.25]);
  shroudProfile.push([4.25, 3.45]);
  shroudProfile.push([2.6, 3.45]);
  shroudProfile.push([1.7, 4.4]);
  shroudProfile.push([0.3, 4.4]); // close

  const shroudGeo = lathe(shroudProfile, { segs: 96 });
  group.add(mesh(shroudGeo, M.iron));

  // 2. Mating flange
  const flangeProfile = [[0, 3.5], [0.3, 3.5], [0.3, 4.9], [0, 4.9], [0, 3.5]];
  const flangeGeo = lathe(flangeProfile, { segs: 96 });
  group.add(mesh(flangeGeo, M.steel));

  // 3. Volute
  const v = volute({
    x: 1.0,
    rc0: 4.55,
    rc1: 5.6,
    tr0: 0.45,
    tr1: 1.75,
    th0: -Math.PI / 2 - TAU + 0.4,
    th1: -Math.PI / 2,
    dir: 1,
    outLen: 3.6,
    outR: 1.45
  });
  group.add(mesh(v.geo, M.iron));

  // Web
  const webProfile = [
    [0.3, 4.4],
    [0.3, 5.0],
    [1.9, 5.0],
    [1.7, 4.4],
    [0.3, 4.4]
  ];
  const webGeo = lathe(webProfile, { segs: 48 });
  group.add(mesh(webGeo, M.iron));

  // 4. Inlet flange
  const inletGroup = new THREE.Group();
  inletGroup.position.copy(v.end.p);
  inletGroup.quaternion.setFromUnitVectors(V3(0, -1, 0), v.end.t.clone().normalize());
  
  // T4-style flange: rounded plate with a port and four stud holes, a thin gasket below it
  const flangeShape = (w, d, rc, holes) => {
    const s = new THREE.Shape(), x = w / 2, z = d / 2;
    s.moveTo(-x + rc, -z); s.lineTo(x - rc, -z); s.quadraticCurveTo(x, -z, x, -z + rc);
    s.lineTo(x, z - rc); s.quadraticCurveTo(x, z, x - rc, z); s.lineTo(-x + rc, z);
    s.quadraticCurveTo(-x, z, -x, z - rc); s.lineTo(-x, -z + rc); s.quadraticCurveTo(-x, -z, -x + rc, -z);
    const port = new THREE.Path(); port.absellipse(0, 0, 1.15, 0.95, 0, Math.PI * 2, true); s.holes.push(port);
    if (holes) [[1.55, 1.25], [1.55, -1.25], [-1.55, 1.25], [-1.55, -1.25]].forEach(([a, b]) => {
      const h = new THREE.Path(); h.absarc(a, b, 0.2, 0, Math.PI * 2, true); s.holes.push(h);
    });
    return s;
  };
  const plateGeo = new THREE.ExtrudeGeometry(flangeShape(3.9, 3.3, 0.55, true),
    { depth: 0.4, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 16 });
  plateGeo.rotateX(-Math.PI / 2);          // shape XY → XZ, extrude along +Y
  inletGroup.add(mesh(plateGeo, M.iron));

  const gasketGeo = new THREE.ExtrudeGeometry(flangeShape(3.8, 3.2, 0.5, true), { depth: 0.035, bevelEnabled: false, curveSegments: 16 });
  gasketGeo.rotateX(-Math.PI / 2);
  gasketGeo.translate(0, -0.045, 0);
  inletGroup.add(mesh(gasketGeo, M.gasket));

  const studPos = [[1.55, 1.25], [1.55, -1.25], [-1.55, 1.25], [-1.55, -1.25]];
  studPos.forEach(([sx, sz]) => {
    const s = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 16), M.steel);
    s.position.set(sx, -0.2, sz);
    inletGroup.add(s);

    const nut = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 6), M.darkSteel);
    nut.position.set(sx, -0.11, sz);
    inletGroup.add(nut);
  });
  group.add(inletGroup);

  // 5. Wastegate
  const pivotPos = V3(3.6, -1.0, -3.2);
  const bossGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.3, 20);
  const boss = mesh(bossGeo, M.iron);
  boss.position.copy(pivotPos);
  group.add(boss);

  const armGroup = new THREE.Group();
  armGroup.position.copy(pivotPos);
  const armRodGeo = rodBetween(V3(0, -0.2, 0), V3(0, -0.5, -3.4), 0.18);
  armGroup.add(mesh(armRodGeo, M.steel));

  const pinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12);
  const pin = mesh(pinGeo, M.steel);
  pin.position.set(0, -0.5, -3.4);
  armGroup.add(pin);

  group.add(armGroup);
  group.userData.wgArm = armGroup;

  // Anchors
  const p_at = (x, r, psi) => V3(x, r * Math.cos(psi), r * Math.sin(psi));
  const v_p_07 = v.path(0.7).p;
  const v_r_07 = v.path(0.7).r;
  const psi_07 = Math.atan2(v_p_07.z, v_p_07.y);
  const radialDir = V3(0, Math.cos(psi_07), Math.sin(psi_07));

  group.userData.anchors = {
    volute: v_p_07.clone().add(radialDir.multiplyScalar(v_r_07)),
    inlet: v.end.p.clone().add(V3(1.95, 0, 0)),
    outlet: p_at(4.6, 4.25, 0.8),
    shroud: p_at(2.0, 3.7, 2.6),
    wastegate: V3(3.6, -1.0, -3.65)
  };

  return group;
}
