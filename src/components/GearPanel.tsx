import React, { useState } from 'react';
import { useGame } from '../state/gameContext';
import {
  GEAR_SLOTS,
  GEAR_SLOT_KEYS,
  RARITY_CONFIG,
  LEGENDARY_POWERS,
  formatStatValue,
  getGearUpgradeCost,
} from '../game/equipment';
import type { GearSlot, GearItem } from '../types/equipment';
import { CostTag, BuyButton } from './ui';
import { Zap, Rocket, Shield, Wind, Radio, Cpu, Sparkles, Trash2, ArrowUpCircle } from 'lucide-react';
import { canAfford } from '../game/content';

const SLOT_ICONS: Record<GearSlot, React.ComponentType<{ className?: string }>> = {
  lens: Zap,
  ordnance: Rocket,
  chassis: Shield,
  thruster: Wind,
  sensor: Radio,
  core: Cpu,
};

export const GearPanel: React.FC = () => {
  const {
    equippedGear,
    inventoryGear,
    gearBonus,
    resources,
    equipGear,
    unequipGear,
    scrapGear,
    scrapAllCommon,
    upgradeGear,
  } = useGame();

  const [filterSlot, setFilterSlot] = useState<GearSlot | 'all'>('all');
  const [selectedGear, setSelectedGear] = useState<GearItem | null>(null);

  const filteredInventory = inventoryGear.filter(
    (item) => filterSlot === 'all' || item.slot === filterSlot
  );

  const commonCount = inventoryGear.filter((item) => item.rarity === 'common').length;

  return (
    <div className="p-2 sm:p-4 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-2.5">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase font-mono">
            Equipment & Salvage Bay
          </h2>
          <p className="text-xs text-white/50">
            Equip looted components to amplify weapon lethality, flight speed, and critical strike chances.
            Salvaged from Armored Cores, Rival Miners, and deep ring strata.
          </p>
        </div>

        {commonCount > 0 && (
          <button
            onClick={scrapAllCommon}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Scrap {commonCount} Common</span>
          </button>
        )}
      </div>

      {/* Aggregate Stats Bar */}
      <div className="p-2.5 rounded-xl border border-white/10 bg-[#080b14]/90 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono text-white/80">
        <span className="text-[10px] uppercase font-bold tracking-wider text-white/40">Equipped Stats:</span>
        {gearBonus.damageMult > 1 && (
          <span className="text-white">
            Damage: <b className="text-[#00f0ff]">+{Math.round((gearBonus.damageMult - 1) * 100)}%</b>
          </span>
        )}
        {gearBonus.laserDamageMult > 1 && (
          <span className="text-white">
            Laser: <b className="text-[#00f0ff]">+{Math.round((gearBonus.laserDamageMult - 1) * 100)}%</b>
          </span>
        )}
        {gearBonus.rocketDamageMult > 1 && (
          <span className="text-white">
            Rocket: <b className="text-[#ff6a2a]">+{Math.round((gearBonus.rocketDamageMult - 1) * 100)}%</b>
          </span>
        )}
        <span className="text-white">
          Crit Chance: <b className="text-[#ffb800]">{(gearBonus.critChance * 100).toFixed(1)}%</b>{' '}
          <span className="text-white/40">({gearBonus.critDamageMult.toFixed(1)}×)</span>
        </span>
        {gearBonus.flightSpeedMult > 1 && (
          <span className="text-white">
            Speed: <b className="text-[#a3e635]">+{Math.round((gearBonus.flightSpeedMult - 1) * 100)}%</b>
          </span>
        )}
        {gearBonus.extraReach > 0 && (
          <span className="text-white">
            Reach: <b className="text-[#38bdf8]">+{Math.round(gearBonus.extraReach)}px</b>
          </span>
        )}
        {gearBonus.rareOreBoost > 0 && (
          <span className="text-white">
            Rare Veins: <b className="text-[#00ff88]">+{Math.round(gearBonus.rareOreBoost * 100)}%</b>
          </span>
        )}
      </div>

      {/* Legendary Powers Active */}
      {gearBonus.powers.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from(gearBonus.powers).map((pKey) => {
            const pDef = LEGENDARY_POWERS[pKey];
            return (
              <div
                key={pKey}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#ffb800]/40 bg-[#ffb800]/10 text-xs font-mono text-[#ffb800]"
                title={pDef.description}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-bold">{pDef.name}:</span>
                <span className="text-white/80">{pDef.description}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 6 Equipped Gear Slots */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 font-mono mb-2">
          Equipped Components
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {GEAR_SLOT_KEYS.map((slot) => {
            const item = equippedGear[slot];
            const slotDef = GEAR_SLOTS[slot];
            const Icon = SLOT_ICONS[slot];

            if (!item) {
              return (
                <div
                  key={slot}
                  className="flex flex-col justify-between p-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] min-h-[110px]"
                >
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="p-1.5 rounded-lg border border-white/5 bg-white/5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold block">{slotDef.name}</span>
                      <span className="text-[10px] text-white/30">Empty Slot</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/30 italic">{slotDef.description}</p>
                </div>
              );
            }

            const rConf = RARITY_CONFIG[item.rarity];
            const upgradeCost = getGearUpgradeCost(item);
            const canUpgrade = canAfford(resources, upgradeCost) && item.level < 20;

            return (
              <div
                key={slot}
                className="flex flex-col justify-between p-3 rounded-xl border bg-[#080b12]/95 space-y-2 transition-all"
                style={{
                  borderColor: `${rConf.color}66`,
                  boxShadow: `0 0 16px ${rConf.color}15`,
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-lg border text-white"
                        style={{ background: `${rConf.color}20`, borderColor: `${rConf.color}50`, color: rConf.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block tracking-tight">{item.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          <span style={{ color: rConf.color }} className="font-semibold uppercase">
                            {rConf.name}
                          </span>
                          <span className="text-white/40">·</span>
                          <span className="text-white/60">Lv {item.level}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => unequipGear(slot)}
                      className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border border-white/15 text-white/50 hover:text-white hover:border-white/30 transition-all cursor-pointer"
                    >
                      Unequip
                    </button>
                  </div>

                  {/* Primary Stat */}
                  <div className="mt-1.5 bg-black/40 rounded-lg px-2.5 py-1 border border-white/5 text-xs font-mono">
                    <span className="text-white/50 text-[11px]">Primary: </span>
                    <strong style={{ color: rConf.color }}>
                      {formatStatValue(item.primaryStat.stat, item.primaryStat.value)}
                    </strong>
                  </div>

                  {/* Affixes */}
                  {item.affixes.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 text-[11px] font-mono text-white/70">
                      {item.affixes.map((affix, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="text-white/30">▸</span>
                          <span>{formatStatValue(affix.stat, affix.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legendary power badge */}
                  {item.legendaryPower && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-[#ffb800] bg-[#ffb800]/10 border border-[#ffb800]/30 rounded px-2 py-1">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>{LEGENDARY_POWERS[item.legendaryPower].name}: {LEGENDARY_POWERS[item.legendaryPower].description}</span>
                    </div>
                  )}
                </div>

                {/* Upgrade & Scrap Row */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    {item.level < 20 ? (
                      <>
                        <CostTag cost={upgradeCost} resources={resources} />
                        <BuyButton
                          enabled={canUpgrade}
                          onClick={() => upgradeGear(item)}
                          color={rConf.color}
                        >
                          <span className="flex items-center gap-1">
                            <ArrowUpCircle className="w-3 h-3" /> Lv {item.level + 1}
                          </span>
                        </BuyButton>
                      </>
                    ) : (
                      <span className="text-[10px] text-[#ffb800] uppercase font-bold">Max Level</span>
                    )}
                  </div>

                  <button
                    onClick={() => scrapGear(item)}
                    title="Scrap for minerals"
                    className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory Section */}
      <div className="pt-2 border-t border-white/10 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 font-mono">
              Salvage Inventory ({inventoryGear.length}/36)
            </h3>
          </div>

          {/* Slot filters */}
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
            <button
              onClick={() => setFilterSlot('all')}
              className={`px-2.5 py-0.5 rounded-md border transition-all ${
                filterSlot === 'all'
                  ? 'bg-white text-black font-semibold'
                  : 'text-white/50 border-white/10 hover:text-white'
              }`}
            >
              All
            </button>
            {GEAR_SLOT_KEYS.map((slot) => {
              const count = inventoryGear.filter((g) => g.slot === slot).length;
              return (
                <button
                  key={slot}
                  onClick={() => setFilterSlot(slot)}
                  className={`px-2.5 py-0.5 rounded-md border transition-all flex items-center gap-1 ${
                    filterSlot === slot
                      ? 'bg-white text-black font-semibold'
                      : 'text-white/50 border-white/10 hover:text-white'
                  }`}
                >
                  <span>{GEAR_SLOTS[slot].name}</span>
                  {count > 0 && <span className="opacity-60 text-[9px]">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inventory Items List */}
        {filteredInventory.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-white/10 text-center text-xs text-white/40 font-mono">
            No components in salvage bay. Crack Armored Cores or destroy Rival Miners to salvage high-tier gear!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredInventory.map((item) => {
              const rConf = RARITY_CONFIG[item.rarity];
              const slotDef = GEAR_SLOTS[item.slot];
              const Icon = SLOT_ICONS[item.slot];
              const upgradeCost = getGearUpgradeCost(item);
              const canUpgrade = canAfford(resources, upgradeCost) && item.level < 20;

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between p-3 rounded-xl border bg-[#060810]/90 space-y-2 hover:border-white/30 transition-all"
                  style={{ borderColor: `${rConf.color}40` }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="p-1.5 rounded-lg border"
                          style={{ background: `${rConf.color}15`, borderColor: `${rConf.color}40`, color: rConf.color }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block tracking-tight">{item.name}</span>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono">
                            <span style={{ color: rConf.color }} className="font-semibold uppercase">
                              {rConf.name}
                            </span>
                            <span className="text-white/40">·</span>
                            <span className="text-white/60">{slotDef.name}</span>
                            <span className="text-white/40">·</span>
                            <span className="text-white/60">Lv {item.level}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => equipGear(item)}
                        className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-white text-black hover:bg-[#00f0ff] transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        Equip
                      </button>
                    </div>

                    {/* Primary Stat */}
                    <div className="mt-1 bg-black/40 rounded-lg px-2.5 py-1 border border-white/5 text-xs font-mono">
                      <span className="text-white/50 text-[11px]">Primary: </span>
                      <strong style={{ color: rConf.color }}>
                        {formatStatValue(item.primaryStat.stat, item.primaryStat.value)}
                      </strong>
                    </div>

                    {/* Affixes */}
                    {item.affixes.length > 0 && (
                      <div className="mt-1.5 space-y-0.5 text-[11px] font-mono text-white/70">
                        {item.affixes.map((affix, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-white/30">▸</span>
                            <span>{formatStatValue(affix.stat, affix.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Legendary power */}
                    {item.legendaryPower && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-[#ffb800] bg-[#ffb800]/10 border border-[#ffb800]/30 rounded px-2 py-0.5">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>{LEGENDARY_POWERS[item.legendaryPower].name}</span>
                      </div>
                    )}
                  </div>

                  {/* Upgrade & Scrap Row */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      {item.level < 20 ? (
                        <>
                          <CostTag cost={upgradeCost} resources={resources} />
                          <BuyButton
                            enabled={canUpgrade}
                            onClick={() => upgradeGear(item)}
                            color={rConf.color}
                          >
                            <span className="flex items-center gap-1">
                              <ArrowUpCircle className="w-3 h-3" /> Lv {item.level + 1}
                            </span>
                          </BuyButton>
                        </>
                      ) : (
                        <span className="text-[10px] text-[#ffb800] uppercase font-bold">Max Level</span>
                      )}
                    </div>

                    <button
                      onClick={() => scrapGear(item)}
                      title="Scrap for minerals"
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-white/40 hover:text-red-400 hover:bg-white/5 rounded transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Scrap</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
