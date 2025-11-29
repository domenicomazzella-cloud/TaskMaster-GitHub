
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, TaskStatus, User, UserRole, Team, Project } from './types';
import { TaskForm } from './components/TaskForm';
import { TaskCard } from './components/TaskCard';
import { TaskDetailModal } from './components/TaskDetailModal';
import { CalendarView } from './components/CalendarView';
import { ActivityLog } from './components/ActivityLog';
import { ProjectList } from './components/ProjectList';
import { Button, Badge, Select } from './components/UI';
import { Auth } from './components/Auth';
import { AdminPanel } from './components/AdminPanel';
import { authService } from './services/authService';
import { dataService } from './services/dataService';
import { notificationService } from './services/notificationService';
import { isFirebaseConfigured } from './firebase';
import { Plus, Search, Filter, X, Layout, List, LogOut, ShieldCheck, CheckSquare, Tag, Calendar as CalendarIcon, Bell, BellOff, History, KeyRound, Users, Share2, LayoutGrid } from 'lucide-react';

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]); 

  // --- Task & Project State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const prevTasksRef = useRef<Task[]>([]); 
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null); 
  const [showLogs, setShowLogs] = useState(false); 
  const [showPwdModal, setShowPwdModal] = useState(false); 
  const [newPassword, setNewPassword] = useState('');
  
  // Navigation & Views
  const [activeTab, setActiveTab] = useState<'TASKS' | 'PROJECTS' | 'ADMIN'>('TASKS');
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [viewFilter, setViewFilter] = useState<'ALL' | 'MINE' | 'SHARED' | 'SHARED_BY_ME' | 'TEAM' | 'UNASSIGNED'>('ALL');
  
  // Admin Specific Filter
  const [leaderFilter, setLeaderFilter] = useState<string>(''); 

  // Notification State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  // Team Data (for Managers)
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // 1. Listen for Auth Changes (Firebase)
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = authService.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        setActiveTab('TASKS');
        
        const usersList = await authService.getAllUsers();
        setAllUsers(usersList);

        if (currentUser.role === UserRole.MANAGER || (currentUser.teamRoles && Object.values(currentUser.teamRoles).includes(UserRole.MANAGER))) {
           const managedTeamIds = currentUser.teamIds?.filter(tid => 
             currentUser.teamRoles?.[tid] === UserRole.MANAGER || currentUser.role === UserRole.MANAGER 
           ) || [];
           
           const members = usersList.filter(u => 
             u.teamIds?.some(tid => managedTeamIds.includes(tid))
           ).map(u => u.id);
           
           setTeamMembers(members);
        }

        if (currentUser.role === UserRole.ADMIN) {
           const t = await authService.getTeams();
           setTeams(t);
        }
      }
    });
    
    setNotifPermission(notificationService.getPermissionState());

    return () => unsubscribe();
  }, []);

  // 2. Listen for Real-time Task Updates
  useEffect(() => {
    if (!user || !isFirebaseConfigured) {
      setTasks([]);
      return;
    }

    const unsubscribe = dataService.subscribeToTasks((fetchedTasks) => {
      checkNotifications(fetchedTasks, prevTasksRef.current, user);
      
      prevTasksRef.current = fetchedTasks;
      setTasks(fetchedTasks);
      
      if (viewingTask) {
        const updatedViewing = fetchedTasks.find(t => t.id === viewingTask.id);
        if (updatedViewing) setViewingTask(updatedViewing);
      }
    });

    return () => unsubscribe();
  }, [user, viewingTask]);

  // 3. Listen for Projects
  useEffect(() => {
    if (!user || !isFirebaseConfigured) {
      setProjects([]);
      return;
    }
    const unsubscribe = dataService.subscribeToProjects((fetchedProjects) => {
      setProjects(fetchedProjects);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Notification Logic ---
  const checkNotifications = (currentTasks: Task[], prevTasks: Task[], currentUser: User) => {
    if (notificationService.getPermissionState() !== 'granted') return;

    currentTasks.forEach(task => {
      if (task.ownerId !== currentUser.id && task.sharedWith.includes(currentUser.id)) {
        const prevTask = prevTasks.find(t => t.id === task.id);
        const wasSharedWithMe = prevTask ? prevTask.sharedWith.includes(currentUser.id) : false;

        if (!wasSharedWithMe) {
          notificationService.sendNotification(
            "Nuovo task condiviso",
            `${task.ownerUsername || 'Qualcuno'} ha condiviso con te: "${task.title}"`,
            `shared_${task.id}`
          );
        }
      }

      if (task.dueDate && task.status !== TaskStatus.DONE) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const due = new Date(task.dueDate);
        const dueDay = new Date(task.dueDate);
        dueDay.setHours(0, 0, 0, 0);

        const diffTime = dueDay.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays >= 0 && diffDays <= 1) {
          const when = diffDays === 0 ? 'oggi' : 'domani';
          const notifTag = `deadline_${task.id}_${due.toISOString().split('T')[0]}`;
          
          notificationService.sendNotification(
            "Task in scadenza",
            `Il task "${task.title}" scade ${when}!`,
            notifTag
          );
        }
      }
    });
  };

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    if (granted) {
      checkNotifications(tasks, [], user!);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert("La password deve essere di almeno 6 caratteri");
      return;
    }
    try {
      await authService.updatePassword(newPassword);
      alert("Password aggiornata con successo!");
      setNewPassword('');
      setShowPwdModal(false);
    } catch (e: any) {
      alert("Errore: " + e.message);
    }
  };

  // --- Actions ---

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    if (!user) return;
    
    try {
      await dataService.createTask({
        ...taskData,
        ownerId: user.id,
        ownerUsername: user.username,
        sharedWith: taskData.sharedWith || []
      }, user); 
      setIsModalOpen(false);
    } catch (e: any) {
      alert("Errore salvataggio task: " + e.message);
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    if (!user) return;
    const { id, ...data } = updatedTask;
    notificationService.resetNotificationState(`deadline_${id}`);
    
    try {
      await dataService.updateTask(id, data, user, updatedTask.title); 
      setEditingTask(null);
      setIsModalOpen(false);
    } catch (e: any) {
      alert("Errore aggiornamento task: " + e.message);
    }
  };
  
  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
     if (!user) return;
     try {
       await dataService.updateTask(task.id, { status: newStatus }, user, task.title); 
     } catch (e) {
       console.error("Status update failed", e);
     }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (confirm('Sei sicuro di voler eliminare questo task?')) {
      await dataService.deleteTask(id, user, taskToDelete?.title || 'Sconosciuto'); 
      if (viewingTask?.id === id) setViewingTask(null);
    }
  };

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    setViewingTask(task);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const addTagFilter = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  const removeTagFilter = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  // --- Logic for Leaders List (Admin Filter) ---
  const leadersList = useMemo(() => {
    if (user?.role !== UserRole.ADMIN) return [];
    return allUsers.filter(u => 
      !u.isDeleted && (
        u.role === UserRole.MANAGER || 
        (u.teamRoles && Object.values(u.teamRoles).includes(UserRole.MANAGER))
      )
    ).map(u => ({ value: u.id, label: u.username }));
  }, [allUsers, user]);

  // --- Task Visibility Logic ---
  const visibleTasks = useMemo(() => {
    if (!user) return [];
    if (user.role === UserRole.ADMIN) {
      return tasks;
    }
    
    const isManager = user.role === UserRole.MANAGER || 
                      (user.teamRoles && Object.values(user.teamRoles).includes(UserRole.MANAGER));

    if (isManager) {
      return tasks.filter(t => 
        !t.ownerId || 
        t.ownerId === user.id || 
        t.sharedWith.includes(user.id) ||
        teamMembers.includes(t.ownerId) 
      );
    }
    
    return tasks.filter(t => 
      t.ownerId === user.id || t.sharedWith.includes(user.id)
    );
  }, [tasks, user, teamMembers]);

  const allGlobalTags = useMemo(() => {
    const tags = new Set<string>();
    visibleTasks.forEach(t => t.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [visibleTasks]);

  const availableTags = useMemo(() => {
    return allGlobalTags.filter(t => !selectedTags.includes(t));
  }, [allGlobalTags, selectedTags]);

  const filteredTasks = useMemo(() => {
    if (!user) return [];

    return visibleTasks.filter(task => {
      // 1. Filtri di Ruolo/View
      if (viewFilter === 'MINE' && task.ownerId !== user.id) return false;
      if (viewFilter === 'SHARED' && (task.ownerId === user.id || !task.sharedWith.includes(user.id))) return false;
      if (viewFilter === 'SHARED_BY_ME' && (task.ownerId !== user.id || task.sharedWith.length === 0)) return false;
      
      if (viewFilter === 'UNASSIGNED' && task.ownerId) return false; 
      
      if (viewFilter === 'TEAM') {
         if (!teamMembers.includes(task.ownerId) || task.ownerId === user.id) return false;
      }

      // 2. Filtro Admin per Leader
      if (user.role === UserRole.ADMIN && leaderFilter) {
         const leaderUser = allUsers.find(u => u.id === leaderFilter);
         if (leaderUser) {
           const managedTeamIds = leaderUser.teamIds?.filter(tid => 
             leaderUser.teamRoles?.[tid] === UserRole.MANAGER || leaderUser.role === UserRole.MANAGER
           ) || [];
           const membersIds = allUsers.filter(u => 
             u.teamIds?.some(tid => managedTeamIds.includes(tid))
           ).map(u => u.id);

           if (task.ownerId !== leaderUser.id && !membersIds.includes(task.ownerId)) return false;
         }
      }

      const qLower = searchQuery.toLowerCase();
      const matchesSearch = 
        task.title.toLowerCase().includes(qLower) ||
        task.description.toLowerCase().includes(qLower) ||
        (task.attachments && task.attachments.some(att => 
          att.name.toLowerCase().includes(qLower) || 
          (att.type === 'FILE' && atob(att.data.split(',')[1]).toLowerCase().includes(qLower))
        ));
      
      const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.every(t => task.tags.includes(t));

      return matchesSearch && matchesStatus && matchesTags;
    });
  }, [visibleTasks, searchQuery, statusFilter, selectedTags, viewFilter, user, teamMembers, leaderFilter, allUsers]);

  const stats = {
    total: visibleTasks.length,
    todo: visibleTasks.filter(t => t.status === TaskStatus.TODO).length,
    inProgress: visibleTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
    done: visibleTasks.filter(t => t.status === TaskStatus.DONE).length,
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-indigo-600">Caricamento...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  if (user.role !== UserRole.ADMIN && activeTab === 'ADMIN') {
    setActiveTab('TASKS');
  }

  const isManagerOrAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER || (user.teamRoles && Object.values(user.teamRoles).includes(UserRole.MANAGER));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Layout className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 hidden sm:block">TaskMaster AI</h1>
            </div>
            
            <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('TASKS')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                    activeTab === 'TASKS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  Task
                </button>
                <button
                  onClick={() => setActiveTab('PROJECTS')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                    activeTab === 'PROJECTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Progetti
                </button>
                {user.role === UserRole.ADMIN && (
                  <button
                    onClick={() => setActiveTab('ADMIN')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all ${
                      activeTab === 'ADMIN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin
                  </button>
                )}
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setShowLogs(true)}
                className="text-slate-500 hover:text-indigo-600"
                title="Registro Attività"
              >
                <History className="w-5 h-5" />
              </Button>

              {notifPermission === 'default' && (
                <Button 
                  variant="ghost" 
                  onClick={handleEnableNotifications}
                  className="text-slate-500 hover:text-indigo-600"
                  title="Abilita Notifiche"
                >
                  <Bell className="w-5 h-5" />
                </Button>
              )}
              {notifPermission === 'denied' && (
                 <Button variant="ghost" className="text-slate-300 cursor-not-allowed" title="Notifiche bloccate">
                   <BellOff className="w-5 h-5" />
                 </Button>
              )}

              <div className="hidden md:flex items-center text-sm text-slate-600 border-l border-slate-200 pl-4 ml-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold mr-2 ${user.role === UserRole.ADMIN ? 'bg-indigo-600' : user.role === UserRole.MANAGER ? 'bg-green-600' : 'bg-slate-400'}`}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col items-start leading-tight mr-2">
                  <span className="font-semibold">{user.username}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">{user.role}</span>
                </div>
                
                <Button 
                  variant="ghost" 
                  onClick={() => setShowPwdModal(true)}
                  className="text-slate-400 hover:text-indigo-600 p-1 h-auto"
                  title="Cambia Password"
                >
                  <KeyRound className="w-4 h-4" />
                </Button>
              </div>
              
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-600"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>

              {activeTab === 'TASKS' && (
                <Button 
                  onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
                  icon={Plus}
                  className="hidden sm:flex"
                >
                  Nuovo Task
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'ADMIN' && user.role === UserRole.ADMIN ? (
          <AdminPanel currentUser={user} />
        ) : activeTab === 'PROJECTS' ? (
          <ProjectList 
            projects={projects}
            tasks={tasks}
            currentUser={user}
            onCreateTask={handleCreateTask}
            onEditTask={handleEditClick} 
          />
        ) : (
          <>
            {/* Stats Cards ... */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase">Totale Visibili</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase">Da Fare</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.todo}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase">In Corso</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase">Completati</p>
                <p className="text-2xl font-bold text-green-600">{stats.done}</p>
              </div>
            </div>

            {/* Filters Bar ... */}
            <div className="flex flex-col space-y-4 mb-6">
              <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                {/* View Mode Toggle */}
                <div className="flex p-1 bg-slate-200 rounded-lg shrink-0">
                   <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title="Lista">
                     <List className="w-4 h-4" />
                   </button>
                   <button onClick={() => setViewMode('CALENDAR')} className={`p-2 rounded-md transition-all ${viewMode === 'CALENDAR' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title="Calendario">
                     <CalendarIcon className="w-4 h-4" />
                   </button>
                </div>

                {/* Filter Buttons */}
                <div className="flex p-1 bg-slate-200 rounded-lg overflow-x-auto max-w-full">
                  <button onClick={() => setViewFilter('ALL')} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${viewFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Tutti</button>
                  <button onClick={() => setViewFilter('MINE')} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${viewFilter === 'MINE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>I miei</button>
                  <button onClick={() => setViewFilter('SHARED')} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${viewFilter === 'SHARED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    <Users className="w-3 h-3" /> Condivisi con me
                  </button>
                  <button onClick={() => setViewFilter('SHARED_BY_ME')} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${viewFilter === 'SHARED_BY_ME' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    <Share2 className="w-3 h-3" /> I miei condivisi
                  </button>
                  
                  {isManagerOrAdmin && (
                    <button onClick={() => setViewFilter('TEAM')} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${viewFilter === 'TEAM' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Team</button>
                  )}
                  {isManagerOrAdmin && (
                     <button onClick={() => setViewFilter('UNASSIGNED')} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${viewFilter === 'UNASSIGNED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Non Assegnati</button>
                  )}
                </div>

                <div className="w-full xl:w-96 relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Cerca task o allegati..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                </div>
                
                {user.role === UserRole.ADMIN && (
                   <div className="w-full xl:w-56 shrink-0">
                     <Select 
                       options={[{ value: '', label: 'Filtra per Leader (Admin)' }, ...leadersList]}
                       value={leaderFilter}
                       onChange={(e) => setLeaderFilter(e.target.value)}
                       className="bg-white border-slate-300"
                     />
                   </div>
                )}

                <div className="flex gap-2 w-full xl:w-auto overflow-x-auto shrink-0">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'ALL')} className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="ALL">Tutti gli stati</option>
                    <option value={TaskStatus.TODO}>Da fare</option>
                    <option value={TaskStatus.IN_PROGRESS}>In corso</option>
                    <option value={TaskStatus.DONE}>Completato</option>
                  </select>
                </div>
              </div>

              {(availableTags.length > 0 || selectedTags.length > 0) && (
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-3">
                  {/* Tag Filtering UI ... */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5 mr-1">
                        <Filter className="w-3.5 h-3.5" /> Filtri attivi:
                      </span>
                      {selectedTags.map(tag => (
                        <Badge key={tag} color="indigo" onRemove={() => removeTagFilter(tag)} className="pl-2 pr-1 py-1">#{tag}</Badge>
                      ))}
                      <button onClick={() => setSelectedTags([])} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors ml-auto md:ml-2">Rimuovi tutti</button>
                    </div>
                  )}
                  {availableTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mr-1">
                        <Tag className="w-3.5 h-3.5" /> Disponibili:
                      </span>
                      {availableTags.map(tag => (
                        <button key={tag} onClick={() => addTagFilter(tag)} className="px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-all">#{tag}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {viewMode === 'LIST' ? (
              filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTasks.map(task => {
                    // Mappa gli ID dei progetti ai loro nomi
                    const projectNames = task.projectIds
                      ? task.projectIds.map(pid => projects.find(p => p.id === pid)?.title).filter(Boolean) as string[]
                      : (task.projectId ? [projects.find(p => p.id === task.projectId)?.title].filter(Boolean) as string[] : []);

                    return (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        currentUserId={user.id}
                        projectNames={projectNames} // Passa lista nomi progetti
                        onEdit={handleEditClick}
                        onDelete={handleDeleteTask}
                        onTagClick={addTagFilter}
                        handleStatusChange={handleStatusChange}
                        onClick={handleTaskClick}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                  {/* Empty State ... */}
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
                    <List className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Nessun task trovato</h3>
                  <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                    {searchQuery || selectedTags.length > 0 || viewFilter !== 'ALL' || leaderFilter
                      ? "Prova a modificare i filtri o i termini di ricerca." 
                      : "Inizia creando il tuo primo task."}
                  </p>
                  {(searchQuery || selectedTags.length > 0 || viewFilter !== 'ALL' || leaderFilter) && (
                    <Button variant="secondary" className="mt-4" onClick={() => { setSearchQuery(''); setSelectedTags([]); setStatusFilter('ALL'); setViewFilter('ALL'); setLeaderFilter(''); }}>
                      Pulisci filtri
                    </Button>
                  )}
                </div>
              )
            ) : (
              <CalendarView 
                tasks={filteredTasks} 
                onTaskClick={handleTaskClick}
                onCreateTaskForDate={(date) => {
                  setEditingTask(null);
                  setIsModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Modals ... */}
      {activeTab === 'TASKS' && (
        <button 
          onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
          className="fixed bottom-6 right-6 sm:hidden p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={handleModalClose}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg leading-6 font-bold text-slate-900">
                    {editingTask ? 'Modifica Task' : 'Crea Nuovo Task'}
                  </h3>
                  <button onClick={handleModalClose} className="text-slate-400 hover:text-slate-500 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <TaskForm 
                  initialTask={editingTask}
                  currentUser={user}
                  existingTags={allGlobalTags}
                  projects={projects}
                  onSubmit={editingTask ? (t) => handleUpdateTask({...t, id: editingTask.id, createdAt: editingTask.createdAt} as Task) : handleCreateTask}
                  onCancel={handleModalClose}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingTask && (
        <TaskDetailModal 
          task={viewingTask} 
          onClose={() => setViewingTask(null)}
          onEdit={handleEditClick}
        />
      )}

      {showLogs && (
        <ActivityLog 
          currentUser={user} 
          onClose={() => setShowLogs(false)} 
        />
      )}

      {showPwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm" onClick={() => setShowPwdModal(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Cambia Password</h3>
            <input 
              type="password" 
              placeholder="Nuova password (min. 6 caratteri)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPwdModal(false)}>Annulla</Button>
              <Button variant="primary" onClick={handleChangePassword}>Aggiorna</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
