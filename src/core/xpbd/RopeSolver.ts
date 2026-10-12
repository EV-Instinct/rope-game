import * as THREE from 'three';
import { Rope } from './Rope.ts';
import { SegmentCollision } from './SegmentCollision.ts';

export interface PinObstacle {
  group: THREE.Group;
  ropeId: number;
  endType: 'A' | 'B';
}

/**
 * XPBD 绳索系统物理求解器 (XPBD Rope Physics Solver)
 * 多子步迭代，保证极致稳定、无穿模、支持多绳紧密缠绕
 */
export class RopeSolver {
  public ropes: Rope[] = [];
  public pins: PinObstacle[] = [];    // 孔位纽扣障碍物列表，用于施加径向避让排斥
  public substeps: number = 8;        // 子步数，保证碰撞精度与防穿透
  public gravity: THREE.Vector3 = new THREE.Vector3(0, 0, -1.8); // 柔和下压重力，贴合绣布
  public damping: number = 0.03;      // 空气阻尼
  public clothFriction: number = 0.1; // 绣布表面摩擦力

  constructor(substeps: number = 8) {
    this.substeps = substeps;
  }

  public addRope(rope: Rope): void {
    this.ropes.push(rope);
  }

  public removeRope(rope: Rope): void {
    const idx = this.ropes.indexOf(rope);
    if (idx !== -1) {
      this.ropes.splice(idx, 1);
    }
  }

  public clear(): void {
    this.ropes = [];
  }

  /**
   * 物理步进更新
   * @param dt 帧间隔 (秒，通常 1/60)
   */
  public step(dt: number): void {
    // 严格防护：如果 dt 极小或为 0，跳过本帧物理更新，绝对防止除以 0 导致 Infinity/NaN 崩溃！
    if (!Number.isFinite(dt) || dt <= 0.0001) return;

    // 限制单帧最大时间，防止切台后大步长导致突变
    const clampedDt = Math.min(dt, 0.033);
    const subDt = clampedDt / this.substeps;
    if (subDt <= 1e-6) return;

    for (let s = 0; s < this.substeps; s++) {
      this.integrateParticles(subDt);
      this.solveConstraints(subDt);
      this.solveCollisions();
      this.updateVelocities(subDt);
    }
  }

  private integrateParticles(h: number): void {
    for (const rope of this.ropes) {
      if (rope.state !== 'active') continue;

      for (const p of rope.particles) {
        if (p.invMass === 0) continue;

        // 阻尼衰减
        p.velocity.multiplyScalar(1.0 - this.damping);

        // 重力加速
        p.velocity.addScaledVector(this.gravity, h);

        // 保存前一时刻位置
        p.prevPosition.copy(p.position);

        // 显式积分推进一步
        p.position.addScaledVector(p.velocity, h);

        // 刺绣底布碰撞与贴合 (Z >= 半径)
        if (p.position.z < p.radius) {
          p.position.z = p.radius;
          p.velocity.z = 0;
          p.velocity.x *= (1.0 - this.clothFriction);
          p.velocity.y *= (1.0 - this.clothFriction);
        }

        // 绳身平顺贴布，物理上限限制在 0.082，绝对低于原版纽扣底盘 (Z=0.10)，杜绝任何反弹浮起
        if (p.position.z > 0.082) {
          p.position.z = 0.082;
          p.velocity.z = 0;
        }
      }
    }
  }

  private solveConstraints(h: number): void {
    for (const rope of this.ropes) {
      if (rope.state !== 'active') continue;

      // 距离约束解算
      for (const dc of rope.distanceConstraints) {
        dc.solve(h);
      }

      // 弯曲约束解算
      for (const bc of rope.bendingConstraints) {
        bc.solve();
      }
    }
  }

  private solveCollisions(): void {
    const activeRopes = this.ropes.filter(r => r.state === 'active');
    const n = activeRopes.length;

    // 两两绳索胶囊体碰撞解算
    for (let i = 0; i < n; i++) {
      const ropeA = activeRopes[i];
      const pCountA = ropeA.particles.length;

      for (let j = i + 1; j < n; j++) {
        const ropeB = activeRopes[j];
        const pCountB = ropeB.particles.length;
        const minDist = ropeA.radius + ropeB.radius;

        // 遍历线段对
        for (let segA = 0; segA < pCountA - 1; segA++) {
          const a1 = ropeA.particles[segA];
          const a2 = ropeA.particles[segA + 1];

          // 快速 AABB 粗筛
          const minAx = Math.min(a1.position.x, a2.position.x) - minDist;
          const maxAx = Math.max(a1.position.x, a2.position.x) + minDist;
          const minAy = Math.min(a1.position.y, a2.position.y) - minDist;
          const maxAy = Math.max(a1.position.y, a2.position.y) + minDist;

          for (let segB = 0; segB < pCountB - 1; segB++) {
            const b1 = ropeB.particles[segB];
            const b2 = ropeB.particles[segB + 1];

            // AABB 重叠检测
            const minBx = Math.min(b1.position.x, b2.position.x);
            const maxBx = Math.max(b1.position.x, b2.position.x);
            if (maxAx < minBx || minAx > maxBx) continue;

            const minBy = Math.min(b1.position.y, b2.position.y);
            const maxBy = Math.max(b1.position.y, b2.position.y);
            if (maxAy < minBy || minAy > maxBy) continue;

            // 精确线段对距离求解与排斥投影
            SegmentCollision.solveSegmentPair(a1, a2, b1, b2, minDist);
          }
        }
      }
    }

    // 2. 纽扣圆柱刚体障碍物排斥 (防止任何绳索从别的纽扣上方跨越，使其自然从侧边滑开)
    const obstacleRadius = 0.185; // 纽扣半径 (0.108) + 绳索半径 (0.065) + 缓冲
    for (const rope of activeRopes) {
      const pCount = rope.particles.length;
      for (const pin of this.pins) {
        if (!pin.group.visible) continue;
        const pinPos = pin.group.position;
        const isConnectedPin = (pin.ropeId === rope.id);

        for (let idx = 1; idx < pCount - 1; idx++) {
          // 如果是本绳索连接的端点纽扣，放行临近端点的两三个质点
          if (isConnectedPin) {
            if (pin.endType === 'A' && idx <= 2) continue;
            if (pin.endType === 'B' && idx >= pCount - 3) continue;
          }

          const p = rope.particles[idx];
          if (p.invMass === 0) continue;

          const dx = p.position.x - pinPos.x;
          const dy = p.position.y - pinPos.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < obstacleRadius * obstacleRadius && distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            const factor = (obstacleRadius - dist) / dist;
            p.position.x += dx * factor;
            p.position.y += dy * factor;
            // 靠近任何纽扣时，强制保持在纽扣底座下方 (Z <= 0.075)
            if (p.position.z > 0.075) {
              p.position.z = 0.075;
            }
          }
        }
      }
    }
  }

  private updateVelocities(h: number): void {
    if (h <= 1e-6) return;
    const invH = 1.0 / h;
    for (const rope of this.ropes) {
      if (rope.state !== 'active') continue;

      for (const p of rope.particles) {
        if (p.invMass === 0) continue;
        p.velocity.subVectors(p.position, p.prevPosition).multiplyScalar(invH);
      }
    }
  }
}
