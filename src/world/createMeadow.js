import * as THREE from 'three';
import { toon } from '../character/materials.js';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function terrainHeight(x, z) {
  const characterClearing = Math.exp(-(x * x + z * z) * 0.32);
  const hills = Math.sin(x * 0.31) * 0.36 + Math.cos(z * 0.27) * 0.28 + Math.sin((x + z) * 0.16) * 0.22;
  return hills * (1 - characterClearing * 0.88) - 0.1;
}

function makeGround() {
  const geometry = new THREE.PlaneGeometry(26, 26, 72, 72);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = [];
  const low = new THREE.Color(0x75a96f);
  const high = new THREE.Color(0xa7c986);
  const rand = seededRandom(3117);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = terrainHeight(x, z);
    position.setY(i, y);
    const mix = THREE.MathUtils.clamp((y + 0.5) * 0.55 + rand() * 0.1, 0, 1);
    const c = low.clone().lerp(high, mix);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshToonMaterial({ vertexColors: true, color: 0xffffff });
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  return ground;
}

function makeGrass() {
  const rand = seededRandom(8304);
  const count = 1100;
  const bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.035, 0, 0, 0.035, 0, 0, 0, 0.38, 0,
    0, 0, -0.035, 0, 0, 0.035, 0, 0.34, 0
  ], 3));
  bladeGeo.setIndex([0, 1, 2, 3, 4, 5]);
  bladeGeo.computeVertexNormals();
  const grass = new THREE.InstancedMesh(bladeGeo, new THREE.MeshToonMaterial({ color: 0x6d9e62, side: THREE.DoubleSide }), count);
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < count; i += 1) {
    const angle = rand() * Math.PI * 2;
    const distance = 1.35 + Math.sqrt(rand()) * 10.8;
    p.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    p.y = terrainHeight(p.x, p.z) + 0.01;
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.12, rand() * Math.PI, (rand() - 0.5) * 0.12));
    const scale = 0.55 + rand() * 1.2;
    s.set(scale * (0.8 + rand() * 0.35), scale, scale);
    matrix.compose(p, q, s);
    grass.setMatrixAt(i, matrix);
  }
  grass.receiveShadow = true;
  grass.frustumCulled = false;
  return grass;
}

function makeFlowers() {
  const rand = seededRandom(9211);
  const colors = [0xffe5ed, 0xf5a2bd, 0xc9b4f2, 0xfff0a6, 0xffffff];
  const groups = new THREE.Group();
  const countPerColor = 28;
  const petalGeo = new THREE.SphereGeometry(0.06, 8, 5);
  const centerGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.28, 5);
  const stems = new THREE.InstancedMesh(stemGeo, toon(0x67995f), colors.length * countPerColor);
  const centers = new THREE.InstancedMesh(centerGeo, toon(0xffd261), colors.length * countPerColor);
  const petals = colors.map((color) => new THREE.InstancedMesh(petalGeo, toon(color), countPerColor * 5));
  const matrix = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let flowerIndex = 0;
  colors.forEach((color, colorIndex) => {
    for (let i = 0; i < countPerColor; i += 1) {
      const angle = rand() * Math.PI * 2;
      const distance = 1.25 + Math.sqrt(rand()) * 8.8;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = terrainHeight(x, z);
      const size = 0.72 + rand() * 0.7;
      p.set(x, y + 0.14 * size, z);
      q.identity();
      scale.set(size, size, size);
      matrix.compose(p, q, scale);
      stems.setMatrixAt(flowerIndex, matrix);
      p.y += 0.14 * size;
      matrix.compose(p, q, scale);
      centers.setMatrixAt(flowerIndex, matrix);
      for (let petal = 0; petal < 5; petal += 1) {
        const a = petal / 5 * Math.PI * 2;
        const petalP = p.clone().add(new THREE.Vector3(Math.cos(a) * 0.085 * size, 0.015, Math.sin(a) * 0.085 * size));
        q.setFromEuler(new THREE.Euler(0, -a, Math.PI / 2.9));
        scale.set(size * 1.35, size * 0.55, size * 0.82);
        matrix.compose(petalP, q, scale);
        petals[colorIndex].setMatrixAt(i * 5 + petal, matrix);
      }
      flowerIndex += 1;
    }
  });
  groups.add(stems, centers, ...petals);
  return groups;
}

function makeRocksAndRuins() {
  const group = new THREE.Group();
  const stone = toon(0xa7a696);
  const moss = toon(0x72956c);
  const rand = seededRandom(221);
  for (let i = 0; i < 12; i += 1) {
    const angle = rand() * Math.PI * 2;
    const distance = 5 + rand() * 6;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + rand() * 0.55, 1), stone);
    rock.position.set(Math.cos(angle) * distance, -0.1, Math.sin(angle) * distance);
    rock.position.y = terrainHeight(rock.position.x, rock.position.z) + 0.12;
    rock.scale.set(1, 0.55 + rand() * 0.75, 0.75 + rand() * 0.6);
    rock.rotation.set(rand(), rand(), rand());
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  const ruins = new THREE.Group();
  ruins.position.set(-5.8, terrainHeight(-5.8, -4.8), -4.8);
  ruins.rotation.y = -0.35;
  for (const x of [-1.15, 1.15]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.42, 2.8, 8), stone);
    column.position.set(x, 1.3, 0);
    column.castShadow = true;
    ruins.add(column);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.42, 0.18, 8), stone);
    cap.position.set(x, 2.72, 0);
    ruins.add(cap);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.25, 8, 20, Math.PI), stone);
  arch.position.set(0, 2.62, 0);
  arch.rotation.z = 0;
  ruins.add(arch);
  const mossPatch = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 6), moss);
  mossPatch.position.set(-1.22, 2.35, 0.22);
  mossPatch.scale.set(1.2, 0.25, 0.8);
  ruins.add(mossPatch);
  group.add(ruins);
  return group;
}

export function createMeadow() {
  const meadow = new THREE.Group();
  meadow.name = 'FantasyMeadow';
  meadow.add(makeGround(), makeGrass(), makeFlowers(), makeRocksAndRuins());
  return meadow;
}

export { terrainHeight };
