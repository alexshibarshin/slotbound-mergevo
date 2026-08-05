import { HEROES } from '../config/gameConfig';
import type { HeroState, HeroStats } from '../types/game';

export function getHeroStats(hero: HeroState): HeroStats {
  const definition = HEROES[hero.id];
  const stats = { ...definition.stats };
  hero.perks.forEach((perkId) => {
    const perk = definition.perks.find((candidate) => candidate.id === perkId);
    if (!perk) return;
    Object.entries(perk.multipliers ?? {}).forEach(([key, value]) => {
      stats[key as keyof HeroStats] *= value;
    });
    Object.entries(perk.additions ?? {}).forEach(([key, value]) => {
      stats[key as keyof HeroStats] += value;
    });
  });
  const levelScale = 1 + (hero.level - 1) * 0.12;
  stats.damage *= levelScale;
  return stats;
}
