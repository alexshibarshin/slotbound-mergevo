import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG, HEROES, PEDESTAL_POSITIONS } from '../config/gameConfig';
import { combatDistance, getAbilityTargets } from '../game/combat';
import { getHeroStats } from '../game/stats';
import type { EnemyState, EnemyType, HeroState, ShotFx } from '../types/game';
import { AtlasSprite } from './AtlasSprite';

let entityId = 1;
type HitFxState = { id: number; enemyId: number; x: number; y: number; amount: number; kind: string; kill: boolean; createdAt: number };

export function CombatLayer({ wave, heroes, onBaseDamage, onComplete }: {
  wave: number;
  heroes: HeroState[];
  onBaseDamage: (amount: number) => void;
  onComplete: () => void;
}) {
  const [enemies, setEnemies] = useState<EnemyState[]>([]);
  const [shots, setShots] = useState<ShotFx[]>([]);
  const [hitFxs, setHitFxs] = useState<HitFxState[]>([]);
  const enemiesRef = useRef<EnemyState[]>([]);
  const heroesRef = useRef(heroes);
  const queueRef = useRef<EnemyType[]>([]);
  const cooldowns = useRef<Record<string, number>>({});
  const impactTimers = useRef<number[]>([]);
  const completed = useRef(false);

  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { heroesRef.current = heroes; }, [heroes]);

  useEffect(() => {
    const waveConfig = GAME_CONFIG.waves[wave - 1];
    const minions = Array<EnemyType>(waveConfig.minion).fill('minion');
    const elites = Array<EnemyType>(waveConfig.elite).fill('elite');
    const bosses = Array<EnemyType>(waveConfig.boss).fill('boss');
    queueRef.current = waveConfig.bossFirst ? [...bosses, ...minions, ...elites] : [...minions, ...elites, ...bosses];
    completed.current = false;
    enemiesRef.current = [];
    setEnemies([]); setShots([]); setHitFxs([]); cooldowns.current = {};

    const spawnTimer = window.setInterval(() => {
      const type = queueRef.current.shift();
      if (!type) { window.clearInterval(spawnTimer); return; }
      const config = GAME_CONFIG.enemies[type];
      const hp = config.hp * (waveConfig.hpMultiplier?.[type] ?? 1);
      const damage = config.damage * (waveConfig.damageMultiplier?.[type] ?? 1);
      const speed = config.speed * (waveConfig.speedMultiplier?.[type] ?? 1);
      const spawned: EnemyState = {
        id: entityId++, type, x: 13 + Math.random() * 74, y: GAME_CONFIG.combat.spawnY + Math.random() * 3,
        hp, maxHp: hp, speed, damage, alive: true,
      };
      const next = [...enemiesRef.current, spawned];
      enemiesRef.current = next;
      setEnemies(next);
    }, GAME_CONFIG.combat.spawnIntervalMs);

    let last = performance.now();
    const tick = window.setInterval(() => {
      const now = performance.now(); const dt = Math.min(100, now - last); last = now;
      let next = enemiesRef.current.map((enemy) => ({ ...enemy }));
      const newHits: HitFxState[] = [];
      const damage = (enemy: EnemyState, amount: number, kind: string) => {
        enemy.hp -= amount;
        newHits.push({ id: entityId++, enemyId: enemy.id, x: enemy.x, y: enemy.y, amount: Math.round(amount), kind, kill: enemy.hp <= 0, createdAt: now });
      };
      const baseHits: number[] = [];
      next.forEach((enemy) => {
        if (!enemy.alive) return;
        if (!enemy.isSieging) enemy.y += enemy.speed * dt / 1000;
        if (enemy.y >= GAME_CONFIG.combat.baseY) {
          if (enemy.type === 'boss') {
            enemy.y = GAME_CONFIG.combat.baseY;
            if (!enemy.isSieging) {
              enemy.isSieging = true;
              enemy.nextBaseAttackAt = now + GAME_CONFIG.combat.bossSiege.firstAttackDelayMs;
            } else if (now >= (enemy.nextBaseAttackAt ?? now)) {
              baseHits.push(GAME_CONFIG.combat.bossSiege.damage);
              enemy.nextBaseAttackAt = now + GAME_CONFIG.combat.bossSiege.attackIntervalMs;
            }
          } else {
            enemy.alive = false;
            baseHits.push(enemy.damage);
          }
        }
      });
      baseHits.forEach(onBaseDamage);

      const live = () => next.filter((enemy) => enemy.alive && enemy.hp > 0);
      const addShot = (heroId: HeroState['id'], kind: ShotFx['kind'], from: { x: number; y: number }, to: EnemyState) => {
        setShots((current) => [...current.filter((shot) => now - shot.createdAt < 650), {
          id: entityId++, heroId, kind, x1: from.x, y1: from.y, x2: to.x, y2: to.y, createdAt: now,
        }]);
      };

      heroesRef.current.forEach((hero) => {
        const stats = getHeroStats(hero); const from = PEDESTAL_POSITIONS[hero.slot];
        if ((cooldowns.current[hero.id] ?? 0) > now) return;
        const targets = live().filter((enemy) => combatDistance(from, enemy) <= stats.range).sort((a, b) => b.y - a.y);
        const target = targets[0]; if (!target) return;
        cooldowns.current[hero.id] = now + stats.attackIntervalMs;
        const ability = HEROES[hero.id].ability; addShot(hero.id, ability, from, target);
        getAbilityTargets(ability, stats, from, target, targets, live()).forEach((enemy) => damage(enemy, stats.damage, ability));
      });

      next.forEach((enemy) => { if (enemy.hp <= 0) enemy.alive = false; });
      next = next.filter((enemy) => enemy.alive);
      enemiesRef.current = next; setEnemies(next);
      setShots((current) => current.filter((shot) => now - shot.createdAt < 700));
      setHitFxs((current) => current.filter((fx) => now - fx.createdAt < 850));
      if (newHits.length) {
        const impactTimer = window.setTimeout(() => {
          const impactNow = performance.now();
          const impactedIds = new Set(newHits.map((hit) => hit.enemyId));
          setEnemies((current) => current.map((enemy) => impactedIds.has(enemy.id) ? { ...enemy, lastHit: impactNow } : enemy));
          setHitFxs((current) => [
            ...current.filter((fx) => impactNow - fx.createdAt < 850),
            ...newHits.map((hit) => ({ ...hit, createdAt: impactNow })),
          ]);
        }, 500);
        impactTimers.current.push(impactTimer);
      }
      if (!completed.current && queueRef.current.length === 0 && next.length === 0) { completed.current = true; onComplete(); }
    }, GAME_CONFIG.combat.tickMs);

    return () => {
      window.clearInterval(spawnTimer);
      window.clearInterval(tick);
      impactTimers.current.forEach(window.clearTimeout);
      impactTimers.current = [];
    };
  }, [onBaseDamage, onComplete, wave]);

  return (
    <div className="combat-layer">
      <div className="wave-intro"><span>WAVE {wave}</span><b>DEFEND THE GATE</b></div>
      {enemies.map((enemy) => {
        const config = GAME_CONFIG.enemies[enemy.type];
        return <div className={`enemy enemy-${enemy.type} ${enemy.isSieging ? 'is-sieging' : ''} ${(enemy.lastHit && performance.now() - enemy.lastHit < 220) ? 'is-hit' : ''}`} key={enemy.id} style={{ left: `${enemy.x}%`, top: `${enemy.y}%`, width: `${config.size}%` }}>
          <AtlasSprite atlas="enemy" index={config.atlasIndex - 1} />
          <span className="enemy-hp"><i style={{ width: `${enemy.hp / enemy.maxHp * 100}%` }} /></span>
        </div>;
      })}
      {shots.map((shot) => <Shot key={shot.id} shot={shot} />)}
      {hitFxs.map((fx) => <div className={`hit-fx hit-${fx.kind} ${fx.kill ? 'is-kill' : ''}`} key={fx.id} style={{ left: `${fx.x}%`, top: `${fx.y}%` }}>
        <span className="impact-core" />
        <i className="impact-ring" />
        <span className="impact-sparks">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</span>
        <strong>−{fx.amount}</strong>
      </div>)}
    </div>
  );
}

function Shot({ shot }: { shot: ShotFx }) {
  const index = HEROES[shot.heroId as HeroState['id']].atlasIndex;
  const angle = Math.atan2(shot.y2 - shot.y1, shot.x2 - shot.x1) * 180 / Math.PI + 90;
  return <div className={`shot shot-${shot.kind}`} style={{
    '--x1': `${shot.x1}%`, '--y1': `${shot.y1}%`,
    '--x2': `${shot.x2}%`, '--y2': `${shot.y2}%`,
    '--shot-angle': `${angle}deg`,
  } as React.CSSProperties}>
    <AtlasSprite atlas="vfx" index={index} />
  </div>;
}
