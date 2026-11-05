import React, { useState } from 'react';
import { useGame } from '../state/gameContext';
import { Sparkles, Zap, GitFork, Cpu, Gem, Radio, Coins, AlertCircle } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Zap,
  GitFork,
  Cpu,
  Gem,
  Radio,
  Coins,
};

export const QuantumTree: React.FC = () => {
  const {
    resources,
    quantumPerks,
    stats,
    availableStardustOnPrestige,
    buyQuantumPerk,
    triggerQuantumSingularity,
  } = useGame();

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<'all' | 'combat' | 'automation' | 'cosmic'>('all');

  const filteredPerks =
    selectedBranch === 'all'
      ? quantumPerks
      : quantumPerks.filter((p) => p.branch === selectedBranch);

  return (
    <div className="quantum-panel p-4 max-w-4xl mx-auto space-y-6">
      {/* Header: Singularity Chamber */}
      <div className="p-5 rounded-lg border border-[#c084fc]/30 bg-gradient-to-r from-[#0d0914] via-[#090b10] to-[#0d0914] relative overflow-hidden">
        <div className="flex flex-col items-start justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-[#c084fc]" />
              <h2 className="text-base font-bold text-white tracking-wide uppercase">
                Quantum Singularity
              </h2>
            </div>
            <p className="text-xs text-white/60 max-w-lg">
              Collapse the current sector into a singularity. Convert excavated matter into permanent{' '}
              <strong className="text-[#c084fc]">Stardust</strong> to unlock irreversible quantum perks.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 shrink-0">
            <div className="font-mono">
              <div className="text-[11px] text-white/40 uppercase">Claimable Stardust</div>
              <div className="text-xl font-bold text-[#c084fc] tabular-nums" style={{ textShadow: '0 0 12px rgba(192, 132, 252, 0.8)' }}>
                {availableStardustOnPrestige > 0 ? `+${availableStardustOnPrestige.toLocaleString()} ❖` : '0 ❖'}
              </div>
            </div>

            <button
              onClick={() => availableStardustOnPrestige > 0 && setConfirmModalOpen(true)}
              disabled={availableStardustOnPrestige <= 0}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded transition-all ${
                availableStardustOnPrestige > 0
                  ? 'bg-[#c084fc] text-black hover:bg-white shadow-[0_0_15px_rgba(192,132,252,0.6)] cursor-pointer'
                  : 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
              }`}
            >
              {availableStardustOnPrestige > 0 ? 'Trigger Singularity' : 'Collapse Locked'}
            </button>
          </div>
        </div>

        {/* Sector Progress Bar to unlock Singularity */}
        <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-white/60">
            <span>Mining progress:</span>
            <span className="text-white font-semibold tabular-nums">
              {stats.blocksDestroyedThisRun || 0} / 120 blocks
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00f0ff] to-[#c084fc] transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round(((stats.blocksDestroyedThisRun || 0) / 120) * 100))}%` }}
            />
          </div>
        </div>

        {/* Total Reserve Counter */}
        <div className="mt-3 flex items-center justify-between text-xs font-mono">
          <div className="text-white/60">
            Total Stardust In Reserve:{' '}
            <strong className="text-white text-sm tabular-nums">{resources.stardust.toLocaleString()} ❖</strong>
          </div>
          <div className="text-white/40">
            Singularities Performed: <strong className="text-white">{stats.singularityCount}</strong>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full p-6 rounded-lg border border-[#c084fc]/50 bg-[#090b10] space-y-4 shadow-[0_0_30px_rgba(192,132,252,0.2)]">
            <div className="flex items-center gap-2 text-[#c084fc]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wide">Confirm Spacetime Collapse</h3>
            </div>

            <div className="text-xs text-white/70 space-y-2">
              <p>Triggering a Quantum Singularity will:</p>
              <ul className="list-disc list-inside space-y-1 text-white/90">
                <li>Reset the local asteroid grid back to initial cavern clearing</li>
                <li>Reset current minerals and basic ship upgrades</li>
                <li>Preserve all Quantum Perks and earned Stardust</li>
                <li>Award you <strong className="text-[#c084fc]">+{availableStardustOnPrestige} Stardust</strong></li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white rounded border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  triggerQuantumSingularity();
                  setConfirmModalOpen(false);
                }}
                className="px-4 py-1.5 text-xs font-bold rounded bg-[#c084fc] text-black hover:bg-white shadow-[0_0_12px_rgba(192,132,252,0.5)]"
              >
                Execute Collapse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Filters */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-medium">
        <span className="text-white/40 mr-2">Filter Branch:</span>
        {(['all', 'combat', 'automation', 'cosmic'] as const).map((branch) => (
          <button
            key={branch}
            onClick={() => setSelectedBranch(branch)}
            className={`px-3 py-1 rounded transition-colors uppercase tracking-wider text-[11px] ${
              selectedBranch === branch
                ? 'bg-white text-black font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {branch}
          </button>
        ))}
      </div>

      {/* Quantum Perk Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...filteredPerks].sort((a, b) => {
          const rank = (perk: typeof a) => perk.level >= perk.maxLevel ? -1 : resources.stardust >= Math.floor(perk.cost * Math.pow(perk.costMultiplier, perk.level)) ? 1 : 0;
          return rank(b) - rank(a);
        }).map((perk) => {
          const currentCost = Math.floor(perk.cost * Math.pow(perk.costMultiplier, perk.level));
          const isMax = perk.level >= perk.maxLevel;
          const canAfford = !isMax && resources.stardust >= currentCost;
          const Icon = ICON_MAP[perk.iconName] || Sparkles;

          return (
            <div
              key={perk.id}
              className={`flex flex-col justify-between p-4 rounded border transition-all ${
                perk.level > 0
                  ? 'border-[#c084fc]/30 bg-[#0c0914]'
                  : 'border-white/10 bg-[#090b10] hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-[#c084fc]/10 text-[#c084fc]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-white">{perk.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-white/50">
                    Lvl {perk.level} / {perk.maxLevel}
                  </span>
                </div>

                <p className="text-xs text-white/60 mb-3">{perk.description}{perk.id === 'exotic_vein_finder' && <span className="block mt-1 text-[#00f0ff]">Current ore chance bonus: +{perk.level * 20}%. Persists after singularity. Rare ores start {Math.min(30, perk.level * 5)}% closer (5% per level, capped at 30%).</span>}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="text-xs font-mono text-white/60">
                  {isMax ? (
                    <span className="text-emerald-400 font-semibold">MAX LEVEL</span>
                  ) : (
                    <span>
                      Cost: <strong className={canAfford ? 'text-[#c084fc]' : 'text-red-400'}>{currentCost} ❖</strong>
                    </span>
                  )}
                </div>

                {!isMax && (
                  <button
                    onClick={() => buyQuantumPerk(perk.id)}
                    disabled={!canAfford}
                    className={`px-3 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap ${
                      canAfford
                        ? 'bg-[#c084fc] text-black hover:bg-white shadow-[0_0_10px_rgba(192,132,252,0.4)]'
                        : 'bg-white/5 text-white/25 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    Unlock Level
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
