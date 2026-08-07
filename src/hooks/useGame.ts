import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_CONFIG, HEROES, HERO_ORDER, PEDESTAL_POSITIONS } from '../config/gameConfig';
import { getComboMultiplier } from '../game/combo';
import { createGrid, createSlotUpgradeChoices, findWins, initialGrid, initialXpMatrix, nudgeReel } from '../game/slot';
import type { CombatReward, ComboFeedback, HeroPerk, HeroState, NudgeDirection, Phase, RewardFlight, SlotCell, SlotUpgrade } from '../types/game';

export interface GameController {
  phase: Phase;
  wave: number;
  baseHp: number;
  heroes: HeroState[];
  grid: SlotCell[];
  xpByReel: number[][];
  spinsLeft: number;
  nudgesLeft: number;
  slotLevel: number;
  slotXp: number;
  slotXpRequired: number;
  slotReady: boolean;
  heroReadyId: HeroState['id'] | null;
  spinning: boolean;
  resolvingRewards: boolean;
  paused: boolean;
  betweenWaves: boolean;
  nudgingReel: number | null;
  nudgingDirection: NudgeDirection | null;
  pendingGrid: SlotCell[] | null;
  winningCells: number[];
  winningLines: number[][];
  noMatch: boolean;
  rewardFlights: RewardFlight[];
  comboFeedback: ComboFeedback | null;
  levelHero: HeroState | null;
  perkChoices: HeroPerk[];
  slotUpgradeChoices: SlotUpgrade[];
  start: () => void;
  spin: () => void;
  nudge: (reel: number, direction?: NudgeDirection) => void;
  damageBase: (amount: number) => void;
  completeWave: () => void;
  defeatEnemy: (reward: CombatReward | undefined, slotXp: number) => void;
  chooseHeroPerk: (perk: HeroPerk) => void;
  chooseSlotUpgrade: (upgrade: SlotUpgrade) => void;
}

const freshHeroes = (): HeroState[] => [];
const wait = (durationMs: number) => new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
const veteranPerk = (heroId: HeroState['id']): HeroPerk => ({
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
  const [spinsLeft, setSpinsLeft] = useState<number>(GAME_CONFIG.stage.startingSpins);
  const [nudgesLeft, setNudgesLeft] = useState<number>(GAME_CONFIG.stage.startingNudges);
  const [slotLevel, setSlotLevel] = useState(1);
  const [slotXp, setSlotXp] = useState(0);
  const [slotReady, setSlotReady] = useState(false);
  const [heroReadyId, setHeroReadyId] = useState<HeroState['id'] | null>(null);
  const [nudgeUpgradesTaken, setNudgeUpgradesTaken] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resolvingRewards, setResolvingRewards] = useState(false);
  const [betweenWaves, setBetweenWaves] = useState(false);
  const [nudgingReel, setNudgingReel] = useState<number | null>(null);
  const [nudgingDirection, setNudgingDirection] = useState<NudgeDirection | null>(null);
  const [pendingGrid, setPendingGrid] = useState<SlotCell[] | null>(null);
  const [winningCells, setWinningCells] = useState<number[]>([]);
  const [winningLines, setWinningLines] = useState<number[][]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const [rewardFlights, setRewardFlights] = useState<RewardFlight[]>([]);
  const [comboFeedback, setComboFeedback] = useState<ComboFeedback | null>(null);
  const [levelHero, setLevelHero] = useState<HeroState | null>(null);
  const [perkChoices, setPerkChoices] = useState<HeroPerk[]>([]);
  const [slotUpgradeChoices, setSlotUpgradeChoices] = useState<SlotUpgrade[]>([]);
  const openingSpins = useRef(0);
  const waveTimer = useRef<number | null>(null);
  const heroReadyTimer = useRef<number | null>(null);
  const slotReadyTimer = useRef<number | null>(null);
  const presentationSequence = useRef(0);
  const heroesRef = useRef<HeroState[]>(heroes);
  const phaseRef = useRef<Phase>(phase);
  const slotXpRequired = GAME_CONFIG.slotProgression.xpForLevel(slotLevel);
  const readyHero = heroes.find((hero) => hero.xp >= GAME_CONFIG.hero.xpToLevel(hero.level));
  const paused = levelHero !== null || slotUpgradeChoices.length > 0;

  useEffect(() => { heroesRef.current = heroes; }, [heroes]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => () => {
    presentationSequence.current += 1;
    if (waveTimer.current) window.clearTimeout(waveTimer.current);
    if (heroReadyTimer.current) window.clearTimeout(heroReadyTimer.current);
    if (slotReadyTimer.current) window.clearTimeout(slotReadyTimer.current);
  }, []);

  const start = useCallback(() => {
    const matrix = initialXpMatrix();
    presentationSequence.current += 1;
    if (waveTimer.current) window.clearTimeout(waveTimer.current);
    if (heroReadyTimer.current) window.clearTimeout(heroReadyTimer.current);
    if (slotReadyTimer.current) window.clearTimeout(slotReadyTimer.current);
    waveTimer.current = null; heroReadyTimer.current = null; slotReadyTimer.current = null;
    phaseRef.current = 'combat'; setPhase('combat'); setWave(1); setBaseHp(GAME_CONFIG.base.maxHp);
    heroesRef.current = []; setHeroes([]); setXpByReel(matrix); setGrid(createGrid(matrix));
    setSpinsLeft(GAME_CONFIG.stage.startingSpins); setNudgesLeft(GAME_CONFIG.stage.startingNudges);
    setSlotLevel(1); setSlotXp(0); setSlotReady(false); setHeroReadyId(null); setNudgeUpgradesTaken(0); setBetweenWaves(false);
    setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]); setComboFeedback(null);
    setLevelHero(null); setPerkChoices([]); setSlotUpgradeChoices([]); setResolvingRewards(false);
    setSpinning(false); setNudgingReel(null); setNudgingDirection(null); setPendingGrid(null); openingSpins.current = 0;
  }, []);

  const awardWins = useCallback(async (result: SlotCell[], previousGrid?: SlotCell[]) => {
    const wins = findWins(result);
    if (!wins.length) {
      setNoMatch(true);
      window.setTimeout(() => setNoMatch(false), 720);
      return;
    }

    const sequence = ++presentationSequence.current;
    setResolvingRewards(true); setComboFeedback(null); setRewardFlights([]);
    const previousWinKeys = new Set((previousGrid ? findWins(previousGrid) : []).map((line) => `${line.join('-')}:${previousGrid?.[line[0]].heroId}`));
    const cumulativeBase = new Map<HeroState['id'], number>();
    const delivered = new Map<HeroState['id'], number>();
    let sequenceHeroes = heroesRef.current.map((hero) => ({ ...hero }));

    for (let lineIndex = 0; lineIndex < wins.length; lineIndex += 1) {
      if (presentationSequence.current !== sequence) return;
      const line = wins[lineIndex];
      setWinningLines([line]); setWinningCells([...line]);
      const lineKey = `${line.join('-')}:${result[line[0]].heroId}`;
      if (!previousWinKeys.has(lineKey)) {
        line.forEach((cellIndex) => {
          const cell = result[cellIndex];
          cumulativeBase.set(cell.heroId, (cumulativeBase.get(cell.heroId) ?? 0) + cell.xp);
        });
      }

      const multiplier = getComboMultiplier(lineIndex + 1);
      const increments = new Map<HeroState['id'], number>();
      cumulativeBase.forEach((baseXp, heroId) => {
        const desiredTotal = baseXp * multiplier;
        const increment = desiredTotal - (delivered.get(heroId) ?? 0);
        if (increment > 0) increments.set(heroId, increment);
        delivered.set(heroId, desiredTotal);
      });
      const totalIncrement = [...increments.values()].reduce((sum, value) => sum + value, 0);
      if (multiplier === 2 || multiplier === 4) {
        setComboFeedback({ id: Date.now() + lineIndex, lineCount: lineIndex + 1, multiplier, totalXp: totalIncrement });
      } else setComboFeedback(null);

      let spawnedHero = false;
      increments.forEach((_, heroId) => {
        if (sequenceHeroes.some((hero) => hero.id === heroId) || sequenceHeroes.length >= PEDESTAL_POSITIONS.length) return;
        sequenceHeroes.push({ id: heroId, level: 1, xp: 0, slot: sequenceHeroes.length, perks: [] });
        spawnedHero = true;
      });
      if (spawnedHero) {
        heroesRef.current = sequenceHeroes; setHeroes(sequenceHeroes.map((hero) => ({ ...hero })));
      }

      await wait(spawnedHero ? GAME_CONFIG.feedback.heroSpawnLeadMs : GAME_CONFIG.feedback.lineRevealMs);
      if (presentationSequence.current !== sequence) return;
      await wait(GAME_CONFIG.feedback.rewardDelayMs);
      if (presentationSequence.current !== sequence) return;

      const flights: RewardFlight[] = [];
      increments.forEach((xp, heroId) => {
        const target = sequenceHeroes.find((hero) => hero.id === heroId);
        if (target) flights.push({ id: Date.now() + flights.length, heroId, xp, fromIndex: line[1], toSlot: target.slot });
      });
      setRewardFlights(flights);
      await wait(flights.length ? GAME_CONFIG.feedback.rewardFlightMs : GAME_CONFIG.feedback.lineRevealMs);
      if (presentationSequence.current !== sequence) return;

      sequenceHeroes = sequenceHeroes.map((hero) => ({ ...hero, xp: hero.xp + (increments.get(hero.id) ?? 0) }));
      heroesRef.current = sequenceHeroes; setHeroes(sequenceHeroes.map((hero) => ({ ...hero }))); setRewardFlights([]);
      await wait(GAME_CONFIG.feedback.heroXpFillMs);
    }

    if (presentationSequence.current !== sequence) return;
    setWinningCells([]); setWinningLines([]); setResolvingRewards(false);
    window.setTimeout(() => {
      if (presentationSequence.current === sequence) setComboFeedback(null);
    }, 420);
  }, []);

  const spin = useCallback(() => {
    if (phase !== 'combat' || paused || resolvingRewards || heroReadyId || slotReady || spinning || spinsLeft <= 0) return;
    setComboFeedback(null); setSpinning(true); setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]);
    const guaranteed = openingSpins.current < GAME_CONFIG.stage.guaranteedWinningOpeningSpins;
    const result = createGrid(xpByReel, guaranteed);
    setNudgingReel(null); setNudgingDirection(null); setPendingGrid(result); openingSpins.current += 1;
    window.setTimeout(() => {
      setGrid(result); setSpinsLeft((value) => value - 1); setSpinning(false); setPendingGrid(null); void awardWins(result);
    }, GAME_CONFIG.slot.spinDurationMs);
  }, [awardWins, heroReadyId, paused, phase, resolvingRewards, slotReady, spinning, spinsLeft, xpByReel]);

  const nudge = useCallback((reel: number, direction: NudgeDirection = 'down') => {
    if (phase !== 'combat' || paused || resolvingRewards || heroReadyId || slotReady || spinning || nudgesLeft <= 0) return;
    if (direction === 'up' && !GAME_CONFIG.slot.enableUpwardNudge) return;
    setComboFeedback(null); setSpinning(true); setWinningCells([]); setWinningLines([]); setNoMatch(false); setRewardFlights([]);
    const result = nudgeReel(grid, reel, xpByReel, direction);
    setNudgingReel(reel); setNudgingDirection(direction); setPendingGrid(result);
    window.setTimeout(() => {
      setGrid(result); setNudgesLeft((value) => Math.max(0, value - 1)); setSpinning(false); setNudgingReel(null); setNudgingDirection(null); setPendingGrid(null); void awardWins(result, grid);
    }, GAME_CONFIG.slot.nudgeDurationMs);
  }, [awardWins, grid, heroReadyId, nudgesLeft, paused, phase, resolvingRewards, slotReady, spinning, xpByReel]);

  const damageBase = useCallback((amount: number) => {
    setBaseHp((hp) => {
      const next = Math.max(0, hp - amount);
      if (next <= 0) { phaseRef.current = 'defeat'; setPhase('defeat'); }
      return next;
    });
  }, []);

  const completeWave = useCallback(() => {
    setBetweenWaves(true);
    if (waveTimer.current) window.clearTimeout(waveTimer.current);
    waveTimer.current = window.setTimeout(() => {
      if (wave >= GAME_CONFIG.stage.totalWaves) {
        if (phaseRef.current !== 'defeat') { phaseRef.current = 'victory'; setPhase('victory'); }
      } else setWave((value) => value + 1);
      setBetweenWaves(false); waveTimer.current = null;
    }, GAME_CONFIG.stage.intermissionMs);
  }, [wave]);

  const defeatEnemy = useCallback((reward: CombatReward | undefined, gainedSlotXp: number) => {
    setSlotXp((value) => value + gainedSlotXp);
    if (reward === 'spin') setSpinsLeft((value) => value + 1);
    if (reward === 'nudge') setNudgesLeft((value) => value + 1);
  }, []);

  useEffect(() => {
    if (phase !== 'combat' || resolvingRewards || levelHero || slotUpgradeChoices.length || heroReadyId || slotReady || !readyHero) return;
    setHeroReadyId(readyHero.id);
    heroReadyTimer.current = window.setTimeout(() => {
      if (phaseRef.current !== 'combat') return;
      const currentHero = heroesRef.current.find((hero) => hero.id === readyHero.id);
      if (!currentHero) return;
      const available = HEROES[currentHero.id].perks.filter((perk) => !currentHero.perks.includes(perk.id));
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      setLevelHero(currentHero);
      setPerkChoices(available.length ? shuffled.slice(0, GAME_CONFIG.hero.perkChoices) : [veteranPerk(currentHero.id)]);
      setHeroReadyId(null); heroReadyTimer.current = null;
    }, GAME_CONFIG.feedback.heroReadyHoldMs);
  }, [heroReadyId, levelHero, phase, readyHero, resolvingRewards, slotReady, slotUpgradeChoices.length]);

  useEffect(() => {
    if (phase !== 'combat' || spinning || resolvingRewards || levelHero || readyHero || heroReadyId || slotUpgradeChoices.length || slotReady || slotXp < slotXpRequired) return;
    const timer = window.setTimeout(() => setSlotReady(true), GAME_CONFIG.feedback.slotXpFillMs);
    slotReadyTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (slotReadyTimer.current === timer) slotReadyTimer.current = null;
    };
  }, [heroReadyId, levelHero, phase, readyHero, resolvingRewards, slotReady, slotUpgradeChoices.length, slotXp, slotXpRequired, spinning]);

  useEffect(() => {
    if (phase !== 'combat' || !slotReady) return;
    const timer = window.setTimeout(() => {
      if (phaseRef.current !== 'combat') return;
      setSlotUpgradeChoices(createSlotUpgradeChoices(nudgeUpgradesTaken));
      setSlotReady(false); slotReadyTimer.current = null;
    }, GAME_CONFIG.feedback.slotReadyHoldMs);
    slotReadyTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (slotReadyTimer.current === timer) slotReadyTimer.current = null;
    };
  }, [nudgeUpgradesTaken, phase, slotReady]);

  const chooseHeroPerk = useCallback((perk: HeroPerk) => {
    if (!levelHero) return;
    setHeroes((current) => {
      const next = current.map((hero) => hero.id === levelHero.id ? {
        ...hero, level: hero.level + 1, xp: hero.xp - GAME_CONFIG.hero.xpToLevel(hero.level),
        perks: perk.id.endsWith('-veteran-mastery') ? hero.perks : [...hero.perks, perk.id],
      } : hero);
      heroesRef.current = next; return next;
    });
    setLevelHero(null); setPerkChoices([]);
  }, [levelHero]);

  const chooseSlotUpgrade = useCallback((upgrade: SlotUpgrade) => {
    const matrix = upgrade.apply(xpByReel);
    const nextNudgeUpgradesTaken = Math.min(GAME_CONFIG.slotUpgrades.maxNudgeUpgrades, nudgeUpgradesTaken + (upgrade.nudgeBonus ?? 0));
    setXpByReel(matrix);
    setGrid((current) => current.map((cell, index) => ({ ...cell, xp: matrix[index % 3][HERO_ORDER.indexOf(cell.heroId)] })));
    setNudgeUpgradesTaken(nextNudgeUpgradesTaken);
    if (upgrade.nudgeBonus) setNudgesLeft((value) => value + upgrade.nudgeBonus!);
    setSlotXp((value) => Math.max(0, value - slotXpRequired)); setSlotLevel((value) => value + 1);
    setSlotUpgradeChoices([]); setSlotReady(false);
  }, [nudgeUpgradesTaken, slotXpRequired, xpByReel]);

  return {
    phase, wave, baseHp, heroes, grid, xpByReel, spinsLeft, nudgesLeft, slotLevel, slotXp, slotXpRequired, slotReady, heroReadyId,
    spinning, resolvingRewards, paused, betweenWaves, nudgingReel, nudgingDirection, pendingGrid, winningCells, winningLines,
    noMatch, rewardFlights, comboFeedback, levelHero, perkChoices, slotUpgradeChoices,
    start, spin, nudge, damageBase, completeWave, defeatEnemy, chooseHeroPerk, chooseSlotUpgrade,
  };
}
