/* ══════════════════════════════════════════════════════════════
   Millions of Cats — 콘텐츠 데이터
   원문: Project Gutenberg #74181 (Wanda Gág, 1928)
         "Public domain in the USA" — 원문 그대로 유지할 것.
   번역·문제·씬 지문: 이 프로젝트 창작물.

   각 쪽 필드
     n       쪽 번호
     scene   씬 이름 (한국어, 화면 표시용)
     bg      절차적 씬 키 (js/scenes.js에서 구현)
     video   assets/videos/ 안의 mp4 파일명. 없으면 절차적 씬으로 폴백
     prompt  AI 영상 생성용 영문 프롬프트
     rhyme   true면 운율 쪽. 크게 조판하고 줄바꿈을 유지한다
     lines   [{ t: 원문, ko: 한국어 }]
     q/o/a   문제 / 보기 4개 / 정답 인덱스
   ══════════════════════════════════════════════════════════════ */

export const PAGES = [

/* ─────────── 1 ─────────── */
{n:1, scene:'꽃에 둘러싸인 오두막 · 해질녘', bg:'cottage_dusk', video:'01_cottage.mp4',
 prompt:'A tiny cottage on a gentle hill at dusk, completely surrounded by flowers except at the doorway. Slow drifting low clouds, a lamp warming in the window. Muted folk-art palette, ink-drawing texture, no people visible. Very slow camera drift.',
 lines:[
  {t:'Once upon a time there was a very old man and a very old woman.',
   ko:'옛날 옛적에 아주 나이 많은 할아버지와 아주 나이 많은 할머니가 살았습니다.'},
  {t:'They lived in a nice clean house which had flowers all around it, except where the door was.',
   ko:'두 사람은 문이 있는 자리만 빼고 온통 꽃으로 둘러싸인, 깨끗하고 아담한 집에 살았습니다.'},
  {t:"But they couldn't be happy because they were so very lonely.",
   ko:'하지만 두 사람은 너무나 외로워서 행복할 수가 없었습니다.'}],
 q:'Why were the old man and the old woman unhappy?',
 o:['Their house was too small','They were very lonely','They had too many cats','The flowers would not grow'], a:1},

/* ─────────── 2 ─────────── */
{n:2, scene:'오두막 안 · 난롯가의 대화', bg:'cottage_interior', video:'02_interior.mp4',
 prompt:'Interior of a small old cottage lit by a low fire. Two empty wooden chairs facing each other, shadows moving gently on the wall. Warm amber light, folk-art texture, no people. Nearly still frame.',
 lines:[
  {t:'"If we only had a cat!" sighed the very old woman.',
   ko:'"고양이 한 마리만 있으면 좋으련만!" 할머니가 한숨을 쉬었습니다.'},
  {t:'"A cat?" asked the very old man.',
   ko:'"고양이요?" 할아버지가 물었습니다.'},
  {t:'"Yes, a sweet little fluffy cat," said the very old woman.',
   ko:'"네, 조그맣고 폭신폭신한 귀여운 고양이요." 할머니가 말했습니다.'},
  {t:'"I will get you a cat, my dear," said the very old man.',
   ko:'"내가 한 마리 데려오리다, 여보." 할아버지가 말했습니다.'}],
 q:'What kind of cat did the old woman want?',
 o:['A big black cat','A sweet little fluffy cat','A cat with stripes','Hundreds of cats'], a:1},

/* ─────────── 3 ─────────── */
{n:3, scene:'햇살 언덕과 서늘한 골짜기', bg:'hills_journey', video:'03_journey.mp4',
 prompt:'Rolling hills under bright sun, then cool shaded valleys, seen as a slow horizontal pan. Long grass moving in wind. A single small silhouette walking far away. Folk-art woodcut texture, limited palette.',
 lines:[
  {t:'And he set out over the hills to look for one.',
   ko:'그래서 할아버지는 고양이를 찾아 언덕을 넘어 길을 나섰습니다.'},
  {t:'He climbed over the sunny hills.',
   ko:'햇살이 드는 언덕을 올랐습니다.'},
  {t:'He trudged through the cool valleys.',
   ko:'서늘한 골짜기를 터벅터벅 걸었습니다.'},
  {t:'He walked a long, long time and at last he came to a hill which was quite covered with cats.',
   ko:'아주 오랫동안 걷고 또 걸어, 마침내 고양이로 온통 뒤덮인 언덕에 다다랐습니다.'}],
 q:'How long did the old man walk before he found the cats?',
 o:['A long, long time','Only a few minutes','One hour','He never walked at all'], a:0},

/* ─────────── 4 · 운율 ─────────── */
{n:4, rhyme:true, scene:'수백만 마리가 뒤덮은 언덕', bg:'cat_hill', video:'04_cathill.mp4',
 prompt:'A hillside completely covered with cat silhouettes, multiplying endlessly toward the horizon. The count visibly grows as the camera slowly pulls back. Black silhouettes on a pale sky, ink-drawing texture. This scene is the hero of the book.',
 lines:[
  {t:'Cats here, cats there,', ko:'여기도 고양이, 저기도 고양이,'},
  {t:'Cats and kittens everywhere,', ko:'어디를 봐도 고양이와 새끼 고양이,'},
  {t:'Hundreds of cats,', ko:'수백 마리 고양이,'},
  {t:'Thousands of cats,', ko:'수천 마리 고양이,'},
  {t:'Millions and billions and trillions of cats.', ko:'수백만, 수십억, 수조 마리 고양이.'}],
 q:'The numbers get bigger in every line. Why does the story do this?',
 o:['To count the cats exactly','To show the number growing huge','To give each cat a name','To end the story'], a:1},

/* ─────────── 5 ─────────── */
{n:5, scene:'첫 번째 고양이를 고르다', bg:'choosing_white', video:'05_choosing.mp4',
 prompt:'Close view of a crowd of cat silhouettes on a hill, one white cat standing out among them, then a black-and-white one. Gentle shifting as the crowd stirs. Ink-drawing texture, pale sky.',
 lines:[
  {t:'"Oh," cried the old man joyfully, "Now I can choose the prettiest cat and take it home with me!"',
   ko:'"오," 할아버지가 기뻐서 외쳤습니다. "이제 제일 예쁜 고양이를 골라 집에 데려갈 수 있겠구나!"'},
  {t:'So he chose one. It was white.',
   ko:'그래서 한 마리를 골랐습니다. 흰 고양이였습니다.'},
  {t:'But just as he was about to leave, he saw another one all black and white and it seemed just as pretty as the first.',
   ko:'그런데 막 떠나려던 참에, 온통 검고 흰 고양이가 눈에 띄었는데 처음 고양이만큼이나 예뻐 보였습니다.'},
  {t:'So he took this one also.',
   ko:'그래서 이 고양이도 데려가기로 했습니다.'}],
 q:'Why did the old man take the second cat too?',
 o:['It was bigger','It seemed just as pretty as the first','The first cat ran away','The old woman told him to'], a:1},

/* ─────────── 6 · 긴 쪽, 자동 분할됨 ─────────── */
{n:6, scene:'고를수록 늘어나는 고양이', bg:'choosing_more', video:'06_more.mp4',
 prompt:'The same hillside from different angles — a fuzzy grey kitten far off, one down in a corner, a black one, one with tiger stripes. Slow drifting attention from spot to spot. Ink-drawing texture.',
 lines:[
  {t:'But then he saw a fuzzy grey kitten way over here which was every bit as pretty as the others so he took it too.',
   ko:'그러다 저쪽에 보송보송한 회색 새끼 고양이가 보였는데 다른 고양이들만큼 예뻐서 그 고양이도 데려갔습니다.'},
  {t:'And now he saw one way down in a corner which he thought too lovely to leave so he took this too.',
   ko:'이번엔 저 아래 구석에 있는 고양이가 눈에 들어왔는데 두고 가기엔 너무 사랑스러워서 그 고양이도 데려갔습니다.'},
  {t:'And just then, over here, the very old man found a kitten, which was black and very beautiful.',
   ko:'그리고 바로 그때 이쪽에서 할아버지는 새까맣고 아주 아름다운 새끼 고양이를 발견했습니다.'},
  {t:'"It would be a shame to leave that one," said the very old man. So he took it.',
   ko:'"저 아이를 두고 가면 아깝지." 할아버지가 말했습니다. 그래서 그 고양이도 데려갔습니다.'},
  {t:'And now, over there, he saw a cat which had brown and yellow stripes like a baby tiger.',
   ko:'그리고 저기에는 아기 호랑이처럼 갈색과 노란색 줄무늬가 있는 고양이가 있었습니다.'},
  {t:'"I simply must take it!" cried the very old man, and he did.',
   ko:'"이건 꼭 데려가야겠어!" 할아버지가 외쳤고, 정말 그렇게 했습니다.'}],
 q:'What did the striped cat look like?',
 o:['A baby tiger','A grey cloud','A white flower','A small dog'], a:0},

/* ─────────── 7 ─────────── */
{n:7, scene:'어느새 전부', bg:'chose_all', video:'07_all.mp4',
 prompt:'Wide view of the hill, now emptying as every cat falls in behind one small figure. The hill grows bare while the line of cats thickens. Ink-drawing texture.',
 lines:[
  {t:'So it happened that every time the very old man looked up, he saw another cat which was so pretty he could not bear to leave it, and before he knew it, he had chosen them all.',
   ko:'그렇게 할아버지는 고개를 들 때마다 두고 가기엔 너무 예쁜 고양이를 또 발견했고, 어느새 고양이를 전부 골라 버렸습니다.'}],
 q:'How many cats did the old man choose in the end?',
 o:['Only one','About ten','All of them','None of them'], a:2},

/* ─────────── 8 ─────────── */
{n:8, scene:'끝없이 이어지는 행렬', bg:'procession', video:'08_procession.mp4',
 prompt:'An endless line of cat silhouettes winding back over sunny hills and down through cool valleys, following one small figure. The line has no visible end. Slow lateral pan, ink-drawing texture.',
 lines:[
  {t:'And so he went back over the sunny hills and down through the cool valleys, to show all his pretty kittens to the very old woman.',
   ko:'그래서 할아버지는 햇살 언덕을 넘고 서늘한 골짜기를 내려와, 예쁜 고양이들을 모두 할머니에게 보여 주러 갔습니다.'},
  {t:'It was very funny to see those hundreds and thousands and millions and billions and trillions of cats following him.',
   ko:'수백, 수천, 수백만, 수십억, 수조 마리 고양이가 뒤를 따라오는 모습은 정말 우스웠습니다.'}],
 q:'Where was the old man going?',
 o:['Back home to the old woman','To another hill','To a pond','To find more cats'], a:0},

/* ─────────── 9 ─────────── */
{n:9, scene:'연못이 사라지다', bg:'pond', video:'09_pond.mp4',
 prompt:'A still pond ringed by countless cat silhouettes leaning in to drink. The water level drops steadily until the pond bed is bare. Reflections vanish as it empties. Ink-drawing texture.',
 lines:[
  {t:'They came to a pond.', ko:'일행은 연못에 다다랐습니다.'},
  {t:'"Mew, mew! We are thirsty!" cried the hundreds of cats, thousands of cats, millions and billions and trillions of cats.',
   ko:'"야옹, 야옹! 목말라요!" 수백 마리, 수천 마리, 수백만 수십억 수조 마리 고양이가 울었습니다.'},
  {t:'"Well, here is a great deal of water," said the very old man.',
   ko:'"여기 물이 아주 많단다." 할아버지가 말했습니다.'},
  {t:'Each cat took a sip of water, and the pond was gone!',
   ko:'고양이마다 물을 한 모금씩 마셨더니, 연못이 사라져 버렸습니다!'}],
 q:'What happened to the pond?',
 o:['It froze','The cats drank it all','It rained into it','The old man filled it'], a:1},

/* ─────────── 10 ─────────── */
{n:10, scene:'풀 한 포기 남지 않은 언덕', bg:'grass', video:'10_grass.mp4',
 prompt:'Grassy hills swarming with cat silhouettes. The grass shortens wave by wave until the hills are completely bare earth. Ink-drawing texture, muted palette.',
 lines:[
  {t:'"Mew, mew! Now we are hungry!" said the hundreds of cats, thousands of cats, millions and billions and trillions of cats.',
   ko:'"야옹, 야옹! 이제 배고파요!" 수백 마리, 수천 마리, 수백만 수십억 수조 마리 고양이가 말했습니다.'},
  {t:'"There is much grass on the hills," said the very old man.',
   ko:'"언덕에 풀이 많단다." 할아버지가 말했습니다.'},
  {t:'Each cat ate a mouthful of grass and not a blade was left!',
   ko:'고양이마다 풀을 한 입씩 먹었더니, 풀잎 하나 남지 않았습니다!'}],
 q:'What does "not a blade was left" mean here?',
 o:['The cats lost a knife','All the grass was eaten','The hills turned green','The grass grew taller'], a:1},

/* ─────────── 11 ─────────── */
{n:11, scene:'집 앞에서 마주친 할머니', bg:'yard_arrival', video:'11_arrival.mp4',
 prompt:'The flower-ringed cottage seen from the yard, with an unbroken tide of cat silhouettes flooding in from the hills toward it. The yard fills steadily. Ink-drawing texture.',
 lines:[
  {t:'Pretty soon, the very old woman saw them coming.',
   ko:'얼마 지나지 않아 할머니가 그들이 오는 것을 보았습니다.'},
  {t:'"My dear!" she cried, "What are you doing? I asked for one little cat, and what do I see?"',
   ko:'"여보!" 할머니가 소리쳤습니다. "지금 뭐 하시는 거예요? 나는 작은 고양이 한 마리를 부탁했는데, 이게 다 뭐예요?"'}],
 q:'How did the old woman feel when she saw the cats?',
 o:['Bored','Sleepy','Shocked','Angry at the cats'], a:2},

/* ─────────── 12 · 운율 반복 ─────────── */
{n:12, rhyme:true, scene:'같은 노래, 두 번째', bg:'yard_flood', video:'12_flood.mp4',
 prompt:'The cottage yard now completely filled with restless cat silhouettes, packed to the edges of the frame and stirring like water. Ink-drawing texture.',
 lines:[
  {t:'Cats here, cats there,', ko:'여기도 고양이, 저기도 고양이,'},
  {t:'Cats and kittens everywhere,', ko:'어디를 봐도 고양이와 새끼 고양이,'},
  {t:'Hundreds of cats,', ko:'수백 마리 고양이,'},
  {t:'Thousands of cats,', ko:'수천 마리 고양이,'},
  {t:'Millions and billions and trillions of cats.', ko:'수백만, 수십억, 수조 마리 고양이.'}],
 q:'Where did you hear these same words before?',
 o:['On the hill covered with cats','At the pond','Inside the house','At the very end'], a:0},

/* ─────────── 13 · 가장 긴 쪽, 자동 분할됨 ─────────── */
{n:13, scene:'누가 제일 예쁘니?', bg:'yard_question', video:'13_question.mp4',
 prompt:'Countless cat silhouettes in the yard, all turning at once toward the same point as if answering. A ripple of movement passes through the whole crowd. Ink-drawing texture.',
 lines:[
  {t:'"But we can never feed them all," said the very old woman, "They will eat us out of house and home."',
   ko:'"하지만 저 고양이들을 다 먹일 순 없어요." 할머니가 말했습니다. "우리 집 살림까지 몽땅 거덜낼 거예요."'},
  {t:'"I never thought of that," said the very old man, "What shall we do?"',
   ko:'"그 생각은 미처 못 했군." 할아버지가 말했습니다. "어떻게 하지?"'},
  {t:'The very old woman thought for a while and then she said, "I know! We will let the cats decide which one we should keep."',
   ko:'할머니는 잠시 생각하더니 말했습니다. "알았어요! 어느 고양이를 기를지 고양이들이 직접 정하게 해요."'},
  {t:'"Oh yes," said the very old man, and he called to the cats, "Which one of you is the prettiest?"',
   ko:'"그거 좋군." 할아버지가 고양이들을 향해 외쳤습니다. "너희 중에 누가 제일 예쁘니?"'},
  {t:'"I am!" "I am!" "No, I am!" "No, I am the prettiest!" "I am!" "No, I am! I am! I am!" cried hundreds and thousands and millions and billions and trillions of voices, for each cat thought itself the prettiest.',
   ko:'"나야!" "나야!" "아니, 나야!" "아니, 내가 제일 예뻐!" "나야!" "아니 나야! 나야! 나야!" 수백, 수천, 수백만, 수십억, 수조의 목소리가 외쳤습니다. 고양이마다 자기가 제일 예쁘다고 여겼으니까요.'}],
 q:'Why did every single cat answer the old man?',
 o:['Each one thought it was the prettiest','They were hungry again','They wanted to go home','The old woman asked them to'], a:0},

/* ─────────── 14 ─────────── */
{n:14, scene:'소란이 그치고, 텅 빈 마당', bg:'quarrel', video:'14_quarrel.mp4',
 prompt:'The packed yard of cat silhouettes churns violently, then the frame gradually empties until only bare ground and a window remain. No blood, no detail — only shapes dispersing. Ink-drawing texture, restrained.',
 lines:[
  {t:'And they began to quarrel.', ko:'그리고 고양이들은 다투기 시작했습니다.'},
  {t:'They bit and scratched and clawed each other and made such a great noise that the very old man and the very old woman ran into the house as fast as they could.',
   ko:'서로 물고 할퀴고 발톱을 세우며 어찌나 큰 소리를 냈는지, 할아버지와 할머니는 있는 힘껏 집 안으로 뛰어들어갔습니다.'},
  {t:'They did not like such quarreling.', ko:'두 사람은 그런 다툼을 좋아하지 않았습니다.'},
  {t:'But after a while the noise stopped and the very old man and the very old woman peeped out of the window to see what had happened.',
   ko:'얼마 뒤 소리가 그치자, 두 사람은 무슨 일이 있었는지 보려고 창밖을 살짝 내다보았습니다.'},
  {t:'They could not see a single cat!', ko:'고양이가 한 마리도 보이지 않았습니다!'}],
 q:'Why did the old man and the old woman run into the house?',
 o:['They were hungry','They did not like the quarreling','It started to rain','They wanted to sleep'], a:1},

/* ─────────── 15 · 긴 쪽, 자동 분할됨 ─────────── */
{n:15, scene:'풀숲의 아기 고양이', bg:'found_kitten', video:'15_kitten.mp4',
 prompt:'Empty bare yard with one tuft of tall grass still standing. Inside it, a very small silhouette sits perfectly still. Soft light gathers around it. Ink-drawing texture, quiet.',
 lines:[
  {t:'"I think they must have eaten each other all up," said the very old woman, "It\'s too bad!"',
   ko:'"서로 다 잡아먹어 버린 모양이에요." 할머니가 말했습니다. "안됐구나!"'},
  {t:'"But look!" said the very old man, and he pointed to a bunch of high grass.',
   ko:'"그런데 저것 봐요!" 할아버지가 키 큰 풀숲을 가리켰습니다.'},
  {t:'In it sat one little frightened kitten.',
   ko:'그 안에 겁먹은 새끼 고양이 한 마리가 앉아 있었습니다.'},
  {t:'They went out and picked it up. It was thin and scraggly.',
   ko:'두 사람은 나가서 고양이를 안아 올렸습니다. 야위고 볼품없는 고양이였습니다.'},
  {t:'"Dear little kitty," said the very old man, "how does it happen that you were not eaten up with all those hundreds and thousands and millions and billions and trillions of cats?"',
   ko:'"귀여운 아가야," 할아버지가 말했습니다. "수백 수천 수백만 수십억 수조 마리 고양이 틈에서 어떻게 너만 무사했니?"'},
  {t:'"Oh, I\'m just a very homely little cat," said the kitten, "So when you asked who was the prettiest, I didn\'t say anything. So nobody bothered about me."',
   ko:'"저는 그냥 아주 못생긴 고양이거든요." 새끼 고양이가 말했습니다. "그래서 누가 제일 예쁘냐고 물으셨을 때 아무 말도 안 했어요. 그래서 아무도 저한테 신경 쓰지 않았죠."'}],
 q:'Why was this kitten not eaten up?',
 o:['It ran away fast','It said nothing when they were asked','It hid inside the house','It was the biggest cat'], a:1},

/* ─────────── 16 · 마무리 ─────────── */
{n:16, scene:'세상에서 제일 아름다운 고양이', bg:'ending', video:'16_ending.mp4',
 prompt:'Warm cottage interior at night, a small round cat silhouette curled beside a bowl in lamplight. Fur catches the light softly. Slow, steady, almost still. Warmest palette of the whole book.',
 lines:[
  {t:'They took the kitten into the house, where the very old woman gave it a warm bath and brushed its fur until it was soft and shiny.',
   ko:'두 사람은 새끼 고양이를 집으로 데려갔고, 할머니는 따뜻한 물로 목욕을 시키고 털이 부드럽고 반질반질해질 때까지 빗어 주었습니다.'},
  {t:'Every day they gave it plenty of milk, and soon it grew nice and plump.',
   ko:'매일 우유를 듬뿍 주었더니, 곧 통통하게 자랐습니다.'},
  {t:'"And it is a very pretty cat, after all!" said the very old woman.',
   ko:'"그러고 보니 정말 예쁜 고양이네요!" 할머니가 말했습니다.'},
  {t:'"It is the most beautiful cat in the whole world," said the very old man.',
   ko:'"세상에서 제일 아름다운 고양이야." 할아버지가 말했습니다.'},
  {t:'"I ought to know, for I\'ve seen hundreds of cats, thousands of cats, millions and billions and trillions of cats, and not one is as pretty as this one."',
   ko:'"내가 잘 알지. 수백 수천 수백만 수십억 수조 마리 고양이를 봤는데, 이 아이만큼 예쁜 고양이는 하나도 없었으니까."'}],
 q:'Why did the old man say this kitten was the most beautiful of all?',
 o:['It was the biggest one','It had the prettiest stripes','He had seen every other cat and loved this one','It was the only white cat'], a:2}

];


/* ══════════════════════════════════════════════════════════════
   클릭 사전 — 현재 약 70개.
   원문을 훑어 초등 수준 밖 어휘를 200개 내외까지 채울 것.
   키는 소문자, 값은 이 이야기 안에서의 뜻으로.
   ══════════════════════════════════════════════════════════════ */

export const DICT = {
  /* 1–2쪽 */
  lonely:'외로운', clean:'깨끗한', except:'~을 빼고는', flowers:'꽃',
  sighed:'한숨을 쉬었다', fluffy:'폭신폭신한', sweet:'귀여운, 다정한',

  /* 3쪽 */
  hills:'언덕', climbed:'올랐다', sunny:'햇살이 드는',
  trudged:'터벅터벅 걸었다', valleys:'골짜기', cool:'서늘한',
  covered:'뒤덮인', least:'적어도',

  /* 4쪽 운율 */
  kittens:'새끼 고양이', everywhere:'어디에나',
  hundreds:'수백', thousands:'수천', millions:'수백만',
  billions:'수십억', trillions:'수조',

  /* 5–6쪽 */
  joyfully:'기쁘게', choose:'고르다', chose:'골랐다 (choose의 과거형)',
  prettiest:'가장 예쁜', fuzzy:'보송보송한', grey:'회색의',
  corner:'구석', lovely:'사랑스러운', shame:'아까운 일, 안타까운 일',
  stripes:'줄무늬', simply:'그저, 정말로',

  /* 7–8쪽 */
  bear:'견디다, 참다', chosen:'골랐다 (choose의 과거분사)',
  following:'뒤따라오는', funny:'우스운',

  /* 9–10쪽 */
  pond:'연못', thirsty:'목마른', sip:'한 모금',
  deal:'양 (a great deal = 아주 많은 양)', gone:'사라진',
  hungry:'배고픈', grass:'풀', mouthful:'한 입',
  blade:'풀잎 한 장',

  /* 11–13쪽 */
  soon:'곧', feed:'먹이다, 먹여 키우다',
  decide:'결정하다', keep:'기르다, 계속 두다',
  called:'불렀다, 외쳤다', voices:'목소리들',
  itself:'그 자신', thought:'생각했다 (think의 과거형)',
  while:'잠시 동안 (for a while)',

  /* 14쪽 */
  quarrel:'다투다', quarreling:'다툼', bit:'물었다 (bite의 과거형)',
  scratched:'할퀴었다', clawed:'발톱으로 할퀴었다',
  noise:'소리, 소음', peeped:'살짝 들여다보았다', single:'단 하나의',

  /* 15쪽 */
  frightened:'겁먹은', thin:'야윈', scraggly:'볼품없는, 삐쭉삐쭉한',
  bunch:'덤불, 무더기', pointed:'가리켰다',
  homely:'못생긴, 수수한', bothered:'신경 썼다',

  /* 16쪽 */
  brushed:'빗질했다', fur:'털', shiny:'반질반질한',
  plenty:'듬뿍, 충분히', plump:'통통한',
  beautiful:'아름다운', whole:'전체의', ought:'~해야 마땅하다'
};
