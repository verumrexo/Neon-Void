import React from 'react';
import { useGame } from '../state/gameContext';
import { WEAPONS, WEAPON_ORDER, canAfford } from '../game/content';
import { CostTag, BuyButton } from './ui';

export const ArsenalPanel: React.FC = () => {
  const { arsenal, resources, loadout, unlockWeapon, levelWeapon, buyMod, toggleEquip } = useGame();
  const equippedCount = arsenal.equipped.length;

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-2.5">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-mono">Weapon Loadout</h2>
          <p className="text-xs text-white/50">
            Equip up to <b className="text-white">{loadout.slots}</b> weapons. Each mod changes how a weapon behaves. When rockets are equipped, click or tap the rock to fire a salvo, and hold to load more rockets.
          </p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: loadout.slots }, (_, index) => {
            const id = arsenal.equipped[index];
            const weapon = id ? WEAPONS[id] : null;
            return (
              <div key={index} className="px-2 py-1 rounded-md border text-[11px] font-mono min-w-[72px] text-center"
                style={{ borderColor: weapon ? weapon.color + '88' : 'rgba(255,255,255,0.1)', color: weapon?.color || 'rgba(255,255,255,0.3)' }}>
                {weapon?.name || 'empty slot'}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {WEAPON_ORDER.map(id => {
          const weapon = WEAPONS[id];
          const unlocked = arsenal.unlocked.includes(id);
          const equipped = arsenal.equipped.includes(id);
          const level = arsenal.levels[id];
          const levelCost = weapon.levelCost(level);
          return (
            <div key={id} className="rounded-xl border p-3 bg-[#080b12]/90 space-y-2"
              style={{ borderColor: equipped ? weapon.color + '66' : 'rgba(255,255,255,0.1)', boxShadow: equipped ? `0 0 18px ${weapon.color}14` : undefined }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: weapon.color, boxShadow: `0 0 8px ${weapon.color}` }} />
                  <span className="text-sm font-semibold text-white">{weapon.name}</span>
                  {unlocked && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">Lv {level}</span>}
                </div>
                {unlocked ? (
                  <button onClick={() => toggleEquip(id)}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-md border transition-all ${equipped ? 'text-black' : 'text-white/70 border-white/15 hover:text-white'}`}
                    style={equipped ? { background: weapon.color, borderColor: weapon.color } : undefined}
                    title={!equipped && equippedCount >= loadout.slots ? 'Swaps out your oldest equipped weapon' : undefined}>
                    {equipped ? 'Equipped' : 'Equip'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <CostTag cost={weapon.unlockCost} resources={resources} />
                    <BuyButton enabled={canAfford(resources, weapon.unlockCost)} onClick={() => unlockWeapon(id)} color={weapon.color}>Build</BuyButton>
                  </div>
                )}
              </div>
              <p className="text-xs text-white/55 leading-relaxed">{weapon.description}</p>

              {unlocked && (
                <>
                  <div className="flex items-center justify-between gap-2 bg-black/30 rounded-md px-2 py-1.5 border border-white/5">
                    <span className="text-[11px] font-mono text-white/60">Power level {level} → {level + 1} <span className="text-white/35">(+{id === 'laser' ? 32 : 22}% damage)</span></span>
                    <div className="flex items-center gap-2">
                      <CostTag cost={levelCost} resources={resources} />
                      <BuyButton enabled={canAfford(resources, levelCost)} onClick={() => levelWeapon(id)} color={weapon.color}>+1</BuyButton>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {weapon.mods.map(mod => {
                      const owned = arsenal.mods.includes(`${id}.${mod.id}`);
                      return (
                        <div key={mod.id} className={`rounded-md border px-2 py-1.5 ${owned ? 'bg-white/[0.04]' : 'border-white/5'}`}
                          style={owned ? { borderColor: weapon.color + '55' } : undefined}>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[12px] font-semibold" style={{ color: owned ? weapon.color : 'white' }}>{mod.name}</span>
                            {owned ? <span className="text-[10px] font-mono" style={{ color: weapon.color }}>installed</span>
                              : <BuyButton enabled={canAfford(resources, mod.cost)} onClick={() => buyMod(id, mod.id)} color={weapon.color}>Install</BuyButton>}
                          </div>
                          <p className="text-[11px] text-white/50 leading-snug">{mod.description}</p>
                          {!owned && <div className="mt-0.5"><CostTag cost={mod.cost} resources={resources} /></div>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
