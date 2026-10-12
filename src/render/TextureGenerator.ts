import * as THREE from 'three';

/**
 * 程序化高品质纹理生成器 (Procedural Texture Generator)
 * 零外部依赖，100% 离线自给自足，生成丝线法线、亚麻刺绣布面、木纹等
 */
export class TextureGenerator {
  /**
   * 生成加捻刺绣丝线法线贴图 (Twisted Floss Normal Map)
   * 模拟 3 股或 4 股加捻生丝在圆柱管道上的螺旋纹理
   */
  public static createTwistedFlossNormalMap(width: number = 512, height: number = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const strands = 3.0; // 3股加捻
    const twistAngle = 1.2; // 螺旋倾角

    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;

        // 沿对角螺旋方向计算高度场
        const phase = (u * strands + v * twistAngle * strands) * Math.PI * 2.0;
        const heightVal = Math.sin(phase);

        // 计算数值偏导数
        const dPhaseDu = strands * Math.PI * 2.0;
        const dPhaseDv = twistAngle * strands * Math.PI * 2.0;
        const dhdu = Math.cos(phase) * dPhaseDu * 0.35;
        const dhdv = Math.cos(phase) * dPhaseDv * 0.35;

        // 构成切线空间法线向量 [-dhdu, -dhdv, 1] 归一化
        let nx = -dhdu;
        let ny = -dhdv;
        let nz = 1.0;
        const len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;
        nz /= len;

        // 映射到 [0, 255] RGB 法线图格式
        const idx = (y * width + x) * 4;
        data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 8); // 在管道上高频平铺
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 生成天然棉麻刺绣布纹底图 (Linen Fabric Texture)
   */
  public static createLinenFabricTexture(size: number = 1024): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 底色：温和的天然米白亚麻色
    ctx.fillStyle = '#f3ede2';
    ctx.fillRect(0, 0, size, size);

    // 细致的经纬纱线交织效果 (Warp and Weft)
    const step = 4;
    for (let x = 0; x < size; x += step) {
      const alpha = 0.04 + Math.random() * 0.04;
      ctx.fillStyle = `rgba(180, 160, 140, ${alpha})`;
      ctx.fillRect(x, 0, step * 0.7, size);
    }
    for (let y = 0; y < size; y += step) {
      const alpha = 0.04 + Math.random() * 0.04;
      ctx.fillStyle = `rgba(160, 140, 120, ${alpha})`;
      ctx.fillRect(0, y, size, step * 0.7);
    }

    // 亚麻纤维杂质微颗粒 (Slub Yarn Texture)
    for (let i = 0; i < 2500; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const len = 3 + Math.random() * 8;
      const angle = (Math.random() > 0.5 ? 0 : Math.PI * 0.5) + (Math.random() - 0.5) * 0.2;
      ctx.strokeStyle = `rgba(140, 120, 100, ${0.08 + Math.random() * 0.1})`;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 生成竹木绣绷纹理 (Bamboo / Wood Texture)
   */
  public static createWoodTexture(size: number = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 渐变木质底色
    const grad = ctx.createLinearGradient(0, 0, size, 0);
    grad.addColorStop(0, '#cda177');
    grad.addColorStop(0.3, '#dfba94');
    grad.addColorStop(0.7, '#be9167');
    grad.addColorStop(1, '#d8b088');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // 木纹年轮微细线条
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * size;
      ctx.strokeStyle = `rgba(130, 85, 45, ${0.05 + Math.random() * 0.1})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + (Math.random() - 0.5) * 20, size * 0.33,
        x + (Math.random() - 0.5) * 20, size * 0.66,
        x + (Math.random() - 0.5) * 10, size
      );
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 生成真实视频 1:1 浅灰白水洗竖向木板壁面纹理 (Vertical Whitewashed Wood Planks)
   */
  public static createWhitewashedWoodTexture(size: number = 1024): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 底色：米白水洗木质底色
    ctx.fillStyle = '#f3efe8';
    ctx.fillRect(0, 0, size, size);

    // 竖向木板拼接缝 (每块木板宽约 128px，共 8 块)
    const plankWidth = 128;
    for (let x = 0; x < size; x += plankWidth) {
      // 木板个体轻微明暗差异
      const plankShade = (Math.random() - 0.5) * 8;
      ctx.fillStyle = `rgba(${plankShade > 0 ? 255 : 0}, ${plankShade > 0 ? 255 : 0}, ${plankShade > 0 ? 255 : 0}, ${Math.abs(plankShade) / 255})`;
      ctx.fillRect(x, 0, plankWidth, size);

      // 板缝左侧立体阴影沟槽
      ctx.strokeStyle = 'rgba(165, 155, 142, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();

      // 板缝右侧微亮边缘高光
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 2, 0);
      ctx.lineTo(x + 2, size);
      ctx.stroke();
    }

    // 细腻竖向天然原木木纹与木孔肌理
    for (let i = 0; i < 180; i++) {
      const px = Math.random() * size;
      ctx.strokeStyle = `rgba(175, 165, 152, ${0.03 + Math.random() * 0.06})`;
      ctx.lineWidth = 0.8 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.bezierCurveTo(
        px + (Math.random() - 0.5) * 8, size * 0.33,
        px + (Math.random() - 0.5) * 8, size * 0.66,
        px + (Math.random() - 0.5) * 5, size
      );
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 1.5);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 绘制刺绣蝴蝶图案 (灰度线稿 与 彩色真丝刺绣版本)
   */
  public static drawButterfly(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    size: number,
    angle: number,
    isEmbroidered: boolean,
    colorHex: string = '#8338ec'
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const s = size / 100;

    if (!isEmbroidered) {
      // 灰度虚线刺绣线稿 (清晰加粗，匹配 2048 画布尺寸)
      ctx.strokeStyle = 'rgba(95, 85, 75, 0.65)';
      ctx.lineWidth = 4.5;
      ctx.setLineDash([10, 7]);

      // 左前翅
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.bezierCurveTo(-35 * s, -50 * s, -70 * s, -20 * s, -45 * s, 10 * s);
      ctx.bezierCurveTo(-25 * s, 15 * s, -10 * s, 5 * s, 0, 0);
      ctx.stroke();

      // 右前翅
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.bezierCurveTo(35 * s, -50 * s, 70 * s, -20 * s, 45 * s, 10 * s);
      ctx.bezierCurveTo(25 * s, 15 * s, 10 * s, 5 * s, 0, 0);
      ctx.stroke();

      // 左后翅
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-40 * s, 20 * s, -35 * s, 50 * s, -15 * s, 45 * s);
      ctx.bezierCurveTo(-5 * s, 35 * s, 0, 20 * s, 0, 10 * s);
      ctx.stroke();

      // 右后翅
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(40 * s, 20 * s, 35 * s, 50 * s, 15 * s, 45 * s);
      ctx.bezierCurveTo(5 * s, 35 * s, 0, 20 * s, 0, 10 * s);
      ctx.stroke();

      // 翅膀内侧刺绣脉络纹 (Vein Stitching)
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(-15 * s, -5 * s);
      ctx.quadraticCurveTo(-35 * s, -20 * s, -45 * s, -10 * s);
      ctx.moveTo(15 * s, -5 * s);
      ctx.quadraticCurveTo(35 * s, -20 * s, 45 * s, -10 * s);
      ctx.stroke();

      // 蝶身与触须
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(70, 60, 50, 0.75)';
      ctx.lineWidth = 6.0;
      ctx.beginPath();
      ctx.moveTo(0, -18 * s);
      ctx.lineTo(0, 22 * s);
      ctx.stroke();

      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, -18 * s);
      ctx.quadraticCurveTo(-15 * s, -35 * s, -22 * s, -38 * s);
      ctx.moveTo(0, -18 * s);
      ctx.quadraticCurveTo(15 * s, -35 * s, 22 * s, -38 * s);
      ctx.stroke();

    } else {
      // 饱满绚丽的国风真丝苏绣质感 (Photorealistic Satin Stitch Silk Embroidery)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // 1. 翅膀真丝底层
      const baseGrad = ctx.createRadialGradient(0, 0, 5 * s, 0, 0, 75 * s);
      baseGrad.addColorStop(0, '#ffffff');
      baseGrad.addColorStop(0.2, colorHex);
      baseGrad.addColorStop(0.8, colorHex);
      baseGrad.addColorStop(1, '#1a1025');

      // 左前翅底
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.bezierCurveTo(-35 * s, -52 * s, -75 * s, -22 * s, -48 * s, 12 * s);
      ctx.bezierCurveTo(-26 * s, 16 * s, -10 * s, 6 * s, 0, 0);
      ctx.closePath();
      ctx.fill();

      // 右前翅底
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.bezierCurveTo(35 * s, -52 * s, 75 * s, -22 * s, 48 * s, 12 * s);
      ctx.bezierCurveTo(26 * s, 16 * s, 10 * s, 6 * s, 0, 0);
      ctx.closePath();
      ctx.fill();

      // 左后翅底
      const lowerGrad = ctx.createRadialGradient(0, 20 * s, 4 * s, 0, 20 * s, 50 * s);
      lowerGrad.addColorStop(0, '#e0f2fe');
      lowerGrad.addColorStop(0.4, colorHex);
      lowerGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = lowerGrad;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-42 * s, 22 * s, -38 * s, 54 * s, -16 * s, 48 * s);
      ctx.bezierCurveTo(-5 * s, 36 * s, 0, 20 * s, 0, 10 * s);
      ctx.closePath();
      ctx.fill();

      // 右后翅底
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(42 * s, 22 * s, 38 * s, 54 * s, 16 * s, 48 * s);
      ctx.bezierCurveTo(5 * s, 36 * s, 0, 20 * s, 0, 10 * s);
      ctx.closePath();
      ctx.fill();

      ctx.shadowColor = 'transparent';

      // 2. 模拟真实苏绣“齐针/滚针”细密平行真丝排线 (Silk Thread Stitches)
      ctx.lineWidth = 1.0;
      for (let i = -40; i <= 40; i += 2.5) {
        const xOffset = i * s;
        // 前翅斜向蚕丝丝缕
        ctx.strokeStyle = (i % 5 === 0) ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, -5 * s);
        ctx.lineTo(xOffset * 1.5, -28 * s + Math.abs(i) * 0.4 * s);
        ctx.stroke();

        // 后翅放射状下垂丝线
        if (Math.abs(i) < 32) {
          ctx.strokeStyle = (i % 6 === 0) ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.2)';
          ctx.beginPath();
          ctx.moveTo(0, 8 * s);
          ctx.lineTo(xOffset * 0.9, 42 * s);
          ctx.stroke();
        }
      }

      // 3. 前翅顶端“苏绣白黄渐变彩锦纹” (Crest Accents)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-42 * s, -28 * s, 10 * s, 4 * s, -0.4, 0, Math.PI * 2);
      ctx.ellipse(42 * s, -28 * s, 10 * s, 4 * s, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(-40 * s, -25 * s, 8 * s, 3.5 * s, -0.4, 0, Math.PI * 2);
      ctx.ellipse(40 * s, -25 * s, 8 * s, 3.5 * s, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // 4. 翅边缘手工盘金绣/橙金绣锁边 (Gold Embroidery Filigree)
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3.2;
      // 左前
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.bezierCurveTo(-35 * s, -52 * s, -75 * s, -22 * s, -48 * s, 12 * s);
      ctx.bezierCurveTo(-26 * s, 16 * s, -10 * s, 6 * s, 0, 0);
      ctx.stroke();
      // 右前
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.bezierCurveTo(35 * s, -52 * s, 75 * s, -22 * s, 48 * s, 12 * s);
      ctx.bezierCurveTo(26 * s, 16 * s, 10 * s, 6 * s, 0, 0);
      ctx.stroke();
      // 左后
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-42 * s, 22 * s, -38 * s, 54 * s, -16 * s, 48 * s);
      ctx.bezierCurveTo(-5 * s, 36 * s, 0, 20 * s, 0, 10 * s);
      ctx.stroke();
      // 右后
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(42 * s, 22 * s, 38 * s, 54 * s, 16 * s, 48 * s);
      ctx.bezierCurveTo(5 * s, 36 * s, 0, 20 * s, 0, 10 * s);
      ctx.stroke();

      // 5. 蝶身刺绣 (黑金段染生丝身体 + 节段分明环状刺绣)
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(0, 6 * s, 4.5 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // 蝶身节段金线纹
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      for (let y = -4; y <= 16; y += 4) {
        ctx.beginPath();
        ctx.moveTo(-3.5 * s, y * s);
        ctx.lineTo(3.5 * s, y * s);
        ctx.stroke();
      }

      // 金黄色丝线刺绣触须 (Yellow Floss Antennae)
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -10 * s);
      ctx.quadraticCurveTo(-14 * s, -32 * s, -20 * s, -35 * s);
      ctx.moveTo(0, -10 * s);
      ctx.quadraticCurveTo(14 * s, -32 * s, 20 * s, -35 * s);
      ctx.stroke();

      // 触须端头圆点刺绣
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(-20 * s, -35 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.arc(20 * s, -35 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
