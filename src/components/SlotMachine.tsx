import { HEROES } from '../config/gameConfig';
import type { SlotCell } from '../types/game';
import { AtlasSprite } from './AtlasSprite';

export function SlotMachine({ grid, spinsLeft, nudgesLeft, spinning, nudgingReel, pendingGrid, winningCells, winningLines, noMatch, onSpin, onNudge }: {
  grid: SlotCell[];
  spinsLeft: number;
  nudgesLeft: number;
  spinning: boolean;
  nudgingReel: number | null;
  pendingGrid: SlotCell[] | null;
  winningCells: number[];
  winningLines: number[][];
  noMatch: boolean;
  onSpin: () => void;
  onNudge: (reel: number) => void;
}) {
  const cellsForReel = (reel: number) => [grid[reel], grid[reel + 3], grid[reel + 6]];
  const spinningCellsForReel = (reel: number) => {
    const visible = cellsForReel(reel);
    const result = pendingGrid ? [pendingGrid[reel], pendingGrid[reel + 3], pendingGrid[reel + 6]] : visible;
    const filler = [1, 2].flatMap((offset) => cellsForReel((reel + offset) % 3));
    return [...result, ...filler, ...visible];
  };
  const nudgeCellsForReel = (reel: number) => [pendingGrid?.[reel] ?? grid[reel], ...cellsForReel(reel)];
  const fullSpin = spinning && nudgingReel === null;

  return (
    <section className={`slot-machine ${fullSpin ? 'is-spinning' : ''} ${nudgingReel !== null ? 'is-nudging' : ''} ${noMatch ? 'is-no-match' : ''}`} aria-label="Hero slot machine">
      <img className="slot-shell" src="/assets/slot-machine.png" alt="" />
      <div className="reel-grid">
        {[0, 1, 2].map((reel) => (
          <div className={`reel ${nudgingReel === reel ? 'nudge-target' : ''}`} key={reel}>
            <div className="reel-strip" style={{ '--reel': reel } as React.CSSProperties}>
              {(fullSpin ? spinningCellsForReel(reel) : nudgingReel === reel ? nudgeCellsForReel(reel) : cellsForReel(reel)).map((cell, row) => {
                const gridIndex = reel + (row % 3) * 3;
                return (
                  <div
                    className={`slot-symbol ${!spinning && winningCells.includes(gridIndex) ? 'is-winning' : ''}`}
                    style={{ '--hero-color': HEROES[cell.heroId].color } as React.CSSProperties}
                    key={`${reel}-${row}-${cell.heroId}`}
                  >
                    <span className="symbol-medallion"><AtlasSprite atlas="heroPortrait" index={HEROES[cell.heroId].atlasIndex} /></span>
                    <span className="xp-badge"><i /><b>+{cell.xp}</b></span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {winningLines.length > 0 && (
        <svg className="win-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs><filter id="lineGlow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
          {winningLines.map((line, index) => {
            const first = line[0]; const last = line[2];
            const x1 = first % 3 * 33.333 + 16.667; const y1 = Math.floor(first / 3) * 33.333 + 16.667;
            const x2 = last % 3 * 33.333 + 16.667; const y2 = Math.floor(last / 3) * 33.333 + 16.667;
            return <g key={`${line.join('-')}-${index}`}>
              <line className="win-line-back" x1={x1} y1={y1} x2={x2} y2={y2} />
              <line className="win-line-core" x1={x1} y1={y1} x2={x2} y2={y2} filter="url(#lineGlow)" />
            </g>;
          })}
        </svg>
      )}
      {winningLines.length > 0 && <div className="slot-win-flash" />}
      {noMatch && <div className="no-match-feedback"><i /><span>NO MATCH</span><small>TRY THE NEXT SPIN</small></div>}
      {[0, 1, 2].map((reel) => (
        <button
          key={reel}
          className={`nudge-button ${nudgingReel === reel ? 'is-nudging' : ''}`}
          style={{ left: `${19.5 + reel * 17.8}%` }}
          onClick={() => onNudge(reel)}
          disabled={nudgesLeft === 0 || spinning}
          aria-label={`Nudge reel ${reel + 1} down`}
        ><span className="nudge-chevron" /><small>NUDGE</small></button>
      ))}
      <button className="lever-hit" onClick={onSpin} disabled={spinsLeft === 0 || spinning} aria-label="Spin reels">
        <span className="lever-track" />
        <span className="lever-arm"><i /><b /></span>
      </button>
      <div className="spin-counter"><small>SPINS</small><strong>{spinsLeft}</strong></div>
    </section>
  );
}
