'use client';

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export type Direction = 'up' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'left';
export type ChapterId = 'alphabet' | 'noclipping' | 'dimension' | 'paradox' | 'noise';
export type MirrorLayer = {
  assignments: Partial<Record<Direction, ChapterId>>;
  entryDir: Direction;
};

const ALL_CHAPTERS: ChapterId[] = ['alphabet', 'noclipping', 'dimension', 'paradox', 'noise'];
const ALL_DIRECTIONS: Direction[] = ['up', 'topRight', 'bottomRight', 'bottomLeft', 'left'];

// Which Direction (within the 5 valid entry directions) is the exit for each entryDir.
// null = exit gesture is a special motion not in the Direction type (pure-up, right+down, pure-left).
const OPPOSITE: Record<Direction, Direction | null> = {
  up:          null,          // exit via pure-up drag
  topRight:    'bottomLeft',  // exit via right+up gesture (= bottomLeft gesture)
  bottomRight: null,          // exit via right+down drag
  bottomLeft:  'topRight',    // exit via left+down gesture (= topRight gesture)
  left:        null,          // exit via pure-left drag
};

// ─── generateRandomAssignments ────────────────────────────────────────────────

export function generateRandomAssignments(
  entryDir: Direction,
): Partial<Record<Direction, ChapterId>> {
  const chapters = [...ALL_CHAPTERS];
  for (let i = chapters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
  }
  const exitDir = OPPOSITE[entryDir]; // Direction slot to leave empty (or null = no slot to skip)
  const result: Partial<Record<Direction, ChapterId>> = {};
  let ci = 0;
  for (const dir of ALL_DIRECTIONS) {
    if (dir === exitDir) continue;
    result[dir] = chapters[ci++];
  }
  return result;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const CHAPTER_SRCS: Record<ChapterId, string> = {
  alphabet:   '/chapter/rorrim_1%20Alphabet.png',
  noclipping: '/chapter/rorrim_2%20Noclipping.png',
  dimension:  '/chapter/rorrim_3%20Dimension.png',
  paradox:    '/chapter/rorrim_4%20Paradox.png',
  noise:      '/chapter/rorrim_5%20Noise.png',
};

const DRAG_THRESHOLD = 120;

// Stage translate targets when moving FORWARD into each direction
const FORWARD_TARGETS: Record<Direction, (vw: number, vh: number) => [number, number]> = {
  up:          (vw, vh) => [0,   vh],
  topRight:    (vw, vh) => [-vw, vh],
  bottomRight: (vw, vh) => [-vw, -vh],
  bottomLeft:  (vw, vh) => [vw,  -vh],
  left:        (vw) => [vw,  0],
};

// Stage translate targets when moving BACK (reverse of entry)
const BACK_TARGETS: Record<Direction, (vw: number, vh: number) => [number, number]> = {
  up:          (vw, vh) => [0,   -vh],
  topRight:    (vw, vh) => [vw,  -vh],
  bottomRight: (vw, vh) => [vw,  vh],
  bottomLeft:  (vw, vh) => [-vw, vh],
  left:        (vw) => [-vw, 0],
};

// Chapter PNGs positioned just outside the viewport in each direction.
// They peek into view as the stage moves during drag.
const CHAPTER_WIDTHS: Record<ChapterId, CSSProperties['width']> = {
  alphabet: 'min(32.3vw, 57.4vh)',
  noclipping: 'min(19.7vw, 35vh)',
  dimension: 'min(20.3vw, 36vh)',
  paradox: 'min(30.7vw, 55vh)',
  noise: 'min(12.8vw, 22vh)',
};

const CHAPTER_PLACEMENTS: Record<Direction, CSSProperties> = {
  up: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: 'calc(100% + 120px)',
  },
  topRight: {
    position: 'absolute',
    left: 'calc(100% + 120px)',
    bottom: 'calc(100% + 120px)',
  },
  bottomRight: {
    position: 'absolute',
    left: 'calc(100% + 120px)',
    top: 'calc(100% + 120px)',
  },
  bottomLeft: {
    position: 'absolute',
    right: 'calc(100% + 120px)',
    top: 'calc(100% + 120px)',
  },
  left: {
    position: 'absolute',
    right: 'calc(100% + 120px)',
    top: 'clamp(4px, 8vh, 88px)',
  },
};

// ─── MazeLayer component ──────────────────────────────────────────────────────

export function MazeLayer({
  stack,
  onPush,
  onPop,
}: {
  stack: MirrorLayer[];
  onPush: (layer: MirrorLayer) => void;
  onPop: () => void;
}) {
  const [stageX, setStageX] = useState(0);
  const [stageY, setStageY] = useState(0);
  const [transition, setTransition] = useState('none');
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const busyRef = useRef(false);

  const layer = stack[stack.length - 1];
  const { assignments, entryDir } = layer;

  const snapBack = () => {
    setTransition('transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)');
    setStageX(0);
    setStageY(0);
  };

  const navigateForward = (dir: Direction) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const [tx, ty] = FORWARD_TARGETS[dir](vw, vh);
    setTransition('transform 700ms cubic-bezier(0.16, 1, 0.3, 1)');
    setStageX(tx);
    setStageY(ty);
    const newLayer: MirrorLayer = {
      assignments: generateRandomAssignments(dir),
      entryDir: dir,
    };
    setTimeout(() => {
      setTransition('none');
      setStageX(0);
      setStageY(0);
      onPush(newLayer);
      busyRef.current = false;
    }, 700);
  };

  const navigateBack = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const [tx, ty] = BACK_TARGETS[entryDir](vw, vh);
    setTransition('transform 700ms cubic-bezier(0.16, 1, 0.3, 1)');
    setStageX(tx);
    setStageY(ty);
    setTimeout(() => {
      setTransition('none');
      setStageX(0);
      setStageY(0);
      onPop();
      busyRef.current = false;
    }, 700);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10, touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.button !== 0 || busyRef.current) return;
        dragRef.current = { startX: e.clientX, startY: e.clientY };
        setTransition('none');
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragRef.current || busyRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setStageX(Math.max(-vw, Math.min(vw, dx)));
        setStageY(Math.max(-vh, Math.min(vh, dy)));
      }}
      onPointerUp={(e) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        dragRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (busyRef.current) return;

        const T = DRAG_THRESHOLD;

        // Exit gesture detection — checked before forward to handle shared gestures correctly
        let isExit = false;
        if (entryDir === 'up'          && dy <= -T && Math.abs(dx) < T) isExit = true;
        if (entryDir === 'left'        && dx <= -T && Math.abs(dy) < T) isExit = true;
        if (entryDir === 'bottomRight' && dx >   T && dy >          T)  isExit = true;
        if (entryDir === 'topRight'    && dx >   T && dy <         -T)  isExit = true;
        if (entryDir === 'bottomLeft'  && dx <  -T && dy >          T)  isExit = true;

        if (isExit) { navigateBack(); return; }

        // Forward gesture — same priority order as HomeLanding
        let dir: Direction | null = null;
        if      (dx < -T && dy >  T) dir = 'topRight';
        else if (dx < -T && dy < -T) dir = 'bottomRight';
        else if (dx >  T && dy < -T) dir = 'bottomLeft';
        else if (dx >  T)            dir = 'left';
        else if (dy >= T)            dir = 'up';

        if (dir && assignments[dir]) {
          navigateForward(dir);
        } else {
          snapBack();
        }
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        if (!busyRef.current) snapBack();
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${stageX}px) translateY(${stageY}px)`,
          transition,
        }}
      >
        <img
          src="/Mirror.png"
          alt="Mirror"
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: '#fff',
          }}
        />

        {ALL_DIRECTIONS.map((dir) => {
          const chapterId = assignments[dir];
          if (!chapterId) return null;
          return (
            <img
              key={dir}
              src={CHAPTER_SRCS[chapterId]}
              alt={chapterId}
              draggable={false}
              style={{
                ...CHAPTER_PLACEMENTS[dir],
                width: CHAPTER_WIDTHS[chapterId],
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
