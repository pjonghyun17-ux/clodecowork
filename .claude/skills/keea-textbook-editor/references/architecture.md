# 교재 원고 작성기 구조

줄 번호는 판마다 바뀌므로 적지 않는다. 아래 이름으로 grep 하고, 블록 경계는 `scripts/split_check.py` 로 본다.

## 차례
1. 스크립트 블록
2. 자료 모델 (state)
3. 꾸민 글과 표식
4. 저장 흐름
5. 조판(쪽 나눔) 흐름
6. 강사용 파일
7. 저장소 열쇠
8. 찾아가는 이름
9. 점검용 손잡이

## 1. 스크립트 블록

`<head>` 의 큰 `<style>` 과 `<body>` 의 Vue 틀(`#app`, 3천 줄 남짓) 뒤에 `<script>` 블록이 7개 있다.

| # | 내용 | 전역 | 고쳐도 되나 |
|---|---|---|---|
| 0 | Vue 3.4.31 prod | `Vue` | 아니오 |
| 1 | JSZip | `JSZip` | 아니오 |
| 2 | 문단 번호 체계·자동 들여쓰기 | `KEEA_INDENT` (readMark, levelOf, stampHtml, renumberHtml, nthMark, markIndex) | 예 |
| 3 | 조판 엔진 — 쪽 나눔 | `KEEA_TYPESET.paginate(units, opt)` | 예 |
| 4 | 한글 수식 → MathML, 수식 되살리기 | `KEEA_EQ` (toMathML, toLinear, spanHtml, refresh), `KEEA_EQFIX` | 예 |
| 5 | 인디자인 내보내기 | `IDML_TPL`(128KB 한 줄 틀 — 손대지 않음), `KEEA_IDML`, `KEEA_IDMLPKG` | 예 (틀 제외) |
| 6 | 앱 본체 (약 1만 5천 줄) | `createApp({ setup(){…} })`, 끝에 `app.directive('editable')` | 예 |

앱 본체 블록 6의 차례: 판 구분·암호(`KEEA_PKG`, `IS_WRITER`, `KEEA_CRYPT`, `SOURCE_HTML`) → 공용 함수(표 칸, 수식 표식, 캡션, 번호 단계) → 한글(.hwp/.hwpx) 읽기(`cfbOpen`, `hwpParseDoc`, `buildBookParts2` …) → 원고 검토 규칙(`SPELL_RULES`, `SPELL_MORE`, `ruleCheck`) → AI 연동(Claude API·LM Studio·ComfyUI) → 법령 검토 → IndexedDB·교재·버전·보관함 → 원고료 산정 → `createApp` setup (상태·번호·자동저장·편집기·미리보기·쪽 지도·인쇄·내보내기·강사 배포·폴더 백업·구글 드라이브) → `editable` 지시자.

## 2. 자료 모델 (state)

`const state = reactive(loadInitial())` 하나가 교재 한 권이다.

```
state = {
  meta:{ title, subtitle, category, course, org, date, logo, cover…, spine, back, colophon, ads[] },
  settings:{ pageSize, margin, pageNumber, design, print, indent, typo, caption, levels, numBy… },
  indexTerms:[], review:{…}, opinions:[],
  spellIgnore:[], writerInfo:{}, subLog:[], distBase:{}, distLog:[], trash:[],   // 교재마다 따로인 관리 기록
  parts:[{ id, title, color, illust, number,
    chapters:[{ id, title, number, isAppendix, goals, summary, quiz[],
      sections:[{ id, title, number, jeol, jeolLabel, jeolNo, status, author, reviewComments[], locked, skip,
        blocks:[ 블록… ] }] }] }]
}
```

블록 종류:
- `text` { html, liOut } — 본문. `<p>` 문단들. 들여쓰기는 `data-lv` · `style="padding-left;text-indent"` 로 새겨진다(stampSection).
- `note` { kind: 참고|주의|예시|핵심|TIP|해설|비고|상자, html }
- `heading` { level 1|2, text, number, noNum }
- `item` { level 1~4, text, html?, htmlText?, number, plain, restart, startAt } — 번호 항목(1. → 가. → 1) → 가)). 번호는 `recomputeNumbers` 가 매긴다.
- `image` { src(data URL), caption, width, align, rot, nw, nh, rowGroup, rowMode, asTab, noNum, capPos, capAlign }
- `table` { rows:[[칸]], headRow, caption, colW, colMode, tw, tstyle, asFig, noNum }

표 칸: `{ text, cs, rs, sp(병합에 덮인 자리), hd, al, va, bg, diag, img:{src,caption,width,rot,nw,nh}, sub:{rows}, subPos, html?, htmlText? }`. 표는 열 위치대로 채운 격자이고, 병합으로 덮인 자리에 `sp:true` 칸이 있다.

번호(`chapter.number`, `section.number`, 그림·표 `block.number`, 항목 `number`)는 저장값이지만 **매번 다시 계산**된다 — 직접 고쳐 봐야 덮어써진다.

## 3. 꾸민 글과 표식

- 글(text 필드) 속 표식: `⟦수식 스크립트⟧`, `⟦※각주 글⟧`.
- html 속 원자 칸: `span.eq[data-eq]`(그려 둔 MathML), `span.fn[data-fn]`, `span.xref[data-ref]`([그림 1-3] 참조). 진짜 값은 data 속성에 있고 안의 글자는 그림일 뿐이다 — 찾기·바꾸기·맞춤법 반영은 이 칸 속을 건드리지 않는다(`inAtomSpan`).
- 표 칸·번호 항목의 꾸밈: `html` 은 **`htmlText === text` 일 때만** 쓰인다(`cellRichHtml`). text 만 바꾸면 꾸밈이 버려진다. 함께 고치려면 `richAccessor(c)` / `setRichHtml(c, html)`.
- `cellFromEl(el)` 은 편집창 DOM → text(표식 포함), `cellHtmlFromEl(el)` 은 허용한 꾸밈만 남긴 html.

## 4. 저장 흐름

```
편집창 input ─(editable 지시자: 250ms 묶음, EDIT_PENDING)─▶ state 바뀜
  ─▶ watch(state, deep) : recomputeNumbers() + editSeq++ ─(쉼 900ms)─▶ autosaveNow()
       autosaveNow: bookPut(id, toRaw(state)) → books 목록 갱신 → '자동저장됨' / 실패 시 '⚠ 자동저장 실패'
  · mousedown·단축키·blur·beforeunload·visibilitychange 때 flushAllEditables()
  · visibilitychange(hidden) 때는 기다리지 않고 바로 autosaveNow()
  · window.__keeaUnsaved() — editSeq !== savedSeq 이면 닫기 전에 묻는다
버전 기록: 10분마다 내용 해시가 바뀌었으면 snapCreate(…'자동 저장'). 교재당 30개, 자동분부터 지운다.
백업: 폴더(File System Access, 20분) · 구글 드라이브(로그인 살아 있을 때, 20분).
```

교재 바꾸기·되돌리기·불러오기·한글 불러오기·초기화는 모두 `Object.assign(state, defaultState())` 로 먼저 비운다(대부분 뒤이어 `Object.assign(state, normalizeState(body))`). `defaultState` 에 없는 최상위 키는 앞 값이 남는다.

## 5. 조판(쪽 나눔) 흐름

- `chapterUnits(part, pIdx, chapter, cIdx)` / `bookUnits()` 가 블록을 조판 단위(`text`·`block`·`table`·`solo`·`break`·`recto`)로 바꾼다.
- `KEEA_TYPESET.paginate(units, typesetOpt())` 는 실제 쪽과 같은 CSS 의 숨은 쪽(`#typesetStage`)에 하나씩 넣어 재며 나눈다 — DOM 측정이라 브라우저에서만 돈다. 결과 `{ pages:[{html,ctx}], refMap, bidPage, secPages, stats }`.
- `opt.cancel()` 이 참이면 중간에 멈춘다(미리보기가 쓴다). 예외가 나도 무대는 치운다.
- 미리보기 `pvRender` 는 장 전체를 조판해 그 절이 걸친 쪽만 보인다. 책 전체 쪽번호는 `refreshBookMap` 이 장마다 쪽수를 캐시(`chapPageCache`, 장 JSON 지문)해 계산한다.
- 인쇄 `runPagination` 은 책 전체를 한 번에.

## 6. 강사용 파일

- 관리자 파일이 시작할 때 `SOURCE_HTML = documentElement.outerHTML` 로 자기 원본을 잡아 둔다.
- `makeWriterFile(author)` 가 그 원본의 `</head>` 앞에 `<script type="application/json" id="keea-pkg">` 를 넣어 내려받게 한다. 꾸러미에는 맡은 절만 내용이 있고 다른 절은 `locked` + `skip`(그림·표 수)만 있다.
- 암호를 걸면 `KEEA_CRYPT.seal` (AES-256-GCM, PBKDF2-SHA256 25만 번)으로 잠근다. 암호는 `state.distLog[].pw` 에 남는다(관리자 원고 안).
- 강사용으로 열리면 `IS_WRITER` 가 참이고 IndexedDB 이름(`keea_writer_db`)·저장 열쇠가 따로다.
- **관리자 파일의 코드가 그대로 강사용 파일이 된다.** 고친 내용은 강사용 파일을 다시 만들어야 들어간다.

## 7. 저장소 열쇠

IndexedDB `keea_textbook_db`(강사용 `keea_writer_db`), 저장소 `kv`:
`keea_books_index_v1`, `keea_book_<id>`, `keea_current_book_v1`, `keea_snapshots_index_v1`, `keea_snapshot_<id>`, `keea_part_library_index_v1` / `keea_part_item_<id>`, `keea_image_library_index_v1` / `keea_image_item_<id>`, `keea_glossary_v1`, `keea_law_index_v1` / `keea_law_item_`, `keea_backup_dir`(폴더 핸들), 옛 단일 원고 `keea_textbook_draft_v1`.

localStorage: 옛 단일 원고(`keea_textbook_draft_v1`), 화면 설정(`keea_pv`, `keea_split`, `keea_navgrp_v1` …), AI 설정 `keea_textbook_ai_cfg_v1`(**Claude API 키가 들어 있다** — 내보내기·로그에 흘리지 말 것), 구글 드라이브 설정 `keea_gdrive_v1`.

## 8. 찾아가는 이름

| 하고 싶은 것 | grep 할 이름 |
|---|---|
| 기본 상태·옛 저장본 보정 | `function defaultState`, `function normalizeState` |
| 번호(장·절·그림·표·항목) | `function recomputeNumbers`, `function refreshXrefs` |
| 자동저장 | `async function autosaveNow`, `watch(state,` |
| IndexedDB | `function idbOpen`, `idbGet`, `idbSet`, `idbDelete` |
| 교재 열기·만들기 | `async function loadBook`, `initBooks`, `createBook`, `loadBookData` |
| 버전 기록 | `async function snapCreate`, `restoreSnap`, `lastSnapSig` |
| 블록 → 화면 HTML | `function blockToHtml`, `tableCellHtml`, `imageFigureHtml`, `itemHtml` |
| 꾸민 칸 | `function cellRichHtml`, `cellHtmlFromEl`, `setCellFromEl`, `richAccessor` |
| 편집창 | `app.directive('editable'`, `flushEditable`, `onEditorKey`, `onEditorPaste`, `cleanPasteHtml` |
| 맞춤법·규칙 검사 | `SPELL_RULES`, `SPELL_MORE`, `function ruleCheck`, `applyIssue` |
| 찾기·바꾸기 | `function collectFields`, `fieldAccessor`, `scanField`, `replaceField`, `applyReplace` |
| 미리보기·조판 | `async function pvRender`, `chapterUnits`, `bookUnits`, `typesetOpt`, `refreshBookMap`, `runPagination` |
| 한글 불러오기 | `parseTextbookFile`, `hwpParseDoc`, `buildBookParts2`, `hwpxParseItems` |
| 인디자인 | `KEEA_IDML`, `partToItems`, `tableXml`, `KEEA_IDMLPKG.buildIdmlFiles` |
| 강사 배포·제출 | `makeWriterFile`, `writerPkgState`, `onSubmitChosen`, `distLog` |
| 원고료 | `FEE_DEFAULT`, `feeDiffSection` |

## 9. 점검용 손잡이

- `window.__KEEA__` — `{ state, bookUnits(), typesetOpt(), refreshBookMap(), bookMap, lastTypeset, printPages, fullBookMap() }`
- setup 안 함수·ref: `document.querySelector('#app')._vnode.component.setupState` (ref 는 자동으로 풀려 값으로 읽힌다)
- 전역 엔진: `KEEA_INDENT`, `KEEA_TYPESET`, `KEEA_EQ`, `KEEA_EQFIX`, `KEEA_IDML`, `KEEA_IDMLPKG`
- `window.__keeaUnsaved()` — 저장 안 된 고침이 있는가
