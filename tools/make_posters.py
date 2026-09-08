#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""배경 영상의 첫 프레임을 정지 이미지로 뽑는다 — assets/posters/

scenes.js 는 영상이 받아질 때까지 절차적 씬(Canvas 로 그린 도형)을 띄운다.
받는 사이에 그 그림이 보이는데, 흐름 판은 쪽이 저절로 넘어가서 자주 눈에 띈다.

첫 프레임을 미리 깔아 두면 영상이 붙을 때 같은 그림이 이어져 전환이 안 보인다.

  python3 tools/make_posters.py
  python3 tools/make_posters.py --from assets/videos      # 기존 판 영상으로
"""

import argparse, os, subprocess, sys

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST    = os.path.join(ROOT, 'assets', 'posters')
FFMPEG = '/opt/homebrew/bin/ffmpeg'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='src', default=os.path.join('assets', 'videos-flow'))
    ap.add_argument('--width', type=int, default=1280)
    ap.add_argument('--quality', type=int, default=5, help='2(최고)~31(최저). 기본 5')
    a = ap.parse_args()

    src = os.path.join(ROOT, a.src)
    if not os.path.isdir(src):
        sys.exit('영상 폴더를 찾을 수 없습니다: ' + src)
    os.makedirs(DST, exist_ok=True)

    files = sorted(f for f in os.listdir(src) if f.endswith('.mp4'))
    if not files:
        sys.exit('mp4 가 없습니다: ' + src)

    total = 0
    for f in files:
        out = os.path.join(DST, os.path.splitext(f)[0] + '.jpg')
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error',
                        '-ss', '0', '-i', os.path.join(src, f), '-frames:v', '1',
                        '-vf', 'scale=%d:-2' % a.width,
                        '-q:v', str(a.quality), out], check=True)
        kb = os.path.getsize(out) / 1024
        total += kb
        print('  %-22s → %-22s %5.0f KB' % (f, os.path.basename(out), kb))

    print('\n  %d장 · 합계 %.0f KB' % (len(files), total))


if __name__ == '__main__':
    main()
