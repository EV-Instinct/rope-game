import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = 'test_screenshots';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runFullGameSolve() {
  console.log('=== 运行 6 根丝线全通大满贯自动化测试 ===');
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

  async function dragPin(ropeId, endType, targetSlot) {
    const fromPos = await page.evaluate((rId, eType) => {
      return window.__GAME__.getPinScreenPos(rId, eType);
    }, ropeId, endType);

    const toPos = await page.evaluate((sIdx) => {
      return window.__GAME__.getSlotScreenPos(sIdx);
    }, targetSlot);

    await page.mouse.move(fromPos.x, fromPos.y);
    await page.mouse.down();
    await sleep(60);

    const steps = 18;
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
    await sleep(450);
  }

  // 步骤 1: 蓝2(B) -> 槽位18 (解开第1条：海蓝)
  console.log('步骤 1: 蓝2(B) -> 槽位18');
  await dragPin(2, 'B', 18);
  await sleep(700);

  // 步骤 2: 紫6(B) -> 槽位20 (解开第2条：紫罗兰)
  console.log('步骤 2: 紫6(B) -> 槽位20');
  await dragPin(6, 'B', 20);
  await sleep(700);

  // 步骤 3: 橙5(B) -> 槽位15 (解开第3条：蜜橙)
  console.log('步骤 3: 橙5(B) -> 槽位15');
  await dragPin(5, 'B', 15);
  await sleep(700);

  // 步骤 4: 绿1(A) -> 槽位9 (解开第4条：翠绿)
  console.log('步骤 4: 绿1(A) -> 槽位9');
  await dragPin(1, 'A', 9);
  await sleep(700);

  // 步骤 5: 粉3(B) -> 槽位2 (解开第5条：粉红)
  console.log('步骤 5: 粉3(B) -> 槽位2');
  await dragPin(3, 'B', 2);
  await sleep(700);

  // 步骤 6: 此时红4无任何交叉绳索，移动端点触发脱困判定
  console.log('步骤 6: 触发最后一条红4解开');
  await dragPin(4, 'B', 12);
  await sleep(700);

  let state = await page.evaluate(() => window.__GAME__.getGameState());
  console.log('全解开后状态:', JSON.stringify(state.ropes.map(r => `${r.name}:${r.state}`)));
  console.log('最终解开数:', state.untangledCount);

  // 等待全幅刺绣大圆满连环烟花盛开与胜利弹窗
  await sleep(3200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'gameplay_grand_victory_final.png') });

  await browser.close();
  console.log('=== 6 根丝线全通大满贯测试圆满完成！===');
}

runFullGameSolve().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
