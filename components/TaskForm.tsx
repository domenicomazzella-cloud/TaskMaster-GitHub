
import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority, User, Attachment, Project } from '../types';
import { suggestTagsWithGemini } from '../services/geminiService';
import { authService } from '../services/authService';
import { Button, Input, Textarea, Badge } from './UI';
import { Sparkles, Plus, Users, UserPlus, Paperclip, Film, FileText, X, Calendar as CalendarIcon, Hash, Briefcase, LayoutGrid } from 'lucide-react';

interface TaskFormProps {
  initialTask?: Task | null;
  currentUser: User;
  existingTags?: string[];
  projects?: Project[];
  onSubmit: (task: Omit<Task, 'id' | 'createdAt'> | Task) => void;
  onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ initialTask, currentUser, existingTags = [], projects = [], onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [tags, setTags] = useState<string[]>(initialTask?.tags || []);
  const [status, setStatus] = useState<TaskStatus>(initialTask?.status || TaskStatus.TODO);
  const [priority, setPriority] = useState<TaskPriority>(initialTask?.priority || TaskPriority.MEDIUM);
  const [dueDate, setDueDate] = useState(initialTask?.dueDate || '');
  const [attachments, setAttachments] = useState<Attachment[]>(initialTask?.attachments || []);
  
  // Multi-Project State
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    initialTask?.projectIds || (initialTask?.projectId ? [initialTask.projectId] : [])
  );
  
  const [tagInput, setTagInput] = useState('');
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  
  // Sharing state
  const [sharedWithIds, setSharedWithIds] = useState<string[]>(initialTask?.sharedWith || []);
  const [shareInput, setShareInput] = useState('');
  const [shareSuggestions, setShareSuggestions] = useState<User[]>([]);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [sharedUsernames, setSharedUsernames] = useState<Record<string, string>>({}); // Cache for display

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Check if we are in "edit" mode vs "create" mode
  const isEdit = !!initialTask;
  const isOwner = !initialTask || initialTask.ownerId === currentUser.id;

  // Carica i nomi degli utenti condivisi all'avvio (solo visualizzazione)
  useEffect(() => {
    const loadUsernames = async () => {
      const mapping: Record<string, string> = {};
      for (const id of sharedWithIds) {
        if (!sharedUsernames[id]) {
          mapping[id] = await authService.getUsernameById(id);
        }
      }
      if (Object.keys(mapping).length > 0) {
        setSharedUsernames(prev => ({...prev, ...mapping}));
      }
    };
    if (sharedWithIds.length > 0) loadUsernames();
  }, [sharedWithIds]);

  // Gestione ricerca utenti in tempo reale
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (shareInput.trim().length > 0) {
        const results = await authService.searchUsers(shareInput);
        // Filtra: rimuovi me stesso e chi è già condiviso
        const filtered = results.filter(u => 
          u.id !== currentUser.id && !sharedWithIds.includes(u.id)
        );
        setShareSuggestions(filtered);
        setShowShareDropdown(true);
      } else {
        setShareSuggestions([]);
        setShowShareDropdown(false);
      }
    }, 300); // Debounce di 300ms

    return () => clearTimeout(searchTimer);
  }, [shareInput, sharedWithIds, currentUser.id]);

  // Chiudi dropdown se clicco fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowShareDropdown(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleAddSuggestedTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
      setShowTagSuggestions(false);
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

  const handleSelectUser = (user: User) => {
    setSharedWithIds([...sharedWithIds, user.id]);
    setSharedUsernames(prev => ({...prev, [user.id]: user.username}));
    setShareInput('');
    setShowShareDropdown(false);
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
          alert(`Il file "${file.name}" è troppo grande (>300KB). Firestore ha limiti severi. Usa file piccoli.`);
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
      
      const currentSize = attachments.reduce((acc, curr) => acc + curr.size, 0);
      const newSize = newAttachments.reduce((acc, curr) => acc + curr.size, 0);
      
      if (currentSize + newSize > 800 * 1024) {
        alert("Attenzione: La dimensione totale degli allegati supera il limite di sicurezza (800KB). Alcuni file potrebbero non essere salvati.");
      }

      setAttachments(prev => [...prev, ...newAttachments]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleProjectToggle = (projectId: string) => {
    if (projectId === '') {
        // Nessun progetto
        setSelectedProjectIds([]);
        return;
    }
    if (selectedProjectIds.includes(projectId)) {
        setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
    } else {
        setSelectedProjectIds(prev => [...prev, projectId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Prevenzione doppio invio
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
      projectId: undefined // Ensure legacy field is cleared
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

  // Filter suggested tags
  const tagSuggestions = existingTags.filter(t => 
    t.toLowerCase().includes(tagInput.toLowerCase()) && 
    !tags.includes(t)
  );

  const statusLabels: Record<TaskStatus, string> = {
    [TaskStatus.TODO]: 'Da fare',
    [TaskStatus.IN_PROGRESS]: 'In corso',
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
                {selectedProjectIds.length === 0 && (
                    <span className="text-xs text-slate-400 italic">Nessun progetto selezionato</span>
                )}
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
                        e.target.value = ''; // Reset select
                    }
                }}
                value=""
            >
                <option value="" disabled>Aggiungi a un progetto...</option>
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
            <div className="flex gap-2">
              {(Object.values(TaskStatus) as TaskStatus[]).map((s) => (
                <label 
                  key={s} 
                  className={`
                    flex-1 cursor-pointer border rounded-lg px-2 py-2 text-center text-xs font-medium transition-all
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
                
                {att.type !== 'IMAGE' && (
                  <span className="absolute bottom-1 text-[9px] text-slate-500 w-full text-center px-1 truncate">
                    {att.name}
                  </span>
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

        {/* Tags Section */}
        <div className="relative" ref={tagDropdownRef}>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tag</label>
          <div className="flex gap-2 mb-2">
            <Input 
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowTagSuggestions(true);
              }}
              onFocus={() => {
                if (tagInput && tagSuggestions.length > 0) setShowTagSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Aggiungi tag..."
              className="flex-1"
              autoComplete="off"
            />
            <Button type="button" variant="secondary" onClick={handleAddTag} icon={Plus} disabled={!tagInput.trim()}>Agg.</Button>
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
          
          {/* Tag Suggestions Dropdown */}
          {showTagSuggestions && tagInput && tagSuggestions.length > 0 && (
            <div className="absolute z-20 top-[74px] left-0 w-full md:w-2/3 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {tagSuggestions.map((tag, index) => (
                <div 
                  key={index}
                  className="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex items-center gap-2 text-sm text-slate-700"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleAddSuggestedTag(tag);
                  }}
                >
                  <Hash className="w-3 h-3 text-slate-400" />
                  {tag}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {tags.map(tag => (
              <Badge key={tag} onRemove={() => handleRemoveTag(tag)} color="indigo">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Share Section - Only Owner can manage shares */}
        {isOwner && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200" ref={dropdownRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
              <Users className="w-4 h-4" /> Condividi con altri
            </label>
            <div className="relative mb-2">
              <Input 
                value={shareInput}
                onChange={(e) => {
                   setShareInput(e.target.value);
                   // Se svuoto l'input, chiudo dropdown
                   if (e.target.value.length === 0) setShowShareDropdown(false);
                }}
                onFocus={() => {
                  if (shareInput.length > 0 && shareSuggestions.length > 0) setShowShareDropdown(true);
                }}
                placeholder="Cerca utente per nome o email..."
                className="flex-1 bg-white w-full"
                icon={UserPlus}
              />
              
              {/* Dropdown dei suggerimenti */}
              {showShareDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {shareSuggestions.length > 0 ? (
                    shareSuggestions.map(user => (
                      <div 
                        key={user.id}
                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0"
                        onMouseDown={() => handleSelectUser(user)} // onMouseDown fires before Input blur
                      >
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                             {user.username.charAt(0).toUpperCase()}
                           </div>
                           <div className="flex flex-col">
                             <span className="text-sm font-medium text-slate-800">{user.username}</span>
                             <span className="text-xs text-slate-500">{user.email}</span>
                           </div>
                        </div>
                        <Plus className="w-4 h-4 text-slate-400" />
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">Nessun utente trovato</div>
                  )}
                </div>
              )}
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
