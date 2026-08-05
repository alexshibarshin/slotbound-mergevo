import { HEROES } from '../config/gameConfig';
import type { GameController } from '../hooks/useGame';
import type { Rarity } from '../types/game';
import { AtlasSprite } from './AtlasSprite';
import { ReelUpgradePreview } from './ReelUpgradePreview';

export function LevelUpModal({ game }: { game: GameController }) {
  if (!game.levelHero) return null;
  const hero = game.levelHero;
  return (
    <div className="modal-backdrop" onClick={game.closeLevelUp}>
      <section className="level-modal" onClick={(event) => event.stopPropagation()}>
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
  return (
    <div className="modal-backdrop slot-upgrade-backdrop">
      <section className="slot-upgrade-modal">
        <div className="ribbon ribbon-blue"><AtlasSprite atlas="ui" index={0} /><strong>REEL UPGRADE</strong></div>
        <div className="upgrade-slot-preview">
          <ReelUpgradePreview xpByReel={game.xpByReel} />
        </div>
        <p>CHOOSE ONE ENCHANTMENT</p>
        <div className="upgrade-options">
          {game.slotUpgradeChoices.map((upgrade) => (
            <button key={upgrade.id} onClick={() => game.chooseSlotUpgrade(upgrade)}>
              <span className={`upgrade-glyph ${upgrade.affectedHeroes.length === 0 ? 'reel-glyph' : ''} ${upgrade.affectedHeroes.length > 1 ? 'dual-glyph' : ''}`}>
                {upgrade.affectedHeroes.length > 0
                  ? upgrade.affectedHeroes.map((heroId) => <AtlasSprite key={heroId} atlas="heroPortrait" index={HEROES[heroId].atlasIndex} />)
                  : <span className="reel-icon">{upgrade.affectedReels[0] + 1}</span>}
                <small className="affected-reels">{upgrade.affectedReels.map((reel) => reel + 1).join('+')}</small>
              </span>
              <strong>{upgrade.title}</strong><small>{upgrade.description}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function rarityLabel(rarity: Rarity) {
  return rarity === 'epic' ? 'EPIC' : rarity === 'rare' ? 'RARE' : 'COMMON';
}

function blessingTitle(name: string) {
  const upper = name.toUpperCase();
  return `${upper}${upper.endsWith('S') ? "'" : "'S"} BLESSING`;
}
