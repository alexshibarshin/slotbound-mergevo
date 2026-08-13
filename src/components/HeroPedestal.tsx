import { GAME_CONFIG, HEROES, PEDESTAL_POSITIONS } from '../config/gameConfig';
import type { HeroState } from '../types/game';
import { AtlasSprite } from './AtlasSprite';

export function HeroPedestal({ slot, hero }: { slot: number; hero?: HeroState }) {
  const ready = hero ? hero.xp >= GAME_CONFIG.hero.xpToLevel(hero.level) : false;
  const position = PEDESTAL_POSITIONS[slot];

  return (
    <div className={`pedestal slot-${slot} ${hero ? 'occupied' : ''} ${ready ? 'level-ready' : ''}`} style={{ left: `${position.x}%`, top: `${position.y}%` }}>
      {hero && (
        <div className="arena-hero" aria-label={`${HEROES[hero.id].name}, level ${hero.level}`}>
          <AtlasSprite atlas="heroArena" index={HEROES[hero.id].atlasIndex} />
          <div className="hero-progress">
            <span className="hero-level">{hero.level}</span>
            <i style={{ width: `${Math.min(100, hero.xp / GAME_CONFIG.hero.xpToLevel(hero.level) * 100)}%` }} />
            {ready && <b className="level-arrow"><i /></b>}
          </div>
        </div>
      )}
    </div>
  );
}
