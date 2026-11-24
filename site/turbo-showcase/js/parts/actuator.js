import * as THREE from 'three';
import { V3, lathe, rod, rodBetween, merge, mesh, sweep, TAU } from '../geo.js?v=4';

export function buildActuator(M) {
  const group = new THREE.Group();

  // 1. Canister cups
  const canisterProfile = [
    [-1.0, 0], [-1.0, 1.15], [-0.85, 1.35], [-0.08, 1.38], 
    [0.08, 1.38], [0.75, 1.35], [0.95, 1.05], [1.0, 0.4], [1.0, 0], [-1.0, 0]
  ];
  const canisterGeo = lathe(canisterProfile, { segs: 48 });
  group.add(mesh(canisterGeo, M.paint));

  // Crimp lip
  const crimpProfile = [
    [-0.09, 1.36], [-0.09, 1.52], [0.09, 1.52], [0.09, 1.36], [-0.09, 1.36]
  ];
  const crimpGeo = lathe(crimpProfile, { segs: 24 });
  group.add(mesh(crimpGeo, M.steel));

  // 2. Accent band
  const accentProfile = [
    [-0.6, 1.35], [-0.6, 1.37], [-0.25, 1.37], [-0.25, 1.35], [-0.6, 1.35]
  ];
  const accentGeo = lathe(accentProfile, { segs: 24 });
  group.add(mesh(accentGeo, M.accent));

  // 3. Boost signal nipple
  const nippleGeo = rod(0.14, -1.6, -1.0);
  group.add(mesh(nippleGeo, M.brass));

  const barbProfile = [
    [-1.5, 0.14], [-1.5, 0.19], [-1.4, 0.19], [-1.4, 0.14], [-1.5, 0.14]
  ];
  const barbGeo = lathe(barbProfile, { segs: 24 });
  group.add(mesh(barbGeo, M.brass));

  // Hose
  const curve = new THREE.CatmullRomCurve3([
    V3(-1.55, 0, 0),
    V3(-2.1, 0, 0),
    V3(-2.5, 0.6, 0.6),
    V3(-2.4, 1.6, 1.8)
  ]);
  const hoseGeo = sweep(t => ({ p: curve.getPoint(t), r: 0.2 }), { nt: 48, nr: 16 });
  group.add(mesh(hoseGeo, M.rubber));

  // 4. Bracket
  const bracketGroup = new THREE.Group();
  const plateGeo = new THREE.BoxGeometry(0.25, 1.8, 2.0);
  const plate = mesh(plateGeo, M.steel);
  plate.position.set(1.15, 0, 0);
  bracketGroup.add(plate);

  const stripGeo = new THREE.BoxGeometry(0.25, 0.6, 1.6);
  const strip = mesh(stripGeo, M.steel);
  strip.position.set(1.15, 0, 1.4);
  bracketGroup.add(strip);

  const nutGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 6);
  nutGeo.rotateZ(-Math.PI / 2);
  const nut1 = mesh(nutGeo, M.steel);
  nut1.position.set(1.35, 0.55, 0);
  bracketGroup.add(nut1);
  const nut2 = mesh(nutGeo, M.steel);
  nut2.position.set(1.35, -0.55, 0);
  bracketGroup.add(nut2);
  group.add(bracketGroup);

  // 5. Rod sub-group
  const rodGroup = new THREE.Group();
  const rodGeo = rodBetween(V3(1.0, 0, 0), V3(9.3, 0, 3.0), 0.13);
  rodGroup.add(mesh(rodGeo, M.steel));

  const jamNutGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 6);
  jamNutGeo.rotateZ(-Math.PI / 2);
  const jamNut = mesh(jamNutGeo, M.steel);
  const rodDir = V3(9.3, 0, 3.0).sub(V3(1.0, 0, 0)).normalize();
  jamNut.position.set(2.2, 0, 0.39);
  jamNut.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), rodDir);
  rodGroup.add(jamNut);

  const eyeGeo = new THREE.TorusGeometry(0.22, 0.08, 10, 20);
  eyeGeo.rotateX(Math.PI / 2);
  const eye = mesh(eyeGeo, M.steel);
  eye.position.set(9.3, 0, 3.0);
  rodGroup.add(eye);
  
  group.add(rodGroup);
  group.userData.rod = rodGroup;

  // Anchors
  group.userData.anchors = {
    canister: V3(0, 1.0, 0.9),
    rod: V3(5.2, 0.13, 1.6),
    nipple: V3(-1.5, 0.15, 0)
  };

  return group;
}
