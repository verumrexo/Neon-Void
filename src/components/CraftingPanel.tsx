import React from 'react';
import { useGame } from '../state/gameContext';
import { RESOURCE_DEFINITIONS, ResourceType } from '../types/game';
import { Check, Shield, Wrench } from 'lucide-react';

export const CraftingPanel: React.FC = () => {
  const { craftingItems, resources, craftItem } = useGame();

  return (
    <div className="p-2 sm:p-5 max-w-4xl mx-auto space-y-3.5">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-mono">
            Gear & Hull Modifications
          </h2>
          <p className="text-xs text-white/50">
            Synthesize advanced ship components and structural modifications using refined asteroid minerals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {[...craftingItems].sort((a, b) => {
          const rank = (item: typeof a) => item.crafted ? -1 : Object.entries(item.cost).every(([key, amount]) => resources[key as keyof typeof resources] >= (amount || 0)) ? 1 : 0;
          return rank(b) - rank(a);
        }).map((item) => {
          let canAfford = true;
          for (const [res, amt] of Object.entries(item.cost)) {
            if ((resources[res as ResourceType] || 0) < (amt || 0)) {
              canAfford = false;
              break;
            }
          }

          return (
            <div
              key={item.id}
              className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                item.crafted
                  ? 'border-emerald-500/40 bg-[#061810]/80 shadow-[0_0_15px_rgba(0,255,136,0.06)]'
                  : canAfford
                  ? 'border-[#00ff88]/30 bg-[#091410]/80'
                  : 'border-white/10 bg-[#080b12]/90 hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        item.crafted
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-[#00f0ff]'
                      }`}
                    >
                      {item.crafted ? <Shield className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-semibold text-white tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                    Tier {item.tier}
                  </span>
                </div>

                <p className="text-xs text-white/60 mb-2 leading-relaxed">{item.description}</p>

                <div className="inline-block text-xs font-mono text-[#00ff88] mb-3 px-2 py-0.5 rounded bg-[#00ff88]/5 border border-[#00ff88]/15">
                  Effect: {item.effect}
                </div>
              </div>

              <div className="pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                {/* Cost pills */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  {Object.entries(item.cost).map(([resKey, amt]) => {
                    const def = RESOURCE_DEFINITIONS[resKey as ResourceType];
                    const currentAmt = resources[resKey as ResourceType] || 0;
                    const hasEnough = currentAmt >= (amt || 0);

                    return (
                      <span
                        key={resKey}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                          hasEnough
                            ? 'text-white/80 bg-white/5 border-white/10'
                            : 'text-red-400/80 bg-red-950/20 border-red-900/30'
                        }`}
                      >
                        <span style={{ color: def.color }}>{def.symbol}</span>
                        <span>{amt}</span>
                      </span>
                    );
                  })}
                </div>

                {item.crafted ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 shrink-0">
                    <Check className="w-4 h-4" />
                    <span>Installed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => craftItem(item.id)}
                    disabled={!canAfford}
                    className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                      canAfford
                        ? 'bg-white text-black hover:bg-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.3)]'
                        : 'bg-white/5 text-white/25 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    Assemble
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
