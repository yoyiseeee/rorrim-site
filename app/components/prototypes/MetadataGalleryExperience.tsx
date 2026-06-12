'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './MetadataGalleryExperience.module.css';
import { metadataGalleryImages } from './metadataGalleryImages';

const PAGE_STEP_MS = 1000;
const PAGE_ENTER_MS = 620;
const TOGGLE_READY_BUFFER_MS = 420;

type MetadataPageLayout = {
  stackX: string;
  stackY: string;
  stackR: string;
  spreadX: string;
  spreadY: string;
  spreadR: string;
  fromX: string;
  fromY: string;
};

function seededUnit(index: number, salt: number) {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function buildPageLayout(index: number): MetadataPageLayout {
  const direction = index % 4;
  const fromX = direction === 0 ? '-72vw' : direction === 1 ? '72vw' : `${-18 + seededUnit(index, 1) * 36}vw`;
  const fromY = direction === 2 ? '-72vh' : direction === 3 ? '72vh' : `${-16 + seededUnit(index, 2) * 32}vh`;
  const stackX = `${-7.5 + seededUnit(index, 3) * 15}vw`;
  const stackY = `${-5.5 + seededUnit(index, 4) * 11}vh`;
  const stackR = `${-4.2 + seededUnit(index, 5) * 8.4}deg`;
  const col = index % 6;
  const row = Math.floor(index / 6);
  const spreadX = `${-39 + col * 15.6}vw`;
  const spreadY = `${-34 + row * 13.2}vh`;
  const spreadR = '0deg';

  return {
    stackX,
    stackY,
    stackR,
    spreadX,
    spreadY,
    spreadR,
    fromX,
    fromY,
  };
}

export default function MetadataGalleryExperience({ onBack }: { onBack: () => void }) {
  const [ready, setReady] = useState(false);
  const [spread, setSpread] = useState(false);
  const pageLayouts = useMemo(() => metadataGalleryImages.map((_, index) => buildPageLayout(index)), []);

  useEffect(() => {
    metadataGalleryImages.forEach((image) => {
      const preloader = new Image();
      preloader.decoding = 'async';
      preloader.src = image.src;
    });
  }, []);

  useEffect(() => {
    const readyTimer = window.setTimeout(
      () => {
        setReady(true);
        setSpread(true);
      },
      (metadataGalleryImages.length - 1) * PAGE_STEP_MS + PAGE_ENTER_MS + TOGGLE_READY_BUFFER_MS,
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onBack]);

  return (
    <section className={styles.metadataGallery} aria-label="Meta-Data image sequence">
      <div className={styles.metadataStatus} aria-hidden="true">
        <span>Meta-Data</span>
        <span>{spread ? 'spread order' : 'stack order'} / {metadataGalleryImages.length} pages</span>
      </div>
      <div className={`${styles.metadataStage}${spread ? ` ${styles.spread}` : ready ? ` ${styles.stacked}` : ''}`}>
        {metadataGalleryImages.map((image, index) => {
          const layout = pageLayouts[index];
          return (
            <img
              key={image.id}
              src={image.src}
              alt=""
              aria-hidden="true"
              className={styles.metadataPage}
              style={{
                '--enter-delay': `${index * PAGE_STEP_MS}ms`,
                '--from-x': layout.fromX,
                '--from-y': layout.fromY,
                '--stack-x': layout.stackX,
                '--stack-y': layout.stackY,
                '--stack-r': layout.stackR,
                '--spread-x': layout.spreadX,
                '--spread-y': layout.spreadY,
                '--spread-r': layout.spreadR,
                zIndex: index + 1,
              } as CSSProperties}
              draggable={false}
            />
          );
        })}
      </div>
      <button
        type="button"
        className={`${styles.metadataToggle}${ready ? ` ${styles.metadataToggleReady}` : ''}`}
        onClick={() => setSpread((current) => !current)}
        aria-label={spread ? 'Stack Meta-Data pages' : 'Spread Meta-Data pages'}
      />
    </section>
  );
}
