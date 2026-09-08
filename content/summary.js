/* ══════════════════════════════════════════════════════════════
   summary.js — 쪽별 요약 (흐름 판 전용)

   영상 소리가 이야기를 나르고, 대사가 끝난 자리에서 이 문장을 읽어 준다.
   본문을 그대로 읽지 않는다 — 본문은 책을 펼쳤을 때 읽는다.

   원칙
     · 본문보다 쉬운 낱말로. 초등 저·중학년이 듣고 바로 알아야 한다
     · 두 문장 안쪽. 길면 영상이 끝난 뒤 화면이 오래 멈춰 있게 된다
     · 대사 사이에 넣을 수 있으면 그 자리가 낫다. 3·7·11쪽은 빈 자리에 맞춰
       한 문장으로 줄였다 — tools/find_speech.py 가 잰 길이에 맞춘 값이다
     · 대사가 영상의 70% 를 넘는 쪽(7·8·10)은 요약을 아예 내보내지 않는다.
       영상이 이미 다 말하고 있어 군더더기가 된다. 문장은 남겨 둔다 —
       영상을 다시 뽑아 대사가 줄면 자동으로 되살아난다
     · 장면을 설명하되 다음을 미리 말하지 않는다

   이 파일은 flow.html 만 읽는다. 기존 판(index.html)은 불러오지 않는다.
   ══════════════════════════════════════════════════════════════ */

window.MOC = window.MOC || {};

/* 손으로 빼는 쪽. find_speech.py 의 자동 판정(대사 70% 이상)과 별개로,
   들어 보고 군더더기다 싶은 쪽을 여기에 적는다. 문장은 지우지 않는다 —
   영상이 바뀌면 다시 살리기 쉽도록. */
window.MOC.SUMMARY_SKIP = [6, 11];

window.MOC.SUMMARY = {
   1: 'An old man and an old woman lived alone. They wanted a little cat.',
   2: 'The old man walked over the hills. He found a hill covered with cats.',
   3: 'He picked one cat. Then another.',
   4: 'Every cat looked pretty to him. He could not leave any of them behind.',
   5: 'So he chose them all. Millions of cats followed him home.',
   6: 'The pond and the grass were all gone.',
   7: 'The old woman was very surprised.',
   8: 'The old man asked which cat was the prettiest. Every cat said, "I am!"',
   9: 'The cats were all gone.',
  10: 'One little kitten was left in the grass. It was too shy to say anything.',
  11: 'The kitten became the prettiest cat of all.'
};
