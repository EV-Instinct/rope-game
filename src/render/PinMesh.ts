import * as THREE from 'three';

/**
 * 3D 彩色图钉纽扣 (Pin Button Mesh)
 * 带有编号、立体倒角、悬浮拔起动效
 */
export class PinMesh {
  public group: THREE.Group;
  public ropeId: number;
  public endType: 'A' | 'B';
  public baseColor: string;
  public isDragging: boolean = false;

  private cylinderMesh: THREE.Mesh;
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private baseZ: number = 0.22; // 稳居绳体上方，确保纽扣与数字清晰可见，不被绳头掩盖
  private liftZ: number = 0.46; // 拖拽时拔起高度

  constructor(ropeId: number, endType: 'A' | 'B', color: string, position: THREE.Vector3) {
    this.ropeId = ropeId;
    this.endType = endType;
    this.baseColor = color;
    this.targetPosition.copy(position);

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.position.z = this.baseZ;

    // 1. 图钉底座主体 (圆润光洁树脂纽扣，严格适配真实孔缝线圈)
    const pinRadius = 0.108;
    const pinHeight = 0.06;
    const cylGeo = new THREE.CylinderGeometry(pinRadius, pinRadius * 0.95, pinHeight, 36);
    cylGeo.rotateX(Math.PI / 2); // 向上朝向 Z 轴

    const matSide = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(0.85),
      roughness: 0.25,
      metalness: 0.08
    });
    matSide.polygonOffset = true;
    matSide.polygonOffsetFactor = -2.0;
    matSide.polygonOffsetUnits = -2.0;

    this.cylinderMesh = new THREE.Mesh(cylGeo, matSide);
    this.cylinderMesh.castShadow = true;
    this.cylinderMesh.receiveShadow = true;
    this.cylinderMesh.renderOrder = 20;
    this.group.add(this.cylinderMesh);

    // 1.5 金属插针 (从底面延伸至绣布孔眼内 Z=0，防止悬浮感，使纽扣牢牢扎根于孔位)
    const stemGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.25, 16);
    stemGeo.rotateX(Math.PI / 2);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x9aa2af,
      roughness: 0.3,
      metalness: 0.7
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.z = -0.11;
    this.group.add(stemMesh);

    // 2. 顶部正立编号圆盘 (CircleGeometry 天然正立、无镜像、无 UV 扭曲，自带球光镜面质感)
    const numTexture = this.createNumberTexture(ropeId, color);
    const discGeo = new THREE.CircleGeometry(pinRadius * 0.98, 36);
    const discMat = new THREE.MeshStandardMaterial({
      map: numTexture,
      roughness: 0.18,
      metalness: 0.02
    });
    discMat.polygonOffset = true;
    discMat.polygonOffsetFactor = -4.0;
    discMat.polygonOffsetUnits = -4.0;

    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.position.z = pinHeight * 0.5 + 0.002;
    discMesh.castShadow = true;
    discMesh.receiveShadow = true;
    discMesh.renderOrder = 25;
    this.group.add(discMesh);

    // 3. 触控拾取判定盒 (Hitbox)，精确适配 22 孔位避免重叠
    const hitGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.40, 16);
    hitGeo.rotateX(Math.PI / 2);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    this.group.add(hitMesh);

    // 挂载数据用于射线拾取
    this.group.userData = {
      isPin: true,
      ropeId: ropeId,
      endType: endType,
      pinInstance: this
    };
  }

  public isUntangling: boolean = false;
  private isSinking: boolean = false;
  private sinkProgress: number = 0;

  public sinkAndFadeOut(): void {
    this.isSinking = true;
    this.sinkProgress = 0;
  }

  /**
   * 获取绳索端头在 3D 空间的物理吸附点 (实时紧随图钉底部孔位)
   */
  public getAttachmentPosition(out: THREE.Vector3): THREE.Vector3 {
    out.copy(this.group.position);
    if (this.isDragging) {
      out.z = Math.max(0.12, this.group.position.z - 0.16);
    } else {
      out.z = 0.04; // 静止时牢牢深扎在孔眼底部，永远位于纽扣帽头下方
    }
    return out;
  }

  private createNumberTexture(num: number, bgColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const cx = 128;
    const cy = 128;
    const r = 124;

    // 1. 真实球冠光泽立体渐变 (左上方柔和高光点，右下方立体阴影，与视频树脂纽扣 1:1)
    const baseGrad = ctx.createRadialGradient(cx - 36, cy - 40, 10, cx, cy, r);
    baseGrad.addColorStop(0, '#ffffff'); // 顶部微偏左高光
    baseGrad.addColorStop(0.22, bgColor);
    baseGrad.addColorStop(0.8, bgColor);
    baseGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.42)'); // 边缘暗部倒角
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. 细微亮边提亮光圈
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 视频原版正立加粗圆润数字 (Bold Rounded Centered Number)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 156px "Arial Rounded MT Bold", "PingFang SC", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.fillText(`${num}`, 0, 6);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  public setDragging(dragging: boolean): void {
    this.isDragging = dragging;
  }

  public setPosition(x: number, y: number, z?: number): void {
    this.targetPosition.x = x;
    this.targetPosition.y = y;
    if (z !== undefined) {
      this.targetPosition.z = z;
    }
  }

  public update(lerpFactor: number = 0.25): void {
    if (this.isUntangling) return;

    if (this.isSinking) {
      this.sinkProgress = Math.min(1.0, this.sinkProgress + 0.05);
      const s = Math.max(0.0, 1.0 - this.sinkProgress);
      this.group.scale.set(s, s, s);
      this.group.position.z -= 0.04;
      if (this.sinkProgress >= 1.0) {
        this.group.visible = false;
      }
      return;
    }

    const desiredZ = this.isDragging ? this.liftZ : this.baseZ;
    const desiredScale = this.isDragging ? 1.25 : 1.0;

    this.group.position.x += (this.targetPosition.x - this.group.position.x) * lerpFactor;
    this.group.position.y += (this.targetPosition.y - this.group.position.y) * lerpFactor;
    this.group.position.z += (desiredZ - this.group.position.z) * lerpFactor;

    const currentScale = this.group.scale.x;
    const newScale = currentScale + (desiredScale - currentScale) * lerpFactor;
    this.group.scale.set(newScale, newScale, newScale);
  }
}
