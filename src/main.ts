import * as THREE from 'three';
import { Rope } from './core/xpbd/Rope.ts';
import { RopeSolver } from './core/xpbd/RopeSolver.ts';
import { RopeRenderer } from './render/RopeRenderer.ts';
import { PinMesh } from './render/PinMesh.ts';
import { EmbroideryBoard } from './render/EmbroideryBoard.ts';
import { TextureGenerator } from './render/TextureGenerator.ts';
import { LevelConfig } from './game/LevelConfig.ts';
import { InteractionManager } from './game/InteractionManager.ts';
import { TopologyDetector } from './game/TopologyDetector.ts';
import { EmbroideryEffect } from './game/EmbroideryEffect.ts';
import { SoundManager } from './game/SoundManager.ts';

class GameApp {
  private container: HTMLElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private board!: EmbroideryBoard;
  private solver!: RopeSolver;
  private ropes: Rope[] = [];
  private ropeRenderers: RopeRenderer[] = [];
  private pins: PinMesh[] = [];

  private interactionManager!: InteractionManager;
  private embroideryEffect!: EmbroideryEffect;
  private twistedNormalMap!: THREE.CanvasTexture;

  private clock: THREE.Clock = new THREE.Clock();
  private untangledCount: number = 0;

  constructor() {
    this.container = document.getElementById('canvas-container')!;
    this.initThree();
    this.initLighting();
    this.initBoardAndAssets();
    this.initLevel();
    this.initUI();

    this.onResize();
    window.addEventListener('resize', this.onResize.bind(this));

    // 初始状态先预热迭代 60 步，让绳子自然下垂沉淀，形成初始螺旋麻花
    for (let i = 0; i < 60; i++) {
      this.solver.step(0.016);
    }
    this.updateRenderers();

    this.animate();
  }

  private initThree(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xecdcc9);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    // 正交俯视绣绷底盘，对齐 1080x1920 背景底图
    this.camera.position.set(0, 0, 10.8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);
  }

  private initLighting(): void {
    // 柔和环境光 (带暖调)
    const ambientLight = new THREE.AmbientLight(0xfff8ee, 0.95);
    this.scene.add(ambientLight);

    // 主定向光源 (斜上方真实日光，在 10.11 底布上投射柔和阴影)
    const mainLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    mainLight.position.set(2.5, 3.5, 6.5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 18;
    mainLight.shadow.camera.left = -4;
    mainLight.shadow.camera.right = 4;
    mainLight.shadow.camera.top = 4;
    mainLight.shadow.camera.bottom = -4;
    mainLight.shadow.bias = -0.0006;
    mainLight.shadow.radius = 2.5;
    this.scene.add(mainLight);

    // 辅助补光 (冷色微弱漫反射)
    const fillLight = new THREE.DirectionalLight(0xdbe8ff, 0.5);
    fillLight.position.set(-3, -2.5, 5);
    this.scene.add(fillLight);
  }

  private initBoardAndAssets(): void {
    // 生成加捻丝线法线贴图
    this.twistedNormalMap = TextureGenerator.createTwistedFlossNormalMap(512, 512);

    // 创建刺绣底盘 (10.11 高清主图与刺绣线稿层)
    this.board = new EmbroideryBoard();
    this.scene.add(this.board.group);

    // 物理求解器
    this.solver = new RopeSolver(8);

    // 特效管理器
    this.embroideryEffect = new EmbroideryEffect(this.scene, this.board);
  }

  private initLevel(): void {
    // 清除旧对象
    for (const r of this.ropeRenderers) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.material.dispose();
    }
    for (const p of this.pins) {
      this.scene.remove(p.group);
    }

    this.ropes = [];
    this.ropeRenderers = [];
    this.pins = [];
    this.solver.clear();
    this.solver.pins = [];
    this.embroideryEffect.reset();
    this.untangledCount = 0;
    this.updateCounterUI();

    // 重置孔位占用
    for (const slot of this.board.slots) {
      slot.occupiedBy = null;
    }

    // 重建 6 条绳索与端点图钉 (对齐 24 孔位)
    for (const ropeData of LevelConfig.ROPES_DATA) {
      const slotA = this.board.slots[ropeData.slotA];
      const slotB = this.board.slots[ropeData.slotB];

      slotA.occupiedBy = { ropeId: ropeData.id, endType: 'A' };
      slotB.occupiedBy = { ropeId: ropeData.id, endType: 'B' };

      // 物理绳索实体
      const rope = new Rope(slotA.position, slotB.position, {
        id: ropeData.id,
        name: ropeData.name,
        color: ropeData.color,
        pegAIndex: ropeData.slotA,
        pegBIndex: ropeData.slotB,
        radius: 0.065,
        numParticles: 26,
        slackFactor: (ropeData.twistWith ? 1.10 : 1.04), // 麻花双螺旋绳索给予充足松弛余量
        twistTurns: ropeData.twistTurns
      });

      this.ropes.push(rope);
      this.solver.addRope(rope);

      // 渲染管线
      const renderer = new RopeRenderer(rope, this.twistedNormalMap);
      this.scene.add(renderer.mesh);
      this.ropeRenderers.push(renderer);

      // 端点图钉 A 与 B
      const pinA = new PinMesh(rope.id, 'A', rope.color, slotA.position);
      const pinB = new PinMesh(rope.id, 'B', rope.color, slotB.position);

      this.scene.add(pinA.group);
      this.scene.add(pinB.group);
      this.pins.push(pinA, pinB);
    }

    // 挂载纽扣障碍物至物理求解器，启用全自动物理避让排斥
    this.solver.pins = this.pins;

    this.updateCounterUI();

    // 交互管理器
    this.interactionManager = new InteractionManager(
      this.camera,
      this.container,
      this.board,
      this.ropes,
      this.pins,
      {
        onPinMoved: this.handlePinMoved.bind(this)
      }
    );
  }

  private handlePinMoved(_rope: Rope, _endType: 'A' | 'B', _oldSlot: number, _newSlot: number): void {
    // 移动完成后，检查是否有绳索已完全脱困
    this.checkUntangledRopes();
  }

  private checkUntangledRopes(): void {
    for (const rope of this.ropes) {
      if (rope.state !== 'active') continue;

      const isFree = TopologyDetector.isRopeFree(rope, this.ropes, this.board.slots);

      if (isFree) {
        // 发现脱困！标记并触发解开奖励
        rope.state = 'untangled';
        this.untangledCount++;
        this.updateCounterUI();
        // 清空孔位占用
        this.board.slots[rope.pegAIndex].occupiedBy = null;
        this.board.slots[rope.pegBIndex].occupiedBy = null;

        // 触发极速抽绳聚合与数字纽扣飞跃动效
        const pinA = this.pins.find(p => p.ropeId === rope.id && p.endType === 'A');
        const pinB = this.pins.find(p => p.ropeId === rope.id && p.endType === 'B');
        if (pinA && pinB) {
          this.embroideryEffect.triggerUntangled(rope, pinA, pinB);
        }

        // 检查是否全通
        if (this.untangledCount === this.ropes.length) {
          // 触发全幅刺绣大圆满连环烟花式揭示 (剩余 5 个图案依次绣满整幅绣绷)
          this.board.triggerVictoryFullHoopReveal();
          setTimeout(() => {
            this.showVictoryModal();
          }, 2800);
        }
      }
    }
  }

  private updateCounterUI(): void {
    const el = document.getElementById('untangled-counter');
    if (el) {
      el.textContent = `已解开 ${this.untangledCount} / ${this.ropes.length} 条丝线`;
    }
  }

  private showToast(msg: string): void {
    const toast = document.getElementById('toast-message');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2200);
  }

  private showVictoryModal(): void {
    SoundManager.playVictoryFanfare();
    const modal = document.getElementById('victory-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  private initUI(): void {
    // 重置按钮
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.initLevel();
      this.board.reset();
    });

    // 声音按钮
    const soundBtn = document.getElementById('btn-sound');
    soundBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isMuted = SoundManager.toggleMute();
      soundBtn.style.opacity = isMuted ? '0.45' : '1.0';
    });

    // 首次交互播放 BGM
    const startAudioOnFirstInteraction = () => {
      SoundManager.startBGM();
      window.removeEventListener('pointerdown', startAudioOnFirstInteraction);
      window.removeEventListener('touchstart', startAudioOnFirstInteraction);
    };
    window.addEventListener('pointerdown', startAudioOnFirstInteraction);
    window.addEventListener('touchstart', startAudioOnFirstInteraction);

    // 再玩一次按钮
    document.getElementById('btn-replay')?.addEventListener('click', () => {
      const modal = document.getElementById('victory-modal');
      if (modal) modal.classList.add('hidden');
      this.initLevel();
      this.board.reset();
    });

    // 10.11 自定义拟真手指鼠标光标跟随系统
    this.initVirtualFingerCursor();
  }

  /**
   * 10.11 拟真手指鼠标指针跟随与触控反馈
   */
  private initVirtualFingerCursor(): void {
    const cursorEl = document.getElementById('virtual-cursor');
    const appEl = document.getElementById('app');
    if (!cursorEl || !appEl) return;

    const updateCursor = (clientX: number, clientY: number) => {
      const rect = appEl.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (x >= -60 && x <= rect.width + 60 && y >= -60 && y <= rect.height + 60) {
        // 食指尖端位于 (8, 0) / (379, 366)，宽度约 125px 时 x 偏移约 2.6px (向左校准3px)
        cursorEl.style.transform = `translate3d(${x - 3}px, ${y}px, 0)`;
        cursorEl.classList.add('active');
      } else {
        cursorEl.classList.remove('active');
      }
    };

    window.addEventListener('pointermove', (e: PointerEvent) => {
      updateCursor(e.clientX, e.clientY);
    });

    window.addEventListener('pointerdown', (e: PointerEvent) => {
      updateCursor(e.clientX, e.clientY);
      cursorEl.classList.add('pressed');
    });

    window.addEventListener('pointerup', () => {
      cursorEl.classList.remove('pressed');
    });

    window.addEventListener('pointercancel', () => {
      cursorEl.classList.remove('pressed');
    });

    appEl.addEventListener('pointerleave', () => {
      cursorEl.classList.remove('active');
    });
  }


  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    // 适配 4.4386 x 7.8909 的 9:16 全景高清背景板，实现无论屏幕长宽比如何均零畸变无黑边显示
    const halfFovRad = (this.camera.fov * Math.PI) / 360;
    const boardHeight = 7.8909;
    const boardWidth = 4.4386;
    const distForHeight = (boardHeight / 2) / Math.tan(halfFovRad);
    const distForWidth = (boardWidth / 2) / (Math.tan(halfFovRad) * this.camera.aspect);
    this.camera.position.z = Math.max(distForHeight, distForWidth);
    this.camera.position.y = 0;
    this.camera.position.x = 0;
    this.camera.lookAt(0, 0, 0);
  }

  private updateRenderers(): void {
    for (const r of this.ropeRenderers) {
      r.update();
    }
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.033);
    const time = this.clock.getElapsedTime();

    // 1. 物理步进
    this.solver.step(dt);

    // 2. 动态管道与图钉渲染
    this.updateRenderers();
    this.interactionManager.update();

    // 4. 特效与底盘呼吸灯
    this.embroideryEffect.update(dt);
    this.board.update(time, dt);

    // 5. 渲染场景
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * 将 3D 空间坐标投影到屏幕像素坐标 (用于自动化测试和真机交互模拟)
   */
  public projectToScreen(pos: THREE.Vector3): { x: number; y: number } {
    const v = pos.clone().project(this.camera);
    const rect = this.container.getBoundingClientRect();
    const x = rect.left + ((v.x + 1) * rect.width) / 2;
    const y = rect.top + ((-v.y + 1) * rect.height) / 2;
    return { x, y };
  }

  public getSlotScreenPos(slotIndex: number): { x: number; y: number } {
    return this.projectToScreen(this.board.slots[slotIndex].position);
  }

  public getPinScreenPos(ropeId: number, endType: 'A' | 'B'): { x: number; y: number } | null {
    const pin = this.pins.find(p => p.ropeId === ropeId && p.endType === endType);
    if (!pin) return null;
    return this.projectToScreen(pin.group.position);
  }

  public getGameState(): any {
    return {
      untangledCount: this.untangledCount,
      ropes: this.ropes.map(r => ({
        id: r.id,
        name: r.name,
        state: r.state,
        slotA: r.pegAIndex,
        slotB: r.pegBIndex
      })),
      slots: this.board.slots.map(s => ({
        index: s.index,
        occupiedBy: s.occupiedBy
      }))
    };
  }
}

// 启动游戏实例并挂载全局调试对象
window.addEventListener('DOMContentLoaded', () => {
  (window as any).THREE = THREE;
  (window as any).__GAME__ = new GameApp();
});
