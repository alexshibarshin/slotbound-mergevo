import { useState } from 'react';
import { GAME_CONFIG, PEDESTAL_POSITIONS } from '../config/gameConfig';
import type { GameController } from '../hooks/useGame';
import type { ComboFeedback, HeroId } from '../types/game';
import { AtlasSprite } from './AtlasSprite';
import { CombatLayer } from './CombatLayer';
import { HeroPedestal } from './HeroPedestal';
import { Hud } from './Hud';
import { SlotMachine } from './SlotMachine';

export function Arena({ game }: { game: GameController }) {
  const [dragState, setDragState] = useState<{ heroId: HeroId; overSlot: number | null } | null>(null);
  const preparing = game.phase === 'preparation';
  const fighting = game.phase === 'combat';

  return (
    <main className={`game-screen phase-${game.phase} ${game.winningLines.length ? 'slot-celebrating' : ''} ${game.comboFeedback ? `combo-celebrating combo-x${game.comboFeedback.multiplier}` : ''} ${dragState ? 'is-dragging' : ''}`}>
      <img className="arena-bg" src="/assets/arena.png" alt="" />
      <Hud wave={game.wave} hp={game.baseHp} />
      <div className={`king-on-throne ${game.baseHp < GAME_CONFIG.base.maxHp ? 'base-damaged' : ''}`} key={game.baseHp}><AtlasSprite atlas="king" index={0} /></div>

      {PEDESTAL_POSITIONS.map((_, slot) => (
        <HeroPedestal
          key={slot}
          slot={slot}
          hero={game.heroes.find((hero) => hero.slot === slot)}
          onLevel={game.openLevelUp}
          onMove={game.moveHero}
          draggingHero={dragState?.heroId ?? null}
          dropTarget={dragState?.overSlot === slot}
          onDragChange={setDragState}
        />
      ))}

      {fighting && (
        <CombatLayer
          wave={game.wave}
          heroes={game.heroes}
          draggingHero={dragState?.heroId ?? null}
          onBaseDamage={game.damageBase}
          onComplete={game.completeWave}
        />
      )}

      {preparing && (
        <div className="preparation-panel">
          <SlotMachine
            grid={game.grid}
            spinsLeft={game.spinsLeft}
            nudgesLeft={game.nudgesLeft}
            spinning={game.spinning}
            nudgingReel={game.nudgingReel}
            nudgingDirection={game.nudgingDirection}
            pendingGrid={game.pendingGrid}
            winningCells={game.winningCells}
            winningLines={game.winningLines}
            noMatch={game.noMatch}
            comboMultiplier={game.comboFeedback?.multiplier ?? 1}
            onSpin={game.spin}
            onNudge={game.nudge}
          />
          {game.spinsLeft === 0 && !game.spinning && (
            <button className="battle-button" onClick={game.beginCombat}>BATTLE</button>
          )}
        </div>
      )}

      {game.rewardFlights.map((flight) => <RewardStar key={flight.id} {...flight} />)}
      {game.comboFeedback && <ComboCelebration key={game.comboFeedback.id} combo={game.comboFeedback} />}

      {game.phase === 'waveClear' && <WaveClear wave={game.wave} />}
      <div className="safe-vignette" />
    </main>
  );
}

function ComboCelebration({ combo }: { combo: ComboFeedback }) {
  const mega = combo.multiplier === 4;
  return (
    <div className={`combo-celebration combo-x${combo.multiplier}`} role="status" aria-live="assertive">
      <div className="combo-screen-flash" />
      <div className="combo-rays" />
      <div className="combo-shockwave"><i /><i /><i /></div>
      <div className="combo-firework firework-left">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--spark-angle': `${index * 30}deg`, '--spark-delay': `${.08 + index * .012}s` } as React.CSSProperties} />)}</div>
      <div className="combo-firework firework-right">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--spark-angle': `${index * 30}deg`, '--spark-delay': `${.2 + index * .012}s` } as React.CSSProperties} />)}</div>
      <div className="combo-confetti">{Array.from({ length: 26 }, (_, index) => {
        const column = index % 13;
        return <i key={index} style={{ '--piece-x': `${(column + .5) * 7.69}%`, '--piece-drift': `${(column - 6) * 2}vw`, '--piece-duration': `${1.05 + index * .025}s`, '--piece-delay': `${index * .018}s` } as React.CSSProperties} />;
      })}</div>
      <div className="combo-banner">
        <small>{mega ? 'MEGA JACKPOT' : 'DOUBLE JACKPOT'}</small>
        <strong><span>COMBO</span><b>x{combo.multiplier}</b></strong>
        <em>{combo.lineCount} WINNING LINES!</em>
        <p>ALL XP x{combo.multiplier} <b>+{combo.totalXp} XP</b></p>
      </div>
    </div>
  );
}

function RewardStar({ heroId, xp, fromIndex, toSlot }: { heroId: HeroId; xp: number; fromIndex: number; toSlot: number }) {
  const target = PEDESTAL_POSITIONS[toSlot];
  const sourceX = 19.2 + (fromIndex % 3 + .5) * 17.63;
  const sourceY = 72.5 + (Math.floor(fromIndex / 3) + .5) * 6.3;
  return (
    <div className="reward-flight" style={{ '--sx': `${sourceX}%`, '--sy': `${sourceY}%`, '--mx': `${(sourceX + target.x) / 2}%`, '--my': `${Math.min(sourceY, target.y) - 12}%`, '--tx': `${target.x}%`, '--ty': `${target.y}%`, '--hero-color': HERO_COLOR[heroId] } as React.CSSProperties}>
      <span><b>{xp}</b></span><i /><i /><i />
    </div>
  );
}

const HERO_COLOR: Record<HeroId, string> = { freya: '#b86cff', glor: '#ff733d', frosty: '#71ddff', hadens: '#ffe23d', jenny: '#83ff48' };

function WaveClear({ wave }: { wave: number }) {
  const final = wave >= GAME_CONFIG.stage.totalWaves;
  return (
    <div className="wave-clear">
      <AtlasSprite atlas="ui" index={0} />
      <div><strong>{final ? 'STAGE CLEAR!' : 'WAVE CLEAR!'}</strong><span>{final ? 'THE THRONE STANDS' : 'REEL UPGRADE READY'}</span></div>
    </div>
  );
}
