import React, { useRef, useEffect, useState } from 'react';
import type { CalculatedJoint, WindowHeader } from '../utils/rmrCalculator';
import { Download, ZoomIn, ZoomOut, RefreshCw, Layers } from 'lucide-react';
import { STRUCTURE_CATALOG } from '../utils/catalogData';

interface StructurePlotProps {
  header: WindowHeader;
  calculatedJoints: CalculatedJoint[];
  largo: number;
}

export default function StructurePlot({
  header,
  calculatedJoints,
  largo
}: StructurePlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    joint: CalculatedJoint;
    x: number;
    y: number;
  } | null>(null);

  // Auto-scale mapping helpers
  const getFamilyColor = (famNum: number): string => {
    const colors = [
      '#f97316', // Orange (F1)
      '#f59e0b', // Amber (F2)
      '#10b981', // Emerald (F3)
      '#a855f7', // Purple (F4)
      '#ec4899', // Pink (F5)
      '#3b82f6', // Blue (F6)
      '#ef4444', // Red (F7)
      '#64748b'  // Slate (F8)
    ];
    return colors[(famNum - 1) % colors.length];
  };

  useEffect(() => {
    drawPlot();
  }, [header, calculatedJoints, zoom, largo]);

  const drawPlot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark mode grid styling
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    if (largo <= 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Ingrese coordenadas FROM y TO válidas para graficar.', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Determine scale & translation to fit scanline on canvas
    const padding = 60;
    const drawWidth = canvas.width - padding * 2;
    const drawHeight = canvas.height - padding * 2;

    // We plot in horizontal 2D plane (East = X, Norte = Y)

    const minX = Math.min(header.este_from, header.este_to);
    const maxX = Math.max(header.este_from, header.este_to);
    const minY = Math.min(header.norte_from, header.norte_to);
    const maxY = Math.max(header.norte_from, header.norte_to);

    const spanX = maxX - minX || 1.0;
    const spanY = maxY - minY || 1.0;

    // Coordinate mapping helper: fit scanline in padding area
    const scaleX = drawWidth / spanX;
    const scaleY = drawHeight / spanY;
    const scale = Math.min(scaleX, scaleY) * zoom;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const mapCenterX = (header.este_from + header.este_to) / 2;
    const mapCenterY = (header.norte_from + header.norte_to) / 2;

    const toCanvasX = (mx: number) => centerX + (mx - mapCenterX) * scale;
    // Y coordinate in canvas runs downwards, map runs upwards (Norte increases northwards)
    const toCanvasY = (my: number) => centerY - (my - mapCenterY) * scale;

    const xFrom = toCanvasX(header.este_from);
    const yFrom = toCanvasY(header.norte_from);
    const xTo = toCanvasX(header.este_to);
    const yTo = toCanvasY(header.norte_to);

    // --- DRAW SCANLINE ---
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(xFrom, yFrom);
    ctx.lineTo(xTo, yTo);
    ctx.stroke();

    // Scanline shadow glow
    ctx.strokeStyle = 'rgba(168, 162, 158, 0.15)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(xFrom, yFrom);
    ctx.lineTo(xTo, yTo);
    ctx.stroke();

    // From and To Labels
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('INICIO (FROM)', xFrom, yFrom - 8);
    ctx.fillStyle = '#f87171';
    ctx.fillText('FIN (TO)', xTo, yTo - 8);

    // Draw From/To dots
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(xFrom, yFrom, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(xTo, yTo, 5, 0, Math.PI * 2);
    ctx.fill();

    // --- DRAW DISCONTINUITIES (STRIKE LINES) ---
    calculatedJoints.forEach(cj => {
      const cx = toCanvasX(cj.x);
      const cy = toCanvasY(cj.y);

      // Strike direction of discontinuity: DipDir + 90 or - 90 deg
      // Let's compute the strike direction angle in radians
      const dipDir = cj.row.dip_dir !== undefined && cj.row.dip_dir !== -1 ? cj.row.dip_dir : 0;
      const dipDirRad = (dipDir * Math.PI) / 180;
      const strikeAngle = dipDirRad - Math.PI / 2; // perpendicular to Dip Dir

      // Draw a line perpendicular to Dip Dir representing strike (longitud proportional to continuidad)
      const cont = cj.row.continuidad !== undefined && cj.row.continuidad !== -1 ? cj.row.continuidad : 1.5;
      const visibleLength = Math.max(15, cont * scale * 0.4);
      const halfL = visibleLength / 2;

      const sx1 = cx - halfL * Math.cos(strikeAngle);
      const sy1 = cy + halfL * Math.sin(strikeAngle); // inverted Y axis
      const sx2 = cx + halfL * Math.cos(strikeAngle);
      const sy2 = cy - halfL * Math.sin(strikeAngle);

      // Line color based on Family
      const famColor = getFamilyColor(cj.row.familia);
      ctx.strokeStyle = famColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();

      // Draw structural tick dot at center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      // Show structural ID label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`F${cj.row.familia} (#${cj.row.id})`, cx + 6, cy + 3);
    });

    // Draw North arrow indicator top-right
    const arrowX = canvas.width - 50;
    const arrowY = 50;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX, arrowY - 20); // North line
    ctx.lineTo(arrowX - 4, arrowY - 14); // Left tip
    ctx.moveTo(arrowX, arrowY - 20);
    ctx.lineTo(arrowX + 4, arrowY - 14); // Right tip
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', arrowX, arrowY + 10);
  };

  // Hover detection logic
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || calculatedJoints.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Recalculate mapping scales to find nearest point in screen coordinates
    const padding = 60;
    const drawWidth = canvas.width - padding * 2;
    const drawHeight = canvas.height - padding * 2;

    const minX = Math.min(header.este_from, header.este_to);
    const maxX = Math.max(header.este_from, header.este_to);
    const minY = Math.min(header.norte_from, header.norte_to);
    const maxY = Math.max(header.norte_from, header.norte_to);

    const spanX = maxX - minX || 1.0;
    const spanY = maxY - minY || 1.0;

    const scaleX = drawWidth / spanX;
    const scaleY = drawHeight / spanY;
    const scale = Math.min(scaleX, scaleY) * zoom;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const mapCenterX = (header.este_from + header.este_to) / 2;
    const mapCenterY = (header.norte_from + header.norte_to) / 2;

    const toCanvasX = (mx: number) => centerX + (mx - mapCenterX) * scale;
    const toCanvasY = (my: number) => centerY - (my - mapCenterY) * scale;

    let closestJoint: CalculatedJoint | null = null;
    let minDistance = 12; // hover tolerance radius in pixels

    calculatedJoints.forEach(cj => {
      const cx = toCanvasX(cj.x);
      const cy = toCanvasY(cj.y);
      const dist = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestJoint = cj;
      }
    });

    if (closestJoint) {
      setTooltipData({
        joint: closestJoint,
        x: mouseX,
        y: mouseY
      });
      setShowTooltip(true);
    } else {
      setShowTooltip(false);
      setTooltipData(null);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `estructuras_celda_${header.celda || 'mapeo'}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 select-none">
      <div className="flex justify-between items-center border-b border-navy-800 pb-3">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} className="text-orange-400" />
          <span>Vista en Planta de Estructuras (Scanline 3D Proyectado)</span>
        </h3>

        <div className="flex gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="p-1.5 rounded bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 hover:text-slate-100 transition-colors"
            title="Alejar"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1.5 rounded bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 hover:text-slate-100 transition-colors"
            title="Resetear Zoom"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(3.0, z + 0.1))}
            className="p-1.5 rounded bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 hover:text-slate-100 transition-colors"
            title="Acercar"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleDownload}
            disabled={largo <= 0}
            className="flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-800 dark:text-orange-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>

      <div className="relative border border-navy-900 rounded-lg overflow-hidden bg-navy-950 flex justify-center">
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setShowTooltip(false)}
          className="cursor-crosshair max-w-full block"
        />

        {showTooltip && tooltipData && (
          <div
            className="absolute z-50 bg-navy-950/95 border border-navy-700 rounded-xl p-3.5 text-xs shadow-2xl backdrop-blur-md space-y-1.5 w-64 text-left pointer-events-none text-slate-300"
            style={{
              left: tooltipData.x + 15,
              top: tooltipData.y + 15
            }}
          >
            <p className="font-extrabold text-orange-400 border-b border-navy-800 pb-1 uppercase tracking-wider text-sm">
              Discontinuidad #{tooltipData.joint.row.id}
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div>
                <span className="text-slate-500 block text-xs uppercase">Distancia:</span>
                <span className="font-bold text-slate-200">{tooltipData.joint.row.distancia?.toFixed(2) ?? '—'} m</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase">Estructura:</span>
                <span className="font-bold text-orange-400">
                  {STRUCTURE_CATALOG[tooltipData.joint.row.tipo_estructura] || tooltipData.joint.row.tipo_estructura}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase">Buzamiento:</span>
                <span className="font-bold text-slate-200">{tooltipData.joint.row.dip}&deg; / {tooltipData.joint.row.dip_dir}&deg;</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs uppercase">Familia:</span>
                <span className="font-bold text-purple-400">F{tooltipData.joint.row.familia}</span>
              </div>
            </div>
            <div className="border-t border-navy-850 pt-1.5 mt-1 space-y-0.5 font-mono text-xs text-slate-400">
              <p>UTM E (X): {tooltipData.joint.x.toFixed(2)}</p>
              <p>UTM N (Y): {tooltipData.joint.y.toFixed(2)}</p>
              <p>UTM C (Z): {tooltipData.joint.z.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs font-bold text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#a8a29e]"></span>Línea de Scanline 3D</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#f97316]"></span>Familia 1 (F1)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#f59e0b]"></span>Familia 2 (F2)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#10b981]"></span>Familia 3 (F3)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#a855f7]"></span>Familia 4 (F4)</span>
        <span className="flex items-center gap-1.5 text-slate-500 italic">Hover sobre cualquier junta para ver coordenadas UTM</span>
      </div>
    </div>
  );
}
