import * as THREE from 'three';
import { Particle } from './Particle.ts';
import { DistanceConstraint } from './DistanceConstraint.ts';
import { BendingConstraint } from './BendingConstraint.ts';

export interface RopeConfig {
  id: number;
  name: string;
  color: string;
  pegAIndex: number;
  pegBIndex: number;
  numParticles?: number;
  radius?: number;
  stiffness?: number;
  slackFactor?: number; // 适度松弛率，制造自然悬链线与缠绕余量
  twistTurns?: number; // 初始麻花螺旋圈数
}

/**
 * 绳索实体类 (XPBD Rope Strand)
 */
export class Rope {
  public id: number;
  public name: string;
  public color: string;
  public colorHex: number;
  public radius: number;
  public numParticles: number;

  public pegAIndex: number;
  public pegBIndex: number;

  public particles: Particle[] = [];
  public distanceConstraints: DistanceConstraint[] = [];
  public bendingConstraints: BendingConstraint[] = [];

  public state: 'active' | 'untangled' | 'retracting' | 'completed' = 'active';
  public retractProgress: number = 0; // 0: 完整, 1: 完全收缩消散
  public retractAnchor: 'A' | 'B' = 'A'; // 'A': 缩回至 A 端 (0), 'B': 缩回至 B 端 (N-1)

  constructor(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    config: RopeConfig
  ) {
    this.id = config.id;
    this.name = config.name;
    this.color = config.color;
    this.colorHex = parseInt(config.color.replace('#', '0x'), 16);
    this.pegAIndex = config.pegAIndex;
    this.pegBIndex = config.pegBIndex;
    this.radius = config.radius || 0.115;
    this.numParticles = config.numParticles || 26;

    this.initParticlesAndConstraints(startPos, endPos, config);
  }

  private initParticlesAndConstraints(start: THREE.Vector3, end: THREE.Vector3, config: RopeConfig): void {
    const slack = config.slackFactor || 1.05;
    this.particles = [];
    this.distanceConstraints = [];
    this.bendingConstraints = [];

    const totalDist = start.distanceTo(end) * slack;
    const segmentLength = totalDist / (this.numParticles - 1);

    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();

    // 根据绳索 ID 设置初始三维层叠倾向 (Layer Ordering)，防止初始交叉穿模
    let layerZOffset = 0.0;
    if (this.id === 6) layerZOffset = 0.16; // 紫6在顶部跨越
    else if (this.id === 1) layerZOffset = 0.12; // 绿1在上层跨越
    else if (this.id === 2) layerZOffset = 0.08; // 蓝2在中层
    else if (this.id === 5) layerZOffset = 0.02; // 橙5在底层

    // 在两端点间按直线并施加初始微拱高插值质点
    for (let i = 0; i < this.numParticles; i++) {
      const alpha = i / (this.numParticles - 1);
      const pos = new THREE.Vector3().lerpVectors(start, end, alpha);

      // 给中间质点微小 Z 抬升，确保初始处于布面上方并有层次感
      const archZ = Math.sin(alpha * Math.PI) * (0.16 + layerZOffset) + this.radius;
      pos.z = Math.max(pos.z, archZ);

      // 初始螺旋麻花编织位移 (Double Helix Twist - 专为红4与粉3设计)
      if (config.twistTurns) {
        const twistPhase = alpha * Math.PI * 2.0 * config.twistTurns;
        const twistAmp = Math.sin(alpha * Math.PI) * 0.35;
        pos.addScaledVector(perp, Math.sin(twistPhase) * twistAmp);
        pos.z += Math.cos(twistPhase) * twistAmp * 0.9;
      }

      pos.z = Math.max(pos.z, this.radius);

      // 端点初始扎入孔位深处 (Z=0.00)，保证绳头在纽扣底座下方入孔
      const isEndpoint = (i === 0 || i === this.numParticles - 1);
      if (isEndpoint) {
        pos.z = 0.00;
      } else if (i === 1 || i === this.numParticles - 2) {
        pos.z = Math.min(pos.z, 0.04);
      }
      const invMass = isEndpoint ? 0.0 : 1.0;

      const p = new Particle(pos.x, pos.y, pos.z, invMass, this.radius);
      p.setPinned(isEndpoint);
      this.particles.push(p);
    }

    // 构建相邻距离约束
    for (let i = 0; i < this.numParticles - 1; i++) {
      const distConstraint = new DistanceConstraint(
        this.particles[i],
        this.particles[i + 1],
        segmentLength,
        0.92 // 快速收敛的 PBD 刚度，保证丝线形态稳定、不拉长变形
      );
      this.distanceConstraints.push(distConstraint);
    }

    // 构建三质点平滑抗弯约束
    for (let i = 0; i < this.numParticles - 2; i++) {
      const bendConstraint = new BendingConstraint(
        this.particles[i],
        this.particles[i + 1],
        this.particles[i + 2],
        0.06 // 柔和抗弯刚度
      );
      this.bendingConstraints.push(bendConstraint);
    }
  }

  /**
   * 更新端点 A 坐标 (拖拽或吸附孔位)
   */
  public updateAnchorA(pos: THREE.Vector3, isDragging: boolean = false): void {
    if (this.particles.length > 0) {
      const z = isDragging ? pos.z : 0.00;
      this.particles[0].updatePosition(pos.x, pos.y, z);
    }
  }

  /**
   * 更新端点 B 坐标 (拖拽或吸附孔位)
   */
  public updateAnchorB(pos: THREE.Vector3, isDragging: boolean = false): void {
    if (this.particles.length > 0) {
      const z = isDragging ? pos.z : 0.00;
      this.particles[this.particles.length - 1].updatePosition(pos.x, pos.y, z);
    }
  }

  /**
   * 重新计算所有相邻质点距离约束的自然静止长度 (当端点落入新孔位时自适应张力与微弧下垂)
   */
  public updateRestLengths(slack: number = 1.05): void {
    if (this.particles.length < 2) return;
    const start = this.particles[0].position;
    const end = this.particles[this.particles.length - 1].position;
    const totalDist = start.distanceTo(end) * slack;
    const segmentLength = totalDist / (this.numParticles - 1);
    for (const c of this.distanceConstraints) {
      c.restLength = segmentLength;
    }
  }

  public getAnchorAPosition(): THREE.Vector3 {
    return this.particles[0].position;
  }

  public getAnchorBPosition(): THREE.Vector3 {
    return this.particles[this.particles.length - 1].position;
  }
}

