#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
개발용 TTS 서버 — 낱말·문장 발음을 성우 목소리로 채운다

앱은 assets/audio/say/ 의 mp3를 먼저 찾는다. 없으면 이 서버에 물어보고,
서버는 OpenAI 로 만들어 돌려주면서 같은 경로에 저장한다.
한 번 만들어진 소리는 다시 만들지 않는다.

  # 작업할 때 (서버가 사이트도 같이 띄운다)
  python3 tools/tts_server.py
  → http://localhost:8787 를 브라우저로 연다

  # 시연 전에 한 번에 다 채워 두기 (권장)
  python3 tools/tts_server.py --prewarm

prewarm 을 돌리고 나면 서버 없이 index.html 을 그냥 열어도
모든 발음이 성우 목소리로 나온다. 인터넷도 필요 없다.

키는 환경변수로만 받는다.  export OPENAI_API_KEY=...
키는 이 서버에만 있고 배포본에는 들어가지 않는다.
"""

import argparse, http.server, json, os, re, socketserver, subprocess, sys, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_narration import synth_openai, STYLES, ROOT, JSC   # 설정을 한 곳에 둔다

SAY = os.path.join(ROOT, 'assets', 'audio', 'say')

# 낱말은 또박또박, 문장은 이야기하듯. 낭독(cinematic)보다 담백하게 — 설명이 아니라 시범이다.
KINDS = {
    'word': dict(speed=0.80, style=("Say this single English word clearly and kindly, "
                                    "the way a teacher shows a child how it sounds. "
                                    "Unhurried, with a warm falling tone. Do not spell it out.")),
    'sent': dict(speed=0.88, style=("Read this one sentence aloud to a child, warmly and slowly, "
                                    "as if pointing at the words while you read. "
                                    "Natural phrasing, never clipped.")),
}
VOICE = os.environ.get('MOC_TTS_VOICE', 'sage')
MODEL = 'gpt-4o-mini-tts'


def fnv1a(s):
    """js/tts.js 의 같은 이름 함수와 결과가 같아야 한다 (Math.imul 32비트)."""
    h = 0x811c9dc5
    for ch in s:
        h ^= ord(ch) & 0xff
        h = (h * 0x01000193) & 0xffffffff
    return format(h, 'x')


def slug(text):
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')[:40]
    return (s or 'x') + '-' + fnv1a(text)


def path_for(kind, text):
    return os.path.join(SAY, kind, slug(text) + '.mp3')


def make(kind, text):
    """이미 있으면 그대로 쓴다. 없을 때만 만든다."""
    k = KINDS.get(kind) or KINDS['sent']
    p = path_for(kind, text)
    if os.path.exists(p) and os.path.getsize(p) > 0:
        return p, False
    os.makedirs(os.path.dirname(p), exist_ok=True)
    data = synth_openai(text, VOICE, MODEL, k['style'], k['speed'])
    with open(p, 'wb') as f:
        f.write(data)
    return p, True


# ── 무엇을 미리 만들어 둘지 — content.js / dict.js 를 그대로 읽는다 ──
def targets():
    if not os.path.exists(JSC):
        sys.exit('JavaScriptCore를 찾을 수 없습니다. macOS에서 실행해 주세요.')
    code = ('var out={word:[],sent:[]};'
            'for (var k in MOC.DICT) out.word.push(k);'
            'MOC.PAGES.forEach(function(p){p.lines.forEach(function(l){out.sent.push(l.t);});});'
            'print(JSON.stringify(out));')
    raw = subprocess.check_output(
        [JSC, '-e', 'var window=globalThis;',
         os.path.join(ROOT, 'js', 'content.js'), os.path.join(ROOT, 'js', 'dict.js'),
         '-e', code], text=True)
    return json.loads(raw.strip().splitlines()[-1])


def prewarm(only=None, dry=False):
    t = targets()
    kinds = [only] if only else ['word', 'sent']
    todo = [(k, x) for k in kinds for x in t[k]]
    have = sum(1 for k, x in todo if os.path.exists(path_for(k, x)))
    print('낱말 %d · 문장 %d · 이미 있는 것 %d개\n' % (len(t['word']), len(t['sent']), have))
    made = 0
    for k, x in todo:
        if os.path.exists(path_for(k, x)):
            continue
        if dry:
            print('  [%s] %s' % (k, x[:60]))
            made += 1
            continue
        made += 1
        print('  [%s] %-4d %s' % (k, made, x[:60]))
        try:
            make(k, x)
        except SystemExit as e:
            print('\n중단: %s' % e)
            print('여기까지 만든 것은 그대로 남습니다. 다시 실행하면 이어서 만듭니다.')
            return
    if dry:
        print('\n(dry-run) 새로 만들 것 %d개' % made)
    elif made:
        print('\n%d개 만들었습니다. 이제 서버 없이도 성우 목소리로 나옵니다.' % made)
    else:
        print('전부 이미 있습니다. 할 일이 없습니다.')


# ── 서버 ──
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *a):
        pass                              # 정적 파일 요청까지 찍으면 시끄럽다

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path != '/say':
            return super().do_GET()
        q = urllib.parse.parse_qs(u.query)
        text = (q.get('t') or [''])[0].strip()
        kind = (q.get('k') or ['sent'])[0]
        if not text:
            self.send_error(400, 'no text')
            return
        try:
            p, fresh = make(kind, text)
        except BaseException as e:
            # 상태줄은 latin-1 만 담는다. 한글 사유를 넣으면 응답 자체가 깨진다.
            print('  실패  [%s] %s\n        %s' % (kind, text[:56], e))
            self.send_error(503, 'tts unavailable')
            return
        print('  %s [%s] %s' % ('만듦 ' if fresh else '캐시 ', kind, text[:56]))
        with open(p, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type', 'audio/mpeg')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8787)
    ap.add_argument('--prewarm', action='store_true', help='서버를 띄우지 않고 전부 미리 만든다')
    ap.add_argument('--only', choices=['word', 'sent'], help='prewarm 대상을 좁힌다')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--voice', help='기본 sage')
    a = ap.parse_args()

    global VOICE
    if a.voice:
        VOICE = a.voice
    os.makedirs(SAY, exist_ok=True)

    if a.prewarm:
        prewarm(a.only, a.dry_run)
        return

    with Server(('127.0.0.1', a.port), H) as srv:
        print('TTS 서버 · 목소리 %s · 캐시 %s' % (VOICE, os.path.relpath(SAY, ROOT)))
        if not os.environ.get('OPENAI_API_KEY'):
            print('\n  ※ OPENAI_API_KEY 가 없습니다. 캐시에 있는 것만 나가고'
                  '\n    없는 소리는 브라우저 내장 음성으로 내려갑니다.')
        print('\n  브라우저로 여세요 →  http://localhost:%d/\n' % a.port)
        print('  (file:// 로 열면 이 서버를 못 부릅니다. 캐시에 있는 것만 나옵니다)')
        print('  Ctrl+C 로 종료\n')
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print('\n종료했습니다.')


if __name__ == '__main__':
    main()
