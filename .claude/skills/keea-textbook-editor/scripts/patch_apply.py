#!/usr/bin/env python3
"""정확히 한 번만 바뀌는 패치를 적용한다.

  python3 patch_apply.py <html> <patch 파일> [--check]

패치 파일 형식 (@@@ 줄은 줄 첫머리에 그대로):

    @@@ PATCH 이름 (설명)
    @@@ OLD
    바꿀 원래 글 (여러 줄 그대로)
    @@@ NEW
    새 글
    @@@ END

- OLD 는 파일에서 정확히 한 번 나와야 한다. 하나라도 0번·2번 이상이면 아무것도 바꾸지 않고 1 로 끝난다.
- OLD/NEW 안의 {NBSP} 는 줄바꿈 없는 빈칸(U+00A0)으로 바뀐다. 이 소스는 정규식 안에 NBSP 가 날것으로
  들어 있는 곳이 많아 Edit 도구의 문자열 매칭이 자주 실패한다.
- 패치들은 위에서부터 차례로 적용된다(앞 패치가 바꾼 글을 뒤 패치가 OLD 로 쓸 수 있다).
--check 는 일치만 확인하고 파일은 그대로 둔다.
"""
import sys

def parse(text):
    patches, cur, mode, buf = [], None, None, []
    def close():
        nonlocal buf
        if cur is not None and mode in ('old', 'new'):
            cur[mode] = '\n'.join(buf)
        buf = []
    for line in text.split('\n'):
        if line.startswith('@@@ PATCH'):
            close(); cur = {'name': line[len('@@@ PATCH'):].strip() or f'#{len(patches)+1}'}; patches.append(cur); mode = None
        elif line.strip() == '@@@ OLD':
            close(); mode = 'old'
        elif line.strip() == '@@@ NEW':
            close(); mode = 'new'
        elif line.strip() == '@@@ END':
            close(); mode = None
        elif mode:
            buf.append(line)
    close()
    for p in patches:
        if 'old' not in p or 'new' not in p:
            sys.exit(f'패치 "{p["name"]}" 에 OLD/NEW 가 다 있지 않습니다')
        p['old'] = p['old'].replace('{NBSP}', ' ')
        p['new'] = p['new'].replace('{NBSP}', ' ')
    return patches

def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    path, ppath = sys.argv[1], sys.argv[2]
    check = '--check' in sys.argv[3:]
    src = open(path, encoding='utf-8').read()
    patches = parse(open(ppath, encoding='utf-8').read())
    if not patches:
        sys.exit('패치가 없습니다')
    work, bad = src, False
    for p in patches:
        n = work.count(p['old'])
        if n != 1:
            hint = ''
            # NBSP 를 빈칸으로 보면 맞는지 — 맞으면 {NBSP} 를 쓰라고 알려 준다
            if n == 0 and ' ' not in p['old'] and work.replace(' ', ' ').count(p['old']) == 1:
                hint = '  (원본 이 자리에 NBSP 가 있습니다 — 그 빈칸을 {NBSP} 로 적으세요)'
            print(f'[FAIL] {p["name"]}: {n}곳 일치{hint}')
            bad = True
            continue
        work = work.replace(p['old'], p['new'])
        print(f'[ok]   {p["name"]}')
    if bad:
        print('\n하나라도 실패해서 파일은 그대로 두었습니다.')
        sys.exit(1)
    if check:
        print('\n--check: 모두 정확히 한 번 일치 (파일은 그대로)')
        return
    open(path, 'w', encoding='utf-8').write(work)
    print(f'\n{len(patches)}개 적용 → {path}')

if __name__ == '__main__':
    main()
