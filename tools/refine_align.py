#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""낱말 경계를 소리로 다시 잡는다 — js/align.js

Whisper 가 준 시각은 대체로 맞지만 낱말 경계가 몇십 밀리초씩 어긋난다.
그 상태로 잘라 들려주면 앞 낱말의 꼬리나 뒤 낱말의 머리가 딸려 나온다.
960개 중 38개는 아예 다음 낱말의 시작을 넘어서 있었다.

고치는 방법은 간단하다. 경계 근처에서 **가장 조용한 지점**을 찾아 거기로 옮긴다.
사람은 낱말과 낱말 사이에서 소리를 줄인다 — 그 골짜기가 진짜 경계다.

    python3 tools/refine_align.py            # 전체
    python3 tools/refine_align.py --dry-run  # 얼마나 옮겨지는지만 본다

원본은 js/align.js.bak 으로 남긴다.
"""

import argparse, io, json, math, os, re, struct, subprocess, sys

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO  = os.path.join(ROOT, 'assets', 'audio')
ALIGN  = os.path.join(ROOT, 'js', 'align.js')
FFMPEG = '/opt/homebrew/bin/ffmpeg'

SR   = 16000
HOP  = 0.005          # 5ms 간격으로 소리 크기를 잰다
BACK = 0.12           # 경계에서 이만큼 앞뒤를 뒤진다
FWD  = 0.08


def envelope(path):
    """5ms 마다의 소리 크기(RMS). 낱말 사이의 골짜기를 찾는 데 쓴다."""
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ac', '1',
                          '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True).stdout
    n = len(raw) // 2
    pcm = struct.unpack('<%dh' % n, raw[:n * 2])
    step = int(SR * HOP)
    out = []
    for i in range(0, n - step, step):
        s = 0
        for v in pcm[i:i + step]:
            s += v * v
        out.append(math.sqrt(s / step))
    return out


DIP = 0.55        # 원래 자리보다 이만큼 조용해야 '골짜기'로 인정한다


def quietest(env, lo, hi, at):
    """[lo, hi] 사이에서 가장 조용한 지점(초).

    아무 데나 옮기지 않는다. 원래 경계보다 뚜렷하게 조용한 곳이 있을 때만
    옮긴다 — 말이 끊이지 않고 이어지는 자리(연음)에는 골짜기가 없고,
    거기서 억지로 옮기면 낱말 한가운데를 자르게 된다."""
    a = max(0, int(lo / HOP))
    b = min(len(env), int(hi / HOP) + 1)
    if b <= a:
        return None
    k = min(range(a, b), key=lambda i: env[i])
    here = env[min(len(env) - 1, max(0, int(at / HOP)))]
    if here <= 1e-9:
        return None
    if env[k] > here * DIP:
        return None
    return k * HOP


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    src = io.open(ALIGN, encoding='utf-8').read()
    head = src[:src.index('window.MOC.ALIGN')]
    D = json.loads(re.search(r'ALIGN\s*=\s*(\{.*\})\s*;?\s*$', src, re.S).group(1))

    moved = big = 0
    print(' 쪽  낱말  옮긴 거리 중앙값  가장 많이 옮긴 것')
    for n in sorted(D, key=int):
        d = D[n]
        f = os.path.join(AUDIO, d['file'])
        if not os.path.exists(f):
            continue
        env = envelope(f)
        w = d['words']
        orig = [(x['t'], x['t1']) for x in w]   # 되돌릴 자리
        deltas = []
        for i, x in enumerate(w):
            prev = w[i - 1] if i else None
            nxt = w[i + 1] if i + 1 < len(w) else None
            t0, t10 = x['t'], x['t1']

            # 시작 — 앞쪽을 넓게 뒤진다. 낱말 머리가 잘리는 것보다
            # 앞의 조용한 데서 시작하는 편이 낫다.
            #
            # ※ 순서를 절대 뒤집지 않는다. 하이라이트는 이진 탐색으로 자리를
            #   찾으므로 t 가 오름차순이 아니면 엉뚱한 낱말을 짚는다.
            #   앞 낱말의 '시작'보다 앞으로는 못 가게 막는다.
            lo = t0 - BACK
            if prev:
                lo = max(lo, prev['t'] + 0.02, prev['t1'])
            q = quietest(env, max(0, lo), t0 + FWD, t0)
            if q is not None and q < t10 - 0.05 and (not prev or q > prev['t']):
                deltas.append(abs(q - t0)); x['t'] = round(q, 3)

            # 끝 — 뒤쪽을 뒤지되 다음 낱말을 넘지 않는다
            hi = t10 + BACK
            if nxt:
                hi = min(hi, nxt['t'])
            q = quietest(env, t10 - FWD, hi, t10)
            if q is not None and q > x['t'] + 0.05:
                deltas.append(abs(q - t10)); x['t1'] = round(q, 3)

            # 마지막 그물 — 그래도 어긋났으면 원래 값으로 되돌린다
            if prev and (x['t'] <= prev['t'] or x['t1'] < x['t']):
                x['t'], x['t1'] = t0, t10

        # ── 마지막 정리 ──
        # 경계를 하나씩 옮기다 보면 앞뒤가 뒤집히는 낱말이 생긴다. 하이라이트는
        # 이진 탐색으로 자리를 찾으므로 t 가 오름차순이 아니면 엉뚱한 낱말을 짚는다.
        # 어긋난 낱말은 원래 값으로 되돌리고, 그래도 어긋나면 앞 낱말 뒤에 붙인다.
        fixed = 0
        for i in range(1, len(w)):
            x, pv = w[i], w[i - 1]
            if x['t'] <= pv['t'] or x['t1'] < x['t']:
                x['t'], x['t1'] = orig[i]
                fixed += 1
            if x['t'] <= pv['t']:
                x['t'] = round(pv['t'] + 0.02, 3)
                fixed += 1
            if x['t1'] < x['t']:
                x['t1'] = round(x['t'] + 0.05, 3)
        if fixed:
            print(' %2s  순서가 어긋난 %d개를 되돌림' % (n, fixed))

        if deltas:
            deltas.sort()
            moved += len(deltas)
            big += sum(1 for v in deltas if v > 0.06)
            print(' %2s  %4d      %5.0f ms          %5.0f ms'
                  % (n, len(w), deltas[len(deltas) // 2] * 1000, deltas[-1] * 1000))

    print('\n 옮긴 경계 %d개 · 그중 60ms 넘게 옮긴 것 %d개' % (moved, big))
    if a.dry_run:
        print(' (--dry-run 이므로 파일은 그대로)')
        return
    if not os.path.exists(ALIGN + '.bak'):
        io.open(ALIGN + '.bak', 'w', encoding='utf-8').write(src)
    with io.open(ALIGN, 'w', encoding='utf-8') as f:
        f.write(head)
        f.write('window.MOC.ALIGN = ')
        json.dump(D, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print(' → js/align.js')


if __name__ == '__main__':
    main()
