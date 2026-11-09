import React, { useState } from 'react';
import { useGame } from '../state/gameContext';
import { MODULES, moduleDef, WING_ROLES, WingRole, canAfford } from '../game/content';
import { CostTag, BuyButton } from './ui';

const CELL = 52;

export const HullPanel: React.FC = () => {
  const { hull, resources, loadout, buildModule, placeModule, unplaceModule, setWingRole } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const selectedItem = hull.built.find(item => item.uid === selected);
  const selectedDef = selectedItem ? moduleDef(selectedItem.id) : null;
  const placedIds = new Set(hull.placed.map(module => module.uid));
  const storage = hull.built.filter(item => !placedIds.has(item.uid));

  const onCell = (x: number, y: number) => {
    if (selected && placeModule(selected, x, y)) setSelected(null);
  };

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto space-y-3">
      <div className="border-b border-white/10 pb-2.5">
        <h2 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-mono">Hull Modules</h2>
        <p className="text-xs text-white/50">
          Build modules, then place them on your {loadout.hullCols}×{loadout.hullRows} hull. Space is limited, and modules placed next to each other create combos. Only placed modules do anything.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Grid */}
        <div className="shrink-0 space-y-2">
          <div className="relative rounded-lg border border-white/10 bg-black/40"
            style={{ width: loadout.hullCols * CELL + 8, height: loadout.hullRows * CELL + 8, padding: 4 }}
            onMouseLeave={() => setHover(null)}>
            {Array.from({ length: loadout.hullRows }, (_, y) => Array.from({ length: loadout.hullCols }, (_, x) => (
              <div key={`${x},${y}`} onClick={() => onCell(x, y)} onMouseEnter={() => setHover({ x, y })}
                className={`absolute border border-dashed border-white/10 rounded ${selected ? 'cursor-pointer hover:bg-white/5' : ''}`}
                style={{ left: 4 + x * CELL, top: 4 + y * CELL, width: CELL - 2, height: CELL - 2 }} />
            )))}
            {selectedDef && hover && (
              <div className="absolute rounded pointer-events-none border-2"
                style={{ left: 4 + hover.x * CELL, top: 4 + hover.y * CELL, width: selectedDef.w * CELL - 2, height: selectedDef.h * CELL - 2,
                  borderColor: selectedDef.color, background: selectedDef.color + '22' }} />
            )}
            {hull.placed.map(module => {
              const def = moduleDef(module.id);
              const active = selected === module.uid;
              return (
                <button key={module.uid} onClick={() => setSelected(active ? null : module.uid)}
                  className="absolute rounded-md border text-[10px] font-mono font-semibold leading-tight p-1 text-left transition-all"
                  style={{ left: 4 + module.x * CELL, top: 4 + module.y * CELL, width: def.w * CELL - 2, height: def.h * CELL - 2,
                    borderColor: def.color, background: def.color + (active ? '40' : '22'), color: def.color,
                    boxShadow: active ? `0 0 12px ${def.color}` : undefined, pointerEvents: selected && !active ? 'none' : 'auto' }}>
                  {def.name}
                </button>
              );
            })}
          </div>
          {selectedItem && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-white/60">
              <span>Placing <b style={{ color: selectedDef!.color }}>{selectedDef!.name}</b>: click a cell to set its top-left corner.</span>
              {placedIds.has(selectedItem.uid) && (
                <button className="text-red-300 hover:text-red-200 underline" onClick={() => { unplaceModule(selectedItem.uid); setSelected(null); }}>remove</button>
              )}
            </div>
          )}
          {loadout.synergies.length > 0 && (
            <div className="space-y-0.5">
              {loadout.synergies.map(text => <div key={text} className="text-[11px] font-mono text-[#a3e635]">⚡ {text}</div>)}
            </div>
          )}
          {loadout.config.overheats && (
            <div className="text-[11px] font-mono text-[#ff3366]">⚠ The Overcharged Core will overheat. Put a Coolant Loop next to it.</div>
          )}
          {storage.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">In storage</div>
              <div className="flex flex-wrap gap-1.5">
                {storage.map(item => {
                  const def = moduleDef(item.id);
                  return (
                    <button key={item.uid} onClick={() => setSelected(selected === item.uid ? null : item.uid)}
                      className="px-2 py-1 rounded border text-[11px] font-mono"
                      style={{ borderColor: def.color + (selected === item.uid ? 'ff' : '55'), color: def.color, background: selected === item.uid ? def.color + '22' : undefined }}>
                      {def.name} <span className="text-white/40">{def.w}×{def.h}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Catalogue */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 content-start">
          {MODULES.map(def => (
            <div key={def.id} className="rounded-lg border border-white/10 bg-[#080b12]/90 p-2 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[12px] font-semibold" style={{ color: def.color }}>{def.name} <span className="text-white/35 font-mono text-[10px]">{def.w}×{def.h}</span></span>
                <BuyButton enabled={canAfford(resources, def.cost)} onClick={() => buildModule(def.id)} color={def.color}>Build</BuyButton>
              </div>
              <p className="text-[11px] text-white/60 leading-snug">{def.description}</p>
              {def.adjacency && <p className="text-[11px] text-[#a3e635]/80 leading-snug">⚡ {def.adjacency}</p>}
              {def.drawback && <p className="text-[11px] text-[#ff3366]/90 leading-snug">⚠ {def.drawback}</p>}
              <CostTag cost={def.cost} resources={resources} />
            </div>
          ))}
        </div>
      </div>

      {loadout.wingmen > 0 && (
        <div className="pt-2 border-t border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white/80 font-mono mb-1.5">Wingmen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {loadout.config.roles.map((role, index) => (
              <div key={index} className="rounded-lg border border-white/10 p-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono text-white/50 mr-1">Wing {index + 1}</span>
                {(Object.keys(WING_ROLES) as WingRole[]).map(option => (
                  <button key={option} onClick={() => setWingRole(index, option)} title={WING_ROLES[option].description}
                    className="px-2 py-0.5 rounded border text-[11px] font-mono"
                    style={role === option
                      ? { background: WING_ROLES[option].color, borderColor: WING_ROLES[option].color, color: '#000' }
                      : { borderColor: WING_ROLES[option].color + '55', color: WING_ROLES[option].color }}>
                    {WING_ROLES[option].name}
                  </button>
                ))}
                <p className="w-full text-[11px] text-white/45">{role ? WING_ROLES[role].description : 'No role assigned'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
