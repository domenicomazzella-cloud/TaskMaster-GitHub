
import React from 'react';
import { Attachment } from '../types';
import { X, Download, FileText, Film } from 'lucide-react';

interface LightboxProps {
  attachment: Attachment;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ attachment, onClose }) => {
  // Gestione chiusura con tasto ESC
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animation-fade-in">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all"
      >
        <X className="w-8 h-8" />
      </button>

      <div className="max-w-7xl max-h-[90vh] w-full flex flex-col items-center justify-center">
        
        {attachment.type === 'IMAGE' ? (
          <img 
            src={attachment.data} 
            alt={attachment.name} 
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        ) : attachment.type === 'VIDEO' ? (
          <video 
            src={attachment.data} 
            controls 
            autoPlay 
            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
          />
        ) : (
          <div className="bg-white p-12 rounded-2xl flex flex-col items-center text-slate-800">
            <FileText className="w-24 h-24 text-slate-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">{attachment.name}</h3>
            <p className="text-slate-500">Anteprima non disponibile per questo tipo di file.</p>
          </div>
        )}

        <div className="mt-6 flex items-center gap-4">
          <span className="text-white font-medium text-lg drop-shadow-md">{attachment.name}</span>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-full font-medium hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" /> Scarica
          </button>
        </div>
      </div>
    </div>
  );
};
