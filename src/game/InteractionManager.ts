import * as THREE from 'three';
import { PinMesh } from '../render/PinMesh.ts';
import { Rope } from '../core/xpbd/Rope.ts';
import { EmbroideryBoard } from '../render/EmbroideryBoard.ts';
import { SoundManager } from './SoundManager.ts';
import { LevelConfig, type PegSlot } from './LevelConfig.ts';

export interface InteractionCallbacks {
  onPinMoved: (rope: Rope, endType: 'A' | 'B', oldSlot: number, newSlot: number) => void;
}

/**
 * 玩家触控与拖拽交互管理器 (Pin Interaction & Peg Snapping Manager)
 * 实现精准拾取、抬起、拖拽跟随、合法孔位呼吸高亮与平滑磁吸附
 */
export class InteractionManager {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private board: EmbroideryBoard;
  private ropes: Rope[];
  private pins: PinMesh[];
  private callbacks: InteractionCallbacks;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mousePos: THREE.Vector2 = new THREE.Vector2();

  private selectedPin: PinMesh | null = null;
  private selectedRope: Rope | null = null;
  private originalSlotIndex: number = -1;
  private dragPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private planeIntersect: THREE.Vector3 = new THREE.Vector3();

  private snapThreshold: number = 0.30; // 磁吸判定有效距离 (对齐 22 孔位真实针脚间距)

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    board: EmbroideryBoard,
    ropes: Rope[],
    pins: PinMesh[],
    callbacks: InteractionCallbacks
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.board = board;
    this.ropes = ropes;
    this.pins = pins;
    this.callbacks = callbacks;

    this.initEvents();
  }

  private initEvents(): void {
    this.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('pointercancel', this.onPointerUp.bind(this));
  }

  private updateMouseCoords(e: PointerEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown(e: PointerEvent): void {
    this.updateMouseCoords(e);
    this.raycaster.setFromCamera(this.mousePos, this.camera);

    // 射线求交 XY 平面，获取点击处的三维空间世界坐标
    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
      const clickX = this.planeIntersect.x;
      const clickY = this.planeIntersect.y;

      // 拾取距离点击点最近且在有效半径内的图钉 (避免邻近孔位图钉拾取冲突)
      let bestPin: PinMesh | null = null;
      let minDistance = 0.28; // 允许拾取容差

      for (const p of this.pins) {
        const rope = this.ropes.find(r => r.id === p.ropeId);
        if (!rope || rope.state !== 'active') continue;

        const d = Math.hypot(p.group.position.x - clickX, p.group.position.y - clickY);
        if (d < minDistance) {
          minDistance = d;
          bestPin = p;
        }
      }

      if (bestPin) {
        const rope = this.ropes.find(r => r.id === bestPin.ropeId)!;
        this.selectedPin = bestPin;
        this.selectedRope = rope;
        this.selectedPin.setDragging(true);

        this.originalSlotIndex = (bestPin.endType === 'A')
          ? rope.pegAIndex
          : rope.pegBIndex;

        SoundManager.playPinLift();

        // 高亮所有合法空孔位
        this.highlightEmptySlots();
      }
    }
  }

  private highlightEmptySlots(): void {
    this.board.clearAllHighlights();
    for (const slot of this.board.slots) {
      if (slot.occupiedBy === null || slot.index === this.originalSlotIndex) {
        this.board.setSlotHighlight(slot.index, true, 0x4cd964);
      }
    }
  }

  private onPointerMove(e: PointerEvent): void {
    this.updateMouseCoords(e);
    this.raycaster.setFromCamera(this.mousePos, this.camera);

    // 未选中拖拽时：检测是否悬浮于某个可拾取图钉上方，触发手指光标高亮微缩放
    if (!this.selectedPin) {
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
        const hoverX = this.planeIntersect.x;
        const hoverY = this.planeIntersect.y;
        let isOverPin = false;
        for (const p of this.pins) {
          const rope = this.ropes.find(r => r.id === p.ropeId);
          if (!rope || rope.state !== 'active') continue;
          if (Math.hypot(p.group.position.x - hoverX, p.group.position.y - hoverY) < 0.24) {
            isOverPin = true;
            break;
          }
        }
        const cursorEl = document.getElementById('virtual-cursor');
        if (cursorEl) {
          if (isOverPin) cursorEl.classList.add('hovering');
          else cursorEl.classList.remove('hovering');
        }
      }
      return;
    }

    // 拖拽进行中
    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.planeIntersect)) {
      // 限制在绣绷范围内部
      const dist = Math.hypot(this.planeIntersect.x, this.planeIntersect.y);
      const maxR = 2.2;
      if (dist > maxR) {
        this.planeIntersect.multiplyScalar(maxR / dist);
      }

      this.selectedPin.setPosition(this.planeIntersect.x, this.planeIntersect.y);

      // 检测是否接近某个空孔位或原生孔位，施加变色预选提示
      const closestSlot = this.findClosestEmptySlot(this.planeIntersect);
      for (const slot of this.board.slots) {
        if (slot.occupiedBy === null || slot.index === this.originalSlotIndex) {
          if (closestSlot && slot.index === closestSlot.index) {
            this.board.setSlotHighlight(slot.index, true, 0xffd700); // 接近时变为金黄高亮
          } else {
            this.board.setSlotHighlight(slot.index, true, 0x4cd964);
          }
        }
      }
    }
  }

  private onPointerUp(): void {
    const cursorEl = document.getElementById('virtual-cursor');
    if (cursorEl) {
      cursorEl.classList.remove('pressed');
      cursorEl.classList.remove('hovering');
    }

    if (!this.selectedPin || !this.selectedRope) return;

    const pin = this.selectedPin;
    const rope = this.selectedRope;
    const endType = pin.endType;

    const currentPos = pin.group.position;
    const targetSlot = this.findClosestEmptySlot(currentPos);

    if (targetSlot) {
      const oldSlotIndex = this.originalSlotIndex;
      const newSlotIndex = targetSlot.index;

      if (newSlotIndex !== oldSlotIndex) {
        // 成功吸附落入新孔位！
        this.board.slots[oldSlotIndex].occupiedBy = null;
        targetSlot.occupiedBy = { ropeId: rope.id, endType: endType };

        const snapPos = new THREE.Vector3(targetSlot.position.x, targetSlot.position.y, 0.04);
        if (endType === 'A') {
          rope.pegAIndex = newSlotIndex;
          rope.updateAnchorA(snapPos);
        } else {
          rope.pegBIndex = newSlotIndex;
          rope.updateAnchorB(snapPos);
        }

        // 刷新约束自然静止长度，自适应绳索张力
        rope.updateRestLengths();

        pin.group.position.set(targetSlot.position.x, targetSlot.position.y, pin.group.position.z);
        pin.setPosition(targetSlot.position.x, targetSlot.position.y);
        pin.setDragging(false);
        SoundManager.playPinSnap();

        this.callbacks.onPinMoved(rope, endType, oldSlotIndex, newSlotIndex);
      } else {
        // 弹回/放回原生孔位
        const originSlot = this.board.slots[oldSlotIndex];
        const originPos = new THREE.Vector3(originSlot.position.x, originSlot.position.y, 0.04);
        if (endType === 'A') {
          rope.updateAnchorA(originPos);
        } else {
          rope.updateAnchorB(originPos);
        }
        pin.group.position.set(originSlot.position.x, originSlot.position.y, pin.group.position.z);
        pin.setPosition(originSlot.position.x, originSlot.position.y);
        pin.setDragging(false);
        SoundManager.playPinSnap();
      }
    } else {
      // 未达到吸附距离，弹回原生孔位
      const originSlot = this.board.slots[this.originalSlotIndex];
      const originPos = new THREE.Vector3(originSlot.position.x, originSlot.position.y, 0.04);
      if (endType === 'A') {
        rope.updateAnchorA(originPos);
      } else {
        rope.updateAnchorB(originPos);
      }
      pin.group.position.set(originSlot.position.x, originSlot.position.y, pin.group.position.z);
      pin.setPosition(originSlot.position.x, originSlot.position.y);
      pin.setDragging(false);
    }

    this.board.clearAllHighlights();
    this.selectedPin = null;
    this.selectedRope = null;
    this.originalSlotIndex = -1;
  }

  private findClosestEmptySlot(pos: THREE.Vector3): PegSlot | null {
    let bestSlot: PegSlot | null = null;
    let minDist = this.snapThreshold;

    for (const slot of this.board.slots) {
      // 允许目标槽位是空槽位，或者是当前正在拖拽图钉的原生所属槽位
      if (slot.occupiedBy !== null && slot.index !== this.originalSlotIndex) continue;

      const d = Math.hypot(slot.position.x - pos.x, slot.position.y - pos.y);
      if (d < minDist) {
        minDist = d;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }


  public update(): void {
    for (const pin of this.pins) {
      pin.update();
    }

    // 关键：拖拽过程中，绳索端点实时精确锁定图钉底部的真实三维高度 (包括拔起高度)
    if (this.selectedPin && this.selectedRope) {
      this.selectedPin.getAttachmentPosition(this.planeIntersect);
      if (this.selectedPin.endType === 'A') {
        this.selectedRope.updateAnchorA(this.planeIntersect, true);
      } else {
        this.selectedRope.updateAnchorB(this.planeIntersect, true);
      }
    }
  }
}
