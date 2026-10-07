// 회귀 검사: node regression.js <html>
// 2026-10 검토에서 고친 버그(references/pitfalls.md 1~9)와 TIFF 변환(11)·ComfyUI 오류 알림(12)이 다시 깨지지 않는지 본다.
// 고치기 전 파일에 돌리면 대부분 FAIL 이 나야 정상이다 — 그래야 이 검사가 무언가를 지킨다.
// 새 버그를 고치면 같은 꼴로 블록 하나를 더한다: 새 컨텍스트로 열고 → setupState 로 상태를 만들고 → check().
const { launch, openApp, SS } = require('./_pw');
const FILE = process.argv[2];
if (!FILE) { console.error('쓰는 법: node regression.js <html>'); process.exit(2); }

(async () => {
  const b = await launch();
  const results = [];
  const check = (name, ok, info) => { results.push({ name, ok: !!ok, info }); };
  async function fresh() { const { ctx, page, errors } = await openApp(b, FILE); return { p: page, ctx, errs: errors }; }

  // 0. 열기
  { const { p, ctx, errs } = await fresh();
    check('열 때 오류 없음', !errs.length, errs.join(' | ')); await ctx.close(); }

  // 3. distLog 가 새 교재로 넘어가지 않음
  { const { p, ctx } = await fresh();
    const r = await p.evaluate(async (SS) => {
      const ss = eval(SS), st = window.__KEEA__.state;
      st.distLog = [{ author: '홍길동', pkgId: 'p1', pw: 'abcd-efgh', at: 'x', secs: [] }];
      await new Promise(r => setTimeout(r, 1500));
      Object.assign(ss.newBook, { mode: 'empty', title: '교재 B', category: '기타', course: '' });
      await ss.createBook();
      await new Promise(r => setTimeout(r, 300));
      const inB = JSON.stringify(st.distLog);
      // A 로 돌아가면 A 의 기록은 그대로
      const a = ss.books.find(x => x.title !== '교재 B');
      await ss.loadBook(a.id);
      return { inB, backA: JSON.stringify(st.distLog) };
    }, SS);
    check('새 교재 B 에 A 의 배포 기록 없음', r.inB === '[]', r.inB);
    check('교재 A 로 돌아가면 A 의 배포 기록 유지', /abcd-efgh/.test(r.backA), r.backA);
    await ctx.close(); }

  // 6·7. 찾기: 번호 항목 포함 · 꾸민 칸 바꾸기 후 꾸밈 유지 · 수식 속 글자는 안 건드림
  { const { p, ctx } = await fresh();
    const r = await p.evaluate(async (SS) => {
      const ss = eval(SS), st = window.__KEEA__.state;
      const sec = st.parts[0].chapters[0].sections[0];
      sec.blocks.push({ id: 'it1', type: 'item', level: 1, text: '변압기 점검 항목', number: '' });
      const cell = { text: '변압기 용량', cs: 1, rs: 1, html: '<b>변압기</b> 용량', htmlText: '변압기 용량' };
      sec.blocks.push({ id: 'tb1', type: 'table', caption: '', headRow: false, rows: [[cell]] });
      sec.blocks.push({ id: 'tx1', type: 'text', html: '<p>변압기 본문 ' + KEEA_EQ.spanHtml('x^2') + '</p>' });
      await new Promise(r => setTimeout(r, 100));
      ss.frQuery = '변압기'; ss.frScope = 'all'; ss.frRepl = '트랜스포머';
      ss.runFind();
      const where = ss.frHits.map(h => h.where);
      await ss.applyReplace();
      const c = st.parts[0].chapters[0].sections[0].blocks.find(b => b.id === 'tb1').rows[0][0];
      const it = st.parts[0].chapters[0].sections[0].blocks.find(b => b.id === 'it1');
      // 수식 속 글자 'x' 는 찾지 않는다
      ss.frQuery = 'x'; ss.runFind();
      const xHits = ss.frHits.filter(h => /본문/.test(h.where)).length;
      return { where, cell: { text: c.text, html: c.html, sync: c.htmlText === c.text }, item: it.text, xHits };
    }, SS);
    check('찾기에 번호 항목이 나옴', r.where.some(w => /번호 항목/.test(w)), r.where);
    check('번호 항목도 바뀜', r.item === '트랜스포머 점검 항목', r.item);
    check('꾸민 칸 바꾼 뒤 굵게 유지', r.cell.html === '<b>트랜스포머</b> 용량' && r.cell.sync, r.cell);
    check('수식 칸 속 글자는 찾지 않음', r.xHits === 0, r.xHits);
    await ctx.close(); }

  // 5·7. 맞춤법: 전방탐색 규칙 지적 + 꾸민 번호 항목에 반영해도 꾸밈 유지
  { const { p, ctx } = await fresh();
    const r = await p.evaluate(async (SS) => {
      const ss = eval(SS), st = window.__KEEA__.state;
      const sec = st.parts[0].chapters[0].sections[0];
      sec.blocks.push({ id: 'tx9', type: 'text', html: '<p>이렇게되면 문제가 들어나고 정확이 맞다.</p>' });
      sec.blocks.push({ id: 'it9', type: 'item', level: 2, text: '정확이 측정한다', number: '', html: '<span style="color:#d0021b">정확이</span> 측정한다', htmlText: '정확이 측정한다' });
      await new Promise(r => setTimeout(r, 100));
      ss.checkScope = 'all'; ss.runRuleCheck();
      const iss = ss.issues;
      const pick = re => iss.filter(i => re.test(i.suggest || '')).map(i => i.excerpt + '→' + i.suggest);
      const itemIss = iss.find(i => i.blockId === 'it9' && /정확히/.test(i.suggest || ''));
      if (itemIss) ss.applyIssue(itemIss);
      const it = sec.blocks.find(b => b.id === 'it9');
      return { gede: pick(/게 되/), deureo: pick(/드러나/), jh: pick(/정확히/), itemStatus: itemIss && itemIss.status, item: { text: it.text, html: it.html } };
    }, SS);
    check("'게되면' 지적됨", r.gede.length > 0, r.gede);
    check("'들어나고' 지적됨", r.deureo.length > 0, r.deureo);
    check("기존 규칙('정확이') 그대로 지적", r.jh.length > 0, r.jh);
    check('꾸민 번호 항목에 반영 + 색 유지', r.itemStatus === 'applied' && /color:#d0021b/.test(r.item.html) && r.item.text === '정확히 측정한다', r);
    await ctx.close(); }

  // 1. IndexedDB 저장 실패(abort) → '자동저장 실패' 표시 + 탭 닫기 경고 상태
  { const { p, ctx } = await fresh();
    const r = await p.evaluate(async (SS) => {
      const ss = eval(SS), st = window.__KEEA__.state;
      const before = (window.__keeaUnsaved ? window.__keeaUnsaved() : null);
      const orig = IDBObjectStore.prototype.put;
      // 요청은 성공했는데 커밋에서 거래가 끝나는 경우(저장 공간 부족과 같은 모양): abort 만 오고 error 는 오지 않는다
      IDBObjectStore.prototype.put = function (...a) { const req = orig.apply(this, a); const tx = this.transaction; req.addEventListener('success', () => { try { tx.abort(); } catch (e) {} }); return req; };
      st.meta.title = st.meta.title + ' 고침';
      await new Promise(r => setTimeout(r, 200));
      const pending = (window.__keeaUnsaved ? window.__keeaUnsaved() : null);
      await new Promise(r => setTimeout(r, 2000));
      const failStatus = ss.saveStatus, stillUnsaved = (window.__keeaUnsaved ? window.__keeaUnsaved() : null);
      IDBObjectStore.prototype.put = orig;
      st.meta.title = st.meta.title + '!';
      await new Promise(r => setTimeout(r, 2000));
      return { before, pending, failStatus, stillUnsaved, okStatus: ss.saveStatus, after: (window.__keeaUnsaved ? window.__keeaUnsaved() : null) };
    }, SS);
    check('처음엔 저장 안 된 고침 없음', r.before === false, r);
    check('고친 직후 저장 대기 표시', r.pending === true, r);
    check("저장 실패 시 '자동저장 실패' 표시", /자동저장 실패/.test(r.failStatus), r.failStatus);
    check('실패하면 닫기 경고 유지', r.stillUnsaved === true, r);
    check('다시 저장되면 정상 표시·경고 해제', /자동저장됨/.test(r.okStatus) && r.after === false, r);
    await ctx.close(); }

  // 2. 탭 숨김(visibilitychange) 때 바로 저장
  { const { p, ctx } = await fresh();
    const r = await p.evaluate(async (SS) => {
      const ss = eval(SS), st = window.__KEEA__.state;
      st.meta.subtitle = '숨김 저장 시험';
      await new Promise(r => setTimeout(r, 50));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => setTimeout(r, 400));          // 900ms 보다 짧게
      return { status: ss.saveStatus, unsaved: (window.__keeaUnsaved ? window.__keeaUnsaved() : null) };
    }, SS);
    check('탭을 숨기면 0.9초를 기다리지 않고 저장', /자동저장됨/.test(r.status) && r.unsaved === false, r);
    await ctx.close(); }

  // 4. 자동 버전 지문 · 스냅샷 만들기
  { const { p, ctx, errs } = await fresh();
    const r = await p.evaluate(async (SS) => {
      const ss = eval(SS);
      await ss.saveManualSnapshot();
      return { msg: ss.snapMsg, n: ss.snaps.length };
    }, SS);
    check('수동 버전 저장 동작', /저장했습니다/.test(r.msg) && r.n >= 1, r);
    check('버전 저장 중 오류 없음', !errs.length, errs);
    await ctx.close(); }

  // 8·9·조판: 들여쓰기 번호 · CSV · 조판 취소
  { const { p, ctx } = await fresh();
    const r = await p.evaluate(async () => {
      const I = window.KEEA_INDENT;
      const rn = h => I.renumberHtml(h, I.newCtx(), {}, {});
      const a = rn('<p><b> </b>1. a</p><p><b> </b>1. b</p>');
      const c = rn('<p>&nbsp;1. a</p><p>&nbsp;1. b</p>');
      const d = rn('<p>1. a</p><p>1. b</p><p>1. c</p>');
      const csv = window.KEEA_IDMLPKG.buildCsv([{ name: 'Links/a.png', number: '1-1', caption: '그 "견본" 그림', w: 1, h: 1 }]);
      const units = [{ type: 'text', wrap: '<div class="flow-text"></div>', paras: ['<p>가</p>'] }];
      let calls = 0;
      const res = await window.KEEA_TYPESET.paginate(units.concat(units, units), { widthMM: 150, capPx: 800, cancel: () => ++calls > 1 });
      const leftover = document.querySelectorAll('#typesetStage > .ts-page').length;
      let threw = false;
      try { await window.KEEA_TYPESET.paginate([{ type: 'block', html: '<div>x</div>' }, null, { type: 'text' }], { widthMM: 150, capPx: 800 }); } catch (e) { threw = true; }
      const leftover2 = document.querySelectorAll('#typesetStage > .ts-page').length;
      const RA = typeof replaceAcrossNodes === 'function' ? replaceAcrossNodes : () => ({ ok: false, html: '' });
      const x1 = RA('<p><span style="color:red">정확이</span> 측정한다</p>', '정확이 측정한', '정확히 측정한');
      const x2 = RA('<p><b>할수</b>있다</p>', '할수있다', '할 수 있다');
      const x3 = RA('<p>가다</p><p>나다</p>', '가다나', '가다 나');
      return { x1, x2, x3, a, c, d, csv, cancelled: !!res.stats.cancelled, leftover, threw, leftover2 };
    });
    check('번호 다시 매기기: <b> </b> 앞머리', /<\/b>2\. b/.test(r.a), r.a);
    check('번호 다시 매기기: &nbsp; 앞머리', /&nbsp;2\. b/.test(r.c), r.c);
    check('번호 다시 매기기: 보통 문단 그대로 동작', r.d === '<p>1. a</p><p>2. b</p><p>3. c</p>', r.d);
    check('경계 걸친 고침: 색 유지', r.x1.ok && r.x1.html === '<p><span style="color:red">정확히</span> 측정한다</p>', r.x1);
    check('경계 걸친 고침: 굵게 안팎', r.x2.ok && r.x2.html.replace(/<[^>]+>/g, '') === '할 수 있다' && /<b>할 수/.test(r.x2.html), r.x2);
    check('경계 걸친 고침: 문단은 넘지 않음', !r.x3.ok, r.x3);
    check('CSV 따옴표 한 번만 이스케이프', r.csv.includes('"그 ""견본"" 그림"'), r.csv);
    check('조판 중간 취소', r.cancelled && r.leftover === 0, r);
    check('조판 예외 때도 무대 정리', r.threw && r.leftover2 === 0, r);
    await ctx.close(); }

  // 10. TIFF: 넣을 때 PNG·JPEG 로 바꾼다 (assets/tiff — libtiff 로 만든 시험 파일과 기준 그림)
  { const fs = require('fs'), path = require('path');
    const dir = path.join(__dirname, '..', 'assets', 'tiff');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.tif')).sort();
    const { p, ctx } = await fresh();
    let r;
    try {
      r = await p.evaluate(async (items) => {
        const load = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
        const px = im => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
        const out = [];
        for (const it of items) {
          const u = Uint8Array.from(atob(it.tif), c => c.charCodeAt(0));
          try {
            const o = await tiffToDataUrl(u);
            const a = await load(o.url), rb = await load('data:image/png;base64,' + it.ref);
            let maxd = -1;
            if (a.naturalWidth === rb.naturalWidth && a.naturalHeight === rb.naturalHeight) { const A = px(a), R = px(rb); maxd = 0; for (let i = 0; i < A.length; i++) maxd = Math.max(maxd, Math.abs(A[i] - R[i])); }
            out.push({ f: it.f, maxd, via: o.via, dims: a.naturalWidth + 'x' + a.naturalHeight });
          } catch (e) { out.push({ f: it.f, err: e.message }); }
        }
        return out;
      }, files.map(f => ({ f, tif: fs.readFileSync(path.join(dir, f)).toString('base64'), ref: fs.readFileSync(path.join(dir, 'ref', f.replace(/\.tif$/, '.png'))).toString('base64') })));
    } catch (e) { r = [{ f: '(전체)', err: e.message.split('\n')[0] }]; }
    const conv = r.filter(x => !/g4/.test(x.f));
    const bad = conv.filter(x => x.err || x.maxd < 0 || x.maxd > (/jpeg/.test(x.f) ? 24 : 3));
    check(`TIFF ${conv.length}종이 libtiff 기준 그림과 같게 바뀜`, conv.length >= 17 && !bad.length, bad.length ? bad : conv.length);
    check('TIFF 변환은 작업자(백그라운드)에서', conv.length && conv.every(x => x.via === 'worker'), conv.map(x => x.via));
    const g4 = r.find(x => /g4/.test(x.f));
    check('팩스(G4) TIFF 는 까닭을 알리고 거절', g4 && /팩스/.test(g4.err || ''), g4);
    await ctx.close(); }

  // 11. TIFF: 실제 그림 넣는 길 — 그림 고르기 · 못 여는 형식 · 보관함 · 예전 원고 속 TIFF · 한글 불러오기 형식표
  { const path = require('path'), fs = require('fs');
    const dir = path.join(__dirname, '..', 'assets', 'tiff');
    const { p, ctx } = await fresh();
    let pick = path.join(dir, 'cmyk-lzw.tif');
    p.on('filechooser', fc => fc.setFiles(pick));
    const add = id => p.evaluate(({ SS, id }) => { const ss = eval(SS), st = window.__KEEA__.state, P = st.parts[0], C = P.chapters[0], S = C.sections[0];
      S.blocks.push({ id, type: 'image', src: '', caption: id, width: 80, align: 'center', rot: 0 }); ss.selectSection(P.id, C.id, S.id); }, { SS, id });
    const choose = id => p.evaluate(({ SS, id }) => { const ss = eval(SS), S = window.__KEEA__.state.parts[0].chapters[0].sections[0]; ss.chooseImage(S.blocks.find(x => x.id === id)); }, { SS, id });
    const blockOf = id => p.evaluate(({ SS, id }) => { const ss = eval(SS), b = window.__KEEA__.state.parts[0].chapters[0].sections[0].blocks.find(x => x.id === id);
      const el = document.querySelector('.block[data-bid="' + id + '"] img'); return { head: b.src.slice(0, 22), nw: b.nw, nh: b.nh, shown: el ? el.naturalWidth : -1, status: ss.saveStatus }; }, { SS, id });
    await add('tifA'); await p.waitForTimeout(500); await choose('tifA'); await p.waitForTimeout(2500);
    const a = await blockOf('tifA');
    check('그림 고르기로 넣은 TIFF 가 PNG·JPEG 로 바뀌어 보임', /^data:image\/(png|jpeg)/.test(a.head) && a.nw === 40 && a.nh === 30 && a.shown === 40, a);
    pick = path.join(dir, 'bilevel-g4.tif');
    await add('tifB'); await p.waitForTimeout(500); await choose('tifB'); await p.waitForTimeout(2000);
    const g = await blockOf('tifB');
    check('못 여는 TIFF 는 넣지 않고 까닭을 알림', g.head === '' && /넣지 못했습니다/.test(g.status) && /팩스/.test(g.status), g);
    let r2;
    try {
      r2 = await p.evaluate(async ({ SS, tif }) => {
        const ss = eval(SS), st = window.__KEEA__.state;
        const u = Uint8Array.from(atob(tif), c => c.charCodeAt(0));
        // 보관함에 올리기
        await ss.onImgLibFileChosen({ target: { files: [new File([u], '보관.tif', { type: 'image/tiff' })], value: '' } });
        const ent = ss.imgLib.find(e => e.name === '보관');
        const libSrc = ent ? String(await imgGet(ent.id)).slice(0, 22) : '';
        // 고치기 전에 들어간 TIFF (그림 요소 · 표 칸 · 표지) → 열 때 정리
        const durl = 'data:image/tiff;base64,' + tif;
        const S = st.parts[0].chapters[0].sections[0];
        S.blocks.push({ id: 'old1', type: 'image', src: durl, caption: '', width: 80, align: 'center', rot: 0 });
        S.blocks.push({ id: 'old2', type: 'table', caption: '', headRow: false, rows: [[{ text: '', cs: 1, rs: 1, img: { src: durl, caption: '', width: 92, rot: 0 } }]] });
        st.meta.coverImg = durl;
        const changed = await optimizeExistingImages(st);
        const b1 = S.blocks.find(x => x.id === 'old1'), b2 = S.blocks.find(x => x.id === 'old2').rows[0][0].img;
        return { libSrc, changed, old1: b1.src.slice(0, 22) + ' ' + b1.nw + 'x' + b1.nh, old2: b2.src.slice(0, 22), cover: st.meta.coverImg.slice(0, 22),
                 mime: IMG_MIME.tif, dims: imgDimsFromBytes(u) };
      }, { SS, tif: fs.readFileSync(path.join(dir, 'rgb-lzw.tif')).toString('base64') });
    } catch (e) { r2 = { err: e.message.split('\n')[0] }; }
    check('그림 보관함에도 바뀐 그림으로 들어감', /^data:image\/(png|jpeg)/.test(r2.libSrc || ''), r2);
    check('예전에 들어간 TIFF(그림·표 칸·표지)를 열 때 정리', r2.changed && /^data:image\/png.* 40x30$/.test(r2.old1 || '') && /^data:image\/png/.test(r2.old2 || '') && /^data:image\/png/.test(r2.cover || ''), r2);
    check('한글 불러오기가 TIFF 그림을 받음(형식표·크기 읽기)', r2.mime === 'image/tiff' && r2.dims && r2.dims.w === 40 && r2.dims.h === 30, r2);
    await ctx.close(); }

  // 12. ComfyUI 확대 실패: 진짜 원인(exception_message)이 잘리지 않고 먼저 보이는가 — 가짜 ComfyUI 응답으로
  { const { p, ctx } = await fresh();
    let r;
    try {
      r = await p.evaluate(async () => {
        const realFetch = window.fetch;
        const hist = { p1: { outputs: {}, status: { status_str: 'error', completed: false, messages: [
          ['execution_start', { prompt_id: 'p1', timestamp: 1791383876210 }],
          ['execution_cached', { nodes: [], prompt_id: 'p1', timestamp: 1791383876216 }],
          ['execution_error', { prompt_id: 'p1', node_id: '3', node_type: 'RTXVideoSuperResolution', executed: ['4'],
            exception_message: 'NvVFX_Load failed: An otherwise unspecified error has occurred (code -1)', exception_type: 'RuntimeError',
            traceback: ['Traceback (most recent call last):\n', '  File "nodes.py", line 66, in execute\n    batch_size = max(1, MAX_PIXELS // out_pixels)\n', 'RuntimeError: NvVFX_Load failed\n'],
            current_inputs: {}, current_outputs: {}, timestamp: 1791383876300 }]] } } };
        const json = o => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
        window.fetch = async (url, opt) => {
          url = String(url);
          if (url.endsWith('/upload/image')) return json({ name: 'keea_x.png', subfolder: 'keea', type: 'input' });
          if (url.endsWith('/prompt')) return json({ prompt_id: 'p1', number: 1, node_errors: {} });
          if (url.includes('/history/p1')) return json(hist);
          return realFetch(url, opt);
        };
        const wf = JSON.stringify({ '4': { class_type: 'LoadImage', inputs: { image: 'a.png' } },
          '3': { class_type: 'RTXVideoSuperResolution', inputs: { images: ['4', 0] } }, '9': { class_type: 'SaveImage', inputs: { images: ['3', 0] } } });
        const png = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; return c.toDataURL('image/png'); })();
        let msg = '';
        try { await comfyUpscale({ comfyUrl: 'http://127.0.0.1:8188', comfyWorkflow: wf }, png); } catch (e) { msg = e.message; }
        window.fetch = realFetch;
        const oom = typeof comfyErrorText === 'function' ? comfyErrorText([['execution_error', { node_id: '7', node_type: 'UpscaleModelLoader', exception_type: 'torch.OutOfMemoryError', exception_message: 'CUDA out of memory. Tried to allocate 2.00 GiB' }]]) : '';
        const stop = typeof comfyErrorText === 'function' ? comfyErrorText([['execution_interrupted', { node_id: '3' }]]) : '';
        return { msg, oom, stop };
      });
    } catch (e) { r = { msg: '', err: e.message.split('\n')[0] }; }
    check('ComfyUI 오류: 어느 노드인지와 진짜 원인이 보임', /RTXVideoSuperResolution/.test(r.msg) && /3번/.test(r.msg) && /NvVFX_Load failed/.test(r.msg) && !/execution_cached|prompt_id/.test(r.msg), r.msg);
    check('ComfyUI 오류: 흔한 원인이면 고칠 방법을 붙임', /드라이버/.test(r.msg) && /메모리가 모자랍니다/.test(r.oom || '') && /중단되었습니다/.test(r.stop || ''), r);
    await ctx.close(); }

  await b.close();
  let bad = 0;
  for (const t of results) { if (!t.ok) bad++; console.log((t.ok ? 'PASS ' : 'FAIL ') + t.name + (t.ok ? '' : '  ← ' + JSON.stringify(t.info))); }
  console.log(`\n${results.length - bad}/${results.length} 통과`);
  process.exit(bad ? 1 : 0);
})();
