// 열기 점검: node smoke.js <html>
// 열 때 오류가 없는지, 엔진 전역과 화면·교재가 제대로 섰는지 본다. 고친 뒤 가장 먼저 돌린다.
const { launch, openApp, SS } = require('./_pw');

(async () => {
  const file = process.argv[2];
  if (!file) { console.error('쓰는 법: node smoke.js <html>'); process.exit(2); }
  const b = await launch();
  const { page, errors } = await openApp(b, file);
  const r = await page.evaluate((SS) => {
    const ss = eval(SS);
    return {
      engines: ['Vue', 'JSZip', 'KEEA_INDENT', 'KEEA_TYPESET', 'KEEA_EQ', 'KEEA_EQFIX', 'KEEA_IDML', 'KEEA_IDMLPKG']
        .filter(k => !window[k]),
      handle: !!(window.__KEEA__ && window.__KEEA__.state),
      parts: window.__KEEA__ ? window.__KEEA__.state.parts.length : -1,
      book: ss && ss.currentBookId,
      appText: (document.querySelector('#app') || {}).innerText ? document.querySelector('#app').innerText.length : 0,
      eq: window.KEEA_EQ ? /<math/.test(KEEA_EQ.toMathML('a over b')) : false,
    };
  }, SS);
  await b.close();
  const checks = [
    ['열 때 오류 없음', errors.length === 0, errors],
    ['엔진 전역이 다 있음', r.engines.length === 0, r.engines],
    ['점검용 손잡이(__KEEA__)', r.handle, r],
    ['교재가 열림(currentBookId)', !!r.book, r.book],
    ['화면이 그려짐', r.appText > 100, r.appText],
    ['수식 → MathML', r.eq, r.eq],
  ];
  let bad = 0;
  for (const [name, ok, info] of checks) { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ← ' + JSON.stringify(info))); }
  process.exit(bad ? 1 : 0);
})();
