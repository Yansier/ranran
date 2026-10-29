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

/**
 * Closed anime-style head volume. Unlike a scaled sphere, each latitude has its
 * own width/depth profile: fuller cheeks, a restrained forehead and a tapered
 * jaw. The front half is slightly flatter so textured eyes sit on the face
 * instead of reading as separate eyeballs.
 */
export function animeFace(width, height, depth, material, latitudeSegments = 24, radialSegments = 32) {
  const positions = [];
  const indices = [];

  for (let lat = 0; lat <= latitudeSegments; lat += 1) {
    const v = lat / latitudeSegments;
    const theta = v * Math.PI;
    const yNorm = Math.cos(theta);
    const ring = Math.sin(theta);
    const jawTaper = yNorm < 0 ? 1 - Math.pow(-yNorm, 1.45) * 0.24 : 1;
    const cheek = 1 + Math.exp(-Math.pow((yNorm + 0.28) / 0.3, 2)) * 0.065;
    const forehead = yNorm > 0.55 ? 1 - (yNorm - 0.55) * 0.08 : 1;

    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const u = radial / radialSegments;
      const phi = u * Math.PI * 2;
      const frontness = Math.max(0, Math.sin(phi));
      const frontFlatten = 1 - frontness * 0.07;
      const chinForward = yNorm < -0.48 ? frontness * (-yNorm - 0.48) * 0.055 : 0;
      positions.push(
        Math.cos(phi) * ring * width * jawTaper * cheek * forehead,
        yNorm * height,
        Math.sin(phi) * ring * depth * frontFlatten + chinForward
      );
    }
  }

  const row = radialSegments + 1;
  for (let lat = 0; lat < latitudeSegments; lat += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const a = lat * row + radial;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return smoothMesh(geometry, material);
}

/**
 * Asymmetric scalp surface: the front edge stops at the forehead while the
 * side/back edge extends below the crown. This removes the horizontal helmet
 * rim a uniformly cropped sphere produces across an anime face.
 */
export function hairCap(width, height, depth, material, verticalSegments = 14, radialSegments = 36) {
  const positions = [];
  const indices = [];

  for (let radial = 0; radial <= radialSegments; radial += 1) {
    const u = radial / radialSegments;
    const phi = u * Math.PI * 2;
    const frontness = Math.max(0, Math.sin(phi));
    const sideSoftness = Math.pow(frontness, 1.8);
    const thetaLimit = Math.PI * THREE.MathUtils.lerp(0.66, 0.355, sideSoftness);

    for (let vertical = 0; vertical <= verticalSegments; vertical += 1) {
      const v = vertical / verticalSegments;
      const theta = v * thetaLimit;
      positions.push(
        Math.sin(theta) * Math.cos(phi) * width,
        Math.cos(theta) * height,
        Math.sin(theta) * Math.sin(phi) * depth
      );
    }
  }

  const column = verticalSegments + 1;
  for (let radial = 0; radial < radialSegments; radial += 1) {
    for (let vertical = 0; vertical < verticalSegments; vertical += 1) {
      const a = radial * column + vertical;
      const b = (radial + 1) * column + vertical;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return smoothMesh(geometry, material);
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
