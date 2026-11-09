import React from 'react';
import { useGame } from '../state/gameContext';
import { ASTEROIDS, RELICS, UNLOCKS, unlockCost, bombCost, canAfford, COLLAPSE_MIN_RING, AsteroidType } from '../game/content';
import { CostTag, BuyButton } from './ui';

export const SingularityPanel: React.FC = () => {
  const { resources, stats, unlocks, buyUnlock, armCollapse, ringProgress, collapseActive, collapseChoice,
    availableStardustOnPrestige, asteroid, relic } = useGame();
  const cost = bombCost(stats.singularityCount);
  const deepEnough = ringProgress.ring >= COLLAPSE_MIN_RING;
  const relicDef = RELICS.find(entry => entry.id === relic);

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto space-y-3">
      <div className="rounded-xl border border-[#c084fc]/30 bg-[#0d0816]/90 p-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-sm sm:text-base font-bold text-[#c084fc] tracking-wide uppercase font-mono">Collapse the Asteroid</h2>
            <p className="text-xs text-white/60 leading-relaxed">
              Dig to ring {COLLAPSE_MIN_RING} or deeper, then plant a singularity bomb. For {30} seconds the rock caves in: all damage x3, all ore x5, and explosions go off everywhere. After that you collect stardust, pick your next asteroid, and choose a relic for the next run.
            </p>
            <div className="text-[11px] font-mono text-white/50">
              Current: <span style={{ color: ASTEROIDS[asteroid].color }}>{ASTEROIDS[asteroid].name}</span>
              {relicDef && <> · Relic: <span className="text-[#ffb800]">{relicDef.name}</span> <span className="text-white/35">({relicDef.description})</span></>}
            </div>
          </div>
          <div className="text-right space-y-1.5">
            <div className="text-[11px] font-mono text-white/60">You'll get about <b className="text-[#c084fc]">+{availableStardustOnPrestige} ❖</b> (more if you mine more this run)</div>
            <div className="flex items-center justify-end gap-2">
              <CostTag cost={cost} resources={resources} />
              <BuyButton enabled={deepEnough && canAfford(resources, cost) && !collapseActive && !collapseChoice} onClick={armCollapse} color="#c084fc">
                {collapseActive ? 'Collapsing…' : 'Arm bomb'}
              </BuyButton>
            </div>
            {!deepEnough && <div className="text-[11px] font-mono text-red-300">Reach ring {COLLAPSE_MIN_RING} first (you're at ring {ringProgress.ring})</div>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/80 font-mono">Stardust Unlocks</h3>
        <span className="text-xs font-mono text-[#c084fc]">❖ {resources.stardust.toLocaleString()}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {UNLOCKS.map(unlock => {
          const level = unlocks[unlock.id] || 0;
          const maxed = level >= unlock.maxLevel;
          const locked = !!unlock.requires && !unlocks[unlock.requires];
          const price = unlockCost(unlock, level);
          return (
            <div key={unlock.id} className={`rounded-lg border p-2 space-y-1 ${maxed ? 'border-[#c084fc]/40 bg-[#c084fc]/5' : 'border-white/10 bg-[#080b12]/90'} ${locked ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[12px] font-semibold text-white">{unlock.name}</span>
                <span className="text-[10px] font-mono text-white/45">{level}/{unlock.maxLevel}</span>
              </div>
              <p className="text-[11px] text-white/55 leading-snug">{unlock.description}</p>
              {locked && <p className="text-[10px] text-white/40">Requires {UNLOCKS.find(entry => entry.id === unlock.requires)?.name}</p>}
              {!maxed && (
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-mono ${resources.stardust >= price ? 'text-[#c084fc]' : 'text-red-400'}`}>❖ {price}</span>
                  <BuyButton enabled={!locked && resources.stardust >= price} onClick={() => buyUnlock(unlock.id)} color="#c084fc">Unlock</BuyButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Shown when a collapse finishes: choose the next asteroid and one relic. */
export const CollapseModal: React.FC = () => {
  const { collapseChoice, confirmCollapse } = useGame();
  const [pickedAsteroid, setPickedAsteroid] = React.useState<AsteroidType | null>(null);
  const [pickedRelic, setPickedRelic] = React.useState<string | null>(null);
  if (!collapseChoice) return null;
  const asteroid = pickedAsteroid && collapseChoice.asteroids.includes(pickedAsteroid) ? pickedAsteroid : collapseChoice.asteroids[0];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
      <div className="w-full max-w-2xl rounded-2xl border border-[#c084fc]/40 bg-[#0b0712]/95 p-4 space-y-4 shadow-[0_0_40px_rgba(192,132,252,0.25)] max-h-full overflow-y-auto">
        <div className="text-center">
          <div className="text-xs font-mono uppercase tracking-[0.3em] text-[#c084fc]/70">The asteroid collapsed</div>
          <div className="text-2xl font-bold text-[#c084fc] font-mono">+{collapseChoice.stardust} ❖ stardust</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Next asteroid</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {collapseChoice.asteroids.map(type => (
              <button key={type} onClick={() => setPickedAsteroid(type)} className="rounded-lg border p-2 text-left transition-all"
                style={{ borderColor: asteroid === type ? ASTEROIDS[type].color : 'rgba(255,255,255,0.1)', background: asteroid === type ? ASTEROIDS[type].color + '18' : undefined }}>
                <div className="text-sm font-semibold" style={{ color: ASTEROIDS[type].color }}>{ASTEROIDS[type].name}</div>
                <div className="text-[11px] text-white/55 leading-snug">{ASTEROIDS[type].description}</div>
              </button>
            ))}
          </div>
          {collapseChoice.asteroids.length === 1 && <div className="text-[10px] text-white/35 mt-1">Buy asteroid charts with stardust to get more options.</div>}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">Choose a relic for this run</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {collapseChoice.relics.map(id => {
              const relic = RELICS.find(entry => entry.id === id)!;
              return (
                <button key={id} onClick={() => setPickedRelic(id)} className="rounded-lg border p-2 text-left transition-all"
                  style={{ borderColor: pickedRelic === id ? '#ffb800' : 'rgba(255,255,255,0.1)', background: pickedRelic === id ? '#ffb80018' : undefined }}>
                  <div className="text-sm font-semibold text-[#ffb800]">{relic.name}</div>
                  <div className="text-[11px] text-white/55 leading-snug">{relic.description}</div>
                </button>
              );
            })}
          </div>
        </div>
        <button disabled={!pickedRelic} onClick={() => { confirmCollapse(asteroid, pickedRelic!); setPickedRelic(null); setPickedAsteroid(null); }}
          className={`w-full py-2.5 rounded-lg font-bold uppercase tracking-wider text-sm ${pickedRelic ? 'bg-[#c084fc] text-black hover:bg-white' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}>
          {pickedRelic ? 'Jump to new asteroid' : 'Pick a relic'}
        </button>
      </div>
    </div>
  );
};
