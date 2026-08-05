import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { GAME_CONFIG, HEROES, PEDESTAL_POSITIONS } from '../config/gameConfig';
import type { HeroId, HeroState } from '../types/game';
import { AtlasSprite } from './AtlasSprite';

export function HeroPedestal({ slot, hero, onLevel, onMove, draggingHero, dropTarget, onDragChange }: {
  slot: number;
  hero?: HeroState;
  onLevel: (id: HeroId) => void;
  onMove: (id: HeroId, toSlot: number) => void;
  draggingHero: HeroId | null;
  dropTarget: boolean;
  onDragChange: (drag: { heroId: HeroId; overSlot: number | null } | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const moved = useRef(false);
  const ready = hero ? hero.xp >= GAME_CONFIG.hero.xpToLevel(hero.level) : false;
  const position = PEDESTAL_POSITIONS[slot];

  const findDropSlot = (clientX: number, clientY: number) => {
    const pedestal = document.elementsFromPoint(clientX, clientY)
      .map((element) => element.closest<HTMLElement>('[data-slot]'))
      .find((element) => element && Number(element.dataset.slot) !== slot);
    return pedestal ? Number(pedestal.dataset.slot) : null;
  };

  const pointerDown = (event: React.PointerEvent) => {
    if (!hero) return;
    moved.current = false;
    dragOrigin.current = { x: event.clientX, y: event.clientY };
    setDragOffset({ x: 0, y: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    onDragChange({ heroId: hero.id, overSlot: null });
  };
  const pointerMove = (event: React.PointerEvent) => {
    if (!dragging || !hero) return;
    const x = event.clientX - dragOrigin.current.x;
    const y = event.clientY - dragOrigin.current.y;
    if (Math.hypot(x, y) > 6) moved.current = true;
    setDragOffset({ x, y });
    onDragChange({ heroId: hero.id, overSlot: findDropSlot(event.clientX, event.clientY) });
  };
  const finishDrag = (clientX: number, clientY: number) => {
    if (!hero || !draggingRef.current) return;
    draggingRef.current = false;
    const targetSlot = findDropSlot(clientX, clientY);
    if (targetSlot !== null && moved.current) onMove(hero.id, targetSlot);
    else if (!moved.current && ready) onLevel(hero.id);
    setDragging(false);
    setDragOffset({ x: 0, y: 0 });
    onDragChange(null);
  };
  const pointerUp = (event: React.PointerEvent) => finishDrag(event.clientX, event.clientY);
  const pointerCancel = () => {
    draggingRef.current = false;
    setDragging(false);
    setDragOffset({ x: 0, y: 0 });
    onDragChange(null);
  };

  useEffect(() => {
    if (!dragging) return;
    const finishOutsideButton = (event: PointerEvent) => finishDrag(event.clientX, event.clientY);
    window.addEventListener('pointerup', finishOutsideButton);
    window.addEventListener('blur', pointerCancel);
    return () => {
      window.removeEventListener('pointerup', finishOutsideButton);
      window.removeEventListener('blur', pointerCancel);
    };
  });

  return (
    <div className={`pedestal slot-${slot} ${hero ? 'occupied' : ''} ${ready ? 'level-ready' : ''} ${dragging ? 'dragging' : ''} ${draggingHero && draggingHero !== hero?.id ? 'drop-available' : ''} ${dropTarget ? 'drop-target' : ''}`} data-slot={slot} style={{ left: `${position.x}%`, top: `${position.y}%` }}>
      {hero && (
        <button
          className="arena-hero"
          style={{ '--drag-x': `${dragOffset.x}px`, '--drag-y': `${dragOffset.y}px` } as CSSProperties}
          aria-label={`${HEROES[hero.id].name} on pedestal ${slot + 1}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
        >
          <AtlasSprite atlas="heroArena" index={HEROES[hero.id].atlasIndex} />
          <div className="hero-progress">
            <span className="hero-level">{hero.level}</span>
            <i style={{ width: `${Math.min(100, hero.xp / GAME_CONFIG.hero.xpToLevel(hero.level) * 100)}%` }} />
            {ready && <b className="level-arrow"><i /></b>}
          </div>
        </button>
      )}
    </div>
  );
}
