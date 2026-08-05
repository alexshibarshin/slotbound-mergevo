export type HeroId = 'freya' | 'glor' | 'frosty' | 'hadens' | 'jenny';
export type EnemyType = 'minion' | 'elite' | 'boss';
export type Phase = 'title' | 'preparation' | 'combat' | 'waveClear' | 'slotUpgrade' | 'victory' | 'defeat';
export type Rarity = 'common' | 'rare' | 'epic';

export interface HeroStats {
  damage: number;
  attackIntervalMs: number;
  range: number;
  projectileSpeed: number;
  aoeRadius: number;
  pierce: number;
  beamWidth: number;
  effectDurationMs: number;
}

export type StatMod = Partial<Record<keyof HeroStats, number>>;

export interface HeroPerk {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  multipliers?: StatMod;
  additions?: StatMod;
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  title: string;
  color: string;
  atlasIndex: number;
  ability: 'missile' | 'fireball' | 'icicle' | 'sector' | 'beam';
  stats: HeroStats;
  perks: HeroPerk[];
}

export interface HeroState {
  id: HeroId;
  level: number;
  xp: number;
  slot: number;
  perks: string[];
}

export interface SlotCell {
  heroId: HeroId;
  xp: number;
}

export interface EnemyState {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  alive: boolean;
  lastHit?: number;
}

export interface ShotFx {
  id: number;
  heroId: HeroId | 'king';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: HeroDefinition['ability'] | 'royal';
  createdAt: number;
}

export interface RewardFlight {
  id: number;
  heroId: HeroId;
  xp: number;
  fromIndex: number;
  toSlot: number;
}

export interface SlotUpgrade {
  id: string;
  title: string;
  description: string;
  affectedHeroes: HeroId[];
  affectedReels: number[];
  apply: (xpByReel: number[][]) => number[][];
}
