import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = 'test_screenshots';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testUntangleVfxSequence() {
  console.log('=== 测试绳索解开新版 3D 纽扣飞跃特效序列 ===');
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

  // 拖拽蓝2 (B) -> 槽位 18 (解开蓝2)
  const fromPos = await page.evaluate(() => window.__GAME__.getPinScreenPos(2, 'B'));
  const toPos = await page.evaluate(() => window.__GAME__.getSlotScreenPos(18));

  await page.mouse.move(fromPos.x, fromPos.y);
  await page.mouse.down();
  await sleep(60);

  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const alpha = i / steps;
    await page.mouse.move(
      fromPos.x + (toPos.x - fromPos.x) * alpha,
      fromPos.y + (toPos.y - fromPos.y) * alpha
    );
    await sleep(15);
  }
  await sleep(60);
  
  // 松手触发判定与动效
  await page.mouse.up();

  // 1. 捕捉第一阶段：顺滑收线中 (约 200ms，绳索明显收短，图钉沿线滑行)
  await sleep(200);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vfx_slow_01_retracting.png') });

  // 2. 捕捉第二阶段：纽扣浮空飞跃至最高点 (约 450ms 后，纽扣高空优雅滑翔)
  await sleep(450);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vfx_slow_02_apex_flight.png') });

  // 3. 捕捉第三阶段：飞抵图案融入吸收并盛开绽放 (约 500ms 后)
  await sleep(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'vfx_slow_03_motif_revealed.png') });

  const state = await page.evaluate(() => window.__GAME__.getGameState());
  console.log('解开后游戏状态:', JSON.stringify(state.ropes.map(r => `${r.name}:${r.state}`)));

  await browser.close();
  console.log('=== 特效序列捕捉完成！===');
}

testUntangleVfxSequence().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
