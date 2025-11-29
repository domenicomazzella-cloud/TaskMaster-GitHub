
import React, { useState, useEffect } from 'react';
import { Project, Task, TaskStatus } from '../types';
import { Button, Input, Textarea, Badge } from './UI';
import { X, CheckCircle2, Circle, ArrowRightCircle, Plus, Trash2, Save, LayoutGrid, Unlink, Edit } from 'lucide-react';
import { dataService } from '../services/dataService';

interface ProjectDetailModalProps {
  project: Project;
  tasks: Task[]; // Tutti i task (li filtriamo qui o passiamo già filtrati)
  currentUser: any;
  onClose: () => void;
  onUpdateProject: (id: string, data: Partial<Project>) => void;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onEditTask: (task: Task) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ 
  project, 
  tasks, 
  currentUser,
  onClose, 
  onUpdateProject, 
  onCreateTask,
  onEditTask 
}) => {
  // Stati per la modifica anagrafica
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDesc, setEditDesc] = useState(project.description || '');

  // Stato per nuovo task rapido
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Filtra i task di questo progetto
  const projectTasks = tasks.filter(t => t.projectId === project.id);
  
  // Calcolo statistiche
  const total = projectTasks.length;
  const completed = projectTasks.filter(t => t.status === TaskStatus.DONE).length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  const handleSaveDetails = () => {
    onUpdateProject(project.id, { title: editTitle, description: editDesc });
    setIsEditing(false);
  };

  const handleQuickAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    onCreateTask({
      title: newTaskTitle,
      description: '',
      tags: [],
      status: TaskStatus.TODO,
      priority: undefined,
      ownerId: currentUser.id, // Sarà sovrascritto dal service ma utile per il tipo
      sharedWith: [],
      attachments: [],
      projectId: project.id // FONDAMENTALE: Collega automaticamente al progetto
    });

    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const handleUnlinkTask = async (taskId: string, taskTitle: string) => {
    if(confirm("Scollegare questo task dal progetto? (Il task non verrà eliminato)")) {
        try {
            // Aggiorna il task rimuovendo il projectId
            await dataService.updateTask(taskId, { projectId: undefined } as any, currentUser, taskTitle);
        } catch (e) {
            console.error(e);
        }
    }
  };

  const statusIcon = {
    [TaskStatus.TODO]: <Circle className="w-4 h-4 text-slate-400" />,
    [TaskStatus.IN_PROGRESS]: <ArrowRightCircle className="w-4 h-4 text-amber-600" />,
    [TaskStatus.DONE]: <CheckCircle2 className="w-4 h-4 text-green-600" />,
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Backdrop */}
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity backdrop-blur-sm" onClick={onClose}></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        {/* Modal Panel */}
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl w-full">
          
          {/* Header */}
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
             <div className="flex items-center gap-3 flex-1">
                <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                   <LayoutGrid className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="w-full">
                   <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Dashboard Progetto</h2>
                   {!isEditing ? (
                      <div 
                        className="group flex items-center gap-2 cursor-pointer" 
                        onClick={() => setIsEditing(true)}
                        title="Clicca per modificare"
                      >
                         <h1 className="text-2xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{project.title}</h1>
                         <Edit className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                      </div>
                   ) : (
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-bold text-lg" autoFocus />
                   )}
                </div>
             </div>
             <div className="flex items-center gap-2 shrink-0 ml-4">
                {!isEditing ? (
                   <Button variant="ghost" onClick={() => setIsEditing(true)}>Modifica Dettagli</Button>
                ) : (
                   <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>Annulla</Button>
                      <Button variant="primary" size="sm" icon={Save} onClick={handleSaveDetails}>Salva</Button>
                   </div>
                )}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full p-2 ml-2 transition-all">
                   <X className="w-6 h-6" />
                </button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
             
             {/* Left: Info & Stats */}
             <div className="p-6 bg-slate-50/50 border-r border-slate-100 md:col-span-1 space-y-6 overflow-y-auto">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Descrizione</label>
                   {!isEditing ? (
                      <p className="text-slate-600 text-sm whitespace-pre-wrap cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => setIsEditing(true)}>
                         {project.description || <span className="italic text-slate-400">Nessuna descrizione. Clicca per aggiungere.</span>}
                      </p>
                   ) : (
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} />
                   )}
                </div>

                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Avanzamento</label>
                   <div className="flex items-end gap-2 mb-2">
                      <span className="text-3xl font-bold text-indigo-600">{progress}%</span>
                      <span className="text-sm text-slate-500 mb-1">completato</span>
                   </div>
                   <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                         className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                         style={{ width: `${progress}%` }}
                      ></div>
                   </div>
                   <div className="mt-2 text-xs text-slate-500 flex justify-between">
                      <span>{completed} Fatti</span>
                      <span>{total - completed} Rimanenti</span>
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                   <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Stato Progetto</label>
                   <Badge 
                      color={project.status === 'COMPLETED' ? 'green' : project.status === 'ARCHIVED' ? 'slate' : 'indigo'}
                      className="px-3 py-1 text-sm"
                   >
                      {project.status === 'ACTIVE' ? 'IN CORSO' : project.status}
                   </Badge>
                   {project.status === 'ACTIVE' && progress === 100 && (
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                         <CheckCircle2 className="w-3 h-3" /> Pronto per essere completato!
                      </p>
                   )}
                   {project.status === 'ACTIVE' && progress < 100 && (
                      <p className="text-xs text-amber-600 mt-2">
                         Completa tutti i task per chiudere il progetto.
                      </p>
                   )}
                </div>
             </div>

             {/* Right: Task List */}
             <div className="p-6 md:col-span-2 flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4 shrink-0">
                   <h3 className="font-bold text-slate-800">Task del Progetto</h3>
                   <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsAddingTask(true)}>
                      Aggiungi Task
                   </Button>
                </div>

                {isAddingTask && (
                   <form onSubmit={handleQuickAddTask} className="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex gap-2 animate-in slide-in-from-top-2">
                      <Input 
                         placeholder="Titolo nuovo task..." 
                         value={newTaskTitle} 
                         onChange={e => setNewTaskTitle(e.target.value)}
                         className="bg-white"
                         autoFocus
                      />
                      <Button type="submit" size="sm">Aggiungi</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingTask(false)}><X className="w-4 h-4" /></Button>
                   </form>
                )}

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                   {projectTasks.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                         <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-20" />
                         <p>Nessun task collegato.</p>
                      </div>
                   ) : (
                      projectTasks.map(task => (
                         <div 
                           key={task.id} 
                           onClick={() => onEditTask(task)} // Make clickable to edit
                           className="group flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
                         >
                            <div className="flex items-center gap-3">
                               <div>{statusIcon[task.status]}</div>
                               <div>
                                  <div className={`text-sm font-medium ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                     {task.title}
                                  </div>
                                  <div className="flex gap-2 text-[10px] text-slate-400">
                                     <span>{task.ownerUsername}</span>
                                     {task.dueDate && <span>• Scade: {new Date(task.dueDate).toLocaleDateString()}</span>}
                                  </div>
                               </div>
                            </div>
                            <Button 
                               variant="ghost" 
                               className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                               title="Scollega dal progetto"
                               onClick={(e) => {
                                 e.stopPropagation(); // Stop propagation to prevent opening edit modal
                                 handleUnlinkTask(task.id, task.title);
                               }}
                            >
                               <Unlink className="w-4 h-4" />
                            </Button>
                         </div>
                      ))
                   )}
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
