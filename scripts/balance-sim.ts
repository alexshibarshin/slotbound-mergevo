import { GAME_CONFIG, HEROES, HERO_ORDER, PEDESTAL_POSITIONS } from '../src/config/gameConfig.ts';
import { combatDistance, getAbilityTargets } from '../src/game/combat.ts';
import { getComboMultiplier } from '../src/game/combo.ts';
import { calculateHeroStats } from '../src/game/statsCore.ts';
import type { HeroId, HeroPerk, HeroState } from '../src/types/game.ts';

type Strategy = 'random' | 'smart';
type Rng = () => number;
type SimEnemy = {
  type: 'minion' | 'elite' | 'boss';
  x: number;
  y: number;
  hp: number;
  speed: number;
  damage: number;
  isSieging?: boolean;
  nextBaseAttackAt?: number;
};

type WaveResult = {
  hpLost: number;
  leaks: number;
  deepestProgress: number;
  averageKillY: number;
  durationMs: number;
  bossDeepestProgress: number | null;
};

type RunResult = {
  won: boolean;
  flawless: boolean;
  deathWave: number | null;
  hp: number;
  levels: number[];
  levelUps: number;
  recruited: number;
  heroDamage: Record<HeroId, number>;
  heroShots: Record<HeroId, number>;
  waves: WaveResult[];
};

const runs = Number.parseInt(process.argv[2] ?? '2000', 10);
const seed = Number.parseInt(process.argv[3] ?? '731_993'.replace('_', ''), 10);
// A strong human heuristic: picks the higher-value offered perk/upgrade most of the time,
// while still making occasional thematic or imperfect choices.
const SMART_DECISION_ACCURACY = 1;
const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

const getHeroStats = (hero: HeroState) => calculateHeroStats(hero, HEROES[hero.id]);

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

const blankHeroRecord = () => Object.fromEntries(HERO_ORDER.map((id) => [id, 0])) as Record<HeroId, number>;
const initialMatrix = () => Array.from({ length: 3 }, () => HERO_ORDER.map(() => 1));

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
  next[reel + 6] = next[reel + 3];
  next[reel + 3] = next[reel];
  next[reel] = pick(HERO_ORDER, rng);
  return next;
}

function winningLines(grid: HeroId[]) {
  return WINNING_LINES.filter(([a, b, c]) => grid[a] === grid[b] && grid[b] === grid[c]);
}

function heroPriority(id: HeroId, heroes: HeroState[], carryIds: HeroId[] = []): number {
  const hero = heroes.find((candidate) => candidate.id === id);
  if (!carryIds.length) {
    if (!hero) return 1.35;
    return 1 / (1 + Math.max(0, hero.level - 1) * 0.18);
  }
  if (carryIds.includes(id)) return carryIds.length === 1 ? 3.5 : 2.4;
  return hero ? 0.55 : 0.7;
}

function nudgeScore(grid: HeroId[], reel: number, matrix: number[][], heroes: HeroState[], carryIds: HeroId[]): number {
  let expected = 0;
  const previousWinKeys = new Set(winningLines(grid).map((line) => `${line.join('-')}:${grid[line[0]]}`));
  for (const newHero of HERO_ORDER) {
    const next = [...grid];
    next[reel + 6] = next[reel + 3];
    next[reel + 3] = next[reel];
    next[reel] = newHero;
    const wins = winningLines(next);
    const rewardWins = wins.filter((line) => !previousWinKeys.has(`${line.join('-')}:${next[line[0]]}`));
    const multiplier = getComboMultiplier(wins.length);
    const reward = rewardWins.reduce((sum, line) => sum + line.reduce((lineSum, index) => {
      const id = next[index];
      return lineSum + matrix[index % 3][HERO_ORDER.indexOf(id)] * heroPriority(id, heroes, carryIds) * multiplier;
    }, 0), 0);
    expected += reward / HERO_ORDER.length;
  }
  return expected;
}

function perkPower(hero: HeroState, perk: HeroPerk): number {
  const before = getHeroStats(hero);
  const after = getHeroStats({ ...hero, level: hero.level + 1, perks: [...hero.perks, perk.id] });
  const definition = HEROES[hero.id];
  const targetFactor = (stats: typeof before) => {
    if (definition.ability === 'missile') return Math.max(1, stats.pierce);
    if (definition.ability === 'fireball') return 1 + stats.aoeRadius * 0.38;
    if (definition.ability === 'icicle') return Math.min(stats.pierce, 1 + stats.beamWidth * 0.65);
    if (definition.ability === 'sector') return 1 + stats.aoeRadius * 0.42;
    return 1 + stats.beamWidth * 0.38;
  };
  const score = (stats: typeof before) => stats.damage / stats.attackIntervalMs * targetFactor(stats) * (0.65 + Math.min(stats.range, 55) / 100);
  return score(after) / score(before);
}

function processLevels(heroes: HeroState[], strategy: Strategy, rng: Rng): number {
  let levelUps = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const hero of heroes) {
      const cost = GAME_CONFIG.hero.xpToLevel(hero.level);
      if (hero.xp < cost) continue;
      const available = HEROES[hero.id].perks.filter((perk) => !hero.perks.includes(perk.id));
      const veteran: HeroPerk = { id: `${hero.id}-veteran-mastery`, name: 'Veteran Mastery', description: '', rarity: 'epic' };
      const offered = available.length ? shuffle(available, rng).slice(0, GAME_CONFIG.hero.perkChoices) : [veteran];
      const ranked = [...offered].sort((a, b) => perkPower(hero, b) - perkPower(hero, a));
      const selected = strategy === 'random' || rng() > SMART_DECISION_ACCURACY ? pick(offered, rng) : ranked[0];
      hero.xp -= cost;
      hero.level += 1;
      if (!selected.id.endsWith('-veteran-mastery')) hero.perks.push(selected.id);
      levelUps += 1;
      changed = true;
    }
  }
  return levelUps;
}

function awardGrid(grid: HeroId[], matrix: number[][], heroes: HeroState[], previousGrid?: HeroId[]): number {
  const gained = new Map<HeroId, number>();
  const previousWinKeys = new Set((previousGrid ? winningLines(previousGrid) : []).map((line) => `${line.join('-')}:${previousGrid?.[line[0]]}`));
  const wins = winningLines(grid);
  const rewardWins = wins
    .filter((line) => !previousWinKeys.has(`${line.join('-')}:${grid[line[0]]}`));
  const multiplier = getComboMultiplier(wins.length);
  rewardWins
    .forEach((line) => line.forEach((index) => {
      const id = grid[index];
      gained.set(id, (gained.get(id) ?? 0) + matrix[index % 3][HERO_ORDER.indexOf(id)] * multiplier);
    }));
  let recruited = 0;
  gained.forEach((xp, id) => {
    const hero = heroes.find((candidate) => candidate.id === id);
    if (hero) hero.xp += xp;
    else if (heroes.length < PEDESTAL_POSITIONS.length) {
      heroes.push({ id, level: 1, xp, slot: heroes.length, perks: [] });
      recruited += 1;
    }
  });
  return recruited;
}

type Upgrade = { additions: Array<{ reel: number; hero: number; amount: number }> };

function makeUpgradePool(rng: Rng): Upgrade[] {
  const reel = Math.floor(rng() * 3);
  const secondReel = (reel + 1 + Math.floor(rng() * 2)) % 3;
  const hero = Math.floor(rng() * HERO_ORDER.length);
  const secondHero = (hero + 1 + Math.floor(rng() * (HERO_ORDER.length - 1))) % HERO_ORDER.length;
  return [
    { additions: [{ reel, hero, amount: GAME_CONFIG.slotUpgrades.focusedXp }] },
    { additions: [{ reel, hero, amount: GAME_CONFIG.slotUpgrades.linkedXp }, { reel: secondReel, hero, amount: GAME_CONFIG.slotUpgrades.linkedXp }] },
    { additions: [{ reel, hero, amount: GAME_CONFIG.slotUpgrades.pairedXp }, { reel, hero: secondHero, amount: GAME_CONFIG.slotUpgrades.pairedXp }] },
    { additions: HERO_ORDER.map((_, heroIndex) => ({ reel, hero: heroIndex, amount: GAME_CONFIG.slotUpgrades.wholeReelXp })) },
    { additions: [{ reel, hero, amount: GAME_CONFIG.slotUpgrades.wildXp }] },
  ];
}

function chooseUpgrade(matrix: number[][], heroes: HeroState[], strategy: Strategy, rng: Rng, carryIds: HeroId[]) {
  const offered = shuffle(makeUpgradePool(rng), rng).slice(0, 3);
  const ranked = [...offered].sort((a, b) => {
    const value = (upgrade: Upgrade) => upgrade.additions.reduce((sum, addition) => {
      const id = HERO_ORDER[addition.hero];
      return sum + addition.amount * heroPriority(id, heroes, carryIds);
    }, 0);
    return value(b) - value(a);
  });
  const selected = strategy === 'random' || rng() > SMART_DECISION_ACCURACY ? pick(offered, rng) : ranked[0];
  selected.additions.forEach(({ reel, hero, amount }) => { matrix[reel][hero] += amount; });
}

function arrangeHeroes(heroes: HeroState[], strategy: Strategy, rng: Rng) {
  const slots = PEDESTAL_POSITIONS.map((_, index) => index);
  const orderedHeroes = [...heroes].sort((a, b) => getHeroStats(a).range - getHeroStats(b).range);
  const frontToBack = [...slots].sort((a, b) => PEDESTAL_POSITIONS[b].y - PEDESTAL_POSITIONS[a].y);
  orderedHeroes.forEach((hero, index) => { hero.slot = frontToBack[index]; });
}

function fightWave(wave: number, heroes: HeroState[], startHp: number, rng: Rng) {
  const tickMs = GAME_CONFIG.combat.tickMs;
  const waveConfig = GAME_CONFIG.waves[wave - 1];
  const minions = Array<SimEnemy['type']>(waveConfig.minion).fill('minion');
  const elites = Array<SimEnemy['type']>(waveConfig.elite).fill('elite');
  const bosses = Array<SimEnemy['type']>(waveConfig.boss).fill('boss');
  const queue = waveConfig.bossFirst ? [...bosses, ...minions, ...elites] : [...minions, ...elites, ...bosses];
  const enemies: SimEnemy[] = [];
  const cooldowns: Record<string, number> = {};
  const damageByHero = blankHeroRecord();
  const shotsByHero = blankHeroRecord();
  let hp = startHp;
  let time = 0;
  let nextSpawn = GAME_CONFIG.combat.spawnIntervalMs;
  let leaks = 0;
  let closestEnemyY = 101;
  let closestBossY = 101;
  let totalKillY = 0;
  let kills = 0;
  const damage = (enemy: SimEnemy, amount: number, heroId?: HeroId) => {
    const wasAlive = enemy.hp > 0;
    const dealt = Math.min(enemy.hp, amount);
    enemy.hp -= amount;
    if (heroId) damageByHero[heroId] += dealt;
    if (wasAlive && enemy.hp <= 0) {
      totalKillY += enemy.y;
      kills += 1;
    }
  };

  while ((queue.length > 0 || enemies.length > 0) && hp > 0 && time < 180_000) {
    time += tickMs;
    while (queue.length > 0 && time >= nextSpawn) {
      const type = queue.shift()!;
      const config = GAME_CONFIG.enemies[type];
      const hp = config.hp * (waveConfig.hpMultiplier?.[type] ?? 1);
      const damage = config.damage * (waveConfig.damageMultiplier?.[type] ?? 1);
      const speed = config.speed * (waveConfig.speedMultiplier?.[type] ?? 1);
      enemies.push({ type, x: 42 + rng() * 16, y: 96 + rng() * 5, hp, speed, damage });
      nextSpawn += GAME_CONFIG.combat.spawnIntervalMs;
    }
    enemies.forEach((enemy) => {
      if (!enemy.isSieging) enemy.y -= enemy.speed * tickMs / 1000;
    });
    enemies.forEach((enemy) => {
      closestEnemyY = Math.min(closestEnemyY, enemy.y);
      if (enemy.type === 'boss') closestBossY = Math.min(closestBossY, enemy.y);
    });
    for (let index = enemies.length - 1; index >= 0; index -= 1) {
      if (enemies[index].y <= GAME_CONFIG.combat.baseY) {
        const enemy = enemies[index];
        if (enemy.type === 'boss') {
          enemy.y = GAME_CONFIG.combat.baseY;
          if (!enemy.isSieging) {
            enemy.isSieging = true;
            enemy.nextBaseAttackAt = time + GAME_CONFIG.combat.bossSiege.firstAttackDelayMs;
          } else if (time >= (enemy.nextBaseAttackAt ?? time)) {
            hp -= GAME_CONFIG.combat.bossSiege.damage;
            leaks += 1;
            enemy.nextBaseAttackAt = time + GAME_CONFIG.combat.bossSiege.attackIntervalMs;
          }
        } else {
          hp -= enemy.damage;
          leaks += 1;
          enemies.splice(index, 1);
        }
      }
    }
    const live = () => enemies.filter((enemy) => enemy.hp > 0);
    for (const hero of heroes) {
      if ((cooldowns[hero.id] ?? 0) > time) continue;
      const stats = getHeroStats(hero);
      const from = PEDESTAL_POSITIONS[hero.slot];
      const targets = live().filter((enemy) => combatDistance(from, enemy) <= stats.range).sort((a, b) => a.y - b.y);
      const target = targets[0];
      if (!target) continue;
      cooldowns[hero.id] = time + stats.attackIntervalMs;
      shotsByHero[hero.id] += 1;
      const ability = HEROES[hero.id].ability;
      getAbilityTargets(ability, stats, from, target, targets, live()).forEach((enemy) => damage(enemy, stats.damage, hero.id));
    }
    if ((cooldowns.king ?? 0) <= time) {
      const from = { x: 50, y: 13 };
      const target = live().filter((enemy) => combatDistance(from, enemy) <= GAME_CONFIG.base.range).sort((a, b) => a.y - b.y)[0];
      if (target) {
        damage(target, GAME_CONFIG.base.damage);
        cooldowns.king = time + GAME_CONFIG.base.attackIntervalMs;
      }
    }
    for (let index = enemies.length - 1; index >= 0; index -= 1) if (enemies[index].hp <= 0) enemies.splice(index, 1);
  }
  const progress = (y: number) => Math.max(0, Math.min(1, (100 - y) / (100 - GAME_CONFIG.combat.baseY)));
  return {
    hp: Math.max(0, hp),
    hpLost: Math.max(0, startHp - Math.max(0, hp)),
    leaks,
    deepestProgress: progress(closestEnemyY),
    averageKillY: kills > 0 ? totalKillY / kills : 100,
    durationMs: time,
    bossDeepestProgress: closestBossY < 101 ? progress(closestBossY) : null,
    damageByHero,
    shotsByHero,
  };
}

function simulateRun(strategy: Strategy, rng: Rng, carryIds: HeroId[] = []): RunResult {
  const matrix = initialMatrix();
  const heroes: HeroState[] = [];
  const heroDamage = blankHeroRecord();
  const heroShots = blankHeroRecord();
  const waves: WaveResult[] = [];
  let hp = GAME_CONFIG.base.maxHp;
  let openingSpins = 0;
  let recruited = 0;
  let levelUps = 0;
  let deathWave: number | null = null;

  for (let wave = 1; wave <= GAME_CONFIG.stage.totalWaves; wave += 1) {
    const randomNudgeSpin = Math.floor(rng() * GAME_CONFIG.stage.preparationSpins);
    let usedNudge = false;
    for (let spin = 0; spin < GAME_CONFIG.stage.preparationSpins; spin += 1) {
      const grid = makeGrid(matrix, rng, openingSpins < GAME_CONFIG.stage.guaranteedWinningOpeningSpins);
      openingSpins += 1;
      recruited += awardGrid(grid, matrix, heroes);
      levelUps += processLevels(heroes, strategy, rng);
      const shouldNudge = strategy === 'random'
        ? spin === randomNudgeSpin
        : spin === GAME_CONFIG.stage.preparationSpins - 1 || Math.max(...[0, 1, 2].map((reel) => nudgeScore(grid, reel, matrix, heroes, carryIds))) >= 4.5;
      if (!usedNudge && shouldNudge) {
        const reel = strategy === 'random'
          ? Math.floor(rng() * 3)
          : [...[0, 1, 2]].sort((a, b) => nudgeScore(grid, b, matrix, heroes, carryIds) - nudgeScore(grid, a, matrix, heroes, carryIds))[0];
        const nudged = nudgeGrid(grid, reel, rng);
        recruited += awardGrid(nudged, matrix, heroes, grid);
        levelUps += processLevels(heroes, strategy, rng);
        usedNudge = true;
      }
    }
    arrangeHeroes(heroes, strategy, rng);
    const combat = fightWave(wave, heroes, hp, rng);
    hp = combat.hp;
    waves.push({
      hpLost: combat.hpLost,
      leaks: combat.leaks,
      deepestProgress: combat.deepestProgress,
      averageKillY: combat.averageKillY,
      durationMs: combat.durationMs,
      bossDeepestProgress: combat.bossDeepestProgress,
    });
    HERO_ORDER.forEach((id) => {
      heroDamage[id] += combat.damageByHero[id];
      heroShots[id] += combat.shotsByHero[id];
    });
    if (hp <= 0) { deathWave = wave; break; }
    if (wave < GAME_CONFIG.stage.totalWaves) chooseUpgrade(matrix, heroes, strategy, rng, carryIds);
  }

  return {
    won: hp > 0 && deathWave === null,
    flawless: hp === GAME_CONFIG.base.maxHp,
    deathWave,
    hp,
    levels: HERO_ORDER.map((id) => heroes.find((hero) => hero.id === id)?.level ?? 0),
    levelUps,
    recruited,
    heroDamage,
    heroShots,
    waves,
  };
}

function summarize(strategy: Strategy, baseSeed: number, carryIds: HeroId[] = []) {
  const results = Array.from({ length: runs }, (_, index) => simulateRun(strategy, mulberry32(baseSeed + index * 104_729), carryIds));
  const wins = results.filter((result) => result.won);
  const finalists = results.filter((result) => result.waves.length === GAME_CONFIG.stage.totalWaves);
  const highCarryResults = carryIds.length === 0 ? [] : results.filter((result) => carryIds.some((id) => result.levels[HERO_ORDER.indexOf(id)] >= 6));
  const deathCounts = Object.fromEntries(Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, index) => [index + 1, 0]));
  results.forEach((result) => { if (result.deathWave) deathCounts[result.deathWave] += 1; });
  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const heroDamageTotals = blankHeroRecord();
  const heroShotTotals = blankHeroRecord();
  results.forEach((result) => HERO_ORDER.forEach((id) => {
    heroDamageTotals[id] += result.heroDamage[id];
    heroShotTotals[id] += result.heroShots[id];
  }));
  const totalHeroDamage = Object.values(heroDamageTotals).reduce((sum, value) => sum + value, 0);
  const reachedWaveValues = (wave: number, select: (result: WaveResult) => number) => results
    .filter((result) => result.waves[wave] !== undefined)
    .map((result) => select(result.waves[wave]));
  return {
    strategy: carryIds.length ? `smart-${carryIds.join('+')}-carry` : strategy,
    runs,
    winRate: avg(results.map((result) => Number(result.won))),
    flawlessAmongWins: avg(wins.map((result) => Number(result.flawless))),
    avgEndingHpAmongWins: avg(wins.map((result) => result.hp)),
    deathRateByWave: Object.fromEntries(Object.entries(deathCounts).map(([wave, count]) => [wave, count / runs])),
    avgHeroLevel: avg(results.flatMap((result) => result.levels.filter((level) => level > 0))),
    avgFinalistHeroLevel: avg(finalists.flatMap((result) => result.levels.filter((level) => level > 0))),
    avgFinalistCarryLevels: Object.fromEntries(carryIds.map((id) => [id, avg(finalists.map((result) => result.levels[HERO_ORDER.indexOf(id)]))])),
    maxHeroLevel: Math.max(...results.flatMap((result) => result.levels)),
    runsWithHeroAboveLevelSix: avg(results.map((result) => Number(result.levels.some((level) => level > 6)))),
    avgLevelUps: avg(results.map((result) => result.levelUps)),
    avgFinalistLevelUps: avg(finalists.map((result) => result.levelUps)),
    avgRecruited: avg(results.map((result) => result.recruited)),
    avgHpLostByWaveAmongReached: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reachedWaveValues(wave, (result) => result.hpLost))),
    baseDamageChanceByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reachedWaveValues(wave, (result) => Number(result.hpLost > 0)))),
    avgLeaksByWaveAmongReached: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reachedWaveValues(wave, (result) => result.leaks))),
    avgDeepestProgressByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reachedWaveValues(wave, (result) => result.deepestProgress))),
    avgKillYByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reachedWaveValues(wave, (result) => result.averageKillY))),
    avgDurationSecondsByWave: Array.from({ length: GAME_CONFIG.stage.totalWaves }, (_, wave) => avg(reachedWaveValues(wave, (result) => result.durationMs)) / 1000),
    avgBossDeepestProgress: avg(results.flatMap((result) => result.waves[9]?.bossDeepestProgress ?? [])),
    highCarryRunShare: highCarryResults.length / results.length,
    highCarryWinRate: avg(highCarryResults.map((result) => Number(result.won))),
    highCarryWaveTenHpLost: avg(highCarryResults.flatMap((result) => result.waves[9]?.hpLost ?? [])),
    highCarryBossDeepestProgress: avg(highCarryResults.flatMap((result) => result.waves[9]?.bossDeepestProgress ?? [])),
    heroDamageShare: Object.fromEntries(HERO_ORDER.map((id) => [id, heroDamageTotals[id] / Math.max(1, totalHeroDamage)])),
    heroShotsPerRun: Object.fromEntries(HERO_ORDER.map((id) => [id, heroShotTotals[id] / runs])),
  };
}

const carryProfiles: HeroId[][] = [
  ...HERO_ORDER.map((id) => [id]),
  ...HERO_ORDER.flatMap((first, firstIndex) => HERO_ORDER.slice(firstIndex + 1).map((second) => [first, second])),
];
const summaries = [
  summarize('random', seed),
  ...carryProfiles.map((carryIds, index) => summarize('smart', seed + (index + 1) * 9_999_991, carryIds)),
];
const smartSummaries = summaries.slice(1);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

console.log(JSON.stringify({
  configWaves: GAME_CONFIG.stage.totalWaves,
  seed,
  aggregate: {
    randomWinRate: summaries[0].winRate,
    randomFlawlessAmongWins: summaries[0].flawlessAmongWins,
    smartWinRateMean: mean(smartSummaries.map((summary) => summary.winRate)),
    smartWinRateRange: [
      Math.min(...smartSummaries.map((summary) => summary.winRate)),
      Math.max(...smartSummaries.map((summary) => summary.winRate)),
    ],
    smartFlawlessAmongWinsMean: mean(smartSummaries.map((summary) => summary.flawlessAmongWins)),
    highCarryWinRateMean: mean(smartSummaries.map((summary) => summary.highCarryWinRate)),
  },
  summaries,
}, null, 2));
