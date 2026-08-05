import { Arena } from './components/Arena';
import { AtlasSprite } from './components/AtlasSprite';
import { LevelUpModal, SlotUpgradeModal } from './components/Modals';
import { useGame } from './hooks/useGame';

export default function App() {
  const game = useGame();
  if (game.phase === 'title') return <TitleScreen onStart={game.start} />;
  if (game.phase === 'victory' || game.phase === 'defeat') return <EndScreen victory={game.phase === 'victory'} onRestart={game.start} />;
  return (
    <div className="app-shell">
      <Arena game={game} />
      <LevelUpModal game={game} />
      <SlotUpgradeModal game={game} />
    </div>
  );
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="title-screen">
      <img src="/assets/arena.png" alt="" />
      <div className="title-king"><AtlasSprite atlas="king" index={0} /></div>
      <div className="title-copy"><span>ROGUELITE TOWER DEFENSE</span><h1>RUNE<br /><b>REELS</b></h1><p>Spin. Empower. Defend.</p></div>
      <button className="start-button" onClick={onStart}>TO BATTLE</button>
    </main>
  );
}

function EndScreen({ victory, onRestart }: { victory: boolean; onRestart: () => void }) {
  return (
    <main className={`end-screen ${victory ? 'victory' : 'defeat'}`}>
      <img src="/assets/arena.png" alt="" />
      <div className="end-card">
        <AtlasSprite atlas="ui" index={victory ? 0 : 1} />
        <h1>{victory ? 'STAGE CLEAR!' : 'THE THRONE FELL'}</h1>
        <p>{victory ? 'All waves defeated' : 'Reforge the reels and try again'}</p>
        <button className="start-button" onClick={onRestart}>{victory ? 'PLAY AGAIN' : 'TRY AGAIN'}</button>
      </div>
    </main>
  );
}
