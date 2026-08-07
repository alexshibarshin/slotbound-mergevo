import { GAME_CONFIG } from '../config/gameConfig';

export function Hud({ wave, hp, slotLevel, slotXp, slotXpRequired, slotReady, spins, nudges }: {
  wave: number;
  hp: number;
  slotLevel: number;
  slotXp: number;
  slotXpRequired: number;
  slotReady: boolean;
  spins: number;
  nudges: number;
}) {
  return (
    <div className="hud">
      <div className={`slot-xp-bar ${slotReady ? 'is-level-ready' : ''}`}>
        <i style={{ width: `${Math.min(100, slotXp / slotXpRequired * 100)}%` }} />
        <strong>SLOT LV.{slotLevel}</strong>
        <small>{slotXp}/{slotXpRequired}</small>
      </div>
      <div className="wave-badge"><span>WAVE</span><strong>{wave}/{GAME_CONFIG.stage.totalWaves}</strong></div>
      <div className="resource-badges">
        <span className="spin-resource"><b>↻</b><strong>{spins}</strong></span>
        <span className="nudge-resource"><b>⌄</b><strong>{nudges}</strong></span>
      </div>
      <div className="base-hp-bar">
        <i style={{ width: `${Math.max(0, hp / GAME_CONFIG.base.maxHp * 100)}%` }} />
        <strong>GATE {hp}</strong>
      </div>
    </div>
  );
}
