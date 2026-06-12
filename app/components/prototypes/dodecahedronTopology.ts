import type { ChapterId } from './infiniteNodeMapModel';

export type DodecahedronFace = {
  faceIndex: number;
  normal: [number, number, number];
  neighbors: Record<ChapterId, number>;
};

export const DODECAHEDRON_EDGE_CHAPTERS = [
  'alphabet',
  'noclipping',
  'dimension',
  'paradox',
  'noise',
] as const satisfies readonly ChapterId[];

export type DodecahedronEdgeIndex = 0 | 1 | 2 | 3 | 4;

const PHI = (1 + Math.sqrt(5)) / 2;

export const DODECAHEDRON_FACES: DodecahedronFace[] = [
  {
    faceIndex: 0,
    normal: [0, 1, PHI],
    neighbors: { alphabet: 1, noclipping: 4, dimension: 5, paradox: 8, noise: 10 },
  },
  {
    faceIndex: 1,
    normal: [0, -1, PHI],
    neighbors: { alphabet: 0, noclipping: 8, dimension: 10, paradox: 6, noise: 7 },
  },
  {
    faceIndex: 2,
    normal: [0, 1, -PHI],
    neighbors: { alphabet: 11, noclipping: 5, dimension: 9, paradox: 4, noise: 3 },
  },
  {
    faceIndex: 3,
    normal: [0, -1, -PHI],
    neighbors: { alphabet: 6, noclipping: 7, dimension: 11, paradox: 9, noise: 2 },
  },
  {
    faceIndex: 4,
    normal: [1, PHI, 0],
    neighbors: { alphabet: 5, noclipping: 0, dimension: 8, paradox: 2, noise: 9 },
  },
  {
    faceIndex: 5,
    normal: [-1, PHI, 0],
    neighbors: { alphabet: 4, noclipping: 2, dimension: 0, paradox: 10, noise: 11 },
  },
  {
    faceIndex: 6,
    normal: [1, -PHI, 0],
    neighbors: { alphabet: 3, noclipping: 9, dimension: 7, paradox: 1, noise: 8 },
  },
  {
    faceIndex: 7,
    normal: [-1, -PHI, 0],
    neighbors: { alphabet: 10, noclipping: 3, dimension: 6, paradox: 11, noise: 1 },
  },
  {
    faceIndex: 8,
    normal: [PHI, 0, 1],
    neighbors: { alphabet: 9, noclipping: 1, dimension: 4, paradox: 0, noise: 6 },
  },
  {
    faceIndex: 9,
    normal: [PHI, 0, -1],
    neighbors: { alphabet: 8, noclipping: 6, dimension: 2, paradox: 3, noise: 4 },
  },
  {
    faceIndex: 10,
    normal: [-PHI, 0, 1],
    neighbors: { alphabet: 7, noclipping: 11, dimension: 1, paradox: 5, noise: 0 },
  },
  {
    faceIndex: 11,
    normal: [-PHI, 0, -1],
    neighbors: { alphabet: 2, noclipping: 10, dimension: 3, paradox: 7, noise: 5 },
  },
];

export function getNextDodecahedronFace(currentFaceIndex: number, chapter: ChapterId): number {
  const face = DODECAHEDRON_FACES[currentFaceIndex] ?? DODECAHEDRON_FACES[0];
  return face.neighbors[chapter];
}

export function getDodecahedronEdgeChapter(edgeIndex: number): ChapterId {
  const chapter = DODECAHEDRON_EDGE_CHAPTERS[edgeIndex];
  if (!chapter) {
    throw new Error(`Invalid dodecahedron edge index: ${edgeIndex}`);
  }
  return chapter;
}

export function getDodecahedronNeighborByEdge(faceIndex: number, edgeIndex: number): number {
  const face = DODECAHEDRON_FACES[faceIndex];
  if (!face) {
    throw new Error(`Invalid dodecahedron face index: ${faceIndex}`);
  }
  return face.neighbors[getDodecahedronEdgeChapter(edgeIndex)];
}

export function findEdgeIndexPointingBack(faceIndex: number, targetFaceIndex: number): number {
  const face = DODECAHEDRON_FACES[faceIndex];
  if (!face) {
    throw new Error(`Invalid dodecahedron face index: ${faceIndex}`);
  }

  const edgeIndex = DODECAHEDRON_EDGE_CHAPTERS.findIndex((chapter) => (
    face.neighbors[chapter] === targetFaceIndex
  ));

  if (edgeIndex < 0) {
    throw new Error(`Face ${faceIndex} has no edge pointing back to face ${targetFaceIndex}`);
  }

  return edgeIndex;
}
