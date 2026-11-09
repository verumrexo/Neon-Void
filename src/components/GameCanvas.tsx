import React, { useRef, useEffect } from 'react';
import { useGame } from '../state/gameContext';
import { BLOCK_SIZE, CHUNK_SIZE, getRingNumber, getDepthBand, getDepthColor } from '../engine/world';
import { gameFrames } from '../engine/frameClock';
import { particleSystem } from '../engine/particles';
import { combat } from '../engine/weapons';
import { WING_ROLES } from '../game/content';

export const GameCanvas: React.FC = () => {
  const fpsRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    world,
    ship,
    drones,
    hull,
    loadout,
    ringProgress,
  } = useGame();

  const hasCore = hull.placed.some(module => module.id === 'core');
  const sceneRef = useRef({ ship, drones, hasCore, laserOn: loadout.laserDps > 0, roles: loadout.config.roles });
  sceneRef.current = { ship, drones, hasCore, laserOn: loadout.laserDps > 0, roles: loadout.config.roles };
  const viewRef = useRef({ camX: 0, camY: 0, zoom: 1, halfW: 0, halfH: 0 });

  // Pointer aiming: press to start loading a salvo, release to fire at the cursor.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const toWorld = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      return { x: (event.clientX - rect.left - view.halfW) / view.zoom + view.camX, y: (event.clientY - rect.top - view.halfH) / view.zoom + view.camY };
    };
    const down = (event: PointerEvent) => { const point = toWorld(event); combat.beginCharge(point.x, point.y); canvas.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (combat.isCharging) { const point = toWorld(event); combat.moveCharge(point.x, point.y); } };
    const up = () => combat.releaseCharge(sceneRef.current.ship);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, []);

  // Camera coordinates and zoom (world space)
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1.0);
  const dimensionsRef = useRef({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  // Reliable ResizeObserver on container element
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) {
          dimensionsRef.current = { width: rect.width, height: rect.height };
        }
      }
    };

    updateSize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        updateSize();
      });
      ro.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Bake mineral glows once, rather than running thousands of shadow filters per frame.
    const tiles = new Map<string, HTMLCanvasElement>();
    const chunks = new Map<string, { canvas: HTMLCanvasElement; version: number; epoch: number }>();

    let sampleStart = performance.now();
    let sampleFrames = 0;
    let renderScale = Math.min(1.25, window.devicePixelRatio || 1);
    let slowSamples = 0;
    const render = (frameTime: number, alpha: number, elapsed: number) => {
      const { ship: mainShip, drones: companions, hasCore, laserOn, roles } = sceneRef.current;
      const fleet = [mainShip, ...companions].map(state => ({ ...state,
        x: state.previousX + (state.x - state.previousX) * alpha,
        y: state.previousY + (state.y - state.previousY) * alpha,
        angle: state.previousAngle + (state.angle - state.previousAngle) * alpha,
      }));
      const ship = fleet[0];
      const drones = fleet.slice(1);
      if (elapsed === 0) { sampleStart = frameTime; sampleFrames = 0; }
      sampleFrames++;
      if (frameTime - sampleStart >= 1000) {
        const fps = Math.round(sampleFrames * 1000 / (frameTime - sampleStart));
        if (fpsRef.current) fpsRef.current.textContent = `${fps} fps`;
        if (!document.hidden && fps < 50) slowSamples++; else slowSamples = 0;
        if (slowSamples >= 2 && renderScale > 0.75) {
          renderScale = Math.max(0.75, renderScale - 0.25);
          slowSamples = 0;
        }
        sampleStart = frameTime;
        sampleFrames = 0;
      }
      // ResizeObserver owns layout reads; the hot path only reads cached dimensions.
      const { width, height } = dimensionsRef.current;
      // Keep fullscreen retina rendering inside a practical pixel budget.
      const dpr = Math.min(renderScale, Math.sqrt(1_600_000 / (width * height)));

      // Adjust buffer size
      const targetBufferW = Math.floor(width * dpr);
      const targetBufferH = Math.floor(height * dpr);
      if (canvas.width !== targetBufferW || canvas.height !== targetBufferH) {
        canvas.width = targetBufferW;
        canvas.height = targetBufferH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Sanitize ship position
      const validShipX = typeof ship.x === 'number' && isFinite(ship.x) ? ship.x : 0;
      const validShipY = typeof ship.y === 'number' && isFinite(ship.y) ? ship.y : 0;

      // Sanitize camera coordinates
      if (isNaN(cameraRef.current.x) || !isFinite(cameraRef.current.x)) cameraRef.current.x = validShipX;
      if (isNaN(cameraRef.current.y) || !isFinite(cameraRef.current.y)) cameraRef.current.y = validShipY;

      // Multi-subject dynamic framing (ship + companion drone fleet)
      let minX = validShipX;
      let maxX = validShipX;
      let minY = validShipY;
      let maxY = validShipY;
      let activeDroneCount = 0;

      drones.forEach((d) => {
        if (typeof d.x === 'number' && isFinite(d.x) && typeof d.y === 'number' && isFinite(d.y)) {
          minX = Math.min(minX, d.x);
          maxX = Math.max(maxX, d.x);
          minY = Math.min(minY, d.y);
          maxY = Math.max(maxY, d.y);
          activeDroneCount++;
        }
      });

      // Frame all ships equally around their shared bounds.
      const targetCamX = (minX + maxX) / 2;
      const targetCamY = (minY + maxY) / 2;
      cameraRef.current.x += (targetCamX - cameraRef.current.x) * (1 - Math.exp(-7.6 * elapsed));
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * (1 - Math.exp(-7.6 * elapsed));
      const fleetZoom = activeDroneCount > 0 ? 1 / Math.sqrt(1 + activeDroneCount * 0.35) : 1;
      // Account for camera smoothing so an outlying ship stays inside the view.
      const extentX = Math.max(maxX - cameraRef.current.x, cameraRef.current.x - minX) + 65;
      const extentY = Math.max(maxY - cameraRef.current.y, cameraRef.current.y - minY) + 65;
      const desiredZoom = Math.min(fleetZoom, width / (extentX * 2), height / (extentY * 2));
      zoomRef.current = Math.min(desiredZoom, zoomRef.current + (desiredZoom - zoomRef.current) * (1 - Math.exp(-3 * elapsed)));
      const zoom = zoomRef.current;
      const halfW = width / 2;
      const halfH = height / 2;
      viewRef.current = { camX: cameraRef.current.x, camY: cameraRef.current.y, zoom, halfW, halfH };
      // Screen shake from explosions is applied to the render camera only.
      const shake = combat.shake;
      const camX = cameraRef.current.x + (shake ? (Math.random() - 0.5) * shake : 0);
      const camY = cameraRef.current.y + (shake ? (Math.random() - 0.5) * shake : 0);

      // Clear with deep cosmic void background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Center camera and apply dynamic fleet zoom
      ctx.translate(halfW, halfH);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);
      const time = frameTime / 1000;
      // Collapse vortex: the core pulls light inward while the bomb burns.
      if (combat.collapse > 0) {
        const progress = 1 - combat.collapse / 30;
        const cx = BLOCK_SIZE / 2, cy = BLOCK_SIZE / 2;
        const radius = 60 + progress * 120;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3);
        gradient.addColorStop(0, 'rgba(192,132,252,0.55)');
        gradient.addColorStop(0.25, 'rgba(124,92,255,0.18)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(cx, cy, radius * 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(192,132,252,0.5)';
        ctx.lineWidth = 1.5;
        for (let arm = 0; arm < 5; arm++) {
          ctx.beginPath();
          for (let t = 0; t < 1; t += 0.04) {
            const angle = arm * Math.PI * 2 / 5 + t * 5 - time * (1.5 + progress * 3);
            const r = radius * 3 * (1 - t);
            const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
            if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // Calculate visible block bounds taking zoom into account
      const viewRadiusW = halfW / zoom + BLOCK_SIZE * 2;
      const viewRadiusH = halfH / zoom + BLOCK_SIZE * 2;
      const minGx = Math.floor((camX - viewRadiusW) / BLOCK_SIZE);
      const maxGx = Math.ceil((camX + viewRadiusW) / BLOCK_SIZE);
      const minGy = Math.floor((camY - viewRadiusH) / BLOCK_SIZE);
      const maxGy = Math.ceil((camY + viewRadiusH) / BLOCK_SIZE);

      // One grid draw; skip subpixel details when the fleet view zooms out.
      const gridStep = Math.max(1, Math.ceil(0.65 / zoom));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gy = Math.floor(minGy / gridStep) * gridStep; gy <= maxGy; gy += gridStep) {
        for (let gx = Math.floor(minGx / gridStep) * gridStep; gx <= maxGx; gx += gridStep) {
          if (!world.isMined(gx, gy)) continue;
          const x = gx * BLOCK_SIZE, y = gy * BLOCK_SIZE;
          ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y);
          ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2);
        }
      }
      ctx.stroke();

      // Wide fleet views use an overview texture instead of allocating hundreds of canvases.
      const chunkBudget = width < 768 ? 32 : 64;
      let detail = 1;
      while ((Math.ceil((maxGx - minGx + 1) / (CHUNK_SIZE * detail)) + 2) *
          (Math.ceil((maxGy - minGy + 1) / (CHUNK_SIZE * detail)) + 2) > chunkBudget) detail *= 2;
      const chunkCells = CHUNK_SIZE * detail;
      for (let cy = Math.floor(minGy / chunkCells); cy <= Math.floor(maxGy / chunkCells); cy++) {
        for (let cx = Math.floor(minGx / chunkCells); cx <= Math.floor(maxGx / chunkCells); cx++) {
          const key = `${detail}:${cx},${cy}`;
          const version = world.getChunkVersion(cx, cy, detail);
          let chunk = chunks.get(key);
          if (!chunk || chunk.version !== version || chunk.epoch !== world.terrainEpoch) {
            const image = chunk?.canvas || document.createElement('canvas');
            image.width = image.height = CHUNK_SIZE * BLOCK_SIZE + 24;
            const context = image.getContext('2d')!;
            context.scale(1 / detail, 1 / detail);
            context.translate(12 * detail - cx * chunkCells * BLOCK_SIZE, 12 * detail - cy * chunkCells * BLOCK_SIZE);
            {
              const ctx = context;
      // 2. Draw Asteroid Blocks with high-contrast visible wireframes & vibrant gems
      for (let gy = cy * chunkCells; gy < (cy + 1) * chunkCells; gy += detail) {
        for (let gx = cx * chunkCells; gx < (cx + 1) * chunkCells; gx += detail) {
          const sourceX = gx + Math.floor(detail / 2), sourceY = gy + Math.floor(detail / 2);
          if (world.isMined(sourceX, sourceY)) continue;

          const block = world.getBlock(sourceX, sourceY);
          if (!block) continue;

          const bx = gx * BLOCK_SIZE;
          const by = gy * BLOCK_SIZE;
          const isSurface = world.isSurfaceBlock(sourceX, sourceY);

          const ring = getRingNumber(sourceX, sourceY);
          const band = getDepthBand(ring);
          const tileKey = `${block.type}:${isSurface}:${band % 6}:${Math.min(4, 1 + Math.floor(band / 6))}:${block.volatile ? 'v' : block.armored ? 'a' : ''}`;
          let tile = tiles.get(tileKey);
          if (!tile) {
            tile = document.createElement('canvas');
            tile.width = tile.height = BLOCK_SIZE + 24;
            const tileContext = tile.getContext('2d')!;
            tileContext.translate(12, 12);
            const ctx = tileContext;
          // Distinct base fill colors per block type
          if (block.type === 'quartz') {
            ctx.fillStyle = '#081d2a';
          } else if (block.type === 'emeraldite') {
            ctx.fillStyle = '#082418';
          } else if (block.type === 'voidOre') {
            ctx.fillStyle = '#26081e';
          } else if (block.type === 'sunstone') {
            ctx.fillStyle = '#261e08';
          } else if (block.type === 'iron') {
            ctx.fillStyle = '#141a26';
          } else {
            // Basalt
            ctx.fillStyle = isSurface ? '#151926' : '#0e121c';
          }
          ctx.fillRect(0, 0, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

          // Clear, distinct wireframe border
          if (block.type === 'quartz') {
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 1.2;
          } else if (block.type === 'emeraldite') {
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 1.2;
          } else if (block.type === 'voidOre') {
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 1.2;
          } else if (block.type === 'sunstone') {
            ctx.strokeStyle = '#ffb800';
            ctx.lineWidth = 1.2;
          } else if (block.type === 'iron') {
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
          } else {
            // Basalt wireframe
            ctx.strokeStyle = isSurface ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 1;
          }
          ctx.strokeRect(0.5, 0.5, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

          // Render glowing neon crystal symbols inside the block
          const cx = BLOCK_SIZE / 2;
          const cy = BLOCK_SIZE / 2;

          if (block.type !== 'basalt') {
            ctx.save();
            ctx.fillStyle = block.color;
            ctx.shadowColor = block.glow;
            ctx.shadowBlur = isSurface ? 10 : 5;

            if (block.type === 'iron') {
              // Silvery metallic frame with bright center
              ctx.strokeStyle = '#94a3b8';
              ctx.lineWidth = 1.4;
              ctx.strokeRect(cx - 3.5, cy - 3.5, 7, 7);
              ctx.fillStyle = '#e2e8f0';
              ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
            } else if (block.type === 'quartz') {
              // Vibrant electric cyan diamond with facet
              ctx.beginPath();
              ctx.moveTo(cx, cy - 5.5);
              ctx.lineTo(cx + 5, cy);
              ctx.lineTo(cx, cy + 5.5);
              ctx.lineTo(cx - 5, cy);
              ctx.closePath();
              ctx.fill();

              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 0.8;
              ctx.stroke();
            } else if (block.type === 'emeraldite') {
              // Radiant emerald gem
              ctx.beginPath();
              ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 0.8;
              ctx.stroke();
            } else if (block.type === 'voidOre') {
              // Vivid magenta 4-point star
              ctx.fillRect(cx - 1.2, cy - 6, 2.4, 12);
              ctx.fillRect(cx - 6, cy - 1.2, 12, 2.4);
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(cx - 1, cy - 1, 2, 2);
            } else if (block.type === 'sunstone') {
              // Golden amber starburst
              ctx.beginPath();
              ctx.arc(cx, cy, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            ctx.restore();
          } else if (isSurface) {
            // Subtle diamond tick mark in surface basalt
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(cx - 1, cy - 1, 2, 2);
          }

            // The rock strata change independently of the ore's identifying color.
            ctx.strokeStyle = getDepthColor(ring);
            ctx.lineWidth = 1;
            ctx.strokeRect(2.5, 2.5, BLOCK_SIZE - 6, BLOCK_SIZE - 6);
            if (band > 0) {
              ctx.fillStyle = getDepthColor(ring);
              const marks = Math.min(4, 1 + Math.floor(band / 6));
              for (let mark = 0; mark < marks; mark++) ctx.fillRect(4 + mark * 3, 4, 1, 3);
            }
            if (block.volatile) {
              // Volatile crystal: red hazard core that explodes when broken.
              ctx.fillStyle = '#ff3b1f';
              ctx.shadowColor = 'rgba(255,59,31,0.9)'; ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.moveTo(BLOCK_SIZE / 2, 4); ctx.lineTo(BLOCK_SIZE - 5, BLOCK_SIZE - 6); ctx.lineTo(5, BLOCK_SIZE - 6); ctx.closePath();
              ctx.fill();
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(BLOCK_SIZE / 2 - 1, 9, 2, 6); ctx.fillRect(BLOCK_SIZE / 2 - 1, 17, 2, 2);
            } else if (block.armored) {
              // Armored core: heavy plating with rivets.
              ctx.strokeStyle = '#ffb800'; ctx.lineWidth = 3;
              ctx.strokeRect(2, 2, BLOCK_SIZE - 5, BLOCK_SIZE - 5);
              ctx.fillStyle = '#ffb800';
              for (const [rx, ry] of [[5, 5], [BLOCK_SIZE - 7, 5], [5, BLOCK_SIZE - 7], [BLOCK_SIZE - 7, BLOCK_SIZE - 7]]) ctx.fillRect(rx - 1, ry - 1, 3, 3);
              ctx.beginPath(); ctx.arc(BLOCK_SIZE / 2, BLOCK_SIZE / 2, 4, 0, Math.PI * 2); ctx.fill();
            }
            tiles.set(tileKey, tile);
          }
          ctx.drawImage(tile, bx - 12 * detail, by - 12 * detail, tile.width * detail, tile.height * detail);

        }
      }
            }
            chunk = { canvas: image, version, epoch: world.terrainEpoch };
            chunks.set(key, chunk);
          }
          ctx.drawImage(chunk.canvas, cx * chunkCells * BLOCK_SIZE - 12 * detail,
            cy * chunkCells * BLOCK_SIZE - 12 * detail, chunk.canvas.width * detail, chunk.canvas.height * detail);
          // Touch the entry so the LRU limit also holds when every visible chunk is new.
          chunks.delete(key); chunks.set(key, chunk);
        }
      }
      while (chunks.size > chunkBudget * 1.5) chunks.delete(chunks.keys().next().value!);
      for (const [key] of world.damagedBlocks) {
        const [gx, gy] = key.split(',').map(Number);
        if (gx < minGx || gx > maxGx || gy < minGy || gy > maxGy) continue;
        const block = world.getBlock(gx, gy);
        if (!block) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(gx * BLOCK_SIZE + 2, (gy + 1) * BLOCK_SIZE - 4,
          (BLOCK_SIZE - 5) * Math.max(0, block.hp / block.maxHp), 2);
      }

      // 3. Draw Laser Beams to all distinct targets (Multi-Beam Splitter Array)
      const targetsToDraw = ship.miningTargets && ship.miningTargets.length > 0
        ? ship.miningTargets
        : ship.miningTarget ? [ship.miningTarget] : [];

      if (laserOn) targetsToDraw.forEach((target) => {
        const tx = target.gx * BLOCK_SIZE + BLOCK_SIZE / 2;
        const ty = target.gy * BLOCK_SIZE + BLOCK_SIZE / 2;

        ctx.save();
        // Outer neon glow beam
        ctx.strokeStyle = target.color;
        ctx.shadowColor = target.glow;
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(validShipX, validShipY);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Inner white high-intensity laser core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(validShipX, validShipY);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Target impact reticle
        ctx.strokeStyle = target.color;
        ctx.strokeRect(
          target.gx * BLOCK_SIZE - 1,
          target.gy * BLOCK_SIZE - 1,
          BLOCK_SIZE + 1,
          BLOCK_SIZE + 1
        );
        ctx.restore();
      });

      // 4. Combat effects
      for (const fire of combat.fires) {
        ctx.fillStyle = `rgba(255,${100 + Math.floor(Math.random() * 80)},20,${0.25 + Math.random() * 0.25})`;
        ctx.fillRect(fire.gx * BLOCK_SIZE + 2, fire.gy * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
      }
      for (const well of combat.wells) {
        const t = well.life / well.max;
        ctx.fillStyle = 'rgba(10,0,30,0.85)';
        ctx.beginPath(); ctx.arc(well.x, well.y, 5 + (1 - t) * 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(167,139,250,${0.4 + 0.4 * Math.sin(time * 20)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(well.x, well.y, well.r * (0.3 + t * 0.7), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const blast of combat.blasts) {
        const t = 1 - blast.life / blast.max;
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = blast.color;
        ctx.beginPath(); ctx.arc(blast.x, blast.y, blast.r * (0.4 + t * 0.6), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(blast.x, blast.y, blast.r * (0.6 + t * 0.8), 0, Math.PI * 2); ctx.stroke();
      }
      for (const line of combat.lines) {
        ctx.globalAlpha = line.life / line.max;
        for (const [width, color] of [[line.width * 2.5, line.color], [line.width * 0.6, '#ffffff']] as const) {
          ctx.strokeStyle = color; ctx.lineWidth = width;
          ctx.beginPath();
          line.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
          ctx.stroke();
        }
      }
      ctx.restore();
      for (const rocket of combat.rockets) {
        const angle = Math.atan2(rocket.vy, rocket.vx);
        ctx.save();
        ctx.translate(rocket.x, rocket.y); ctx.rotate(angle);
        const size = rocket.small ? 0.6 : 1;
        ctx.fillStyle = '#ffb070';
        ctx.fillRect(-7 * size - Math.random() * 4, -1.5 * size, 4 * size, 3 * size);
        ctx.fillStyle = rocket.manual ? '#ffffff' : '#ff6a2a';
        ctx.beginPath(); ctx.moveTo(5 * size, 0); ctx.lineTo(-4 * size, -2.5 * size); ctx.lineTo(-4 * size, 2.5 * size); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      if (combat.rival) {
        const rival = combat.rival;
        ctx.save();
        ctx.translate(rival.x, rival.y); ctx.rotate(rival.angle);
        ctx.strokeStyle = '#ff3366'; ctx.fillStyle = '#1a0008'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,51,102,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(rival.x, rival.y); ctx.lineTo(rival.tx, rival.ty); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(rival.x - 14, rival.y - 18, 28, 3);
        ctx.fillStyle = '#ff3366'; ctx.fillRect(rival.x - 14, rival.y - 18, 28 * Math.max(0, rival.hp / rival.maxHp), 3);
      }
      if (combat.isCharging && combat.chargeTarget) {
        const target = combat.chargeTarget;
        const charge = combat.manualCharge / 1.5;
        ctx.strokeStyle = combat.manualCooldown > 0 ? 'rgba(255,255,255,0.3)' : '#ff6a2a';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(target.x, target.y, 12 + charge * 16, 0, Math.PI * 2 * Math.max(0.05, charge)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(target.x - 6, target.y); ctx.lineTo(target.x + 6, target.y); ctx.moveTo(target.x, target.y - 6); ctx.lineTo(target.x, target.y + 6); ctx.stroke();
      }

      // 5. Draw Particles and Floating Numbers
      particleSystem.render(ctx);

      // Spawn soft thruster embers behind the ship while moving
      if (Math.hypot(ship.vx, ship.vy) > 12 && Math.random() < Math.min(1, elapsed * 36)) {
        const nozzleX = validShipX - Math.cos(ship.angle) * 9;
        const nozzleY = validShipY - Math.sin(ship.angle) * 9;
        particleSystem.spawnThrusterMote(nozzleX, nozzleY, ship.angle);
      }

      for (const fleetShip of [ship, ...drones]) {
        if (fleetShip !== ship && laserOn && fleetShip.laserScale !== 0) {
          for (const target of fleetShip.miningTargets) {
            if (world.isMined(target.gx, target.gy)) continue;
            ctx.strokeStyle = target.color;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(fleetShip.x, fleetShip.y);
            ctx.lineTo((target.gx + 0.5) * BLOCK_SIZE, (target.gy + 0.5) * BLOCK_SIZE);
            ctx.stroke();
          }
        }
      // 7. Draw The Player Ship (Sleek Vector Triangle)
      ctx.save();
      ctx.translate(fleetShip.x, fleetShip.y);
      ctx.rotate(fleetShip.angle);

      // Soft thruster trail glow (calm, subtle)
      const thrusterLength = 5 + Math.random() * 5;
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(-9 - thrusterLength, 0);
      ctx.stroke();

      const role = fleetShip === ship ? null : roles[drones.indexOf(fleetShip)];
      if (role) {
        ctx.strokeStyle = WING_ROLES[role].color;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (fleetShip === ship && hasCore) {
        // Advanced Vanguard Multi-Vectored Hull
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#050508';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-7, -10);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-4, 4);
        ctx.lineTo(-7, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 0;
        ctx.fillRect(0, -1.5, 5, 3);
      } else {
        // Classic Minimalist Space Triangle Wireframe
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#050508';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.moveTo(13, 0); // Nose
        ctx.lineTo(-9, -7); // Left wing
        ctx.lineTo(-5, 0); // Engine notch
        ctx.lineTo(-9, 7); // Right wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, -1, 2, 2);
      }

      ctx.restore();

      }

      ctx.restore(); // Restore world camera transform
      ctx.restore(); // Restore DPR transform

    };

    return gameFrames.subscribeRender(render);
  }, [world]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[300px] overflow-hidden">
      <div ref={fpsRef} className="absolute top-5 right-6 z-10 pointer-events-none text-[10px] font-mono text-white/50 tabular-nums" aria-label="Frames per second">measuring fps</div>
      <div className="absolute left-4 bottom-4 z-10 pointer-events-none rounded-lg border border-white/10 bg-[#090d15]/90 px-3 py-2 text-[11px] font-mono">
        <span className="text-[#00f0ff]">ring {ringProgress.ring}</span>
        <span className="text-white/50"> · continuous sweep</span>
        <div className="mt-1 text-[10px] text-white/40">stratum {getDepthBand(ringProgress.ring) + 1} · {Math.pow(1.2, getDepthBand(ringProgress.ring)).toFixed(2)}× rock hp · +20% / 5 rings</div>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none cursor-crosshair"
      />
    </div>
  );
};
