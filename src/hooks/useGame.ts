import { useCallback, useRef, useState } from 'react';
import { GAME_CONFIG, HEROES, HERO_ORDER } from '../config/gameConfig';
import { createGrid, createSlotUpgradeChoices, findWins, initialGrid, initialXpMatrix, nudgeReel } from '../game/slot';
import type { HeroId, HeroPerk, HeroState, Phase, RewardFlight, SlotCell, SlotUpgrade } from '../types/game';

export interface GameController {
  phase: Phase;
  wave: number;
  baseHp: number;
  heroes: HeroState[];
  grid: SlotCell[];
  xpByReel: number[][];
  spinsLeft: number;
  nudgesLeft: number;
  spinning: boolean;
  nudgingReel: number | null;
  pendingGrid: SlotCell[] | null;
  winningCells: number[];
  winningLines: number[][];
  noMatch: boolean;
  rewardFlights: RewardFlight[];
  levelHero: HeroState | null;
  perkChoices: HeroPerk[];
  slotUpgradeChoices: SlotUpgrade[];
  start: () => void;
  spin: () => void;
  nudge: (reel: number) => void;
  beginCombat: () => void;
  damageBase: (amount: number) => void;
  completeWave: () => void;
  openLevelUp: (heroId: HeroId) => void;
  chooseHeroPerk: (perk: HeroPerk) => void;
  chooseSlotUpgrade: (upgrade: SlotUpgrade) => void;
  closeLevelUp: () => void;
  moveHero: (heroId: HeroId, toSlot: number) => void;
}

const freshHeroes = (): HeroState[] => [];

export function useGame(): GameController {
  const [phase, setPhase] = useState<Phase>('title');
  const [wave, setWave] = useState(1);
  const [baseHp, setBaseHp] = useState<number>(GAME_CONFIG.base.maxHp);
  const [heroes, setHeroes] = useState<HeroState[]>(freshHeroes);
  const [xpByReel, setXpByReel] = useState(initialXpMatrix);
  const [grid, setGrid] = useState<SlotCell[]>(initialGrid);
  const [spinsLeft, setSpinsLeft] = useState<number>(GAME_CONFIG.stage.preparationSpins);
  const [nudgesLeft, setNudgesLeft] = useState<number>(GAME_CONFIG.stage.nudgesPerPreparation);
  const [spinning, setSpinning] = useState(false);
  const [nudgingReel, setNudgingReel] = useState<number | null>(null);
  const [pendingGrid, setPendingGrid] = useState<SlotCell[] | null>(null);
  const [winningCells, setWinningCells] = useState<number[]>([]);
  const [winningLines, setWinningLines] = useState<number[][]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const [rewardFlights, setRewardFlights] = useState<RewardFlight[]>([]);
  const [levelHero, setLevelHero] = useState<HeroState | null>(null);
  const [perkChoices, setPerkChoices] = useState<HeroPerk[]>([]);
  const [slotUpgradeChoices, setSlotUpgradeChoices] = useState<SlotUpgrade[]>([]);
  const openingSpins = useRef(0);
  const clearTimer = useRef<number | null>(null);

  const start = useCallback(() => {
    const matrix = initialXpMatrix();
    setPhase('preparation'); setWave(1); setBaseHp(GAME_CONFIG.base.maxHp);
    setHeroes([]); setXpByReel(matrix); setGrid(createGrid(matrix));
    setSpinsLeft(GAME_CONFIG.stage.preparationSpins);
    setNudgesLeft(GAME_CONFIG.stage.nudgesPerPreparation);
    setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]); setLevelHero(null);
    setSpinning(false); setNudgingReel(null); setPendingGrid(null); openingSpins.current = 0;
  }, []);

  const awardWins = useCallback((result: SlotCell[]) => {
    const wins = findWins(result);
    setWinningCells([...new Set(wins.flat())]);
    setWinningLines(wins);
    if (!wins.length) {
      setNoMatch(true);
      window.setTimeout(() => setNoMatch(false), 720);
      return;
    }
    const gained = new Map<HeroId, number>();
    wins.forEach((line) => line.forEach((index) => {
      const cell = result[index];
      gained.set(cell.heroId, (gained.get(cell.heroId) ?? 0) + cell.xp);
    }));
    setHeroes((current) => {
      const next = current.map((hero) => ({ ...hero }));
      const flights: RewardFlight[] = [];
      gained.forEach((xp, id) => {
        const existing = next.find((hero) => hero.id === id);
        if (existing) { existing.xp += xp; flights.push({ id: Date.now() + flights.length, heroId: id, xp, fromIndex: wins[0][1], toSlot: existing.slot }); }
        else {
          const used = new Set(next.map((hero) => hero.slot));
          const firstEmpty = [0, 1, 2, 3, 4, 5].find((slot) => !used.has(slot));
          if (firstEmpty !== undefined) {
            next.push({ id, level: 1, xp, slot: firstEmpty, perks: [] });
            flights.push({ id: Date.now() + flights.length, heroId: id, xp, fromIndex: wins[0][1], toSlot: firstEmpty });
          }
        }
      });
      window.setTimeout(() => {
        setRewardFlights(flights);
        window.setTimeout(() => setRewardFlights([]), GAME_CONFIG.feedback.rewardFlightMs);
      }, GAME_CONFIG.feedback.rewardDelayMs);
      return next;
    });
    window.setTimeout(() => { setWinningCells([]); setWinningLines([]); }, GAME_CONFIG.feedback.winHighlightMs);
  }, []);

  const spin = useCallback(() => {
    if (phase !== 'preparation' || spinning || spinsLeft <= 0) return;
    setSpinning(true); setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]);
    const guaranteed = openingSpins.current < GAME_CONFIG.stage.guaranteedWinningOpeningSpins;
    const result = createGrid(xpByReel, guaranteed);
    setNudgingReel(null); setPendingGrid(result);
    openingSpins.current += 1;
    window.setTimeout(() => {
      setGrid(result); setSpinsLeft((value) => value - 1); setSpinning(false); setPendingGrid(null); awardWins(result);
    }, GAME_CONFIG.slot.spinDurationMs);
  }, [awardWins, phase, spinning, spinsLeft, xpByReel]);

  const nudge = useCallback((reel: number) => {
    if (phase !== 'preparation' || spinning || nudgesLeft <= 0) return;
    setSpinning(true); setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]);
    const result = nudgeReel(grid, reel, xpByReel);
    setNudgingReel(reel); setPendingGrid(result);
    window.setTimeout(() => {
      setGrid(result); setNudgesLeft(0); setSpinning(false); setNudgingReel(null); setPendingGrid(null); awardWins(result);
    }, GAME_CONFIG.slot.nudgeDurationMs);
  }, [awardWins, grid, nudgesLeft, phase, spinning, xpByReel]);

  const beginCombat = useCallback(() => {
    if (phase === 'preparation' && spinsLeft === 0 && !spinning) setPhase('combat');
  }, [phase, spinning, spinsLeft]);

  const damageBase = useCallback((amount: number) => {
    setBaseHp((hp) => {
      const next = Math.max(0, hp - amount);
      if (next <= 0) setPhase('defeat');
      return next;
    });
  }, []);

  const completeWave = useCallback(() => {
    setPhase('waveClear');
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      if (wave >= GAME_CONFIG.stage.totalWaves) setPhase('victory');
      else { setSlotUpgradeChoices(createSlotUpgradeChoices()); setPhase('slotUpgrade'); }
    }, GAME_CONFIG.feedback.waveClearMs);
  }, [wave]);

  const openLevelUp = useCallback((heroId: HeroId) => {
    const hero = heroes.find((candidate) => candidate.id === heroId);
    if (!hero || hero.xp < GAME_CONFIG.hero.xpToLevel(hero.level)) return;
    const available = HEROES[heroId].perks.filter((perk) => !hero.perks.includes(perk.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    setLevelHero(hero); setPerkChoices(shuffled.slice(0, GAME_CONFIG.hero.perkChoices));
  }, [heroes]);

  const chooseHeroPerk = useCallback((perk: HeroPerk) => {
    if (!levelHero) return;
    setHeroes((current) => current.map((hero) => hero.id === levelHero.id ? {
      ...hero,
      level: hero.level + 1,
      xp: hero.xp - GAME_CONFIG.hero.xpToLevel(hero.level),
      perks: [...hero.perks, perk.id],
    } : hero));
    setLevelHero(null); setPerkChoices([]);
  }, [levelHero]);

  const chooseSlotUpgrade = useCallback((upgrade: SlotUpgrade) => {
    const matrix = upgrade.apply(xpByReel);
    setXpByReel(matrix); setGrid((current) => current.map((cell, index) => ({
      ...cell, xp: matrix[index % 3][HERO_ORDER.indexOf(cell.heroId)],
    })));
    setWave((value) => value + 1);
    setSpinsLeft(GAME_CONFIG.stage.preparationSpins);
    setNudgesLeft(GAME_CONFIG.stage.nudgesPerPreparation);
    setSlotUpgradeChoices([]); setPhase('preparation');
  }, [xpByReel]);

  const moveHero = useCallback((heroId: HeroId, toSlot: number) => {
    setHeroes((current) => {
      const moving = current.find((hero) => hero.id === heroId);
      if (!moving || moving.slot === toSlot) return current;
      const displaced = current.find((hero) => hero.slot === toSlot);
      return current.map((hero) => {
        if (hero.id === heroId) return { ...hero, slot: toSlot };
        if (displaced && hero.id === displaced.id) return { ...hero, slot: moving.slot };
        return hero;
      });
    });
  }, []);

  return {
    phase, wave, baseHp, heroes, grid, xpByReel, spinsLeft, nudgesLeft, spinning, nudgingReel, pendingGrid, winningCells, winningLines, noMatch, rewardFlights,
    levelHero, perkChoices, slotUpgradeChoices, start, spin, nudge, beginCombat, damageBase,
    completeWave, openLevelUp, chooseHeroPerk, chooseSlotUpgrade,
    closeLevelUp: () => { setLevelHero(null); setPerkChoices([]); }, moveHero,
  };
}
