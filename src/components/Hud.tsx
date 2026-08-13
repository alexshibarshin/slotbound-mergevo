import { GAME_CONFIG } from '../config/gameConfig';

export function Hud({ wave }: { wave: number }) {
  return (
    <div className="hud">
      <div className="wave-badge"><span>WAVE</span><strong>{wave}/{GAME_CONFIG.stage.totalWaves}</strong></div>
    </div>
  );
}
