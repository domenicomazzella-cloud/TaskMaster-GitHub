
import React, { useState, useEffect } from 'react';
import { User, UserRole, Team } from '../types';
import { authService } from '../services/authService';
import { Button, Input, Select, Badge, Card, Autocomplete } from './UI';
import { TeamManager } from './TeamManager';
import { RoutineManager } from './RoutineManager'; // Import nuovo
import { ActivityLog } from './ActivityLog';
import { UserPlus, Trash2, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Check, Ban, KeyRound, Edit, History, X, Copy, Link as LinkIcon, RotateCcw, Wrench, AlertTriangle, ClipboardList } from 'lucide-react';
import { dataService } from '../services/dataService';
import { logService } from '../services/logService';

type SortKey = 'username' | 'email' | 'role' | 'status' | 'team';

interface AdminPanelProps {
  currentUser?: User; // Passiamo l'admin corrente per il logging
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Create User Form State
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>(UserRole.USER);
  const [createTeamId, setCreateTeamId] = useState<string>('');
  
  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.USER);
  const [editTeamId, setEditTeamId] = useState<string>(''); // Used for primary assignment if needed, or we might disable team edit here in favor of TeamManager
  const [editPassword, setEditPassword] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DELETED'>('ACTIVE');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'username', direction: 'asc' });

  // Aggiunto ROUTINES alle sezioni
  const [viewSection, setViewSection] = useState<'USERS' | 'TEAMS' | 'ROUTINES' | 'LOGS' | 'MAINTENANCE'>('USERS');

  useEffect(() => {
    setAppUrl(window.location.origin);
    if (viewSection !== 'LOGS' && viewSection !== 'MAINTENANCE' && viewSection !== 'ROUTINES') {
      loadData();
    }
  }, [viewSection]);

  const loadData = async () => {
    try {
      const [fetchedUsers, fetchedTeams] = await Promise.all([
        authService.getAllUsers(),
        authService.getTeams()
      ]);
      setUsers(fetchedUsers);
      setTeams(fetchedTeams);
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (createPassword.length < 6) {
      setError("La password deve essere di almeno 6 caratteri.");
      return;
    }

    try {
      // Usa la creazione diretta (con secondary app) e passa currentUser per il log
      await authService.createUserDirectly(
        createName, 
        createEmail, 
        createPassword, 
        createRole, 
        createTeamId || undefined,
        currentUser
      );

      setSuccessMsg(`✅ Utente ${createName} creato con successo.\nPuoi inviargli le credenziali.`);
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateTeamId('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditName(user.username);
    setEditRole(user.role);
    // Per modifica semplice, usiamo il primo team se esiste o vuoto
    setEditTeamId(user.teamIds && user.teamIds.length > 0 ? user.teamIds[0] : '');
    setEditPassword(''); // Reset password field
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      // 1. Aggiorna dettagli utente
      await authService.updateUserDetails(editingUser.id, {
        username: editName,
        role: editRole,
        // Nota: Qui stiamo assegnando un team "principale" in modalità compatibilità
        // Per gestione avanzata multi-team si usa il TeamManager
        teamId: editTeamId || null 
      }, currentUser);

      // 2. Gestione cambio password
      if (editPassword.trim()) {
        await authService.adminResetPassword(editingUser.email, currentUser);
        alert(`Dettagli aggiornati. Per la password: È stata inviata un'email di reset a ${editingUser.email} poiché per sicurezza non è possibile cambiarla direttamente.`);
      }

      setEditingUser(null);
      loadData();
    } catch (e: any) {
      alert("Errore aggiornamento: " + e.message);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await authService.toggleUserStatus(user.id, !user.isDisabled, currentUser);
      loadData();
    } catch (e: any) {
      alert("Errore: " + e.message);
    }
  };

  const handleSoftDelete = async (userId: string) => {
    if (confirm('Spostare questo utente nel cestino? Potrai ripristinarlo in seguito.')) {
      await authService.softDeleteUser(userId, currentUser);
      loadData();
    }
  };

  const handleRestore = async (userId: string) => {
    await authService.restoreUser(userId, currentUser);
    loadData();
  };

  // Maintenance Functions
  const handleClearLogs = async () => {
    if (confirm("Sei sicuro? Questa azione eliminerà TUTTI i log di sistema irreversibilmente.")) {
      await logService.clearAllLogs();
      alert("Log svuotati.");
    }
  };

  const handleDeleteOrphanTasks = async () => {
    if (confirm("Eliminare i task senza proprietario?")) {
      const count = await dataService.deleteOrphanTasks(currentUser!);
      alert(`Eliminati ${count} task orfani.`);
    }
  };

  const handleDeleteArchivedProjects = async () => {
    if (confirm("Eliminare definitivamente tutti i progetti archiviati?")) {
      const count = await dataService.deleteArchivedProjects(currentUser!);
      alert(`Eliminati ${count} progetti.`);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filter & Sort Logic
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    
    const matchesStatus = 
      statusFilter === 'ALL' ? true :
      statusFilter === 'DELETED' ? user.isDeleted :
      !user.isDeleted; 

    return matchesSearch && matchesRole && matchesStatus;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let aValue: any = a[sortConfig.key as keyof User];
    let bValue: any = b[sortConfig.key as keyof User];
    
    if (sortConfig.key === 'team') {
      // Sort by number of teams or name of first team
      aValue = a.teamIds?.length || 0;
      bValue = b.teamIds?.length || 0;
    } else if (sortConfig.key === 'status') {
      aValue = a.isDeleted ? 3 : (a.isDisabled ? 1 : (a.isPending ? 2 : 0));
      bValue = b.isDeleted ? 3 : (b.isDisabled ? 1 : (b.isPending ? 2 : 0));
    } else if (sortConfig.key === 'email') {
      aValue = (a.email || '').toLowerCase();
      bValue = (b.email || '').toLowerCase();
    } else if (sortConfig.key === 'username') {
      aValue = a.username.toLowerCase();
      bValue = b.username.toLowerCase();
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />;
  };

  const roleColors: Record<UserRole, 'indigo' | 'green' | 'slate'> = {
    [UserRole.ADMIN]: 'indigo',
    [UserRole.MANAGER]: 'green',
    [UserRole.USER]: 'slate',
  };

  const roleOptions = [
    { value: 'ALL', label: 'Tutti i ruoli' },
    { value: UserRole.ADMIN, label: 'Admin' },
    { value: UserRole.MANAGER, label: 'Manager' },
    { value: UserRole.USER, label: 'Utente' },
  ];

  const createRoleOptions = [
    { value: UserRole.USER, label: 'Utente Base' },
    { value: UserRole.MANAGER, label: 'Manager Globale' },
    { value: UserRole.ADMIN, label: 'Amministratore' },
  ];

  const teamOptions = [
    { value: '', label: 'Nessun Team' },
    ...teams.map(t => ({ value: t.id, label: t.name }))
  ];

  return (
    <div className="space-y-6">
      
      {/* Navigation Tabs */}
      <div className="flex space-x-4 border-b border-slate-200 pb-2 overflow-x-auto">
         <button 
           onClick={() => setViewSection('USERS')}
           className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors whitespace-nowrap ${viewSection === 'USERS' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
         >
           Gestione Utenti
         </button>
         <button 
           onClick={() => setViewSection('TEAMS')}
           className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors whitespace-nowrap ${viewSection === 'TEAMS' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
         >
           Gestione Team
         </button>
         <button 
           onClick={() => setViewSection('ROUTINES')}
           className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${viewSection === 'ROUTINES' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:text-slate-700'}`}
         >
           <ClipboardList className="w-4 h-4" />
           Routine & Mansioni
         </button>
         <button 
           onClick={() => setViewSection('LOGS')}
           className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${viewSection === 'LOGS' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
         >
           <History className="w-4 h-4" />
           Registro Sistema
         </button>
         <button 
           onClick={() => setViewSection('MAINTENANCE')}
           className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${viewSection === 'MAINTENANCE' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`}
         >
           <Wrench className="w-4 h-4" />
           Manutenzione
         </button>
      </div>

      {viewSection === 'ROUTINES' && currentUser && (
        <RoutineManager currentUser={currentUser} />
      )}

      {viewSection === 'LOGS' && (
        <Card className="p-0 overflow-hidden h-[600px]">
          {/* We pass currentUser (the Admin) so logService knows to fetch all logs */}
          {currentUser && (
            <ActivityLog 
              currentUser={currentUser} 
              variant="embedded"
            />
          )}
        </Card>
      )}

      {viewSection === 'MAINTENANCE' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 flex flex-col items-center text-center space-y-4 border-l-4 border-l-red-500">
             <div className="p-3 bg-red-100 rounded-full text-red-600">
               <Trash2 className="w-8 h-8" />
             </div>
             <div>
               <h3 className="font-bold text-slate-800">Svuota Registro Attività</h3>
               <p className="text-sm text-slate-500">Elimina irreversibilmente tutti i log storici.</p>
             </div>
             <Button variant="danger" onClick={handleClearLogs} className="w-full">Esegui Pulizia</Button>
          </Card>

          <Card className="p-6 flex flex-col items-center text-center space-y-4 border-l-4 border-l-orange-500">
             <div className="p-3 bg-orange-100 rounded-full text-orange-600">
               <AlertTriangle className="w-8 h-8" />
             </div>
             <div>
               <h3 className="font-bold text-slate-800">Pulizia Task Orfani</h3>
               <p className="text-sm text-slate-500">Rimuove task senza un proprietario valido.</p>
             </div>
             <Button variant="secondary" onClick={handleDeleteOrphanTasks} className="w-full text-orange-600 hover:bg-orange-50 border-orange-200">Scansiona ed Elimina</Button>
          </Card>

          <Card className="p-6 flex flex-col items-center text-center space-y-4 border-l-4 border-l-slate-500">
             <div className="p-3 bg-slate-100 rounded-full text-slate-600">
               <History className="w-8 h-8" />
             </div>
             <div>
               <h3 className="font-bold text-slate-800">Elimina Progetti Archiviati</h3>
               <p className="text-sm text-slate-500">Rimuove definitivamente i progetti in stato ARCHIVED.</p>
             </div>
             <Button variant="secondary" onClick={handleDeleteArchivedProjects} className="w-full">Elimina Definitivamente</Button>
          </Card>
        </div>
      )}

      {viewSection === 'TEAMS' && <TeamManager currentUser={currentUser} />}

      {viewSection === 'USERS' && (
        <div className="space-y-6">
          
          {/* ACCESS LINK INFO */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-sm">Link di Accesso Utenti</h4>
                <p className="text-xs text-blue-700">Invia questo link ai nuovi utenti insieme alle credenziali.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-200 text-xs font-mono text-slate-600 truncate max-w-[300px]">
                {appUrl}
              </code>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={copyLink} 
                icon={isCopied ? Check : Copy}
                className={isCopied ? "text-green-600 border-green-200 bg-green-50 transition-all duration-300" : ""}
              >
                {isCopied ? "Copiato!" : "Copia Link"}
              </Button>
            </div>
          </div>

          {/* CREATE USER CARD */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="bg-indigo-50 p-2 rounded-lg">
                <UserPlus className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Crea Nuovo Utente</h2>
                <p className="text-sm text-slate-500">Crea credenziali immediatamente valide.</p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input 
                label="Username" 
                value={createName} 
                onChange={e => setCreateName(e.target.value)} 
                required 
                placeholder="es. MarioRossi"
              />
              <Input 
                label="Email" 
                value={createEmail} 
                onChange={e => setCreateEmail(e.target.value)} 
                type="email"
                required
                placeholder="mario@email.com"
              />
              <Input 
                label="Password" 
                value={createPassword} 
                onChange={e => setCreatePassword(e.target.value)} 
                type="text"
                required
                placeholder="Min. 6 caratteri"
              />
              <Select 
                label="Ruolo"
                value={createRole}
                onChange={e => setCreateRole(e.target.value as UserRole)}
                options={createRoleOptions}
              />
              <Select 
                label="Team Iniziale (Opzionale)"
                value={createTeamId}
                onChange={e => setCreateTeamId(e.target.value)}
                options={teamOptions}
              />
              <div className="flex items-end">
                <Button type="submit" variant="primary" className="w-full h-[42px]">
                  Crea e Attiva
                </Button>
              </div>
            </form>
            {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
            {successMsg && (
              <div className="mt-4 text-sm text-green-800 bg-green-50 p-4 rounded-lg border border-green-200 flex gap-3">
                 <Check className="w-5 h-5 flex-shrink-0 text-green-600" />
                 <div className="whitespace-pre-wrap font-mono text-xs">{successMsg}</div>
              </div>
            )}
          </Card>

          {/* USER LIST */}
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-800">Database Utenti</h2>
              <div className="flex gap-3 w-full md:w-auto flex-wrap">
                <Input placeholder="Cerca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} icon={Search} className="w-full md:w-48" />
                <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')} options={roleOptions} icon={Filter} className="w-full md:w-40" />
                <Select 
                   value={statusFilter} 
                   onChange={(e) => setStatusFilter(e.target.value as any)} 
                   options={[
                     {value: 'ACTIVE', label: 'Attivi/Sospesi'},
                     {value: 'DELETED', label: 'Cestino (Eliminati)'},
                     {value: 'ALL', label: 'Tutti'}
                   ]} 
                   className="w-full md:w-40" 
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('username')}>
                      <div className="flex items-center gap-2">Utente {getSortIcon('username')}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hidden sm:table-cell" onClick={() => handleSort('email')}>
                       <div className="flex items-center gap-2">Email {getSortIcon('email')}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('team')}>
                       <div className="flex items-center gap-2">Teams {getSortIcon('team')}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('role')}>
                       <div className="flex items-center gap-2">Ruolo {getSortIcon('role')}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer" onClick={() => handleSort('status')}>
                       <div className="flex items-center gap-2">Stato {getSortIcon('status')}</div>
                    </th>
                    <th className="px-6 py-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedUsers.map(u => {
                    // Logic to display team info
                    const userTeamCount = u.teamIds?.length || 0;
                    let teamDisplay = <span className="text-slate-400">-</span>;
                    
                    if (userTeamCount > 0) {
                        const firstTeamName = teams.find(t => t.id === u.teamIds?.[0])?.name || 'Team';
                        if (userTeamCount === 1) {
                            teamDisplay = <Badge color="indigo">{firstTeamName}</Badge>;
                        } else {
                            teamDisplay = <Badge color="indigo">{firstTeamName} +{userTeamCount - 1}</Badge>;
                        }
                    }

                    return (
                      <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.isDeleted ? 'bg-red-50/50' : u.isDisabled ? 'bg-slate-100 opacity-75' : ''}`}>
                        <td className="px-6 py-4 font-medium text-slate-800">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${u.isDeleted ? 'bg-red-100 text-red-500' : 'bg-slate-200'}`}>
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className={u.isDeleted ? 'line-through text-slate-400' : ''}>{u.username}</span>
                              {u.isDisabled && !u.isDeleted && <span className="text-[10px] text-amber-600 font-bold uppercase">Sospeso</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-sm hidden sm:table-cell">{u.email}</td>
                        <td className="px-6 py-4 text-slate-600 text-sm">
                          {teamDisplay}
                        </td>
                        <td className="px-6 py-4"><Badge color={roleColors[u.role]}>{u.role}</Badge></td>
                        <td className="px-6 py-4">
                          {u.isDeleted ? <Badge color="red">Eliminato</Badge> : (u.isPending ? <Badge color="orange">In Attesa</Badge> : <Badge color="green">Attivo</Badge>)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!u.isDeleted ? (
                              <>
                                <Button 
                                  variant="ghost" 
                                  onClick={() => handleEditClick(u)}
                                  title="Modifica Utente"
                                  className="text-slate-500 hover:text-indigo-600"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>

                                <Button 
                                  variant="ghost" 
                                  onClick={() => handleToggleStatus(u)} 
                                  title={u.isDisabled ? "Riattiva Accesso" : "Sospendi Accesso"}
                                  className={u.isDisabled ? "text-green-600" : "text-amber-500"}
                                >
                                  {u.isDisabled ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                </Button>
                                
                                <Button variant="ghost" onClick={() => handleSoftDelete(u.id)} className="text-red-500 hover:bg-red-50" title="Sposta nel Cestino">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button variant="ghost" onClick={() => handleRestore(u.id)} className="text-green-600 hover:bg-green-50 flex gap-2 w-full justify-center" title="Ripristina Utente">
                                <RotateCcw className="w-4 h-4" /> Ripristina
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm" onClick={() => setEditingUser(null)}></div>
          <Card className="relative w-full max-w-md p-6 z-10 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">Modifica Utente</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase">Email (Non modificabile)</span>
                <div className="text-sm font-medium text-slate-700">{editingUser.email}</div>
              </div>

              <Input 
                label="Username" 
                value={editName} 
                onChange={e => setEditName(e.target.value)} 
              />
              
              <Input
                label="Reimposta Password"
                type="password"
                placeholder="Lascia vuoto per non cambiare"
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                icon={KeyRound}
              />
              {editPassword && (
                 <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                   Nota: Cliccando su Salva, verrà inviata una mail di <strong>Reset Password</strong> all'utente, poiché per sicurezza non è possibile cambiarla direttamente senza conoscere quella attuale.
                 </p>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <Select 
                  label="Ruolo"
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as UserRole)}
                  options={createRoleOptions}
                />
                <Select 
                  label="Team Principale"
                  value={editTeamId}
                  onChange={e => setEditTeamId(e.target.value)}
                  options={teamOptions}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setEditingUser(null)}>Annulla</Button>
                <Button variant="primary" onClick={handleUpdateUser}>Salva Modifiche</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
