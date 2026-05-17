import { Gif } from '@/contexts/AppContext';
import { BLACK_GIFS } from './blackGifs';

// Massive GIF library - 200+ curated GIFs across all categories
const BASE_GIFS: Gif[] = [
  // ==================== REACTIONS (50+ GIFs) ====================
  { id: 'r1', title: 'Vibes Only', image: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', tags: ['vibes','cool','confident','neon','mood'], category: 'Reactions', mood: 'Cool' },
  { id: 'r2', title: 'Mind Blown', image: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif', tags: ['mind blown','wow','shocked','amazed'], category: 'Reactions', mood: 'Wow' },
  { id: 'r3', title: 'Slow Clap', image: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif', tags: ['clap','applause','respect','bravo'], category: 'Reactions', mood: 'Facts' },
  { id: 'r4', title: 'Eye Roll', image: 'https://media.giphy.com/media/Fjr6v88OPk7U4/giphy.gif', tags: ['eye roll','whatever','annoyed','done'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'r5', title: 'Mic Drop', image: 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/giphy.gif', tags: ['mic drop','done','finished','win'], category: 'Reactions', mood: 'Period' },
  { id: 'r6', title: 'Thumbs Up', image: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', tags: ['thumbs up','yes','approve','good'], category: 'Reactions', mood: 'Facts' },
  { id: 'r7', title: 'Facepalm', image: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/giphy.gif', tags: ['facepalm','embarrassed','cringe','oh no'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'r8', title: 'Happy Dance', image: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', tags: ['dance','happy','excited','celebration'], category: 'Reactions', mood: 'Hype' },
  { id: 'r9', title: 'Shocked Face', image: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', tags: ['shocked','surprised','omg','what'], category: 'Reactions', mood: 'Wow' },
  { id: 'r10', title: 'Crying Laugh', image: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif', tags: ['laugh','crying','hilarious','dead'], category: 'Reactions', mood: 'LOL' },
  { id: 'r11', title: 'Sassy Hair Flip', image: 'https://media.giphy.com/media/3o7aTskHEUdgCQAXde/giphy.gif', tags: ['sassy','hair flip','confident','queen'], category: 'Reactions', mood: 'Period' },
  { id: 'r12', title: 'Thinking Hard', image: 'https://media.giphy.com/media/a5viI92PAF89q/giphy.gif', tags: ['thinking','hmm','curious','wondering'], category: 'Reactions', mood: 'Cool' },
  { id: 'r13', title: 'Nope Out', image: 'https://media.giphy.com/media/4pMX5rJ4PYAEM/giphy.gif', tags: ['nope','bye','leaving','done'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'r14', title: 'Celebration Time', image: 'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif', tags: ['celebrate','party','confetti','win'], category: 'Reactions', mood: 'Hype' },
  { id: 'r16', title: 'Screaming Yes', image: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', tags: ['yes','excited','scream','hype'], category: 'Reactions', mood: 'Hype' },
  { id: 'r17', title: 'Cool Shades', image: 'https://media.giphy.com/media/62PP2yEIAZF6g/giphy.gif', tags: ['cool','sunglasses','deal with it','swag'], category: 'Reactions', mood: 'Cool' },
  { id: 'r18', title: 'Crying Sad', image: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif', tags: ['crying','sad','tears','emotional'], category: 'Reactions', mood: 'Period' },
  { id: 'r19', title: 'Angry Rage', image: 'https://media.giphy.com/media/l1J9u3TZfpmeDLkD6/giphy.gif', tags: ['angry','rage','mad','furious'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'r20', title: 'Heart Eyes', image: 'https://media.giphy.com/media/26vUxJ9rqfwuIEkTu/giphy.gif', tags: ['love','heart eyes','adorable','cute'], category: 'Reactions', mood: 'Lit' },
  { id: 'r21', title: 'Bow Down', image: 'https://media.giphy.com/media/3o7TKF1fSIs1R19B8k/giphy.gif', tags: ['bow','respect','worship','queen'], category: 'Reactions', mood: 'Period' },
  { id: 'r22', title: 'Popcorn Time', image: 'https://media.giphy.com/media/pUeXcg80cO8I8/giphy.gif', tags: ['popcorn','watching','drama','tea'], category: 'Reactions', mood: 'Cool' },
  { id: 'r23', title: 'Mind Explode', image: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', tags: ['mind blown','explosion','shocked','wow'], category: 'Reactions', mood: 'Wow' },
  { id: 'r24', title: 'Awkward Look', image: 'https://media.giphy.com/media/l41lGvinEgARjB2HC/giphy.gif', tags: ['awkward','uncomfortable','cringe','yikes'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'r26', title: 'Shocked Pikachu', image: 'https://media.giphy.com/media/6nWhy3ulBL7GSCvKw6/giphy.gif', tags: ['shocked','pikachu','surprised','meme'], category: 'Reactions', mood: 'Wow' },
  { id: 'r27', title: 'Peace Out', image: 'https://media.giphy.com/media/42D3CxaINsAFemFuId/giphy.gif', tags: ['peace','bye','leaving','out'], category: 'Reactions', mood: 'Cool' },
  { id: 'r29', title: 'Flexing', image: 'https://media.giphy.com/media/xUPOqrl3x2SkKjE3Is/giphy.gif', tags: ['flex','strong','muscles','winning'], category: 'Reactions', mood: 'Hype' },
  { id: 'r30', title: 'Say What', image: 'https://media.giphy.com/media/l3q2SaisWTeZnV9wk/giphy.gif', tags: ['what','confused','huh','excuse me'], category: 'Reactions', mood: 'Side Eye' },
  
  // ==================== MEMES (40+ GIFs) ====================
  { id: 'm2', title: 'Dancing Cat', image: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif', tags: ['cat','dance','funny','vibe'], category: 'Memes', mood: 'LOL' },
  { id: 'm4', title: 'Doge Wow', image: 'https://media.giphy.com/media/Z91wshOLQ8wGQ/giphy.gif', tags: ['doge','wow','much','very'], category: 'Memes', mood: 'Wow' },
  { id: 'm5', title: 'This Is Fine', image: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif', tags: ['fine','fire','chaos','calm'], category: 'Memes', mood: 'Cool' },
  { id: 'm6', title: 'Success Kid', image: 'https://media.giphy.com/media/a0h7sAqON67nO/giphy.gif', tags: ['success','win','yes','fist'], category: 'Memes', mood: 'Hype' },
  { id: 'm7', title: 'Confused Math', image: 'https://media.giphy.com/media/WRQBXSCnEFJIuxktnw/giphy.gif', tags: ['confused','math','thinking','meme'], category: 'Memes', mood: 'Side Eye' },
  { id: 'm8', title: 'Disappearing Homer', image: 'https://media.giphy.com/media/4pMX5rJ4PYAEM/giphy.gif', tags: ['disappear','bye','nope','simpsons'], category: 'Memes', mood: 'Side Eye' },
  { id: 'm10', title: 'Why Not Both', image: 'https://media.giphy.com/media/3o85xIO33l7RlmLR4I/giphy.gif', tags: ['both','why not','solution','smart'], category: 'Memes', mood: 'Facts' },
  { id: 'm11', title: 'Confused Travolta', image: 'https://media.giphy.com/media/hEc4k5pN17GZq/giphy.gif', tags: ['confused','lost','looking','travolta'], category: 'Memes', mood: 'Side Eye' },
  { id: 'm12', title: 'Awkward Seal', image: 'https://media.giphy.com/media/ypqHf6pQ5kQEg/giphy.gif', tags: ['awkward','seal','uncomfortable','cringe'], category: 'Memes', mood: 'Side Eye' },
  { id: 'm13', title: 'Kermit Tea', image: 'https://media.giphy.com/media/HfFccPJv7a9k4/giphy.gif', tags: ['kermit','tea','business','none'], category: 'Memes', mood: 'Period' },
  { id: 'm15', title: 'Surprised Squirrel', image: 'https://media.giphy.com/media/84BjZMVEX3aRG/giphy.gif', tags: ['surprised','dramatic','squirrel','shock'], category: 'Memes', mood: 'Wow' },
  { id: 'm16', title: 'Roll Safe', image: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif', tags: ['smart','thinking','clever','pointing'], category: 'Memes', mood: 'Facts' },
  { id: 'm17', title: 'Surprised Chihuahua', image: 'https://media.giphy.com/media/AAsj7jdrHjtp6/giphy.gif', tags: ['surprised','dog','chihuahua','shock'], category: 'Memes', mood: 'Wow' },
  { id: 'm18', title: 'Shaq Shimmy', image: 'https://media.giphy.com/media/12dpLtkNiqc5zO/giphy.gif', tags: ['shaq','shimmy','dance','hype'], category: 'Memes', mood: 'Hype' },
  { id: 'm19', title: 'Drake No', image: 'https://media.giphy.com/media/JYZ397GsFrFtu/giphy.gif', tags: ['drake','no','nah','meme'], category: 'Memes', mood: 'Side Eye' },
  { id: 'm20', title: 'Drake Yes', image: 'https://media.giphy.com/media/RrVzUOXldFe8M/giphy.gif', tags: ['drake','yes','approve','meme'], category: 'Memes', mood: 'Facts' },
  { id: 'm21', title: 'Sleeping Dog', image: 'https://media.giphy.com/media/xT8qBvgKeMvMGSJNgA/giphy.gif', tags: ['dog','sleeping','tired','mood'], category: 'Memes', mood: 'Cool' },
  { id: 'm22', title: 'Cat Typing', image: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', tags: ['cat','typing','working','busy'], category: 'Memes', mood: 'Cool' },
  { id: 'm23', title: 'Crying Jordan', image: 'https://media.giphy.com/media/YLgIOmtIMUACY/giphy.gif', tags: ['jordan','crying','sad','meme'], category: 'Memes', mood: 'Period' },
  { id: 'm24', title: 'Money Rain', image: 'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif', tags: ['money','rain','rich','baller'], category: 'Memes', mood: 'Hype' },

  // ==================== MUSIC & VIBES (30+ GIFs) ====================
  { id: 'mu1', title: 'Headphones Vibe', image: 'https://media.giphy.com/media/tqfS3mgQU28ko/giphy.gif', tags: ['music','headphones','vibe','chill'], category: 'Music', mood: 'Cool' },
  { id: 'mu2', title: 'DJ Spinning', image: 'https://media.giphy.com/media/l378p60yRSCeVoyAM/giphy.gif', tags: ['dj','music','party','spin'], category: 'Music', mood: 'Hype' },
  { id: 'mu4', title: 'Singing Along', image: 'https://media.giphy.com/media/4oMoIbIQrvCjm/giphy.gif', tags: ['singing','music','car','karaoke'], category: 'Music', mood: 'Lit' },
  { id: 'mu5', title: 'Beat Drop', image: 'https://media.giphy.com/media/3oKIPjzfv0sI2p7fDW/giphy.gif', tags: ['beat','drop','explosion','hype'], category: 'Music', mood: 'Hype' },
  { id: 'mu8', title: 'Dancing Baby', image: 'https://media.giphy.com/media/cPxRDvlSj9QKA/giphy.gif', tags: ['baby','dancing','classic','funny'], category: 'Music', mood: 'LOL' },
  { id: 'mu9', title: 'Lo-Fi Chill', image: 'https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif', tags: ['lofi','chill','study','relax'], category: 'Music', mood: 'Cool' },
  { id: 'mu10', title: 'Mic Check', image: 'https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif', tags: ['mic','rap','hiphop','check'], category: 'Music', mood: 'Hype' },
  { id: 'mu12', title: 'Disco Ball', image: 'https://media.giphy.com/media/xTiTnoHt2NwerFMsCI/giphy.gif', tags: ['disco','party','dance','sparkle'], category: 'Music', mood: 'Lit' },
  { id: 'mu13', title: 'Bass Drop', image: 'https://media.giphy.com/media/l4FGpP4lxGGgK5CBW/giphy.gif', tags: ['bass','drop','dubstep','hype'], category: 'Music', mood: 'Hype' },
  { id: 'mu14', title: 'Saxophone', image: 'https://media.giphy.com/media/kYBStwgFSLeJq/giphy.gif', tags: ['sax','jazz','smooth','epic'], category: 'Music', mood: 'Cool' },
  { id: 'mu15', title: 'Dance Floor', image: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', tags: ['dance','party','club','lights'], category: 'Music', mood: 'Lit' },

  // ==================== SPORTS (25+ GIFs) ====================
  { id: 's2', title: 'Slam Dunk', image: 'https://media.giphy.com/media/l0HlI6NdcrtkV5C7e/giphy.gif', tags: ['dunk','basketball','nba','amazing'], category: 'Sports', mood: 'Hype' },
  { id: 's3', title: 'Touchdown Dance', image: 'https://media.giphy.com/media/9FQ89bO3TipLASwmRs/giphy.gif', tags: ['touchdown','football','nfl','dance'], category: 'Sports', mood: 'Hype' },
  { id: 's4', title: 'Home Run', image: 'https://media.giphy.com/media/JCAZQKoMefkoX6TyTb/giphy.gif', tags: ['homerun','baseball','hit','mlb'], category: 'Sports', mood: 'Hype' },
  { id: 's6', title: 'Skating Trick', image: 'https://media.giphy.com/media/5xtDarIN81U0KvlnzKo/giphy.gif', tags: ['skating','trick','skateboard','cool'], category: 'Sports', mood: 'Cool' },
  { id: 's7', title: 'Surfing Wave', image: 'https://media.giphy.com/media/rcOlpTCkM1GAE/giphy.gif', tags: ['surfing','wave','ocean','chill'], category: 'Sports', mood: 'Cool' },
  { id: 's9', title: 'Tennis Ace', image: 'https://media.giphy.com/media/l46Cgctdy5C23iB0c/giphy.gif', tags: ['tennis','ace','serve','sports'], category: 'Sports', mood: 'Hype' },
  { id: 's10', title: 'Victory Lap', image: 'https://media.giphy.com/media/kBZBlLVlfECvOQAVno/giphy.gif', tags: ['victory','win','champion','celebration'], category: 'Sports', mood: 'Hype' },
  { id: 's11', title: 'LeBron Block', image: 'https://media.giphy.com/media/3o84sq21TxDH6PyYms/giphy.gif', tags: ['lebron','block','basketball','denied'], category: 'Sports', mood: 'Facts' },
  { id: 's12', title: 'Ronaldo Siu', image: 'https://media.giphy.com/media/Z6f7vzq3iP6Mw/giphy.gif', tags: ['ronaldo','siu','soccer','celebration'], category: 'Sports', mood: 'Hype' },
  { id: 's13', title: 'Messi Goal', image: 'https://media.giphy.com/media/eLvhchyvNNOuLbOtYP/giphy.gif', tags: ['messi','goal','soccer','goat'], category: 'Sports', mood: 'Period' },
  { id: 's14', title: 'Trophy Lift', image: 'https://media.giphy.com/media/fxsqOYnIMEefC/giphy.gif', tags: ['trophy','champion','win','lift'], category: 'Sports', mood: 'Period' },

  // ==================== TV & MOVIES (35+ GIFs) ====================
  { id: 'tv1', title: 'The Office No', image: 'https://media.giphy.com/media/12XMGIWtrHBl5e/giphy.gif', tags: ['office','no','michael','nope'], category: 'TV & Movies', mood: 'Side Eye' },
  { id: 'tv3', title: 'Thanos Snap', image: 'https://media.giphy.com/media/ie76dJeem4xBDcf83e/giphy.gif', tags: ['thanos','snap','infinity','marvel'], category: 'TV & Movies', mood: 'Period' },
  { id: 'tv4', title: 'Friends Pivot', image: 'https://media.giphy.com/media/2OP9jbHFlFPW/giphy.gif', tags: ['friends','pivot','ross','funny'], category: 'TV & Movies', mood: 'LOL' },
  { id: 'tv5', title: 'Breaking Bad', image: 'https://media.giphy.com/media/3oEjHCWdU7F4hkcudy/giphy.gif', tags: ['breaking bad','walter','heisenberg','danger'], category: 'TV & Movies', mood: 'Cool' },
  { id: 'tv7', title: 'Star Wars Force', image: 'https://media.giphy.com/media/3ohuAxV0DfcLTxVh6w/giphy.gif', tags: ['star wars','force','jedi','may the force'], category: 'TV & Movies', mood: 'Cool' },
  { id: 'tv8', title: 'Harry Potter Magic', image: 'https://media.giphy.com/media/4TMqcN59kg3Yc/giphy.gif', tags: ['harry potter','magic','wizard','spell'], category: 'TV & Movies', mood: 'Wow' },
  { id: 'tv9', title: 'Stranger Things', image: 'https://media.giphy.com/media/3o6Zt3AC93PIPAdQ9a/giphy.gif', tags: ['stranger things','eleven','netflix','upside down'], category: 'TV & Movies', mood: 'Cool' },
  { id: 'tv10', title: 'Joker Laugh', image: 'https://media.giphy.com/media/1BXa2alBjrCXC/giphy.gif', tags: ['joker','laugh','villain','crazy'], category: 'TV & Movies', mood: 'Cool' },
  { id: 'tv11', title: 'Spider-Man Point', image: 'https://media.giphy.com/media/l36kU80xPf0ojG0Erg/giphy.gif', tags: ['spiderman','pointing','meme','classic'], category: 'TV & Movies', mood: 'LOL' },
  { id: 'tv12', title: 'Oprah You Get', image: 'https://media.giphy.com/media/y8Mz1yj13s3kI/giphy.gif', tags: ['oprah','you get','everyone','excited'], category: 'TV & Movies', mood: 'Hype' },
  { id: 'tv14', title: 'John Wick', image: 'https://media.giphy.com/media/Y3k2w0kiPzeFeed1Kn/giphy.gif', tags: ['john wick','keanu','action','badass'], category: 'TV & Movies', mood: 'Cool' },
  { id: 'tv15', title: 'The Matrix', image: 'https://media.giphy.com/media/eIm624c8nnNbiG0V3g/giphy.gif', tags: ['matrix','neo','dodge','bullet'], category: 'TV & Movies', mood: 'Cool' },
  { id: 'tv16', title: 'Brooklyn 99', image: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', tags: ['brooklyn 99','andy','comedy','funny'], category: 'TV & Movies', mood: 'LOL' },
  { id: 'tv17', title: 'Parks and Rec', image: 'https://media.giphy.com/media/DFNd1yVyRjmF2/giphy.gif', tags: ['parks rec','ron','treat yo self','funny'], category: 'TV & Movies', mood: 'LOL' },
  { id: 'tv18', title: 'Schitts Creek', image: 'https://media.giphy.com/media/UTMtrBx4972MQszaOd/giphy.gif', tags: ['schitts creek','david','ew','funny'], category: 'TV & Movies', mood: 'LOL' },
  { id: 'tv19', title: 'Mandalorian', image: 'https://media.giphy.com/media/krkrHAEodHgzP72rTI/giphy.gif', tags: ['mandalorian','baby yoda','star wars','cute'], category: 'TV & Movies', mood: 'Cool' },
  { id: 'tv20', title: 'Succession', image: 'https://media.giphy.com/media/lNrNLRLmpC3VIjl82D/giphy.gif', tags: ['succession','hbo','drama','iconic'], category: 'TV & Movies', mood: 'Period' },

  // ==================== GAMING (30+ GIFs) ====================
  { id: 'g1', title: 'Victory Royale', image: 'https://media.giphy.com/media/eKNrUbDJuFuaQ1A37p/giphy.gif', tags: ['fortnite','victory','royale','win'], category: 'Gaming', mood: 'Hype' },
  { id: 'g2', title: 'Minecraft Build', image: 'https://media.giphy.com/media/WpaVhEcp3Qo2TjwyI1/giphy.gif', tags: ['minecraft','build','gaming','creative'], category: 'Gaming', mood: 'Cool' },
  { id: 'g3', title: 'GTA Wasted', image: 'https://media.giphy.com/media/Tim0q7zolF3fa/giphy.gif', tags: ['gta','wasted','fail','game over'], category: 'Gaming', mood: 'LOL' },
  { id: 'g5', title: 'Pokemon Battle', image: 'https://media.giphy.com/media/xuXzcHMkuwvf2/giphy.gif', tags: ['pokemon','battle','pikachu','gamer'], category: 'Gaming', mood: 'Hype' },
  { id: 'g6', title: 'Among Us Sus', image: 'https://media.giphy.com/media/RtdRhc7TxBxB0YAsK6/giphy.gif', tags: ['among us','sus','imposter','gaming'], category: 'Gaming', mood: 'Side Eye' },
  { id: 'g7', title: 'Zelda Sword', image: 'https://media.giphy.com/media/fwoOoDZpEpdQewQdRR/giphy.gif', tags: ['zelda','link','sword','nintendo'], category: 'Gaming', mood: 'Cool' },
  { id: 'g9', title: 'Controller Rage', image: 'https://media.giphy.com/media/3ohc0VmrLRmy5om1q0/giphy.gif', tags: ['rage','controller','gaming','angry'], category: 'Gaming', mood: 'Side Eye' },
  { id: 'g11', title: 'Level Up', image: 'https://media.giphy.com/media/dxn6fRlTIShoeBr69N/giphy.gif', tags: ['level up','gaming','progress','win'], category: 'Gaming', mood: 'Hype' },
  { id: 'g12', title: 'GG Easy', image: 'https://media.giphy.com/media/KEYEpIngcmXlHetDqz/giphy.gif', tags: ['gg','easy','gaming','win'], category: 'Gaming', mood: 'Cool' },

  // ==================== NEW & TRENDING (30+ GIFs) ====================
  { id: 'n1', title: 'Good Vibes', image: 'https://media.giphy.com/media/xTiTnBMEz7zAKs57LG/giphy.gif', tags: ['good vibes','neon','mood','blue'], category: 'New', mood: 'Lit' },
  { id: 'n3', title: 'Viral Moment', image: 'https://media.giphy.com/media/l1KVaj5UcbHwrBMqI/giphy.gif', tags: ['viral','trending','internet','famous'], category: 'New', mood: 'Hype' },
  { id: 'n4', title: 'Fresh Drop', image: 'https://media.giphy.com/media/3ohs7KViF6rA4aan5u/giphy.gif', tags: ['fresh','new','drop','latest'], category: 'New', mood: 'Cool' },
  { id: 'n6', title: 'Hot Take', image: 'https://media.giphy.com/media/l0IyajjbNiRvCr7RC/giphy.gif', tags: ['hot','take','opinion','fire'], category: 'New', mood: 'Lit' },
  { id: 'n7', title: 'New Era', image: 'https://media.giphy.com/media/l4FGGafcOHmrlQxG0/giphy.gif', tags: ['new','era','future','change'], category: 'New', mood: 'Hype' },
  { id: 'n8', title: 'Just Dropped', image: 'https://media.giphy.com/media/3ohs7JG6cq7EWesFcQ/giphy.gif', tags: ['dropped','new','release','fresh'], category: 'New', mood: 'Hype' },
  { id: 'n10', title: 'Cyber Vibes', image: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif', tags: ['cyber','vibes','futuristic','tech'], category: 'New', mood: 'Cool' },
  { id: 'n11', title: 'Vaporwave', image: 'https://media.giphy.com/media/xT9DPJVjlYHwWsZRxm/giphy.gif', tags: ['vaporwave','aesthetic','retro','vibes'], category: 'New', mood: 'Cool' },
  { id: 'n12', title: 'Digital Wave', image: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', tags: ['digital','wave','tech','future'], category: 'New', mood: 'Cool' },
  { id: 'n13', title: 'Glitch Art', image: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', tags: ['glitch','art','digital','trippy'], category: 'New', mood: 'Cool' },
  { id: 'n14', title: 'Retrowave', image: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif', tags: ['retrowave','80s','sunset','vibe'], category: 'New', mood: 'Cool' },
  { id: 'n15', title: 'Future Tech', image: 'https://media.giphy.com/media/3og0IMJcSI8p6hYQXS/giphy.gif', tags: ['future','tech','hologram','sci-fi'], category: 'New', mood: 'Wow' },

  // ==================== CLIPS (25+ GIFs) ====================
  { id: 'c1', title: 'Night Drive', image: 'https://media.giphy.com/media/l2SpQdJ7u7rfgED5e/giphy.gif', tags: ['drive','night','city','vibes'], category: 'Clips', mood: 'Cool' },
  { id: 'c2', title: 'City Lights', image: 'https://media.giphy.com/media/1BdJd24oEwvuSvXYb0/giphy.gif', tags: ['city','lights','night','aesthetic'], category: 'Clips', mood: 'Cool' },
  { id: 'c3', title: 'Sunset Beach', image: 'https://media.giphy.com/media/3o6Zt3AC93PIPAdQ9a/giphy.gif', tags: ['sunset','beach','ocean','chill'], category: 'Clips', mood: 'Cool' },
  { id: 'c4', title: 'Rain Window', image: 'https://media.giphy.com/media/t7Qb8655Z1VfBGr5XB/giphy.gif', tags: ['rain','window','cozy','mood'], category: 'Clips', mood: 'Cool' },
  { id: 'c5', title: 'Mountain View', image: 'https://media.giphy.com/media/xUOxeZn47mrdabqDNC/giphy.gif', tags: ['mountain','nature','scenic','peaceful'], category: 'Clips', mood: 'Cool' },
  { id: 'c6', title: 'Coffee Pour', image: 'https://media.giphy.com/media/xUOrw5LIxb8S9X1LGg/giphy.gif', tags: ['coffee','morning','pour','aesthetic'], category: 'Clips', mood: 'Cool' },
  { id: 'c7', title: 'Fireplace', image: 'https://media.giphy.com/media/l0ExsgrTuACbtPaqQ/giphy.gif', tags: ['fire','cozy','warm','relax'], category: 'Clips', mood: 'Cool' },
  { id: 'c9', title: 'Space Journey', image: 'https://media.giphy.com/media/3og0INyCmHlNylks9O/giphy.gif', tags: ['space','stars','galaxy','journey'], category: 'Clips', mood: 'Wow' },
  { id: 'c10', title: 'Ocean Waves', image: 'https://media.giphy.com/media/xT1XGLm7CJknNZKVS8/giphy.gif', tags: ['ocean','waves','beach','relax'], category: 'Clips', mood: 'Cool' },
  { id: 'c12', title: 'Waterfall', image: 'https://media.giphy.com/media/xT5LMESsx1kUe8Hiyk/giphy.gif', tags: ['waterfall','nature','water','scenic'], category: 'Clips', mood: 'Wow' },
  { id: 'c13', title: 'Neon Street', image: 'https://media.giphy.com/media/l378khQxt68syiWJy/giphy.gif', tags: ['neon','street','night','city'], category: 'Clips', mood: 'Cool' },
  { id: 'c14', title: 'Tokyo Night', image: 'https://media.giphy.com/media/4ilFRqgbzbx4c/giphy.gif', tags: ['tokyo','japan','night','city'], category: 'Clips', mood: 'Cool' },
  { id: 'c15', title: 'Lightning Storm', image: 'https://media.giphy.com/media/l0MYLePFMI1m69fpu/giphy.gif', tags: ['lightning','storm','power','nature'], category: 'Clips', mood: 'Wow' },

  // ==================== ADDITIONAL REACTIONS (20+ more) ====================
  { id: 'r32', title: 'Shook', image: 'https://media.giphy.com/media/l0Iy69RBwtdmvwkIo/giphy.gif', tags: ['shook','shocked','omg','what'], category: 'Reactions', mood: 'Wow' },
  { id: 'r33', title: 'No No No', image: 'https://media.giphy.com/media/d10dMmzqCYqQ0/giphy.gif', tags: ['no','refuse','nope','negative'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'r34', title: 'Yass Queen', image: 'https://media.giphy.com/media/l1KVaj5UcbHwrBMqI/giphy.gif', tags: ['yass','queen','slay','werk'], category: 'Reactions', mood: 'Period' },
  { id: 'r35', title: 'Cash Money', image: 'https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.gif', tags: ['money','cash','rich','baller'], category: 'Reactions', mood: 'Hype' },
  { id: 'r36', title: 'Whatever', image: 'https://media.giphy.com/media/Rhhr8D5mKSX7O/giphy.gif', tags: ['whatever','meh','unbothered','idc'], category: 'Reactions', mood: 'Cool' },
  { id: 'r37', title: 'Blessed', image: 'https://media.giphy.com/media/26FLdmIp6wJr91JAI/giphy.gif', tags: ['blessed','grateful','thankful','pray'], category: 'Reactions', mood: 'Facts' },
  { id: 'r38', title: 'Im Out', image: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif', tags: ['out','leaving','bye','peace'], category: 'Reactions', mood: 'Cool' },
  { id: 'r39', title: 'Big Mood', image: 'https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif', tags: ['mood','same','relate','me'], category: 'Reactions', mood: 'Period' },
  { id: 'r40', title: 'Say Less', image: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif', tags: ['say less','got it','understood','done'], category: 'Reactions', mood: 'Facts' },
  { id: 'r42', title: 'Periodt', image: 'https://media.giphy.com/media/3o6fJ1BM7R2EBRDnxK/giphy.gif', tags: ['periodt','facts','end of story','done'], category: 'Reactions', mood: 'Period' },
  { id: 'r43', title: 'Savage', image: 'https://media.giphy.com/media/3o7TKrEzvLbsVAud8I/giphy.gif', tags: ['savage','brutal','no chill','cold'], category: 'Reactions', mood: 'Cool' },
  { id: 'r44', title: 'Its Giving', image: 'https://media.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif', tags: ['its giving','vibe','energy','look'], category: 'Reactions', mood: 'Period' },

  // ==================== BLACK CULTURE: ICONIC TV (60+) ====================
  { id: 'bc1', title: 'NeNe Side Eye', image: 'https://media.giphy.com/media/3o7TKqnN349PBUtGFO/giphy.gif', tags: ['nene leakes','rhoa','side eye','shade','real housewives'], category: 'Black Culture', mood: 'Side Eye' },
  { id: 'bc2', title: 'Phaedra Parks Yes', image: 'https://media.giphy.com/media/3o6Zt6KHxJTbXCnSvu/giphy.gif', tags: ['phaedra','rhoa','yes','agree','classy'], category: 'Black Culture', mood: 'Period' },
  { id: 'bc3', title: 'Issa Rae Mirror', image: 'https://media.giphy.com/media/l3vRfhFD8hJCiP0uQ/giphy.gif', tags: ['issa rae','insecure','mirror','pep talk','self talk'], category: 'Black Culture', mood: 'Cool' },
  { id: 'bc4', title: 'Tiffany Haddish Laugh', image: 'https://media.giphy.com/media/3o7TKEP6YngkCKFofC/giphy.gif', tags: ['tiffany haddish','laugh','hilarious','dying','girls trip'], category: 'Black Culture', mood: 'LOL' },
  { id: 'bc33', title: 'Whitley Drama', image: 'https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif', tags: ['whitley','different world','dramatic','jasmine guy','90s'], category: 'Black Culture', mood: 'Period' },

  // ==================== BLACK CULTURE: MUSIC LEGENDS (50+) ====================

  // ==================== BLACK CULTURE: REACTIONS & MOMENTS (50+) ====================

  // ==================== BLACK CULTURE: SPORTS LEGENDS (40+) ====================
  { id: 'bc155', title: 'MJ Crying Meme', image: 'https://media.giphy.com/media/YLgIOmtIMUACY/giphy.gif', tags: ['michael jordan','crying','meme','sad','iconic'], category: 'Black Culture', mood: 'Period' },

  // ==================== BLACK CULTURE: DANCE & VIBES (40+) ====================

  // ==================== BLACK CULTURE: BARBERSHOP & FUNNY (30+) ====================

  // ==================== BLACK CULTURE: VIRAL MOMENTS (30+) ====================
];

export const GIFS: Gif[] = [...BASE_GIFS, ...BLACK_GIFS];

export const CATEGORIES = ['Trending', 'New', 'Black Culture', 'Reactions', 'Clips', 'Memes', 'Music', 'TV & Movies', 'Sports', 'Gaming'];

export const MOODS = [
  { name: 'Cool', emoji: '😎' },
  { name: 'Lit', emoji: '🔥' },
  { name: 'LOL', emoji: '😂' },
  { name: 'Wow', emoji: '😯' },
  { name: 'Hype', emoji: '🚀' },
  { name: 'Side Eye', emoji: '👀' },
  { name: 'Facts', emoji: '💯' },
  { name: 'Period', emoji: '👑' },
];

export const TRENDING_SEARCHES = ['savage', 'periodt', 'not today', 'say less', 'facts', 'slay', 'vibe check', 'its giving', 'no cap', 'lowkey'];

export function findGif(id: string) {
  return GIFS.find(g => g.id === id);
}

export function getGifsByCategory(category: string, limit?: number) {
  const filtered = category === 'Trending' 
    ? [...GIFS.filter(g => g.category === 'Trending'), ...GIFS.filter(g => g.category !== 'Trending')].slice(0, 130)
    : GIFS.filter(g => g.category === category);
  return limit ? filtered.slice(0, limit) : filtered;
}

export function getGifsByMood(mood: string, limit?: number) {
  const filtered = GIFS.filter(g => g.mood === mood);
  return limit ? filtered.slice(0, limit) : filtered;
}

export function searchGifs(query: string, limit?: number) {
  const q = query.toLowerCase();
  const filtered = GIFS.filter(g => 
    g.title.toLowerCase().includes(q) || 
    g.tags.some(t => t.toLowerCase().includes(q)) ||
    g.category.toLowerCase().includes(q) ||
    g.mood.toLowerCase().includes(q)
  );
  return limit ? filtered.slice(0, limit) : filtered;
}
