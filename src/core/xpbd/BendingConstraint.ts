import * as THREE from 'three';
import { Particle } from './Particle.ts';

const _mid = new THREE.Vector3();
const _diff = new THREE.Vector3();

/**
 * XPBD 弯曲约束 (Bending Constraint)
 * 控制绳索的抗弯刚度，避免尖锐折角，使丝线呈现优雅自然的曲率
 */
export class BendingConstraint {
  public p0: Particle;
  public p1: Particle;
  public p2: Particle;
  public stiffness: number; // 弯曲刚度 [0, 1]

  constructor(p0: Particle, p1: Particle, p2: Particle, stiffness: number = 0.08) {
    this.p0 = p0;
    this.p1 = p1;
    this.p2 = p2;
    this.stiffness = stiffness;
  }

  public solve(): void {
    if (this.p1.invMass === 0) return;

    // 目标中间位置为两端平均点
    _mid.addVectors(this.p0.position, this.p2.position).multiplyScalar(0.5);
    _diff.subVectors(_mid, this.p1.position);

    const w1 = this.p1.invMass;
    const w0 = this.p0.invMass;
    const w2 = this.p2.invMass;
    const wTotal = w1 + 0.25 * (w0 + w2);
    if (wTotal === 0) return;

    const factor = this.stiffness / wTotal;

    if (w1 > 0) {
      this.p1.position.addScaledVector(_diff, factor * w1);
    }
    if (w0 > 0) {
      this.p0.position.addScaledVector(_diff, -0.5 * factor * w0);
    }
    if (w2 > 0) {
      this.p2.position.addScaledVector(_diff, -0.5 * factor * w2);
    }
  }
}
