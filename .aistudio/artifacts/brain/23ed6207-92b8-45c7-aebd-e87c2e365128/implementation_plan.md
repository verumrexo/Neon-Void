# Neon Void Miner — Minimalist Idle Asteroid Extractor

An atmospheric, pure incremental idle mining experience where an agile vector space craft mines an infinite asteroid block-by-block. Featuring soothing organic bumblebee flight physics, automatic surface-sweeping laser extraction, satisfying neon bloom particle bursts, deep upgrade and crafting systems, and a Quantum Singularity prestige tree.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The revised plan incorporates all your specific feedback:
> - **Zero AI**: Completely removed all AI, chatbots, and image generation. The entire app is a pure, self-contained, responsive incremental idle game.
> - **Idle-First Surface Mining**: By default, the ship gently hovers and sweeps along the outer exposed perimeter of the asteroid, chipping away block by block cleanly. Deep caves are entirely optional and only created if you manually guide the ship inward or through incidental random wander.
> - **Flight Dynamics**: Calm, organic "space bumblebee" micro-wandering physics. Clicking, tapping, or dragging gives directional vectors to guide the ship or explore deep cave tunnels.
> - **Minimalist Monochrome + Neon Bloom**: High-contrast void black backdrop (`#050508`), crisp white ship geometry and structural lines, with neon bloom strictly reserved for important elements (active lasers, ore veins, particle fireworks, and stardust).
> - **Prestige Loop**: Quantum Singularity collapse converting excavated matter into permanent Stardust for a branching Quantum Perk Tree.

---

### 1. Overview & Core Concept

- **What It Does**: The player watches or directs a sleek vector mining craft stationed against an infinite asteroid field. Operating on an incremental idle basis, the ship gently sweeps the exposed asteroid face, automatically targeting the nearest surface blocks with its pulse mining laser. Every block destroyed disintegrates into luminous neon particle sparks and awards resources (Basalt, Iron, Cyan Quartz, Emeraldite, Void Ore, and Sunstone).
- **Manual Direction When Desired**: If the player chooses to explore, clicking, dragging, or using keyboard controls sends the ship delving deep into the asteroid, allowing the creation of infinite custom caverns and tunnels.
- **Key Value**: A soothing, hypnotic idle loop with immediate visual and auditory satisfaction, layered with extensive incremental depth (upgrades, crafting, drone helpers, and prestige resets).

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Calm Surface Mining (Zero-State)**: The game opens on a tranquil void. The player's triangle ship hovers near an asteroid boundary, automatically buzzing along the surface and blasting blocks into glowing sparks with soft, calming synthesizer chimes.
2. **Idle Progression**: Resources accumulate automatically. The player can watch the ship methodically peel away layers of rock, or leave the game running in the background.
3. **Upgrades & Gear Crafting**: The player spends raw ores in the docked bottom/side terminal to upgrade Laser Damage, Beam Cadence, Collection Magnet, and Hull Speed. Rare ores (Quartz, Emeraldite, Void Ore) are used to craft ship modifications, such as Plasma Multi-Splitters, Gem Refiners, and Autonomous Mining Drones.
4. **Deep Cave Expeditions (Optional)**: Clicking or tapping deeper into the asteroid prompts the ship to burrow inward, discovering denser veins of rare minerals embedded deep within the bedrock.
5. **Quantum Singularity (Prestige)**: When progress slows, the player triggers a Quantum Singularity. This collapses the current sector, resetting local blocks and basic upgrades, but rewarding permanent **Stardust**. Stardust is spent in a non-linear Quantum Perk Tree (permanent laser multipliers, drone count, stardust resonance, and exotic ore drop rates).

#### Visual Identity & Theme
- **Aesthetic Direction**: Minimalist vector retro-arcade. Deep blacks, subtle cavern grid lines, crisp white wireframes, and soft bloom filters.
- **Color Palette**:
  - Void Canvas: `#050508` (deep cosmic black)
  - Base Blocks & Ship: `#161922` (basalt) and `#ffffff` (crisp white ship / basic laser)
  - Cyan Quartz: `#00f0ff` (vibrant electric cyan bloom)
  - Emeraldite: `#00ff88` (radiant emerald green bloom)
  - Void Ore: `#ff007f` (deep neon magenta bloom)
  - Sunstone: `#ffb800` (amber gold bloom)
  - Stardust: `#c084fc` (cosmic violet-lavender bloom)
- **Typography & Clean UI**:
  - Display: `Plus Jakarta Sans` for clean, unboxed title headers.
  - Body & Telemetry: `DM Sans` and `JetBrains Mono` with `tabular-nums` for precise rock counters, DPS meters, and coordinates.
  - Anti-slop compliance: no static pills or fake telemetry tags; clean typographic separators (`·`).
- **Interactive Feedback & Audio**:
  - Additive canvas particle blending for high-glow explosion sparks upon block destruction.
  - Web Audio API synthesizer generating gentle, non-fatiguing pentatonic bell chimes on ore collection and soft low-frequency hums on thruster fires (with instant mute toggle).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Surface-Bound Bumblebee Behavior by Default**
  - *Chosen Approach*: The ship's autonomous AI prioritizes exposed outer blocks within its operational radius, orbiting the perimeter smoothly. It only ventures into interior caverns if the player explicitly clicks a waypoint inside or if an opening already exists.
  - *Why*: Directly honors the user's feedback ("caves are totally optional, this is an idle game, by default the ship shouldnt make caves on its own").
- **Decision 2: 100% Client-Side Pure Simulation (No AI / External Services)**
  - *Chosen Approach*: High-performance Canvas 2D engine with procedural infinite chunk hashing and local state persistence via `localStorage`.
  - *Why*: Fast, zero latency, offline capable, zero external dependencies, perfectly aligned with "no ai".
- **Decision 3: Non-Linear Quantum Singularity Perk Tree**
  - *Chosen Approach*: Node-based perk tree where Stardust unlocks branching specializations (Laser Specialization, Drone Automation, Mining Fortune, Hull Telemetry).
  - *Why*: Adds sustained long-term goals and replayability without feeling like a flat numeric multiplier.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Neon Void Miner Engine                          │
├──────────────────────────────────┬─────────────────────────────────────┤
│            Client UI             │          Canvas Game Loop           │
│  ┌────────────────────────────┐  │  ┌───────────────────────────────┐  │
│  │ Top Resource Bar           │  │  │ Infinite Procedural Chunk Map │  │
│  │ (Basalt, Iron, Gems, Star) │  │  │ (Noise-based mineral veins)   │  │
│  ├────────────────────────────┤  │  ├───────────────────────────────┤  │
│  │ Fullscreen Canvas Surface  │  │  │ Bumblebee Ship & Drone Agents │  │
│  │ • Additive Bloom Particles │◄─┼──┤ • Surface-sweeping idle AI    │  │
│  │ • Laser Beam Vectors       │  │  │ • Click/Touch waypoint vector │  │
│  │ • Interactive Waypoint Ring│  │  ├───────────────────────────────┤  │
│  ├────────────────────────────┤  │  │ Auto-Laser Targeting System   │  │
│  │ Docked Management Panel:   │  │  │ (DPS calculation, durability) │  │
│  │ • Upgrades (Laser, Magnet) │  │  ├───────────────────────────────┤  │
│  │ • Crafting (Gear, Drones)  │  │  │ Particle Physics & Float Text │  │
│  │ • Quantum Singularity Tree │  │  ├───────────────────────────────┤  │
│  │ • Settings & Sound Frequencies│  │ Web Audio Pentatonic Synth   │  │
│  └────────────────────────────┘  │  └───────────────────────────────┘  │
└──────────────────────────────────┴─────────────────────────────────────┘
```

#### Core Data State
- **`Ship`**: `{ x, y, vx, vy, angle, targetX, targetY, isManualGuide, stats: { damage, fireRate, range, magnetRadius, speed } }`
- **`AsteroidWorld`**: Sparse spatial map storing mined and intact grid cells across infinite $(X, Y)$ space.
- **`Resources`**: `{ basalt, iron, quartz, emeraldite, voidOre, sunstone, stardust }`
- **`Drones`**: Array of autonomous mini-harvester triangles unlocked via crafting.
- **`QuantumPerks`**: State map of unlocked permanent nodes funded by Stardust.
- **`AudioEngine`**: Synthesizer using Web Audio API nodes (`OscillatorNode`, `GainNode`) for soothing pentatonic notes and satisfying retro bursts.

---
