import { GAME_CONFIG } from '../config/gameConfig';

export function Hud({ wave, hp }: { wave: number; hp: number }) {
  return (
    <div className="hud">
      <div className="wave-badge"><span>WAVE</span><strong>{wave}/{GAME_CONFIG.stage.totalWaves}</strong></div>
      <div className="hp-badge"><i /><strong>{hp}</strong></div>
    </div>
  );
}
