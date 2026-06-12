import {
  DODECAHEDRON_EDGE_CHAPTERS,
  findEdgeIndexPointingBack,
  getDodecahedronEdgeChapter,
  getDodecahedronNeighborByEdge,
} from './dodecahedronTopology';
import type { ChapterId } from './infiniteNodeMapModel';

export type PentagonPoint = { x: number; y: number };

export type PentagonPatchEdge = {
  edgeIndex: number;
  chapter: ChapterId;
  start: PentagonPoint;
  end: PentagonPoint;
  midpoint: PentagonPoint;
  neighborFaceIndex: number;
  neighborEdgeIndex: number;
};

export type PentagonPatchTile = {
  id: string;
  faceIndex: number;
  path: number[];
  parentFaceIndex: number | null;
  parentEdgeIndex: number | null;
  enteredFromEdge: number | null;
  localPosition: PentagonPoint;
  rotation: number;
  scale: number;
  radius: number;
  depth: number;
  centerPoint: PentagonPoint;
  vertices: PentagonPoint[];
  edges: PentagonPatchEdge[];
};

export type SharedEdgeAlignmentResult = {
  parentEdgeIndex: number;
  neighborEdgeIndex: number;
  parentStart: PentagonPoint;
  parentEnd: PentagonPoint;
  neighborStart: PentagonPoint;
  neighborEnd: PentagonPoint;
  startError: number;
  endError: number;
};

export type NeighborPlacement = {
  center: PentagonPoint;
  rotation: number;
  vertices: PentagonPoint[];
  sharedEdgeAlignment: SharedEdgeAlignmentResult;
};

const TAU = Math.PI * 2;
const PENTAGON_SIDES = 5;
const BASE_VERTEX_ROTATION = (-126 * Math.PI) / 180;

export function getPentagonVertices(
  center: PentagonPoint,
  radius: number,
  rotation: number,
): PentagonPoint[] {
  return Array.from({ length: PENTAGON_SIDES }, (_, index) => {
    const angle = BASE_VERTEX_ROTATION + rotation + (index * TAU) / PENTAGON_SIDES;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
}

export function getEdge(vertices: PentagonPoint[], edgeIndex: number): { start: PentagonPoint; end: PentagonPoint } {
  const start = vertices[edgeIndex];
  const end = vertices[(edgeIndex + 1) % PENTAGON_SIDES];

  if (!start || !end) {
    throw new Error(`Invalid pentagon edge index: ${edgeIndex}`);
  }

  return { start, end };
}

export function placeNeighborPentagon(
  parentTile: PentagonPatchTile,
  parentEdgeIndex: number,
  neighborFaceIndex: number,
  neighborEdgeIndex: number,
): NeighborPlacement {
  const parentEdge = getEdge(parentTile.vertices, parentEdgeIndex);
  const parentReverseAngle = Math.atan2(
    parentEdge.start.y - parentEdge.end.y,
    parentEdge.start.x - parentEdge.end.x,
  );
  const localZeroVertices = getPentagonVertices({ x: 0, y: 0 }, parentTile.radius, 0);
  const localZeroEdge = getEdge(localZeroVertices, neighborEdgeIndex);
  const localZeroEdgeAngle = Math.atan2(
    localZeroEdge.end.y - localZeroEdge.start.y,
    localZeroEdge.end.x - localZeroEdge.start.x,
  );
  const rotation = parentReverseAngle - localZeroEdgeAngle;
  const localVertices = getPentagonVertices({ x: 0, y: 0 }, parentTile.radius, rotation);
  const localSharedEdge = getEdge(localVertices, neighborEdgeIndex);
  const center = {
    x: parentEdge.end.x - localSharedEdge.start.x,
    y: parentEdge.end.y - localSharedEdge.start.y,
  };
  const vertices = localVertices.map((vertex) => ({
    x: vertex.x + center.x,
    y: vertex.y + center.y,
  }));
  const neighborEdge = getEdge(vertices, neighborEdgeIndex);
  const sharedEdgeAlignment = {
    parentEdgeIndex,
    neighborEdgeIndex,
    parentStart: parentEdge.start,
    parentEnd: parentEdge.end,
    neighborStart: neighborEdge.start,
    neighborEnd: neighborEdge.end,
    startError: distance(parentEdge.end, neighborEdge.start),
    endError: distance(parentEdge.start, neighborEdge.end),
  };

  if (!isOutsideParent(parentTile, center, parentEdge)) {
    throw new Error(`Neighbor face ${neighborFaceIndex} was placed inside parent face ${parentTile.faceIndex}`);
  }

  return {
    center,
    rotation,
    vertices,
    sharedEdgeAlignment,
  };
}

export function generateLocalPentagonPatch({
  centerFaceIndex,
  depth,
  radius,
  rotation = 0,
}: {
  centerFaceIndex: number;
  depth: number;
  radius: number;
  rotation?: number;
}): PentagonPatchTile[] {
  const centerTile = createTile({
    faceIndex: centerFaceIndex,
    path: [],
    parentFaceIndex: null,
    parentEdgeIndex: null,
    enteredFromEdge: null,
    center: { x: 0, y: 0 },
    radius,
    rotation,
    depth: 0,
  });
  const tiles: PentagonPatchTile[] = [centerTile];
  const queue: PentagonPatchTile[] = [centerTile];

  while (queue.length > 0) {
    const parentTile = queue.shift();
    if (!parentTile || parentTile.depth >= depth) continue;

    for (let edgeIndex = 0; edgeIndex < DODECAHEDRON_EDGE_CHAPTERS.length; edgeIndex += 1) {
      const neighborFaceIndex = getDodecahedronNeighborByEdge(parentTile.faceIndex, edgeIndex);
      const neighborEdgeIndex = findEdgeIndexPointingBack(neighborFaceIndex, parentTile.faceIndex);
      const placement = placeNeighborPentagon(
        parentTile,
        edgeIndex,
        neighborFaceIndex,
        neighborEdgeIndex,
      );
      const childTile = createTile({
        faceIndex: neighborFaceIndex,
        path: [...parentTile.path, edgeIndex],
        parentFaceIndex: parentTile.faceIndex,
        parentEdgeIndex: edgeIndex,
        enteredFromEdge: neighborEdgeIndex,
        center: placement.center,
        radius,
        rotation: placement.rotation,
        depth: parentTile.depth + 1,
      });

      tiles.push(childTile);
      queue.push(childTile);
    }
  }

  return tiles;
}

export function getCrossedEdgeIndex(point: PentagonPoint, tile: PentagonPatchTile): number | null {
  let crossedEdgeIndex: number | null = null;
  let strongestOutsideDistance = 0;

  for (const edge of tile.edges) {
    const outsideDistance = getOutsideEdgeDistance(point, tile.centerPoint, edge.start, edge.end);
    if (outsideDistance > strongestOutsideDistance) {
      strongestOutsideDistance = outsideDistance;
      crossedEdgeIndex = edge.edgeIndex;
    }
  }

  return crossedEdgeIndex;
}

export function getOppositeEntryPoint(tile: PentagonPatchTile, edgeIndex: number, inset: number): PentagonPoint {
  const edge = tile.edges[edgeIndex];
  const direction = normalize({
    x: tile.centerPoint.x - edge.midpoint.x,
    y: tile.centerPoint.y - edge.midpoint.y,
  });

  return {
    x: edge.midpoint.x + direction.x * inset,
    y: edge.midpoint.y + direction.y * inset,
  };
}

export function normalizeAngle(angle: number): number {
  let result = angle;
  while (result <= -Math.PI) result += TAU;
  while (result > Math.PI) result -= TAU;
  return result;
}

function createTile({
  faceIndex,
  path,
  parentFaceIndex,
  parentEdgeIndex,
  enteredFromEdge,
  center,
  radius,
  rotation,
  depth,
}: {
  faceIndex: number;
  path: number[];
  parentFaceIndex: number | null;
  parentEdgeIndex: number | null;
  enteredFromEdge: number | null;
  center: PentagonPoint;
  radius: number;
  rotation: number;
  depth: number;
}): PentagonPatchTile {
  const vertices = getPentagonVertices(center, radius, rotation);
  const edges = vertices.map((vertex, edgeIndex) => {
    const end = vertices[(edgeIndex + 1) % PENTAGON_SIDES];
    const neighborFaceIndex = getDodecahedronNeighborByEdge(faceIndex, edgeIndex);
    const neighborEdgeIndex = findEdgeIndexPointingBack(neighborFaceIndex, faceIndex);
    return {
      edgeIndex,
      chapter: getDodecahedronEdgeChapter(edgeIndex),
      start: vertex,
      end,
      midpoint: midpoint(vertex, end),
      neighborFaceIndex,
      neighborEdgeIndex,
    };
  });

  return {
    id: `${faceIndex}:${path.length > 0 ? path.join('-') : 'center'}`,
    faceIndex,
    path,
    parentFaceIndex,
    parentEdgeIndex,
    enteredFromEdge,
    localPosition: center,
    rotation,
    scale: 1,
    radius,
    depth,
    centerPoint: center,
    vertices,
    edges,
  };
}

function isOutsideParent(
  parentTile: PentagonPatchTile,
  neighborCenter: PentagonPoint,
  parentEdge: { start: PentagonPoint; end: PentagonPoint },
): boolean {
  const parentSide = signedSide(parentTile.centerPoint, parentEdge.start, parentEdge.end);
  const neighborSide = signedSide(neighborCenter, parentEdge.start, parentEdge.end);
  return parentSide === 0 || neighborSide === 0 ? false : Math.sign(parentSide) !== Math.sign(neighborSide);
}

function getOutsideEdgeDistance(
  point: PentagonPoint,
  center: PentagonPoint,
  start: PentagonPoint,
  end: PentagonPoint,
): number {
  const centerSide = signedSide(center, start, end);
  const pointSide = signedSide(point, start, end);
  if (centerSide === 0 || Math.sign(pointSide) === Math.sign(centerSide)) {
    return 0;
  }

  return Math.abs(pointSide) / distance(start, end);
}

function signedSide(point: PentagonPoint, start: PentagonPoint, end: PentagonPoint): number {
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
}

function midpoint(a: PentagonPoint, b: PentagonPoint): PentagonPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function distance(a: PentagonPoint, b: PentagonPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(vector: PentagonPoint): PentagonPoint {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { x: 0, y: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}
