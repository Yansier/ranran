import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createProceduralRanran } from './createRanran.js';

const TARGET_CHARACTER_HEIGHT = 4.7;

function disposeObject(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function prepareImportedScene(root) {
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let boneCount = 0;
  let morphTargetCount = 0;
  const materialNames = new Set();

  root.traverse((object) => {
    if (object.isBone) boneCount += 1;
    if (!object.isMesh) return;
    meshCount += 1;
    if (object.isSkinnedMesh) skinnedMeshCount += 1;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    morphTargetCount = Math.max(morphTargetCount, object.morphTargetInfluences?.length ?? 0);

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      materialNames.add(material.name);
      material.shadowSide = THREE.DoubleSide;
      if (material.isMeshStandardMaterial) {
        material.metalness = 0;
        material.roughness = Math.max(material.roughness, 0.78);
        // MMD's toon materials contain a bright ambient term. A small amount
        // of texture-backed emissive light restores that look without a custom
        // shader and prevents the meadow's green ground light tinting the face.
        if (material.map) {
          material.emissive.set(0xffffff);
          material.emissiveMap = material.map;
          material.emissiveIntensity = /脸|体|眼|目|cheek/i.test(material.name) ? 0.2 : 0.1;
        }
      }
      if (material.transparent || /发|hair|睫|cheek/i.test(material.name)) {
        material.side = THREE.DoubleSide;
        material.alphaTest = Math.max(material.alphaTest ?? 0, 0.01);
        material.depthWrite = !/cheek/i.test(material.name);
      }
      material.needsUpdate = true;
    }
  });

  root.updateWorldMatrix(true, true);
  const initialBounds = new THREE.Box3().setFromObject(root);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(initialSize.y) || initialSize.y <= 0) {
    throw new Error('GLB 中没有可显示的人物网格。');
  }

  const uniformScale = TARGET_CHARACTER_HEIGHT / initialSize.y;
  root.scale.multiplyScalar(uniformScale);
  root.updateWorldMatrix(true, true);

  const scaledBounds = new THREE.Box3().setFromObject(root);
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
  root.position.x -= scaledCenter.x;
  root.position.y -= scaledBounds.min.y;
  root.position.z -= scaledCenter.z;
  root.updateWorldMatrix(true, true);

  const finalBounds = new THREE.Box3().setFromObject(root);
  const finalSize = finalBounds.getSize(new THREE.Vector3());
  return {
    meshCount,
    skinnedMeshCount,
    boneCount,
    morphTargetCount,
    materialCount: materialNames.size,
    originalHeight: initialSize.y,
    height: finalSize.y,
    uniformScale
  };
}

export function createCharacterManager() {
  const root = new THREE.Group();
  root.name = 'Ranran_CharacterSlot';
  const loader = new GLTFLoader();
  let active = createProceduralRanran();
  let mode = 'procedural';
  let details = { height: new THREE.Box3().setFromObject(active).getSize(new THREE.Vector3()).y };
  root.add(active);

  function replace(next, nextMode, nextDetails) {
    const previous = active;
    root.remove(previous);
    active = next;
    mode = nextMode;
    details = nextDetails;
    root.add(active);
    if (previous.userData.characterSource === 'local-glb') disposeObject(previous);
  }

  async function loadLocalGLB(file) {
    if (!(file instanceof File)) throw new TypeError('请选择一个本地 GLB 文件。');
    if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('当前仅支持包含纹理的 .glb 文件。');
    const url = URL.createObjectURL(file);
    try {
      const gltf = await loader.loadAsync(url);
      const imported = gltf.scene;
      imported.name = 'Ranran_LocalGLB';
      imported.userData.characterSource = 'local-glb';
      const importedDetails = prepareImportedScene(imported);
      importedDetails.fileName = file.name;
      importedDetails.fileBytes = file.size;
      importedDetails.animationCount = gltf.animations.length;
      replace(imported, 'local-glb', importedDetails);
      return { ...importedDetails };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function useProcedural() {
    if (mode === 'procedural') return { ...details };
    const procedural = createProceduralRanran();
    replace(procedural, 'procedural', {
      height: new THREE.Box3().setFromObject(procedural).getSize(new THREE.Vector3()).y
    });
    return { ...details };
  }

  function update(time, motionScale) {
    active.userData.update?.(time, motionScale);
  }

  function measure() {
    active.updateWorldMatrix(true, true);
    const size = new THREE.Box3().setFromObject(active).getSize(new THREE.Vector3());
    return { mode, height: size.y, ...details };
  }

  return {
    root,
    loadLocalGLB,
    useProcedural,
    update,
    measure,
    get active() { return active; },
    get mode() { return mode; }
  };
}
