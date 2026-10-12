import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = 'test_screenshots';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runDragUntangleTest() {
  console.log('=== 运行真实拖拽解线与刺绣显色连动测试 ===');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=d3d11']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });

  page.on('console', msg => console.log('[Console]:', msg.text()));
  page.on('pageerror', err => console.error('[PageError]:', err.message));

  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => window.__GAME__ !== undefined);
  await sleep(1000);

  // 辅助拖拽函数
  async function dragPin(ropeId, endType, targetSlot) {
    const fromPos = await page.evaluate((rId, eType) => {
      return window.__GAME__.getPinScreenPos(rId, eType);
    }, ropeId, endType);

    const toPos = await page.evaluate((sIdx) => {
      return window.__GAME__.getSlotScreenPos(sIdx);
    }, targetSlot);

    console.log(`执行拖拽: 绳索${ropeId}(${endType}) [${Math.round(fromPos.x)}, ${Math.round(fromPos.y)}] -> 槽位${targetSlot} [${Math.round(toPos.x)}, ${Math.round(toPos.y)}]`);
    await page.mouse.move(fromPos.x, fromPos.y);
    await page.mouse.down();
    await sleep(60);

    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const alpha = i / steps;
      await page.mouse.move(
        fromPos.x + (toPos.x - fromPos.x) * alpha,
        fromPos.y + (toPos.y - fromPos.y) * alpha
      );
      await sleep(15);
    }
    await sleep(60);
    await page.mouse.up();
    await sleep(500); // 等待求解器落孔与拓扑判定
  }

  // 1. 拖拽蓝2 (B端，原槽位5) 移动到 空槽位 18 (与A端槽位17相邻)
  console.log('操作 1: 拖拽蓝2(B) -> 槽位18 (形成无交叉净空，解开蓝线)');
  await dragPin(2, 'B', 18);

  // 检查状态
  let state = await page.evaluate(() => window.__GAME__.getGameState());
  console.log('拖拽后状态:', JSON.stringify(state.ropes.map(r => `${r.name}:${r.state}`)));
  console.log('已解开计数:', state.untangledCount);

  // 等待抽丝飞翔与福袋礼包刺绣展开
  await sleep(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'gameplay_untangle_blue_revealed.png') });

  // 2. 拖拽紫6 (B端，原槽位6) 移动到 空槽位 20 (与A端槽位19相邻)
  console.log('操作 2: 拖拽紫6(B) -> 槽位20 (形成无交叉净空，解开紫线)');
  await dragPin(6, 'B', 20);

  state = await page.evaluate(() => window.__GAME__.getGameState());
  console.log('拖拽后状态:', JSON.stringify(state.ropes.map(r => `${r.name}:${r.state}`)));
  console.log('已解开计数:', state.untangledCount);

  // 等待方形礼盒刺绣展开
  await sleep(1200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'gameplay_untangle_purple_revealed.png') });

  await browser.close();
  console.log('=== 真实拖拽测试顺利完成！===');
}

runDragUntangleTest().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
