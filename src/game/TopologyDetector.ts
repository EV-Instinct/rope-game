import * as THREE from 'three';
import { Rope } from '../core/xpbd/Rope.ts';
import type { PegSlot } from './LevelConfig.ts';

const _p1 = new THREE.Vector2();
const _p2 = new THREE.Vector2();
const _q1 = new THREE.Vector2();
const _q2 = new THREE.Vector2();

/**
 * 2D 两线段是否相交检测 (Segment-Segment Intersection)
 */
function doSegmentsIntersect(
  a: THREE.Vector2, b: THREE.Vector2,
  c: THREE.Vector2, d: THREE.Vector2
): boolean {
  // 叉积判向
  const ccw = (p1: THREE.Vector2, p2: THREE.Vector2, p3: THREE.Vector2): number => {
    return (p3.y - p1.y) * (p2.x - p1.x) - (p2.y - p1.y) * (p3.x - p1.x);
  };

  const d1 = ccw(a, b, c);
  const d2 = ccw(a, b, d);
  const d3 = ccw(c, d, a);
  const d4 = ccw(c, d, b);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  return false;
}

/**
 * 拓扑解开检测器 (Untangle & Topology Crossing Detector)
 * 判定某条绳索是否已彻底脱困（与场上其他所有活跃绳索 0 交叉、0 缠绕）
 */
export class TopologyDetector {
  /**
   * 检查指定绳索与场上其它活跃绳索的相交/缠绕数量
   * @param targetRope 待检测绳索
   * @param allRopes 场上所有绳索
   * @param slots 孔位集合
   * @returns 交叉的绳索列表
   */
  public static getCrossings(
    targetRope: Rope,
    allRopes: Rope[],
    slots: PegSlot[]
  ): Rope[] {
    if (targetRope.state !== 'active') return [];

    const crossedRopes: Rope[] = [];
    const targetA = slots[targetRope.pegAIndex].position;
    const targetB = slots[targetRope.pegBIndex].position;

    _p1.set(targetA.x, targetA.y);
    _p2.set(targetB.x, targetB.y);

    for (const other of allRopes) {
      if (other.id === targetRope.id || other.state !== 'active') continue;

      const otherA = slots[other.pegAIndex].position;
      const otherB = slots[other.pegBIndex].position;

      _q1.set(otherA.x, otherA.y);
      _q2.set(otherB.x, otherB.y);

      // 圆环刺绣绳索拓扑相交判定的充要条件：和弦相交
      if (doSegmentsIntersect(_p1, _p2, _q1, _q2)) {
        crossedRopes.push(other);
      }
    }

    return crossedRopes;
  }

  /**
   * 折线采样相交二次核验
   */
  private static checkPolylineIntersection(ropeA: Rope, ropeB: Rope): boolean {
    const partsA = ropeA.particles;
    const partsB = ropeB.particles;
    const lenA = partsA.length;
    const lenB = partsB.length;

    // 稀疏采样 5 段折线快速比对
    const stepA = Math.max(1, Math.floor(lenA / 6));
    const stepB = Math.max(1, Math.floor(lenB / 6));

    const segA1 = new THREE.Vector2();
    const segA2 = new THREE.Vector2();
    const segB1 = new THREE.Vector2();
    const segB2 = new THREE.Vector2();

    for (let i = 0; i < lenA - stepA; i += stepA) {
      segA1.set(partsA[i].position.x, partsA[i].position.y);
      segA2.set(partsA[i + stepA].position.x, partsA[i + stepA].position.y);

      for (let j = 0; j < lenB - stepB; j += stepB) {
        segB1.set(partsB[j].position.x, partsB[j].position.y);
        segB2.set(partsB[j + stepB].position.x, partsB[j + stepB].position.y);

        if (doSegmentsIntersect(segA1, segA2, segB1, segB2)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 判断绳索是否已完全自由 (0 交叉)
   */
  public static isRopeFree(
    rope: Rope,
    allRopes: Rope[],
    slots: PegSlot[]
  ): boolean {
    const crossings = this.getCrossings(rope, allRopes, slots);
    return crossings.length === 0;
  }
}
