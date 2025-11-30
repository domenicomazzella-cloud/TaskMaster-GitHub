
import React, { useState } from 'react';
import { Project, Task, User } from '../types';
import { ProjectCard } from './ProjectCard';
import { ProjectDetailModal } from './ProjectDetailModal';
import { Button, Input, Textarea } from './UI';
import { Plus, LayoutGrid, CornerDownRight } from 'lucide-react';
import { dataService } from '../services/dataService';

interface ProjectListProps {
  projects: Project[];
  tasks: Task[];
  currentUser: User;
  allUsers: User[]; // New prop
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onEditTask: (task: Task) => void;
  onOpenCreateTask: (projectId?: string) => void; 
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, tasks, currentUser, allUsers, onCreateTask, onEditTask, onOpenCreateTask }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await dataService.createProject({ title, description: desc }, currentUser);
      setIsCreating(false);
      setTitle('');
      setDesc('');
    } catch (e) {
      alert("Errore creazione progetto");
    }
  };

  const handleDelete = async (id: string, projectTitle: string) => {
    if (confirm("Sei sicuro di voler eliminare questo progetto? I task rimarranno ma non saranno più collegati.")) {
      await dataService.deleteProject(id, currentUser, projectTitle);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED', projectTitle: string) => {
    try {
      await dataService.updateProject(id, { status }, currentUser, projectTitle);
    } catch (e) {
      console.error("Failed to update project status", e);
    }
  };

  const handleUpdateDetails = async (id: string, updates: Partial<Project>) => {
    const currentTitle = projects.find(p => p.id === id)?.title || "Progetto";
    await dataService.updateProject(id, updates, currentUser, updates.title || currentTitle);
    
    if (selectedProject && selectedProject.id === id) {
       setSelectedProject(prev => prev ? ({ ...prev, ...updates }) : null);
    }
  };

  const rootProjects = projects.filter(p => !p.parentProjectId).sort((a, b) => {
    const order = { ACTIVE: 0, COMPLETED: 1, ARCHIVED: 2 };
    return (order[a.status] || 0) - (order[b.status] || 0);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
             <LayoutGrid className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">I Tuoi Progetti (Task Madre)</h2>
            <p className="text-sm text-slate-500">Raggruppa i tuoi task in obiettivi più grandi.</p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)} icon={Plus}>
          Nuovo Progetto
        </Button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-lg animate-in fade-in slide-in-from-top-2">
          <h3 className="font-bold text-lg mb-4">Crea Nuovo Progetto</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input 
              label="Titolo Progetto" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="es. Ristrutturazione Sito Web"
              autoFocus
              required
            />
            <Textarea 
              label="Descrizione" 
              value={desc} 
              onChange={e => setDesc(e.target.value)} 
              placeholder="Descrivi l'obiettivo finale..."
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIsCreating(false)}>Annulla</Button>
              <Button type="submit">Crea Progetto</Button>
            </div>
          </form>
        </div>
      )}

      {rootProjects.length === 0 && !isCreating ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500">Non hai ancora creato nessun progetto principale.</p>
          <Button variant="ghost" onClick={() => setIsCreating(true)} className="mt-2 text-indigo-600">Inizia ora</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rootProjects.map(proj => {
             const subCount = projects.filter(p => p.parentProjectId === proj.id).length;
             return (
                <div key={proj.id} className="relative">
                    <ProjectCard 
                    project={proj} 
                    tasks={tasks}
                    currentUserRole={currentUser.role}
                    currentUserId={currentUser.id}
                    onDelete={() => handleDelete(proj.id, proj.title)}
                    onUpdateStatus={(id, s) => handleUpdateStatus(id, s, proj.title)}
                    onClick={(p) => setSelectedProject(p)}
                    />
                    {subCount > 0 && (
                        <div className="absolute -bottom-2 right-4 bg-white border border-slate-200 text-[10px] px-2 py-0.5 rounded-full shadow-sm text-slate-500 flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3" />
                            {subCount} Sotto-progetti
                        </div>
                    )}
                </div>
             );
          })}
        </div>
      )}

      {selectedProject && (
        <ProjectDetailModal 
           project={selectedProject}
           allProjects={projects}
           tasks={tasks}
           currentUser={currentUser}
           allUsers={allUsers} // Pass allUsers for lookup
           onClose={() => setSelectedProject(null)}
           onUpdateProject={handleUpdateDetails}
           onCreateTask={onCreateTask}
           onEditTask={onEditTask} 
           onOpenCreateTask={onOpenCreateTask}
           onOpenSubProject={(sub) => setSelectedProject(sub)}
        />
      )}
    </div>
  );
};
