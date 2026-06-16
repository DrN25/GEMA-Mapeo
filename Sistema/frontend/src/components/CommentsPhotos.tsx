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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none text-left">
      {/* Tarjeta de observaciones */}
      <div className="lg:col-span-6 glass-panel p-6 rounded-xl border border-navy-800 space-y-3">
        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-800/60 pb-3 flex items-center gap-2">
          <MessageSquare size={16} className="text-orange-500" />
          <span>Comentarios del Registro</span>
        </h3>
        <div className="space-y-1">
          <label className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider block">Observaciones Generales</label>
          <textarea
            value={comentario || ''}
            onChange={(e) => onComentarioChange(e.target.value)}
            placeholder="Ingrese observaciones geomecánicas, condiciones del terreno, notas relevantes del mapeo de ventana..."
            className="w-full h-44 bg-navy-950 border border-navy-800 rounded-lg p-3.5 text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 font-medium resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Tarjeta de Fotografías */}
      <div className="lg:col-span-6 glass-panel p-6 rounded-xl border border-navy-800 space-y-4">
        <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-navy-800/60 pb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Camera size={16} className="text-orange-500" />
            <span>Fotografías (Hasta 4)</span>
          </span>
          {activePhotoCount < 4 && (
            <button
              onClick={addPhotoSlot}
              className="flex items-center gap-1 bg-navy-900 border border-navy-800 hover:bg-navy-850 hover:border-orange-500/30 text-orange-400 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>Agregar foto</span>
            </button>
          )}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((idx) => {
            const hasPhoto = !!photos[idx];

            return (
              <div
                key={idx}
                className="aspect-video relative bg-navy-950/60 border-2 border-dashed border-navy-850 hover:border-orange-500/40 rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer group transition-all"
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
                    {/* Visualizar Foto */}
                    <img
                      src={photos[idx]}
                      alt={captions[idx] || `Foto ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />

                    {/* Botón Eliminar en Hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(idx);
                      }}
                      className="absolute top-2.5 right-2.5 w-7 h-7 bg-red-600/90 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg active:scale-90"
                      title="Eliminar Foto"
                    >
                      <Trash2 size={14} />
                    </button>

                    {/* Pie de Foto editable */}
                    <input
                      type="text"
                      value={captions[idx] || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleCaptionChange(e.target.value, idx)}
                      placeholder={`Descripción foto ${idx + 1}...`}
                      className="absolute bottom-0 left-0 right-0 bg-slate-950/80 border-t border-navy-800/40 text-slate-200 text-xs font-bold px-3 py-1.5 focus:outline-none focus:bg-slate-950 text-center"
                    />
                  </>
                ) : (
                  /* Placeholder vacío */
                  <div className="flex flex-col items-center gap-1.5 text-slate-500 group-hover:text-orange-500 transition-colors">
                    <Camera size={20} />
                    <span className="text-xs font-black tracking-widest uppercase">Foto {idx + 1}</span>
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
