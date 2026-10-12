import * as THREE from 'three';

/**
 * 3D 质点数据结构 (XPBD Particle)
 */
export class Particle {
  public position: THREE.Vector3;
  public prevPosition: THREE.Vector3;
  public velocity: THREE.Vector3;
  public invMass: number; // 逆质量 (0 表示固定端点)
  public radius: number;  // 胶囊碰撞半径
  public isPinned: boolean = false;

  constructor(x: number, y: number, z: number, invMass: number = 1.0, radius: number = 0.12) {
    this.position = new THREE.Vector3(x, y, z);
    this.prevPosition = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.invMass = invMass;
    this.radius = radius;
  }

  public setPinned(pinned: boolean): void {
    this.isPinned = pinned;
    this.invMass = pinned ? 0.0 : 1.0;
    if (pinned) {
      this.velocity.set(0, 0, 0);
    }
  }

  public updatePosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.prevPosition.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }
}
