import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../state/gameContext';
import { BLOCK_SIZE, CHUNK_SIZE } from '../engine/world';
import { particleSystem } from '../engine/particles';

export const GameCanvas: React.FC = () => {
  const fpsRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    world,
    ship,
    drones,
    droppedMinerals,
    craftingItems,
    setManualTarget,
    clearManualTarget,
  } = useGame();

  // Camera coordinates and zoom (world space)
  const cameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1.0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const gestureRef = useRef<{ id: number; started: number; x: number; y: number } | null>(null);

  // Keyboard shortcut listener to cancel manual guidance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'c' || e.key === 'C') {
        clearManualTarget();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearManualTarget]);

  // Reliable ResizeObserver on container element
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) {
          setDimensions({ width: rect.width, height: rect.height });
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

  // Convert screen coordinates to world coordinates (with dynamic zoom)
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const w = dimensions.width || (canvasRef.current ? canvasRef.current.clientWidth : 800);
      const h = dimensions.height || (canvasRef.current ? canvasRef.current.clientHeight : 600);
      const cx = w / 2;
      const cy = h / 2;
      const currentZoom = zoomRef.current || 1;
      return {
        x: (screenX - cx) / currentZoom + cameraRef.current.x,
        y: (screenY - cy) / currentZoom + cameraRef.current.y,
      };
    },
    [dimensions]
  );

  // A short press commits a fixed world destination. A hold steers until release.
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gestureRef.current || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    gestureRef.current = { id: e.pointerId, started: performance.now(), x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    gesture.x = e.clientX - rect.left;
    gesture.y = e.clientY - rect.top;
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== e.pointerId) return;
    gestureRef.current = null;
    if (performance.now() - gesture.started < 220) {
      const point = screenToWorld(gesture.x, gesture.y);
      setManualTarget(point.x, point.y);
    } else clearManualTarget();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const cancelGesture = () => {
    if (gestureRef.current) {
      gestureRef.current = null;
      clearManualTarget();
    }
  };
  useEffect(() => {
    window.addEventListener('blur', cancelGesture);
    return () => window.removeEventListener('blur', cancelGesture);
  });

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    // Bake mineral glows once, rather than running thousands of shadow filters per frame.
    const tiles = new Map<string, HTMLCanvasElement>();
    const chunks = new Map<string, { canvas: HTMLCanvasElement; version: number; epoch: number }>();

    let sampleStart = performance.now();
    let sampleFrames = 0;
    let renderScale = Math.min(1.25, window.devicePixelRatio || 1);
    let slowSamples = 0;
    const render = () => {
      const frameTime = performance.now();
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
      // Read current canvas physical pixel dimensions directly from DOM
      const domW = canvas.clientWidth || (containerRef.current ? containerRef.current.clientWidth : 0);
      const domH = canvas.clientHeight || (containerRef.current ? containerRef.current.clientHeight : 0);

      const width = domW > 20 ? domW : dimensions.width > 20 ? dimensions.width : window.innerWidth;
      const height = domH > 20 ? domH : dimensions.height > 20 ? dimensions.height : window.innerHeight;
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
      let droneSumX = 0;
      let droneSumY = 0;
      let activeDroneCount = 0;

      drones.forEach((d) => {
        if (typeof d.x === 'number' && isFinite(d.x) && typeof d.y === 'number' && isFinite(d.y)) {
          minX = Math.min(minX, d.x);
          maxX = Math.max(maxX, d.x);
          minY = Math.min(minY, d.y);
          maxY = Math.max(maxY, d.y);
          droneSumX += d.x;
          droneSumY += d.y;
          activeDroneCount++;
        }
      });

      // Frame all ships equally around their shared bounds.
      const targetCamX = (minX + maxX) / 2;
      const targetCamY = (minY + maxY) / 2;
      cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.12;
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.12;
      const fleetZoom = activeDroneCount > 0 ? 1 / Math.sqrt(1 + activeDroneCount * 0.35) : 1;
      // Account for camera smoothing so an outlying ship stays inside the view.
      const extentX = Math.max(maxX - cameraRef.current.x, cameraRef.current.x - minX) + 65;
      const extentY = Math.max(maxY - cameraRef.current.y, cameraRef.current.y - minY) + 65;
      const desiredZoom = Math.min(fleetZoom, width / (extentX * 2), height / (extentY * 2));
      zoomRef.current = Math.min(desiredZoom, zoomRef.current + (desiredZoom - zoomRef.current) * 0.05);
      const zoom = zoomRef.current;
      const gesture = gestureRef.current;
      if (gesture && performance.now() - gesture.started >= 220) {
        const point = screenToWorld(gesture.x, gesture.y);
        setManualTarget(point.x, point.y, 'heading');
      }

      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;
      const halfW = width / 2;
      const halfH = height / 2;

      // Clear with deep cosmic void background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Center camera and apply dynamic fleet zoom
      ctx.translate(halfW, halfH);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // Calculate visible block bounds taking zoom into account
      const viewRadiusW = halfW / zoom + BLOCK_SIZE * 2;
      const viewRadiusH = halfH / zoom + BLOCK_SIZE * 2;
      const minGx = Math.floor((camX - viewRadiusW) / BLOCK_SIZE);
      const maxGx = Math.ceil((camX + viewRadiusW) / BLOCK_SIZE);
      const minGy = Math.floor((camY - viewRadiusH) / BLOCK_SIZE);
      const maxGy = Math.ceil((camY + viewRadiusH) / BLOCK_SIZE);

      // 1. Draw subtle grid crosses in carved-out cavern air space
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      for (let gy = minGy; gy <= maxGy; gy++) {
        for (let gx = minGx; gx <= maxGx; gx++) {
          if (world.isMined(gx, gy)) {
            const vx = gx * BLOCK_SIZE;
            const vy = gy * BLOCK_SIZE;
            // Draw small vertex cross
            ctx.beginPath();
            ctx.moveTo(vx - 2, vy);
            ctx.lineTo(vx + 2, vy);
            ctx.moveTo(vx, vy - 2);
            ctx.lineTo(vx, vy + 2);
            ctx.stroke();
          }
        }
      }

      // Rasterize static terrain in bounded chunks. Each frame composites a few images.
      for (let cy = Math.floor(minGy / CHUNK_SIZE); cy <= Math.floor(maxGy / CHUNK_SIZE); cy++) {
        for (let cx = Math.floor(minGx / CHUNK_SIZE); cx <= Math.floor(maxGx / CHUNK_SIZE); cx++) {
          const key = `${cx},${cy}`;
          const version = world.getChunkVersion(cx, cy);
          let chunk = chunks.get(key);
          if (!chunk || chunk.version !== version || chunk.epoch !== world.terrainEpoch) {
            const image = chunk?.canvas || document.createElement('canvas');
            image.width = image.height = CHUNK_SIZE * BLOCK_SIZE + 24;
            const context = image.getContext('2d')!;
            context.translate(12 - cx * CHUNK_SIZE * BLOCK_SIZE, 12 - cy * CHUNK_SIZE * BLOCK_SIZE);
            {
              const ctx = context;
      // 2. Draw Asteroid Blocks with high-contrast visible wireframes & vibrant gems
      for (let gy = cy * CHUNK_SIZE; gy < (cy + 1) * CHUNK_SIZE; gy++) {
        for (let gx = cx * CHUNK_SIZE; gx < (cx + 1) * CHUNK_SIZE; gx++) {
          if (world.isMined(gx, gy)) continue;

          const block = world.getBlock(gx, gy, 0);
          if (!block) continue;

          const bx = gx * BLOCK_SIZE;
          const by = gy * BLOCK_SIZE;
          const isSurface = world.isSurfaceBlock(gx, gy);

          const tileKey = `${block.type}:${isSurface}`;
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

            tiles.set(tileKey, tile);
          }
          ctx.drawImage(tile, bx - 12, by - 12);

        }
      }
            }
            chunk = { canvas: image, version, epoch: world.terrainEpoch };
            chunks.set(key, chunk);
          }
          ctx.drawImage(chunk.canvas, cx * CHUNK_SIZE * BLOCK_SIZE - 12, cy * CHUNK_SIZE * BLOCK_SIZE - 12);
        }
      }
      // Keep the cache bounded when exploring an infinite world.
      if (chunks.size > 96) {
        for (const key of chunks.keys()) {
          const [cx, cy] = key.split(',').map(Number);
          if (cx < Math.floor(minGx / CHUNK_SIZE) - 1 || cx > Math.floor(maxGx / CHUNK_SIZE) + 1 ||
              cy < Math.floor(minGy / CHUNK_SIZE) - 1 || cy > Math.floor(maxGy / CHUNK_SIZE) + 1) chunks.delete(key);
        }
      }
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

      targetsToDraw.forEach((target) => {
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

      // 4. Draw Physical Dropped Minerals Floating in Caverns
      droppedMinerals.forEach((min) => {
        ctx.save();
        ctx.translate(min.x, min.y);
        ctx.rotate(min.rotation);

        ctx.shadowColor = min.glow;
        ctx.shadowBlur = 0;

        // Gem faceted diamond hull
        ctx.strokeStyle = min.color;
        ctx.fillStyle = '#080d16';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.moveTo(0, -6.5);
        ctx.lineTo(5.5, 0);
        ctx.lineTo(0, 6.5);
        ctx.lineTo(-5.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner sparkling core
        ctx.fillStyle = min.color;
        ctx.fillRect(-1.5, -1.5, 3, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-0.5, -0.5, 1, 1);

        ctx.restore();
      });

      // 5. Draw Particles and Floating Numbers
      particleSystem.render(ctx);

      // 6. Draw Directional Course Vector (Heading in chosen direction until it hits a block)
      if (ship.isManualGuided && ship.guidedAngle !== null) {
        ctx.save();
        const rayLen = 75;
        const startX = validShipX + Math.cos(ship.guidedAngle) * 14;
        const startY = validShipY + Math.sin(ship.guidedAngle) * 14;
        const endX = ship.navigationMode === 'heading' ? validShipX + Math.cos(ship.guidedAngle) * rayLen : ship.targetX ?? validShipX;
        const endY = ship.navigationMode === 'heading' ? validShipY + Math.sin(ship.guidedAngle) * rayLen : ship.targetY ?? validShipY;

        // Glowing trajectory line
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -Date.now() * 0.04;
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.6;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Directional arrow chevron at the end
        const headAngle = ship.guidedAngle;
        const headSize = 7;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - Math.cos(headAngle - 0.5) * headSize,
          endY - Math.sin(headAngle - 0.5) * headSize
        );
        ctx.lineTo(
          endX - Math.cos(headAngle + 0.5) * headSize,
          endY - Math.sin(headAngle + 0.5) * headSize
        );
        ctx.closePath();
        ctx.fillStyle = '#00f0ff';
        ctx.fill();
        ctx.restore();
      }

      // Spawn soft thruster embers behind the ship while moving
      if (Math.hypot(ship.vx, ship.vy) > 12 && Math.random() > 0.4) {
        const nozzleX = validShipX - Math.cos(ship.angle) * 9;
        const nozzleY = validShipY - Math.sin(ship.angle) * 9;
        particleSystem.spawnThrusterMote(nozzleX, nozzleY, ship.angle);
      }

      for (const fleetShip of [ship, ...drones]) {
        if (fleetShip !== ship) {
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

      const hasVanguard = craftingItems.some((c) => c.id === 'vanguard_hull' && c.crafted);

      if (hasVanguard) {
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

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, ship, drones, droppedMinerals, world, craftingItems]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[300px] overflow-hidden cursor-crosshair">
      <div ref={fpsRef} className="absolute top-5 right-6 z-10 pointer-events-none text-[10px] font-mono text-white/50 tabular-nums" aria-label="Frames per second">measuring fps</div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelGesture}
        onLostPointerCapture={cancelGesture}
        className="w-full h-full block touch-none"
      />
    </div>
  );
};
