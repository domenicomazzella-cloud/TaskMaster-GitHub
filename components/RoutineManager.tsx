
import React, { useState, useEffect } from 'react';
import { User, Duty, Routine, RoutineFrequency } from '../types';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import { Button, Input, Card, Badge, Textarea, Select, Autocomplete } from './UI';
import { ClipboardList, Plus, Trash2, Check, RefreshCw, Calendar, ArrowRight, Play, ListTodo } from 'lucide-react';

interface RoutineManagerProps {
  currentUser: User;
}

export const RoutineManager: React.FC<RoutineManagerProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'DUTIES' | 'ROUTINES' | 'ASSIGN'>('DUTIES');
  
  const [duties, setDuties] = useState<Duty[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Duty Form
  const [dutyTitle, setDutyTitle] = useState('');
  const [dutyDesc, setDutyDesc] = useState('');

  // Routine Form
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineDesc, setRoutineDesc] = useState('');
  const [routineFreq, setRoutineFreq] = useState<RoutineFrequency>(RoutineFrequency.DAILY);
  const [selectedDutyIds, setSelectedDutyIds] = useState<string[]>([]);

  // Assign Form
  const [assignRoutineId, setAssignRoutineId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [d, r, u] = await Promise.all([
      dataService.getDuties(),
      dataService.getRoutines(),
      authService.getAllUsers()
    ]);
    setDuties(d);
    setRoutines(r);
    setUsers(u);
  };

  const handleCreateDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dutyTitle.trim()) return;
    await dataService.createDuty({ title: dutyTitle, description: dutyDesc });
    setDutyTitle('');
    setDutyDesc('');
    loadData();
  };

  const handleDeleteDuty = async (id: string) => {
    if(confirm("Eliminare questa mansione?")) {
      await dataService.deleteDuty(id);
      loadData();
    }
  };

  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineTitle.trim() || selectedDutyIds.length === 0) {
        alert("Inserisci un titolo e seleziona almeno una mansione.");
        return;
    }
    await dataService.createRoutine({
        title: routineTitle,
        description: routineDesc,
        frequency: routineFreq,
        dutyIds: selectedDutyIds
    }, currentUser);
    
    setRoutineTitle('');
    setRoutineDesc('');
    setSelectedDutyIds([]);
    loadData();
    setActiveTab('ASSIGN'); // Go to assign tab after creation
  };

  const handleDeleteRoutine = async (id: string) => {
    if(confirm("Eliminare questa routine?")) {
      await dataService.deleteRoutine(id);
      loadData();
    }
  };

  const handleAssignRoutine = async () => {
    if (!assignRoutineId || !assignUserId || !assignDate) {
        alert("Compila tutti i campi.");
        return;
    }
    try {
        await dataService.assignRoutineToUser(assignRoutineId, assignUserId, assignDate, currentUser);
        alert("Routine assegnata con successo! È stato creato un Progetto con i relativi Task.");
        setAssignRoutineId('');
        setAssignUserId('');
    } catch (e: any) {
        alert("Errore: " + e.message);
    }
  };

  // Helpers for multiselect
  const toggleDutySelection = (id: string) => {
    setSelectedDutyIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const freqOptions = [
    { value: RoutineFrequency.ONCE, label: 'Una Tantum' },
    { value: RoutineFrequency.DAILY, label: 'Giornaliera' },
    { value: RoutineFrequency.WEEKLY, label: 'Settimanale' },
    { value: RoutineFrequency.MONTHLY, label: 'Mensile' },
    { value: RoutineFrequency.SEMI_ANNUAL, label: 'Semestrale' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-slate-200 pb-1">
        <button 
          onClick={() => setActiveTab('DUTIES')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'DUTIES' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          1. Lista Mansioni
        </button>
        <button 
          onClick={() => setActiveTab('ROUTINES')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'ROUTINES' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          2. Crea Routine
        </button>
        <button 
          onClick={() => setActiveTab('ASSIGN')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'ASSIGN' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          3. Assegna & Genera
        </button>
      </div>

      {activeTab === 'DUTIES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 h-fit">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <Plus className="w-5 h-5 text-indigo-600"/> Nuova Mansione
              </h3>
              <form onSubmit={handleCreateDuty} className="space-y-4">
                 <Input label="Titolo" value={dutyTitle} onChange={e => setDutyTitle(e.target.value)} placeholder="Es. Pulire ingresso" required />
                 <Textarea label="Descrizione (Opzionale)" value={dutyDesc} onChange={e => setDutyDesc(e.target.value)} rows={3} />
                 <Button type="submit" className="w-full">Salva Mansione</Button>
              </form>
           </Card>

           <Card className="col-span-2 p-6">
              <h3 className="font-bold text-slate-800 mb-4">Database Mansioni ({duties.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                 {duties.map(duty => (
                    <div key={duty.id} className="p-3 border border-slate-200 rounded-lg hover:border-indigo-300 transition-all flex justify-between group bg-white">
                       <div>
                          <div className="font-medium text-slate-800">{duty.title}</div>
                          {duty.description && <div className="text-xs text-slate-500 truncate max-w-[200px]">{duty.description}</div>}
                       </div>
                       <button onClick={() => handleDeleteDuty(duty.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                 ))}
                 {duties.length === 0 && <p className="text-slate-400 italic">Nessuna mansione creata.</p>}
              </div>
           </Card>
        </div>
      )}

      {activeTab === 'ROUTINES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <Card className="p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <ListTodo className="w-5 h-5 text-indigo-600"/> Componi Routine
              </h3>
              <form onSubmit={handleCreateRoutine} className="space-y-4">
                 <Input label="Nome Routine" value={routineTitle} onChange={e => setRoutineTitle(e.target.value)} placeholder="Es. Chiusura Serale" required />
                 <Textarea label="Descrizione" value={routineDesc} onChange={e => setRoutineDesc(e.target.value)} />
                 <Select 
                    label="Frequenza Suggerita" 
                    options={freqOptions} 
                    value={routineFreq} 
                    onChange={e => setRoutineFreq(e.target.value as RoutineFrequency)} 
                 />
                 
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Seleziona Mansioni da includere:</label>
                    <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 bg-slate-50 space-y-1">
                       {duties.map(duty => (
                          <div 
                            key={duty.id} 
                            onClick={() => toggleDutySelection(duty.id)}
                            className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center ${selectedDutyIds.includes(duty.id) ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-white hover:bg-slate-100'}`}
                          >
                             <span>{duty.title}</span>
                             {selectedDutyIds.includes(duty.id) && <Check className="w-4 h-4"/>}
                          </div>
                       ))}
                       {duties.length === 0 && <p className="text-xs text-slate-400 p-2">Crea prima delle mansioni nella scheda 1.</p>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{selectedDutyIds.length} mansioni selezionate</p>
                 </div>

                 <Button type="submit" className="w-full">Crea Template Routine</Button>
              </form>
           </Card>

           <Card className="p-6">
              <h3 className="font-bold text-slate-800 mb-4">Routine Esistenti</h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                 {routines.map(routine => (
                    <div key={routine.id} className="p-4 border border-slate-200 rounded-xl bg-white hover:shadow-md transition-all">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                             <h4 className="font-bold text-slate-800">{routine.title}</h4>
                             <Badge color="indigo" className="mt-1">{routine.frequency}</Badge>
                          </div>
                          <button onClick={() => handleDeleteRoutine(routine.id)} className="text-slate-300 hover:text-red-500 p-1">
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                       <p className="text-xs text-slate-500 mb-3">{routine.description}</p>
                       <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                          <strong>Include {routine.dutyIds.length} mansioni:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500">
                             {routine.dutyIds.slice(0, 3).map(did => (
                                <li key={did}>{duties.find(d => d.id === did)?.title || 'Mansione rimossa'}</li>
                             ))}
                             {routine.dutyIds.length > 3 && <li>...e altre {routine.dutyIds.length - 3}</li>}
                          </ul>
                       </div>
                       <div className="mt-3 flex justify-end">
                          <Button size="sm" variant="secondary" className="text-xs" onClick={() => { setAssignRoutineId(routine.id); setActiveTab('ASSIGN'); }}>
                             Usa per Assegnare <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                       </div>
                    </div>
                 ))}
                 {routines.length === 0 && <p className="text-slate-400 italic">Nessuna routine definita.</p>}
              </div>
           </Card>
        </div>
      )}

      {activeTab === 'ASSIGN' && (
        <div className="max-w-2xl mx-auto">
           <Card className="p-8 border-t-4 border-t-green-500 shadow-lg">
              <div className="text-center mb-8">
                 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                    <Play className="w-8 h-8 ml-1" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800">Genera ed Assegna Routine</h2>
                 <p className="text-slate-500 mt-2">
                    Questa azione creerà immediatamente un <strong>Progetto</strong> contenente tutte le mansioni della routine come <strong>Task</strong> assegnati all'utente scelto.
                 </p>
              </div>

              <div className="space-y-6">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">1. Scegli Routine</label>
                    <Select 
                       value={assignRoutineId} 
                       onChange={e => setAssignRoutineId(e.target.value)} 
                       options={[{value: '', label: 'Seleziona...'}, ...routines.map(r => ({value: r.id, label: r.title}))]}
                       className="text-lg"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">2. Scegli Esecutore</label>
                    <Autocomplete 
                       placeholder="Cerca utente..."
                       options={users.filter(u => !u.isDeleted).map(u => ({ value: u.id, label: u.username }))}
                       onSelect={setAssignUserId}
                       className="text-lg"
                    />
                    {assignUserId && <p className="text-xs text-green-600 mt-1 font-medium">Utente selezionato: {users.find(u => u.id === assignUserId)?.username}</p>}
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">3. Data Esecuzione</label>
                    <Input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} className="text-lg" />
                 </div>

                 <Button 
                    onClick={handleAssignRoutine} 
                    className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 shadow-md mt-4"
                    disabled={!assignRoutineId || !assignUserId}
                 >
                    Genera Routine Ora
                 </Button>
              </div>
           </Card>
        </div>
      )}
    </div>
  );
};
