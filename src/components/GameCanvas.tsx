import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../state/gameContext';
import { BLOCK_SIZE } from '../engine/world';
import { particleSystem } from '../engine/particles';

export const GameCanvas: React.FC = () => {
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

  const isDraggingRef = useRef<boolean>(false);

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

  // Pointer / Touch events for bumblebee directional guidance
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    setManualTarget(worldPos.x, worldPos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    setManualTarget(worldPos.x, worldPos.y);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Read current canvas physical pixel dimensions directly from DOM
      const domW = canvas.clientWidth || (containerRef.current ? containerRef.current.clientWidth : 0);
      const domH = canvas.clientHeight || (containerRef.current ? containerRef.current.clientHeight : 0);

      const width = domW > 20 ? domW : dimensions.width > 20 ? dimensions.width : window.innerWidth;
      const height = domH > 20 ? domH : dimensions.height > 20 ? dimensions.height : window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);

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

      // Camera focal point: weighted towards player ship while framing the fleet
      let targetCamX = validShipX;
      let targetCamY = validShipY;
      if (activeDroneCount > 0) {
        const droneAvgX = droneSumX / activeDroneCount;
        const droneAvgY = droneSumY / activeDroneCount;
        targetCamX = validShipX * 0.75 + droneAvgX * 0.25;
        targetCamY = validShipY * 0.75 + droneAvgY * 0.25;
      }

      // Smooth camera position tracking
      if (Math.hypot(targetCamX - cameraRef.current.x, targetCamY - cameraRef.current.y) > 400) {
        cameraRef.current.x = targetCamX;
        cameraRef.current.y = targetCamY;
      } else {
        cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.08;
        cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.08;
      }

      // Dynamic zoom: smoothly zooms out when ship and drones separate
      let desiredZoom = 1.0;
      if (activeDroneCount > 0) {
        const spanW = maxX - minX + 240;
        const spanH = maxY - minY + 240;
        const fitZoomX = width / Math.max(width, spanW);
        const fitZoomY = height / Math.max(height, spanH);
        desiredZoom = Math.max(0.50, Math.min(1.0, Math.min(fitZoomX, fitZoomY)));
      }
      zoomRef.current += (desiredZoom - zoomRef.current) * 0.05;
      const zoom = zoomRef.current;

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

      // 2. Draw Asteroid Blocks with high-contrast visible wireframes & vibrant gems
      for (let gy = minGy; gy <= maxGy; gy++) {
        for (let gx = minGx; gx <= maxGx; gx++) {
          if (world.isMined(gx, gy)) continue;

          const block = world.getBlock(gx, gy, 0);
          if (!block) continue;

          const bx = gx * BLOCK_SIZE;
          const by = gy * BLOCK_SIZE;
          const isSurface = world.isSurfaceBlock(gx, gy);

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
          ctx.fillRect(bx, by, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

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
          ctx.strokeRect(bx + 0.5, by + 0.5, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

          // Render glowing neon crystal symbols inside the block
          const cx = bx + BLOCK_SIZE / 2;
          const cy = by + BLOCK_SIZE / 2;

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

          // Damage overlay if block has taken laser hits
          if (block.hp < block.maxHp) {
            const healthRatio = Math.max(0, block.hp / block.maxHp);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(bx + 2, by + BLOCK_SIZE - 4, (BLOCK_SIZE - 5) * healthRatio, 2);
          }
        }
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
        ctx.shadowBlur = 12;
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
        ctx.shadowBlur = 10;

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

      // 5. Draw Drones and Drone Beams
      drones.forEach((drone) => {
        if (drone.beamActive && drone.targetBlock) {
          const dtx = drone.targetBlock.x * BLOCK_SIZE + BLOCK_SIZE / 2;
          const dty = drone.targetBlock.y * BLOCK_SIZE + BLOCK_SIZE / 2;
          ctx.save();
          ctx.strokeStyle = drone.color;
          ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
          ctx.shadowBlur = 6;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(drone.x, drone.y);
          ctx.lineTo(dtx, dty);
          ctx.stroke();
          ctx.restore();
        }

        // Drone vector triangle
        ctx.save();
        ctx.translate(drone.x, drone.y);
        ctx.rotate(drone.angle);
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#050508';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = drone.color;
        ctx.shadowBlur = 5;

        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-5, -4);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
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
        const endX = validShipX + Math.cos(ship.guidedAngle) * rayLen;
        const endY = validShipY + Math.sin(ship.guidedAngle) * rayLen;

        // Glowing trajectory line
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -Date.now() * 0.04;
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = 'rgba(0, 240, 255, 0.85)';
        ctx.shadowBlur = 10;
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

      // 7. Draw The Player Ship (Sleek Vector Triangle)
      ctx.save();
      ctx.translate(validShipX, validShipY);
      ctx.rotate(ship.angle);

      // Soft thruster trail glow (calm, subtle)
      const thrusterLength = 5 + Math.random() * 5;
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
      ctx.shadowBlur = 6;
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
        ctx.shadowBlur = 8;

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
        ctx.shadowBlur = 6;
        ctx.fillRect(0, -1.5, 5, 3);
      } else {
        // Classic Minimalist Space Triangle Wireframe
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = '#050508';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 6;

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

      ctx.restore(); // Restore world camera transform
      ctx.restore(); // Restore DPR transform

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, ship, drones, droppedMinerals, world, craftingItems]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[300px] overflow-hidden cursor-crosshair">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full block touch-none"
      />
    </div>
  );
};
