import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = 'test_screenshots';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runMotifVerification() {
  console.log('=== 运行刺绣礼物完美隔离与显色验证测试 ===');
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
  await sleep(1200);

  // 1. 截取初始整屏 (11个干净独立线稿)
  console.log('1. 截取初始线稿全幅画面...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify_perfect_01_initial.png') });

  // 2. 触发绳索1 (翠绿 -> 玫瑰花篮) 和 绳索6 (紫罗兰 -> 方形礼盒)
  console.log('2. 触发 玫瑰花篮(绿) 与 方形礼盒(紫) 刺绣显色...');
  await page.evaluate(() => {
    const game = window.__GAME__;
    // 触发绳索1与绳索6显色
    game.board.embroiderMotif(1); // 玫瑰花篮 (绿)
    game.board.embroiderMotif(6); // 方形礼盒 (紫)
  });

  // 等待平滑径向展开动效与金光粒子完成
  await sleep(1600);
  console.log('2. 截取 玫瑰花篮 与 方形礼盒 展开画面...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify_perfect_02_basket_and_box.png') });

  // 3. 触发其余4条绳索 (蓝9、粉1、红5、橙7)
  console.log('3. 触发其余4条主玩法丝线显色...');
  await page.evaluate(() => {
    const game = window.__GAME__;
    game.board.embroiderMotif(2); // 海蓝 -> 福袋礼包
    game.board.embroiderMotif(3); // 粉红 -> 心形礼盒
    game.board.embroiderMotif(4); // 中国红 -> 爱心情书
    game.board.embroiderMotif(5); // 蜜橙 -> 玫瑰手捧花
  });

  await sleep(1600);
  console.log('3. 截取 6条丝线对应刺绣全亮画面...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify_perfect_03_six_motifs.png') });

  // 4. 触发全通连环大圆满 (剩余5个图案如烟花般连环盛开)
  console.log('4. 触发全幅大圆满连环烟花式揭示...');
  await page.evaluate(() => {
    const game = window.__GAME__;
    game.board.triggerVictoryFullHoopReveal();
  });

  // 等待5个图案依次以 240ms 间隔连环展开
  await sleep(2600);
  console.log('4. 截取 11个刺绣图案全满大圆满画面...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'verify_perfect_04_full_hoop_11_motifs.png') });

  await browser.close();
  console.log('=== 验证测试全部完成！===');
}

runMotifVerification().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
