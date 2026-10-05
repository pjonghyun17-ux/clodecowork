// 헤드리스 크롬으로 교재 원고 작성기를 여는 공용 도우미 (smoke.js · regression.js · perf.js 가 쓴다)
const path = require('path');

function loadPlaywright() {
  const tries = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  try { const g = require('child_process').execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); tries.push(path.join(g, 'playwright')); } catch (e) {}
  for (const t of tries) { try { return require(t); } catch (e) {} }
  console.error('Playwright 를 찾지 못했습니다. `npm i -g playwright` 뒤 다시 실행하세요 (브라우저는 미리 깔린 Chromium 을 씁니다).');
  process.exit(2);
}

// setup() 이 돌려준 함수·ref 에 닿는 길 (prod 빌드라 __vue_app__._instance 는 null)
const SS = "document.querySelector('#app')._vnode.component.setupState";

async function launch() {
  const { chromium } = loadPlaywright();
  const opts = {};
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

// 검사마다 새 컨텍스트 — IndexedDB·localStorage 가 비어 있는 상태에서 시작한다
async function openApp(browser, htmlPath, waitMs = 2500) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('dialog', d => d.accept());                     // confirm·prompt 는 받아들인다
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/자동저장 실패/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(htmlPath));
  await page.waitForTimeout(waitMs);
  return { ctx, page, errors };
}

module.exports = { loadPlaywright, launch, openApp, SS };
