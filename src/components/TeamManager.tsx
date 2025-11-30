
import React, { useState, useEffect } from 'react';
import { Team, User, UserRole } from '../types';
import { authService } from '../services/authService';
import { Button, Input, Card, Badge } from './UI';
import { Users, UserPlus, Trash2, Crown, Shield, X, Edit2, Check, UserMinus, ChevronRight } from 'lucide-react';

interface TeamManagerProps {
  currentUser?: User;
}

export const TeamManager: React.FC<TeamManagerProps> = ({ currentUser }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  // Create Team State
  const [newTeamName, setNewTeamName] = useState('');
  
  // Edit Team State
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
  const [tempTeamName, setTempTeamName] = useState('');

  // Add Member State
  const [isAddMemberMode, setIsAddMemberMode] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [t, u] = await Promise.all([
      authService.getTeams(),
      authService.getAllUsers()
    ]);
    setTeams(t);
    setUsers(u);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      await authService.createTeam(newTeamName, currentUser);
      setNewTeamName('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (confirm("Eliminare questo team? Gli utenti verranno rimossi dal gruppo.")) {
      await authService.deleteTeam(id, currentUser);
      if (selectedTeamId === id) setSelectedTeamId(null);
      loadData();
    }
  };

  const startEditing = (team: Team) => {
    setEditingTeamName(team.id);
    setTempTeamName(team.name);
  };

  const saveTeamName = async (id: string) => {
    if (!tempTeamName.trim()) return;
    await authService.updateTeamName(id, tempTeamName, currentUser);
    setEditingTeamName(null);
    loadData();
  };

  // Team Member Management
  const handleAddMemberToTeam = async (userId: string) => {
    if (!selectedTeamId) return;
    await authService.addUserToTeam(userId, selectedTeamId, currentUser);
    setIsAddMemberMode(false);
    loadData();
  };

  const handleRemoveMemberFromTeam = async (userId: string) => {
    if (!selectedTeamId) return;
    if (confirm("Rimuovere utente da questo team?")) {
      await authService.removeUserFromTeam(userId, selectedTeamId, currentUser);
      loadData();
    }
  };

  const handlePromoteToLeader = async (userId: string) => {
    if (!selectedTeamId) return;
    if (confirm("Promuovere questo utente a Team Leader (Manager) per questo team?")) {
      await authService.setTeamRole(userId, selectedTeamId, UserRole.MANAGER, currentUser);
      // Opzionale: Se vuoi che diventi anche Manager Globale, scommenta:
      // await authService.updateUserRole(userId, UserRole.MANAGER);
      loadData();
    }
  };

  const handleDemoteToMember = async (userId: string) => {
    if (!selectedTeamId) return;
    if (confirm("Rimuovere permessi di leadership in questo team?")) {
      await authService.setTeamRole(userId, selectedTeamId, UserRole.USER, currentUser);
      loadData();
    }
  };

  // Derived Data
  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  
  // Utenti che sono in QUESTO team
  const teamMembers = users.filter(u => u.teamIds?.includes(selectedTeamId || ''));
  
  // Utenti disponibili: Chiunque NON sia già in QUESTO team
  const availableUsers = users.filter(u => 
    !u.teamIds?.includes(selectedTeamId || '') && 
    !u.isDeleted &&
    (u.username.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const getRoleInTeam = (user: User, teamId: string): UserRole => {
     return user.teamRoles?.[teamId] || UserRole.USER;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      
      {/* Left Column: Team List */}
      <Card className="lg:col-span-1 flex flex-col overflow-hidden h-full">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Team
          </h3>
        </div>
        
        <div className="p-4 border-b border-slate-100">
          <form onSubmit={handleCreateTeam} className="flex gap-2">
            <Input 
              placeholder="Nuovo Team..." 
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              className="text-sm"
            />
            <Button type="button" onClick={handleCreateTeam} disabled={!newTeamName.trim()} variant="secondary" className="px-3">
              <UserPlus className="w-4 h-4" />
            </Button>
          </form>
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {teams.map(team => (
            <div 
              key={team.id}
              onClick={() => { setSelectedTeamId(team.id); setIsAddMemberMode(false); }}
              className={`p-3 rounded-lg cursor-pointer transition-all flex justify-between items-center group ${
                selectedTeamId === team.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-8 rounded-full ${selectedTeamId === team.id ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                <div>
                  <div className="font-semibold text-slate-700">{team.name}</div>
                  <div className="text-xs text-slate-400">
                    {users.filter(u => u.teamIds?.includes(team.id)).length} membri
                  </div>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-300 ${selectedTeamId === team.id ? 'text-indigo-500' : ''}`} />
            </div>
          ))}
          {teams.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">Nessun team creato</div>
          )}
        </div>
      </Card>

      {/* Right Column: Team Details */}
      <Card className="lg:col-span-2 flex flex-col overflow-hidden h-full bg-white relative">
        {selectedTeam ? (
          <>
            {/* Header Details */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                {editingTeamName === selectedTeam.id ? (
                  <div className="flex gap-2 items-center">
                    <Input 
                      value={tempTeamName} 
                      onChange={e => setTempTeamName(e.target.value)} 
                      className="text-lg font-bold"
                      autoFocus
                    />
                    <Button onClick={() => saveTeamName(selectedTeam.id)} size="sm" variant="primary"><Check className="w-4 h-4" /></Button>
                    <Button onClick={() => setEditingTeamName(null)} size="sm" variant="ghost"><X className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 group">
                    <h2 className="text-2xl font-bold text-slate-800">{selectedTeam.name}</h2>
                    <button onClick={() => startEditing(selectedTeam)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-slate-500 text-sm mt-1">Gestisci membri e leader del team</p>
              </div>
              <Button variant="danger" onClick={() => handleDeleteTeam(selectedTeam.id)} icon={Trash2} className="text-xs px-3 h-8">
                Elimina Team
              </Button>
            </div>

            {/* Members Area */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Leaders Section */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" /> Team Leaders
                </h4>
                <div className="space-y-2">
                  {teamMembers.filter(m => getRoleInTeam(m, selectedTeam.id) === UserRole.MANAGER || m.role === UserRole.ADMIN).length === 0 && (
                     <p className="text-sm text-slate-400 italic pl-2">Nessun leader assegnato.</p>
                  )}
                  {teamMembers.filter(m => getRoleInTeam(m, selectedTeam.id) === UserRole.MANAGER || m.role === UserRole.ADMIN).map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                          {member.username.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{member.username}</div>
                          <div className="text-xs text-slate-500">{member.email}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {member.role !== UserRole.ADMIN && (
                          <Button variant="ghost" onClick={() => handleDemoteToMember(member.id)} className="text-slate-400 hover:text-amber-600 text-xs" title="Demansiona a Membro">
                            <Shield className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" onClick={() => handleRemoveMemberFromTeam(member.id)} className="text-slate-400 hover:text-red-600 text-xs">
                           <UserMinus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Regular Members Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                     <Users className="w-4 h-4" /> Membri
                   </h4>
                   <Button variant="secondary" onClick={() => setIsAddMemberMode(true)} icon={UserPlus} className="text-xs h-7 px-2">
                     Aggiungi
                   </Button>
                </div>

                <div className="space-y-2">
                   {teamMembers.filter(m => getRoleInTeam(m, selectedTeam.id) === UserRole.USER && m.role !== UserRole.ADMIN).length === 0 && (
                     <p className="text-sm text-slate-400 italic pl-2">Nessun membro base.</p>
                   )}
                   {teamMembers.filter(m => getRoleInTeam(m, selectedTeam.id) === UserRole.USER && m.role !== UserRole.ADMIN).map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-indigo-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                          {member.username.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-700">{member.username}</div>
                          <div className="text-xs text-slate-400">{member.email}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => handlePromoteToLeader(member.id)} className="text-slate-300 hover:text-amber-500 text-xs" title="Promuovi a Leader">
                            <Crown className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" onClick={() => handleRemoveMemberFromTeam(member.id)} className="text-slate-300 hover:text-red-500 text-xs" title="Rimuovi dal team">
                           <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Add Member Overlay */}
            {isAddMemberMode && (
              <div className="absolute inset-0 bg-white z-20 flex flex-col p-6 animate-in slide-in-from-bottom-5 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Aggiungi Membri a {selectedTeam.name}</h3>
                  <Button variant="ghost" onClick={() => setIsAddMemberMode(false)}><X className="w-5 h-5" /></Button>
                </div>
                
                <Input 
                  placeholder="Cerca utente..." 
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="mb-4"
                  autoFocus
                />

                <div className="flex-1 overflow-y-auto space-y-2">
                  {availableUsers.length === 0 ? (
                    <p className="text-center text-slate-400 py-4">Nessun utente disponibile trovato.</p>
                  ) : (
                    availableUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-indigo-50 cursor-pointer" onClick={() => handleAddMemberToTeam(u.id)}>
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                             {u.username.charAt(0)}
                           </div>
                           <div className="text-sm font-medium">
                             {u.username} 
                             {u.teamIds && u.teamIds.length > 0 && <span className="text-slate-400 font-normal ml-2 text-xs">(In {u.teamIds.length} altri team)</span>}
                           </div>
                         </div>
                         <PlusCircleIcon className="w-5 h-5 text-indigo-600" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <Users className="w-16 h-16 mb-4 opacity-20" />
            <p>Seleziona un team per gestirlo</p>
          </div>
        )}
      </Card>
    </div>
  );
};

// Helper Icon
const PlusCircleIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </svg>
);
