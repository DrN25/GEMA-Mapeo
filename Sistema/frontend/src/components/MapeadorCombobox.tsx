import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { User, Check, Plus, ChevronDown } from 'lucide-react';
import { markFieldTouched } from '../utils/qaQcTouch';

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8001`;

interface CatalogOption {
  codigo: string;
  nombre: string;
}

interface MapeadorComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options?: CatalogOption[];
  placeholder?: string;
  className?: string;
  inputId?: string;
}

export default function MapeadorCombobox({
  value,
  onChange,
  options: externalOptions,
  placeholder = 'Seleccionar o escribir mapeador...',
  className = '',
  inputId,
}: MapeadorComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [options, setOptions] = useState<CatalogOption[]>(externalOptions || []);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincronizar opciones externas o cargar del backend
  useEffect(() => {
    if (externalOptions && externalOptions.length > 0) {
      setOptions(externalOptions);
    } else {
      setLoading(true);
      fetch(`${API_BASE}/api/filtros/opciones`)
        .then(res => res.json())
        .then(data => {
          if (data.mapeadores) {
            setOptions(data.mapeadores);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [externalOptions]);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Actualizar posición del dropdown relativo al viewport
  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220)
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isOpen]);

  // Cerrar al hacer clic fuera del componente o del dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideContainer = containerRef.current && containerRef.current.contains(target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.nombre.toLowerCase().includes(query.toLowerCase()) ||
    opt.codigo.toLowerCase().includes(query.toLowerCase())
  );

  const exactMatch = options.some(opt =>
    opt.nombre.toLowerCase() === query.trim().toLowerCase() ||
    opt.codigo.toLowerCase() === query.trim().toLowerCase()
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setQuery(val);
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    const newName = query.trim().toUpperCase();
    if (!newName) return;
    
    if (!options.some(o => o.codigo === newName || o.nombre === newName)) {
      setOptions(prev => [...prev, { codigo: newName, nombre: newName }]);
    }
    
    try {
      await fetch(`${API_BASE}/api/geotecnicos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newName })
      });
    } catch (e) {
      // Backend creará automáticamente al guardar la celda
    }

    handleSelect(newName);
  };

  const dropdownMenu = isOpen && (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        zIndex: 99999,
      }}
      className="max-h-56 overflow-y-auto bg-navy-900 border border-navy-700/90 rounded-lg shadow-2xl py-1 text-xs animate-fade-in text-slate-100 backdrop-blur-md"
    >
      {filteredOptions.length > 0 ? (
        filteredOptions.map((opt) => {
          const isSelected = value === opt.nombre || value === opt.codigo;
          return (
            <div
              key={opt.codigo}
              onClick={() => handleSelect(opt.nombre)}
              className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                isSelected ? 'bg-indigo-600/30 text-indigo-300 font-bold' : 'text-slate-200 hover:bg-navy-800'
              }`}
            >
              <span className="truncate">{opt.nombre}</span>
              {isSelected && <Check size={13} className="text-indigo-400" />}
            </div>
          );
        })
      ) : (
        <div className="px-3 py-2 text-slate-500 text-[11px]">No se encontraron coincidencias.</div>
      )}

      {query.trim() && !exactMatch && (
        <div
          onClick={handleCreateNew}
          className="px-3 py-2 border-t border-navy-800/80 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <Plus size={13} className="text-indigo-400" />
          <span>Crear mapeador "<strong className="text-white">{query.trim().toUpperCase()}</strong>"</span>
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative">
        <User size={13} className="absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          id={inputId}
          value={query}
          onFocus={() => {
            updateCoords();
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            updateCoords();
            setIsOpen(true);
          }}
          onBlur={() => { if (inputId) markFieldTouched(inputId); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (query.trim()) {
                if (exactMatch) {
                  const match = options.find(o => o.nombre.toLowerCase() === query.trim().toLowerCase() || o.codigo.toLowerCase() === query.trim().toLowerCase());
                  if (match) handleSelect(match.nombre);
                } else {
                  handleCreateNew();
                }
              }
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          className="w-full bg-navy-950/80 border border-navy-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
        />
        <button
          type="button"
          onClick={() => {
            if (!isOpen) updateCoords();
            setIsOpen(!isOpen);
          }}
          className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && ReactDOM.createPortal(dropdownMenu, document.body)}
    </div>
  );
}
