import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { CalculatedJoint, WindowHeader } from '../../utils/rmrCalculator';
import { Download, ZoomIn, ZoomOut, RefreshCw, Layers, Compass } from 'lucide-react';
import { STRUCTURE_CATALOG } from '../../utils/catalogData';
import { FormulaTooltipTrigger } from '../Common/FormulaTooltip';

interface StructurePlotProps {
  header: WindowHeader;
  calculatedJoints: CalculatedJoint[];
  largo: number;
  showFormulas?: boolean;
}

export default function StructurePlot({
  header,
  calculatedJoints,
  largo,
  showFormulas = true
}: StructurePlotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 480 });

  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    joint: CalculatedJoint;
    x: number;
    y: number;
    alignedLeft: boolean;
    alignedTop: boolean;
  } | null>(null);

  const getFamilyColor = (famNum: number): string => {
    const colors = [
      '#fb923c', // Orange (F1)
      '#34d399', // Emerald (F2)
      '#818cf8', // Indigo (F3)
      '#f472b6', // Pink (F4)
      '#22d3ee', // Cyan (F5)
      '#fbbf24', // Amber (F6)
      '#f87171', // Red (F7)
      '#a78bfa', // Violet (F8)
      '#2dd4bf'  // Teal (F9)
    ];
    return colors[(famNum - 1) % colors.length];
  };

  const parseLocaleFloat = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const str = String(val).replace(',', '.').trim();
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatNumber6 = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val) || !Number.isFinite(val)) return '—';
    const rounded = Math.round(val * 1000000) / 1000000;
    return String(rounded);
  };

  const formatNumber3 = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val) || !Number.isFinite(val)) return '—';
    return val.toFixed(3);
  };

  const formatNumber4 = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val) || !Number.isFinite(val)) return '—';
    return val.toFixed(4);
  };

  const formatNumber2 = (val: number | undefined | null): string => {
    if (val === undefined || val === null || isNaN(val) || !Number.isFinite(val)) return '—';
    return val.toFixed(2);
  };

  const activeFamiliesInPlot = useMemo(() => {
    const jointsList = calculatedJoints || [];
    return Array.from(new Set(jointsList.map(j => j.row?.familia || (j.row as any)?.fam).filter(Boolean))).sort((a, b) => a - b);
  }, [calculatedJoints]);

  const xFromVal = parseLocaleFloat(header?.este_from);
  const yFromVal = parseLocaleFloat(header?.norte_from);
  const cFromVal = parseLocaleFloat(header?.cota_from);
  const xToVal = parseLocaleFloat(header?.este_to);
  const yToVal = parseLocaleFloat(header?.norte_to);
  const cToVal = parseLocaleFloat(header?.cota_to);

  const largoValid = largo > 0;
  const isCoordsValid = [xFromVal, yFromVal, cFromVal, xToVal, yToVal, cToVal].every(c => c !== 0);

  const base_scale_current = (W: number, H: number) => {
    const ML = 95, MR = 40, MT = 50, MB = 65;
    const PW = W - ML - MR;
    const PH = H - MT - MB;

    const minX = Math.min(xFromVal, xToVal);
    const maxX = Math.max(xFromVal, xToVal);
    const minY = Math.min(yFromVal, yToVal);
    const maxY = Math.max(yFromVal, yToVal);

    const spanX = maxX - minX || 1.0;
    const spanY = maxY - minY || 1.0;

    const scaleX = PW / spanX;
    const scaleY = PH / spanY;
    const scale = Math.min(scaleX, scaleY) * zoom;

    return {
      scale,
      spanX,
      spanY
    };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 400),
        height: Math.max(height, 300)
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    drawPlot();
  }, [header, calculatedJoints, zoom, largo, panX, panY, dimensions]);

  const drawPlot = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Paleta del canvas según el tema activo (claro/oscuro)
      const isDark = document.documentElement.classList.contains('dark');
      const plotBg = isDark ? '#0c0a09' : '#eef2f6';
      const gridColor = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.05)';
      const axisColor = isDark ? '#94a3b8' : '#475569';
      const axisFaint = isDark ? 'rgba(100,116,139,0.4)' : 'rgba(71,85,105,0.35)';
      const frameColor = isDark ? 'rgba(100,116,139,0.6)' : 'rgba(71,85,105,0.55)';
      const labelColor = isDark ? '#94a3b8' : '#475569';
      const axisTitleColor = isDark ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)';
      const nodeStroke = isDark ? '#0c0a09' : '#ffffff';
      const nodeLabel = isDark ? '#f8fafc' : '#0f172a';

      const W = dimensions.width;
      const H = dimensions.height;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = plotBg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      const gridSpacing = 40;
      for (let x = 0; x < W; x += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSpacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      if (!largoValid || !isCoordsValid) {
        ctx.fillStyle = labelColor;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ingrese coordenadas FROM y TO válidas para graficar el plano.', W / 2, H / 2);
        return;
      }

      const ML = 95, MR = 40, MT = 50, MB = 65;
      const PW = W - ML - MR;
      const PH = H - MT - MB;

      const { scale } = base_scale_current(W, H);

      const centerX = ML + PW / 2;
      const centerY = MT + PH / 2;
      const mapCenterX = (xFromVal + xToVal) / 2;
      const mapCenterY = (yFromVal + yToVal) / 2;

      const toCanvasX = (mx: number) => centerX + panX + (mx - mapCenterX) * scale;
      const toCanvasY = (my: number) => centerY + panY - (my - mapCenterY) * scale;

      const fromCanvasX = (cx: number) => mapCenterX + (cx - centerX - panX) / scale;
      const fromCanvasY = (cy: number) => mapCenterY - (cy - centerY - panY) / scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(ML, MT, PW, PH);
      ctx.clip();

      const xFrom = toCanvasX(xFromVal);
      const yFrom = toCanvasY(yFromVal);
      const xTo = toCanvasX(xToVal);
      const yTo = toCanvasY(yToVal);

      const boxPad = 12;
      const perpAngle = Math.atan2(yTo - yFrom, xTo - xFrom) + Math.PI / 2;
      const px = Math.cos(perpAngle) * boxPad;
      const py = Math.sin(perpAngle) * boxPad;
      ctx.beginPath();
      ctx.moveTo(xFrom - px, yFrom - py); ctx.lineTo(xTo - px, yTo - py);
      ctx.lineTo(xTo + px, yTo + py); ctx.lineTo(xFrom + px, yFrom + py);
      ctx.closePath();
      ctx.fillStyle = "rgba(14,165,233,0.06)";
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.moveTo(xFrom, yFrom); ctx.lineTo(xTo, yTo); ctx.stroke();
      ctx.setLineDash([]);

      (calculatedJoints || []).forEach(cj => {
        if (!cj.row) return;
        const cx = toCanvasX(cj.x);
        const cy = toCanvasY(cj.y);

        const dipDir = cj.row.dip_dir !== undefined && cj.row.dip_dir !== -1 ? cj.row.dip_dir : 0;
        const dipDirRad = (dipDir * Math.PI) / 180;
        const strikeAngle = dipDirRad - Math.PI / 2;

        const cont = cj.row.continuidad !== undefined && cj.row.continuidad !== -1 ? cj.row.continuidad : 1.5;
        const visibleLength = cont * scale;
        const halfL = visibleLength / 2;

        const sx1 = cx - halfL * Math.cos(strikeAngle);
        const sy1 = cy + halfL * Math.sin(strikeAngle);
        const sx2 = cx + halfL * Math.cos(strikeAngle);
        const sy2 = cy - halfL * Math.sin(strikeAngle);

        const fam = cj.row.familia || (cj.row as any).fam || 1;
        const id = cj.row.id || (cj.row as any).id || '?';
        const famColor = getFamilyColor(fam);

        if (cj.inBounds) {
          ctx.strokeStyle = famColor;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.save();
          ctx.strokeStyle = famColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.4;
          ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();

          ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = famColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = cj.inBounds ? axisColor : 'rgba(71,85,105,0.4)';
        ctx.font = 'bold 10px monospace';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(`F${fam} (#${id})`, cx + 6, cy + 3);
      });

      drawNode(ctx, xFrom, yFrom, 'FROM', '#22d3ee', nodeStroke, nodeLabel);
      drawNode(ctx, xTo, yTo, 'TO', '#a78bfa', nodeStroke, nodeLabel);

      ctx.restore();

      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ML, MT, PW, PH);

      ctx.fillStyle = axisColor;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const tickCount = 5;
      for (let i = 0; i <= tickCount; i++) {
        const cx = ML + (i / tickCount) * PW;
        const wx = fromCanvasX(cx);
        ctx.strokeStyle = axisFaint;
        ctx.beginPath(); ctx.moveTo(cx, MT + PH); ctx.lineTo(cx, MT + PH + 5); ctx.stroke();
        ctx.fillText(formatNumber3(wx), cx, MT + PH + 8);
      }

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= tickCount; i++) {
        const cy = MT + PH - (i / tickCount) * PH;
        const wy = fromCanvasY(cy);
        ctx.strokeStyle = axisFaint;
        ctx.beginPath(); ctx.moveTo(ML, cy); ctx.lineTo(ML - 5, cy); ctx.stroke();
        ctx.fillText(formatNumber3(wy), ML - 8, cy);
      }

      // CORREGIDO: Cambio de tipografía de 'Outfit' a 'Inter' para garantizar consistencia global
      ctx.font = "13px 'Inter', sans-serif";
      ctx.fillStyle = axisTitleColor;
      ctx.textAlign = "center";
      ctx.fillText("Este (UTM X) →", ML + PW / 2, MT + PH + 32);

      ctx.save();
      ctx.translate(18, MT + PH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Norte (UTM Y) ↑", 0, 0);
      ctx.restore();

    } catch (err) {
      console.error("Error de cálculo detectado en StructurePlot:", err);
    }
  };

  // Repintar el canvas cuando cambia el tema (clase dark/light en <html>)
  const drawPlotRef = useRef(drawPlot);
  drawPlotRef.current = drawPlot;
  useEffect(() => {
    const observer = new MutationObserver(() => drawPlotRef.current());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const drawNode = (ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string, stroke: string, labelFill: string) => {
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = labelFill; ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.fillText(label, x, y - 10);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCoordsValid) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMoveEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCoordsValid) return;
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      handleHoverDetection(e);
    }
  };

  const handleHoverDetection = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !calculatedJoints || calculatedJoints.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const ML = 95, MR = 40, MT = 50, MB = 65;
    const PW = dimensions.width - ML - MR;
    const PH = dimensions.height - MT - MB;

    const { scale } = base_scale_current(dimensions.width, dimensions.height);
    const centerX = ML + PW / 2;
    const centerY = MT + PH / 2;
    const mapCenterX = (xFromVal + xToVal) / 2;
    const mapCenterY = (yFromVal + yToVal) / 2;

    const toCanvasX = (mx: number) => centerX + panX + (mx - mapCenterX) * scale;
    const toCanvasY = (my: number) => centerY + panY - (my - mapCenterY) * scale;

    let closestJoint: CalculatedJoint | null = null;
    let minDistance = 14;

    for (const cj of calculatedJoints) {
      const cx = toCanvasX(cj.x);
      const cy = toCanvasY(cj.y);
      const dist = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestJoint = cj;
      }
    }

    if (closestJoint && closestJoint.row) {
      const tooltipWidth = 270;
      const tooltipHeight = 160;
      const alignedLeft = mouseX + tooltipWidth + 30 > dimensions.width;
      const alignedTop = mouseY + tooltipHeight + 30 > dimensions.height;

      setTooltipData({
        joint: closestJoint,
        x: mouseX,
        y: mouseY,
        alignedLeft,
        alignedTop
      });
      setShowTooltip(true);
    } else {
      setShowTooltip(false);
      setTooltipData(null);
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isCoordsValid) return;
    const zoomFactor = 1.1;
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(5.0, prev * zoomFactor));
    } else {
      setZoom(prev => Math.max(0.4, prev / zoomFactor));
    }
  };

  const handleReset = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
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
    <div className="glass-panel p-5 rounded-xl border border-navy-800 space-y-4 select-none text-left animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-navy-800 pb-3">
        <h3 className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} className="text-orange-400" />
          <span>Vista en Planta de Estructuras (Scanline 3D Proyectado)</span>
        </h3>

        <div className="flex gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
            disabled={!isCoordsValid}
            className="p-1.5 rounded bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Alejar"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleReset}
            disabled={!isCoordsValid}
            className="p-1.5 rounded bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Resetear Zoom y Pan"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(5.0, z + 0.1))}
            disabled={!isCoordsValid}
            className="p-1.5 rounded bg-navy-900 border border-navy-800 hover:bg-navy-850 text-slate-400 hover:text-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Acercar"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleDownload}
            disabled={!largoValid || !isCoordsValid}
            className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/40 hover:bg-orange-500/20 hover:border-orange-400 text-orange-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-35 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(249,115,22,0.12)]"
          >
            <Download size={14} />
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative border border-navy-900 rounded-lg overflow-hidden bg-navy-950 flex justify-center group/canvas w-full h-[28rem] sm:h-[32rem]"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveEvent}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
          className="cursor-grab active:cursor-grabbing block w-full h-full"
        />

        {isCoordsValid && (
          <div className="absolute bottom-3 left-3 bg-slate-950/80 border border-navy-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 flex items-center gap-1.5 font-semibold pointer-events-none opacity-0 group-hover/canvas:opacity-100 transition-opacity">
            <Compass size={12} className="text-orange-400" />
            <span>Arrastra para mover  ·  Scroll para Zoom</span>
          </div>
        )}

        {showTooltip && tooltipData && tooltipData.joint.row && (
          <div
            className="absolute z-50 bg-navy-950/95 border border-navy-800 rounded-xl p-3.5 text-xs shadow-2xl backdrop-blur-md space-y-1.5 w-64 text-left pointer-events-none text-slate-300"
            style={{
              left: tooltipData.alignedLeft ? tooltipData.x - 270 : tooltipData.x + 15,
              top: tooltipData.alignedTop ? tooltipData.y - 140 : tooltipData.y + 15
            }}
          >
            <p className="font-extrabold text-orange-400 border-b border-navy-800 pb-1 uppercase tracking-wider text-xs">
              Discontinuidad #{tooltipData.joint.row.id || (tooltipData.joint.row as any).id}
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Distancia:</span>
                <span className="font-bold text-slate-200">{formatNumber3(tooltipData.joint.row.distancia)} m</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Estructura:</span>
                <span className="font-bold text-orange-400 truncate block">
                  {STRUCTURE_CATALOG[tooltipData.joint.row.tipo_estructura] || tooltipData.joint.row.tipo_estructura}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Buzamiento:</span>
                <span className="font-bold text-slate-200">{tooltipData.joint.row.dip ?? '—'}&deg; / {tooltipData.joint.row.dip_dir ?? '—'}&deg;</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Familia:</span>
                <span className="font-bold text-violet-400">F{tooltipData.joint.row.familia || (tooltipData.joint.row as any).fam}</span>
              </div>
            </div>
            <div className="border-t border-navy-850 pt-1.5 mt-1 space-y-0.5 font-mono text-[9px] text-slate-400">
              <p>UTM E (X): {formatNumber6(tooltipData.joint.x)}</p>
              <p>UTM N (Y): {formatNumber6(tooltipData.joint.y)}</p>
              <p>UTM C (Z): {formatNumber6(tooltipData.joint.z)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs font-bold text-slate-400 border-b border-navy-900 pb-3">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-1 rounded-sm bg-[#38bdf8]"></span>
          <span>Línea de Scanline 3D</span>
        </span>
        {activeFamiliesInPlot.map(famId => {
          const color = getFamilyColor(famId);
          return (
            <span key={famId} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
              <span>Familia {famId} (F{famId})</span>
            </span>
          );
        })}
        {calculatedJoints && calculatedJoints.some(cj => !cj.inBounds) && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-dashed border-slate-400 bg-transparent"></span>
            <span className="text-slate-400">Fuera de ventana</span>
          </span>
        )}
      </div>

      <div className="border border-navy-850 rounded-xl overflow-hidden bg-navy-950/45 pt-1.5">
        <div className="px-4 py-2.5 border-b border-navy-850 bg-navy-950 flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Tabla de Detalle de Proyecciones Estructurales</span>
          <span className="text-xs text-slate-400 font-mono font-bold bg-navy-900 px-2.5 py-1 rounded-md">
            Ángulo θ: {formatNumber6(calculatedJoints[0]?.theta)}&deg; | Ángulo α: {formatNumber6(calculatedJoints[0]?.alpha)}&deg;
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-navy-850">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-2 text-center">Fam</th>
                <th className="py-2.5 px-2">Tipo</th>
                <th className="py-2.5 px-3 text-center">Dist (m)</th>
                <th className="py-2.5 px-3 text-center text-sky-400">UTM Este (X)</th>
                <th className="py-2.5 px-3 text-center text-sky-400">UTM Norte (Y)</th>
                <th className="py-2.5 px-3 text-center text-sky-400">UTM Cota (Z)</th>
                <th className="py-2.5 px-3 text-center text-violet-400">Ángulo θ (&deg;)</th>
                <th className="py-2.5 px-3 text-center text-violet-400">Ángulo α (&deg;)</th>
                <th className="py-2.5 px-2 text-center">Orientación</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-900/40 text-slate-300 font-medium">
              {(calculatedJoints || []).map((cj, i) => {
                if (!cj.row) return null;
                const fam = cj.row.familia || (cj.row as any).fam || 1;
                const id = cj.row.id || (cj.row as any).id || i + 1;
                const color = getFamilyColor(fam);
                return (
                  <tr key={i} className="hover:bg-navy-900/10 transition-colors">
                    <td className="py-2 px-3 font-mono text-slate-500">#{id}</td>
                    <td className="py-2 px-2 text-center font-extrabold" style={{ color }}>F{fam}</td>
                    <td className="py-2 px-2 font-bold text-slate-400">{cj.row.tipo_estructura}</td>
                    <td className="py-2 px-3 text-center font-mono text-sky-300 bg-sky-500/5">{formatNumber3(cj.row.distancia)}</td>
                    <td className="py-2 px-3 text-center font-mono text-sky-300 bg-sky-500/5">
                      <FormulaTooltipTrigger formulaId="utm_x_proj" params={{ dist: cj.row.distancia, theta: cj.theta, este_from: parseLocaleFloat(header?.este_from), val: cj.x }} position="top" enabled={showFormulas}>
                        <span>{formatNumber4(cj.x)}</span>
                      </FormulaTooltipTrigger>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-sky-300 bg-sky-500/5">
                      <FormulaTooltipTrigger formulaId="utm_y_proj" params={{ dist: cj.row.distancia, theta: cj.theta, norte_from: parseLocaleFloat(header?.norte_from), val: cj.y }} position="top" enabled={showFormulas}>
                        <span>{formatNumber2(cj.y)}</span>
                      </FormulaTooltipTrigger>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-sky-300 bg-sky-500/5">
                      <FormulaTooltipTrigger formulaId="utm_z_proj" params={{ dist: cj.row.distancia, theta: cj.theta, alpha: cj.alpha, cota_from: parseLocaleFloat(header?.cota_from), val: cj.z }} position="top" enabled={showFormulas}>
                        <span>{formatNumber6(cj.z)}</span>
                      </FormulaTooltipTrigger>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-violet-300 bg-violet-500/5">
                      <FormulaTooltipTrigger formulaId="theta_angle" params={{ val: cj.theta, norte_to: parseLocaleFloat(header?.norte_to), norte_from: parseLocaleFloat(header?.norte_from), este_to: parseLocaleFloat(header?.este_to), este_from: parseLocaleFloat(header?.este_from) }} position="top" enabled={showFormulas}>
                        <span>{formatNumber6(cj.theta)}&deg;</span>
                      </FormulaTooltipTrigger>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-violet-300 bg-violet-500/5">
                      <FormulaTooltipTrigger formulaId="alpha_angle" params={{ val: cj.alpha, este_to: parseLocaleFloat(header?.este_to), este_from: parseLocaleFloat(header?.este_from), cota_to: parseLocaleFloat(header?.cota_to), cota_from: parseLocaleFloat(header?.cota_from) }} position="top" enabled={showFormulas}>
                        <span>{formatNumber6(cj.alpha)}&deg;</span>
                      </FormulaTooltipTrigger>
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-slate-400">{cj.row.dip ?? '—'}&deg; / {cj.row.dip_dir ?? '—'}&deg;</td>
                    <td className={`py-2 px-3 text-center font-bold ${cj.inBounds ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {cj.inBounds ? '✓ Dentro' : '✗ Fuera'}
                    </td>
                  </tr>
                );
              })}
              {(!calculatedJoints || calculatedJoints.length === 0) && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 italic bg-navy-950/20 font-semibold">
                    No se registran discontinuidades con distancias válidas para proyectar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}