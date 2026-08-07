import { GAME_CONFIG, HEROES, HERO_ORDER, PEDESTAL_POSITIONS } from '../src/config/gameConfig.ts';
import { combatDistance, getAbilityTargets } from '../src/game/combat.ts';
import { getComboMultiplier } from '../src/game/combo.ts';
import { calculateHeroStats } from '../src/game/statsCore.ts';
import type { CombatReward, HeroId, HeroPerk, HeroState } from '../src/types/game.ts';

type Strategy = 'random' | 'reasonable';
type Rng = () => number;
type SimEnemy = {
  type: 'minion' | 'elite' | 'boss';
  x: number;
  y: number;
  hp: number;
  speed: number;
  damage: number;
  reward?: CombatReward;
  isSieging?: boolean;
  nextBaseAttackAt?: number;
};
type PendingSlotAction = { kind: 'spin' | 'nudge' | 'feedback'; readyAt: number; reel?: number };
type RunState = {
  hp: number;
  heroes: HeroState[];
  matrix: number[][];
  grid: HeroId[];
  spins: number;
  nudges: number;
  slotLevel: number;
  slotXp: number;
  openingSpins: number;
  levelUps: number;
  slotUpgrades: number;
  spinsSpent: number;
  nudgesSpent: number;
  spinsEarned: number;
  nudgesEarned: number;
};
type WaveResult = {
  hpLost: number;
  leaks: number;
  deepestProgress: number;
  averageKillY: number;
  durationMs: number;
  spinsSpent: number;
  nudgesSpent: number;
  spinsEarned: number;
  nudgesEarned: number;
};
type RunResult = {
  won: boolean;
  deathWave: number | null;
  hp: number;
  levels: number[];
  levelUps: number;
  slotLevel: number;
  recruited: number;
  spinsRemaining: number;
  nudgesRemaining: number;
  waves: WaveResult[];
};

const runs = Number.parseInt(process.argv[2] ?? '2500', 10);
const seed = Number.parseInt(process.argv[3] ?? '731993', 10);
const REASONABLE_DECISION_ACCURACY = 0.86;
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

function mulberry32(initialSeed: number): Rng {
  let state = initialSeed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];
const shuffle = <T>(items: readonly T[], rng: Rng): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};
const initialMatrix = () => Array.from({ length: 3 }, () => HERO_ORDER.map(() => 1));
const getHeroStats = (hero: HeroState) => calculateHeroStats(hero, HEROES[hero.id]);

function makeGrid(matrix: number[][], rng: Rng, guaranteeWin: boolean): HeroId[] {
  const grid = Array.from({ length: 9 }, () => pick(HERO_ORDER, rng));
  if (guaranteeWin) {
    const winner = pick(HERO_ORDER, rng);
    pick(WINNING_LINES, rng).forEach((index) => { grid[index] = winner; });
  }
  return grid;
}

function nudgeGrid(grid: HeroId[], reel: number, rng: Rng): HeroId[] {
  const next = [...grid];
  next[reel + 6] = next[reel + 3]; next[reel + 3] = next[reel]; next[reel] = pick(HERO_ORDER, rng);
  return next;
}

function winningLines(grid: HeroId[]) {
  return WINNING_LINES.filter(([a, b, c]) => grid[a] === grid[b] && grid[b] === grid[c]);
}

function heroPriority(id: HeroId, heroes: HeroState[]): number {
  const hero = heroes.find((candidate) => candidate.id === id);
  if (!hero) return 1.3;
  return 1 / (1 + Math.max(0, hero.level - 1) * 0.16);
}

function nudgeScore(grid: HeroId[], reel: number, matrix: number[][], heroes: HeroState[]): number {
  let expected = 0;
  const previousWinKeys = new Set(winningLines(grid).map((line) => `${line.join('-')}:${grid[line[0]]}`));
  for (const newHero of HERO_ORDER) {
    const next = [...grid];
    next[reel + 6] = next[reel + 3]; next[reel + 3] = next[reel]; next[reel] = newHero;
    const wins = winningLines(next);
    const rewardWins = wins.filter((line) => !previousWinKeys.has(`${line.join('-')}:${next[line[0]]}`));
    const multiplier = getComboMultiplier(wins.length);
    expected += rewardWins.reduce((sum, line) => sum + line.reduce((lineSum, index) => {
      const id = next[index];
      return lineSum + matrix[index % 3][HERO_ORDER.indexOf(id)] * heroPriority(id, heroes) * multiplier;
    }, 0), 0) / HERO_ORDER.length;
  }
  return expected;
}

function perkPower(hero: HeroState, perk: HeroPerk): number {
  const before = getHeroStats(hero);
  const after = getHeroStats({ ...hero, level: hero.level + 1, perks: [...hero.perks, perk.id] });
  const ability = HEROES[hero.id].ability;
  const targetFactor = (stats: typeof before) => {
    if (ability === 'missile') return Math.max(1, stats.pierce);
    if (ability === 'fireball') return 1 + stats.aoeRadius * 0.38;
    if (ability === 'icicle') return Math.min(stats.pierce, 1 + stats.beamWidth * 0.65);
    if (ability === 'sector') return 1 + stats.aoeRadius * 0.42;
    return 1 + stats.beamWidth * 0.38;
  };
  const score = (stats: typeof before) => stats.damage / stats.attackIntervalMs * targetFactor(stats) * (0.65 + Math.min(stats.range, 55) / 100);
  return score(after) / score(before);
}

function processLevels(state: RunState, strategy: Strategy, rng: Rng): number {
  let levelsGained = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const hero of state.heroes) {
      const cost = GAME_CONFIG.hero.xpToLevel(hero.level);
      if (hero.xp < cost) continue;
      const available = HEROES[hero.id].perks.filter((perk) => !hero.perks.includes(perk.id));
      const veteran: HeroPerk = { id: `${hero.id}-veteran-mastery`, name: 'Veteran Mastery', description: '', rarity: 'epic' };
      const offered = available.length ? shuffle(available, rng).slice(0, GAME_CONFIG.hero.perkChoices) : [veteran];
      const best = [...offered].sort((a, b) => perkPower(hero, b) - perkPower(hero, a))[0];
      const selected = strategy === 'reasonable' && rng() < REASONABLE_DECISION_ACCURACY ? best : pick(offered, rng);
      hero.xp -= cost; hero.level += 1;
      if (!selected.id.endsWith('-veteran-mastery')) hero.perks.push(selected.id);
      state.levelUps += 1; levelsGained += 1; changed = true;
    }
  }
  return levelsGained;
}

function awardGrid(state: RunState, grid: HeroId[], strategy: Strategy, rng: Rng, previousGrid?: HeroId[]) {
  const gained = new Map<HeroId, number>();
  const previousWinKeys = new Set((previousGrid ? winningLines(previousGrid) : []).map((line) => `${line.join('-')}:${previousGrid?.[line[0]]}`));
  const wins = winningLines(grid);
  const rewardWins = wins.filter((line) => !previousWinKeys.has(`${line.join('-')}:${grid[line[0]]}`));
  const multiplier = getComboMultiplier(wins.length);
  rewardWins.forEach((line) => line.forEach((index) => {
    const id = grid[index];
    gained.set(id, (gained.get(id) ?? 0) + state.matrix[index % 3][HERO_ORDER.indexOf(id)] * multiplier);
  }));
  gained.forEach((xp, id) => {
    const hero = state.heroes.find((candidate) => candidate.id === id);
    if (hero) hero.xp += xp;
    else if (state.heroes.length < PEDESTAL_POSITIONS.length) state.heroes.push({ id, level: 1, xp, slot: state.heroes.length, perks: [] });
  });
  return { lineCount: wins.length, levelsGained: processLevels(state, strategy, rng) };
}

type Upgrade = { additions: Array<{ reel: number; hero: number; amount: number }>; nudge?: boolean };
function chooseSlotUpgrade(state: RunState, strategy: Strategy, rng: Rng) {
  const reel = Math.floor(rng() * 3);
  const secondReel = (reel + 1 + Math.floor(rng() * 2)) % 3;
  const hero = Math.floor(rng() * HERO_ORDER.length);
  const secondHero = (hero + 1 + Math.floor(rng() * (HERO_ORDER.length - 1))) % HERO_ORDER.length;
  const pool: Upgrade[] = [
    { additions: [{ reel, hero, amount: GAME_CONFIG.slotUpgrades.focusedXp }] },
    { additions: [{ reel, hero, amount: GAME_CONFIG.slotUpgrades.linkedXp }, { reel: secondReel, hero, amount: GAME_CONFIG.slotUpgrades.linkedXp }] },
    { additions: [{ reel, hero, amount: GAME_CONFIG.slotUpgrades.pairedXp }, { reel, hero: secondHero, amount: GAME_CONFIG.slotUpgrades.pairedXp }] },
    { additions: HERO_ORDER.map((_, heroIndex) => ({ reel, hero: heroIndex, amount: GAME_CONFIG.slotUpgrades.wholeReelXp })) },
    { additions: [], nudge: true },
  ];
  const offered = shuffle(pool, rng).slice(0, 3);
  const value = (upgrade: Upgrade) => upgrade.nudge ? 4 : upgrade.additions.reduce((sum, addition) => sum + addition.amount * heroPriority(HERO_ORDER[addition.hero], state.heroes), 0);
  const best = [...offered].sort((a, b) => value(b) - value(a))[0];
  const selected = strategy === 'reasonable' && rng() < REASONABLE_DECISION_ACCURACY ? best : pick(offered, rng);
  selected.additions.forEach(({ reel: targetReel, hero: targetHero, amount }) => { state.matrix[targetReel][targetHero] += amount; });
  if (selected.nudge) state.nudges += 1;
  state.slotUpgrades += 1;
}

function processSlotXp(state: RunState, strategy: Strategy, rng: Rng) {
  let required = GAME_CONFIG.slotProgression.xpForLevel(state.slotLevel);
  while (state.slotXp >= required) {
    state.slotXp -= required; state.slotLevel += 1;
    chooseSlotUpgrade(state, strategy, rng);
    required = GAME_CONFIG.slotProgression.xpForLevel(state.slotLevel);
  }
}

function completeSlotAction(state: RunState, action: PendingSlotAction, strategy: Strategy, rng: Rng): PendingSlotAction | null {
  if (action.kind === 'feedback') return null;
  if (action.kind === 'spin') {
    const previous = state.grid;
    const result = makeGrid(state.matrix, rng, state.openingSpins < GAME_CONFIG.stage.guaranteedWinningOpeningSpins);
    state.openingSpins += 1; state.spins -= 1; state.spinsSpent += 1; state.grid = result;
    const presentation = awardGrid(state, result, strategy, rng);
    const feedbackMs = presentation.lineCount * (
      GAME_CONFIG.feedback.lineRevealMs
      + GAME_CONFIG.feedback.rewardDelayMs
      + GAME_CONFIG.feedback.rewardFlightMs
      + GAME_CONFIG.feedback.heroXpFillMs
    ) + presentation.levelsGained * GAME_CONFIG.feedback.heroReadyHoldMs;
    if (state.nudges <= 0) return feedbackMs ? { kind: 'feedback', readyAt: action.readyAt + feedbackMs } : null;
    const scores = [0, 1, 2].map((reel) => nudgeScore(result, reel, state.matrix, state.heroes));
    const bestReel = scores.indexOf(Math.max(...scores));
    const shouldNudge = strategy === 'reasonable' ? scores[bestReel] >= 4.2 : rng() < 0.22;
    if (shouldNudge) return { kind: 'nudge', reel: bestReel, readyAt: action.readyAt + feedbackMs + GAME_CONFIG.slot.nudgeDurationMs };
    void previous;
    return feedbackMs ? { kind: 'feedback', readyAt: action.readyAt + feedbackMs } : null;
  }
  const previous = state.grid;
  const result = nudgeGrid(previous, action.reel!, rng);
  state.grid = result; state.nudges -= 1; state.nudgesSpent += 1;
  const presentation = awardGrid(state, result, strategy, rng, previous);
  const feedbackMs = presentation.lineCount * (
    GAME_CONFIG.feedback.lineRevealMs
    + GAME_CONFIG.feedback.rewardDelayMs
    + GAME_CONFIG.feedback.rewardFlightMs
    + GAME_CONFIG.feedback.heroXpFillMs
  ) + presentation.levelsGained * GAME_CONFIG.feedback.heroReadyHoldMs;
  return feedbackMs ? { kind: 'feedback', readyAt: action.readyAt + feedbackMs } : null;
}

function waveQueue(wave: number, rng: Rng) {
  const config = GAME_CONFIG.waves[wave - 1];
  const types = config.bossFirst
    ? [...Array(config.boss).fill('boss'), ...Array(config.minion).fill('minion'), ...Array(config.elite).fill('elite')]
    : [...Array(config.minion).fill('minion'), ...Array(config.elite).fill('elite'), ...Array(config.boss).fill('boss')];
  const rewards = shuffle<CombatReward>([
    ...Array<CombatReward>(GAME_CONFIG.stage.spinsDroppedPerWave).fill('spin'),
    ...Array<CombatReward>(GAME_CONFIG.stage.nudgesDroppedPerWave(wave)).fill('nudge'),
  ], rng);
  const rewardOrder: Array<CombatReward | undefined> = Array(types.length).fill(undefined);
  const eligible = types.map((type, index) => ({ type, index })).filter(({ type }) => type !== 'boss');
  const earlyPool = eligible.slice(0, Math.max(rewards.length, Math.ceil(eligible.length * .7)));
  rewards.forEach((reward, index) => {
    const target = earlyPool[Math.min(earlyPool.length - 1, Math.floor(index * earlyPool.length / rewards.length))];
    if (target) rewardOrder[target.index] = reward;
  });
  return types.map((type, index) => ({ type: type as SimEnemy['type'], reward: rewardOrder[index] }));
}

function fightWave(wave: number, state: RunState, strategy: Strategy, rng: Rng): WaveResult {
  const tickMs = GAME_CONFIG.combat.tickMs;
  const waveConfig = GAME_CONFIG.waves[wave - 1];
  const queue = waveQueue(wave, rng);
  const enemies: SimEnemy[] = [];
  const cooldowns: Record<string, number> = {};
  let time = 0;
  let nextSpawn = GAME_CONFIG.combat.spawnIntervalMs;
  let slotAction: PendingSlotAction | null = null;
  let leaks = 0;
  let closestEnemyY = GAME_CONFIG.combat.spawnY;
  let totalKillY = 0;
  let kills = 0;
  const hpAtStart = state.hp;
  const spinsAtStart = state.spinsSpent;
  const nudgesAtStart = state.nudgesSpent;
  const spinsEarnedAtStart = state.spinsEarned;
  const nudgesEarnedAtStart = state.nudgesEarned;

  const grantKill = (enemy: SimEnemy) => {
    totalKillY += enemy.y; kills += 1;
    state.slotXp += GAME_CONFIG.slotProgression.killXp[enemy.type];
    if (enemy.reward === 'spin') { state.spins += 1; state.spinsEarned += 1; }
    if (enemy.reward === 'nudge') { state.nudges += 1; state.nudgesEarned += 1; }
    processSlotXp(state, strategy, rng);
  };
  const damage = (enemy: SimEnemy, amount: number) => {
    const alive = enemy.hp > 0;
    enemy.hp -= amount;
    if (alive && enemy.hp <= 0) grantKill(enemy);
  };

  while ((queue.length > 0 || enemies.length > 0) && state.hp > 0 && time < 180_000) {
    time += tickMs;
    while (queue.length > 0 && time >= nextSpawn) {
      const entry = queue.shift()!;
      const config = GAME_CONFIG.enemies[entry.type];
      enemies.push({
        type: entry.type, reward: entry.reward, x: 13 + rng() * 74, y: GAME_CONFIG.combat.spawnY + rng() * 4,
        hp: config.hp * (waveConfig.hpMultiplier?.[entry.type] ?? 1),
        damage: config.damage * (waveConfig.damageMultiplier?.[entry.type] ?? 1),
        speed: config.speed * (waveConfig.speedMultiplier?.[entry.type] ?? 1),
      });
      nextSpawn += GAME_CONFIG.combat.spawnIntervalMs;
    }

    if (!slotAction && state.spins > 0) slotAction = { kind: 'spin', readyAt: time + GAME_CONFIG.slot.spinDurationMs };
    while (slotAction && time >= slotAction.readyAt) slotAction = completeSlotAction(state, slotAction, strategy, rng);

    enemies.forEach((enemy) => { if (!enemy.isSieging) enemy.y += enemy.speed * tickMs / 1000; });
    enemies.forEach((enemy) => { if (enemy.hp > 0) closestEnemyY = Math.max(closestEnemyY, enemy.y); });
    for (let index = enemies.length - 1; index >= 0; index -= 1) {
      const enemy = enemies[index];
      if (enemy.hp <= 0) { enemies.splice(index, 1); continue; }
      if (enemy.y < GAME_CONFIG.combat.baseY) continue;
      if (enemy.type === 'boss') {
        enemy.y = GAME_CONFIG.combat.baseY;
        if (!enemy.isSieging) { enemy.isSieging = true; enemy.nextBaseAttackAt = time + GAME_CONFIG.combat.bossSiege.firstAttackDelayMs; }
        else if (time >= (enemy.nextBaseAttackAt ?? time)) {
          state.hp -= GAME_CONFIG.combat.bossSiege.damage; leaks += 1;
          enemy.nextBaseAttackAt = time + GAME_CONFIG.combat.bossSiege.attackIntervalMs;
        }
      } else {
        state.hp -= enemy.damage; leaks += 1; enemies.splice(index, 1);
      }
    }

    const live = () => enemies.filter((enemy) => enemy.hp > 0);
    for (const hero of state.heroes) {
      if ((cooldowns[hero.id] ?? 0) > time) continue;
      const stats = getHeroStats(hero); const from = PEDESTAL_POSITIONS[hero.slot];
      const targets = live().filter((enemy) => combatDistance(from, enemy) <= stats.range).sort((a, b) => b.y - a.y);
      const target = targets[0]; if (!target) continue;
      cooldowns[hero.id] = time + stats.attackIntervalMs;
      getAbilityTargets(HEROES[hero.id].ability, stats, from, target, targets, live()).forEach((enemy) => damage(enemy, stats.damage));
    }
    for (let index = enemies.length - 1; index >= 0; index -= 1) if (enemies[index].hp <= 0) enemies.splice(index, 1);
  }

  if (slotAction) completeSlotAction(state, slotAction, strategy, rng);
  state.hp = Math.max(0, state.hp);
  const progress = (y: number) => Math.max(0, Math.min(1, (y - GAME_CONFIG.combat.spawnY) / (GAME_CONFIG.combat.baseY - GAME_CONFIG.combat.spawnY)));
  return {
    hpLost: Math.max(0, hpAtStart - state.hp), leaks,
    deepestProgress: progress(closestEnemyY), averageKillY: kills ? totalKillY / kills : GAME_CONFIG.combat.spawnY,
    durationMs: time,
    spinsSpent: state.spinsSpent - spinsAtStart, nudgesSpent: state.nudgesSpent - nudgesAtStart,
    spinsEarned: state.spinsEarned - spinsEarnedAtStart, nudgesEarned: state.nudgesEarned - nudgesEarnedAtStart,
  };
}

function simulateRun(strategy: Strategy, rng: Rng): RunResult {
  const matrix = initialMatrix();
  const state: RunState = {
    hp: GAME_CONFIG.base.maxHp, heroes: [], matrix, grid: makeGrid(matrix, rng, false),
    spins: GAME_CONFIG.stage.startingSpins, nudges: GAME_CONFIG.stage.startingNudges,
    slotLevel: 1, slotXp: 0, openingSpins: 0, levelUps: 0, slotUpgrades: 0,
    spinsSpent: 0, nudgesSpent: 0, spinsEarned: 0, nudgesEarned: 0,
  };
  const waves: WaveResult[] = [];
  let deathWave: number | null = null;
  for (let wave = 1; wave <= GAME_CONFIG.stage.totalWaves; wave += 1) {
    waves.push(fightWave(wave, state, strategy, rng));
    if (state.hp <= 0) { deathWave = wave; break; }
  }
  return {
    won: state.hp > 0 && deathWave === null, deathWave, hp: state.hp,
    levels: HERO_ORDER.map((id) => state.heroes.find((hero) => hero.id === id)?.level ?? 0),
    levelUps: state.levelUps, slotLevel: state.slotLevel, recruited: state.heroes.length,
    spinsRemaining: state.spins, nudgesRemaining: state.nudges, waves,
  };
}

function summarize(strategy: Strategy, baseSeed: number) {
  const results = Array.from({ length: runs }, (_, index) => simulateRun(strategy, mulberry32(baseSeed + index * 104_729)));
  const wins = results.filter((result) => result.won);
  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const reached = (wave: number, select: (result: WaveResult) => number) => results.filter((result) => result.waves[wave]).map((result) => select(result.waves[wave]));
  return {
    strategy, runs,
    winRate: avg(results.map((result) => Number(result.won))),
    avgEndingHpAmongWins: avg(wins.map((result) => result.hp)),
    deathRateByWave: Object.fromEntries(Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, index) => [index + 1, avg(results.map((result) => Number(result.deathWave === index + 1)))])),
    baseDamageChanceByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reached(wave, (result) => Number(result.hpLost > 0)))),
    avgHpLostByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reached(wave, (result) => result.hpLost))),
    avgDeepestProgressByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reached(wave, (result) => result.deepestProgress))),
    avgSpinsSpentByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reached(wave, (result) => result.spinsSpent))),
    avgNudgesSpentByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reached(wave, (result) => result.nudgesSpent))),
    avgSpinsEarnedByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reached(wave, (result) => result.spinsEarned))),
    avgNudgesEarnedByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reached(wave, (result) => result.nudgesEarned))),
    avgHeroLevel: avg(results.flatMap((result) => result.levels.filter(Boolean))),
    avgLevelUps: avg(results.map((result) => result.levelUps)),
    avgSlotLevel: avg(results.map((result) => result.slotLevel)),
    avgRecruited: avg(results.map((result) => result.recruited)),
    avgSpinsRemaining: avg(results.map((result) => result.spinsRemaining)),
    avgNudgesRemaining: avg(results.map((result) => result.nudgesRemaining)),
  };
}

console.log(JSON.stringify({
  configWaves: GAME_CONFIG.stage.totalWaves,
  seed,
  summaries: [summarize('random', seed), summarize('reasonable', seed + 9_999_991)],
}, null, 2));
