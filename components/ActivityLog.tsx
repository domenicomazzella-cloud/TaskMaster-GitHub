
import React, { useEffect, useState } from 'react';
import { User, LogEntry, LogAction } from '../types';
import { logService } from '../services/logService';
import { Card, Button } from './UI';
import { Clock, Edit, PlusCircle, Trash2, CheckCircle, RefreshCw, X, Shield, History } from 'lucide-react';

interface ActivityLogProps {
  currentUser: User;
  onClose?: () => void;
  variant?: 'modal' | 'embedded';
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ currentUser, onClose, variant = 'modal' }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await logService.getLogs(currentUser);
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentUser]);

  const getActionIcon = (action: LogAction) => {
    switch (action) {
      case LogAction.CREATE: return <PlusCircle className="w-5 h-5 text-green-600" />;
      case LogAction.DELETE: return <Trash2 className="w-5 h-5 text-red-600" />;
      case LogAction.STATUS_CHANGE: return <CheckCircle className="w-5 h-5 text-indigo-600" />;
      case LogAction.UPDATE: return <Edit className="w-5 h-5 text-orange-500" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getActionLabel = (action: LogAction) => {
    switch (action) {
      case LogAction.CREATE: return 'Creazione';
      case LogAction.DELETE: return 'Eliminazione';
      case LogAction.STATUS_CHANGE: return 'Cambio Stato';
      case LogAction.UPDATE: return 'Modifica';
      case LogAction.REGISTER: return 'Registrazione';
      default: return 'Azione';
    }
  };

  const Content = (
    <div className={`flex flex-col h-full ${variant === 'embedded' ? 'bg-transparent' : 'bg-white rounded-2xl shadow-xl overflow-hidden'}`}>
      
      {/* Header */}
      <div className={`${variant === 'embedded' ? 'px-0 py-4' : 'bg-slate-50 px-6 py-4 border-b border-slate-100'} flex justify-between items-center shrink-0`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <History className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Registro Attività</h2>
            <p className="text-xs text-slate-500">
              Visualizzazione: {currentUser.role === 'ADMIN' ? 'Globale' : currentUser.role === 'MANAGER' ? 'Team' : 'Personale'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={fetchLogs} title="Aggiorna">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {variant === 'modal' && onClose && (
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full p-2 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className={`overflow-y-auto ${variant === 'embedded' ? 'pr-2' : 'p-6 bg-slate-50/50 flex-1'}`}>
        {logs.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>Nessuna attività registrata di recente.</p>
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {logs.map((log) => (
              <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Icon Marker */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  {getActionIcon(log.action)}
                </div>
                
                {/* Content Card */}
                <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 shadow-sm border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-700 text-sm">
                      {getActionLabel(log.action)}
                    </span>
                    <time className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </time>
                  </div>
                  
                  <p className="text-sm font-medium text-slate-900 mb-1">
                    {log.targetTitle}
                  </p>
                  
                  <p className="text-xs text-slate-500 mb-3">
                    {log.details}
                  </p>
                  
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                       {log.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-600 font-semibold">
                      {log.username}
                    </span>
                    {currentUser.role === 'ADMIN' && log.teamId && (
                       <span className="ml-auto text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-500">
                         Team ID: ...{log.teamId.slice(-4)}
                       </span>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'embedded') {
    return Content;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity backdrop-blur-sm" 
          onClick={onClose}
        ></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl w-full max-h-[85vh]">
          {Content}
        </div>
      </div>
    </div>
  );
};
