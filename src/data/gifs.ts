import { Gif } from '@/contexts/AppContext';

export const GIFS: Gif[] = [
  { id: 'g1', title: 'Vibes Only', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822552616_6fc8f023.jpg', tags: ['vibes','cool','confident','neon','mood'], category: 'Reactions', mood: 'Cool' },
  { id: 'g2', title: 'Drip Dog', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822577024_bc8d7848.jpg', tags: ['funny','dog','swag','meme'], category: 'Memes', mood: 'LOL' },
  { id: 'g3', title: 'Keep it 100', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822593666_14558a9b.jpg', tags: ['facts','real','100','neon'], category: 'Reactions', mood: 'Facts' },
  { id: 'g4', title: 'Lets Go', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822613928_d66b23c4.png', tags: ['hype','energy','party','lets go'], category: 'Reactions', mood: 'Hype' },
  { id: 'g5', title: 'Dreamer', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822635006_427079cb.png', tags: ['dreamy','music','vibe','aesthetic'], category: 'Music', mood: 'Cool' },
  { id: 'g6', title: 'Good Vibes', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822655145_ecafe541.png', tags: ['good vibes','neon','mood','blue'], category: 'New', mood: 'Lit' },
  { id: 'g7', title: 'Side Eye', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822672726_54a1aa8e.jpg', tags: ['side eye','sus','really','no'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'g8', title: 'Not Today', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822677674_d7b5519c.png', tags: ['not today','side eye','nope','attitude'], category: 'Reactions', mood: 'Side Eye' },
  { id: 'g9', title: 'Cool Panda', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822726120_18ec64a1.png', tags: ['panda','swag','cool','animal'], category: 'Memes', mood: 'Cool' },
  { id: 'g10', title: 'Dead Inside', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822742297_3031ee1e.jpg', tags: ['mood','spooky','dark','xd'], category: 'Memes', mood: 'Period' },
  { id: 'g11', title: 'Night Drive', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822758438_f9f00de4.jpg', tags: ['drive','night','city','vibes'], category: 'Clips', mood: 'Cool' },
  { id: 'g12', title: 'Mood Cat', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822773811_53a0b44e.jpg', tags: ['cat','mood','cool','animal'], category: 'Memes', mood: 'Cool' },
  { id: 'g13', title: 'Rocket Up', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822790206_1e5c7620.jpg', tags: ['rocket','launch','hype','go'], category: 'New', mood: 'Hype' },
  { id: 'g14', title: 'OMG Wow', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822807771_771de264.jpg', tags: ['omg','wow','shook','surprise'], category: 'Reactions', mood: 'Wow' },
  { id: 'g15', title: 'Big LOL', image: 'https://d64gsuwffb70l.cloudfront.net/6a06ad1800a67f11e6c9d84a_1778822832174_cdd671ee.png', tags: ['lol','laugh','funny','dead'], category: 'Reactions', mood: 'LOL' },
];

export const CATEGORIES = ['Trending', 'New', 'Reactions', 'Clips', 'Memes', 'Music', 'TV & Movies', 'Sports', 'Gaming'];

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

export const TRENDING_SEARCHES = ['savage', 'periodt', 'not today', 'say less', 'facts'];

export function findGif(id: string) {
  return GIFS.find(g => g.id === id);
}
