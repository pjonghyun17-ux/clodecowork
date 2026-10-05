#!/usr/bin/env python3
"""교재원고작성기.html 의 <script> 블록을 나눠 보이고 문법을 검사한다.

  python3 split_check.py <html> [--out DIR] [--no-check]

--out 을 주면 블록마다 파일(b0_vue.js, b2_indent.js …)로 저장한다. 큰 파일을 Read 로 읽을 때 쓴다.
출력의 '원본 줄 = 블록 줄 + 오프셋' 으로 블록 파일의 줄 번호를 원본 줄 번호로 바꾼다.
node 가 있으면 블록마다 `node --check` 를 돌리고, 하나라도 실패하면 1 로 끝난다.
"""
import argparse, os, re, shutil, subprocess, sys

# 블록 첫머리로 알아보는 이름 (모르면 'block')
NAMES = [
    (r'vue v3', 'vue'), (r'JSZip', 'jszip'), (r'문단 번호 체계', 'indent'), (r'조판 엔진', 'typeset'),
    (r'KEEA 수식', 'eq'), (r'IDML_TPL', 'indd'), (r'createApp', 'app'),
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--out')
    ap.add_argument('--no-check', action='store_true')
    a = ap.parse_args()

    src = open(a.html, encoding='utf-8').read()
    blocks = []
    for m in re.finditer(r'<script>(.*?)</script>', src, re.S):
        start_line = src.count('\n', 0, m.start(1)) + 1   # 블록 글이 시작하는 원본 줄
        body = m.group(1)
        head = body[:4000]
        name = next((n for pat, n in NAMES if re.search(pat, head)), 'block')
        blocks.append((name, start_line, body))

    node = shutil.which('node') if not a.no_check else None
    if a.out:
        os.makedirs(a.out, exist_ok=True)
    bad = 0
    print(f'{"#":>2}  {"이름":<8} {"원본 줄":>15}  {"오프셋":>6}  문법')
    for i, (name, start, body) in enumerate(blocks):
        end = start + body.count('\n')
        # 블록 파일 1줄 = 원본 start 줄 → 원본 줄 = 블록 줄 + (start - 1)
        off = start - 1
        status = '-'
        path = None
        if a.out or node:
            path = os.path.join(a.out, f'b{i}_{name}.js') if a.out else os.path.join('/tmp', f'_keea_b{i}.js')
            with open(path, 'w', encoding='utf-8') as f:
                f.write(body)
        if node:
            r = subprocess.run([node, '--check', path], capture_output=True, text=True)
            status = 'ok' if r.returncode == 0 else 'FAIL'
            if r.returncode:
                bad += 1
                msg = (r.stderr or '').strip().splitlines()
                print('\n'.join('      ' + x for x in msg[:6]))
        print(f'{i:>2}  {name:<8} {start:>6}~{end:<8}  {off:>6}  {status}')
        if path and not a.out:
            os.remove(path)
    if a.out:
        print(f'\n블록 파일: {a.out}')
    if not node and not a.no_check:
        print('\n(node 가 없어 문법 검사는 건너뜀)')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main()
