
import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, Attachment } from '../types';
import { Badge, Button } from './UI';
import { X, Calendar, Clock, User, CheckCircle2, ArrowRightCircle, Circle, Paperclip, FileText, Film, Download, Eye, Edit, Flag } from 'lucide-react';
import { Lightbox } from './Lightbox';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onEdit }) => {
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const priority = task.priority || TaskPriority.MEDIUM;

  const statusConfig = {
    [TaskStatus.TODO]: { icon: Circle, color: 'text-slate-500', bg: 'bg-slate-100', text: 'Da Fare' },
    [TaskStatus.IN_PROGRESS]: { icon: ArrowRightCircle, color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'In Corso' },
    [TaskStatus.IN_WAITING]: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100', text: 'In Attesa' },
    [TaskStatus.DONE]: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', text: 'Completato' },
  };

  const priorityConfig: Record<TaskPriority, { color: string, bg: string, label: string }> = {
    [TaskPriority.HIGH]: { color: 'text-red-700', bg: 'bg-red-50', label: 'Alta Priorità' },
    [TaskPriority.MEDIUM]: { color: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Media Priorità' },
    [TaskPriority.LOW]: { color: 'text-blue-700', bg: 'bg-blue-50', label: 'Bassa Priorità' },
  };

  const StatusIcon = statusConfig[task.status].icon;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity backdrop-blur-sm" 
            onClick={onClose}
          ></div>

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

          <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
            
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
              <div className="pr-8">
                <div className="flex gap-2 mb-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusConfig[task.status].bg} ${statusConfig[task.status].color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {statusConfig[task.status].text}
                  </div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${priorityConfig[priority].bg} ${priorityConfig[priority].color}`}>
                    <Flag className="w-4 h-4" />
                    {priorityConfig[priority].label}
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                  {task.title}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-200 rounded-full p-2 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
              
              {/* Metadata Row */}
              <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Creato da <span className="font-medium text-slate-700">{task.ownerUsername || 'Utente'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Creato il {new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                {task.dueDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-400" />
                    <span className="text-red-600 font-medium">Scade il {new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">Descrizione</h3>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {task.description || <span className="italic text-slate-400">Nessuna descrizione fornita.</span>}
                </p>
              </div>

              {/* Tags */}
              {task.tags.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">Tag</h3>
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map(tag => (
                      <Badge key={tag} color="indigo" className="text-sm px-3 py-1">#{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments Grid */}
              {task.attachments && task.attachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" /> Allegati ({task.attachments.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {task.attachments.map(att => (
                      <div 
                        key={att.id} 
                        className="group relative aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden hover:shadow-md transition-all cursor-pointer"
                        onClick={() => setSelectedAttachment(att)}
                      >
                        {att.type === 'IMAGE' ? (
                          <img src={att.data} alt={att.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                            {att.type === 'VIDEO' ? (
                              <Film className="w-10 h-10 text-indigo-500 mb-2" />
                            ) : (
                              <FileText className="w-10 h-10 text-slate-400 mb-2" />
                            )}
                            <span className="text-xs font-medium text-slate-600 line-clamp-2">{att.name}</span>
                          </div>
                        )}
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                           <Eye className="text-white w-8 h-8 drop-shadow-lg transform scale-90 group-hover:scale-100 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose}>Chiudi</Button>
              <Button 
                variant="primary" 
                icon={Edit} 
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
              >
                Modifica Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {selectedAttachment && (
        <Lightbox 
          attachment={selectedAttachment} 
          onClose={() => setSelectedAttachment(null)} 
        />
      )}
    </>
  );
};