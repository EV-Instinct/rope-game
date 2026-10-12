import * as THREE from 'three';

export interface PegSlot {
  index: number;
  angle: number; // 弧度
  position: THREE.Vector3;
  occupiedBy: { ropeId: number; endType: 'A' | 'B' } | null;
}

export interface MotifTarget {
  id: number;
  name: string;
  px: number; // pixel X in 1080
  py: number; // pixel Y in 1920
  wx: number; // Three.js world X
  wy: number; // Three.js world Y
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
}

export interface LevelRopeData {
  id: number;
  name: string;
  color: string;
  slotA: number; // 端点 A 槽位
  slotB: number; // 端点 B 槽位
  twistWith?: number; // 是否与某绳索初始有麻花螺旋缠绕
  twistTurns?: number;
  targetMotifId: number;
}

/**
 * 关卡与孔位布局配置 (10.11 高品质美术素材精确对齐)
 * 24 个真实刺绣穿线孔眼 (15°均分) + 11 个浪漫刺绣礼物图案
 */
export class LevelConfig {
  public static readonly TOTAL_SLOTS = 22;   // 22 个真实刺绣穿线孔眼 (严格对齐 board_bg.png)
  public static readonly RING_CENTER_X = -0.0082;
  public static readonly RING_CENTER_Y = -0.3000;
  public static readonly RADIUS_X = 1.0950;
  public static readonly RADIUS_Y = 1.0850;

  /**
   * 22 个真实刺绣穿线孔眼 (严格对齐 board_bg.png 真实缝线小圆孔中心像素坐标)
   */
  public static readonly SLOT_PIXEL_COORDS: [number, number][] = [
    [576, 780],  // Slot  0 (12:15)
    [646, 802],  // Slot  1 (1:00)
    [708, 844],  // Slot  2 (1:45)
    [753, 897],  // Slot  3 (2:15)
    [786, 966],  // Slot  4 (2:45)
    [792, 1032], // Slot  5 (3:15)
    [782, 1103], // Slot  6 (3:45)
    [754, 1172], // Slot  7 (4:15)
    [708, 1229], // Slot  8 (4:45)
    [646, 1269], // Slot  9 (5:15)
    [576, 1283], // Slot 10 (6:15)
    [504, 1284], // Slot 11 (6:45)
    [435, 1264], // Slot 12 (7:15)
    [376, 1232], // Slot 13 (7:45)
    [325, 1173], // Slot 14 (8:15)
    [290, 1106], // Slot 15 (8:45)
    [284, 1033], // Slot 16 (9:15)
    [294, 967],  // Slot 17 (9:45)
    [324, 893],  // Slot 18 (10:15)
    [373, 844],  // Slot 19 (10:45)
    [434, 800],  // Slot 20 (11:15)
    [504, 780],  // Slot 21 (12:00 left)
  ];

  /**
   * 11 个浪漫刺绣线稿礼物图案数据 (严格对齐 embroidery_motifs.png，像素级独立边界)
   */
  public static readonly MOTIFS: MotifTarget[] = [
    { id: 1, name: '心形礼盒', px: 539.0, py: 605.2, wx: -0.0042, wy: 1.4581, bbox: [425, 467, 662, 726] },
    { id: 2, name: '玫瑰花篮', px: 783.7, py: 689.5, wx: 1.0017, wy: 1.1116, bbox: [682, 546, 904, 803] },
    { id: 3, name: '方形礼盒', px: 924.8, py: 866.3, wx: 1.5815, wy: 0.3850, bbox: [810, 768, 1039, 971] },
    { id: 4, name: '小熊花篮', px: 935.2, py: 1093.8, wx: 1.6242, wy: -0.5498, bbox: [825, 991, 1057, 1198] },
    { id: 5, name: '爱心情书', px: 859.2, py: 1308.4, wx: 1.3117, wy: -1.4318, bbox: [736, 1206, 972, 1399] },
    { id: 6, name: '羽翼小熊', px: 652.9, py: 1424.9, wx: 0.4640, wy: -1.9107, bbox: [549, 1307, 764, 1546] },
    { id: 7, name: '玫瑰手捧花', px: 419.1, py: 1409.6, wx: -0.4970, wy: -1.8479, bbox: [316, 1314, 528, 1530] },
    { id: 8, name: '心形巧克力', px: 227.7, py: 1298.4, wx: -1.2836, wy: -1.3908, bbox: [138, 1210, 332, 1381] },
    { id: 9, name: '福袋礼包', px: 125.2, py: 1086.5, wx: -1.7046, wy: -0.5199, bbox: [32, 963, 216, 1196] },
    { id: 10, name: '小熊挂件', px: 171.1, py: 858.8, wx: -1.5162, wy: 0.4161, bbox: [94, 721, 239, 952] },
    { id: 11, name: '玫瑰蛋糕', px: 281.9, py: 666.3, wx: -1.0607, wy: 1.2072, bbox: [142, 555, 458, 786] },
  ];

  /**
   * 生成 22 个孔位的空间坐标 (基于 1080x1920 背景纹理中的真实缝线小圆孔像素坐标精确换算)
   */
  public static generateSlots(): PegSlot[] {
    const slots: PegSlot[] = [];
    const scaleX = 4.4386 / 1080;
    const scaleY = 7.8909 / 1920;

    for (let i = 0; i < this.TOTAL_SLOTS; i++) {
      const [px, py] = this.SLOT_PIXEL_COORDS[i];
      const wx = (px - 540) * scaleX;
      const wy = (960 - py) * scaleY;
      const angle = Math.atan2(wy - this.RING_CENTER_Y, wx - this.RING_CENTER_X);

      slots.push({
        index: i,
        angle: angle,
        position: new THREE.Vector3(wx, wy, 0),
        occupiedBy: null
      });
    }

    return slots;
  }

  /**
   * 6 条绳索在 22 孔位下的精确站位与麻花螺旋缠绕关系：
   * - 绿 1 (emerald): 槽位 0 (12:15)  <-> 槽位 10 (6:15) (纵贯直穿)
   * - 蓝 2 (ocean):   槽位 17 (9:45)   <-> 槽位 5 (3:15)  (上部平跨)
   * - 粉 3 (rose):    槽位 1 (1:00)    <-> 槽位 13 (7:45) (斜穿中轴，与红4螺旋麻花拧结)
   * - 红 4 (crimson): 槽位 21 (12:00)  <-> 槽位 11 (6:45) (斜穿中轴，与粉3螺旋麻花拧结)
   * - 橙 5 (orange):  槽位 16 (9:15)   <-> 槽位 8 (4:45)  (下部平跨，跨越绿1)
   * - 紫 6 (purple):  槽位 19 (10:45)  <-> 槽位 6 (3:45)  (对角穿跨)
   */
  public static readonly ROPES_DATA: LevelRopeData[] = [
    {
      id: 1,
      name: '翠绿',
      color: '#2ea858',
      slotA: 0,
      slotB: 10,
      targetMotifId: 2 // 对应玫瑰花篮
    },
    {
      id: 2,
      name: '海蓝',
      color: '#207cd4',
      slotA: 17,
      slotB: 5,
      targetMotifId: 9 // 对应福袋礼包
    },
    {
      id: 3,
      name: '粉红',
      color: '#e63978',
      slotA: 1,
      slotB: 13,
      twistWith: 4,
      twistTurns: 1.5,
      targetMotifId: 1 // 对应心形礼盒
    },
    {
      id: 4,
      name: '中国红',
      color: '#e52b2b',
      slotA: 21,
      slotB: 11,
      twistWith: 3,
      twistTurns: -1.5,
      targetMotifId: 5 // 对应爱心情书
    },
    {
      id: 5,
      name: '蜜橙',
      color: '#f77f00',
      slotA: 16,
      slotB: 8,
      twistWith: 1,
      targetMotifId: 7 // 对应玫瑰手捧花
    },
    {
      id: 6,
      name: '紫罗兰',
      color: '#8438ec',
      slotA: 19,
      slotB: 6,
      targetMotifId: 3 // 对应方形礼盒
    }
  ];

}
