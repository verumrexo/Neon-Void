import React, { useEffect, useState } from 'react';
import { useGame } from '../state/gameContext';
import { combat } from '../engine/weapons';

/** Live combat readouts: banners, heat, railgun charge, events, collapse countdown. */
export const HudOverlay: React.FC = () => {
  const { banners, loadout } = useGame();
  const [, setTick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setTick(value => value + 1), 150); return () => window.clearInterval(timer); }, []);

  const bars: { label: string; value: number; color: string }[] = [];
  if (loadout.config.overheats) bars.push(combat.overheated > 0
    ? { label: 'OVERHEATED', value: combat.overheated / 3, color: '#ff3366' }
    : { label: 'heat', value: combat.heat / 5, color: '#ff8a3d' });
  if (loadout.config.equipped.has('railgun')) bars.push({ label: 'railgun', value: combat.railCharge, color: '#b3f0ff' });
  if (combat.isCharging) bars.push({ label: 'salvo', value: combat.manualCharge / 1.5, color: '#ff6a2a' });
  if (combat.event) bars.push({ label: combat.event.type === 'meteors' ? 'meteor shower' : combat.event.type === 'flare' ? 'solar flare' : 'rival escapes in', value: Math.max(0, combat.event.time) / (combat.event.type === 'rival' ? 25 : combat.event.type === 'flare' ? 15 : 12), color: combat.event.type === 'rival' ? '#ff3366' : '#ffb800' });
  if (combat.rival) bars.push({ label: 'rival hull', value: combat.rival.hp / combat.rival.maxHp, color: '#ff3366' });

  return (
    <>
      {combat.collapse > 0 && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.35em] text-[#c084fc]/80">singularity collapse</div>
          <div className="text-3xl font-bold font-mono text-[#c084fc] tabular-nums" style={{ textShadow: '0 0 18px #c084fc' }}>{combat.collapse.toFixed(1)}s</div>
          <div className="text-[11px] font-mono text-white/60">ore x5 · damage x3</div>
        </div>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 w-[90%] max-w-md">
        {banners.map(banner => (
          <div key={banner.id} className="px-3 py-1 rounded-md border text-[11px] font-mono font-semibold bg-black/70 backdrop-blur animate-in fade-in slide-in-from-top-2"
            style={{ borderColor: banner.color + '88', color: banner.color }}>{banner.text}</div>
        ))}
      </div>
      {bars.length > 0 && (
        <div className="absolute left-4 bottom-[4.6rem] md:bottom-20 z-10 pointer-events-none space-y-1 w-44">
          {bars.map(bar => (
            <div key={bar.label}>
              <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: bar.color }}>{bar.label}</div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full" style={{ width: `${Math.min(100, bar.value * 100)}%`, background: bar.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
