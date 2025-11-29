
import React, { useState, useEffect, useRef } from 'react';
import { Project, Task, TaskStatus } from '../types';
import { Button, Input, Textarea, Badge } from './UI';
import { X, CheckCircle2, Circle, ArrowRightCircle, Plus, Trash2, Save, LayoutGrid, Unlink, Edit, FolderPlus, Folder, Link as LinkIcon, Search } from 'lucide-react';
import { dataService } from '../services/dataService';

interface ProjectDetailModalProps {
  project: Project;
  allProjects: Project[]; // Passiamo tutti i progetti per cercare i sotto-progetti
  tasks: Task[]; // All tasks in the system (for linking)
  currentUser: any;
  onClose: () => void;
  onUpdateProject: (id: string, data: Partial<Project>) => void;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onEditTask: (task: Task) => void;
  onOpenSubProject: (project: Project) => void; // Per navigare
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ 
  project, 
  allProjects = [],
  tasks, 
  currentUser,
  onClose, 
  onUpdateProject, 
  onCreateTask,
  onEditTask,
  onOpenSubProject
}) => {
  // Stati per la modifica anagrafica
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDesc, setEditDesc] = useState(project.description || '');

  // Stato per nuovo task rapido (Create New)
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Stato per collegare task esistente (Link Existing)
  const [isLinkingTask, setIsLinkingTask] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkSuggestions, setLinkSuggestions] = useState<Task[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  // Stato per nuovo sotto-progetto
  const [isAddingSubProject, setIsAddingSubProject] = useState(false);
  const [newSubProjectTitle, setNewSubProjectTitle] = useState('');

  // Filtra i task di questo progetto (supporto multi-project array)
  const projectTasks = tasks.filter(t => 
    (t.projectIds && t.projectIds.includes(project.id)) || 
    t.projectId === project.id // fallback legacy
  );

  // Filtra i task DISPONIBILI per il collegamento (quelli non ancora in questo progetto)
  // Utilizzato per la ricerca
  const availableTasks = tasks.filter(t => 
    !projectTasks.some(pt => pt.id === t.id)
  );

  // Gestione ricerca task esistenti
  useEffect(() => {
    if (isLinkingTask && linkSearch.trim()) {
        const lowerSearch = linkSearch.toLowerCase();
        const results = availableTasks.filter(t => 
            t.title.toLowerCase().includes(lowerSearch) || 
            (t.tags && t.tags.some(tag => tag.toLowerCase().includes(lowerSearch)))
        ).slice(0, 10); // Limit results
        setLinkSuggestions(results);
    } else {
        setLinkSuggestions([]);
    }
  }, [linkSearch, isLinkingTask, tasks]); // Re-run when search changes

  // Filtra i sotto-progetti
  const subProjects = allProjects.filter(p => p.parentProjectId === project.id);
  
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
      ownerId: currentUser.id,
      sharedWith: [],
      attachments: [],
      projectIds: [project.id] // Collega a QUESTO progetto
    });

    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const handleLinkTask = async (taskToLink: Task) => {
    try {
        const currentProjectIds = taskToLink.projectIds || (taskToLink.projectId ? [taskToLink.projectId] : []);
        // Aggiungi questo progetto se non c'è già
        if (!currentProjectIds.includes(project.id)) {
            const newProjectIds = [...currentProjectIds, project.id];
            // Update usando dataService che gestisce anche il log
            await dataService.updateTask(taskToLink.id, { projectIds: newProjectIds } as any, currentUser, taskToLink.title);
        }
        setLinkSearch('');
        setIsLinkingTask(false);
    } catch (e) {
        console.error("Error linking task", e);
        alert("Errore nel collegamento del task.");
    }
  };

  const handleAddSubProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubProjectTitle.trim()) return;
    
    try {
        await dataService.createProject({
            title: newSubProjectTitle,
            parentProjectId: project.id // Gerarchia
        }, currentUser);
        setNewSubProjectTitle('');
        setIsAddingSubProject(false);
    } catch (e) {
        console.error(e);
    }
  };

  const handleUnlinkTask = async (taskId: string, taskTitle: string, currentProjectIds: string[] = []) => {
    if(confirm("Scollegare questo task da questo progetto? (Il task rimarrà in altri progetti se assegnato)")) {
        try {
            // Rimuovi questo ID progetto dall'array
            const newProjectIds = currentProjectIds.filter(id => id !== project.id);
            
            await dataService.updateTask(taskId, { projectIds: newProjectIds } as any, currentUser, taskTitle);
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
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl w-full">
          
          {/* Header */}
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
             <div className="flex items-center gap-3 flex-1">
                <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                   <LayoutGrid className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="w-full">
                   <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                       Dashboard Progetto {project.parentProjectId && <span className="text-indigo-400">(Sotto-progetto)</span>}
                   </h2>
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

          <div className="grid grid-cols-1 md:grid-cols-3 h-[650px]">
             
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
                   <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Avanzamento Task</label>
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
                   <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Sotto-Progetti</label>
                   <div className="space-y-2 mb-3">
                       {subProjects.length === 0 && <p className="text-xs text-slate-400 italic">Nessun sotto-progetto.</p>}
                       {subProjects.map(sp => (
                           <div 
                             key={sp.id} 
                             className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded cursor-pointer hover:border-indigo-300"
                             onClick={() => onOpenSubProject(sp)}
                           >
                               <Folder className="w-4 h-4 text-indigo-400" />
                               <span className="text-sm text-slate-700 truncate">{sp.title}</span>
                           </div>
                       ))}
                   </div>
                   
                   {!isAddingSubProject ? (
                        <Button variant="secondary" size="sm" className="w-full text-xs" icon={FolderPlus} onClick={() => setIsAddingSubProject(true)}>
                            Nuovo Sotto-Progetto
                        </Button>
                   ) : (
                       <form onSubmit={handleAddSubProject} className="flex gap-1">
                           <Input 
                             value={newSubProjectTitle} 
                             onChange={e => setNewSubProjectTitle(e.target.value)} 
                             placeholder="Nome..." 
                             className="text-xs h-8"
                             autoFocus
                           />
                           <Button type="submit" size="sm" className="h-8 px-2"><CheckCircle2 className="w-4 h-4"/></Button>
                           <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => setIsAddingSubProject(false)}><X className="w-4 h-4"/></Button>
                       </form>
                   )}
                </div>
             </div>

             {/* Right: Task List */}
             <div className="p-6 md:col-span-2 flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4 shrink-0 flex-wrap gap-2">
                   <h3 className="font-bold text-slate-800">Task del Progetto</h3>
                   <div className="flex gap-2">
                       {/* Button: Link Existing Task */}
                       {!isLinkingTask ? (
                           <Button variant="secondary" size="sm" icon={LinkIcon} onClick={() => setIsLinkingTask(true)}>
                               Collega Esistente
                           </Button>
                       ) : (
                           <div className="relative flex items-center gap-2 bg-white border border-indigo-200 rounded-lg p-1 shadow-sm animate-in slide-in-from-right-5">
                               <Search className="w-4 h-4 text-indigo-500 ml-2" />
                               <input 
                                   className="text-sm outline-none px-2 py-1 w-48"
                                   placeholder="Cerca task da collegare..."
                                   value={linkSearch}
                                   onChange={(e) => setLinkSearch(e.target.value)}
                                   autoFocus
                               />
                               <button onClick={() => { setIsLinkingTask(false); setLinkSearch(''); }} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-3 h-3 text-slate-400"/></button>
                               
                               {/* Dropdown Suggestions */}
                               {linkSuggestions.length > 0 && (
                                   <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 z-50 max-h-48 overflow-y-auto">
                                       {linkSuggestions.map(t => (
                                           <div 
                                               key={t.id}
                                               className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                                               onClick={() => handleLinkTask(t)}
                                           >
                                               <div className="text-sm font-medium text-slate-800">{t.title}</div>
                                               <div className="text-xs text-slate-500 flex gap-2">
                                                   <span>{t.ownerUsername}</span>
                                                   {t.status === 'DONE' && <span className="text-green-600">Completato</span>}
                                               </div>
                                           </div>
                                       ))}
                                   </div>
                               )}
                               {linkSearch && linkSuggestions.length === 0 && (
                                   <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 z-50 p-3 text-xs text-slate-400 text-center">
                                       Nessun task trovato
                                   </div>
                               )}
                           </div>
                       )}

                       {/* Button: Create New Task */}
                       <Button variant="primary" size="sm" icon={Plus} onClick={() => setIsAddingTask(true)}>
                          Crea Nuovo
                       </Button>
                   </div>
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
                                     {/* Show other projects if multiple */}
                                     {task.projectIds && task.projectIds.length > 1 && (
                                         <span className="text-indigo-400">• +{task.projectIds.length - 1} altri progetti</span>
                                     )}
                                  </div>
                               </div>
                            </div>
                            <Button 
                               variant="ghost" 
                               className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                               title="Scollega dal progetto"
                               onClick={(e) => {
                                 e.stopPropagation(); // Stop propagation to prevent opening edit modal
                                 handleUnlinkTask(task.id, task.title, task.projectIds);
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
