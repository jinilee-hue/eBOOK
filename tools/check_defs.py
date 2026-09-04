#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""부르는데 정의가 없는 함수를 찾는다.

구문 검사는 이걸 못 잡는다. 블록을 잘라내다 이웃 함수를 같이 지워도
문법은 멀쩡하고, 그 함수를 부르는 순간에만 터진다.
이 세션에서만 세 번 났다 (paint, narrateLines, hlScan/hlSet/hlPaint).

문자열·주석 안의 내용을 주석으로 착각하지 않도록 한 글자씩 훑는다.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['js/app.js', 'js/tts.js', 'js/fit.js', 'js/scenes.js']

KNOWN = set("""
if for while switch catch return typeof function do else try finally new delete void in of
Object Array String Number Boolean Math JSON Date RegExp Error Promise Map Set Symbol
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent setTimeout clearTimeout
setInterval clearInterval requestAnimationFrame cancelAnimationFrame fetch console alert
Audio Image URL Blob Event CustomEvent SpeechSynthesisUtterance AudioContext webkitAudioContext
IntersectionObserver ResizeObserver MutationObserver localStorage document window navigator
location matchMedia getComputedStyle addEventListener removeEventListener dispatchEvent
speechSynthesis Intl Function eval print quit readFile confirm prompt
""".split())


def strip(src):
    """주석과 문자열을 공백으로 지운다. 정규식 리터럴도 건너뛴다."""
    out, i, n = [], 0, len(src)
    prev = ''
    while i < n:
        c = src[i]
        nx = src[i + 1] if i + 1 < n else ''
        if c == '/' and nx == '*':
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            out.append(' ')
        elif c == '/' and nx == '/':
            j = src.find('\n', i)
            i = n if j < 0 else j
            out.append(' ')
        elif c in '"\'`':
            q, j = c, i + 1
            while j < n and src[j] != q:
                j += 2 if src[j] == '\\' else 1
            i = j + 1
            out.append('""')
        elif c == '/' and prev in '(,=:[!&|?{};\n' :
            # 정규식 리터럴
            j = i + 1
            while j < n and src[j] != '/':
                if src[j] == '\\':
                    j += 1
                elif src[j] == '\n':
                    break
                j += 1
            if j < n and src[j] == '/':
                i = j + 1
                out.append('RE')
            else:
                out.append(c); i += 1
        else:
            out.append(c); i += 1
        if out and out[-1].strip():
            prev = out[-1][-1]
    return ''.join(out)


def scan(path):
    src = strip(open(os.path.join(ROOT, path), encoding='utf-8').read())
    defined = set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', src))
    for chunk in re.findall(r'\b(?:var|let|const)\s+([^;\n]+)', src):
        for part in chunk.split(','):
            m = re.match(r'\s*([A-Za-z_$][\w$]*)', part)
            if m:
                defined.add(m.group(1))
    for args in re.findall(r'\bfunction\s*[A-Za-z_$\w]*\s*\(([^)]*)\)', src):
        for a in args.split(','):
            if a.strip():
                defined.add(a.strip())

    # get x() / set x() 는 호출이 아니라 정의다
    defined |= set(re.findall(r'\b(?:get|set)\s+([A-Za-z_$][\w$]*)\s*\(', src))

    bad = []
    for m in re.finditer(r'(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(', src):
        name = m.group(1)
        if name in defined or name in KNOWN:
            continue
        bad.append((src[:m.start()].count('\n') + 1, name))
    return bad


def main():
    total = 0
    for f in FILES:
        for line, name in scan(f):
            total += 1
            print('  %s:%d  %s() 의 정의를 찾을 수 없습니다' % (f, line, name))
    if total:
        print('\n%d곳' % total)
        sys.exit(1)
    print('  ✓ 정의 없는 호출 없음')


if __name__ == '__main__':
    main()
