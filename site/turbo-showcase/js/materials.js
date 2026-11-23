// Shared materials. Every material is DoubleSide so open shells and the
// cutaway (clipping plane) both render correctly.

import * as THREE from 'three';
import { castMetalTexture, brushedMetalTexture, radialMachinedTexture, wrinkleCoatTexture, braidedHoseTexture } from './textures.js';

export function makeMaterials() {
  const cast = castMetalTexture(101, 1, [3, 3]);
  const castIron = castMetalTexture(707, 1.4, [4, 4]);
  const brushed = brushedMetalTexture(202, [2, 2]);
  const radial = radialMachinedTexture(303);
  const wrinkle = wrinkleCoatTexture(404, [5, 5]);
  const braid = braidedHoseTexture([24, 2]);
  const D = THREE.DoubleSide;
  const std = o => new THREE.MeshStandardMaterial({ side: D, ...o });
  const phys = o => new THREE.MeshPhysicalMaterial({ side: D, ...o });

  return {
    // compressor housing: sand-cast aluminium, satin
    castAlu: std({ color: 0xb9bec4, metalness: 0.85, roughness: 0.52, bumpMap: cast, bumpScale: 0.02 }),
    // machined faces and bores
    alu: phys({ color: 0xd9dde2, metalness: 1, roughness: 0.22, roughnessMap: brushed, clearcoat: 0.2 }),
    // billet compressor wheel: bright, slightly anodised
    billet: phys({ color: 0xf0f2f5, metalness: 1, roughness: 0.3, roughnessMap: radial, clearcoat: 0.5, clearcoatRoughness: 0.1 }),
    // turbine housing: cast iron with heat staining
    iron: std({ color: 0x6a6360, metalness: 0.65, roughness: 0.7, bumpMap: castIron, bumpScale: 0.03 }),
    // turbine wheel: Inconel, dull with a blue/straw heat tint
    inconel: phys({ color: 0x8a8578, metalness: 1, roughness: 0.42, sheen: 0.4, sheenColor: new THREE.Color(0x5a6bb0), sheenRoughness: 0.5 }),
    // centre housing: cast iron, machined grey
    chra: std({ color: 0x6d7074, metalness: 0.8, roughness: 0.46, bumpMap: cast, bumpScale: 0.015 }),
    // shaft, bolts, clamps
    steel: phys({ color: 0xc6c9cc, metalness: 1, roughness: 0.28, clearcoat: 0.1 }),
    darkSteel: std({ color: 0x303338, metalness: 0.9, roughness: 0.35 }),
    // bearing balls / races
    chrome: phys({ color: 0xf2f4f6, metalness: 1, roughness: 0.06 }),
    // bronze / brass parts (thrust collar, banjo fittings)
    brass: phys({ color: 0xc89b52, metalness: 1, roughness: 0.3 }),
    // wastegate actuator canister: wrinkle black paint
    paint: std({ color: 0x15171a, metalness: 0.2, roughness: 0.62, bumpMap: wrinkle, bumpScale: 0.016 }),
    // accent paint (actuator band, logo plate)
    accent: phys({ color: 0x1fb3ff, metalness: 0.5, roughness: 0.35, clearcoat: 0.6 }),
    // rubber / hose
    rubber: std({ color: 0x111214, metalness: 0, roughness: 0.85 }),
    braid: std({ color: 0x9da3aa, metalness: 0.9, roughness: 0.45, map: braid, bumpMap: braid, bumpScale: 0.02 }),
    // copper gasket
    gasket: std({ color: 0x8a5a3a, metalness: 0.9, roughness: 0.4 }),
    // x-ray glass for the engine schematic in the "how it works" view
    glass: phys({ color: 0x9fd4ff, metalness: 0, roughness: 0.15, transparent: true, opacity: 0.12, depthWrite: false }),
    glassEdge: new THREE.LineBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0.35 }),
    // combustion flash (additive, opacity animated)
    flame: new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}
