import { HEROES } from '../config/gameConfig';
import type { GameController } from '../hooks/useGame';
import type { CSSProperties } from 'react';
import type { HeroId, Rarity, SlotUpgrade } from '../types/game';
import { AtlasSprite } from './AtlasSprite';
import { ReelUpgradePreview } from './ReelUpgradePreview';

export function LevelUpModal({ game }: { game: GameController }) {
  if (!game.levelHero) return null;
  const hero = game.levelHero;
  return (
    <div className="modal-backdrop">
      <section className="level-modal">
        <div className="ribbon ribbon-green"><AtlasSprite atlas="ui" index={1} /><strong>{blessingTitle(HEROES[hero.id].name)}</strong></div>
        <p>CHOOSE AN ABILITY</p>
        <div className="perk-row">
          {game.perkChoices.map((perk) => (
            <button className={`perk-card rarity-${perk.rarity}`} key={perk.id} onClick={() => game.chooseHeroPerk(perk)}>
              <span className="perk-art"><AtlasSprite atlas="vfx" index={HEROES[hero.id].atlasIndex} /></span>
              <strong>{perk.name}</strong><small>{perk.description}</small><i>{rarityLabel(perk.rarity)}</i>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SlotUpgradeModal({ game }: { game: GameController }) {
  if (game.phase !== 'slotUpgrade') return null;
  const legendary = game.slotUpgradeChoices[0]?.rarity === 'legendary';
  return (
    <div className="modal-backdrop slot-upgrade-backdrop">
      <section className={`slot-upgrade-modal ${legendary ? 'legendary-upgrade-modal' : ''}`}>
        <div className={`ribbon ${legendary ? 'ribbon-legendary' : 'ribbon-blue'}`}><AtlasSprite atlas="ui" index={0} /><strong>{legendary ? 'LEGENDARY REEL PERK' : 'REEL UPGRADE'}</strong></div>
        <div className="upgrade-slot-preview">
          <ReelUpgradePreview xpByReel={game.xpByReel} />
        </div>
        <p>{legendary ? 'CHOOSE ONE LEGENDARY PERK' : 'CHOOSE ONE ENCHANTMENT'}</p>
        <div className="upgrade-options">
          {game.slotUpgradeChoices.map((upgrade) => (
            <button className={upgrade.rarity === 'legendary' ? 'legendary-upgrade-card' : ''} key={upgrade.id} onClick={() => game.chooseSlotUpgrade(upgrade)}>
              <span className={`upgrade-glyph ${upgrade.rarity === 'legendary' ? 'legendary-glyph' : ''} ${upgrade.nudgeBonus ? 'nudge-glyph' : upgrade.affectedHeroes.length === 0 ? 'reel-glyph' : ''}`}>
                {upgrade.rarity === 'legendary'
                  ? <span className="legendary-perk-icon">★</span>
                  : upgrade.nudgeBonus
                  ? <span className="nudge-upgrade-icon"><span className="nudge-chevron" /><b>+1</b></span>
                  : upgrade.affectedHeroes.length > 0
                  ? upgrade.affectedHeroes.map((heroId) => <AtlasSprite key={heroId} atlas="heroPortrait" index={HEROES[heroId].atlasIndex} />)
                  : <span className="reel-icon">{upgrade.affectedReels[0] + 1}</span>}
                {!upgrade.nudgeBonus && <small className="affected-reels">{upgrade.affectedReels.map((reel) => reel + 1).join('+')}</small>}
              </span>
              <strong>{upgrade.title}</strong>
              <SlotUpgradeDescription upgrade={upgrade} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SlotUpgradeDescription({ upgrade }: { upgrade: SlotUpgrade }) {
  if (upgrade.rarity === 'legendary') {
    return <small className="upgrade-description legendary-upgrade-description">{upgrade.description}</small>;
  }
  if (upgrade.nudgeBonus) {
    return <small className="upgrade-description nudge-upgrade-description">{upgrade.description}</small>;
  }

  const stars = upgrade.stars ?? 0;
  const heroId = upgrade.affectedHeroes[0];
  const heroName = heroId ? HEROES[heroId].name : null;
  const target = upgrade.title === 'Hero Training'
    ? <b className="upgrade-keyword hero-name" style={{ '--keyword-color': HERO_TEXT_COLORS[heroId] } as CSSProperties}>{heroName} symbols</b>
    : upgrade.title === 'Reel Training'
    ? <b className="upgrade-keyword reel-name">All symbols on Reel {upgrade.affectedReels[0] + 1}</b>
    : <><b className="upgrade-keyword hero-name" style={{ '--keyword-color': HERO_TEXT_COLORS[heroId] } as CSSProperties}>{heroName}</b><span> on </span><b className="upgrade-keyword reel-name">Reel {upgrade.affectedReels[0] + 1}</b></>;

  return (
    <small className="upgrade-description" aria-label={upgrade.description}>
      <span className="upgrade-target-line">{target}</span>
      <span className="upgrade-effect-line">
        <span>gain +</span>
        <span className="upgrade-star" aria-hidden="true"><b>{stars}</b></span>
      </span>
    </small>
  );
}

const HERO_TEXT_COLORS: Record<HeroId, string> = {
  freya: '#7637b8',
  glor: '#b94620',
  frosty: '#147ca4',
  hadens: '#956000',
  jenny: '#348613',
};

function rarityLabel(rarity: Rarity) {
  return rarity === 'epic' ? 'EPIC' : rarity === 'rare' ? 'RARE' : 'COMMON';
}

function blessingTitle(name: string) {
  const upper = name.toUpperCase();
  return `${upper}${upper.endsWith('S') ? "'" : "'S"} BLESSING`;
}
