
import React from 'react';
import { Project, Task, TaskStatus, UserRole } from '../types';
import { Card, Button } from './UI';
import { Briefcase, CheckCircle2, Trash2, Calendar, Archive, ExternalLink } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  tasks: Task[];
  currentUserRole?: UserRole; // Added role prop
  currentUserId: string;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED') => void;
  onClick: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, tasks, currentUserRole, currentUserId, onDelete, onUpdateStatus, onClick }) => {
  // Filtra task del progetto
  const projectTasks = tasks.filter(t => t.projectId === project.id || (t.projectIds && t.projectIds.includes(project.id)));
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter(t => t.status === TaskStatus.DONE).length;
  const hasPendingTasks = totalTasks > completedTasks;
  
  const isOwner = project.ownerId === currentUserId;
  const canDelete = isOwner || currentUserRole === UserRole.ADMIN;

  const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  
  const statusStyles = {
    ACTIVE: {
      border: 'border-slate-200',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      icon: Briefcase,
      opacity: 'opacity-100'
    },
    COMPLETED: {
      border: 'border-green-200 bg-green-50/30',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      icon: CheckCircle2,
      opacity: 'opacity-100'
    },
    ARCHIVED: {
      border: 'border-slate-100 bg-slate-50',
      iconBg: 'bg-slate-200',
      iconColor: 'text-slate-500',
      icon: Archive,
      opacity: 'opacity-75 grayscale'
    }
  };

  const currentStyle = statusStyles[project.status] || statusStyles.ACTIVE;
  const StatusIcon = currentStyle.icon;

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
    
    // VALIDAZIONE LOGICA
    if (newStatus === 'COMPLETED' && hasPendingTasks) {
      alert(`Non puoi completare il progetto "${project.title}" perché ha ancora ${totalTasks - completedTasks} task aperti.\nCompletali tutti o scegli "Archiviato".`);
      return; 
    }

    onUpdateStatus(project.id, newStatus);
  };

  return (
    <Card className={`flex flex-col h-full hover:shadow-lg transition-all cursor-pointer group ${currentStyle.border} ${currentStyle.opacity}`} >
      <div className="p-5 flex-1" onClick={() => onClick(project)}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${currentStyle.iconBg} ${currentStyle.iconColor}`}>
              <StatusIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 leading-tight group-hover:text-indigo-700 transition-colors">{project.title}</h3>
              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                 <Calendar className="w-3 h-3" />
                 {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
             <Button variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500 p-1 h-auto">
               <ExternalLink className="w-4 h-4" />
             </Button>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4 line-clamp-2 min-h-[2.5em]">
          {project.description || "Nessuna descrizione."}
        </p>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>Progresso</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${project.status === 'COMPLETED' || progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-xs text-slate-400 text-right">
            {completedTasks}/{totalTasks} task completati
          </div>
        </div>
      </div>
      
      <div className="bg-white/50 p-3 border-t border-slate-100 flex justify-between items-center text-xs" onClick={(e) => e.stopPropagation()}>
         <span className="font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
           Stato
         </span>
         
         <div className="flex items-center gap-2">
            <select 
               value={project.status}
               onChange={handleStatusChange}
               className={`px-2 py-1 rounded-md font-bold text-xs border-none focus:ring-1 focus:ring-indigo-500 cursor-pointer outline-none bg-transparent ${
                  project.status === 'COMPLETED' ? 'text-green-700' : 
                  project.status === 'ARCHIVED' ? 'text-slate-500' : 'text-indigo-700'
               }`}
            >
               <option value="ACTIVE">ATTIVO</option>
               <option value="COMPLETED">COMPLETATO</option>
               <option value="ARCHIVED">ARCHIVIATO</option>
            </select>
            {canDelete && (
              <Button variant="ghost" onClick={() => onDelete(project.id)} className="text-slate-300 hover:text-red-500 p-1 h-auto ml-2" title="Elimina Progetto">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
         </div>
      </div>
    </Card>
  );
};
