import React from 'react';
import { useGame } from '../state/gameContext';
import { UpgradesState, RESOURCE_DEFINITIONS } from '../types/game';
import { Zap, Flame, Crosshair, GitFork, Magnet, Wind, Cpu } from 'lucide-react';

interface UpgradeCardData {
  key: keyof UpgradesState;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  getCurrentValue: (lvl: number) => string;
  getNextValue: (lvl: number) => string;
}

const UPGRADE_CONFIGS: UpgradeCardData[] = [
  {
    key: 'laserDamage',
    title: 'Laser Power Diode',
    description: 'Increases the base thermal energy output of all mining beams.',
    icon: Zap,
    getCurrentValue: (lvl) => `${Math.round(8 * Math.pow(1.32, lvl - 1))} dmg`,
    getNextValue: (lvl) => `${Math.round(8 * Math.pow(1.32, lvl))} dmg`,
  },
  {
    key: 'fireRate',
    title: 'Pulse Cadence',
    description: 'Accelerates the frequency of laser emission cycles per second.',
    icon: Flame,
    getCurrentValue: (lvl) => `${(1 + (lvl - 1) * 0.2).toFixed(1)}x rate`,
    getNextValue: (lvl) => `${(1 + lvl * 0.2).toFixed(1)}x rate`,
  },
  {
    key: 'laserRange',
    title: 'Focus Standoff Collimator',
    description: 'Extends the operational mining reach from the ship to the asteroid face.',
    icon: Crosshair,
    getCurrentValue: (lvl) => `${95 + (lvl - 1) * 18} px`,
    getNextValue: (lvl) => `${95 + lvl * 18} px`,
  },
  {
    key: 'beamCount',
    title: 'Multi-Beam Splitter',
    description: 'Directs simultaneous laser beams to multiple adjacent surface blocks.',
    icon: GitFork,
    getCurrentValue: (lvl) => `${lvl} beam${lvl > 1 ? 's' : ''}`,
    getNextValue: (lvl) => `${lvl + 1} beams`,
  },
  {
    key: 'collectorMagnet',
    title: 'Graviton Vacuum Radius',
    description: 'Expands the electromagnetic aura that vacuums minerals into the cargo bay.',
    icon: Magnet,
    getCurrentValue: (lvl) => `${80 + (lvl - 1) * 25} px`,
    getNextValue: (lvl) => `${80 + lvl * 25} px`,
  },
  {
    key: 'flightSpeed',
    title: 'Sub-Light Thrusters',
    description: 'Calibrates gentle cruising thrusters to reach distant deep-core crystal clusters.',
    icon: Wind,
    getCurrentValue: (lvl) => `${Math.round(34 * (1 + (lvl - 1) * 0.12))} px/s`,
    getNextValue: (lvl) => `${Math.round(34 * (1 + lvl * 0.12))} px/s`,
  },
  {
    key: 'droneBay',
    title: 'Shipyard',
    description: 'Builds another full-size ship sharing your mining and movement upgrades.',
    icon: Cpu,
    getCurrentValue: (lvl) => `${lvl} additional ship${lvl === 1 ? '' : 's'}`,
    getNextValue: (lvl) => `${lvl + 1} additional ships`,
  },
];

export const UpgradePanel: React.FC = () => {
  const { upgrades, resources, buyUpgrade, getUpgradeCost } = useGame();

  return (
    <div className="p-2 sm:p-5 max-w-4xl mx-auto space-y-3.5">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-mono">
            Ship System Upgrades
          </h2>
          <p className="text-xs text-white/50">
            Increase laser power, split beams across multiple targets, expand magnet collection, and expand your mining fleet.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {UPGRADE_CONFIGS.map((config) => {
          const currentLvl = upgrades[config.key];
          const costInfo = getUpgradeCost(config.key);
          const resDef = RESOURCE_DEFINITIONS[costInfo.resource];
          const currentAmount = resources[costInfo.resource] || 0;
          const canAfford = currentAmount >= costInfo.amount;
          const progressPercent = Math.min(100, Math.round((currentAmount / costInfo.amount) * 100));
          const Icon = config.icon;

          return (
            <div
              key={config.key}
              className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                canAfford
                  ? 'border-[#00f0ff]/30 bg-[#0a0f1d]/90 shadow-[0_0_15px_rgba(0,240,255,0.06)]'
                  : 'border-white/10 bg-[#080b12]/90 hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        canAfford
                          ? 'bg-[#00f0ff]/10 border-[#00f0ff]/30 text-[#00f0ff]'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-white tracking-tight">{config.title}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">
                    Lvl {currentLvl}
                  </span>
                </div>

                <p className="text-xs text-white/60 mb-2.5 leading-relaxed">{config.description}</p>

                <div className="flex items-center gap-2 text-xs font-mono text-white/50 mb-3 bg-black/30 px-2 py-1 rounded border border-white/5">
                  <span>Current: <strong className="text-white">{config.getCurrentValue(currentLvl)}</strong></span>
                  <span className="text-[#00f0ff]">➔</span>
                  <span>Next: <strong className="text-[#00f0ff]">{config.getNextValue(currentLvl)}</strong></span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                {/* Cost & Progress */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: resDef.color }}>{resDef.symbol}</span>
                    <span className="text-white/60">{resDef.name}:</span>
                    <span className={`font-semibold tabular-nums ${canAfford ? 'text-white' : 'text-red-400'}`}>
                      {currentAmount.toLocaleString()} / {costInfo.amount.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => buyUpgrade(config.key)}
                    disabled={!canAfford}
                    className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
                      canAfford
                        ? 'bg-white text-black hover:bg-[#00f0ff] shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                        : 'bg-white/5 text-white/25 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    Upgrade
                  </button>
                </div>

                {/* Progress bar to next upgrade */}
                {!canAfford && (
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/30 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
