import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { GAME_CONFIG, HEROES, HERO_ORDER } from '../config/gameConfig';
import type { HeroId } from '../types/game';
import { AtlasSprite } from './AtlasSprite';

const REEL_RENDER_OFFSETS = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
const modulo = (value: number, size: number) => ((value % size) + size) % size;

interface InspectionReelState {
  firstHeroIndex: number;
  dragY: number;
  pendingSteps: number;
  settling: boolean;
}

interface ActiveDrag {
  pointerId: number;
  reel: number;
  startY: number;
  rowHeight: number;
}

const initialReels = (): InspectionReelState[] => Array.from({ length: 3 }, () => ({
  firstHeroIndex: 0,
  dragY: 0,
  pendingSteps: 0,
  settling: false,
}));

const xpBackground = (xp: number) => (
  GAME_CONFIG.slot.xpBackgroundTiers.find((tier) => xp >= tier.minXp)?.color
    ?? GAME_CONFIG.slot.xpBackgroundTiers.at(-1)?.color
    ?? '#fff'
);

export function ReelUpgradePreview({ xpByReel }: { xpByReel: number[][] }) {
  const [reels, setReels] = useState(initialReels);
  const activeDrag = useRef<ActiveDrag | null>(null);

  const updateReel = (reel: number, update: (current: InspectionReelState) => InspectionReelState) => {
    setReels((current) => current.map((state, index) => index === reel ? update(state) : state));
  };

  const beginDrag = (reel: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (reels[reel].settling || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDrag.current = {
      pointerId: event.pointerId,
      reel,
      startY: event.clientY,
      rowHeight: event.currentTarget.clientHeight / 3,
    };
    updateReel(reel, (current) => ({ ...current, settling: false, pendingSteps: 0 }));
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const limit = drag.rowHeight * 2.35;
    const dragY = Math.max(-limit, Math.min(limit, event.clientY - drag.startY));
    updateReel(drag.reel, (current) => ({ ...current, dragY }));
  };

  const settleDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    activeDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const distance = event.clientY - drag.startY;
    const stepMagnitude = cancelled ? 0 : Math.min(2, Math.round(Math.abs(distance) / drag.rowHeight));
    if (stepMagnitude === 0) {
      updateReel(drag.reel, (current) => ({
        ...current,
        dragY: 0,
        pendingSteps: 0,
        settling: Math.abs(current.dragY) >= 1,
      }));
      return;
    }
    const pendingSteps = distance < 0 ? stepMagnitude : -stepMagnitude;
    updateReel(drag.reel, (current) => ({
      ...current,
      dragY: -pendingSteps * drag.rowHeight,
      pendingSteps,
      settling: true,
    }));
  };

  const finishSettle = (reel: number) => {
    updateReel(reel, (current) => ({
      firstHeroIndex: modulo(current.firstHeroIndex + current.pendingSteps, HERO_ORDER.length),
      dragY: 0,
      pendingSteps: 0,
      settling: false,
    }));
  };

  const moveWithKeyboard = (reel: number, steps: number) => {
    updateReel(reel, (current) => ({
      ...current,
      firstHeroIndex: modulo(current.firstHeroIndex + steps, HERO_ORDER.length),
    }));
  };

  return (
    <section className="slot-machine inspection-slot-machine" aria-label="Hero XP by reel">
      <img className="slot-shell" src="/assets/slot-machine.png" alt="" />
      <div className="reel-grid inspection-reel-grid">
        {reels.map((state, reel) => {
          const visibleHeroes = [0, 1, 2]
            .map((row) => HEROES[HERO_ORDER[modulo(state.firstHeroIndex + row, HERO_ORDER.length)]].name)
            .join(', ');
          return (
            <div
              className={`reel inspection-reel ${state.settling ? 'is-settling' : ''}`}
              key={reel}
              role="slider"
              tabIndex={0}
              aria-label={`Reel ${reel + 1} hero XP`}
              aria-valuemin={0}
              aria-valuemax={HERO_ORDER.length - 1}
              aria-valuenow={state.firstHeroIndex}
              aria-valuetext={visibleHeroes}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') { event.preventDefault(); moveWithKeyboard(reel, 1); }
                if (event.key === 'ArrowDown') { event.preventDefault(); moveWithKeyboard(reel, -1); }
              }}
              onPointerDown={(event) => beginDrag(reel, event)}
              onPointerMove={moveDrag}
              onPointerUp={(event) => settleDrag(event)}
              onPointerCancel={(event) => settleDrag(event, true)}
            >
              <div
                className="reel-strip inspection-reel-strip"
                style={{ '--inspection-drag': `${state.dragY}px` } as CSSProperties}
                onTransitionEnd={(event) => {
                  if (event.propertyName === 'transform') finishSettle(reel);
                }}
              >
                {REEL_RENDER_OFFSETS.map((offset) => {
                  const heroIndex = modulo(state.firstHeroIndex + offset, HERO_ORDER.length);
                  const heroId: HeroId = HERO_ORDER[heroIndex];
                  const xp = xpByReel[reel]?.[heroIndex] ?? 1;
                  return (
                    <div
                      className="slot-symbol"
                      style={{
                        '--hero-color': HEROES[heroId].color,
                        '--slot-background': xpBackground(xp),
                      } as CSSProperties}
                      key={`${reel}-${offset}`}
                    >
                      <span className="symbol-medallion"><AtlasSprite atlas="heroPortrait" index={HEROES[heroId].atlasIndex} /></span>
                      <span className="xp-badge"><i /><b>+{xp}</b></span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {[0, 1, 2].map((reel) => (
        <button
          key={reel}
          className="nudge-button"
          style={{ left: `${19.5 + reel * 17.8}%` }}
          disabled
          tabIndex={-1}
          aria-hidden="true"
        ><span className="nudge-chevron" /><small>NUDGE</small></button>
      ))}
      <button className="lever-hit" disabled tabIndex={-1} aria-hidden="true">
        <span className="lever-track" />
        <span className="lever-arm"><i /><b /></span>
      </button>
      <div className="spin-counter"><small>SPINS</small><strong>0</strong></div>
    </section>
  );
}
