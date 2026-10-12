import * as THREE from 'three';
import { LevelConfig, type PegSlot } from '../game/LevelConfig.ts';
import { SoundManager } from '../game/SoundManager.ts';

export interface MotifState {
  id: number;
  name: string;
  px: number;
  py: number;
  wx: number;
  wy: number;
  bbox: [number, number, number, number];
  isEmbroidered: boolean;
  color?: string;
  revealProgress: number; // 0: 原始线稿, 1: 华丽真丝刺绣填充
  targetProgress: number;
  lineartImg?: HTMLImageElement;
  embroideredImg?: HTMLImageElement;
}

/**
 * 刺绣底盘与场景环境组件 (Embroidery Board Scene Component)
 * 高品质独立切片美术架构：
 * 1. board_bg.png: 1080x1920 绣绷木框与天然亚麻布纹理
 * 2. 11 个独立像素级隔离的线稿与真丝刺绣成对纹理 (public/motifs/motif_{id}_lineart.png & embroidered.png)
 * 3. 0% 临摹串色，0% 边缘切断，100% 独立图层隔离
 * 4. 22 个孔位精准对齐呼吸发光环
 */
export class EmbroideryBoard {
  public group: THREE.Group;
  public slots: PegSlot[];
  public motifs: MotifState[] = [];

  private bgMesh!: THREE.Mesh;
  private motifsMesh!: THREE.Mesh;
  private motifsCanvas!: HTMLCanvasElement;
  private motifsCtx!: CanvasRenderingContext2D;
  private motifsTexture!: THREE.CanvasTexture;

  private slotHighlightMeshes: THREE.Mesh[] = [];

  // 9:16 摄像机平截头体标准常数
  private readonly FRUSTUM_WIDTH = 4.4386;
  private readonly FRUSTUM_HEIGHT = 7.8909;

  constructor() {
    this.group = new THREE.Group();
    this.slots = LevelConfig.generateSlots();

    this.initMotifsData();
    this.createBackgroundPlane();
    this.createMotifsOverlay();
    this.createPegHoles();
  }

  private initMotifsData(): void {
    for (const m of LevelConfig.MOTIFS) {
      this.motifs.push({
        id: m.id,
        name: m.name,
        px: m.px,
        py: m.py,
        wx: m.wx,
        wy: m.wy,
        bbox: m.bbox,
        isEmbroidered: false,
        color: undefined,
        revealProgress: 0.0,
        targetProgress: 0.0
      });
    }
  }

  /**
   * 1. 接入 1080x1920 board_bg.png 绣绷底板
   */
  private createBackgroundPlane(): void {
    const textureLoader = new THREE.TextureLoader();
    const bgTexture = textureLoader.load('./board_bg.png', () => {
      bgTexture.colorSpace = THREE.SRGBColorSpace;
      bgTexture.minFilter = THREE.LinearMipmapLinearFilter;
      bgTexture.generateMipmaps = true;
    });

    const geo = new THREE.PlaneGeometry(this.FRUSTUM_WIDTH, this.FRUSTUM_HEIGHT);
    const mat = new THREE.MeshStandardMaterial({
      map: bgTexture,
      roughness: 0.88,
      metalness: 0.02
    });

    this.bgMesh = new THREE.Mesh(geo, mat);
    this.bgMesh.position.set(0, 0, -0.003);
    this.bgMesh.receiveShadow = true;
    this.group.add(this.bgMesh);
  }

  /**
   * 2. 独立像素级切片刺绣图层 (1080x1920 Canvas 动态合成)
   */
  private createMotifsOverlay(): void {
    const w = 1080;
    const h = 1920;
    this.motifsCanvas = document.createElement('canvas');
    this.motifsCanvas.width = w;
    this.motifsCanvas.height = h;
    this.motifsCtx = this.motifsCanvas.getContext('2d')!;

    this.motifsTexture = new THREE.CanvasTexture(this.motifsCanvas);
    this.motifsTexture.colorSpace = THREE.SRGBColorSpace;
    this.motifsTexture.minFilter = THREE.LinearFilter;

    // 预载所有 11 组独立的图案纹理 (11 个 lineart + 11 个 embroidered)
    let loadedCount = 0;
    const totalToLoad = this.motifs.length * 2;

    const onImageLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        this.redrawMotifsCanvas();
      }
    };

    for (const m of this.motifs) {
      const lineImg = new Image();
      lineImg.src = `./motifs/motif_${m.id}_lineart.png`;
      lineImg.onload = onImageLoaded;
      m.lineartImg = lineImg;

      const embImg = new Image();
      embImg.src = `./motifs/motif_${m.id}_embroidered.png`;
      embImg.onload = onImageLoaded;
      m.embroideredImg = embImg;
    }

    const geo = new THREE.PlaneGeometry(this.FRUSTUM_WIDTH, this.FRUSTUM_HEIGHT);
    const mat = new THREE.MeshBasicMaterial({
      map: this.motifsTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });

    this.motifsMesh = new THREE.Mesh(geo, mat);
    this.motifsMesh.position.set(0, 0, -0.001);
    this.group.add(this.motifsMesh);
  }

  /**
   * 重绘整个 1080x1920 刺绣图层 (100% 独立切片绘制，彻底杜绝任何邻近图案串色与边缘切断)
   */
  public redrawMotifsCanvas(): void {
    const ctx = this.motifsCtx;
    const w = this.motifsCanvas.width;
    const h = this.motifsCanvas.height;

    ctx.clearRect(0, 0, w, h);

    for (const m of this.motifs) {
      if (!m.lineartImg || !m.lineartImg.complete || !m.embroideredImg || !m.embroideredImg.complete) {
        continue;
      }

      const minX = m.bbox[0];
      const minY = m.bbox[1];

      if (m.isEmbroidered) {
        // 已完成刺绣：绘制华丽透亮的高光真丝刺绣图案
        ctx.drawImage(m.embroideredImg, minX, minY);
      } else {
        // 尚未刺绣：绘制干净独立的原始线稿
        ctx.drawImage(m.lineartImg, minX, minY);
      }
    }

    this.motifsTexture.needsUpdate = true;
  }

  /**
   * 触发对应丝线绑定的刺绣礼物显色
   */
  public embroiderMotif(ropeId: number, color?: string): void {
    const ropeData = LevelConfig.ROPES_DATA.find(r => r.id === ropeId);
    if (!ropeData) return;

    const motif = this.motifs.find(m => m.id === ropeData.targetMotifId);
    if (motif && !motif.isEmbroidered) {
      motif.isEmbroidered = true;
      motif.color = color || ropeData.color;
      motif.revealProgress = 1.0;
      motif.targetProgress = 1.0;
      this.redrawMotifsCanvas();
    }
  }

  /**
   * 直接通过 Motif ID 触发显色 (用于全通大圆满终曲)
   */
  public embroiderMotifById(motifId: number): void {
    const motif = this.motifs.find(m => m.id === motifId);
    if (motif && !motif.isEmbroidered) {
      motif.isEmbroidered = true;
      motif.revealProgress = 1.0;
      motif.targetProgress = 1.0;
      this.redrawMotifsCanvas();
    }
  }

  /**
   * 庆祝全通大圆满：将其余 5 个未解开的图案依次如同烟花般连环点亮绣满全幅！
   */
  public triggerVictoryFullHoopReveal(): void {
    const unrevealed = this.motifs.filter(m => !m.isEmbroidered);
    unrevealed.forEach((m, idx) => {
      setTimeout(() => {
        this.embroiderMotifById(m.id);
        SoundManager.playUntangleChime();
      }, idx * 240);
    });
  }

  /**
   * 3. 22 个孔位呼吸高亮光环
   */
  private createPegHoles(): void {
    const innerR = 0.056;
    const outerR = 0.098;
    const highlightGeo = new THREE.RingGeometry(innerR, outerR, 32);

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];

      const highlightMat = new THREE.MeshBasicMaterial({
        color: 0x4cd964,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide
      });
      const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
      highlightMesh.position.set(slot.position.x, slot.position.y, 0.002);
      highlightMesh.visible = false;
      this.group.add(highlightMesh);
      this.slotHighlightMeshes.push(highlightMesh);
    }
  }

  public setSlotHighlight(slotIndex: number, visible: boolean, color: number = 0x4cd964): void {
    if (slotIndex >= 0 && slotIndex < this.slotHighlightMeshes.length) {
      const mesh = this.slotHighlightMeshes[slotIndex];
      mesh.visible = visible;
      if (visible) {
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
      }
    }
  }

  public clearAllHighlights(): void {
    for (const mesh of this.slotHighlightMeshes) {
      mesh.visible = false;
    }
  }

  public reset(): void {
    for (const m of this.motifs) {
      m.isEmbroidered = false;
      m.color = undefined;
      m.revealProgress = 0.0;
      m.targetProgress = 0.0;
    }
    this.clearAllHighlights();
    this.redrawMotifsCanvas();
  }

  /**
   * 每帧动画更新 (孔位脉冲呼吸)
   */
  public update(time: number, _dt: number = 0.016): void {
    // 推进针孔发光光环呼吸动画
    for (const mesh of this.slotHighlightMeshes) {
      if (mesh.visible) {
        const pulse = 0.65 + 0.35 * Math.sin(time * 6.0);
        (mesh.material as THREE.MeshBasicMaterial).opacity = pulse;
        const scale = 1.0 + 0.08 * Math.sin(time * 6.0);
        mesh.scale.set(scale, scale, 1);
      }
    }
  }
}
