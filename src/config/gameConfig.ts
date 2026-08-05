import type { EnemyType, HeroDefinition, HeroId } from '../types/game';

const perk = (
  id: string,
  name: string,
  description: string,
  rarity: 'common' | 'rare' | 'epic',
  multipliers?: Record<string, number>,
  additions?: Record<string, number>,
) => ({ id, name, description, rarity, multipliers, additions });

export const HERO_ORDER: HeroId[] = ['freya', 'glor', 'frosty', 'hadens', 'jenny'];

export const HEROES: Record<HeroId, HeroDefinition> = {
  freya: {
    id: 'freya', name: 'Freya', title: 'Arcane Prodigy', color: '#a75cff', atlasIndex: 0, ability: 'missile',
    stats: { damage: 18, attackIntervalMs: 620, range: 33, projectileSpeed: 1, aoeRadius: 0, pierce: 1, beamWidth: 0, effectDurationMs: 0 },
    perks: [
      perk('freya-power', 'Empowered Bolt', 'Magic Missile damage +50%', 'common', { damage: 1.5 }),
      perk('freya-haste', 'Quick Casting', 'Attack speed +55%', 'common', { attackIntervalMs: 0.645 }),
      perk('freya-twin', 'Twin Missile', 'Fire an extra missile', 'rare', undefined, { pierce: 1 }),
      perk('freya-reach', 'Astral Reach', 'Range +45%', 'common', { range: 1.45 }),
      perk('freya-echo', 'Arcane Echo', 'Damage +35%, speed +25%', 'rare', { damage: 1.35, attackIntervalMs: 0.8 }),
      perk('freya-focus', 'Perfect Focus', 'Magic Missile damage +80%', 'rare', { damage: 1.8 }),
      perk('freya-volley', 'Star Volley', 'Two extra missiles, damage -15%', 'epic', { damage: 0.85 }, { pierce: 2 }),
      perk('freya-overload', 'Mana Overload', 'Damage +110%, attack speed -15%', 'epic', { damage: 2.1, attackIntervalMs: 1.15 }),
      perk('freya-rhythm', 'Spell Rhythm', 'Attack speed +80%', 'rare', { attackIntervalMs: 0.555 }),
      perk('freya-mastery', 'Arcane Mastery', 'Damage and range +50%', 'epic', { damage: 1.5, range: 1.5 }),
    ],
  },
  glor: {
    id: 'glor', name: 'Glor', title: 'Cannon Goblin', color: '#ff7040', atlasIndex: 1, ability: 'fireball',
    stats: { damage: 46, attackIntervalMs: 1450, range: 36, projectileSpeed: 0.7, aoeRadius: 9, pierce: 1, beamWidth: 0, effectDurationMs: 0 },
    perks: [
      perk('glor-powder', 'Hotter Powder', 'Fireball damage +55%', 'common', { damage: 1.55 }),
      perk('glor-fuse', 'Short Fuse', 'Attack speed +50%', 'common', { attackIntervalMs: 0.667 }),
      perk('glor-blast', 'Wide Blast', 'Explosion radius +65%', 'common', { aoeRadius: 1.65 }),
      perk('glor-shell', 'Heavy Shell', 'Damage +90%, speed -10%', 'rare', { damage: 1.9, attackIntervalMs: 1.1 }),
      perk('glor-cluster', 'Cluster Bomb', 'Explosion and damage +40%', 'rare', { damage: 1.4, aoeRadius: 1.4 }),
      perk('glor-loader', 'Goblin Loader', 'Attack speed +75%', 'rare', { attackIntervalMs: 0.57 }),
      perk('glor-napalm', 'Sticky Flame', 'Blast radius +100%', 'epic', { aoeRadius: 2 }),
      perk('glor-sun', 'Pocket Sun', 'Fireball damage +120%', 'epic', { damage: 2.2 }),
      perk('glor-scope', 'Cannon Scope', 'Range +55%, damage +25%', 'rare', { range: 1.55, damage: 1.25 }),
      perk('glor-barrage', 'Bombardment', 'Attack speed +50%, blast +50%', 'epic', { attackIntervalMs: 0.667, aoeRadius: 1.5 }),
    ],
  },
  frosty: {
    id: 'frosty', name: 'Frosty', title: 'Winter Weaver', color: '#64d9ff', atlasIndex: 2, ability: 'icicle',
    stats: { damage: 24, attackIntervalMs: 950, range: 44, projectileSpeed: 1.4, aoeRadius: 0, pierce: 4, beamWidth: 2, effectDurationMs: 0 },
    perks: [
      perk('frosty-sharp', 'Razor Ice', 'Icicle damage +50%', 'common', { damage: 1.5 }),
      perk('frosty-flow', 'Cold Flow', 'Attack speed +50%', 'common', { attackIntervalMs: 0.667 }),
      perk('frosty-pierce', 'Deep Freeze', 'Pierce 3 more enemies', 'common', undefined, { pierce: 3 }),
      perk('frosty-long', 'Glacier Spear', 'Range +60%', 'rare', { range: 1.6 }),
      perk('frosty-lance', 'Crystal Lance', 'Damage +70%, width +50%', 'rare', { damage: 1.7, beamWidth: 1.5 }),
      perk('frosty-storm', 'Hailstorm', 'Attack speed +75%', 'rare', { attackIntervalMs: 0.57 }),
      perk('frosty-endless', 'Endless Icicle', 'Pierce all practical targets', 'epic', undefined, { pierce: 30 }),
      perk('frosty-zero', 'Absolute Zero', 'Damage +100%', 'epic', { damage: 2 }),
      perk('frosty-splinter', 'Splintered Cold', 'Damage +35%, pierce +5', 'rare', { damage: 1.35 }, { pierce: 5 }),
      perk('frosty-queen', 'Winter Queen', 'Damage and attack speed +50%', 'epic', { damage: 1.5, attackIntervalMs: 0.667 }),
    ],
  },
  hadens: {
    id: 'hadens', name: 'Hadens', title: 'Storm Professor', color: '#ffd83d', atlasIndex: 3, ability: 'sector',
    stats: { damage: 34, attackIntervalMs: 1200, range: 24, projectileSpeed: 0, aoeRadius: 13, pierce: 99, beamWidth: 0, effectDurationMs: 220 },
    perks: [
      perk('hadens-voltage', 'High Voltage', 'Shock damage +55%', 'common', { damage: 1.55 }),
      perk('hadens-coil', 'Fast Coil', 'Attack speed +50%', 'common', { attackIntervalMs: 0.667 }),
      perk('hadens-sector', 'Wider Sector', 'Shock area +50%', 'common', { aoeRadius: 1.5 }),
      perk('hadens-capacitor', 'Capacitor Bank', 'Damage +75%', 'rare', { damage: 1.75 }),
      perk('hadens-field', 'Storm Field', 'Range and area +45%', 'rare', { range: 1.45, aoeRadius: 1.45 }),
      perk('hadens-frenzy', 'Mad Science', 'Attack speed +80%', 'rare', { attackIntervalMs: 0.555 }),
      perk('hadens-tesla', 'Tesla Crown', 'Damage +70%, area +70%', 'epic', { damage: 1.7, aoeRadius: 1.7 }),
      perk('hadens-thunder', 'Thunderclap', 'Damage +120%', 'epic', { damage: 2.2 }),
      perk('hadens-arc', 'Long Arc', 'Range +80%', 'rare', { range: 1.8 }),
      perk('hadens-genius', 'Eureka!', 'Damage and speed +50%', 'epic', { damage: 1.5, attackIntervalMs: 0.667 }),
    ],
  },
  jenny: {
    id: 'jenny', name: 'Jenny', title: 'Hex Sweeper', color: '#86ff40', atlasIndex: 4, ability: 'beam',
    stats: { damage: 16, attackIntervalMs: 500, range: 28, projectileSpeed: 0, aoeRadius: 0, pierce: 99, beamWidth: 7, effectDurationMs: 420 },
    perks: [
      perk('jenny-potency', 'Toxic Focus', 'Beam damage +50%', 'common', { damage: 1.5 }),
      perk('jenny-pulse', 'Rapid Pulse', 'Tick speed +50%', 'common', { attackIntervalMs: 0.667 }),
      perk('jenny-thick', 'Thick Beam', 'Beam width +60%', 'common', { beamWidth: 1.6 }),
      perk('jenny-long', 'Grave Reach', 'Range +55%', 'common', { range: 1.55 }),
      perk('jenny-sweep', 'Wide Sweep', 'Width +60%, damage +35%', 'rare', { beamWidth: 1.6, damage: 1.35 }),
      perk('jenny-rot', 'Soul Rot', 'Damage +85%', 'rare', { damage: 1.85 }),
      perk('jenny-overheat', 'Laser Overheat', 'Damage +110%', 'epic', { damage: 2.1 }),
      perk('jenny-harvest', 'Soul Harvest', 'Speed and damage +45%', 'epic', { attackIntervalMs: 0.69, damage: 1.45 }),
      perk('jenny-river', 'Necrotic River', 'Range and width +70%', 'rare', { range: 1.7, beamWidth: 1.7 }),
      perk('jenny-eclipse', 'Green Eclipse', 'Damage +70%, width +50%', 'epic', { damage: 1.7, beamWidth: 1.5 }),
    ],
  },
};

export const GAME_CONFIG = {
  stage: { totalWaves: 6, preparationSpins: 5, nudgesPerPreparation: 1, guaranteedWinningOpeningSpins: 3 },
  base: { maxHp: 100, damage: 8, attackIntervalMs: 1150, range: 48 },
  hero: { xpToLevel: (level: number) => 6 + (level - 1) * 5, perkChoices: 2 },
  slot: { spinDurationMs: 760, nudgeDurationMs: 360, symbolWeights: [0.2, 0.2, 0.2, 0.2, 0.2] },
  slotUpgrades: { focusedXp: 3, linkedXp: 2, pairedXp: 2, wholeReelXp: 1, wildXp: 4 },
  feedback: { winHighlightMs: 1050, rewardDelayMs: 340, rewardFlightMs: 1450, waveClearMs: 1300 },
  combat: { tickMs: 50, spawnIntervalMs: 470, laneWidth: 28, baseY: 18, spawnY: 104 },
  enemies: {
    minion: { hp: 42, speed: 3.8, damage: 4, atlasIndex: 1, size: 20 },
    elite: { hp: 170, speed: 2.5, damage: 13, atlasIndex: 2, size: 23 },
    boss: { hp: 700, speed: 1.35, damage: 35, atlasIndex: 3, size: 34 },
  } satisfies Record<EnemyType, { hp: number; speed: number; damage: number; atlasIndex: number; size: number }>,
  waves: [
    { minion: 9, elite: 0, boss: 0 },
    { minion: 12, elite: 1, boss: 0 },
    { minion: 16, elite: 2, boss: 0 },
    { minion: 18, elite: 3, boss: 0 },
    { minion: 22, elite: 4, boss: 0 },
    { minion: 16, elite: 3, boss: 1 },
  ] satisfies Array<Record<EnemyType, number>>,
} as const;

export const PEDESTAL_POSITIONS = [
  { x: 23.8, y: 27.2 }, { x: 72.5, y: 27.2 }, { x: 23.8, y: 42.4 },
  { x: 72.5, y: 42.4 }, { x: 23.8, y: 58.2 }, { x: 72.5, y: 58.2 },
] as const;
