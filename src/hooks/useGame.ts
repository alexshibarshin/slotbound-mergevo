import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_CONFIG, HEROES, HERO_ORDER } from '../config/gameConfig';
import { getComboMultiplier } from '../game/combo';
import { createCommonSlotUpgradeChoices, createGrid, createLegendarySlotUpgradeChoices, createSmartGrid, findWins, initialGrid, initialXpMatrix, nudgeReel, WINNING_LINES } from '../game/slot';
import type { ComboFeedback, HeroId, HeroPerk, HeroState, LegendarySlotPerkId, NudgeDirection, Phase, RewardFlight, SlotCell, SlotPerkFeedback, SlotUpgrade } from '../types/game';

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
  nudgingDirection: NudgeDirection | null;
  pendingGrid: SlotCell[] | null;
  winningCells: number[];
  winningLines: number[][];
  noMatch: boolean;
  rewardFlights: RewardFlight[];
  comboFeedback: ComboFeedback | null;
  slotPerkFeedback: SlotPerkFeedback[];
  legendarySlotPerks: LegendarySlotPerkId[];
  levelHero: HeroState | null;
  perkChoices: HeroPerk[];
  slotUpgradeChoices: SlotUpgrade[];
  start: () => void;
  spin: () => void;
  nudge: (reel: number, direction?: NudgeDirection) => void;
  beginCombat: () => void;
  damageBase: (amount: number) => void;
  completeWave: () => void;
  chooseHeroPerk: (perk: HeroPerk) => void;
  chooseSlotUpgrade: (upgrade: SlotUpgrade) => void;
}

const freshHeroes = (): HeroState[] => [];
const veteranPerk = (heroId: HeroId): HeroPerk => ({
  id: `${heroId}-veteran-mastery`,
  name: 'Veteran Mastery',
  description: 'Level up and gain +10% base damage scaling',
  rarity: 'epic',
});

export function useGame(): GameController {
  const [phase, setPhase] = useState<Phase>('title');
  const [wave, setWave] = useState(1);
  const [baseHp, setBaseHp] = useState<number>(GAME_CONFIG.base.maxHp);
  const [heroes, setHeroes] = useState<HeroState[]>(freshHeroes);
  const [xpByReel, setXpByReel] = useState(initialXpMatrix);
  const [grid, setGrid] = useState<SlotCell[]>(initialGrid);
  const [spinsLeft, setSpinsLeft] = useState<number>(GAME_CONFIG.stage.preparationSpins);
  const [nudgesLeft, setNudgesLeft] = useState<number>(GAME_CONFIG.stage.nudgesPerPreparation);
  const [nudgeUpgradesTaken, setNudgeUpgradesTaken] = useState(0);
  const [legendarySlotPerks, setLegendarySlotPerks] = useState<LegendarySlotPerkId[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [nudgingReel, setNudgingReel] = useState<number | null>(null);
  const [nudgingDirection, setNudgingDirection] = useState<NudgeDirection | null>(null);
  const [pendingGrid, setPendingGrid] = useState<SlotCell[] | null>(null);
  const [winningCells, setWinningCells] = useState<number[]>([]);
  const [winningLines, setWinningLines] = useState<number[][]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const [rewardFlights, setRewardFlights] = useState<RewardFlight[]>([]);
  const [comboFeedback, setComboFeedback] = useState<ComboFeedback | null>(null);
  const [slotPerkFeedback, setSlotPerkFeedback] = useState<SlotPerkFeedback[]>([]);
  const [levelHero, setLevelHero] = useState<HeroState | null>(null);
  const [perkChoices, setPerkChoices] = useState<HeroPerk[]>([]);
  const [slotUpgradeChoices, setSlotUpgradeChoices] = useState<SlotUpgrade[]>([]);
  const openingSpins = useRef(0);
  const lossStreak = useRef(0);
  const guaranteedNudgeOpportunity = useRef(false);
  const clearTimer = useRef<number | null>(null);
  const comboTimer = useRef<number | null>(null);
  const slotPerkFeedbackTimers = useRef<number[]>([]);
  const successfulSpinsThisWave = useRef(0);
  const perfectNudgeUsedThisWave = useRef(false);
  const trainingDayUsedThisWave = useRef(false);

  const hasLegendary = useCallback((id: LegendarySlotPerkId) => legendarySlotPerks.includes(id), [legendarySlotPerks]);

  const showSlotPerkFeedback = useCallback((items: Array<Omit<SlotPerkFeedback, 'id'>>) => {
    if (!items.length) return;
    const now = Date.now();
    const feedback = items.map((item, index) => ({ ...item, id: now + index }));
    setSlotPerkFeedback(feedback);
    slotPerkFeedbackTimers.current.forEach(window.clearTimeout);
    slotPerkFeedbackTimers.current = [window.setTimeout(() => setSlotPerkFeedback([]), GAME_CONFIG.feedback.comboCelebrationMs)];
  }, []);

  const resetWavePerkTriggers = useCallback(() => {
    successfulSpinsThisWave.current = 0;
    perfectNudgeUsedThisWave.current = false;
    trainingDayUsedThisWave.current = false;
    setSlotPerkFeedback([]);
  }, []);

  const preparationResources = useCallback((perks: LegendarySlotPerkId[], nudgeBonus: number) => {
    let spins = GAME_CONFIG.stage.preparationSpins;
    let nudges = GAME_CONFIG.stage.nudgesPerPreparation + nudgeBonus;
    if (perks.includes('overdrive')) { spins -= 1; nudges += 2; }
    if (perks.includes('rewire')) { spins += nudges; nudges = 0; }
    return { spins, nudges };
  }, []);

  const clearComboFeedback = useCallback(() => {
    if (comboTimer.current) window.clearTimeout(comboTimer.current);
    comboTimer.current = null;
    setComboFeedback(null);
  }, []);

  const start = useCallback(() => {
    const matrix = initialXpMatrix();
    setPhase('preparation'); setWave(1); setBaseHp(GAME_CONFIG.base.maxHp);
    setHeroes([]); setXpByReel(matrix); setGrid(createGrid(matrix));
    setSpinsLeft(GAME_CONFIG.stage.preparationSpins);
    setNudgesLeft(GAME_CONFIG.stage.nudgesPerPreparation);
    setNudgeUpgradesTaken(0);
    setLegendarySlotPerks([]);
    setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]); setLevelHero(null); clearComboFeedback(); resetWavePerkTriggers();
    setSpinning(false); setNudgingReel(null); setNudgingDirection(null); setPendingGrid(null); openingSpins.current = 0;
    lossStreak.current = 0; guaranteedNudgeOpportunity.current = false;
  }, [clearComboFeedback, resetWavePerkTriggers]);

  const awardWins = useCallback((result: SlotCell[], source: 'spin' | 'nudge') => {
    const wins = findWins(result);
    setWinningCells([...new Set(wins.flat())]);
    setWinningLines(wins);
    if (!wins.length) {
      setNoMatch(true);
      window.setTimeout(() => setNoMatch(false), 720);
      return;
    }
    if (source === 'spin') successfulSpinsThisWave.current += 1;
    const risingStarsActive = source === 'spin' && hasLegendary('rising-stars') && successfulSpinsThisWave.current >= 2;
    const precisionTrainingActive = source === 'nudge' && hasLegendary('precision-training');
    const comboMultiplier = getComboMultiplier(wins.length);
    const gained = new Map<HeroId, number>();
    const triggeredGeometry = new Set<LegendarySlotPerkId>();
    wins.forEach((line) => {
      const lineIndex = WINNING_LINES.findIndex((candidate) => candidate.every((cell, index) => cell === line[index]));
      let multiplierBonus = comboMultiplier - 1;
      if (risingStarsActive) multiplierBonus += 1;
      if (precisionTrainingActive) multiplierBonus += 1;
      if (lineIndex <= 2 && hasLegendary('horizontal-fortune')) { multiplierBonus += 1; triggeredGeometry.add('horizontal-fortune'); }
      if (lineIndex >= 3 && lineIndex <= 5 && hasLegendary('vertical-fortune')) { multiplierBonus += 1; triggeredGeometry.add('vertical-fortune'); }
      if (lineIndex >= 6 && hasLegendary('diagonal-fortune')) { multiplierBonus += 2; triggeredGeometry.add('diagonal-fortune'); }
      const lineMultiplier = 1 + multiplierBonus;
      line.forEach((index) => {
        const cell = result[index];
        gained.set(cell.heroId, (gained.get(cell.heroId) ?? 0) + cell.xp * lineMultiplier);
      });
    });
    if (comboMultiplier === 2 || comboMultiplier === 4) {
      const totalXp = [...gained.values()].reduce((sum, xp) => sum + xp, 0);
      if (comboTimer.current) window.clearTimeout(comboTimer.current);
      setComboFeedback({ id: Date.now(), lineCount: wins.length, multiplier: comboMultiplier, totalXp });
      comboTimer.current = window.setTimeout(() => {
        setComboFeedback(null);
        comboTimer.current = null;
      }, GAME_CONFIG.feedback.comboCelebrationMs);
    }
    const perkMessages: Array<Omit<SlotPerkFeedback, 'id'>> = [];
    if (risingStarsActive) perkMessages.push({ label: 'RISING STARS', multiplier: 2 });
    if (precisionTrainingActive) perkMessages.push({ label: 'PRECISION TRAINING', multiplier: 2 });
    if (triggeredGeometry.has('horizontal-fortune')) perkMessages.push({ label: 'HORIZONTAL FORTUNE', multiplier: 2 });
    if (triggeredGeometry.has('vertical-fortune')) perkMessages.push({ label: 'VERTICAL FORTUNE', multiplier: 2 });
    if (triggeredGeometry.has('diagonal-fortune')) perkMessages.push({ label: 'DIAGONAL FORTUNE', multiplier: 3 });

    if (source === 'nudge' && hasLegendary('perfect-nudge') && !perfectNudgeUsedThisWave.current) {
      perfectNudgeUsedThisWave.current = true;
      setNudgesLeft((value) => value + 1);
      perkMessages.push({ label: 'PERFECT NUDGE' });
    }

    if (source === 'spin' && hasLegendary('training-day') && !trainingDayUsedThisWave.current) {
      trainingDayUsedThisWave.current = true;
      const matchedHeroes = new Set(wins.map((line) => result[line[0]].heroId));
      const nextMatrix = xpByReel.map((values) => [...values]);
      matchedHeroes.forEach((heroId) => {
        const heroIndex = HERO_ORDER.indexOf(heroId);
        nextMatrix.forEach((values) => { values[heroIndex] += 1; });
      });
      setXpByReel(nextMatrix);
      setGrid((currentGrid) => currentGrid.map((cell, index) => ({
        ...cell,
        xp: nextMatrix[index % 3][HERO_ORDER.indexOf(cell.heroId)],
      })));
      perkMessages.push({ label: 'TRAINING DAY' });
    }
    showSlotPerkFeedback(perkMessages);
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
  }, [hasLegendary, showSlotPerkFeedback, xpByReel]);

  const spin = useCallback(() => {
    if (phase !== 'preparation' || spinning || spinsLeft <= 0) return;
    clearComboFeedback();
    setSpinning(true); setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]);
    const guaranteed = openingSpins.current < GAME_CONFIG.stage.guaranteedWinningOpeningSpins;
    guaranteedNudgeOpportunity.current = false;
    const smartResult = createSmartGrid(xpByReel, {
      lossStreak: lossStreak.current,
      nudgesAvailable: nudgesLeft,
      guaranteeWin: guaranteed,
    });
    const result = smartResult.grid;
    setNudgingReel(null); setNudgingDirection(null); setPendingGrid(result);
    openingSpins.current += 1;
    window.setTimeout(() => {
      lossStreak.current = findWins(result).length > 0 ? 0 : lossStreak.current + 1;
      guaranteedNudgeOpportunity.current = smartResult.hasGuaranteedNudgeOpportunity;
      setGrid(result); setSpinsLeft((value) => value - 1); setSpinning(false); setPendingGrid(null); awardWins(result, 'spin');
    }, GAME_CONFIG.slot.spinDurationMs);
  }, [awardWins, clearComboFeedback, nudgesLeft, phase, spinning, spinsLeft, xpByReel]);

  const nudge = useCallback((reel: number, direction: NudgeDirection = 'down') => {
    if (phase !== 'preparation' || spinning || nudgesLeft <= 0) return;
    if (direction === 'up' && !GAME_CONFIG.slot.enableUpwardNudge) return;
    clearComboFeedback();
    setSpinning(true); setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]);
    const consumesGuaranteedOpportunity = guaranteedNudgeOpportunity.current;
    guaranteedNudgeOpportunity.current = false;
    const result = nudgeReel(grid, reel, xpByReel, direction);
    setNudgingReel(reel); setNudgingDirection(direction); setPendingGrid(result);
    window.setTimeout(() => {
      if (consumesGuaranteedOpportunity || findWins(result).length > 0) lossStreak.current = 0;
      setGrid(result); setNudgesLeft((value) => Math.max(0, value - 1)); setSpinning(false); setNudgingReel(null); setNudgingDirection(null); setPendingGrid(null); awardWins(result, 'nudge');
    }, GAME_CONFIG.slot.nudgeDurationMs);
  }, [awardWins, clearComboFeedback, grid, nudgesLeft, phase, spinning, xpByReel]);

  const beginCombat = useCallback(() => {
    const heroReady = heroes.some((hero) => hero.xp >= GAME_CONFIG.hero.xpToLevel(hero.level));
    if (phase === 'preparation' && spinsLeft === 0 && !spinning && !levelHero && !heroReady) setPhase('combat');
  }, [heroes, levelHero, phase, spinning, spinsLeft]);

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
      else {
        const legendary = GAME_CONFIG.stage.legendaryUpgradeWaves.includes(wave as 3 | 6 | 9);
        setSlotUpgradeChoices(legendary
          ? createLegendarySlotUpgradeChoices(legendarySlotPerks)
          : createCommonSlotUpgradeChoices(nudgeUpgradesTaken));
        setPhase('slotUpgrade');
      }
    }, GAME_CONFIG.feedback.waveClearMs);
  }, [legendarySlotPerks, nudgeUpgradesTaken, wave]);

  useEffect(() => {
    if (phase !== 'preparation' || spinning || levelHero) return;
    const readyHero = heroes.find((hero) => hero.xp >= GAME_CONFIG.hero.xpToLevel(hero.level));
    if (!readyHero) return;
    const timer = window.setTimeout(() => {
      const available = HEROES[readyHero.id].perks.filter((perk) => !readyHero.perks.includes(perk.id));
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      setLevelHero(readyHero);
      setPerkChoices(available.length ? shuffled.slice(0, GAME_CONFIG.hero.perkChoices) : [veteranPerk(readyHero.id)]);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [heroes, levelHero, phase, spinning]);

  const chooseHeroPerk = useCallback((perk: HeroPerk) => {
    if (!levelHero) return;
    setHeroes((current) => current.map((hero) => hero.id === levelHero.id ? {
      ...hero,
      level: hero.level + 1,
      xp: hero.xp - GAME_CONFIG.hero.xpToLevel(hero.level),
      perks: perk.id.endsWith('-veteran-mastery') ? hero.perks : [...hero.perks, perk.id],
    } : hero));
    setLevelHero(null); setPerkChoices([]);
  }, [levelHero]);

  const chooseSlotUpgrade = useCallback((upgrade: SlotUpgrade) => {
    const matrix = upgrade.apply(xpByReel);
    const nextNudgeUpgradesTaken = Math.min(
      GAME_CONFIG.slotUpgrades.maxNudgeUpgrades,
      nudgeUpgradesTaken + (upgrade.nudgeBonus ?? 0),
    );
    const nextLegendarySlotPerks = upgrade.legendaryId
      ? [...legendarySlotPerks, upgrade.legendaryId]
      : legendarySlotPerks;
    setXpByReel(matrix);
    setNudgeUpgradesTaken(nextNudgeUpgradesTaken);
    setLegendarySlotPerks(nextLegendarySlotPerks);
    setWave((value) => value + 1);
    const resources = preparationResources(nextLegendarySlotPerks, nextNudgeUpgradesTaken);
    setSpinsLeft(resources.spins);
    setNudgesLeft(resources.nudges);
    setGrid(createGrid(matrix));
    guaranteedNudgeOpportunity.current = false;
    resetWavePerkTriggers();
    setSlotUpgradeChoices([]); setPhase('preparation');
  }, [legendarySlotPerks, nudgeUpgradesTaken, preparationResources, resetWavePerkTriggers, xpByReel]);

  return {
    phase, wave, baseHp, heroes, grid, xpByReel, spinsLeft, nudgesLeft, spinning, nudgingReel, nudgingDirection, pendingGrid, winningCells, winningLines, noMatch, rewardFlights, comboFeedback, slotPerkFeedback, legendarySlotPerks,
    levelHero, perkChoices, slotUpgradeChoices, start, spin, nudge, beginCombat, damageBase,
    completeWave, chooseHeroPerk, chooseSlotUpgrade,
  };
}
