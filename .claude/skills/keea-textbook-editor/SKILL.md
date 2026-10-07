---
name: keea-textbook-editor
description: 교재 원고 작성기(교재원고작성기.html — 한국전기기술인협회 교재 원고 작성·검토·조판·인디자인/한글 내보내기를 한 파일에 담은 2만 2천 줄짜리 Vue 3 단일 HTML 앱)를 고치거나, 버그·최적화할 곳을 찾거나, 기능을 더하거나, 강사용 배포 파일·자동저장·쪽나눔(조판)·수식·HWP 불러오기·IDML 내보내기를 손볼 때 반드시 이 스킬을 쓴다. 사용자가 파일 이름을 대지 않고 "원고 작성기", "교재 편집기", "그 html 도구", "keea", "자동저장이 안 돼", "조판이 이상해", "강사용 파일" 처럼 말해도 이 도구 이야기면 쓴다. 큰 단일 HTML 을 안전하게 읽고(스크립트 분리), 정확히 한 번만 바꾸는 패치로 고치고, 헤드리스 크롬 회귀·성능 테스트로 확인하는 절차와 이미 밝혀진 함정을 담고 있다.
---

# 교재 원고 작성기 수정·검증

이 도구는 서버 없이 브라우저에서 바로 여는 **한 개의 HTML 파일**이다. 원고·버전·보관함은 모두 사용자 브라우저의 IndexedDB 에 있고, 관리자용 파일이 **자기 자신을 복제해 강사용 파일을 만든다**. 그래서 작은 실수도 (1) 원고 유실로, (2) 이미 나눠 준 강사용 파일 전체로 번진다. 아래 절차는 그 두 위험을 줄이려고 만든 것이다.

구조·자료 모델·저장 흐름은 `references/architecture.md`, 이미 밝혀진 함정과 고친 내용은 `references/pitfalls.md` 에 있다. 처음 이 파일을 만지는 작업이면 둘 다 먼저 읽는다 — 함정 목록에 있는 실수를 다시 하지 않는 것이 이 스킬의 가장 큰 쓸모다.

## 작업 절차

### 1. 구조 파악 (읽기 전에)

파일은 22,000줄을 넘고 128KB 짜리 한 줄(Vue·JSZip·IDML 틀)이 있어 Read 도구로 통째로 읽을 수 없다. 스크립트 블록을 나눠 문법부터 확인한다.

```bash
python3 .claude/skills/keea-textbook-editor/scripts/split_check.py 교재원고작성기.html --out <scratchpad>/blocks
```

블록별 파일(`b2_indent.js` …)과 "원본 줄 = 블록 줄 + 오프셋" 표가 나온다. 읽을 때는 블록 파일을 쓰고, 사용자에게 알릴 때는 **원본 파일 줄 번호**로 바꿔 말한다(사용자는 원본만 본다).

라이브러리 블록(Vue 3.4.31 prod, JSZip, `IDML_TPL` 한 줄 틀)은 고치지 않는다.

### 2. 고칠 곳 찾기

`references/architecture.md` 의 "찾아가는 이름" 표에서 함수 이름으로 grep 한다. 버그를 찾아 달라는 요청이면 `references/pitfalls.md` 끝의 **점검표**를 따라 훑는다 — 저장·상태 교체·꾸민 글·정규식·IndexedDB·조판처럼 이 앱에서 실제로 문제가 났던 갈래부터 본다.

### 3. 고치기 — 정확히 한 번만 바뀌는 패치로

소스 곳곳에 **줄바꿈 없는 빈칸(U+00A0)이 정규식 안에 그대로** 들어 있어 Edit 도구의 문자열 매칭이 자주 실패한다. 여러 군데를 고칠 때는 패치 파일로 묶어 적용한다:

```bash
python3 .claude/skills/keea-textbook-editor/scripts/patch_apply.py 교재원고작성기.html my.patch          # 적용
python3 .claude/skills/keea-textbook-editor/scripts/patch_apply.py 교재원고작성기.html my.patch --check  # 시험만
```

패치 형식과 `{NBSP}` 표기는 스크립트 머리 주석에 있다. 각 OLD 조각이 파일에서 **정확히 한 번** 나와야만 적용되므로, 엉뚱한 곳이 바뀌는 일이 없다. 줄에 NBSP 가 있는지는 `python3 -c "print(repr(open(F).read().split('\n')[N-1]))"` 로 본다.

고칠 때 지킬 것:
- 주석은 이 코드베이스처럼 **쉬운 우리말로 '왜'를** 적는다 (예: `// 저장 공간이 모자라면 거래는 error 가 아니라 abort 로 끝난다`).
- 상태의 최상위 키를 새로 만들면 `defaultState()` 에도 넣는다 — 안 넣으면 교재를 바꿀 때 앞 교재 값이 남는다 (pitfalls 3).
- 그림 파일을 받는 새 입구를 만들면 `fileToImageSrc` 를 거치게 한다. 못 여는 그림을 원본 그대로 넣지 않는다 (pitfalls 11).
- 표 칸·번호 항목의 글을 바꿀 때는 `richAccessor` / `setRichHtml` 을 쓴다. `text` 만 바꾸면 꾸밈이 통째로 사라진다 (pitfalls 4).
- 전체 상태에 `deep:true` watch 를 더 걸지 않는다. 지금 있는 것 하나만으로도 블록 5,600개 원고에서 한 번 고칠 때마다 약 200ms 가 든다 (pitfalls 8).
- 강사용(IS_WRITER) 갈래도 같이 생각한다. 관리자 파일의 코드가 그대로 강사용 파일로 복제된다.

### 4. 검증 — 브라우저에서

조판·수식·IndexedDB 는 실제 브라우저가 있어야 돈다. Chromium 과 Playwright 가 있으면:

```bash
S=.claude/skills/keea-textbook-editor/scripts
python3 $S/split_check.py 교재원고작성기.html          # 문법 (모든 블록 node --check)
node $S/smoke.js 교재원고작성기.html                   # 열 때 오류 없음 · 주요 전역 · 화면 뜸
node $S/regression.js 교재원고작성기.html              # 지금까지 고친 버그·TIFF 변환·ComfyUI 오류 알림 38가지가 다시 안 나는지
node $S/perf.js 교재원고작성기.html                    # 큰 가짜 원고에서 고침 지연·규칙 검사 시간
```

- 새 버그를 고쳤으면 `regression.js` 에 그 버그를 재현하는 검사를 하나 더하고, **고치기 전 파일에서는 실패하는지**도 돌려 본다. 원본에서도 통과하는 검사는 아무것도 지켜 주지 못한다.
- 앱 내부 함수는 `document.querySelector('#app')._vnode.component.setupState` 로 부른다 (prod 빌드라 `__vue_app__._instance` 는 null). 상태는 `window.__KEEA__.state`.
- `applyReplace` 처럼 async 인 함수는 꼭 await 한다. confirm·prompt 창은 `page.on('dialog', d => d.accept())` 로 받는다.
- 자동저장은 입력 묶음 250ms + 쉼 900ms 뒤에 돈다. 저장 결과를 볼 때는 2초쯤 기다린다.
- 성능을 건드렸으면 `perf.js` 를 고치기 전과 후 둘 다 돌려 숫자로 말한다.

### 5. 마무리

- 저장소에서 작업하면 **원본을 먼저 커밋하고** 고친 것을 다음 커밋으로 남긴다. diff 가 곧 고친 내역이 된다.
- 사용자에게는 고친 것마다: 증상(사용자 눈에 보이는 것) → 원인 → 고친 방법 → 확인 방법을 원본 줄 번호와 함께 짧게 알린다. 고치지 않은 것(위험해서 미룬 것)과 그 이유도 같이 적는다.
- 고친 HTML 은 파일로 건넨다. 강사용 파일은 관리자 파일에서 다시 만들어야 고친 내용이 들어간다는 점을 알려 준다.
