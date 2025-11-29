
import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, User, Attachment, Project } from '../types';
import { suggestTagsWithGemini } from '../services/geminiService';
import { authService } from '../services/authService';
import { Button, Input, Textarea, Badge, Autocomplete } from './UI';
import { Sparkles, Plus, Users, Paperclip, Film, FileText, X, Calendar as CalendarIcon, Hash, Briefcase } from 'lucide-react';

interface TaskFormProps {
  initialTask?: Task | null;
  currentUser: User;
  existingTags?: string[];
  projects?: Project[];
  initialProjectIds?: string[]; // New prop for pre-selection
  onSubmit: (task: Omit<Task, 'id' | 'createdAt'> | Task) => void;
  onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  initialTask, 
  currentUser, 
  existingTags = [], 
  projects = [], 
  initialProjectIds = [], 
  onSubmit, 
  onCancel 
}) => {
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [tags, setTags] = useState<string[]>(initialTask?.tags || []);
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status || TaskStatus.TODO);
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || TaskPriority.MEDIUM);
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || '');
  const [attachments, setAttachments] = useState<Attachment[]>(initialTask?.attachments || []);
  
  // Multi-Project State - Initialize with prop if available
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    initialTask?.projectIds || 
    (initialTask?.projectId ? [initialTask.projectId] : []) || 
    initialProjectIds
  );
  
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Sharing state
  const [sharedWithIds, setSharedWithIds] = useState<string[]>(initialTask?.sharedWith || []);
  const [sharedUsernames, setSharedUsernames] = useState<Record<string, string>>({}); 

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initialTask;
  // Owner OR Admin can share
  const canShare = !initialTask || initialTask.ownerId === currentUser.id || currentUser.role === 'ADMIN';

  // Load Users for Sharing Autocomplete
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await authService.getAllUsers();
        setAllUsers(users);
        
        // Populate username cache for badges
        const mapping: Record<string, string> = {};
        users.forEach(u => {
            mapping[u.id] = u.username;
        });
        setSharedUsernames(mapping);
      } catch (e) {
        console.error("Error loading users", e);
      }
    };
    fetchUsers();
  }, []);

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      setTags([...tags, tag.trim()]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleGeminiSuggest = async () => {
    if (!title) return;
    setIsGeneratingTags(true);
    try {
      const suggestedTags = await suggestTagsWithGemini({ title, description });
      const newTags = Array.from(new Set([...tags, ...suggestedTags]));
      setTags(newTags);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleSelectUser = (userId: string) => {
    if (!sharedWithIds.includes(userId)) {
        setSharedWithIds([...sharedWithIds, userId]);
    }
  };

  const handleRemoveShare = (userId: string) => {
    setSharedWithIds(sharedWithIds.filter(id => id !== userId));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAttachments: Attachment[] = [];
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        
        if (file.size > 300 * 1024) {
          alert(`Il file "${file.name}" è troppo grande (>300KB).`);
          continue;
        }

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        let type: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
        if (file.type.startsWith('image/')) type = 'IMAGE';
        else if (file.type.startsWith('video/')) type = 'VIDEO';

        const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

        newAttachments.push({
          id: uuid,
          name: file.name,
          size: file.size,
          type,
          data: base64
        });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleProjectToggle = (projectId: string) => {
    if (projectId === '') return;
    if (selectedProjectIds.includes(projectId)) {
        setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
    } else {
        setSelectedProjectIds(prev => [...prev, projectId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const submitBtn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement;
    if(submitBtn) submitBtn.disabled = true;

    const taskData = {
      title,
      description,
      tags,
      status,
      priority,
      dueDate,
      attachments,
      ownerId: initialTask ? initialTask.ownerId : currentUser.id,
      sharedWith: sharedWithIds,
      projectIds: selectedProjectIds,
      projectId: undefined
    };

    if (isEdit && initialTask) {
      onSubmit({
        ...initialTask,
        ...taskData
      });
    } else {
      onSubmit(taskData);
    }
  };

  const statusLabels: Record<TaskStatus, string> = {
    [TaskStatus.TODO]: 'Da fare',
    [TaskStatus.IN_PROGRESS]: 'In corso',
    [TaskStatus.IN_WAITING]: 'In Attesa',
    [TaskStatus.DONE]: 'Completato',
  };

  const priorityConfig: Record<TaskPriority, { label: string, color: string }> = {
    [TaskPriority.LOW]: { label: 'Bassa', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    [TaskPriority.MEDIUM]: { label: 'Media', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    [TaskPriority.HIGH]: { label: 'Alta', color: 'bg-red-50 text-red-700 border-red-200' },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input 
          label="Titolo" 
          placeholder="Cosa devi fare?" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />
        
        <Textarea 
          label="Descrizione" 
          placeholder="Aggiungi dettagli..." 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        
        {/* Multi-Project Selector */}
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Progetti (Task Madre)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
                {selectedProjectIds.map(pid => {
                    const proj = projects.find(p => p.id === pid);
                    return (
                        <Badge key={pid} color="indigo" onRemove={() => handleProjectToggle(pid)}>
                            {proj?.title || 'Progetto Sconosciuto'}
                        </Badge>
                    );
                })}
            </div>
            
            <select 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                onChange={(e) => {
                    if (e.target.value) {
                        handleProjectToggle(e.target.value);
                        e.target.value = '';
                    }
                }}
            >
                <option value="">Aggiungi a un progetto...</option>
                {projects
                    .filter(p => !selectedProjectIds.includes(p.id))
                    .map(p => (
                    <option key={p.id} value={p.id}>
                        {p.title}
                    </option>
                ))}
            </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stato</label>
            <div className="flex gap-1 overflow-x-auto">
              {(Object.values(TaskStatus) as TaskStatus[]).map((s) => (
                <label 
                  key={s} 
                  className={`
                    flex-1 cursor-pointer border rounded-lg px-2 py-2 text-center text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap
                    ${status === s 
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' 
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                    }
                  `}
                >
                  <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
                  {statusLabels[s]}
                </label>
              ))}
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Priorità</label>
             <div className="flex gap-2">
              {(Object.values(TaskPriority) as TaskPriority[]).map((p) => (
                <label 
                  key={p}
                  className={`
                    flex-1 cursor-pointer border rounded-lg px-2 py-2 text-center text-xs font-medium transition-all
                    ${priority === p
                      ? `ring-1 ${priorityConfig[p].color} border-current`
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                    }
                  `}
                >
                  <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} className="sr-only" />
                  {priorityConfig[p].label}
                </label>
              ))}
             </div>
          </div>
        </div>
        
        <div className="w-full">
            <Input 
              label="Scadenza (Opzionale)"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              icon={CalendarIcon}
            />
        </div>

        {/* Attachments Section */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <Paperclip className="w-4 h-4" /> Allegati
          </label>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            multiple 
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          />

          <div className="flex flex-wrap gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => fileInputRef.current?.click()}
              icon={Paperclip}
              className="h-24 w-24 flex flex-col items-center justify-center gap-2 border-dashed border-2 text-xs"
            >
              Carica
            </Button>

            {attachments.map(att => (
              <div key={att.id} className="relative group w-24 h-24 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                {att.type === 'IMAGE' ? (
                  <img src={att.data} alt={att.name} className="w-full h-full object-cover" />
                ) : att.type === 'VIDEO' ? (
                  <Film className="w-8 h-8 text-indigo-400" />
                ) : (
                  <FileText className="w-8 h-8 text-slate-400" />
                )}
                
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="absolute top-1 right-1 bg-white/90 rounded-full p-1 text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tags Section with Autocomplete */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Tag</label>
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <Autocomplete
                placeholder="Aggiungi tag..."
                options={existingTags.map(t => ({ label: t, value: t }))}
                onSelect={(val) => handleAddTag(val)}
                onCreate={(val) => handleAddTag(val)}
                className="w-full"
              />
            </div>
            <Button 
              type="button" 
              variant="primary" 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 border-none text-white shadow-md"
              onClick={handleGeminiSuggest}
              isLoading={isGeneratingTags}
              disabled={!title.trim()}
              icon={Sparkles}
            >
              AI
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {tags.map(tag => (
              <Badge key={tag} onRemove={() => handleRemoveTag(tag)} color="indigo">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Share Section - With Autocomplete */}
        {canShare && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <Users className="w-4 h-4" /> Condividi con altri
            </label>
            <div className="relative mb-2">
              <Autocomplete
                placeholder="Cerca utente per nome o email..."
                options={allUsers
                  .filter(u => u.id !== currentUser.id && !sharedWithIds.includes(u.id))
                  .map(u => ({ label: `${u.username} (${u.email})`, value: u.id }))}
                onSelect={handleSelectUser}
                className="w-full bg-white"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {sharedWithIds.length === 0 && <span className="text-xs text-slate-400">Task privato</span>}
              {sharedWithIds.map(userId => (
                <Badge key={userId} onRemove={() => handleRemoveShare(userId)} color="green">
                  @{sharedUsernames[userId] || 'Caricamento...'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button type="button" variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button type="submit" variant="primary">{isEdit ? 'Salva Modifiche' : 'Crea Task'}</Button>
      </div>
    </form>
  );
};
