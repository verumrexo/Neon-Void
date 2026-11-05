import React, { useState } from 'react';
import { useGame } from '../state/gameContext';
import { RESOURCE_DEFINITIONS, ResourceType } from '../types/game';
import { RotateCcw, Compass, BarChart3, Info } from 'lucide-react';

export const StatsPanel: React.FC = () => {
  const { stats, resetAllProgress } = useGame();
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const resourceKeys: ResourceType[] = ['basalt', 'iron', 'quartz', 'emeraldite', 'voidOre', 'sunstone', 'stardust'];

  return (
    <div className="p-2 sm:p-5 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-mono">
            Mission Telemetry
          </h2>
          <p className="text-xs text-white/50">
            Historical extraction statistics and sector progression.
          </p>
        </div>
      </div>

      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-xl border border-white/10 bg-[#080b12]/90">
          <div className="flex items-center gap-1.5 text-white/50 text-[11px] font-mono uppercase mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span>Mined This Sector</span>
          </div>
          <div className="text-xl font-bold text-white font-mono tabular-nums">
            {(stats.blocksDestroyedThisRun || 0).toLocaleString()}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-white/10 bg-[#080b12]/90">
          <div className="flex items-center gap-1.5 text-white/50 text-[11px] font-mono uppercase mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-white/40" />
            <span>All-Time Blocks</span>
          </div>
          <div className="text-xl font-bold text-white/80 font-mono tabular-nums">
            {stats.totalBlocksDestroyed.toLocaleString()}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-white/10 bg-[#080b12]/90">
          <div className="flex items-center gap-1.5 text-white/50 text-[11px] font-mono uppercase mb-1">
            <Compass className="w-3.5 h-3.5 text-[#00ff88]" />
            <span>Deepest Depth</span>
          </div>
          <div className="text-xl font-bold text-white font-mono tabular-nums">
            {stats.maxDepthReached.toLocaleString()}
          </div>
        </div>

        <div className="p-3 rounded-xl border border-white/10 bg-[#080b12]/90">
          <div className="flex items-center gap-1.5 text-white/50 text-[11px] font-mono uppercase mb-1">
            <Info className="w-3.5 h-3.5 text-[#c084fc]" />
            <span>Singularities</span>
          </div>
          <div className="text-xl font-bold text-[#c084fc] font-mono tabular-nums">
            {stats.singularityCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Lifetime Resources Breakdown */}
      <div className="p-4 rounded border border-white/10 bg-[#090b10] space-y-3">
        <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white/70">
          All-Time Resources Extracted
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {resourceKeys.map((resKey) => {
            const def = RESOURCE_DEFINITIONS[resKey];
            const amount = stats.lifetimeResources[resKey] || 0;
            return (
              <div key={resKey} className="p-2.5 rounded bg-white/5 flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span style={{ color: def.color }}>{def.symbol}</span>
                  <span className="text-white/60">{def.name}</span>
                </div>
                <span className="text-white font-semibold tabular-nums">
                  {amount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded border border-white/10 bg-[#090b10] text-xs text-white/60 space-y-2">
        <h3 className="font-bold font-mono uppercase tracking-wider text-white/80">Circular Foraging</h3>
        <p>Ships drift around spawn like bees, gradually exploring outward. Their directions alternate clockwise and counterclockwise.</p>
        <p>Mining happens while flying. Extra beams can reach exposed ore in neighboring rings. Minerals enter cargo automatically.</p>
      </div>

      {/* Danger Zone: Wipe Save Data */}
      <div className="p-4 rounded border border-red-500/20 bg-red-950/10 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-red-400">Reset All Game Progress</div>
          <div className="text-[11px] text-white/40">Permanently erase local save data and start fresh from scratch.</div>
        </div>

        {confirmReset ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmReset(false)}
              className="px-2.5 py-1 text-xs text-white/60 hover:text-white rounded border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                resetAllProgress();
                setConfirmReset(false);
              }}
              className="px-3 py-1 text-xs font-bold rounded bg-red-500 text-white hover:bg-red-400"
            >
              Confirm Wipe
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Save</span>
          </button>
        )}
      </div>
    </div>
  );
};
