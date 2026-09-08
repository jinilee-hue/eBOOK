#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""영상 어디에 말이 들어 있나 — content/slots.js

요약 낭독을 영상이 끝난 뒤에만 두면, 대사가 아예 없는 쪽에서도 장면이
다 지나간 뒤에야 설명이 나온다. 말이 없는 구간을 알면 그 자리에 넣을 수 있다.

소리 크기만으로는 판단할 수 없다 — 배경음도 소리다. 그래서 Whisper 에 보내
말이 나오는 시각을 받고, 그 사이의 빈 구간을 찾는다.

  export OPENAI_API_KEY=...
  python3 tools/find_speech.py

쪽마다 결과는 둘 중 하나다.
  at: 12.4   영상 12.4초 지점부터 요약을 틀어도 대사와 안 겹친다
  at: null   빈 구간이 모자라다 → 영상이 끝난 뒤에 튼다
"""

import argparse, io, json, os, re, subprocess, sys, time, urllib.request, urllib.error, uuid

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID     = os.path.join(ROOT, 'assets', 'videos')
SUM     = os.path.join(ROOT, 'assets', 'audio-sum')
JSC     = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
FFMPEG  = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'

PAD = 0.30    # 말 앞뒤로 이만큼 비켜 준다. 딱 붙이면 숨소리에 겹친다

# 대사가 이미 이야기를 다 하는 쪽에서는 요약이 군더더기다.
# 말이 영상의 이만큼을 차지하면 요약을 아예 빼고, 그 아래는 짧게 권한다.
DROP  = 0.70
SHORT = 0.45


def book():
    code = ('var out = MOC.PAGES.map(function(p){'
            ' return { n:p.n, video:p.video, sum:(MOC.SUMMARY||{})[p.n] || "",'
            '          text:p.lines.map(function(l){return l.t}).join(" ") }; });'
            'print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'js', 'content.js'),
         os.path.join(ROOT, 'content', 'summary.js'), '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def duration(path):
    out = subprocess.check_output([FFPROBE, '-v', 'error', '-show_entries',
                                   'format=duration', '-of', 'csv=p=0', path], text=True)
    return float(out.strip())


def need(page):
    """요약이 차지할 길이. 음성이 이미 있으면 실제 길이, 없으면 글자 수로 어림잡는다."""
    f = os.path.join(SUM, 'p%02d.mp3' % page['n'])
    if os.path.exists(f):
        return duration(f)
    return len(page['sum']) / 13.0 + 0.5


def _transcribe(video, start=None, length=None):
    """영상의 소리 한 토막을 Whisper 에 보내 낱말 시각을 받는다.
    start/length 를 주면 그 구간만 보낸다. 시각은 구간 기준(0부터)이다."""
    key = os.environ.get('OPENAI_API_KEY')
    if not key:
        sys.exit('OPENAI_API_KEY 환경변수가 없습니다.')
    wav = os.path.join(SUM, '.probe.mp3')
    os.makedirs(SUM, exist_ok=True)
    cut = []
    if start is not None:
        cut += ['-ss', '%.3f' % start]
    if length is not None:
        cut += ['-t', '%.3f' % length]
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error'] + cut + ['-i', video, '-vn',
                    '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '64k', wav],
                   check=True)

    b = uuid.uuid4().hex
    buf = io.BytesIO()
    def part(name, value):
        buf.write(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n'
                   % (b, name, value)).encode('utf-8'))
    part('model', 'whisper-1')
    part('response_format', 'verbose_json')
    part('timestamp_granularities[]', 'word')
    part('language', 'en')
    buf.write(('--%s\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\n'
               'Content-Type: audio/mpeg\r\n\r\n' % b).encode('utf-8'))
    with open(wav, 'rb') as f:
        buf.write(f.read())
    buf.write(('\r\n--%s--\r\n' % b).encode('utf-8'))

    req = urllib.request.Request(
        'https://api.openai.com/v1/audio/transcriptions', data=buf.getvalue(), method='POST',
        headers={'Authorization': 'Bearer ' + key,
                 'Content-Type': 'multipart/form-data; boundary=' + b})
    doc = None
    for tries in range(4):        # 창을 나눠 보내느라 호출이 많다. 끊기면 다시 건다
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                doc = json.load(r)
            break
        except urllib.error.HTTPError as e:
            sys.exit('API 오류 %s: %s' % (e.code, e.read().decode('utf-8', 'replace')[:300]))
        except Exception as e:
            if tries == 3:
                sys.exit('통신이 계속 끊깁니다: %s' % e)
            time.sleep(1.5 * (tries + 1))
    try:
        pass
    finally:
        if os.path.exists(wav):
            os.remove(wav)

    # 문장 구간은 앞뒤 침묵까지 품어 실제보다 넓다. 낱말 하나하나의 시각을 쓴다.
    off = start or 0.0
    words = [(float(w['start']) + off, float(w['end']) + off, w.get('word', ''))
             for w in (doc.get('words') or [])]
    if words:
        return words
    return [(float(g['start']) + off, float(g['end']) + off, (g.get('text') or '').strip())
            for g in (doc.get('segments') or [])]


def _words(text):
    return set(w for w in re.split(r"[^a-z']+", (text or '').lower()) if w)


def real_speech(spans, text):
    """Whisper 는 말이 없는 구간에서 "Thanks for watching" 같은 문구를 지어낸다.
    배경 음악이 계속 깔려 있어 음량으로는 갈리지 않는다. 대신 그 쪽 원문과
    맞춰 본다 — 지어낸 문구는 원문에 없는 말로 이루어져 있다."""
    book_words = _words(text)
    out = []
    for a, b, t in spans:
        ws = [w for w in re.split(r"[^a-z']+", t.lower()) if w]
        if not ws:
            continue
        hit = sum(1 for w in ws if w in book_words) / float(len(ws))
        if hit < 0.5:
            print('     · 지어낸 말로 보고 버림  %5.2f~%5.2f  "%s" (원문 일치 %.0f%%)'
                  % (a, b, t[:48], hit * 100))
            continue
        out.append((a, b, t))
    return out


def _group(words):
    """0.35초 안쪽으로 붙은 낱말을 한 덩어리로 묶는다 (숨 쉬는 틈은 틈이 아니다)"""
    if not words:
        return []
    spans, cur = [], list(words[0])
    for a, b, t in words[1:]:
        if a - cur[1] <= 0.35:
            cur[1] = b
            cur[2] += ' ' + t
        else:
            spans.append(tuple(cur))
            cur = [a, b, t]
    spans.append(tuple(cur))
    return [(a, b, t.strip()) for a, b, t in spans]


def speech_spans(video):
    """말이 나오는 구간을 돌려준다.
    소리 트랙이 아예 없는 영상은 대사가 없는 것으로 본다.

    ※ 한 번에 통째로 보내면 whisper-1 이 뒤쪽을 통째로 흘리는 일이 있다.
      같은 파일을 두 번 넣어도 결과가 다르다. 그래서 겹치는 창으로 나눠
      보내고 합친다 — 한 창이 흘려도 이웃 창이 받아 낸다. 영상이 10~20초라
      호출이 서너 번 더 늘 뿐이다.

      합치는 단위는 낱말이 아니라 구간이다. 낱말로 합치면 창마다 시각이
      조금씩 달라 같은 말이 두 번 끼어들고 문장이 뒤섞인다."""
    probe = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a',
                            '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', video],
                           capture_output=True, text=True)
    if not probe.stdout.strip():
        return []
    total = duration(video)
    WIN, OVL = 6.0, 2.0
    passes = [_group(_transcribe(video))]      # 통째로 한 번
    at = 0.0
    while at < total - 0.5:                    # 겹치는 창으로 다시 훑는다
        passes.append(_group(_transcribe(video, at, WIN)))
        at += WIN - OVL

    # 창이 겹치므로 진짜 대사는 여러 번(통째 한 번 + 창 하나 이상) 잡힌다.
    # 지어낸 문구는 한 창에서만 튀어나온다. 몇 번 잡혔는지를 세어 둔다.
    merged = []
    for sp in passes:
        for a, b, t in sp:
            hit = None
            for k, (a2, b2, t2, c2) in enumerate(merged):
                if a < b2 and a2 < b:          # 시간이 겹치면 같은 대사다
                    hit = k
                    break
            if hit is None:
                merged.append((a, b, t, 1))
                continue
            a2, b2, t2, c2 = merged[hit]
            # 시각은 넓은 쪽, 글자는 더 많이 받아 낸 쪽을 남긴다
            merged[hit] = (min(a, a2), max(b, b2),
                           t if len(t.split()) > len(t2.split()) else t2, c2 + 1)
    merged = [(a, b, t) for a, b, t, c in merged if c >= 2]
    # 합치는 사이에 A 가 자라 B 와 겹치게 되는 일이 있다. 한 번 더 훑어 붙인다.
    merged.sort()
    out = []
    for a, b, t in merged:
        if out and a < out[-1][1]:
            a2, b2, t2 = out[-1]
            out[-1] = (a2, max(b, b2), t if len(t.split()) > len(t2.split()) else t2)
            continue
        out.append((a, b, t))
    return out


def find_slot(spans, vid_len, want):
    """말과 말 사이에서 want 초가 들어갈 첫 자리를 찾는다.

    영상 끝을 넘어가도 된다 — 마지막 장면이 멈춘 채 남으므로 화면은 이어진다.
    막아야 하는 것은 대사와의 겹침뿐이다.

    가장 넉넉한 자리가 아니라 가장 이른 자리를 고른다. 늦게 둘수록 장면이
    다 지나간 뒤에 설명이 붙어, 보면서 듣는 느낌이 사라진다.
    """
    busy = sorted((max(0, a - PAD), b + PAD) for a, b, _ in spans)
    cur = 0.0
    for a, b in busy:
        if a - cur >= want:
            return round(cur, 2)
        cur = max(cur, b)
    return round(cur, 2)      # 마지막 대사 뒤. 영상 끝을 넘겨도 괜찮다


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pages')
    a = ap.parse_args()

    pgs = book()
    if a.pages:
        want = {int(x) for x in a.pages.split(',')}
        pgs = [p for p in pgs if p['n'] in want]

    # 일부 쪽만 돌릴 때 나머지를 잃지 않도록 기존 결과를 읽어 두고 덮어쓴다
    slots = {}
    prev = os.path.join(ROOT, 'content', 'slots.js')
    if os.path.exists(prev):
        txt = open(prev, encoding='utf-8').read()
        i, j = txt.find('{', txt.find('SLOTS')), txt.rfind('}')
        if i > 0 and j > i:
            try:
                slots = {int(k): v for k, v in json.loads(txt[i:j + 1]).items()}
            except Exception:
                slots = {}

    print('  쪽   영상    말 비중   요약      자리\n')
    for p in pgs:
        v = os.path.join(VID, p['video'])
        if not os.path.exists(v):
            continue
        vl = duration(v)
        w = need(p)
        spans = real_speech(speech_spans(v), p.get('text', ''))
        at = find_slot(spans, vl, w)
        talk = sum(b - a for a, b, _ in spans) / vl if vl else 0
        slots[p['n']] = False if talk >= DROP else at
        if talk >= DROP:
            where = '요약 뺌 — 대사가 다 말한다'
        else:
            where = ('%.1f초부터' % at) + (' · 영상 안' if at + w <= vl + 0.1
                                           else (' · 영상 끝 넘김' if at < vl else ' · 영상 뒤'))
            if talk >= SHORT:
                where += '  (짧게 권함)'
        print('  %2d  %5.1f초  말 %3.0f%%  요약 %4.1f초   %s'
              % (p['n'], vl, talk * 100, w, where))

    out = os.path.join(ROOT, 'content', 'slots.js')
    slots = {str(k): slots[k] for k in sorted(slots)}
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* 자동 생성 — tools/find_speech.py\n'
                '   쪽마다 요약 낭독을 넣을 자리(초). null 이면 영상이 끝난 뒤에 튼다.\n'
                '   영상을 바꾸면 다시 돌린다. */\n')
        f.write('window.MOC = window.MOC || {};\n')
        f.write('window.MOC.SLOTS = ')
        json.dump(slots, f)
        f.write(';\n')
    print('\n  → content/slots.js')


if __name__ == '__main__':
    main()
