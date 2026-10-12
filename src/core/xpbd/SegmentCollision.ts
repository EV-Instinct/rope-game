import * as THREE from 'three';
import { Particle } from './Particle.ts';

const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w0 = new THREE.Vector3();
const _diff = new THREE.Vector3();
const _n = new THREE.Vector3();
const _tempP = new THREE.Vector3();
const _tempQ = new THREE.Vector3();

/**
 * 空间两线段最短距离与最近点求解 (Closest Points between Two 3D Line Segments)
 */
function closestPointsOnSegments(
  p1: THREE.Vector3, p2: THREE.Vector3,
  q1: THREE.Vector3, q2: THREE.Vector3,
  outP: THREE.Vector3, outQ: THREE.Vector3
): { s: number; t: number; distSq: number } {
  _u.subVectors(p2, p1);
  _v.subVectors(q2, q1);
  _w0.subVectors(p1, q1);

  const a = _u.dot(_u);
  const b = _u.dot(_v);
  const c = _v.dot(_v);
  const d = _u.dot(_w0);
  const e = _v.dot(_w0);

  const denom = a * c - b * b;
  let sN: number, sD = denom;
  let tN: number, tD = denom;

  const EPS = 1e-6;

  if (denom < EPS) {
    sN = 0.0;
    sD = 1.0;
    tN = e;
    tD = c;
  } else {
    sN = (b * e - c * d);
    tN = (a * e - b * d);

    if (sN < 0.0) {
      sN = 0.0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0.0) {
    tN = 0.0;
    if (-d < 0.0) sN = 0.0;
    else if (-d > a) sN = sD;
    else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if ((-d + b) < 0.0) sN = 0.0;
    else if ((-d + b) > a) sN = sD;
    else {
      sN = (-d + b);
      sD = a;
    }
  }

  const s = Math.abs(sN) < EPS ? 0.0 : sN / sD;
  const t = Math.abs(tN) < EPS ? 0.0 : tN / tD;

  outP.copy(p1).addScaledVector(_u, s);
  outQ.copy(q1).addScaledVector(_v, t);

  _diff.subVectors(outP, outQ);
  return { s, t, distSq: _diff.lengthSq() };
}

/**
 * 线段-线段连续胶囊体碰撞约束 (XPBD Segment-Segment Collision)
 */
export class SegmentCollision {
  /**
   * 解算两段绳索微元之间的胶囊体碰撞与排斥
   */
  public static solveSegmentPair(
    a1: Particle, a2: Particle,
    b1: Particle, b2: Particle,
    minDist: number
  ): boolean {
    const { s, t, distSq } = closestPointsOnSegments(
      a1.position, a2.position,
      b1.position, b2.position,
      _tempP, _tempQ
    );

    const minDistSq = minDist * minDist;
    if (distSq >= minDistSq) {
      return false; // 未碰撞
    }

    const dist = Math.sqrt(distSq);
    if (dist < 1e-6) {
      // 若几乎重合，以Z轴正负方向强制分离，避免除以0
      _n.set(0, 0, 1);
    } else {
      _n.subVectors(_tempP, _tempQ).multiplyScalar(1.0 / dist);
    }

    const penetration = minDist - dist;

    // 根据插值参数 s, t 计算两接触点的等效逆质量
    const s1 = 1.0 - s;
    const s2 = s;
    const t1 = 1.0 - t;
    const t2 = t;

    const wA = s1 * s1 * a1.invMass + s2 * s2 * a2.invMass;
    const wB = t1 * t1 * b1.invMass + t2 * t2 * b2.invMass;
    const wSum = wA + wB;

    if (wSum <= 1e-6) return false;

    const delta = penetration / wSum;

    // 将修正位移精确投影回四个质点
    if (a1.invMass > 0) {
      a1.position.addScaledVector(_n, delta * s1 * a1.invMass);
    }
    if (a2.invMass > 0) {
      a2.position.addScaledVector(_n, delta * s2 * a2.invMass);
    }
    if (b1.invMass > 0) {
      b1.position.addScaledVector(_n, -delta * t1 * b1.invMass);
    }
    if (b2.invMass > 0) {
      b2.position.addScaledVector(_n, -delta * t2 * b2.invMass);
    }

    return true;
  }
}
