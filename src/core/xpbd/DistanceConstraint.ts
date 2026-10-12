import * as THREE from 'three';
import { Particle } from './Particle.ts';

const _delta = new THREE.Vector3();

/**
 * PBD / XPBD 距离约束 (Distance Constraint)
 * 严格无条件数值稳定，绝无拉格朗日溢出与 NaN 风险
 */
export class DistanceConstraint {
  public p1: Particle;
  public p2: Particle;
  public restLength: number;
  public stiffness: number; // 约束刚度 [0, 1]

  constructor(p1: Particle, p2: Particle, restLength?: number, stiffness: number = 0.95) {
    this.p1 = p1;
    this.p2 = p2;
    this.restLength = restLength !== undefined ? restLength : p1.position.distanceTo(p2.position);
    this.stiffness = stiffness;
  }

  public resetLambda(): void {
    // 兼容接口
  }

  public solve(_dt: number): void {
    const w1 = this.p1.invMass;
    const w2 = this.p2.invMass;
    const wSum = w1 + w2;
    if (wSum <= 1e-7) return;

    _delta.subVectors(this.p1.position, this.p2.position);
    const len = _delta.length();
    if (len <= 1e-7) return;

    const error = (len - this.restLength) / len;
    const correctionMagnitude = error * this.stiffness / wSum;

    if (w1 > 0) {
      this.p1.position.addScaledVector(_delta, -w1 * correctionMagnitude);
    }
    if (w2 > 0) {
      this.p2.position.addScaledVector(_delta, w2 * correctionMagnitude);
    }
  }
}
