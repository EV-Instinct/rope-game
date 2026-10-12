import * as THREE from 'three';
import { Rope } from '../core/xpbd/Rope.ts';
import { EmbroideryBoard } from '../render/EmbroideryBoard.ts';
import { PinMesh } from '../render/PinMesh.ts';
import { SoundManager } from './SoundManager.ts';
import { LevelConfig } from './LevelConfig.ts';

interface ActiveUntangleTask {
  rope: Rope;
  anchorPin: PinMesh;
  movingPin: PinMesh;
  targetPos: THREE.Vector3;
  phase: 'retracting' | 'flying';
  time: number;
  retractDuration: number;
  flightDuration: number;
  flightStartPos: THREE.Vector3;
}

/**
 * 刺绣成真特效管理器 (Embroidery Reward VFX Manager)
 * 1:1 精确复刻原版视频解开微动效：
 * 1. 阶段一：卷尺式极速收线与图钉沿绳滑行聚合 (0.15s)
 * 2. 阶段二：实体 3D 数字纽扣球空间抛物线飞跃至刺绣图案 (0.30s)
 * 3. 阶段三：飞抵撞击融入吸收、真丝刺绣瞬间绽放与清脆风铃回响
 */
export class EmbroideryEffect {
  public scene: THREE.Scene;
  public board: EmbroideryBoard;
  private activeTasks: ActiveUntangleTask[] = [];

  constructor(scene: THREE.Scene, board: EmbroideryBoard) {
    this.scene = scene;
    this.board = board;
  }

  /**
   * 触发丝线解开并飞向对应刺绣图案
   */
  public triggerUntangled(rope: Rope, pinA: PinMesh, pinB: PinMesh): void {
    // 找到对应浪漫刺绣礼物的目标三维坐标
    const ropeData = LevelConfig.ROPES_DATA.find(r => r.id === rope.id);
    const m = ropeData ? this.board.motifs.find(item => item.id === ropeData.targetMotifId) : null;
    const targetPos = m
      ? new THREE.Vector3(m.wx, m.wy, 0.12)
      : new THREE.Vector3(0, 1.8, 0.12);

    // 智能选取靠近刺绣目标的一端为驻留锚固纽扣，远端为滑动回缩纽扣
    const distA = pinA.group.position.distanceTo(targetPos);
    const distB = pinB.group.position.distanceTo(targetPos);
    const anchorPin = distA <= distB ? pinA : pinB;
    const movingPin = distA <= distB ? pinB : pinA;
    const retractAnchor = distA <= distB ? 'A' : 'B';

    // 标记状态
    rope.state = 'retracting';
    rope.retractProgress = 0;
    rope.retractAnchor = retractAnchor;

    pinA.isUntangling = true;
    pinB.isUntangling = true;

    movingPin.group.renderOrder = 24;
    anchorPin.group.renderOrder = 25;

    this.activeTasks.push({
      rope,
      anchorPin,
      movingPin,
      targetPos,
      phase: 'retracting',
      time: 0,
      retractDuration: 0.42, // 0.42s 悠然顺滑收绳与图钉滑动汇聚
      flightDuration: 0.58,  // 0.58s 3D 抛物线高空飞跃
      flightStartPos: anchorPin.group.position.clone()
    });
  }

  public reset(): void {
    this.activeTasks = [];
  }

  /**
   * 每帧更新解开动画管线
   */
  public update(dt: number): void {
    for (let i = this.activeTasks.length - 1; i >= 0; i--) {
      const task = this.activeTasks[i];

      if (task.phase === 'retracting') {
        task.time += dt;
        const progress = Math.min(1.0, task.time / task.retractDuration);
        task.rope.retractProgress = progress;

        // 从动图钉沿着绳索粒子曲线滑向锚固图钉
        const points = task.rope.particles.map(p => p.position);
        if (points.length >= 2) {
          if (task.rope.retractAnchor === 'A') {
            const idx = Math.max(0, Math.min(points.length - 1, Math.round((points.length - 1) * (1.0 - progress))));
            task.movingPin.group.position.copy(points[idx]);
          } else {
            const idx = Math.max(0, Math.min(points.length - 1, Math.round((points.length - 1) * progress)));
            task.movingPin.group.position.copy(points[idx]);
          }
          task.movingPin.group.position.z = 0.22;
          const s = Math.max(0.15, 1.0 - progress * 0.4);
          task.movingPin.group.scale.set(s, s, s);
        }

        // 阶段一完成：收线入孔，融合为一颗饱满数字纽扣
        if (progress >= 1.0) {
          task.movingPin.group.visible = false;
          task.rope.state = 'completed';

          task.phase = 'flying';
          task.time = 0;
          task.flightStartPos.copy(task.anchorPin.group.position);
        }
      } else if (task.phase === 'flying') {
        task.time += dt;
        const t = Math.min(1.0, task.time / task.flightDuration);

        // SmoothStep 平滑运动
        const tSmooth = t * t * (3 - 2 * t);

        // X 和 Y 平面位移
        const currX = THREE.MathUtils.lerp(task.flightStartPos.x, task.targetPos.x, tSmooth);
        const currY = THREE.MathUtils.lerp(task.flightStartPos.y, task.targetPos.y, tSmooth);

        // Z 轴抛物线弧度：最高拱起 1.15，飞跃绣绷进入刺绣区
        const arcZ = Math.sin(t * Math.PI) * 1.15;
        const currZ = task.flightStartPos.z + arcZ;

        task.anchorPin.group.position.set(currX, currY, currZ);

        // 缩放：起飞微大 (1.26)，临近图案时迅速缩小至 0 (布料吸收感)
        let scale = 1.0;
        if (t < 0.22) {
          scale = 1.0 + 0.26 * (t / 0.22);
        } else if (t < 0.8) {
          scale = 1.26;
        } else {
          const dissolve = (t - 0.8) / 0.2;
          scale = 1.26 * Math.max(0.0, 1.0 - dissolve);
        }
        task.anchorPin.group.scale.set(scale, scale, scale);

        // 飞行动力学倾斜 (面向飞行切线)
        const dx = task.targetPos.x - task.flightStartPos.x;
        const dy = task.targetPos.y - task.flightStartPos.y;
        task.anchorPin.group.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        task.anchorPin.group.rotation.x = Math.sin(t * Math.PI) * 0.4;

        // 阶段二完成：触达图案瞬间吸收并绽放
        if (t >= 1.0) {
          task.anchorPin.group.visible = false;
          this.board.embroiderMotif(task.rope.id);
          SoundManager.playUntangleChime();
          this.activeTasks.splice(i, 1);
        }
      }
    }
  }
}
