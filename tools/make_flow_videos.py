#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""흐름 판(flow) 배경 영상 만들기 — assets/videos-flow/

흐름 판은 문제 없이 처음부터 끝까지 이어서 보는 형태다.
쪽은 낭독이 끝나면 넘어가므로, 영상도 낭독 길이에 맞아야 반복도 정지도 없다.

원본 영상이 낭독보다 1.7~5.3배 짧다. 그래서 중간 프레임을 만들어(minterpolate)
느린 화면으로 늘린다. 단순히 늘리면 뚝뚝 끊긴다.

소리는 뺀다. 5배로 늘어난 소리는 쓸 수 없고, 이 판에서는 낭독이 소리를 맡는다.

  python3 tools/make_flow_videos.py --dry-run
  python3 tools/make_flow_videos.py
  python3 tools/make_flow_videos.py --pages 9
"""

import argparse, json, os, subprocess, sys

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC    = os.path.join(ROOT, 'assets', 'videos')
DST    = os.path.join(ROOT, 'assets', 'videos-flow')
JSC    = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'

TAIL = 0.6      # 낭독보다 이만큼 길게 — 소리가 끝나기 전에 화면이 멈추면 안 된다
FPS  = 24


def plan():
    """쪽마다 원본 영상과 목표 길이(낭독 길이)를 뽑는다."""
    code = ('var out = MOC.PAGES.map(function(p){'
            ' var a = MOC.ALIGN[p.n];'
            ' return { n:p.n, video:p.video, dur:(a ? a.duration : 0) }; });'
            'print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'js', 'content.js'),
         os.path.join(ROOT, 'js', 'align.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def duration(path):
    out = subprocess.check_output(
        [FFPROBE, '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', path], text=True)
    return float(out.strip())


def stretch(src, dst, factor, crf, sharpen):
    vf = 'setpts=%.6f*PTS' % factor
    if factor > 1.05:
        # 중간 프레임을 만들어 낸다. 이게 없으면 늘린 만큼 끊겨 보인다.
        vf += ',minterpolate=fps=%d:mi_mode=mci:mc_mode=aobmc:vsbmc=1' % FPS
        if sharpen:
            # 보간된 프레임은 부드러워진다. 가볍게 되살린다 —
            # 세게 걸면 보간 흔적까지 같이 도드라진다.
            vf += ',unsharp=5:5:%.2f:5:5:0.0' % sharpen
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', src, '-an',
                    '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf),
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages', help='쉼표로 구분한 쪽 번호. 없으면 전부')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--crf', type=int, default=19,
                    help='낮을수록 화질이 좋고 용량이 는다 (기본 19)')
    ap.add_argument('--sharpen', type=float, default=0.5,
                    help='보간으로 흐려진 것을 되살리는 정도. 0 이면 끔')
    a = ap.parse_args()

    os.makedirs(DST, exist_ok=True)
    ps = plan()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        ps = [p for p in ps if p['n'] in want]

    print('  crf %d · 선명화 %.2f\n' % (a.crf, a.sharpen))
    print('  쪽  원본      목표      배율   파일')
    for p in ps:
        src = os.path.join(SRC, p['video'])
        if not os.path.exists(src):
            print('  %2d  원본 없음 — 건너뜀 (%s)' % (p['n'], p['video']))
            continue
        if p['dur'] <= 0:
            print('  %2d  낭독 길이를 모름 — 건너뜀' % p['n'])
            continue
        d0 = duration(src)
        target = p['dur'] + TAIL
        f = target / d0
        print('  %2d  %5.1f초  %5.1f초   %4.2fx  %s' % (p['n'], d0, target, f, p['video']))
        if a.dry_run:
            continue
        stretch(src, os.path.join(DST, p['video']), f, a.crf, a.sharpen)

    # 마지막 화면 영상은 낭독이 없다. 그대로 복사한다.
    end = os.path.join(SRC, '12_end.mp4')
    if os.path.exists(end) and not a.dry_run:
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', end, '-an',
                        '-c:v', 'copy', '-movflags', '+faststart',
                        os.path.join(DST, '12_end.mp4')], check=True)
        print('  12  그대로 (마지막 화면 — 낭독 없음)')

    if a.dry_run:
        print('\n  (dry-run: 아무것도 만들지 않았습니다)')
    else:
        print('\n  완료 — assets/videos-flow/')


if __name__ == '__main__':
    main()
