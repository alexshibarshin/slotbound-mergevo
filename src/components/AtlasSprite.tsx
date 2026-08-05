import type { CSSProperties } from 'react';

type Atlas = 'heroPortrait' | 'heroArena' | 'king' | 'enemy' | 'vfx' | 'ui';

export function AtlasSprite({ atlas, index, className = '', style }: {
  atlas: Atlas;
  index: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={`atlas atlas-${atlas} atlas-${index} ${className}`} style={style} aria-hidden="true" />;
}
