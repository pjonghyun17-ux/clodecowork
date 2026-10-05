// 성능 측정: node perf.js <html> [--parts 3 --chapters 8 --sections 6]
// 큰 가짜 원고(기본: 블록 5,616개 · 표 576개)를 넣고 다음을 잰다.
//   edit  : 절 제목 한 글자를 고친 뒤 화면이 다시 움직일 때까지(ms) — deep watch · 번호 재계산 · 다시 그리기를 합친 값
//   check : 규칙 검사(맞춤법 등) 한 번(ms)
//   json  : 상태 전체를 JSON 문자열로(ms) — 스냅샷·백업이 내는 값
// 성능을 건드렸으면 고치기 전 파일과 고친 파일에 같은 크기로 둘 다 돌려 숫자로 비교한다.
const { launch, openApp, SS } = require('./_pw');

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('쓰는 법: node perf.js <html> [--parts N --chapters N --sections N]'); process.exit(2); }
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? +args[i + 1] : null; };
const size = { parts: opt('parts') || 3, chapters: opt('chapters') || 8, sections: opt('sections') || 6 };

(async () => {
  const b = await launch();
  const { page, errors } = await openApp(b, file);
  const r = await page.evaluate(async ({ SS, size }) => {
    const ss = eval(SS), st = window.__KEEA__.state;
    const uid = () => Math.random().toString(36).slice(2);
    const para = '<p>전기설비의 안전관리를 위하여 정기적으로 절연저항을 측정하고 그 결과를 기록하여야 한다. 1. 측정 방법은 다음과 같다.</p>';
    const parts = [];
    for (let pi = 0; pi < size.parts; pi++) {
      const chapters = [];
      for (let ci = 0; ci < size.chapters; ci++) {
        const sections = [];
        for (let si = 0; si < size.sections; si++) {
          const blocks = [];
          for (let k = 0; k < 30; k++) blocks.push({ id: uid(), type: 'text', html: para.repeat(3) });
          for (let k = 0; k < 4; k++) blocks.push({ id: uid(), type: 'table', caption: '표', headRow: true, rows: Array.from({ length: 12 }, () => Array.from({ length: 5 }, () => ({ text: '값 123', cs: 1, rs: 1 }))) });
          for (let k = 0; k < 5; k++) blocks.push({ id: uid(), type: 'item', level: 1, text: '항목 내용', number: '' });
          sections.push({ id: uid(), title: '절' + si, blocks, reviewComments: [], status: 'todo', author: '' });
        }
        chapters.push({ id: uid(), title: '장' + ci, sections, isAppendix: false, goals: '', summary: '', quiz: [] });
      }
      parts.push({ id: uid(), title: '편' + pi, color: '#EA8F3C', illust: '', chapters });
    }
    st.parts.splice(0, st.parts.length, ...parts);
    await new Promise(r => setTimeout(r, 1500));
    let blocks = 0; st.parts.forEach(p => p.chapters.forEach(c => c.sections.forEach(s => blocks += s.blocks.length)));
    const sec = st.parts[Math.min(1, size.parts - 1)].chapters[0].sections[0];
    const edit = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      sec.title = sec.title + 'x';
      await Promise.resolve(); await Promise.resolve();
      await new Promise(r => setTimeout(r, 0));
      edit.push(+(performance.now() - t0).toFixed(1));
    }
    ss.checkScope = 'all';
    const t1 = performance.now(); ss.runRuleCheck(); const check = +(performance.now() - t1).toFixed(0);
    const t2 = performance.now(); const json = JSON.stringify(Vue.toRaw(st)); const tj = +(performance.now() - t2).toFixed(0);
    edit.sort((a, c) => a - c);
    return { blocks, editMs: edit, editMedian: edit[2], checkMs: check, jsonMs: tj, jsonMB: +(json.length / 1048576).toFixed(1) };
  }, { SS, size });
  await b.close();
  console.log(JSON.stringify(r));
  if (errors.length) { console.error('오류:', errors); process.exit(1); }
})();
