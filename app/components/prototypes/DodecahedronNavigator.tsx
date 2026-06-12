'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import styles from './InfiniteNodeMapPrototype.module.css';
import { d12ChapterNumberAssets } from './d12ChapterNumberAssets';
import { DODECAHEDRON_EDGE_CHAPTERS, DODECAHEDRON_FACES } from './dodecahedronTopology';
import { CHAPTERS } from './infiniteNodeMapModel';
import type { ChapterConfig, ChapterId, NodeDirection } from './infiniteNodeMapModel';
import { assetPath } from '../../utils/assetPath';

const D12_SIZE = {
  width: 190,
  height: 140,
};

const D12_RENDER_SIZE = {
  width: 380,
  height: 280,
};

export const D12_ROLL_DURATION_MS = 4200;

const MODEL_RADIUS = 1.14;
const TEXTURE_SIZE = 2048;
const FRONT_NORMAL = new THREE.Vector3(0, 0, 1);
const ORDERED_DIRECTIONS: NodeDirection[] = ['up', 'topRight', 'bottomRight', 'bottomLeft', 'topLeft'];
const TEXTURE_VERTEX_ANGLES = [-126, -54, 18, 90, 162];

type ChapterImageMap = Record<ChapterId, HTMLImageElement | null>;
type D12VisualMode = 'chapters' | 'numbers';
const d12ImagePromiseCache = new Map<string, Promise<HTMLImageElement | null>>();
const d12ImageContentBoxCache = new WeakMap<HTMLImageElement, ImageContentBox>();

type PentagonFace = {
  faceIndex: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  vertices: THREE.Vector3[];
  edgeMappings: EdgeMapping[];
  geometry: THREE.BufferGeometry;
};

type RawDodecahedronVertex = {
  point: THREE.Vector3;
  faceIndices: number[];
};

type TexturePoint = { x: number; y: number };

type EdgeMapping = {
  chapter: ChapterId;
  neighborFaceIndex: number;
  sourceSideSign: 1 | -1;
};

type ImageContentBox = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

type EdgeSlot = {
  seam: TexturePoint;
  tangent: TexturePoint;
  inward: TexturePoint;
  maxEdgeLength: number;
  maxFaceDepth: number;
  sourceSideSign: 1 | -1;
  clipPoints: TexturePoint[];
};

export function preloadDodecahedronImages(srcs: string[]) {
  srcs.forEach((src) => {
    loadImage(assetPath(src));
  });
}

export default function DodecahedronNavigator({
  currentFaceIndex,
  chaptersByDirection,
  modelScale,
  lineWidth,
  interactive = false,
  rollSignal = 0,
  rollTargetFaceIndex = currentFaceIndex,
  visualMode = 'chapters',
  onClick,
}: {
  currentFaceIndex: number;
  chaptersByDirection: Record<NodeDirection, ChapterConfig>;
  modelScale: number;
  lineWidth: number;
  interactive?: boolean;
  rollSignal?: number;
  rollTargetFaceIndex?: number;
  visualMode?: D12VisualMode;
  onClick?: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const facesRef = useRef<PentagonFace[]>([]);
  const targetQuaternionRef = useRef(new THREE.Quaternion());
  const rollRef = useRef<{
    signal: number;
    startTime: number;
    duration: number;
    from: THREE.Quaternion;
    to: THREE.Quaternion;
    spinAxis: THREE.Vector3;
    tumbleAxis: THREE.Vector3;
    twistAxis: THREE.Vector3;
    spinTurns: number;
    tumbleTurns: number;
    twistTurns: number;
  } | null>(null);
  const currentFaceIndexRef = useRef(currentFaceIndex);
  const frameRef = useRef<number | null>(null);

  const textureSignature = useMemo(() => (
    [
      visualMode,
      ...ORDERED_DIRECTIONS.map((direction) => (
        visualMode === 'numbers'
          ? assetPath(d12ChapterNumberAssets[chaptersByDirection[direction].id].src)
          : assetPath(chaptersByDirection[direction].src)
      )),
    ].join('|')
  ), [chaptersByDirection, visualMode]);
  const safeModelScale = Math.max(0.45, Math.min(2.2, modelScale));
  const safeLineWidth = Math.max(0.25, Math.min(4, lineWidth));

  useEffect(() => {
    currentFaceIndexRef.current = currentFaceIndex;
    updateTargetQuaternion(currentFaceIndex, facesRef.current, targetQuaternionRef);
  }, [currentFaceIndex]);

  useEffect(() => {
    if (rollSignal <= 0 || rollRef.current?.signal === rollSignal) return;

    const from = groupRef.current?.quaternion.clone() ?? targetQuaternionRef.current.clone();
    const to = getFaceQuaternion(rollTargetFaceIndex, facesRef.current);
    targetQuaternionRef.current.copy(to);
    rollRef.current = {
      signal: rollSignal,
      startTime: performance.now(),
      duration: D12_ROLL_DURATION_MS,
      from,
      to,
      spinAxis: getRollAxis(rollSignal, rollTargetFaceIndex, 0),
      tumbleAxis: getRollAxis(rollSignal, rollTargetFaceIndex, 1),
      twistAxis: getRollAxis(rollSignal, rollTargetFaceIndex, 2),
      spinTurns: getRollTurns(rollSignal, rollTargetFaceIndex, 0, 6, 4),
      tumbleTurns: getRollTurns(rollSignal, rollTargetFaceIndex, 1, 5, 4),
      twistTurns: getRollTurns(rollSignal, rollTargetFaceIndex, 2, 4, 3),
    };
  }, [rollSignal, rollTargetFaceIndex]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let textures: THREE.CanvasTexture[] = [];
    const materials: THREE.MeshBasicMaterial[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    async function buildScene() {
      const chapterImages = await loadChapterImages(visualMode);
      if (disposed || !mount) return;

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1.72, 1.72, 1.27, -1.27, 0.1, 10);
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(D12_RENDER_SIZE.width, D12_RENDER_SIZE.height, false);
      renderer.setClearColor(0xffffff, 0);
      mount.replaceChildren(renderer.domElement);

      const group = new THREE.Group();
      const faces = createPentagonFaces(MODEL_RADIUS * safeModelScale);
      facesRef.current = faces;

      const seamFillGeometry = createDodecahedronFillGeometry(faces);
      const seamFillMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      const seamFillMesh = new THREE.Mesh(seamFillGeometry, seamFillMaterial);
      seamFillMesh.renderOrder = -10;
      group.add(seamFillMesh);
      materials.push(seamFillMaterial);
      geometries.push(seamFillGeometry);

      faces.forEach((face) => {
        const texture = createFaceTexture(chapterImages, face.edgeMappings, visualMode);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 1;
        textures.push(texture);

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: false,
          depthTest: true,
          depthWrite: true,
        });
        materials.push(material);

        const mesh = new THREE.Mesh(face.geometry, material);

        group.add(mesh);
        geometries.push(face.geometry);
      });

      groupRef.current = group;
      scene.add(group);
      updateTargetQuaternion(currentFaceIndexRef.current, faces, targetQuaternionRef);

      const render = () => {
        const currentGroup = groupRef.current;
        if (currentGroup) {
          const roll = rollRef.current;
          if (roll) {
            const progress = Math.min(1, Math.max(0, (performance.now() - roll.startTime) / roll.duration));
            const faceProgress = easeInOutQuint(progress);
            const rotationProgress = easeInOutCubic(progress);
            const base = roll.from.clone().slerp(roll.to, faceProgress);
            const spinA = Math.PI * 2 * roll.spinTurns * rotationProgress;
            const spinB = Math.PI * 2 * roll.tumbleTurns * rotationProgress;
            const spinC = Math.PI * 2 * roll.twistTurns * rotationProgress;
            const spinQuaternion = new THREE.Quaternion().setFromAxisAngle(roll.spinAxis, spinA);
            const tumbleQuaternion = new THREE.Quaternion().setFromAxisAngle(roll.tumbleAxis, spinB);
            const twistQuaternion = new THREE.Quaternion().setFromAxisAngle(roll.twistAxis, spinC);
            currentGroup.quaternion.copy(base).multiply(spinQuaternion).multiply(tumbleQuaternion).multiply(twistQuaternion);
            if (progress >= 1) {
              currentGroup.quaternion.copy(roll.to);
              rollRef.current = null;
            }
          } else {
            currentGroup.quaternion.slerp(targetQuaternionRef.current, 0.085);
          }
        }
        renderer?.render(scene, camera);
        frameRef.current = window.requestAnimationFrame(render);
      };

      render();
    }

    buildScene();

    return () => {
      disposed = true;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      textures.forEach((texture) => texture.dispose());
      textures = [];
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      renderer?.dispose();
      mount.replaceChildren();
      groupRef.current = null;
      facesRef.current = [];
    };
  }, [chaptersByDirection, safeLineWidth, safeModelScale, textureSignature, visualMode]);

  return (
    <aside
      className={`${styles.d12Navigator}${interactive ? ` ${styles.d12NavigatorInteractive}` : ''}`}
      aria-label={interactive ? 'Roll D12 chapter dice' : 'D12 face navigator'}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? (event) => {
        event.stopPropagation();
        onClick?.();
      } : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onClick?.();
      } : undefined}
    >
      <div ref={mountRef} className={styles.d12Canvas} aria-hidden="true" />
    </aside>
  );
}

function updateTargetQuaternion(
  currentFaceIndex: number,
  faces: PentagonFace[],
  targetQuaternionRef: MutableRefObject<THREE.Quaternion>,
) {
  targetQuaternionRef.current = getFaceQuaternion(currentFaceIndex, faces);
}

function getFaceQuaternion(currentFaceIndex: number, faces: PentagonFace[]) {
  const face = faces.find((item) => item.faceIndex === currentFaceIndex);
  const normal = face?.normal ?? new THREE.Vector3(...(DODECAHEDRON_FACES[currentFaceIndex]?.normal ?? [0, 0, 1])).normalize();
  return new THREE.Quaternion().setFromUnitVectors(normal, FRONT_NORMAL);
}

function easeInOutQuint(value: number) {
  return value < 0.5
    ? 16 * value * value * value * value * value
    : 1 - ((-2 * value + 2) ** 5) / 2;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

function getRollAxis(signal: number, faceIndex: number, salt: number) {
  const seed = (Math.imul(signal + 17, 73856093) ^ Math.imul(faceIndex + 31, 19349663) ^ Math.imul(salt + 7, 83492791)) >>> 0;
  const angle = ((seed % 360) * Math.PI) / 180;
  const z = (((seed >>> 9) % 120) - 60) / 100;
  return new THREE.Vector3(
    Math.cos(angle),
    Math.sin(angle),
    z,
  ).normalize();
}

function getRollTurns(signal: number, faceIndex: number, salt: number, minTurns: number, turnSpread: number) {
  const seed = (Math.imul(signal + 43, 2654435761) ^ Math.imul(faceIndex + 19, 1597334677) ^ Math.imul(salt + 11, 3812015801)) >>> 0;
  const direction = (seed & 1) === 0 ? 1 : -1;
  return direction * (minTurns + ((seed >>> 3) % turnSpread));
}

async function loadChapterImages(
  visualMode: D12VisualMode,
): Promise<ChapterImageMap> {
  const entries = await Promise.all(
    DODECAHEDRON_EDGE_CHAPTERS.map(async (chapterId) => {
      const chapter = CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0];
      const src = visualMode === 'numbers'
        ? assetPath(d12ChapterNumberAssets[chapterId].src)
        : assetPath(chapter.src);
      const image = await loadImage(src);
      return [chapterId, image] as const;
    }),
  );

  return entries.reduce((images, [chapterId, image]) => {
    images[chapterId] = image;
    return images;
  }, {} as ChapterImageMap);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const cached = d12ImagePromiseCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
  d12ImagePromiseCache.set(src, promise);
  return promise;
}

function createPentagonFaces(radius: number): PentagonFace[] {
  const normals = DODECAHEDRON_FACES.map((face) => new THREE.Vector3(...face.normal).normalize());
  const planeOffset = 1;
  const rawVertices = createDodecahedronVertices(normals, planeOffset);
  const scale = radius / Math.max(...rawVertices.map((vertex) => vertex.point.length()));

  return DODECAHEDRON_FACES.map((face) => {
    const normal = normals[face.faceIndex];
    const vertices = rawVertices
      .filter((vertex) => vertex.faceIndices.includes(face.faceIndex))
      .map((vertex) => ({
        point: vertex.point.clone().multiplyScalar(scale),
        faceIndices: vertex.faceIndices,
      }));
    const center = vertices.reduce(
      (sum, vertex) => sum.add(vertex.point),
      new THREE.Vector3(),
    ).multiplyScalar(1 / vertices.length);
    const orderedVertices = orderPentagonVertices(vertices, center, normal);
    const orderedPoints = orderedVertices.map((vertex) => vertex.point);
    const geometry = createFaceGeometry(center, orderedPoints);
    const edgeMappings = getPhysicalEdgeMappings(face.faceIndex, orderedVertices);

    return {
      faceIndex: face.faceIndex,
      center,
      normal: normal.clone(),
      vertices: orderedPoints,
      edgeMappings,
      geometry,
    };
  });
}

function createDodecahedronVertices(normals: THREE.Vector3[], planeOffset: number): RawDodecahedronVertex[] {
  const vertices: RawDodecahedronVertex[] = [];
  const epsilon = 1e-5;

  for (let a = 0; a < normals.length - 2; a += 1) {
    for (let b = a + 1; b < normals.length - 1; b += 1) {
      for (let c = b + 1; c < normals.length; c += 1) {
        const point = intersectPlanes(normals[a], normals[b], normals[c], planeOffset);
        if (!point) continue;
        const inside = normals.every((normal) => normal.dot(point) <= planeOffset + epsilon);
        if (!inside) continue;
        const faceIndices = normals
          .map((normal, index) => (Math.abs(normal.dot(point) - planeOffset) < 1e-4 ? index : -1))
          .filter((index) => index >= 0);
        if (faceIndices.length !== 3) continue;
        const key = point.toArray().map((value) => value.toFixed(5)).join(',');
        const exists = vertices.some((vertex) => (
          vertex.point.toArray().map((value) => value.toFixed(5)).join(',') === key
        ));
        if (!exists) {
          vertices.push({ point, faceIndices });
        }
      }
    }
  }

  return vertices;
}

function intersectPlanes(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, offset: number) {
  const denominator = a.dot(new THREE.Vector3().crossVectors(b, c));
  if (Math.abs(denominator) < 1e-8) return null;

  return new THREE.Vector3()
    .add(new THREE.Vector3().crossVectors(b, c).multiplyScalar(offset))
    .add(new THREE.Vector3().crossVectors(c, a).multiplyScalar(offset))
    .add(new THREE.Vector3().crossVectors(a, b).multiplyScalar(offset))
    .multiplyScalar(1 / denominator);
}

function orderPentagonVertices(vertices: RawDodecahedronVertex[], center: THREE.Vector3, normal: THREE.Vector3) {
  const worldUp = Math.abs(normal.dot(new THREE.Vector3(0, 1, 0))) > 0.92
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const axisY = worldUp.clone().projectOnPlane(normal).normalize();
  const axisX = new THREE.Vector3().crossVectors(axisY, normal).normalize();

  return [...vertices].sort((a, b) => {
    const aOffset = new THREE.Vector3().subVectors(a.point, center);
    const bOffset = new THREE.Vector3().subVectors(b.point, center);
    const aAngle = Math.atan2(aOffset.dot(axisY), aOffset.dot(axisX));
    const bAngle = Math.atan2(bOffset.dot(axisY), bOffset.dot(axisX));
    return aAngle - bAngle;
  });
}

function getPhysicalEdgeMappings(faceIndex: number, vertices: RawDodecahedronVertex[]): EdgeMapping[] {
  const face = DODECAHEDRON_FACES[faceIndex] ?? DODECAHEDRON_FACES[0];

  return vertices.map((vertex, edgeIndex) => {
    const next = vertices[(edgeIndex + 1) % vertices.length];
    const sharedFaceIndices = vertex.faceIndices.filter((index) => next.faceIndices.includes(index));
    const neighborFaceIndex = sharedFaceIndices.find((index) => index !== faceIndex);
    const chapter = DODECAHEDRON_EDGE_CHAPTERS.find((candidate) => (
      face.neighbors[candidate] === neighborFaceIndex
    ));

    if (!chapter) {
      throw new Error(`D12 face ${faceIndex} edge ${edgeIndex} does not map to a chapter`);
    }

    if (neighborFaceIndex === undefined) {
      throw new Error(`D12 face ${faceIndex} edge ${edgeIndex} has no neighboring face`);
    }

    return {
      chapter,
      neighborFaceIndex,
      sourceSideSign: getCanonicalEdgeDirectionSign(vertex.point, next.point),
    };
  });
}

function getCanonicalEdgeDirectionSign(a: THREE.Vector3, b: THREE.Vector3): 1 | -1 {
  return getVertexKey(a) < getVertexKey(b) ? 1 : -1;
}

function getVertexKey(point: THREE.Vector3) {
  return point.toArray().map((value) => value.toFixed(5)).join(',');
}

function createFaceGeometry(center: THREE.Vector3, vertices: THREE.Vector3[]) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const texturePoints = createTexturePentagonPoints();
  const centerUv = [0.5, 0.5];

  for (let index = 0; index < vertices.length; index += 1) {
    const nextIndex = (index + 1) % vertices.length;
    positions.push(center.x, center.y, center.z);
    positions.push(vertices[index].x, vertices[index].y, vertices[index].z);
    positions.push(vertices[nextIndex].x, vertices[nextIndex].y, vertices[nextIndex].z);

    uvs.push(centerUv[0], centerUv[1]);
    uvs.push(texturePoints[index].x / TEXTURE_SIZE, 1 - texturePoints[index].y / TEXTURE_SIZE);
    uvs.push(texturePoints[nextIndex].x / TEXTURE_SIZE, 1 - texturePoints[nextIndex].y / TEXTURE_SIZE);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function createDodecahedronFillGeometry(faces: PentagonFace[]) {
  const positions: number[] = [];

  faces.forEach((face) => {
    const position = face.geometry.getAttribute('position');
    for (let index = 0; index < position.count; index += 1) {
      positions.push(
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createFaceTexture(images: ChapterImageMap, edgeMappings: EdgeMapping[], visualMode: D12VisualMode) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);

  const points = createTexturePentagonPoints();
  context.fillStyle = '#fff';
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.save();
  drawPentagonPath(context, points);
  context.clip();
  context.fillStyle = '#fff';
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  if (visualMode === 'numbers') {
    drawChapterNumberImages(context, images, edgeMappings, points);
  } else {
    drawChapterImages(context, images, edgeMappings, points);
  }
  context.fillStyle = '#000';
  context.beginPath();
  context.arc(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, 18, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function drawChapterNumberImages(
  context: CanvasRenderingContext2D,
  images: ChapterImageMap,
  edgeMappings: EdgeMapping[],
  points: TexturePoint[],
) {
  edgeMappings.forEach((mapping, index) => {
    const image = images[mapping.chapter];
    if (!image) return;
    const slot = getCrossEdgeSlot(points, index, 'numbers', mapping.sourceSideSign);
    drawImageHalfAcrossEdge(context, image, slot);
  });
}

function createTexturePentagonPoints() {
  const center = { x: TEXTURE_SIZE / 2, y: TEXTURE_SIZE / 2 };
  const radius = TEXTURE_SIZE * 0.445;
  return TEXTURE_VERTEX_ANGLES.map((angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    };
  });
}

function drawPentagonPath(context: CanvasRenderingContext2D, points: TexturePoint[]) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.closePath();
}

function drawChapterImages(
  context: CanvasRenderingContext2D,
  images: ChapterImageMap,
  edgeMappings: EdgeMapping[],
  points: TexturePoint[],
) {
  edgeMappings.forEach((mapping, index) => {
    const image = images[mapping.chapter];
    if (!image) return;
    const slot = getCrossEdgeSlot(points, index, 'chapters', mapping.sourceSideSign);
    drawImageHalfAcrossEdge(context, image, slot);
  });
}

function getCrossEdgeSlot(
  points: TexturePoint[],
  edgeIndex: number,
  visualMode: D12VisualMode,
  sourceSideSign: 1 | -1,
): EdgeSlot {
  const center = { x: TEXTURE_SIZE / 2, y: TEXTURE_SIZE / 2 };
  const a = points[edgeIndex];
  const b = points[(edgeIndex + 1) % points.length];
  const midpoint = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
  const edgeVector = {
    x: b.x - a.x,
    y: b.y - a.y,
  };
  const edgeLength = Math.max(1, Math.hypot(edgeVector.x, edgeVector.y));
  const tangent = {
    x: edgeVector.x / edgeLength,
    y: edgeVector.y / edgeLength,
  };
  const inwardRaw = {
    x: center.x - midpoint.x,
    y: center.y - midpoint.y,
  };
  const inwardLength = Math.max(1, Math.hypot(inwardRaw.x, inwardRaw.y));
  const inward = {
    x: inwardRaw.x / inwardLength,
    y: inwardRaw.y / inwardLength,
  };
  const seamInset = visualMode === 'numbers' ? 10 : 8;
  const innerOffset = visualMode === 'numbers' ? 525 : 585;
  const outerHalf = edgeLength * (visualMode === 'numbers' ? 0.46 : 0.48);
  const innerHalf = edgeLength * (visualMode === 'numbers' ? 0.215 : 0.235);
  const outerCenter = {
    x: midpoint.x + inward.x * seamInset,
    y: midpoint.y + inward.y * seamInset,
  };
  const innerCenter = {
    x: midpoint.x + inward.x * innerOffset,
    y: midpoint.y + inward.y * innerOffset,
  };

  return {
    seam: {
      x: midpoint.x + inward.x * seamInset,
      y: midpoint.y + inward.y * seamInset,
    },
    tangent,
    inward,
    maxEdgeLength: edgeLength * (visualMode === 'numbers' ? 0.8 : 0.88),
    maxFaceDepth: edgeLength * (visualMode === 'numbers' ? 0.38 : 0.47),
    sourceSideSign,
    clipPoints: [
      {
        x: outerCenter.x - tangent.x * outerHalf,
        y: outerCenter.y - tangent.y * outerHalf,
      },
      {
        x: outerCenter.x + tangent.x * outerHalf,
        y: outerCenter.y + tangent.y * outerHalf,
      },
      {
        x: innerCenter.x + tangent.x * innerHalf,
        y: innerCenter.y + tangent.y * innerHalf,
      },
      {
        x: innerCenter.x - tangent.x * innerHalf,
        y: innerCenter.y - tangent.y * innerHalf,
      },
    ],
  };
}

function drawImageHalfAcrossEdge(context: CanvasRenderingContext2D, image: HTMLImageElement, slot: EdgeSlot) {
  const contentBox = getImageContentBox(image);
  const naturalWidth = Math.max(1, image.naturalWidth);
  const naturalHeight = Math.max(1, image.naturalHeight);
  const sourceCenterX = naturalWidth / 2;
  const sourceCenterY = naturalHeight / 2;
  const contentLeft = contentBox.sx;
  const contentRight = contentBox.sx + contentBox.sw;
  const contentAlongEdge = Math.max(
    1,
    Math.max(Math.abs(contentLeft - sourceCenterX), Math.abs(contentRight - sourceCenterX)) * 2,
  );
  const contentTopDepth = Math.max(0, sourceCenterY - contentBox.sy);
  const contentBottomDepth = Math.max(0, contentBox.sy + contentBox.sh - sourceCenterY);
  const contentFaceDepth = Math.max(1, contentTopDepth, contentBottomDepth);
  const scale = Math.min(
    slot.maxEdgeLength / contentAlongEdge,
    slot.maxFaceDepth / contentFaceDepth,
  );
  const sourceY = slot.sourceSideSign > 0 ? sourceCenterY : 0;
  const sourceHeight = slot.sourceSideSign > 0 ? naturalHeight - sourceCenterY : sourceCenterY;
  const axisSign = slot.sourceSideSign;

  context.save();
  drawPentagonPath(context, slot.clipPoints);
  context.clip();
  context.transform(
    slot.tangent.x * axisSign * scale,
    slot.tangent.y * axisSign * scale,
    slot.inward.x * axisSign * scale,
    slot.inward.y * axisSign * scale,
    slot.seam.x - (slot.tangent.x * axisSign * scale * sourceCenterX) - (slot.inward.x * axisSign * scale * sourceCenterY),
    slot.seam.y - (slot.tangent.y * axisSign * scale * sourceCenterX) - (slot.inward.y * axisSign * scale * sourceCenterY),
  );
  context.drawImage(
    image,
    0,
    sourceY,
    naturalWidth,
    sourceHeight,
    0,
    sourceY,
    naturalWidth,
    sourceHeight,
  );
  context.restore();
}

function getImageContentBox(image: HTMLImageElement): ImageContentBox {
  const cached = d12ImageContentBoxCache.get(image);
  if (cached) return cached;

  const probeMaxSize = 620;
  const naturalWidth = Math.max(1, image.naturalWidth);
  const naturalHeight = Math.max(1, image.naturalHeight);
  const probeScale = Math.min(1, probeMaxSize / Math.max(naturalWidth, naturalHeight));
  const probeWidth = Math.max(1, Math.round(naturalWidth * probeScale));
  const probeHeight = Math.max(1, Math.round(naturalHeight * probeScale));
  const canvas = document.createElement('canvas');
  canvas.width = probeWidth;
  canvas.height = probeHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return {
      sx: 0,
      sy: 0,
      sw: naturalWidth,
      sh: naturalHeight,
    };
  }

  context.drawImage(image, 0, 0, probeWidth, probeHeight);
  const data = context.getImageData(0, 0, probeWidth, probeHeight).data;
  let minX = probeWidth;
  let minY = probeHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < probeHeight; y += 1) {
    for (let x = 0; x < probeWidth; x += 1) {
      const index = (y * probeWidth + x) * 4;
      const alpha = data[index + 3];
      if (alpha <= 8) continue;
      const luma = (data[index] + data[index + 1] + data[index + 2]) / 3;
      if (luma >= 246) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      sx: 0,
      sy: 0,
      sw: naturalWidth,
      sh: naturalHeight,
    };
  }

  const pad = Math.max(10, Math.round(Math.max(maxX - minX, maxY - minY) * 0.035));
  const sx = Math.max(0, Math.floor((minX - pad) / probeScale));
  const sy = Math.max(0, Math.floor((minY - pad) / probeScale));
  const ex = Math.min(naturalWidth, Math.ceil((maxX + pad + 1) / probeScale));
  const ey = Math.min(naturalHeight, Math.ceil((maxY + pad + 1) / probeScale));
  const box = {
    sx,
    sy,
    sw: Math.max(1, ex - sx),
    sh: Math.max(1, ey - sy),
  };
  d12ImageContentBoxCache.set(image, box);
  return box;
}
