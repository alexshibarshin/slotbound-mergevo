import { GAME_CONFIG, HERO_ORDER } from '../config/gameConfig';
import type { HeroId, NudgeDirection, SlotCell, SlotUpgrade } from '../types/game';

export const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

const randomHero = (): HeroId => HERO_ORDER[Math.floor(Math.random() * HERO_ORDER.length)];

export function createGrid(xpByReel: number[][], guaranteeWin = false): SlotCell[] {
  const heroes = Array.from({ length: 9 }, randomHero);
  if (guaranteeWin) {
    const winner = randomHero();
    const line = WINNING_LINES[Math.floor(Math.random() * WINNING_LINES.length)];
    line.forEach((index) => { heroes[index] = winner; });
  }
  return heroes.map((heroId, index) => ({
    heroId,
    xp: xpByReel[index % 3][HERO_ORDER.indexOf(heroId)],
  }));
}

export function nudgeReel(grid: SlotCell[], reel: number, xpByReel: number[][], direction: NudgeDirection = 'down'): SlotCell[] {
  const next = [...grid];
  const heroId = randomHero();
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

const cloneMatrix = (matrix: number[][]) => matrix.map((row) => [...row]);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export function createSlotUpgradeChoices(): SlotUpgrade[] {
  const reel = Math.floor(Math.random() * 3);
  const secondReel = (reel + 1 + Math.floor(Math.random() * 2)) % 3;
  const heroIndex = Math.floor(Math.random() * HERO_ORDER.length);
  const secondHero = (heroIndex + 1 + Math.floor(Math.random() * 4)) % HERO_ORDER.length;
  const hero = HERO_ORDER[heroIndex];
  const hero2 = HERO_ORDER[secondHero];
  const all: SlotUpgrade[] = [
    {
      id: `focus-${reel}-${hero}`,
      title: 'Focused Etching',
      description: `${heroLabel(hero)} symbols on reel ${reel + 1} gain +${GAME_CONFIG.slotUpgrades.focusedXp} XP`,
      affectedHeroes: [hero], affectedReels: [reel],
      apply: (matrix) => { const next = cloneMatrix(matrix); next[reel][heroIndex] += GAME_CONFIG.slotUpgrades.focusedXp; return next; },
    },
    {
      id: `link-${reel}-${secondReel}-${hero}`,
      title: 'Linked Reels',
      description: `${heroLabel(hero)} symbols on reels ${reel + 1} and ${secondReel + 1} gain +${GAME_CONFIG.slotUpgrades.linkedXp} XP`,
      affectedHeroes: [hero], affectedReels: [reel, secondReel],
      apply: (matrix) => { const next = cloneMatrix(matrix); next[reel][heroIndex] += GAME_CONFIG.slotUpgrades.linkedXp; next[secondReel][heroIndex] += GAME_CONFIG.slotUpgrades.linkedXp; return next; },
    },
    {
      id: `pair-${reel}-${hero}-${hero2}`,
      title: 'Twin Blessing',
      description: `${heroLabel(hero)} and ${heroLabel(hero2)} on reel ${reel + 1} gain +${GAME_CONFIG.slotUpgrades.pairedXp} XP`,
      affectedHeroes: [hero, hero2], affectedReels: [reel],
      apply: (matrix) => { const next = cloneMatrix(matrix); next[reel][heroIndex] += GAME_CONFIG.slotUpgrades.pairedXp; next[reel][secondHero] += GAME_CONFIG.slotUpgrades.pairedXp; return next; },
    },
    {
      id: `reel-${reel}`,
      title: 'Golden Reel',
      description: `Every symbol on reel ${reel + 1} gains +${GAME_CONFIG.slotUpgrades.wholeReelXp} XP`,
      affectedHeroes: [], affectedReels: [reel],
      apply: (matrix) => { const next = cloneMatrix(matrix); next[reel] = next[reel].map((v) => v + GAME_CONFIG.slotUpgrades.wholeReelXp); return next; },
    },
    {
      id: `wild-${reel}-${hero}`,
      title: 'Wild Spark',
      description: `${heroLabel(hero)} on reel ${reel + 1} surges with +${GAME_CONFIG.slotUpgrades.wildXp} XP`,
      affectedHeroes: [hero], affectedReels: [reel],
      apply: (matrix) => { const next = cloneMatrix(matrix); next[reel][heroIndex] += GAME_CONFIG.slotUpgrades.wildXp; return next; },
    },
  ];
  const choices: SlotUpgrade[] = [];
  while (choices.length < 3) {
    const option = pick(all);
    if (!choices.includes(option)) choices.push(option);
  }
  return choices;
}

function heroLabel(id: HeroId): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export const initialXpMatrix = () => Array.from({ length: 3 }, () => HERO_ORDER.map(() => 1));
export const initialGrid = () => createGrid(initialXpMatrix(), false);
export const spinsPerPreparation = GAME_CONFIG.stage.preparationSpins;
