export type ChapterId = 'alphabet' | 'noclipping' | 'dimension' | 'paradox' | 'noise';
export type NodeDirection = 'up' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'topLeft';

export type ChapterConfig = {
  id: ChapterId;
  label: string;
  src: string;
};

export type NodeCoord = {
  q: number;
  r: number;
};

export type NodeChapterType = ChapterId | 'home' | null;

export type ExplorationNodeRecord = {
  id: string;
  coord: NodeCoord;
  chapterType: NodeChapterType;
  enteredFrom: NodeDirection | null;
  parentNodeId: string | null;
  chaptersByDirection: Record<NodeDirection, ChapterConfig>;
  position: { x: number; y: number };
};

export type ExplorationNode = {
  key: string;
  id: string;
  coord: NodeCoord;
  chapterType: NodeChapterType;
  enteredFrom: NodeDirection | null;
  parentNodeId: string | null;
  chaptersByDirection: Record<NodeDirection, ChapterConfig>;
  position: { x: number; y: number };
};

export type ExplorationEdge = {
  id: string;
  fromKey: string;
  toKey: string;
  direction: NodeDirection;
  chapter: ChapterConfig;
};

type HomeSlot = {
  width: number;
};

export type ExplorationMetrics = {
  axisX: { x: number; y: number };
  axisY: { x: number; y: number };
};

export type PentagonEdge = {
  direction: NodeDirection;
  chapter: ChapterConfig;
  start: { x: number; y: number };
  end: { x: number; y: number };
  midpoint: { x: number; y: number };
  titlePoint: { x: number; y: number };
  normal: { x: number; y: number };
  movement: { x: number; y: number };
};

export type PentagonUnit = {
  center: { x: number; y: number };
  radius: number;
  apothem: number;
  vertices: { x: number; y: number }[];
  edges: Record<NodeDirection, PentagonEdge>;
};

export const DOT_SIZE_MM = 4;
export const PX_PER_MM = 96 / 25.4;
export const DOT_SIZE_PX = DOT_SIZE_MM * PX_PER_MM;

const HOME_REFERENCE = {
  width: 1440,
  height: 900,
};

const IMAGE_ASPECT = {
  alphabet: 3591 / 6464,
  noclipping: 6676 / 5479,
  dimension: 6390 / 4999,
  paradox: 5230 / 6666,
  noise: 6571 / 3089,
} satisfies Record<ChapterId, number>;

const HOME_SLOTS = {
  up: {
    width: Math.min(HOME_REFERENCE.width * 0.323, HOME_REFERENCE.height * 0.574),
  },
  topRight: {
    width: Math.min(HOME_REFERENCE.width * 0.197, HOME_REFERENCE.height * 0.35),
  },
  bottomRight: {
    width: Math.min(HOME_REFERENCE.width * 0.203, HOME_REFERENCE.height * 0.36),
  },
  bottomLeft: {
    width: Math.min(HOME_REFERENCE.width * 0.307, HOME_REFERENCE.height * 0.55),
  },
  topLeft: {
    width: Math.min(HOME_REFERENCE.width * 0.128, HOME_REFERENCE.height * 0.22),
  },
} satisfies Record<NodeDirection, HomeSlot>;

export const NODE_LAYOUT = {
  dotSize: DOT_SIZE_PX,
  mirrorWidth: DOT_SIZE_PX * 10,
  titleScale: 0.62,
  chapterUpWidth: HOME_SLOTS.up.width,
  chapterTopRightWidth: HOME_SLOTS.topRight.width,
  chapterBottomRightWidth: HOME_SLOTS.bottomRight.width,
  chapterBottomLeftWidth: HOME_SLOTS.bottomLeft.width,
  chapterTopLeftWidth: HOME_SLOTS.topLeft.width,
};

export const NODE_DIRECTIONS: NodeDirection[] = [
  'up',
  'topRight',
  'bottomRight',
  'bottomLeft',
  'topLeft',
];

export const CHAPTERS: ChapterConfig[] = [
  {
    id: 'alphabet',
    label: 'Alphabet',
    src: '/chapter/rorrim_1%20Alphabet.png',
  },
  {
    id: 'noclipping',
    label: 'Noclipping',
    src: '/chapter/rorrim_2%20Noclipping.png',
  },
  {
    id: 'dimension',
    label: 'Dimension',
    src: '/chapter/rorrim_3%20Dimension.png',
  },
  {
    id: 'paradox',
    label: 'Paradox',
    src: '/chapter/rorrim_4%20Paradox.png',
  },
  {
    id: 'noise',
    label: 'Noise',
    src: '/chapter/rorrim_5%20Noise.png',
  },
];

export const FIXED_CHAPTERS_BY_DIRECTION: Record<NodeDirection, ChapterConfig> = {
  up: CHAPTERS[0],
  topRight: CHAPTERS[1],
  bottomRight: CHAPTERS[2],
  bottomLeft: CHAPTERS[3],
  topLeft: CHAPTERS[4],
};

export const TITLE_WIDTH_BY_DIRECTION: Record<NodeDirection, number> = {
  up: NODE_LAYOUT.chapterUpWidth,
  topRight: NODE_LAYOUT.chapterTopRightWidth,
  bottomRight: NODE_LAYOUT.chapterBottomRightWidth,
  bottomLeft: NODE_LAYOUT.chapterBottomLeftWidth,
  topLeft: NODE_LAYOUT.chapterTopLeftWidth,
};

export const CHAPTER_VISUAL_WIDTH: Record<ChapterId, number> = {
  alphabet: 392.04,
  noclipping: 323.36,
  dimension: 324.67,
  paradox: 409.85,
  noise: 192.54,
};

export function nodeKey(coord: NodeCoord): string {
  return `${coord.q},${coord.r}`;
}

export function parseNodeKey(key: string): NodeCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function createExplorationMetrics(nodeSpacingX: number, nodeSpacingY: number): ExplorationMetrics {
  return {
    axisX: {
      x: nodeSpacingX * 0.54,
      y: nodeSpacingY * 0.56,
    },
    axisY: {
      x: 0,
      y: nodeSpacingY * 0.98,
    },
  };
}

export function createPentagonUnit({
  radius,
  chapterEdgeOffset,
  rotation,
}: {
  radius: number;
  chapterEdgeOffset: number;
  rotation: number;
}): PentagonUnit {
  const center = { x: 0, y: 0 };
  const apothem = radius * Math.cos(Math.PI / 5);
  const baseAngles = [-126, -54, 18, 90, 162];
  const vertices = baseAngles.map((angle) => {
    const radians = ((angle + rotation) * Math.PI) / 180;
    return {
      x: Math.cos(radians) * radius,
      y: Math.sin(radians) * radius,
    };
  });
  const edgeEntries = NODE_DIRECTIONS.map((direction, index) => {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const normal = normalizeVector(midpoint);
    const edge = {
      direction,
      chapter: FIXED_CHAPTERS_BY_DIRECTION[direction],
      start,
      end,
      midpoint,
      titlePoint: {
        x: midpoint.x + normal.x * chapterEdgeOffset,
        y: midpoint.y + normal.y * chapterEdgeOffset,
      },
      normal,
      movement: {
        x: normal.x * apothem * 2,
        y: normal.y * apothem * 2,
      },
    };
    return [direction, edge] as const;
  });

  return {
    center,
    radius,
    apothem,
    vertices,
    edges: Object.fromEntries(edgeEntries) as Record<NodeDirection, PentagonEdge>,
  };
}

export function getPentagonTargetPosition(
  position: { x: number; y: number },
  direction: NodeDirection,
  pentagonUnit: PentagonUnit,
): { x: number; y: number } {
  const movement = pentagonUnit.edges[direction].movement;
  return {
    x: position.x + movement.x,
    y: position.y + movement.y,
  };
}

export function getPentagonChapterPosition(
  position: { x: number; y: number },
  direction: NodeDirection,
  pentagonUnit: PentagonUnit,
): { x: number; y: number } {
  const titlePoint = pentagonUnit.edges[direction].titlePoint;
  return {
    x: position.x + titlePoint.x,
    y: position.y + titlePoint.y,
  };
}

export function getNodeWorldPosition(coord: NodeCoord, metrics: ExplorationMetrics): { x: number; y: number } {
  return {
    x: coord.q * metrics.axisX.x + coord.r * metrics.axisY.x,
    y: coord.q * metrics.axisX.y + coord.r * metrics.axisY.y,
  };
}

export function createOriginNodeRecord(): ExplorationNodeRecord {
  return {
    id: nodeKey({ q: 0, r: 0 }),
    coord: { q: 0, r: 0 },
    chapterType: 'home',
    enteredFrom: null,
    parentNodeId: null,
    chaptersByDirection: FIXED_CHAPTERS_BY_DIRECTION,
    position: { x: 0, y: 0 },
  };
}

export function createExplorationNode(record: ExplorationNodeRecord, metrics: ExplorationMetrics): ExplorationNode {
  return {
    ...record,
    key: record.id,
    position: record.position ?? getNodeWorldPosition(record.coord, metrics),
  };
}

export function createEnteredNodeRecord({
  coord,
  parentNodeId,
  enteredFrom,
  chapter,
  position,
}: {
  coord: NodeCoord;
  parentNodeId: string;
  enteredFrom: NodeDirection;
  chapter: ChapterConfig;
  position: { x: number; y: number };
}): ExplorationNodeRecord {
  const id = nodeKey(coord);
  const inheritedDirection = getReverseDirection(enteredFrom) ?? enteredFrom;

  return {
    id,
    coord,
    chapterType: chapter.id,
    enteredFrom,
    parentNodeId,
    chaptersByDirection: createNodeChapterAssignment(coord, {
      direction: inheritedDirection,
      chapter,
    }),
    position,
  };
}

export function getTargetCoord(coord: NodeCoord, direction: NodeDirection): NodeCoord {
  switch (direction) {
    case 'up':
      return { q: coord.q, r: coord.r - 1 };
    case 'topRight':
      return { q: coord.q + 1, r: coord.r - 1 };
    case 'bottomRight':
      return { q: coord.q + 1, r: coord.r };
    case 'bottomLeft':
      return { q: coord.q - 1, r: coord.r + 1 };
    case 'topLeft':
      return { q: coord.q - 1, r: coord.r };
  }
}

export function getReverseDirection(direction: NodeDirection): NodeDirection | null {
  switch (direction) {
    case 'up':
      return null;
    case 'topRight':
      return 'bottomLeft';
    case 'bottomRight':
      return 'topLeft';
    case 'bottomLeft':
      return 'topRight';
    case 'topLeft':
      return 'bottomRight';
  }
}

export function createEdgeId(fromKey: string, direction: NodeDirection): string {
  return `${fromKey}:${direction}`;
}

export function getDirectionChapter(direction: NodeDirection): ChapterConfig {
  return FIXED_CHAPTERS_BY_DIRECTION[direction];
}

export function getNodePhase(coord: NodeCoord): number {
  const seed = (Math.imul(coord.q + 0x10000, 73856093) ^ Math.imul(coord.r + 0x10000, 19349663)) >>> 0;
  return (seed / 0xffffffff) * Math.PI * 2;
}

export function getImageAspect(chapterId: ChapterId): number {
  return IMAGE_ASPECT[chapterId];
}

function createNodeChapterAssignment(
  coord: NodeCoord,
  fixed: { direction: NodeDirection; chapter: ChapterConfig } | null,
): Record<NodeDirection, ChapterConfig> {
  const assignment = {} as Record<NodeDirection, ChapterConfig>;
  const directions = [...NODE_DIRECTIONS];
  const availableChapters = fixed
    ? CHAPTERS.filter((chapter) => chapter.id !== fixed.chapter.id)
    : [...CHAPTERS];
  const shuffledChapters = stableShuffle(availableChapters, `${nodeKey(coord)}:${fixed?.chapter.id ?? 'home'}`);

  if (fixed) {
    assignment[fixed.direction] = fixed.chapter;
  }

  directions
    .filter((direction) => !assignment[direction])
    .forEach((direction, index) => {
      assignment[direction] = shuffledChapters[index];
    });

  return assignment;
}

function stableShuffle<T>(items: T[], seedText: string): T[] {
  const shuffled = [...items];
  let seed = hashString(seedText);

  for (let index = shuffled.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeVector(vector: { x: number; y: number }): { x: number; y: number } {
  const length = Math.max(1, Math.hypot(vector.x, vector.y));
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}
