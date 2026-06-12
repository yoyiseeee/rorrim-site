'use client';

/* eslint-disable @next/next/no-img-element */

import { CSSProperties, useEffect, useRef, useState } from 'react';

type ChapterId = 'alphabet' | 'noclipping' | 'dimension' | 'paradox' | 'noise';
type VisibleDirection = 'up' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'left';
type HiddenDirection = 'down' | 'right' | 'topLeft';
type Direction = VisibleDirection | HiddenDirection;

const VISIBLE_DIRECTIONS: VisibleDirection[] = ['up', 'topRight', 'bottomRight', 'bottomLeft', 'left'];
const HIDDEN_DIRECTIONS: HiddenDirection[] = ['down', 'right', 'topLeft'];
const ALL_DIRECTIONS: Direction[] = [...VISIBLE_DIRECTIONS, ...HIDDEN_DIRECTIONS];

const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  up:          [ 0, -1],
  topRight:    [+1, -1],
  bottomRight: [+1, +1],
  bottomLeft:  [-1, +1],
  left:        [-1,  0],
  down:        [ 0, +1],
  right:       [+1,  0],
  topLeft:     [-1, -1],
};

// Slot positions inside any cell — fixed by slot direction, not by chapter identity
const SLOT_PLACEMENTS: Record<VisibleDirection, CSSProperties> = {
  up:          { top: '4px', left: '50%', width: 'min(32.3vw, 57.4vh)', transform: 'translateX(-50%)' },
  topRight:    { top: 'clamp(4px, 7vh, 116px)', right: '4px', width: 'min(19.7vw, 35vh)' },
  bottomRight: { right: '4px', bottom: '4px', width: 'min(20.3vw, 36vh)' },
  bottomLeft:  { left: '4px', bottom: '4px', width: 'min(30.7vw, 55vh)' },
  left:        { top: 'clamp(4px, 8vh, 88px)', left: '4px', width: 'min(12.8vw, 22vh)' },
};

const CHAPTER_SRCS: Record<ChapterId, string> = {
  alphabet:   '/chapter/rorrim_1%20Alphabet.png',
  noclipping: '/chapter/rorrim_2%20Noclipping.png',
  dimension:  '/chapter/rorrim_3%20Dimension.png',
  paradox:    '/chapter/rorrim_4%20Paradox.png',
  noise:      '/chapter/rorrim_5%20Noise.png',
};

const CHAPTER_LABELS: Record<ChapterId, string> = {
  alphabet:   'Alphabet',
  noclipping: 'Noclipping',
  dimension:  'Dimension',
  paradox:    'Paradox',
  noise:      'Noise',
};

const ALL_CHAPTERS: ChapterId[] = ['alphabet', 'noclipping', 'dimension', 'paradox', 'noise'];

const HOME_ASSIGNMENTS: Record<VisibleDirection, ChapterId> = {
  up:          'alphabet',
  topRight:    'noclipping',
  bottomRight: 'dimension',
  bottomLeft:  'paradox',
  left:        'noise',
};

const HOVER_ZONE = 180;
const HOVER_MAX_OFFSET = 80;
const DRAG_THRESHOLD = 120;
const INITIAL_OFFSET_Y = 120;

type Cell = {
  cx: number;
  cy: number;
  assignments: Partial<Record<VisibleDirection, ChapterId>>;
};

function cellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function makeRichAssignments(cx: number, cy: number): Record<VisibleDirection, ChapterId> {
  if (cx === 0 && cy === 0) return { ...HOME_ASSIGNMENTS };
  const seed = (Math.imul(cx + 0x10000, 73856093) ^ Math.imul(cy + 0x10000, 19349663)) >>> 0;
  const order = seededShuffle(ALL_CHAPTERS, seed);
  return {
    up:          order[0],
    topRight:    order[1],
    bottomRight: order[2],
    bottomLeft:  order[3],
    left:        order[4],
  };
}

// Populate (cx, cy) + its 8 neighbors into the map. Visible-direction neighbors
// are rich (5 chapter PNGs); hidden-direction neighbors are blank passages.
// Deterministic and idempotent — re-entering a cell preserves its content.
function populateNeighbors(map: Map<string, Cell>, cx: number, cy: number): boolean {
  let added = false;
  const ensureCell = (ccx: number, ccy: number, assignments: Cell['assignments']) => {
    const key = cellKey(ccx, ccy);
    if (map.has(key)) return;
    map.set(key, { cx: ccx, cy: ccy, assignments });
    added = true;
  };
  // Center
  ensureCell(
    cx, cy,
    (cx === 0 && cy === 0) ? { ...HOME_ASSIGNMENTS } : makeRichAssignments(cx, cy),
  );
  for (const dir of ALL_DIRECTIONS) {
    const [vx, vy] = DIRECTION_VECTORS[dir];
    const ncx = cx + vx;
    const ncy = cy + vy;
    const isVisible = (VISIBLE_DIRECTIONS as Direction[]).includes(dir);
    const assignments: Cell['assignments'] =
      (ncx === 0 && ncy === 0)
        ? { ...HOME_ASSIGNMENTS }
        : isVisible
          ? makeRichAssignments(ncx, ncy)
          : {};
    ensureCell(ncx, ncy, assignments);
  }
  return added;
}

export default function HomeLanding({ onOpenMirror }: { onOpenMirror?: () => void }) {
  const [homeBaseY, setHomeBaseY]       = useState(INITIAL_OFFSET_Y);
  const [cameraCx, setCameraCx]         = useState(0);
  const [cameraCy, setCameraCy]         = useState(0);
  const [dragDX, setDragDX]             = useState(0);
  const [dragDY, setDragDY]             = useState(0);
  const [isDragging, setIsDragging]     = useState(false);
  const [topHover, setTopHover]         = useState(false);
  const [parallaxX, setParallaxX]       = useState(0);
  const [parallaxY, setParallaxY]       = useState(0);
  const [transition, setTransition]     = useState('transform 500ms cubic-bezier(0.25, 1, 0.5, 1)');
  const [lastEntryChapter, setLastEntryChapter] = useState<ChapterId | null>(null);
  const [alphabetOverlay, setAlphabetOverlay]   = useState(false);
  const [cells, setCells] = useState<Map<string, Cell>>(() => {
    const m = new Map<string, Cell>();
    populateNeighbors(m, 0, 0);
    return m;
  });

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startDX: number;
    startDY: number;
  } | null>(null);

  const isAtHome = cameraCx === 0 && cameraCy === 0;

  // 3x3 window around current camera
  const windowCells: Cell[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cell = cells.get(cellKey(cameraCx + dx, cameraCy + dy));
      if (cell) windowCells.push(cell);
    }
  }

  useEffect(() => {
    if (!alphabetOverlay) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data === 'closeAlphabetOverlay') setAlphabetOverlay(false);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [alphabetOverlay]);

  const dragToDirection = (dx: number, dy: number): Direction | null => {
    const xHit = Math.abs(dx) >= DRAG_THRESHOLD;
    const yHit = Math.abs(dy) >= DRAG_THRESHOLD;
    if (!xHit && !yHit) return null;
    const xPos = dx > 0;
    const yPos = dy > 0;
    if (xHit && yHit) {
      // Diagonal — camera moves opposite of drag vector
      if ( xPos &&  yPos) return 'topLeft';     // SE drag (hidden)
      if ( xPos && !yPos) return 'bottomLeft';  // NE drag → paradox
      if (!xPos && !yPos) return 'bottomRight'; // NW drag → dimension
      return 'topRight';                         // SW drag → noclipping
    }
    if (xHit) return xPos ? 'left' : 'right';   // right drag → noise; left drag (hidden)
    return yPos ? 'up' : 'down';                 // down drag → alphabet; up drag (hidden)
  };

  const snapToDirection = (direction: Direction) => {
    const [vx, vy] = DIRECTION_VECTORS[direction];
    const newCx = cameraCx + vx;
    const newCy = cameraCy + vy;
    const cur = cells.get(cellKey(cameraCx, cameraCy));
    const entered = (cur?.assignments?.[direction as VisibleDirection] as ChapterId | undefined) ?? null;
    setCells(prev => {
      const next = new Map(prev);
      const added = populateNeighbors(next, newCx, newCy);
      return added ? next : prev;
    });
    setParallaxX(0);
    setParallaxY(0);
    setTopHover(false);
    setTransition('transform 700ms cubic-bezier(0.16, 1, 0.3, 1)');
    setDragDX(0);
    setDragDY(0);
    setCameraCx(newCx);
    setCameraCy(newCy);
    setLastEntryChapter(newCx === 0 && newCy === 0 ? null : entered);
  };

  const snapBack = () => {
    setTransition('transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)');
    setDragDX(0);
    setDragDY(0);
  };

  const homeYOffset = isAtHome
    ? homeBaseY + (topHover && !isDragging ? HOVER_MAX_OFFSET : 0)
    : 0;
  const stageTransform =
    `translate(calc(${-cameraCx * 100}vw + ${dragDX}px), calc(${-cameraCy * 100}vh + ${homeYOffset + dragDY}px))`;

  return (
    <main
      className="static-home-viewport"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragRef.current = {
          startX:  event.clientX,
          startY:  event.clientY,
          startDX: dragDX,
          startDY: dragDY,
        };
        setIsDragging(true);
        setTopHover(false);
        setTransition('none');
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) {
          if (isDragging) return;
          if (!isAtHome) return;
          setTransition('transform 600ms cubic-bezier(0.25, 1, 0.5, 1)');
          setTopHover(event.clientY < HOVER_ZONE);
          return;
        }
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        setDragDX(Math.max(-vw, Math.min(vw, drag.startDX + dx)));
        setDragDY(Math.max(-vh, Math.min(vh, drag.startDY + dy)));
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        dragRef.current = null;
        setIsDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);

        // Pure tap
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          if (!isAtHome) {
            snapBack();
            return;
          }
          setTransition('transform 600ms cubic-bezier(0.25, 1, 0.5, 1)');
          setDragDX(0);
          setDragDY(0);
          setTopHover(event.clientY < HOVER_ZONE);
          return;
        }

        const dir = dragToDirection(dx, dy);
        if (dir) snapToDirection(dir);
        else     snapBack();
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setIsDragging(false);
        snapBack();
      }}
      onPointerLeave={() => {
        setParallaxX(0);
        setParallaxY(0);
        if (dragRef.current) return;
        setTopHover(false);
        setTransition('transform 600ms cubic-bezier(0.25, 1, 0.5, 1)');
        setDragDX(0);
        setDragDY(0);
      }}
      onWheel={(event) => {
        if (!isAtHome || dragRef.current) return;
        event.preventDefault();
        const delta = event.deltaY > 0 ? -20 : 20;
        const newBase = Math.max(0, Math.min(INITIAL_OFFSET_Y, homeBaseY + delta));
        setHomeBaseY(newBase);
        setTransition('transform 300ms cubic-bezier(0.25, 1, 0.5, 1)');
        setTopHover(false);
      }}
      onMouseMove={(event) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        setParallaxX(((event.clientX - cx) / cx) * 8);
        setParallaxY(((event.clientY - cy) / cy) * 8);
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${parallaxX}px, ${parallaxY}px)`,
          transition: 'transform 100ms ease-out',
        }}
      >
        <section
          className="static-home-stage"
          style={{
            transform: stageTransform,
            transition,
          }}
        >
          {windowCells.map((cell) => (
            <CellLayer
              key={cellKey(cell.cx, cell.cy)}
              cell={cell}
              isHome={cell.cx === 0 && cell.cy === 0}
            />
          ))}
        </section>
      </div>

      <button
        aria-label="Open mirror home"
        onPointerDown={(event) => { event.stopPropagation(); }}
        onPointerUp={(event)   => { event.stopPropagation(); }}
        onClick={(event) => {
          event.stopPropagation();
          if (!isAtHome && lastEntryChapter === 'alphabet') {
            setAlphabetOverlay(true);
          } else {
            onOpenMirror?.();
          }
        }}
        style={{
          position: 'fixed',
          left: '50%',
          top: `calc(66.667% + ${homeBaseY - 80}px)`,
          transition: transition.replace('transform', 'top'),
          width: '4mm',
          height: '4mm',
          borderRadius: '999px',
          background: '#000',
          border: 'none',
          padding: 0,
          margin: 0,
          transform: 'translate(-50%, -50%)',
          zIndex: 20,
          cursor: 'pointer',
        }}
      />

      {alphabetOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          <iframe
            src="/alphabet/Mirror Alphabet.html"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      )}
    </main>
  );
}

function CellLayer({ cell, isHome }: { cell: Cell; isHome: boolean }) {
  const slotEntries = Object.entries(cell.assignments) as [VisibleDirection, ChapterId][];
  return (
    <div
      style={{
        position: 'absolute',
        left: `${cell.cx * 100}vw`,
        top:  `${cell.cy * 100}vh`,
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Center Mirror.png — home (0,0) keeps its original mirrorless look */}
      {!isHome && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            background: '#fff',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <img
            className="alphabet-chapter-image"
            src="/Mirror.png"
            alt=""
            draggable={false}
          />
        </div>
      )}

      {/* Chapter title PNGs — fixed slot positions, chapter src is the random part */}
      {slotEntries.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 2,
            overflow: 'visible',
          }}
        >
          {slotEntries.map(([dir, chapterId]) => (
            <img
              key={dir}
              className={`static-home-title${isHome && chapterId === 'alphabet' ? ' static-home-title-alphabet' : ''}`}
              src={CHAPTER_SRCS[chapterId]}
              alt={CHAPTER_LABELS[chapterId]}
              draggable={false}
              style={SLOT_PLACEMENTS[dir]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
