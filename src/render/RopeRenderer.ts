import * as THREE from 'three';
import { Rope } from '../core/xpbd/Rope.ts';

/**
 * 绳索动态 3D 管道渲染器 (Dynamic Tube & Silk Floss Mesh)
 * 使用 CatmullRomCurve3 (uniform mode) 与 TubeGeometry 动态构建，
 * 配合丝绸 Sheen 漫反射与加捻法线，呈现极致国风刺绣丝线质感。
 */
export class RopeRenderer {
  public rope: Rope;
  public mesh: THREE.Mesh;
  public material: THREE.MeshPhysicalMaterial;

  constructor(rope: Rope, normalMap?: THREE.Texture) {
    this.rope = rope;

    const baseColor = new THREE.Color(rope.colorHex);
    const sheenColor = new THREE.Color(rope.colorHex).lerp(new THREE.Color(0xffffff), 0.4);

    this.material = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: 0.32,
      metalness: 0.08,
      sheen: 1.0,
      sheenRoughness: 0.35,
      sheenColor: sheenColor,
      clearcoat: 0.15,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 3.0,
      polygonOffsetUnits: 3.0
    });

    if (normalMap) {
      this.material.normalMap = normalMap;
      this.material.normalScale = new THREE.Vector2(0.85, 0.85);
    }

    // 初始几何体
    const initialCurve = new (THREE as any).CatmullRomCurve3(rope.particles.map(p => p.position));
    (initialCurve as any).curveType = 'catmullrom';
    const geo = new THREE.TubeGeometry(initialCurve, 40, rope.radius, 10, false);

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.update();
  }

  /**
   * 动态更新管道网格
   */
  public update(): void {
    if (this.rope.state === 'completed') {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const points = this.rope.particles.map(p => p.position);
    if (points.length < 2) return;

    let radius = this.rope.radius;
    let samplePoints = points;

    // 抽丝收缩消散动画处理 (Retract Animation: 从动端向锚固端极速卷缩)
    if (this.rope.state === 'retracting') {
      const p = Math.min(1.0, Math.max(0.0, this.rope.retractProgress));
      if (p >= 0.99) {
        this.mesh.visible = false;
        return;
      }

      if (this.rope.retractAnchor === 'A') {
        // 从 B 端向 A 端收缩：保留 0 到 lastIdx
        const lastIdx = Math.max(1, Math.round((points.length - 1) * (1.0 - p)));
        samplePoints = points.slice(0, lastIdx + 1);
      } else {
        // 从 A 端向 B 端收缩：保留 firstIdx 到 N-1
        const firstIdx = Math.min(points.length - 2, Math.round((points.length - 1) * p));
        samplePoints = points.slice(firstIdx);
      }

      if (samplePoints.length < 2) {
        this.mesh.visible = false;
        return;
      }
    }

    try {
      const curve = new (THREE as any).CatmullRomCurve3(samplePoints);
      const newGeo = new THREE.TubeGeometry(curve, 40, radius, 10, false);
      this.mesh.geometry.dispose();
      this.mesh.geometry = newGeo;
    } catch (err: any) {
      // 容错处理
    }
  }
}
