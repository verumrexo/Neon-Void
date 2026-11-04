/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProvider, useGame } from './state/gameContext';
import { GameCanvas } from './components/GameCanvas';
import { TopBar } from './components/TopBar';
import { UpgradePanel } from './components/UpgradePanel';
import { CraftingPanel } from './components/CraftingPanel';
import { QuantumTree } from './components/QuantumTree';
import { StatsPanel } from './components/StatsPanel';
import { X, Sparkles, ChevronDown, ChevronUp, Zap, Wrench, BarChart2 } from 'lucide-react';
import { RESOURCE_DEFINITIONS, ResourceType } from './types/game';

type ActiveTab = 'upgrades' | 'crafting' | 'quantum' | 'stats' | null;

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState<boolean>(false);
  const { offlineEarnings, clearOfflineNotification, availableStardustOnPrestige } = useGame();

  const handleTabSelect = (tab: 'upgrades' | 'crafting' | 'quantum' | 'stats') => {
    if (activeTab === tab && !isDrawerCollapsed) {
      // Toggle collapse if clicking the same active tab
      setActiveTab(null);
    } else {
      setActiveTab(tab);
      setIsDrawerCollapsed(false);
    }
  };

  return (
    <div className="relative w-screen h-screen flex flex-col bg-[#050508] text-white overflow-hidden select-none">
      {/* Scanline CRT overlay */}
      <div className="absolute inset-0 scanlines z-30 pointer-events-none opacity-30" />

      {/* Top Header */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={handleTabSelect}
      />

      {/* Main Viewport Container */}
      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Fullscreen Interactive Game Canvas */}
        <div className="relative flex-1 w-full h-full pb-14 md:pb-0">
          <GameCanvas />
        </div>

        {/* Offline Earnings Toast */}
        {offlineEarnings && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-sm w-[92%] px-2">
            <div className="p-3.5 rounded-xl border border-[#00f0ff]/40 bg-[#090b10]/95 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.25)] flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00f0ff]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sector Autonomous Harvest</span>
                </div>
                <p className="text-xs text-white/70">
                  Automated systems mined for{' '}
                  <strong className="text-white">
                    {Math.floor(offlineEarnings.seconds / 60)}m {offlineEarnings.seconds % 60}s
                  </strong>{' '}
                  while offline:
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                  {Object.entries(offlineEarnings.minerals).map(([res, amt]) => {
                    const def = RESOURCE_DEFINITIONS[res as ResourceType];
                    return (
                      <span key={res} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                        <span style={{ color: def.color }}>{def.symbol}</span>
                        <span className="text-white font-semibold">+{amt}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={clearOfflineNotification}
                className="p-1 rounded text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Docked Drawer Container (Responsive Bottom Sheet on Mobile) */}
        {activeTab && (
          <div
            className={`absolute z-30 inset-x-0 flex flex-col border-t border-white/10 bg-[#070a12]/95 backdrop-blur-2xl transition-all duration-300 ease-in-out shadow-2xl ${
              // Mobile: sits above bottom navigation dock (bottom-14)
              // Desktop: sits at bottom-0
              'bottom-14 md:bottom-0'
            } ${
              isDrawerCollapsed
                ? 'h-10 translate-y-0'
                : 'h-[52vh] max-h-[580px] min-h-[280px] rounded-t-2xl md:rounded-t-none'
            }`}
          >
            {/* Drawer Control Header with Mobile Drag Indicator */}
            <div className="relative flex flex-col border-b border-white/10 shrink-0 bg-[#0a0d18]/90">
              {/* Mobile Handle Pill */}
              <div
                onClick={() => setIsDrawerCollapsed(!isDrawerCollapsed)}
                className="w-full flex justify-center py-1.5 md:hidden cursor-pointer"
              >
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
                  <span className="text-xs font-bold tracking-wider uppercase text-white/90 font-mono">
                    {activeTab === 'upgrades' && 'Ship Systems Upgrades'}
                    {activeTab === 'crafting' && 'Gear & Hull Modification Assembly'}
                    {activeTab === 'quantum' && 'Quantum Singularity Matrix'}
                    {activeTab === 'stats' && 'Mission Telemetry & Audio'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDrawerCollapsed(!isDrawerCollapsed)}
                    title={isDrawerCollapsed ? 'Expand Panel' : 'Collapse Panel'}
                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {isDrawerCollapsed ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab(null)}
                    title="Close Terminal"
                    className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Drawer Content */}
            {!isDrawerCollapsed && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4">
                {activeTab === 'upgrades' && <UpgradePanel />}
                {activeTab === 'crafting' && <CraftingPanel />}
                {activeTab === 'quantum' && <QuantumTree />}
                {activeTab === 'stats' && <StatsPanel />}
              </div>
            )}
          </div>
        )}

        {/* Mobile Ergonomic Bottom Tab Navigation Dock (Native App Feel on Phones) */}
        <nav className="flex md:hidden absolute bottom-0 inset-x-0 h-14 z-40 bg-[#06080e]/95 border-t border-white/10 backdrop-blur-xl grid grid-cols-4 items-center px-1">
          <button
            onClick={() => handleTabSelect('upgrades')}
            className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${
              activeTab === 'upgrades' ? 'text-[#00f0ff]' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-[10px] font-semibold tracking-tight">Upgrades</span>
          </button>

          <button
            onClick={() => handleTabSelect('crafting')}
            className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${
              activeTab === 'crafting' ? 'text-[#00ff88]' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span className="text-[10px] font-semibold tracking-tight">Crafting</span>
          </button>

          <button
            onClick={() => handleTabSelect('quantum')}
            className={`relative flex flex-col items-center justify-center h-full gap-1 transition-colors ${
              activeTab === 'quantum' ? 'text-[#c084fc]' : 'text-[#c084fc]/70 hover:text-[#c084fc]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-semibold tracking-tight">Singularity</span>
            {availableStardustOnPrestige > 0 && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-[#c084fc] shadow-[0_0_6px_#c084fc] animate-ping" />
            )}
          </button>

          <button
            onClick={() => handleTabSelect('stats')}
            className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${
              activeTab === 'stats' ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="text-[10px] font-semibold tracking-tight">Stats</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <MainContent />
    </GameProvider>
  );
}
