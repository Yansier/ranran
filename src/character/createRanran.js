import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { palette as m } from './materials.js';
import { capsuleBetween, curveLine, ellipsoid, heartShape, smoothMesh, taperedCurve } from './geometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function add(group, mesh, position, rotation = [0, 0, 0]) {
  mesh.position.copy(position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

function createBow(scale = 1) {
  const bow = new THREE.Group();
  const left = taperedCurve([V(-0.03, 0, 0), V(-0.22, 0.14, 0), V(-0.37, 0.02, 0), V(-0.18, -0.08, 0)], 0.09, m.pinkLight, 0.75, 1.45);
  const right = left.clone();
  right.scale.x = -1;
  bow.add(left, right);
  add(bow, ellipsoid(V(0.105, 0.105, 0.08), m.pink), V(0, 0.015, 0.02));
  add(bow, taperedCurve([V(-0.04, 0, 0), V(-0.17, -0.25, -0.01), V(-0.28, -0.42, 0.02)], 0.07, m.pinkDark, 0.42, 0.75), V(0, -0.02, -0.01), [0, 0, -0.05]);
  add(bow, taperedCurve([V(0.04, 0, 0), V(0.16, -0.24, 0), V(0.28, -0.4, -0.02)], 0.07, m.pinkLight, 0.42, 0.75), V(0, -0.02, -0.01), [0, 0, 0.05]);
  bow.scale.setScalar(scale);
  return bow;
}

function createEye(side) {
  const eye = new THREE.Group();
  const white = ellipsoid(V(0.14, 0.19, 0.045), m.white, 20);
  eye.add(white);
  add(eye, ellipsoid(V(0.09, 0.14, 0.035), m.eyeBlue, 20), V(side * 0.012, -0.012, 0.045));
  add(eye, ellipsoid(V(0.045, 0.092, 0.028), m.eyeDark, 18), V(side * 0.012, -0.014, 0.076));
  add(eye, ellipsoid(V(0.019, 0.033, 0.012), m.white, 12), V(-0.017, 0.042, 0.102));
  const upper = curveLine([V(-0.13, 0.09, 0.04), V(0, 0.145, 0.07), V(0.13, 0.07, 0.04)], 0.012, m.hairDark);
  eye.add(upper);
  return eye;
}

function createFace() {
  const face = new THREE.Group();
  const head = ellipsoid(V(0.52, 0.58, 0.46), m.skin, 32);
  head.castShadow = true;
  face.add(head);

  add(face, createEye(-1), V(-0.205, 0.06, 0.405), [0, -0.05, 0]);
  add(face, createEye(1), V(0.205, 0.06, 0.405), [0, 0.05, 0]);

  add(face, ellipsoid(V(0.025, 0.018, 0.018), m.skinShade, 12), V(0.006, -0.075, 0.472));
  const mouth = curveLine([V(-0.055, -0.16, 0.461), V(0, -0.183, 0.477), V(0.062, -0.145, 0.458)], 0.008, m.pinkDark);
  face.add(mouth);

  for (const side of [-1, 1]) {
    const blush = ellipsoid(V(0.105, 0.038, 0.012), m.pinkLight, 14);
    blush.material = blush.material.clone();
    blush.material.transparent = true;
    blush.material.opacity = 0.44;
    add(face, blush, V(side * 0.34, -0.1, 0.42), [0, side * 0.2, 0]);
  }
  return face;
}

function createHair() {
  const hair = new THREE.Group();
  const cap = ellipsoid(V(0.57, 0.61, 0.49), m.hair, 32);
  cap.position.set(0, 0.14, -0.03);
  hair.add(cap);

  const backStrands = [
    { x: -0.4, z: -0.16, dx: -0.13, len: 1.55, r: 0.18 },
    { x: -0.2, z: -0.34, dx: -0.08, len: 1.72, r: 0.2 },
    { x: 0.02, z: -0.42, dx: 0.05, len: 1.75, r: 0.22 },
    { x: 0.24, z: -0.35, dx: 0.11, len: 1.66, r: 0.2 },
    { x: 0.43, z: -0.17, dx: 0.18, len: 1.5, r: 0.18 }
  ];
  for (const s of backStrands) {
    const strand = taperedCurve([
      V(s.x * 0.78, 0.24, s.z),
      V(s.x, -0.24, s.z - 0.04),
      V(s.x + s.dx * 0.4, -0.78, s.z + 0.04),
      V(s.x + s.dx, -s.len, s.z + 0.14)
    ], s.r, Math.abs(s.x) > 0.3 ? m.hairLight : m.hair, 0.12, 1.25);
    hair.add(strand);
  }

  // Framing sidelocks reproduce the soft, curled silhouette from the reference.
  for (const side of [-1, 1]) {
    hair.add(taperedCurve([
      V(side * 0.43, 0.16, 0.13),
      V(side * 0.55, -0.2, 0.2),
      V(side * 0.48, -0.62, 0.26),
      V(side * 0.62, -0.98, 0.14)
    ], 0.14, m.hairLight, 0.12, 1.15));
  }

  // Five irregular bangs overlap the cap rather than forming a helmet edge.
  const bangs = [
    [-0.36, -0.23, -0.32], [-0.18, -0.08, -0.14], [0.01, 0.04, 0.03], [0.2, 0.09, 0.19], [0.38, 0.2, 0.33]
  ];
  bangs.forEach(([start, mid, end], i) => {
    hair.add(taperedCurve([
      V(start, 0.48 - Math.abs(start) * 0.12, 0.37),
      V(mid, 0.26, 0.49),
      V(end, 0.035 - Math.abs(start) * 0.08, 0.47)
    ], i === 2 ? 0.09 : 0.082, i % 2 ? m.hair : m.hairLight, 0.06, 1.2));
  });

  // Ahoge: a single curved tapered strand.
  hair.add(taperedCurve([V(-0.04, 0.66, -0.02), V(-0.09, 0.92, -0.02), V(0.08, 1.06, 0.02), V(0.17, 0.91, 0.04)], 0.055, m.hair, 0.04, 0.7));

  const bowL = createBow(0.7);
  bowL.position.set(-0.54, 0.2, -0.08);
  bowL.rotation.set(0, -0.6, -0.15);
  hair.add(bowL);
  const bowR = createBow(0.7);
  bowR.position.set(0.54, 0.2, -0.08);
  bowR.rotation.set(0, 0.6, 0.15);
  hair.add(bowR);

  const clip = heartShape(0.16, 0.07, m.lavender);
  clip.position.set(-0.3, 0.27, 0.5);
  clip.rotation.set(0.1, -0.12, -0.25);
  hair.add(clip);
  return hair;
}

function createTorso() {
  const torso = new THREE.Group();
  const shirt = ellipsoid(V(0.43, 0.52, 0.27), m.pinkLight, 24);
  shirt.scale.y = 0.86;
  torso.add(shirt);

  // Scalloped collar and tiny bow.
  for (const side of [-1, 1]) {
    const collar = ellipsoid(V(0.18, 0.08, 0.035), m.white, 16);
    add(torso, collar, V(side * 0.14, 0.34, 0.25), [0.15, 0, side * 0.18]);
  }
  const chestBow = createBow(0.35);
  chestBow.position.set(0, 0.25, 0.31);
  torso.add(chestBow);
  const emblem = heartShape(0.14, 0.025, m.pink, 16);
  emblem.position.set(0, 0.01, 0.287);
  torso.add(emblem);

  // Overall bib, shoulder straps and stitched waist.
  const bib = smoothMesh(new THREE.BoxGeometry(0.51, 0.5, 0.08, 3, 3, 1), m.blackSoft);
  bib.geometry.translate(0, -0.12, 0);
  bib.position.set(0, -0.2, 0.25);
  torso.add(bib);
  for (const side of [-1, 1]) {
    torso.add(curveLine([V(side * 0.29, 0.4, 0.26), V(side * 0.31, 0.05, 0.31), V(side * 0.25, -0.36, 0.31)], 0.045, m.lavender));
    add(torso, ellipsoid(V(0.045, 0.045, 0.02), m.gold, 12), V(side * 0.245, -0.03, 0.335));
  }
  for (let i = -2; i <= 2; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    torso.add(curveLine([V(side * 0.17, -0.17 + i * 0.055, 0.34), V(-side * 0.17, -0.11 + i * 0.055, 0.34)], 0.012, m.pinkLight));
  }
  return torso;
}

function createShorts() {
  const shorts = new THREE.Group();
  const waist = smoothMesh(new THREE.CylinderGeometry(0.39, 0.46, 0.27, 20), m.blackSoft);
  waist.scale.z = 0.7;
  shorts.add(waist);
  for (const side of [-1, 1]) {
    const leg = ellipsoid(V(0.27, 0.34, 0.27), m.black, 20);
    leg.position.set(side * 0.22, -0.24, 0);
    shorts.add(leg);
    const cuff = smoothMesh(new THREE.TorusGeometry(0.245, 0.035, 8, 20, Math.PI * 1.55), m.pink);
    cuff.rotation.set(Math.PI / 2, 0, side > 0 ? 0.22 : -0.22);
    cuff.position.set(side * 0.22, -0.48, 0.02);
    shorts.add(cuff);
  }
  const zipper = curveLine([V(0, 0.05, 0.31), V(0, -0.3, 0.32)], 0.012, m.white);
  shorts.add(zipper);
  const ring = smoothMesh(new THREE.TorusGeometry(0.08, 0.014, 6, 20), m.white);
  ring.position.set(0, -0.05, 0.33);
  shorts.add(ring);
  return shorts;
}

function createArm(start, elbow, wrist, isReaching) {
  const arm = new THREE.Group();
  const direction = new THREE.Vector3().subVectors(elbow, start).normalize();
  const sleeveEnd = start.clone().lerp(elbow, 0.34);
  arm.add(capsuleBetween(start, sleeveEnd, 0.16, m.pinkLight));
  const cuff = ellipsoid(V(0.18, 0.08, 0.18), m.pink, 16);
  cuff.position.copy(sleeveEnd);
  cuff.quaternion.setFromUnitVectors(V(0, 1, 0), direction);
  arm.add(cuff);
  arm.add(taperedCurve([sleeveEnd, elbow, wrist], 0.105, m.skin, 0.86, 0.94));
  const hand = ellipsoid(V(0.098, 0.135, 0.073), m.skin, 18);
  hand.position.copy(wrist);
  hand.rotation.z = isReaching ? -0.45 : 0.3;
  arm.add(hand);
  // A suggestion of fingers keeps the silhouette delicate without a blocky hand.
  for (let i = -1; i <= 1; i += 1) {
    const fingertip = wrist.clone().add(V(i * 0.035, isReaching ? 0.12 : -0.1, 0.01));
    arm.add(capsuleBetween(wrist.clone().add(V(i * 0.03, 0, 0)), fingertip, 0.018, m.skin, 8));
  }
  return arm;
}

function createLeg(hip, knee, ankle, lifted) {
  const leg = new THREE.Group();
  const sockTop = knee.clone().lerp(ankle, 0.36);
  leg.add(taperedCurve([hip, knee, sockTop], 0.16, m.skin, 0.86, 1.02));
  leg.add(taperedCurve([sockTop, ankle], 0.145, m.white, 0.82, 1.0));
  const bandMint = capsuleBetween(sockTop.clone().add(V(0, 0.01, 0)), sockTop.clone().add(V(0, -0.105, 0)), 0.155, m.mint);
  leg.add(bandMint);
  const pinkPos = sockTop.clone().lerp(ankle, 0.24);
  leg.add(capsuleBetween(pinkPos.clone().add(V(0, 0.03, 0)), pinkPos.clone().add(V(0, -0.07, 0)), 0.151, m.pink));

  const shoe = new THREE.Group();
  const base = ellipsoid(V(0.2, 0.14, 0.36), m.white, 22);
  base.position.z = 0.15;
  shoe.add(base);
  add(shoe, ellipsoid(V(0.205, 0.06, 0.35), m.burgundy, 18), V(0, -0.105, 0.15));
  add(shoe, ellipsoid(V(0.13, 0.075, 0.15), m.mint, 16), V(lifted ? -0.055 : 0.055, 0.045, 0.03), [0, 0, 0.25]);
  add(shoe, curveLine([V(-0.11, 0.12, 0.14), V(0, 0.15, 0.24), V(0.11, 0.12, 0.14)], 0.026, m.pink), V(0, 0, 0));
  shoe.position.copy(ankle);
  shoe.rotation.x = lifted ? -0.76 : 0;
  shoe.rotation.z = lifted ? -0.16 : 0.03;
  leg.add(shoe);
  return leg;
}

function createAccessories() {
  const group = new THREE.Group();
  // Pastel backpack visible from side and rear views.
  const bag = ellipsoid(V(0.36, 0.43, 0.2), m.lavender, 20);
  add(group, bag, V(0, 2.31, -0.35), [0.12, 0, 0]);
  add(group, ellipsoid(V(0.27, 0.15, 0.07), m.pinkLight, 16), V(0, 2.2, -0.55));
  for (const side of [-1, 1]) {
    group.add(curveLine([V(side * 0.28, 2.6, -0.28), V(side * 0.36, 2.2, -0.23), V(side * 0.29, 1.84, -0.18)], 0.035, m.lavender));
  }
  // Heart purse at the hip.
  const purse = heartShape(0.25, 0.11, m.pinkLight);
  purse.position.set(0.52, 1.63, 0.17);
  purse.rotation.set(0, 0.25, -0.2);
  group.add(purse);
  group.add(curveLine([V(0.21, 2.1, 0.12), V(0.42, 1.86, 0.19), V(0.52, 1.68, 0.21)], 0.018, m.white));
  return group;
}

export function createProceduralRanran() {
  const character = new THREE.Group();
  character.name = 'Ranran_ProceduralCharacter';

  const hips = new THREE.Group();
  hips.position.set(0, 1.8, 0);
  hips.rotation.set(0.08, -0.08, 0.02);
  const shorts = createShorts();
  hips.add(shorts);
  character.add(hips);

  const torsoRoot = new THREE.Group();
  torsoRoot.position.set(0, 2.37, 0.04);
  torsoRoot.rotation.set(0.12, -0.07, -0.035);
  torsoRoot.add(createTorso());
  character.add(torsoRoot);

  // Neck bridges body and head so the silhouette reads as one sculpted figure.
  character.add(capsuleBetween(V(0, 2.69, 0.07), V(-0.015, 2.86, 0.11), 0.105, m.skin));

  const headRoot = new THREE.Group();
  headRoot.position.set(-0.04, 3.18, 0.15);
  headRoot.rotation.set(-0.06, -0.13, -0.075);
  headRoot.scale.set(0.83, 0.88, 0.86);
  headRoot.add(createFace(), createHair());
  character.add(headRoot);

  character.add(createArm(V(-0.36, 2.58, 0.06), V(-0.64, 2.52, 0.38), V(-0.64, 2.84, 0.83), true));
  character.add(createArm(V(0.36, 2.57, 0.03), V(0.69, 2.34, -0.02), V(0.94, 2.23, 0.17), false));

  character.add(createLeg(V(-0.2, 1.7, 0), V(-0.22, 1.06, 0.03), V(-0.16, 0.36, 0.08), false));
  character.add(createLeg(V(0.2, 1.68, -0.01), V(0.34, 1.18, -0.18), V(0.5, 1.02, -0.63), true));
  character.add(createAccessories());

  // Small bracelets match the colorful bead accessories in the turnaround.
  for (const p of [V(-0.63, 2.67, 0.67), V(0.83, 2.26, 0.1)]) {
    for (let i = 0; i < 6; i += 1) {
      const bead = ellipsoid(V(0.028, 0.028, 0.028), i % 2 ? m.pink : m.lavender, 10);
      bead.position.copy(p).add(V(Math.cos(i / 6 * Math.PI * 2) * 0.1, 0, Math.sin(i / 6 * Math.PI * 2) * 0.1));
      character.add(bead);
    }
  }

  character.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = false;
    }
  });
  character.userData.update = (time, motionScale = 1) => {
    // Almost imperceptible breathing/hair movement keeps the static pose alive.
    torsoRoot.position.y = 2.37 + Math.sin(time * 1.35) * 0.008 * motionScale;
    headRoot.rotation.z = -0.075 + Math.sin(time * 0.75) * 0.008 * motionScale;
  };
  return character;
}

/**
 * Future-proof GLB entry point. Phase 1 uses the procedural sculpt because Blender
 * is unavailable, while keeping the scene completely decoupled from model origin.
 */
export async function loadRanranGLB(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  gltf.scene.name = 'Ranran_GLTFCharacter';
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  return gltf.scene;
}
