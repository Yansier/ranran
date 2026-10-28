import * as THREE from 'three';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function smoothMesh(geometry, material, { cast = true, receive = false } = {}) {
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

export function capsuleBetween(start, end, radius, material, radial = 12) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 6, radial);
  const mesh = smoothMesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  return mesh;
}

export function taperedCurve(points, radius, material, taper = 0.15, elliptical = 1) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const segments = Math.max(14, points.length * 8);
  const radial = 10;
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const center = curve.getPointAt(u);
    const profile = THREE.MathUtils.lerp(1, taper, Math.pow(u, 1.7));
    const swell = 0.9 + Math.sin(Math.PI * u) * 0.12;
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle) * radius * profile * swell * elliptical);
      const binormal = frames.binormals[i].clone().multiplyScalar(Math.sin(angle) * radius * profile * swell);
      const p = center.clone().add(normal).add(binormal);
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + (j + 1) % radial;
      const c = (i + 1) * radial + (j + 1) % radial;
      const d = (i + 1) * radial + j;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return smoothMesh(geometry, material);
}

export function ellipsoid(scale, material, segments = 24) {
  const mesh = smoothMesh(new THREE.SphereGeometry(1, segments, Math.max(12, segments / 2)), material);
  mesh.scale.copy(scale);
  return mesh;
}

export function heartShape(size, depth, material) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.45);
  shape.bezierCurveTo(-0.12, -0.28, -0.52, -0.05, -0.52, 0.23);
  shape.bezierCurveTo(-0.52, 0.55, -0.12, 0.62, 0, 0.37);
  shape.bezierCurveTo(0.12, 0.62, 0.52, 0.55, 0.52, 0.23);
  shape.bezierCurveTo(0.52, -0.05, 0.12, -0.28, 0, -0.45);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.04, bevelThickness: 0.03, curveSegments: 12 });
  geometry.center();
  const mesh = smoothMesh(geometry, material);
  mesh.scale.setScalar(size);
  return mesh;
}

export function curveLine(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return smoothMesh(new THREE.TubeGeometry(curve, 24, radius, 7, false), material);
}
