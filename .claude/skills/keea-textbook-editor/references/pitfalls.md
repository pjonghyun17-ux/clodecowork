# 이미 밝혀진 함정과 고친 내용

2026-10 검토에서 실제로 재현된 것들이다. 같은 꼴의 코드를 새로 쓸 때 다시 빠지지 않도록 '왜'를 함께 적는다. 1~9는 고쳤고 `scripts/regression.js` 가 지킨다. 8번(deep watch)은 아직 그대로다.

## 1. IndexedDB 거래는 abort 도 받아야 한다
저장 공간이 모자라면(QuotaExceededError) 요청은 성공한 뒤 **커밋 단계에서** 거래가 끝나므로 `error` 가 아니라 `abort` 만 온다. `oncomplete`/`onerror` 만 걸면 Promise 가 영영 안 끝나고, 자동저장이 멈췄는데 화면에는 '자동저장됨'이 남는다.
→ `tx.onabort = ()=>reject(tx.error || …)`. 연결은 `idbOpen()` 이 하나를 열어 재사용한다(예전엔 호출마다 새로 열고 안 닫았다).

## 2. 저장은 늦게 돈다 — 닫기 전에 지켜야 한다
입력은 250ms 묶음, 저장은 쉼 900ms 뒤 비동기 IndexedDB 다. `beforeunload` 에서 할 수 있는 건 동기 작업뿐이라 그 사이 닫으면 잃는다.
→ `editSeq`/`savedSeq` 로 저장 안 된 고침을 세고, `beforeunload` 에서 남아 있으면 `preventDefault()` 로 묻는다. 탭이 숨겨질 때(`visibilitychange`)는 900ms 를 기다리지 않고 바로 저장한다. 저장이 실패하면 savedSeq 를 올리지 않아 경고가 계속 남는다.

## 3. 상태를 통째로 갈아끼울 때 최상위 키가 남는다
교재 바꾸기·되돌리기·불러오기·초기화는 `Object.assign(state, defaultState())` 로 비운다. `defaultState` 에 없는 키는 **앞 교재 값이 그대로 남고** 자동저장이 그걸 새 교재에 써 버린다. 실제로 `distLog`(강사 암호 포함)가 새 교재로 넘어갔다.
→ 교재마다 따로인 키(spellIgnore, writerInfo, subLog, distBase, distLog, trash)는 `defaultState` 에 둔다. 새 최상위 키를 만들면 여기에도 넣는다. 버전 되돌리기는 예전 버전에 distLog 가 없으면 지금 것을 지킨다(배포 암호를 잃지 않게).

## 4. 꾸민 칸은 text 와 html 을 함께 고친다
`cellRichHtml(c)` 는 `c.htmlText === c.text` 일 때만 `c.html` 을 쓴다. 찾아 바꾸기·맞춤법 반영이 text 만 바꾸면 굵게·색뿐 아니라 글 속 그림(`img.inl-img`)·참조(`span.xref`)까지 사라진다.
→ `richAccessor(c)` 로 읽고 쓰고, html 을 고친 뒤 `setRichHtml(c, html)` 로 text·htmlText 를 다시 맞춘다. 발췌가 꾸밈 경계에 걸치면(`<span>정확이</span> 측정한`) `replaceAcrossNodes` 가 바뀌는 가운데만 그 자리 마디에서 고친다. 그래도 못 찾으면 꾸밈을 버리지 말고 '위치를 찾지 못함'으로 남긴다.

## 5. 원자 칸(수식·각주·참조) 속 글자는 건드리지 않는다
`span.eq` 안의 MathML 글자, `span.xref` 의 '[그림 1-3]' 은 그림일 뿐이고 진짜 값은 data 속성이다. 거기서 찾거나 바꾸면 다시 그릴 때 사라지거나 엉뚱해진다.
→ 텍스트 노드를 훑는 곳(`htmlTextNodes`, `replaceInHtml`, `replaceAcrossNodes`)은 `inAtomSpan(node)` 로 거른다.

## 6. 정규식: 고칠 말은 원문 자리에서 만든다
맞춤법 규칙 수정안을 `hit.replace(new RegExp(re.source), fix)` 처럼 **일치한 글자만 떼어** 다시 맞추면, 앞뒤 글자를 보는 규칙(`게되(?=[다었…])`, `(?<![가-힣])안…`)은 맞지 않아 `suggest === hit` 로 처리돼 지적이 통째로 빠진다.
→ sticky(`y`) 판을 만들어 `ry.lastIndex = m.index; line.replace(ry, fix)` 로 원문 줄에서 바꾼 뒤 그 부분만 잘라 낸다. 규칙 정규식은 검사 한 번에 한 번만 만든다(줄마다 130개를 새로 만들던 것 — 21,600줄 원고 731ms → 203ms).
→ 비슷하게, `/(^|>)([^<]+)/` 로 '첫 글자 조각'을 찾을 때는 `g` 를 붙이고 빈칸뿐인 조각(`<b> </b>`, `&nbsp;`)을 건너뛴다(번호 다시 매기기가 조용히 실패하던 원인).

## 7. 변경 감지는 길이가 아니라 지문으로
`JSON.stringify(state).length` 로 '바뀌었나'를 보면 오타 수정처럼 글자 수가 같은 고침을 놓친다(10분 자동 버전이 안 남던 원인).
→ `hashStr(JSON.stringify(Vue.toRaw(state)))`. 큰 원고(20MB 넘음)를 문자열로 바꾸는 일은 한 번으로 줄인다 — 반응형 프록시 대신 `Vue.toRaw(state)` 를 넘기면 더 빠르다.

## 8. 전체 상태 deep watch 가 가장 큰 비용이다 (아직 그대로)
`watch(state, …, {deep:true})` 는 고칠 때마다 상태 나무 전체를 다시 훑는다. 블록 5,616개 가짜 원고에서 절 제목 한 글자를 고치면 약 350~400ms 멈췄다. deep watch 를 빼면 110~155ms, 번호 재계산(`recomputeNumbers`)만 빼면 310~330ms 였다.
→ 다른 deep watch 를 상태 전체에 더 걸지 않는다. 바꾸려면 '변경 카운터'(편집 반영 지점·구조 변경 함수에서 올림)로 바꾸되, **모든 변경 경로가 저장을 부르는지** 회귀 테스트로 확인해야 한다 — 하나라도 빠지면 원고가 저장되지 않는다. 그래서 미뤄 두었다.

## 9. 그 밖에 고친 것
- 그림목록.csv: 캡션 따옴표를 두 번 이스케이프했다(`""""`). 칸을 만드는 곳에서 한 번만.
- `paginate` 가 도중에 예외를 던지면 숨은 조판 무대가 남았다 → `try/finally`.
- 미리보기 조판이 끝난 뒤에야 낡은 결과를 버려 여러 벌이 겹쳐 돌았다 → `opt.cancel`.

## 10. 작업할 때 빠지기 쉬운 것
- **NBSP(U+00A0)** 가 정규식·문자열에 날것으로 들어 있다. Edit 도구 매칭이 실패하면 `repr` 로 줄을 보고 `scripts/patch_apply.py` 의 `{NBSP}` 를 쓴다.
- 128KB 한 줄(Vue·JSZip·IDML 틀) 때문에 `grep` 출력이 터진다 → `cut -c1-200`, 또는 블록 파일에서 찾는다.
- `setupState` 의 async 함수(`applyReplace`, `createBook`, `loadBook`, `saveManualSnapshot` …)는 await 한다. confirm·prompt 가 뜨는 함수는 Playwright 에서 `dialog.accept()` 를 걸어 둔다.
- Playwright 에서 file:// 로 열면 IndexedDB 는 열 때마다 새 컨텍스트에 따로 생긴다 — 검사마다 `browser.newContext()` 로 깨끗하게 시작한다.
- 고친 코드가 강사용 파일로 복제된다. 강사용에서만 도는 갈래(`IS_WRITER`)를 깨지 않았는지 본다.

## 버그 찾기 점검표

버그·최적화를 찾아 달라는 요청이면 이 차례로 본다. 위 1~8이 모두 이 갈래에서 나왔다.

1. **저장 경로**: Promise 가 끝나지 않을 수 있는 곳(이벤트 하나만 듣는 IndexedDB·FileReader·Image), 실패를 성공처럼 보이는 상태 글, 저장 전 닫기, 동시에 도는 읽고-고치고-쓰기(교재 목록 색인).
2. **상태 교체**: `Object.assign(state, …)` 를 쓰는 모든 곳과 `defaultState`·`normalizeState` 의 키 목록 비교.
3. **글 고치기 경로**: text/html 짝(칸·항목), 원자 칸, 찾기·바꾸기·규칙 반영·참조 갱신이 모든 블록 종류(`text`·`note`·`heading`·`item`·`table` 칸·`sub` 칸·캡션)를 다 도는지.
4. **정규식**: `g` 없는 replace 에 콜백 상태(`done`), 전후방 탐색이 있는 규칙을 일치 조각만으로 다시 쓰는 곳, 사용자 입력을 정규식으로 만들 때 이스케이프.
5. **변경 감지·캐시 열쇠**: 길이·개수로만 비교하는 곳, 그림을 길이로만 지문 내는 곳(`chapSig`).
6. **비용**: 상태 전체 deep watch, 줄·칸마다 하는 `new RegExp`·`JSON.stringify`·`blockLoc` 같은 책 전체 훑기, 겹쳐 도는 비동기 조판.
7. **내보내기**: CSV·XML 이스케이프 두 번/빠짐, IDML 의 Self id 중복, ICML 에 견본(색) 정의 빠짐.

찾은 것은 실제로 재현해 본다. setupState 로 함수를 불러 상태를 만들고 결과를 보면 대부분 1분 안에 확인된다. 재현한 것과 코드만 보고 추정한 것은 구분해서 알린다.
