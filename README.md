# 🧵 一个关于绳子的小游戏 (Rope Game - 国风刺绣解绳子 3D)

一款高保真还原国风刺绣工艺的 3D 解谜益智 Web 游戏。玩家通过拖拽绣绷边缘的固定绣针，解开错综交织的彩色丝线。丝线理顺后将触发金粉粒子与华丽的刺绣图案显形特效。

---

## ✨ 游戏核心特性

- **🧵 高拟真 XPBD 物理模拟**
  - 基于 **XPBD (Extended Position Based Dynamics)** 算法的实时丝线弹性模拟。
  - 支持丝线拉伸（Distance Constraint）、抗弯曲（Bending Constraint）、线段间胶囊体防穿透与自碰撞检测。
  - 拟真绳索阻尼与柔软丝线重力悬垂感，拖拽手感细腻丝滑。

- **🎨 纯正国风刺绣视觉与动效**
  - **木质绣绷与布纹材质**：高精度程序化生成棉麻布面粗糙度与木质环形绣绷。
  - **刺绣图案逐步揭示**：每解开一条对应颜色的丝线，绣绷中央的古风纹样即从素雅线稿渐变幻化为绚丽刺绣针脚。
  - **绚丽 VFX 粒子特效**：解开丝线瞬间的流光环与飞舞金粉粒子、通关胜利花瓣雨。

- **🎵 沉浸式国风雅韵音效**
  - 内置清雅古筝笛萧背景音乐与解线穿针音效。
  - 支持音频一键静音/开启切换，并带有平滑淡入淡出。

- **📱 全端自适应与丝滑交互**
  - 完美适配手机竖屏触控与 PC 桌面端鼠标操作。
  - 自动吸附与孔位高亮反馈，防止误操作。
  - 60 FPS 流畅物理与渲染帧率。

---

## 🏗️ 项目架构

```
embroidery-untangle-game/
├── index.html                   # 游戏主页面 HTML
├── package.json                 # 项目依赖配置
├── tsconfig.json                # TypeScript 配置
├── public/                      # 静态资源
│   ├── board_bg.png             # 绣绷背景与底图
│   ├── companion_girl.png       # 伴玩角色切图
│   ├── finger_cursor.png        # 拟真手指指针
│   ├── bgm.mp3                  # 游戏背景音乐
│   └── motifs/                  # 11 组刺绣线稿与真绣纹理图样
├── src/                         # 游戏核心源码
│   ├── main.ts                  # 游戏启动入口与主循环
│   ├── style.css                # 页面样式与自适应布局
│   ├── core/xpbd/               # XPBD 物理引擎
│   │   ├── Particle.ts          # 质点模型
│   │   ├── Rope.ts              # 绳索质点链与段管理
│   │   ├── RopeSolver.ts        # 约束迭代求解器
│   │   ├── DistanceConstraint.ts# 距离保持约束
│   │   ├── BendingConstraint.ts # 抗弯曲刚度约束
│   │   └── SegmentCollision.ts  # 线段胶囊体防自穿透
│   ├── game/                    # 玩法逻辑
│   │   ├── InteractionManager.ts# 拖拽、射线检测与孔位吸附
│   │   ├── LevelConfig.ts       # 关卡孔位、绳索拓扑配置
│   │   ├── SoundManager.ts      # Web Audio 音效管理器
│   │   ├── TopologyDetector.ts  # 2D/3D 线段交叉拓扑检测
│   │   └── EmbroideryEffect.ts  # 刺绣揭示与通关粒子特效
│   └── render/                  # 3D 渲染表现层
│       ├── EmbroideryBoard.ts   # 绣绷与背景板网格
│       ├── PinMesh.ts           # 绣针 3D 建模与材质
│       ├── RopeRenderer.ts      # 丝线 TubeGeometry 动态网格构建
│       └── TextureGenerator.ts  # 程序化生成丝线编织法线/高光贴图
└── scripts/                     # 辅助工具与自动化测试
    ├── generate_all_motif_textures.py # 刺绣贴图生成处理脚本
    └── test_complete_all_6_ropes.js   # 自动化玩法与全解开测试
```

---

## 🚀 快速上手

### 1. 安装依赖

确保本地已安装 [Node.js](https://nodejs.org/) (推荐 Node 18+ 或 20+)。

```bash
npm install
```

### 2. 本地开发运行

启动 Vite 实时热重载开发服务器：

```bash
npm run dev
```

启动后在浏览器打开终端中输出的地址（默认 `http://localhost:5173/`）即可畅玩。

### 3. 生产环境构建

构建打包经过代码压缩和优化的静态产物：

```bash
npm run build
```

打包生成的文件位于 `dist/` 目录下，可直接部署至任一静态服务器（GitHub Pages、Vercel、Netlify 或 Nginx）。

### 4. 预览生产构建

```bash
npm run preview
```

---

## 🛠️ 技术栈

- **构建与开发工具**：[Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **3D 引擎与渲染**：[Three.js](https://threejs.org/) (r170) + WebGL
- **物理系统**：自研轻量级 XPBD (Extended Position Based Dynamics) 绳索物理模拟
- **音效系统**：Web Audio API + HTML5 Audio

---

## 📄 授权协议

本项目基于 [MIT License](LICENSE) 开源。
