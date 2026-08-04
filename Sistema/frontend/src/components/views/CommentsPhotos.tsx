import React, { useState } from 'react';
import { Camera, Trash2, Plus, MessageSquare, X, Maximize2 } from 'lucide-react';

interface CommentsPhotosProps {
  celda: string;
  comentario: string;
  onComentarioChange: (val: string) => void;
  photos: string[]; // URLs absolutas del backend
  captions: string[]; // Descripciones de las fotos
  onPhotosChange: (photos: string[], captions: string[]) => void;
  apiBase: string; // URL base del backend de FastAPI
}

export default function CommentsPhotos({
  celda,
  comentario,
  onComentarioChange,
  photos,
  captions,
  onPhotosChange,
  apiBase
}: CommentsPhotosProps) {

  const fileInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Estado para la previsualización a pantalla completa (Lightbox)
  const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación estricta de peso de archivo (máximo 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("La fotografía supera el límite de peso permitido de 5 MB. Reduzca la resolución antes de subirla.");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('index', String(index));

    try {
      const res = await fetch(`${apiBase}/api/ventanas/${celda}/fotos?index=${index}`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const updatedPhotos = [...photos];
        const updatedCaptions = [...captions];

        // Se concatena una estampa de tiempo para evadir la caché persistente del navegador
        updatedPhotos[index] = `${apiBase}${data.url}?t=${Date.now()}`;
        if (!updatedCaptions[index]) {
          updatedCaptions[index] = `Fotografía ${index + 1}`;
        }

        onPhotosChange(updatedPhotos, updatedCaptions);
        saveMetadata(updatedCaptions);
      } else {
        const err = await res.json();
        alert(err.detail || "Error al subir la fotografía.");
      }
    } catch (err) {
      alert("Error de conexión con el servidor al subir la fotografía.");
    }
  };

  const removePhoto = async (index: number) => {
    const updatedPhotos = [...photos];
    const updatedCaptions = [...captions];

    updatedPhotos[index] = '';
    updatedCaptions[index] = '';

    onPhotosChange(updatedPhotos, updatedCaptions);

    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = '';
    }

    try {
      await fetch(`${apiBase}/api/ventanas/${celda}/fotos/${index}`, {
        method: 'DELETE'
      });
      saveMetadata(updatedCaptions);
    } catch (err) {
      console.error("Error al eliminar la foto del servidor: ", err);
    }
  };

  const saveMetadata = async (currentCaptions: string[]) => {
    try {
      await fetch(`${apiBase}/api/ventanas/${celda}/fotos/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captions: currentCaptions })
      });
    } catch (err) {
      console.error("Error al sincronizar descripciones: ", err);
    }
  };

  const handleCaptionChange = (val: string, index: number) => {
    const updatedCaptions = [...captions];
    updatedCaptions[index] = val;
    onPhotosChange(photos, updatedCaptions);
  };

  const addPhotoSlot = () => {
    const firstEmptyIndex = photos.findIndex(p => !p);
    if (firstEmptyIndex !== -1 && fileInputRefs.current[firstEmptyIndex]) {
      fileInputRefs.current[firstEmptyIndex]!.click();
    }
  };

  const activePhotoCount = photos.filter(p => !!p).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none text-left animate-fade-in">

      {/* 💬 SECCIÓN 1: Comentarios del Registro (Proporción 1/3 -> lg:col-span-4) */}
      <div className="lg:col-span-4 glass-panel p-6 rounded-xl border border-navy-800 border-l-4 border-l-orange-500/80 bg-navy-950/10 flex flex-col h-full shadow-lg">
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-orange-400" />
            <span>Comentarios del Registro</span>
          </h3>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            Ingrese anotaciones geomecánicas de la celda de mapeo, condiciones de agua subterránea o comentarios del terreno.
          </p>
        </div>

        <div className="flex-1 flex flex-col">
          <textarea
            value={comentario || ''}
            onChange={(e) => onComentarioChange(e.target.value)}
            placeholder="Escriba aquí las observaciones estructurales o geomecánicas críticas encontradas durante el mapeo..."
            className="w-full flex-1 min-h-[220px] bg-navy-950/70 border border-navy-800 rounded-lg p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/60 font-medium resize-none leading-relaxed shadow-inner"
          />
        </div>
      </div>

      {/* 📸 SECCIÓN 2: Fotografías del Registro (Proporción 2/3 -> lg:col-span-8) */}
      <div className="lg:col-span-8 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/10 flex flex-col h-full justify-between shadow-lg">
        <div className="flex items-center justify-between border-b border-navy-900 pb-3">
          <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <Camera size={16} className="text-orange-400" />
            <span>Fotografías del Registro</span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-bold bg-navy-900 border border-navy-800 px-2.5 py-1 rounded-md">
              {activePhotoCount} / 4 fotos
            </span>
            {activePhotoCount < 4 && (
              <button
                onClick={addPhotoSlot}
                className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/25 text-orange-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md"
              >
                <Plus size={14} />
                <span>Agregar</span>
              </button>
            )}
          </div>
        </div>

        {/* Rejilla de Imágenes */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {[0, 1, 2, 3].map((idx) => {
            const hasPhoto = !!photos[idx];

            return (
              <div
                key={idx}
                className={`aspect-video relative rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all border duration-300 ${hasPhoto
                    ? 'bg-navy-950 border-navy-800 group'
                    : 'bg-navy-950/40 border-dashed border-2 border-navy-850 hover:border-orange-500/40 hover:bg-navy-950/80 group'
                  }`}
                onClick={() => {
                  if (!hasPhoto && fileInputRefs.current[idx]) {
                    fileInputRefs.current[idx]!.click();
                  }
                }}
              >
                <input
                  type="file"
                  ref={(el) => {
                    fileInputRefs.current[idx] = el;
                  }}
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, idx)}
                  className="hidden"
                />

                {hasPhoto ? (
                  <>
                    <img
                      src={photos[idx]}
                      alt={captions[idx] || `Foto ${idx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onClick={() => setSelectedFullImage(photos[idx])} // Al hacer clic, abre pantalla completa
                    />

                    {/* Overlay visual de zoom en hover */}
                    <div
                      onClick={() => setSelectedFullImage(photos[idx])}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-auto"
                    >
                      <Maximize2 className="text-white drop-shadow-md animate-scale-up" size={18} />
                    </div>

                    {/* Botón de Eliminación Física (stopPropagation evita abrir la pantalla completa) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(idx);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md active:scale-90 z-20"
                      title="Eliminar esta foto"
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* Pie de foto editable (stopPropagation evita abrir la pantalla completa) */}
                    <input
                      type="text"
                      value={captions[idx] || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleCaptionChange(e.target.value, idx)}
                      onBlur={() => saveMetadata(captions)}
                      placeholder={`Descripción foto ${idx + 1}...`}
                      className="absolute bottom-0 left-0 right-0 bg-slate-950/90 border-t border-navy-900/60 text-slate-300 text-xs font-bold px-2 py-1.5 focus:outline-none focus:bg-slate-950 text-center z-20"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-500 group-hover:text-orange-400/80 transition-colors">
                    <Camera size={20} className="stroke-[1.5]" />
                    <span className="text-xs font-black tracking-widest uppercase text-[10px]">Subir Foto {idx + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 🖼️ MODAL LIGHTBOX DE PANTALLA COMPLETA */}
      {selectedFullImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setSelectedFullImage(null)}
        >
          <button
            className="absolute top-6 right-6 p-2.5 rounded-full bg-navy-900/80 hover:bg-navy-800 text-slate-300 hover:text-white transition-colors"
            onClick={() => setSelectedFullImage(null)}
          >
            <X size={24} />
          </button>
          <img
            src={selectedFullImage}
            alt="Vista completa"
            className="max-w-full max-h-[92vh] object-contain rounded-xl shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}