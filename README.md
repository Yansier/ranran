# Ranran's Fantasy Meadow

一个以虚拟偶像「嘉然」为主角的浏览器 3D 童话草原。项目采用动漫风格的柔和 Toon Shading，让嘉然在花草与遗迹之间追逐一只发光的魔法蝴蝶。

当前版本为 **Phase 2B.1 — The Real Ranran**。在保留原有程序化角色的同时，项目已验证 `MMD PMX → Blender → GLB → Three.js` 的本地私有角色工作流。

受模型使用规则约束，PMX、原始纹理、BLEND、GLB 与本地模型截图均不会进入公开仓库或静态构建。浏览器通过 File API 直接读取用户选择的 GLB，文件不会上传，也不需要放入 `public/`。

## 技术栈

- Vite
- JavaScript（ES Modules）
- Three.js
- OrbitControls
- GLTFLoader（本地 GLB 选择、加载和回退）
- Blender 5.2.3 LTS + MMD Tools 4.5.14
- Playwright（本地视觉验收截图）

## 本地运行

```bash
npm install
npm run dev
```

根据终端输出打开 Vite 本地地址，通常为 `http://localhost:5173/`。

生产构建：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

重新生成视觉验收截图（需要本机安装 Google Chrome）：

```bash
npm run qa:screenshots
```

截图输出到 `artifacts/screenshots/`。脚本使用独立的无头 Chrome，不会操作用户现有的浏览器窗口。

## 使用本地 GLB

1. 启动项目后点击底部的「本地 GLB」。
2. 选择 `assets-local/character-export/jiaran-test.glb` 或其他包含纹理的 GLB。
3. 页面只会在解析成功后替换角色；失败时保留程序化角色并显示错误。
4. 点击「程序角色」可随时恢复原角色。

模型会按包围盒进行**统一比例缩放**、水平居中和脚底落地，不改变原本身体比例。透明发片、阴影和 MMD 的柔和环境项会在 Three.js 侧做轻量适配。

本地模型自动验收（默认读取私有测试 GLB，也可传入其他路径）：

```bash
npm run qa:local-model
node scripts/capture-local-model.mjs "D:\\path\\to\\model.glb"
```

输出位于 `artifacts/local-model-qa/threejs/`，该目录已被 Git 忽略。

## 摄像机操作

- 鼠标左键拖动：旋转镜头
- 滚轮：缩放
- 触摸拖动：旋转
- 双指缩放：拉近或拉远
- 「重置视角」：恢复默认三分之四构图
- 「自动巡游」：切换缓慢自动旋转

镜头限制了最小/最大距离和俯仰范围，避免穿入地面。系统启用“减少动态效果”时，自动巡游会默认关闭，角色、蝴蝶和萤火虫的持续运动也会降低。

## 目录结构

```text
.
├─ assets-local/                 # 私有模型与派生文件（完全忽略）
├─ artifacts/
│  ├─ screenshots/              # 程序化角色公开 QA
│  └─ local-model-qa/           # 私有模型 QA（忽略）
├─ scripts/
│  ├─ capture-screenshots.mjs
│  └─ capture-local-model.mjs
├─ tools/blender/
│  ├─ import_jiaran.py
│  ├─ render_jiaran_qa.py
│  └─ export_jiaran_glb.py
├─ src/
│  ├─ character/
│  │  ├─ createCharacterManager.js # procedural / local-glb 切换
│  │  ├─ createRanran.js         # 程序化嘉然模型
│  │  ├─ geometry.js             # 曲线、胶囊与定制几何工具
│  │  └─ materials.js            # Toon 材质与角色色板
│  ├─ core/
│  │  ├─ ambientAudio.js         # 程序化草原环境音
│  │  └─ sceneSetup.js           # 渲染器、摄像机与 OrbitControls
│  ├─ effects/
│  │  └─ createMagicButterfly.js # 魔法蝴蝶与萤火虫
│  ├─ world/
│  │  ├─ createLighting.js       # 主光、环境光与轮廓光
│  │  ├─ createMeadow.js         # 地形、实例化草花与遗迹
│  │  └─ createSky.js            # 渐变天空球
│  ├─ main.js                    # 场景装配、循环与 QA 镜头预设
│  └─ styles.css                 # 全屏 UI 与移动端适配
├─ index.html
├─ ranran.png                    # 嘉然三视图参考
├─ README.md
└─ PROGRESS.md
```

## 人物模型实现

嘉然由独立的 `createProceduralRanran()` 工厂创建，场景只依赖它返回的 `THREE.Group`：

- 面部采用自定义封闭 `BufferGeometry`，沿高度分别控制额头、脸颊、下颌和下巴宽度，不再是简单缩放球体；
- 眼睛使用贴合弯曲平面的 `CanvasTexture`，包含眼白、蓝色渐变虹膜、瞳孔、双高光和上眼睑，避免独立眼球突出；
- 头发采用前短后长的非对称头皮曲面，配合沿 Catmull-Rom 曲线生成的分组刘海、侧发与五组重叠后发片；
- 躯干、四肢和鞋子采用平滑椭球、胶囊及渐细曲线几何，比例分别调整而非整体拉伸；
- 上衣、背带短裤、交叉系带、蝴蝶结、袜子、运动鞋、背包和心形腰包分层建模；
- 手臂与腿沿多点曲线生成，以维持追逐蝴蝶的前倾动作；
- 材质使用柔和的 `MeshToonMaterial` 色阶贴图。

模型没有骨骼动画，仅有幅度很小的呼吸和头部摆动。角色模块不依赖草地或场景代码，可以单独升级。

## Blender 私有工作流

以下输出必须留在 `assets-local/`；脚本不会覆盖原始 PMX。

```text
# 1. 导入、检查、保存原始工作副本
blender --background --python tools/blender/import_jiaran.py -- \
  --pmx <JiaRan.pmx> \
  --blend assets-local/character-working/jiaran-original-import.blend \
  --report assets-local/character-working/jiaran-import-report.json

# 2. Blender 正侧背与面部渲染
blender assets-local/character-working/jiaran-original-import.blend --background \
  --python tools/blender/render_jiaran_qa.py -- \
  --output artifacts/local-model-qa/blender

# 3. 在独立副本中转换 glTF 材质并导出 GLB
blender assets-local/character-working/jiaran-original-import.blend --background \
  --python tools/blender/export_jiaran_glb.py -- \
  --blend assets-local/character-working/jiaran-gltf-prep.blend \
  --glb assets-local/character-export/jiaran-test.glb \
  --report assets-local/character-export/jiaran-export-report.json
```

当前实测导入数据：146,387 顶点、264,714 面、17 个角色材质槽、1 个 Armature、583 根 Blender 骨骼、31 个导入 Shape Key（不含 Basis）及 19 张已解析图像，缺失纹理为 0。MMD 物理辅助对象不会进入 GLB。

## 资产边界

`.gitignore` 明确排除整个 `assets-local/` 和 `artifacts/local-model-qa/`。不要把受限 PMX、纹理、BLEND、GLB 或可还原模型的数据复制到 `public/`、提交到 GitHub 或用于商业发布。仓库只保留转换脚本、加载代码、工具配置和不包含模型数据的文档。

## 开发检查

```bash
npm run build
npm run qa:screenshots
npm run qa:local-model
```

验收镜头通过开发 API `window.__RANRAN_MEADOW__.setCameraPreset()` 固定，截图前会关闭自动巡游，保证多次运行结果稳定。`measureCharacter()` 会输出当前角色模式、包围盒高度与本地 GLB 的网格/骨骼/Morph 统计。

当前截图保存在 `artifacts/screenshots/`，其中包含额外的 `character-face-closeup.png`。Phase 1.5 的原始五张截图保存在 `artifacts/screenshots/baseline-phase1.5/`，不会被 QA 脚本覆盖。

