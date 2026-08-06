import type { EnemyType, HeroDefinition, HeroId } from '../types/game';

type WaveConfig = Record<EnemyType, number> & {
  hpMultiplier?: Partial<Record<EnemyType, number>>;
  damageMultiplier?: Partial<Record<EnemyType, number>>;
  speedMultiplier?: Partial<Record<EnemyType, number>>;
  bossFirst?: boolean;
};

const perk = (
  id: string,
  name: string,
  description: string,
  rarity: 'common' | 'rare' | 'epic',
  multipliers?: Record<string, number>,
  additions?: Record<string, number>,
) => ({ id, name, description, rarity, multipliers, additions });

export const heroXpToLevel = (level: number) => {
  if (level <= 5) return 6 + (level - 1) * 5;
  const veteranLevel = level - 6;
  return 40 + veteranLevel * 14 + veteranLevel * veteranLevel * 4;
};

export const HERO_ORDER: HeroId[] = ['freya', 'glor', 'frosty', 'hadens', 'jenny'];

export const HEROES: Record<HeroId, HeroDefinition> = {
  freya: {
    id: 'freya', name: 'Freya', title: 'Arcane Prodigy', color: '#a75cff', atlasIndex: 0, ability: 'missile',
    stats: { damage: 26, attackIntervalMs: 680, range: 38, projectileSpeed: 1, aoeRadius: 0, pierce: 1, beamWidth: 0, effectDurationMs: 0 },
    perks: [
      perk('freya-power', 'Empowered Bolt', 'Magic Missile damage +30%', 'common', { damage: 1.3 }),
      perk('freya-haste', 'Quick Casting', 'Attack speed +30%', 'common', { attackIntervalMs: 0.77 }),
      perk('freya-twin', 'Twin Missile', 'Extra missile, damage +25%', 'rare', { damage: 1.25 }, { pierce: 1 }),
      perk('freya-reach', 'Astral Reach', 'Range +30%, damage +25%', 'common', { range: 1.3, damage: 1.25 }),
      perk('freya-echo', 'Arcane Echo', 'Damage and attack speed +20%', 'rare', { damage: 1.2, attackIntervalMs: 0.83 }),
      perk('freya-focus', 'Perfect Focus', 'Magic Missile damage +45%', 'rare', { damage: 1.45 }),
      perk('freya-volley', 'Star Volley', 'Two extra missiles, damage +10%', 'epic', { damage: 1.1 }, { pierce: 2 }),
      perk('freya-overload', 'Mana Overload', 'Damage +50%, attack speed -8%', 'epic', { damage: 1.5, attackIntervalMs: 1.08 }),
      perk('freya-rhythm', 'Spell Rhythm', 'Attack speed +45%', 'rare', { attackIntervalMs: 0.69 }),
      perk('freya-mastery', 'Arcane Mastery', 'Damage +35%, range +25%', 'epic', { damage: 1.35, range: 1.25 }),
    ],
  },
  glor: {
    id: 'glor', name: 'Glor', title: 'Cannon Goblin', color: '#ff7040', atlasIndex: 1, ability: 'fireball',
    stats: { damage: 28, attackIntervalMs: 1500, range: 38, projectileSpeed: 0.7, aoeRadius: 6, pierce: 1, beamWidth: 0, effectDurationMs: 0 },
    perks: [
      perk('glor-powder', 'Hotter Powder', 'Fireball damage +30%', 'common', { damage: 1.3 }),
      perk('glor-fuse', 'Short Fuse', 'Attack speed +30%', 'common', { attackIntervalMs: 0.77 }),
      perk('glor-blast', 'Wide Blast', 'Explosion radius +35%, damage +25%', 'common', { aoeRadius: 1.35, damage: 1.25 }),
      perk('glor-shell', 'Heavy Shell', 'Damage +45%, attack speed -8%', 'rare', { damage: 1.45, attackIntervalMs: 1.08 }),
      perk('glor-cluster', 'Cluster Bomb', 'Explosion and damage +25%', 'rare', { damage: 1.25, aoeRadius: 1.25 }),
      perk('glor-loader', 'Goblin Loader', 'Attack speed +45%', 'rare', { attackIntervalMs: 0.69 }),
      perk('glor-napalm', 'Sticky Flame', 'Blast radius +55%, damage +35%', 'epic', { aoeRadius: 1.55, damage: 1.35 }),
      perk('glor-sun', 'Pocket Sun', 'Fireball damage +50%', 'epic', { damage: 1.5 }),
      perk('glor-scope', 'Cannon Scope', 'Range +30%, damage +20%', 'rare', { range: 1.3, damage: 1.2 }),
      perk('glor-barrage', 'Bombardment', 'Attack speed +30%, blast +35%', 'epic', { attackIntervalMs: 0.77, aoeRadius: 1.35 }),
    ],
  },
  frosty: {
    id: 'frosty', name: 'Frosty', title: 'Winter Weaver', color: '#64d9ff', atlasIndex: 2, ability: 'icicle',
    stats: { damage: 25, attackIntervalMs: 1050, range: 46, projectileSpeed: 1.4, aoeRadius: 0, pierce: 3, beamWidth: 4.5, effectDurationMs: 0 },
    perks: [
      perk('frosty-sharp', 'Razor Ice', 'Icicle damage +30%', 'common', { damage: 1.3 }),
      perk('frosty-flow', 'Cold Flow', 'Attack speed +30%', 'common', { attackIntervalMs: 0.77 }),
      perk('frosty-pierce', 'Deep Freeze', 'Pierce 2 more enemies, damage +25%', 'common', { damage: 1.25 }, { pierce: 2 }),
      perk('frosty-long', 'Glacier Spear', 'Range +35%, damage +35%', 'rare', { range: 1.35, damage: 1.35 }),
      perk('frosty-lance', 'Crystal Lance', 'Damage +45%, width +30%', 'rare', { damage: 1.45, beamWidth: 1.3 }),
      perk('frosty-storm', 'Hailstorm', 'Attack speed +45%', 'rare', { attackIntervalMs: 0.69 }),
      perk('frosty-endless', 'Endless Icicle', 'Pierce +8, damage +30%', 'epic', { damage: 1.3 }, { pierce: 8 }),
      perk('frosty-zero', 'Absolute Zero', 'Damage +50%', 'epic', { damage: 1.5 }),
      perk('frosty-splinter', 'Splintered Cold', 'Damage +25%, pierce +3', 'rare', { damage: 1.25 }, { pierce: 3 }),
      perk('frosty-queen', 'Winter Queen', 'Damage +35%, attack speed +30%', 'epic', { damage: 1.35, attackIntervalMs: 0.77 }),
    ],
  },
  hadens: {
    id: 'hadens', name: 'Hadens', title: 'Storm Professor', color: '#ffd83d', atlasIndex: 3, ability: 'sector',
    stats: { damage: 30, attackIntervalMs: 1150, range: 38, projectileSpeed: 0, aoeRadius: 8.5, pierce: 99, beamWidth: 0, effectDurationMs: 220 },
    perks: [
      perk('hadens-voltage', 'High Voltage', 'Shock damage +30%', 'common', { damage: 1.3 }),
      perk('hadens-coil', 'Fast Coil', 'Attack speed +30%', 'common', { attackIntervalMs: 0.77 }),
      perk('hadens-sector', 'Wider Sector', 'Shock area +35%, damage +25%', 'common', { aoeRadius: 1.35, damage: 1.25 }),
      perk('hadens-capacitor', 'Capacitor Bank', 'Damage +45%', 'rare', { damage: 1.45 }),
      perk('hadens-field', 'Storm Field', 'Range and area +30%, damage +30%', 'rare', { range: 1.3, aoeRadius: 1.3, damage: 1.3 }),
      perk('hadens-frenzy', 'Mad Science', 'Attack speed +45%', 'rare', { attackIntervalMs: 0.69 }),
      perk('hadens-tesla', 'Tesla Crown', 'Damage and area +45%', 'epic', { damage: 1.45, aoeRadius: 1.45 }),
      perk('hadens-thunder', 'Thunderclap', 'Damage +50%', 'epic', { damage: 1.5 }),
      perk('hadens-arc', 'Long Arc', 'Range +45%, damage +35%', 'rare', { range: 1.45, damage: 1.35 }),
      perk('hadens-genius', 'Eureka!', 'Damage +35%, attack speed +30%', 'epic', { damage: 1.35, attackIntervalMs: 0.77 }),
    ],
  },
  jenny: {
    id: 'jenny', name: 'Jenny', title: 'Hex Sweeper', color: '#86ff40', atlasIndex: 4, ability: 'beam',
    stats: { damage: 17, attackIntervalMs: 600, range: 34, projectileSpeed: 0, aoeRadius: 0, pierce: 99, beamWidth: 5.5, effectDurationMs: 420 },
    perks: [
      perk('jenny-potency', 'Toxic Focus', 'Beam damage +30%', 'common', { damage: 1.3 }),
      perk('jenny-pulse', 'Rapid Pulse', 'Tick speed +30%', 'common', { attackIntervalMs: 0.77 }),
      perk('jenny-thick', 'Thick Beam', 'Beam width +35%, damage +25%', 'common', { beamWidth: 1.35, damage: 1.25 }),
      perk('jenny-long', 'Grave Reach', 'Range +35%, damage +25%', 'common', { range: 1.35, damage: 1.25 }),
      perk('jenny-sweep', 'Wide Sweep', 'Width +35%, damage +25%', 'rare', { beamWidth: 1.35, damage: 1.25 }),
      perk('jenny-rot', 'Soul Rot', 'Damage +45%', 'rare', { damage: 1.45 }),
      perk('jenny-overheat', 'Laser Overheat', 'Damage +50%', 'epic', { damage: 1.5 }),
      perk('jenny-harvest', 'Soul Harvest', 'Attack speed +30%, damage +35%', 'epic', { attackIntervalMs: 0.77, damage: 1.35 }),
      perk('jenny-river', 'Necrotic River', 'Range and width +45%, damage +35%', 'rare', { range: 1.45, beamWidth: 1.45, damage: 1.35 }),
      perk('jenny-eclipse', 'Green Eclipse', 'Damage +45%, width +35%', 'epic', { damage: 1.45, beamWidth: 1.35 }),
    ],
  },
};

export const GAME_CONFIG = {
  stage: { totalWaves: 10, preparationSpins: 5, nudgesPerPreparation: 1, guaranteedWinningOpeningSpins: 3 },
  base: { maxHp: 100, damage: 7, attackIntervalMs: 1200, range: 48 },
  hero: { xpToLevel: heroXpToLevel, perkChoices: 2 },
  slot: {
    spinDurationMs: 760,
    nudgeDurationMs: 360,
    enableUpwardNudge: true,
    symbolWeights: [0.2, 0.2, 0.2, 0.2, 0.2],
    // Tiers are evaluated from top to bottom, so keep the minimum XP values descending.
    xpBackgroundTiers: [
      { minXp: 15, color: '#e1dcf5' }, // pale violet
      { minXp: 10, color: '#d8ebfa' }, // pale blue
      { minXp: 5, color: '#d7eeda' }, // pale green
      { minXp: 0, color: '#f8fafb' }, // white
    ],
  },
  slotUpgrades: { focusedXp: 10, linkedXp: 5, pairedXp: 5, wholeReelXp: 2, maxNudgeUpgrades: 2 },
  feedback: { winHighlightMs: 1050, rewardDelayMs: 340, rewardFlightMs: 1450, comboCelebrationMs: 1900, waveClearMs: 1300 },
  combat: {
    tickMs: 50,
    spawnIntervalMs: 420,
    laneWidth: 28,
    baseY: 18,
    spawnY: 104,
    bossSiege: { damage: 5, attackIntervalMs: 2000, firstAttackDelayMs: 1000 },
  },
  enemies: {
    minion: { hp: 300, speed: 5.6, damage: 1, atlasIndex: 1, size: 20 },
    elite: { hp: 1150, speed: 4, damage: 55, atlasIndex: 2, size: 23 },
    boss: { hp: 13500, speed: 1.9, damage: 20, atlasIndex: 3, size: 34 },
  } satisfies Record<EnemyType, { hp: number; speed: number; damage: number; atlasIndex: number; size: number }>,
  waves: [
    { minion: 10, elite: 0, boss: 0, hpMultiplier: { minion: 0.65 }, speedMultiplier: { minion: 0.88 } },
    { minion: 14, elite: 0, boss: 0, hpMultiplier: { minion: 0.78 }, speedMultiplier: { minion: 0.92 } },
    { minion: 18, elite: 0, boss: 0, hpMultiplier: { minion: 0.92 }, speedMultiplier: { minion: 0.96 } },
    { minion: 14, elite: 2, boss: 0, hpMultiplier: { minion: 1.05, elite: 0.6 } },
    { minion: 22, elite: 0, boss: 0, hpMultiplier: { minion: 1.6 }, speedMultiplier: { minion: 1.15 } },
    { minion: 26, elite: 0, boss: 0, hpMultiplier: { minion: 1.7 }, speedMultiplier: { minion: 1.25 } },
    { minion: 16, elite: 4, boss: 0, hpMultiplier: { minion: 2.2, elite: 0.75 }, damageMultiplier: { elite: 1.82 }, speedMultiplier: { minion: 1.3, elite: 1.05 } },
    { minion: 30, elite: 0, boss: 0, hpMultiplier: { minion: 2.8 }, speedMultiplier: { minion: 1.8 } },
    { minion: 36, elite: 0, boss: 0, hpMultiplier: { minion: 3.1 }, speedMultiplier: { minion: 2 } },
    { minion: 8, elite: 0, boss: 1, hpMultiplier: { minion: 3.4, boss: 0.9 }, damageMultiplier: { minion: 2 }, speedMultiplier: { minion: 1.5, boss: 1.25 }, bossFirst: true },
  ] as WaveConfig[],
} as const;

export const PEDESTAL_POSITIONS = [
  { x: 23.8, y: 27.2 }, { x: 72.5, y: 27.2 }, { x: 23.8, y: 42.4 },
  { x: 72.5, y: 42.4 }, { x: 23.8, y: 58.2 }, { x: 72.5, y: 58.2 },
] as const;
