import { GAME_CONFIG, HEROES, HERO_ORDER } from '../config/gameConfig';
import type { HeroId, LegendarySlotPerkId, NudgeDirection, SlotCell, SlotUpgrade } from '../types/game';

type RandomSource = () => number;

export const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

const randomHero = (random: RandomSource = Math.random): HeroId => {
  const weights = GAME_CONFIG.slot.symbolWeights;
  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (totalWeight <= 0) return HERO_ORDER[Math.floor(random() * HERO_ORDER.length)] ?? HERO_ORDER[0];
  let roll = random() * totalWeight;
  for (let index = 0; index < HERO_ORDER.length; index += 1) {
    const weight = Math.max(0, weights[index] ?? 0);
    if (roll < weight) return HERO_ORDER[index];
    roll -= weight;
  }
  return HERO_ORDER.at(-1)!;
};

export function createGrid(xpByReel: number[][], guaranteeWin = false, random: RandomSource = Math.random): SlotCell[] {
  const heroes = Array.from({ length: 9 }, () => randomHero(random));
  if (guaranteeWin) {
    const winner = randomHero(random);
    const line = WINNING_LINES[Math.floor(random() * WINNING_LINES.length)] ?? WINNING_LINES[0];
    line.forEach((index) => { heroes[index] = winner; });
  }
  return heroes.map((heroId, index) => ({
    heroId,
    xp: xpByReel[index % 3][HERO_ORDER.indexOf(heroId)],
  }));
}

export function nudgeReel(
  grid: SlotCell[],
  reel: number,
  xpByReel: number[][],
  direction: NudgeDirection = 'down',
  random: RandomSource = Math.random,
): SlotCell[] {
  const next = [...grid];
  const heroId = randomHero(random);
  const incoming = { heroId, xp: xpByReel[reel][HERO_ORDER.indexOf(heroId)] };
  if (direction === 'up') {
    next[reel] = next[reel + 3];
    next[reel + 3] = next[reel + 6];
    next[reel + 6] = incoming;
  } else {
    next[reel + 6] = next[reel + 3];
    next[reel + 3] = next[reel];
    next[reel] = incoming;
  }
  return next;
}

export function findWins(grid: SlotCell[]): number[][] {
  return WINNING_LINES
    .filter(([a, b, c]) => grid[a].heroId === grid[b].heroId && grid[b].heroId === grid[c].heroId)
    .map((line) => [...line]);
}

const lineKey = (line: readonly number[]) => line.join('-');

function nudgeWithIncomingHero(
  grid: SlotCell[],
  reel: number,
  direction: NudgeDirection,
  heroId: HeroId,
): SlotCell[] {
  const next = grid.map((cell) => ({ ...cell }));
  const incoming = { ...grid[reel], heroId };
  if (direction === 'up') {
    next[reel] = next[reel + 3];
    next[reel + 3] = next[reel + 6];
    next[reel + 6] = incoming;
  } else {
    next[reel + 6] = next[reel + 3];
    next[reel + 3] = next[reel];
    next[reel] = incoming;
  }
  return next;
}

/** True when one legal Nudge creates a new win for every possible incoming symbol. */
export function hasGuaranteedNudgeOpportunity(grid: SlotCell[], enableUpwardNudge = true): boolean {
  const existingWins = new Set(findWins(grid).map(lineKey));
  const directions: NudgeDirection[] = enableUpwardNudge ? ['down', 'up'] : ['down'];
  return [0, 1, 2].some((reel) => directions.some((direction) => HERO_ORDER.every((heroId) => {
    const result = nudgeWithIncomingHero(grid, reel, direction, heroId);
    return findWins(result).some((line) => !existingWins.has(lineKey(line)));
  })));
}

export interface SmartGridOptions {
  lossStreak: number;
  nudgesAvailable: number;
  guaranteeWin?: boolean;
  random?: RandomSource;
}

export interface SmartGridResult {
  grid: SlotCell[];
  hasGuaranteedNudgeOpportunity: boolean;
  rolls: number;
}

/** Generates independent rolls and accepts the first win or usable guaranteed Nudge setup. */
export function createSmartGrid(xpByReel: number[][], options: SmartGridOptions): SmartGridResult {
  const random = options.random ?? Math.random;
  const lossStreak = Math.max(0, Math.floor(options.lossStreak));
  const forceWin = options.guaranteeWin
    || lossStreak >= GAME_CONFIG.slot.smartRandom.guaranteedWinLossStreak;

  if (forceWin) {
    const grid = createGrid(xpByReel, true, random);
    return {
      grid,
      hasGuaranteedNudgeOpportunity: options.nudgesAvailable > 0
        && hasGuaranteedNudgeOpportunity(grid, GAME_CONFIG.slot.enableUpwardNudge),
      rolls: 1,
    };
  }

  const rerollsByLossStreak = GAME_CONFIG.slot.smartRandom.rerollsByLossStreak;
  const rerollIndex = Math.min(lossStreak, rerollsByLossStreak.length - 1);
  const rerollLimit = Math.max(0, rerollsByLossStreak[rerollIndex] ?? 0);
  let grid = createGrid(xpByReel, false, random);
  let rolls = 1;

  for (let reroll = 0; reroll <= rerollLimit; reroll += 1) {
    const guaranteedNudge = options.nudgesAvailable > 0
      && hasGuaranteedNudgeOpportunity(grid, GAME_CONFIG.slot.enableUpwardNudge);
    if (findWins(grid).length > 0 || guaranteedNudge || reroll === rerollLimit) {
      return { grid, hasGuaranteedNudgeOpportunity: guaranteedNudge, rolls };
    }
    grid = createGrid(xpByReel, false, random);
    rolls += 1;
  }

  return { grid, hasGuaranteedNudgeOpportunity: false, rolls };
}

const cloneMatrix = (matrix: number[][]) => matrix.map((row) => [...row]);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const weightedPick = <T,>(items: Array<{ value: T; weight: number }>): T => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items.at(-1)!.value;
};

function createCommonSlotUpgrade(nudgeUpgradesTaken: number, choiceIndex: number): SlotUpgrade {
  const reel = Math.floor(Math.random() * 3);
  const heroIndex = Math.floor(Math.random() * HERO_ORDER.length);
  const hero = HERO_ORDER[heroIndex];
  const weights = GAME_CONFIG.slotUpgrades.commonFamilyWeights;
  const families = [
    { value: 'hero' as const, weight: weights.hero },
    { value: 'reel' as const, weight: weights.reel },
    { value: 'focused' as const, weight: weights.focused },
    ...(nudgeUpgradesTaken < GAME_CONFIG.slotUpgrades.maxNudgeUpgrades
      ? [{ value: 'nudge' as const, weight: weights.nudge }]
      : []),
  ];
  const family = weightedPick(families);
  const idSuffix = `${Date.now()}-${choiceIndex}-${Math.random()}`;

  if (family === 'hero') {
    const stars = GAME_CONFIG.slotUpgrades.heroXp;
    return {
      id: `hero-training-${hero}-${idSuffix}`, title: 'Hero Training', rarity: 'common', stars,
      description: `${HEROES[hero].name} symbols gain +${stars} stars.`,
      affectedHeroes: [hero], affectedReels: [0, 1, 2],
      apply: (matrix) => {
        const next = cloneMatrix(matrix);
        next.forEach((values) => { values[heroIndex] += stars; });
        return next;
      },
    };
  }
  if (family === 'reel') {
    const stars = GAME_CONFIG.slotUpgrades.wholeReelXp;
    return {
      id: `reel-training-${reel}-${idSuffix}`, title: 'Reel Training', rarity: 'common', stars,
      description: `All symbols on Reel ${reel + 1} gain +${stars} stars.`,
      affectedHeroes: [], affectedReels: [reel],
      apply: (matrix) => {
        const next = cloneMatrix(matrix);
        next[reel] = next[reel].map((value) => value + stars);
        return next;
      },
    };
  }
  if (family === 'focused') {
    const stars = GAME_CONFIG.slotUpgrades.focusedXp;
    return {
      id: `focused-training-${reel}-${hero}-${idSuffix}`, title: 'Focused Training', rarity: 'common', stars,
      description: `${HEROES[hero].name} on Reel ${reel + 1} gains +${stars} stars.`,
      affectedHeroes: [hero], affectedReels: [reel],
      apply: (matrix) => {
        const next = cloneMatrix(matrix);
        next[reel][heroIndex] += stars;
        return next;
      },
    };
  }
  return {
    id: `extra-nudge-${nudgeUpgradesTaken + 1}-${idSuffix}`, title: 'Extra Nudge', rarity: 'common',
    description: '+1 Nudge each wave.', affectedHeroes: [], affectedReels: [], nudgeBonus: 1,
    apply: cloneMatrix,
  };
}

export function createCommonSlotUpgradeChoices(nudgeUpgradesTaken = 0): SlotUpgrade[] {
  const choices: SlotUpgrade[] = [];
  const seenEffects = new Set<string>();
  while (choices.length < 3) {
    const choice = createCommonSlotUpgrade(nudgeUpgradesTaken, choices.length);
    const effectKey = `${choice.title}|${choice.description}`;
    if (seenEffects.has(effectKey)) continue;
    seenEffects.add(effectKey);
    choices.push(choice);
  }
  return choices;
}

const LEGENDARY_SLOT_UPGRADES: ReadonlyArray<{ id: LegendarySlotPerkId; title: string; description: string }> = [
  { id: 'perfect-nudge', title: 'Perfect Nudge', description: 'First Nudge Match refunds the Nudge.' },
  { id: 'overdrive', title: 'Overdrive', description: '−1 Spin. +2 Nudges each wave.' },
  { id: 'precision-training', title: 'Precision Training', description: 'Matches after a Nudge grant 2× stars.' },
  { id: 'rising-stars', title: 'Rising Stars', description: 'Spin Matches after the first grant 2× stars.' },
  { id: 'training-day', title: 'Training Day', description: 'First Spin Match: Matched hero symbols gain +1 star.' },
  { id: 'rewire', title: 'Rewire', description: 'All Nudges become Spins.' },
  { id: 'horizontal-fortune', title: 'Horizontal Fortune', description: 'Horizontal Matches grant 2× stars.' },
  { id: 'vertical-fortune', title: 'Vertical Fortune', description: 'Vertical Matches grant 2× stars.' },
  { id: 'diagonal-fortune', title: 'Diagonal Fortune', description: 'Diagonal Matches grant 3× stars.' },
];

const conflictsWithTakenPerks = (id: LegendarySlotPerkId, taken: LegendarySlotPerkId[]) => {
  if (id === 'rewire') return taken.includes('perfect-nudge') || taken.includes('precision-training');
  if (id === 'perfect-nudge' || id === 'precision-training') return taken.includes('rewire');
  return false;
};

export function createLegendarySlotUpgradeChoices(taken: LegendarySlotPerkId[]): SlotUpgrade[] {
  const available = LEGENDARY_SLOT_UPGRADES.filter(({ id }) => !taken.includes(id) && !conflictsWithTakenPerks(id, taken));
  const choices: typeof available = [];
  while (choices.length < Math.min(2, available.length)) {
    const option = pick(available);
    if (!choices.includes(option)) choices.push(option);
  }
  return choices.map((perk) => ({
    id: perk.id,
    title: perk.title,
    description: perk.description,
    rarity: 'legendary',
    affectedHeroes: [],
    affectedReels: [],
    legendaryId: perk.id,
    apply: cloneMatrix,
  }));
}

export const initialXpMatrix = () => Array.from({ length: 3 }, () => HERO_ORDER.map(() => 1));
export const initialGrid = () => createGrid(initialXpMatrix(), false);
export const spinsPerPreparation = GAME_CONFIG.stage.preparationSpins;
