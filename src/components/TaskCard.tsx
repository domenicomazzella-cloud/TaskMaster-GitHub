
import React from 'react';
import { Task, TaskStatus, TaskPriority, UserRole } from '../types';
import { Badge } from './UI';
import { CheckCircle2, Circle, ArrowRightCircle, Trash2, Edit, Users, Paperclip, Film, FileText, Calendar, AlertCircle, Flag, Crown, Tag, LayoutGrid, Clock } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
  currentUserRole?: UserRole;
  projectNames?: string[]; 
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  handleStatusChange?: (task: Task, newStatus: TaskStatus) => void;
  onClick?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, currentUserId, currentUserRole, projectNames = [], onEdit, onDelete, onTagClick, handleStatusChange, onClick }) => {
  const isOwner = task.ownerId === currentUserId;
  const canDelete = isOwner || currentUserRole === UserRole.ADMIN;
  
  const attachments = task.attachments || [];
  const [isAnimating, setIsAnimating] = React.useState(false);
  const priority = task.priority || TaskPriority.MEDIUM; 

  const statusIcon = {
    [TaskStatus.TODO]: <Circle className="w-5 h-5 text-slate-400" />,
    [TaskStatus.IN_PROGRESS]: <ArrowRightCircle className="w-5 h-5 text-amber-600" />,
    [TaskStatus.IN_WAITING]: <Clock className="w-5 h-5 text-orange-500" />,
    [TaskStatus.DONE]: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
  };

  const statusText: Record<TaskStatus, string> = {
    [TaskStatus.TODO]: "DA FARE",
    [TaskStatus.IN_PROGRESS]: "IN CORSO",
    [TaskStatus.IN_WAITING]: "IN ATTESA",
    [TaskStatus.DONE]: "COMPLETATO",
  };

  const priorityTheme = {
    [TaskPriority.HIGH]: { 
      bg: 'bg-red-50/80', 
      borderLeft: 'border-l-red-500', 
      flagColor: 'text-red-600',
      badgeBg: 'bg-red-100',
      badgeBorder: 'border-red-200',
      hoverShadow: 'hover:shadow-red-100/50'
    },
    [TaskPriority.MEDIUM]: { 
      bg: 'bg-amber-50/80', 
      borderLeft: 'border-l-amber-500', 
      flagColor: 'text-amber-600',
      badgeBg: 'bg-amber-100',
      badgeBorder: 'border-amber-200',
      hoverShadow: 'hover:shadow-amber-100/50'
    },
    [TaskPriority.LOW]: { 
      bg: 'bg-slate-50', 
      borderLeft: 'border-l-indigo-400', 
      flagColor: 'text-indigo-500',
      badgeBg: 'bg-indigo-50',
      badgeBorder: 'border-indigo-100',
      hoverShadow: 'hover:shadow-indigo-100/50'
    },
  };

  const theme = priorityTheme[priority];

  const isDone = task.status === TaskStatus.DONE;
  const finalBg = isDone ? 'bg-slate-50/50 opacity-80' : theme.bg;
  const finalBorder = isDone ? 'border-l-slate-300' : theme.borderLeft;

  const handleQuickStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!handleStatusChange) return;

    let next = TaskStatus.TODO;
    if (task.status === TaskStatus.TODO) next = TaskStatus.IN_PROGRESS;
    else if (task.status === TaskStatus.IN_PROGRESS) next = TaskStatus.DONE;
    else if (task.status === TaskStatus.IN_WAITING) next = TaskStatus.IN_PROGRESS;
    
    if (next === TaskStatus.DONE) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }

    handleStatusChange(task, next);
  };

  const getTagIcon = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.includes('bug')) return '🐞';
    if (lower.includes('feature')) return '✨';
    if (lower.includes('urgente')) return '🔥';
    return '🏷️';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const priorityLabels = {
    [TaskPriority.HIGH]: 'Alta',
    [TaskPriority.MEDIUM]: 'Media',
    [TaskPriority.LOW]: 'Bassa',
  };

  return (
    <div 
      onClick={() => onClick && onClick(task)}
      className={`
        group relative p-5 rounded-r-xl rounded-l-md border border-slate-200 border-l-4
        flex flex-col h-full cursor-pointer
        transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        shadow-sm hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1
        ${finalBg} ${finalBorder} ${theme.hoverShadow}
        ${isAnimating ? 'scale-105 ring-2 ring-green-400 bg-green-50 !shadow-none' : ''}
      `}
    >
      
      {/* Tooltip Stats */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-100 pointer-events-none z-20 flex flex-col items-center">
        <div className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-slate-300" />
            <span>{attachments.length}</span>
          </div>
          <div className="w-px h-3 bg-slate-600"></div>
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-300" />
            <span>{task.tags.length}</span>
          </div>
        </div>
        <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1"></div>
      </div>

      {/* Header Row: Status, Priority & Actions */}
      <div className="flex justify-between items-start mb-2 mt-1 relative z-10">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleQuickStatus}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none bg-white/60 px-2.5 py-1 rounded-full border border-slate-100/50 shadow-sm"
            title="Clicca per cambiare stato"
          >
            {statusIcon[task.status]}
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {statusText[task.status]}
            </span>
          </button>
          
          {priority && (
            <div 
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                isDone 
                  ? 'bg-slate-100 text-slate-400 border-slate-200' 
                  : `${theme.badgeBg} ${theme.flagColor} ${theme.badgeBorder}`
              }`} 
            >
              <Flag className={`w-3 h-3 ${isDone ? 'text-slate-400' : 'fill-current'}`} />
              <span className="uppercase tracking-wider hidden sm:inline-block">
                {priorityLabels[priority]}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
            className="p-1.5 bg-white/60 hover:bg-white rounded-full text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
            title="Modifica"
          >
            <Edit className="w-4 h-4" />
          </button>
          {canDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="p-1.5 bg-white/60 hover:bg-white rounded-full text-slate-400 hover:text-red-600 transition-colors shadow-sm"
              title="Elimina (Admin/Proprietario)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Project Badges (Multiple) */}
      {projectNames && projectNames.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {projectNames.map((name, idx) => (
            <Badge key={idx} color="indigo" className="text-[10px] uppercase tracking-wider pl-1.5">
               <LayoutGrid className="w-3 h-3 mr-1" /> {name}
            </Badge>
          ))}
        </div>
      )}

      {/* Title & Description */}
      <h3 className={`text-lg font-bold text-slate-800 mb-2 transition-colors group-hover:text-indigo-800 leading-tight ${isDone ? 'line-through text-slate-500' : ''}`}>
        {task.title}
      </h3>
      
      {task.description && (
        <p className={`text-sm text-slate-600 mb-4 line-clamp-3 flex-grow leading-relaxed ${isDone ? 'line-through opacity-70' : ''}`}>
          {task.description}
        </p>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-2 overflow-hidden py-1 pl-1">
            {attachments.slice(0, 3).map((att) => (
              <div 
                key={att.id} 
                className="w-10 h-10 rounded-lg border border-slate-200 bg-white shadow-sm flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-200 hover:border-indigo-400 hover:shadow-md hover:scale-110 hover:z-10 relative group/att" 
                title={att.name}
              >
                {att.type === 'IMAGE' ? (
                  <img src={att.data} alt={att.name} className="w-full h-full object-cover" />
                ) : att.type === 'VIDEO' ? (
                  <Film className="w-5 h-5 text-indigo-500" />
                ) : (
                  <FileText className="w-5 h-5 text-slate-500" />
                )}
              </div>
            ))}
            {attachments.length > 3 && (
              <div className="w-10 h-10 rounded-lg border border-slate-200 bg-white/50 flex items-center justify-center text-xs font-bold text-slate-500">
                +{attachments.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Area: Tags, Dates, People */}
      <div className="mt-auto flex flex-col gap-3">
        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map(tag => (
              <Badge 
                key={tag} 
                color="slate" 
                className="bg-white/60 hover:bg-white text-slate-700 border-slate-200/60 hover:border-indigo-200 transition-colors pl-1.5 cursor-pointer shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(tag);
                }}
              >
                <span className="mr-1 opacity-70">{getTagIcon(tag)}</span> {tag}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Info Grid (Dates & People) - Flex Wrap for Mobile */}
        <div className="flex flex-wrap items-end justify-between pt-3 border-t border-slate-200/50 gap-2">
          
          {/* Left: Dates */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center text-[10px] text-slate-500 font-medium" title={`Creato il ${new Date(task.createdAt).toLocaleDateString()}`}>
              <Calendar className="w-3 h-3 mr-1.5 opacity-60" />
              {formatDate(task.createdAt)}
            </div>
            
            {task.dueDate && !isDone && (
               <div className={`flex items-center text-[10px] font-bold ${new Date(task.dueDate) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                 <AlertCircle className="w-3 h-3 mr-1.5" />
                 {formatDate(task.dueDate)}
               </div>
            )}
          </div>

          {/* Right: People (Owner & Shared) */}
          <div className="flex flex-col items-end gap-1.5 ml-auto">
             {!isOwner && (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border-amber-200 shadow-sm ring-1 ring-amber-200/50" title="Proprietario del task">
                  <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                  {task.ownerUsername || 'Proprietario'}
               </div>
             )}

             {task.sharedWith && task.sharedWith.length > 0 && (
               <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500" title={`Condiviso con ${task.sharedWith.length} utenti`}>
                 <Users className="w-3 h-3" />
                 +{task.sharedWith.length}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
