import React from 'react';
import { Camera, Trash2, Plus, MessageSquare } from 'lucide-react';

interface CommentsPhotosProps {
  comentario: string;
  onComentarioChange: (val: string) => void;
  photos: string[]; // list of base64 dataUrls
  captions: string[]; // list of captions corresponding to each photo
  onPhotosChange: (photos: string[], captions: string[]) => void;
}

export default function CommentsPhotos({
  comentario,
  onComentarioChange,
  photos,
  captions,
  onPhotosChange
}: CommentsPhotosProps) {

  const fileInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const updatedPhotos = [...photos];
      const updatedCaptions = [...captions];

      updatedPhotos[index] = base64;
      if (!updatedCaptions[index]) {
        updatedCaptions[index] = `Fotografía ${index + 1}`;
      }

      onPhotosChange(updatedPhotos, updatedCaptions);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = [...photos];
    const updatedCaptions = [...captions];

    updatedPhotos[index] = '';
    updatedCaptions[index] = '';

    onPhotosChange(updatedPhotos, updatedCaptions);

    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = '';
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

      {/* 💬 Tarjeta de Observaciones / Comentarios sin hueco muerto */}
      <div className="lg:col-span-6 glass-panel p-6 rounded-xl border border-navy-800 border-l-4 border-l-orange-500/80 bg-navy-950/10 flex flex-col h-full">
        <div className="space-y-2 mb-4">
          <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-900 pb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-orange-400" />
            <span>Comentarios del Registro</span>
          </h3>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            Ingrese anotaciones geomecánicas de la celda de mapeo, condiciones de agua subterránea, fracturamiento local o comentarios del terreno.
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

      {/* 📸 Tarjeta de Fotografías */}
      <div className="lg:col-span-6 glass-panel p-6 rounded-xl border border-navy-800 bg-navy-950/10 flex flex-col h-full justify-between">
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
                    />

                    {/* Botón de Eliminación Rápida */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(idx);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md active:scale-90"
                      title="Eliminar esta foto"
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* Leyenda/Pie de foto editable */}
                    <input
                      type="text"
                      value={captions[idx] || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleCaptionChange(e.target.value, idx)}
                      placeholder={`Descripción foto ${idx + 1}...`}
                      className="absolute bottom-0 left-0 right-0 bg-slate-950/90 border-t border-navy-900/60 text-slate-300 text-xs font-bold px-2 py-1.5 focus:outline-none focus:bg-slate-950 text-center"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-slate-500 group-hover:text-orange-400/80 transition-colors">
                    <Camera size={20} className="stroke-[1.5]" />
                    <span className="text-xs font-black tracking-widest uppercase">Subir Foto {idx + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}