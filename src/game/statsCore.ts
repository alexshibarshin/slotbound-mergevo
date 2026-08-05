import type { HeroDefinition, HeroState, HeroStats } from '../types/game';

export function calculateHeroStats(hero: HeroState, definition: HeroDefinition): HeroStats {
  const stats = { ...definition.stats };
  const multiplierDeltas: Partial<Record<keyof HeroStats, number>> = {};
  const additions: Partial<Record<keyof HeroStats, number>> = {};

  hero.perks.forEach((perkId) => {
    const perk = definition.perks.find((candidate) => candidate.id === perkId);
    if (!perk) return;
    Object.entries(perk.multipliers ?? {}).forEach(([key, value]) => {
      const stat = key as keyof HeroStats;
      multiplierDeltas[stat] = (multiplierDeltas[stat] ?? 0) + value - 1;
    });
    Object.entries(perk.additions ?? {}).forEach(([key, value]) => {
      const stat = key as keyof HeroStats;
      additions[stat] = (additions[stat] ?? 0) + value;
    });
  });

  Object.entries(multiplierDeltas).forEach(([key, delta]) => {
    const stat = key as keyof HeroStats;
    const minimumMultiplier = stat === 'attackIntervalMs' ? 0.45 : 0;
    stats[stat] *= Math.max(minimumMultiplier, 1 + delta);
  });
  Object.entries(additions).forEach(([key, value]) => {
    stats[key as keyof HeroStats] += value;
  });

  stats.damage *= 1 + (hero.level - 1) * 0.10;
  return stats;
}
