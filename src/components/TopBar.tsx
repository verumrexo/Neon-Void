import React from 'react';
import { useGame } from '../state/gameContext';
import { RESOURCE_DEFINITIONS, ResourceType } from '../types/game';
import { sound } from '../audio/sound';
import { Volume2, VolumeX, Sparkles, Activity } from 'lucide-react';

interface TopBarProps {
  activeTab: 'upgrades' | 'crafting' | 'quantum' | 'stats' | null;
  setActiveTab: (tab: 'upgrades' | 'crafting' | 'quantum' | 'stats') => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeTab, setActiveTab }) => {
  const { resources, currentDps, availableStardustOnPrestige } = useGame();
  const [muted, setMuted] = React.useState<boolean>(sound.getMuted());

  const handleToggleMute = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
  };

  const primaryResources: ResourceType[] = ['basalt', 'iron', 'quartz', 'emeraldite', 'voidOre', 'sunstone'];

  return (
    <header className="relative z-30 flex flex-col border-b border-white/10 bg-[#06080e]/95 backdrop-blur-xl">
      {/* Primary Status Bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        {/* Left: Brand & Telemetry */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff] animate-pulse" />
            <span className="text-sm font-bold tracking-wider text-white uppercase font-mono">
              NEON VOID
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[11px] font-mono text-white/80">
            <Activity className="w-3 h-3 text-[#00f0ff]" />
            <span>{currentDps.toLocaleString()} DPS</span>
          </div>
        </div>

        {/* Center: Desktop Navigation Tabs (Hidden on mobile portrait) */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveTab('upgrades')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'upgrades'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Upgrades
          </button>
          <button
            onClick={() => setActiveTab('crafting')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'crafting'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Crafting
          </button>
          <button
            onClick={() => setActiveTab('quantum')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'quantum'
                ? 'bg-[#c084fc] text-black font-semibold shadow-[0_0_12px_rgba(192,132,252,0.5)]'
                : 'text-[#c084fc] hover:bg-[#c084fc]/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Singularity {availableStardustOnPrestige > 0 ? `(+${availableStardustOnPrestige})` : ''}</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeTab === 'stats'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            Stats
          </button>
        </nav>

        {/* Right: Audio Control & Quick Status */}
        <div className="flex items-center gap-2 shrink-0">
          {availableStardustOnPrestige > 0 && (
            <button
              onClick={() => setActiveTab('quantum')}
              className="flex md:hidden items-center gap-1 px-2 py-0.5 rounded border border-[#c084fc]/40 bg-[#c084fc]/10 text-[11px] font-mono font-semibold text-[#c084fc] animate-pulse"
            >
              <Sparkles className="w-3 h-3" />
              <span>+{availableStardustOnPrestige}</span>
            </button>
          )}

          <button
            onClick={handleToggleMute}
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-[#00f0ff]" />}
          </button>
        </div>
      </div>

      {/* Row 2: High-contrast, tactile horizontal resource ticker */}
      <div className="flex items-center gap-2.5 overflow-x-auto px-4 py-1.5 border-t border-white/5 bg-[#04060a]/80 scrollbar-none text-xs font-mono">
        {primaryResources.map((resKey) => {
          const count = resources[resKey] || 0;
          const def = RESOURCE_DEFINITIONS[resKey];
          // Hide deep ores until discovered or possessed
          if (count === 0 && (resKey === 'emeraldite' || resKey === 'voidOre' || resKey === 'sunstone')) {
            return null;
          }

          return (
            <div
              key={resKey}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] whitespace-nowrap"
            >
              <span style={{ color: def.color }}>{def.symbol}</span>
              <span className="text-white/50 text-[11px]">{def.name}:</span>
              <span className="text-white font-medium tabular-nums" style={{ textShadow: `0 0 6px ${def.glow}` }}>
                {count.toLocaleString()}
              </span>
            </div>
          );
        })}

        {/* Stardust Counter */}
        {resources.stardust > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#c084fc]/10 border border-[#c084fc]/20 text-[#c084fc] whitespace-nowrap">
            <span>❖</span>
            <span className="text-[11px] opacity-70">Stardust:</span>
            <span className="font-semibold tabular-nums" style={{ textShadow: '0 0 8px rgba(192, 132, 252, 0.8)' }}>
              {resources.stardust.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
