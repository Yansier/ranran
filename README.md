# Ranran's Fantasy Meadow

一个以虚拟偶像「嘉然」为主角的浏览器 3D 童话草原。项目采用动漫风格的柔和 Toon Shading，让嘉然在花草与遗迹之间追逐一只发光的魔法蝴蝶。

当前版本为 **Phase 1.5 — First Look**。角色与环境均为真正的 Three.js 三维几何体，可使用鼠标或触摸从任意方向观察。

## 技术栈

- Vite
- JavaScript（ES Modules）
- Three.js
- OrbitControls
- GLTFLoader（为后续 GLB 角色替换预留）
- Playwright（本地视觉验收截图）

本阶段未使用 Blender。嘉然模型由 Three.js 在运行时程序化生成。

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
├─ artifacts/screenshots/        # Phase 1.5 验收截图
├─ scripts/
│  └─ capture-screenshots.mjs    # Playwright 五视图截图脚本
├─ src/
│  ├─ character/
│  │  ├─ createRanran.js         # 嘉然模型、姿态、服装与 GLB 入口
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

- 头部、身体和鞋子采用平滑椭球与胶囊几何体；
- 头发使用沿 Catmull-Rom 曲线生成的渐细截面网格，不是二维贴片；
- 面部眼睛、虹膜、鼻子与嘴巴均有独立的三维结构；
- 上衣、背带短裤、交叉系带、蝴蝶结、袜子、运动鞋、背包和心形腰包分层建模；
- 手臂与腿沿多点曲线生成，以维持追逐蝴蝶的前倾动作；
- 材质使用柔和的 `MeshToonMaterial` 色阶贴图。

模型没有骨骼动画，仅有幅度很小的呼吸和头部摆动。角色模块不依赖草地或场景代码，可以单独升级。

## 替换为 GLB 角色

`src/character/createRanran.js` 已提供 `loadRanranGLB(url)`。后续替换流程：

1. 将模型保存为 `public/models/ranran.glb`；
2. 保持模型脚底位于局部坐标原点，并面向场景的 `+Z` 方向；
3. 在 `src/main.js` 中改为导入 `loadRanranGLB`；
4. 使用顶层 `await loadRanranGLB('/models/ranran.glb')` 替代 `createProceduralRanran()`；
5. 继续把返回的 `THREE.Group` 添加到场景，不需要修改草地、灯光或摄像机模块；
6. 若 GLB 包含骨骼动画，可在人物模块内部创建 `AnimationMixer`，并继续通过 `userData.update` 接入现有渲染循环。

## 开发检查

```bash
npm run build
npm run qa:screenshots
```

验收镜头通过开发 API `window.__RANRAN_MEADOW__.setCameraPreset()` 固定，截图前会关闭自动巡游，保证多次运行结果稳定。

