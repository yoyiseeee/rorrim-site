import type { ChapterId } from './infiniteNodeMapModel';

export type D12ChapterNumberAsset = {
  chapter: ChapterId;
  number: 1 | 2 | 3 | 4 | 5;
  src: string;
  label: string;
};

export const d12ChapterNumberAssets = {
  alphabet: {
    chapter: 'alphabet',
    number: 1,
    src: '/d12/rorrim-numbers/1-alphabet.png',
    label: '1 Alphabet',
  },
  noclipping: {
    chapter: 'noclipping',
    number: 2,
    src: '/d12/rorrim-numbers/2-noclipping.png',
    label: '2 Noclipping',
  },
  dimension: {
    chapter: 'dimension',
    number: 3,
    src: '/d12/rorrim-numbers/3-dimension.png',
    label: '3 Dimension',
  },
  paradox: {
    chapter: 'paradox',
    number: 4,
    src: '/d12/rorrim-numbers/4-paradox.png',
    label: '4 Paradox',
  },
  noise: {
    chapter: 'noise',
    number: 5,
    src: '/d12/rorrim-numbers/5-noise.png',
    label: '5 Noise',
  },
} satisfies Record<ChapterId, D12ChapterNumberAsset>;

