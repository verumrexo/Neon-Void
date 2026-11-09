import React from 'react';
import { RESOURCE_DEFINITIONS, ResourceType } from '../types/game';
import type { Cost } from '../game/content';

/** Compact cost list; unaffordable entries turn red. */
export const CostTag: React.FC<{ cost: Cost; resources: Record<string, number> }> = ({ cost, resources }) => {
  const entries = Object.entries(cost).filter(([, value]) => (value || 0) > 0);
  if (!entries.length) return <span className="text-white/40 text-[11px] font-mono">free</span>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-mono">
      {entries.map(([key, value]) => {
        const def = RESOURCE_DEFINITIONS[key as ResourceType];
        const enough = (resources[key] || 0) >= (value || 0);
        return (
          <span key={key} className={enough ? 'text-white/80' : 'text-red-400'}>
            <span style={{ color: def.color }}>{def.symbol}</span> {value!.toLocaleString()}
          </span>
        );
      })}
    </span>
  );
};

export const BuyButton: React.FC<{ enabled: boolean; onClick: () => void; children: React.ReactNode; color?: string }> = ({ enabled, onClick, children, color = '#00f0ff' }) => (
  <button
    onClick={onClick}
    disabled={!enabled}
    style={enabled ? { boxShadow: `0 0 10px ${color}55` } : undefined}
    className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all active:scale-95 whitespace-nowrap ${
      enabled ? 'bg-white text-black hover:brightness-110 cursor-pointer' : 'bg-white/5 text-white/25 cursor-not-allowed border border-white/5'
    }`}
  >
    {children}
  </button>
);
