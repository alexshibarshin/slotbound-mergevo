import type { EnemyState, HeroDefinition, HeroStats } from '../types/game';

type Point = { x: number; y: number };

export const combatDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function getAbilityTargets(
  ability: HeroDefinition['ability'],
  stats: HeroStats,
  from: Point,
  primaryTarget: EnemyState,
  sortedTargetsInRange: EnemyState[],
  allLiveEnemies: EnemyState[],
): EnemyState[] {
  if (ability === 'missile') return sortedTargetsInRange.slice(0, Math.max(1, stats.pierce));
  if (ability === 'fireball') return allLiveEnemies.filter((enemy) => combatDistance(enemy, primaryTarget) <= stats.aoeRadius);
  if (ability === 'icicle') {
    return sortedTargetsInRange
      .filter((enemy) => Math.abs(enemy.x - primaryTarget.x) <= stats.beamWidth)
      .slice(0, stats.pierce);
  }
  if (ability === 'sector') {
    return sortedTargetsInRange.filter((enemy) => combatDistance(enemy, primaryTarget) <= stats.aoeRadius);
  }
  if (ability === 'beam') return sortedTargetsInRange.filter((enemy) => Math.abs(enemy.x - primaryTarget.x) <= stats.beamWidth);
  return [primaryTarget];
}
