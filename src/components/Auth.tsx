
import React, { useState, useEffect } from 'react';
import { Button, Input, Card, Textarea } from './UI';
import { Layout, LogIn, UserPlus, AlertTriangle, Settings, CheckCircle2, XCircle, RefreshCw, Save, Wand2 } from 'lucide-react';
import { authService } from '../services/authService';
import { isFirebaseConfigured, checkDatabaseConnection } from '../firebase';

interface AuthProps {}

type AuthMode = 'LOGIN' | 'REGISTER';

export const Auth: React.FC<AuthProps> = () => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Connection Status State
  const [connectionStatus, setConnectionStatus] = useState<'CHECKING' | 'OK' | 'ERROR'>('CHECKING');
  const [connectionError, setConnectionError] = useState('');

  // Manual Config State
  const [showConfigForm, setShowConfigForm] = useState(!isFirebaseConfigured);
  
  // Config Fields
  const [configInput, setConfigInput] = useState('');
  const [parsedConfig, setParsedConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });

  useEffect(() => {
    if (isFirebaseConfigured) {
      runConnectionCheck();
    } else {
      setConnectionStatus('ERROR');
      setConnectionError('Configurazione mancante o API Key non valida');
      // Tenta di precaricare config esistente se c'è ma è invalida
      const saved = localStorage.getItem('firebase_config');
      if (saved) {
        try {
          const c = JSON.parse(saved);
          setParsedConfig(prev => ({ ...prev, ...c }));
        } catch (e) {}
      }
    }
  }, []);

  const runConnectionCheck = async () => {
    setConnectionStatus('CHECKING');
    const result = await checkDatabaseConnection();
    if (result.success) {
      setConnectionStatus('OK');
      setConnectionError('');
    } else {
      setConnectionStatus('ERROR');
      setConnectionError(result.error || 'Errore sconosciuto');
    }
  };

  // Funzione intelligente per estrarre i dati dallo snippet Firebase
  const handleParseConfig = (input: string) => {
    setConfigInput(input);
    
    // Regex per trovare key: "value" oppure "key": "value"
    const extract = (key: string) => {
      // Cerca: key seguito opzionalmente da virgolette, spazi, due punti, spazi, virgolette, valore, virgolette
      const regex = new RegExp(`${key}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
      const match = input.match(regex);
      return match ? match[1] : '';
    };

    const newConfig = {
      apiKey: extract('apiKey') || parsedConfig.apiKey,
      authDomain: extract('authDomain') || parsedConfig.authDomain,
      projectId: extract('projectId') || parsedConfig.projectId,
      storageBucket: extract('storageBucket') || parsedConfig.storageBucket,
      messagingSenderId: extract('messagingSenderId') || parsedConfig.messagingSenderId,
      appId: extract('appId') || parsedConfig.appId,
    };

    setParsedConfig(newConfig);
  };

  const handleFieldChange = (field: keyof typeof parsedConfig, value: string) => {
    setParsedConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = () => {
    if (!parsedConfig.apiKey || parsedConfig.apiKey.length < 30) {
      alert("L'API Key sembra troppo corta o mancante.");
      return;
    }
    if (!parsedConfig.projectId) {
      alert("Il Project ID è mancante.");
      return;
    }
    
    localStorage.setItem('firebase_config', JSON.stringify(parsedConfig));
    window.location.reload();
  };

  // Se Firebase non è configurato o l'utente vuole configurarlo manualmente
  if (!isFirebaseConfigured || showConfigForm) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full">
          <Card className="p-6 md:p-8 border-l-4 border-l-orange-500 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-100 rounded-full">
                <Settings className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Configurazione Database</h1>
                <p className="text-sm text-slate-500">Collega TaskMaster al tuo progetto Firebase</p>
              </div>
            </div>
            
            <div className="space-y-6 text-slate-600">
              {/* Area Incolla Intelligente */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-500" />
                  Incolla qui lo snippet di Firebase
                </label>
                <Textarea 
                  rows={4}
                  placeholder={`const firebaseConfig = {\n  apiKey: "...",\n  projectId: "..."\n};`}
                  value={configInput}
                  onChange={(e) => handleParseConfig(e.target.value)}
                  className="font-mono text-xs bg-white mb-2"
                />
                <p className="text-[10px] text-slate-400">
                  Copia tutto il codice da: Firebase Console &gt; Impostazioni &gt; Le tue app &gt; Web (SDK setup).
                  I campi sotto si compileranno automaticamente.
                </p>
              </div>

              {/* Campi Singoli */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                  label="API Key" 
                  value={parsedConfig.apiKey} 
                  onChange={e => handleFieldChange('apiKey', e.target.value)}
                  placeholder="AIzaSy..."
                  className={!parsedConfig.apiKey ? "border-orange-300 bg-orange-50" : "bg-green-50/30"}
                />
                <Input 
                  label="Project ID" 
                  value={parsedConfig.projectId} 
                  onChange={e => handleFieldChange('projectId', e.target.value)}
                  placeholder="task-app-123"
                  className={!parsedConfig.projectId ? "border-orange-300 bg-orange-50" : "bg-green-50/30"}
                />
                <Input 
                  label="Auth Domain" 
                  value={parsedConfig.authDomain} 
                  onChange={e => handleFieldChange('authDomain', e.target.value)}
                  placeholder="app.firebaseapp.com"
                />
                <Input 
                  label="Storage Bucket" 
                  value={parsedConfig.storageBucket} 
                  onChange={e => handleFieldChange('storageBucket', e.target.value)}
                  placeholder="app.appspot.com"
                />
                <Input 
                  label="Messaging Sender ID" 
                  value={parsedConfig.messagingSenderId} 
                  onChange={e => handleFieldChange('messagingSenderId', e.target.value)}
                  placeholder="123456..."
                />
                <Input 
                  label="App ID" 
                  value={parsedConfig.appId} 
                  onChange={e => handleFieldChange('appId', e.target.value)}
                  placeholder="1:123456:web:..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                <Button onClick={handleSaveConfig} variant="primary" className="flex-1" icon={Save}>
                  Salva e Connetti
                </Button>
                {isFirebaseConfigured && (
                  <Button onClick={() => setShowConfigForm(false)} variant="secondary">
                    Annulla
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'LOGIN') {
        await authService.login(email, password);
      } else if (mode === 'REGISTER') {
        await authService.register(username, email, password);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Si è verificato un errore.";
      if (err.code === 'auth/invalid-credential') msg = "Email o password non validi.";
      if (err.code === 'auth/email-already-in-use') msg = "Email già registrata.";
      if (err.code === 'auth/weak-password') msg = "La password deve essere di almeno 6 caratteri.";
      if (err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || err.code === 'auth/invalid-api-key') msg = "API Key non valida.";
      if (err.code === 'auth/network-request-failed') msg = "Errore di connessione. Controlla internet.";
      if (err.code === 'permission-denied') msg = "Permesso negato al Database.";
      setError(msg);
      if (msg.includes('API Key')) {
        setShowConfigForm(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center relative">
          <div className="inline-flex p-3 bg-white/20 rounded-xl mb-4 backdrop-blur-sm">
            <Layout className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">TaskMaster AI</h1>
          <p className="text-indigo-100">Piattaforma Cloud</p>
        </div>

        {/* Connection Status Bar */}
        <div className={`px-4 py-2 text-xs font-medium flex items-center justify-between border-b ${
          connectionStatus === 'OK' ? 'bg-green-50 text-green-700 border-green-100' : 
          connectionStatus === 'ERROR' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-500 border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            {connectionStatus === 'CHECKING' && <RefreshCw className="w-3 h-3 animate-spin" />}
            {connectionStatus === 'OK' && <CheckCircle2 className="w-3 h-3" />}
            {connectionStatus === 'ERROR' && <XCircle className="w-3 h-3" />}
            
            <span>
              {connectionStatus === 'CHECKING' && "Verifica connessione..."}
              {connectionStatus === 'OK' && "Database collegato"}
              {connectionStatus === 'ERROR' && "Errore connessione"}
            </span>
          </div>
          <div className="flex gap-2">
            {connectionStatus === 'ERROR' && (
              <button onClick={runConnectionCheck} className="underline hover:no-underline">Riprova</button>
            )}
            <button onClick={() => setShowConfigForm(true)} className="text-slate-400 hover:text-slate-600">
              <Settings className="w-3 h-3" />
            </button>
          </div>
        </div>

        {connectionStatus === 'ERROR' && (
          <div className="bg-red-50 p-4 text-xs text-red-600 border-b border-red-100">
            <strong>Errore:</strong> {connectionError}
            {connectionError.includes('API Key') && (
               <div className="mt-2">
                 <Button size="sm" variant="secondary" onClick={() => setShowConfigForm(true)} className="text-xs py-1 h-auto">
                   Correggi Configurazione
                 </Button>
               </div>
            )}
          </div>
        )}

        <div className="p-8">
          <div className="flex justify-center mb-6 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => resetForm('LOGIN')}
              className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                mode === 'LOGIN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Accedi
            </button>
            <button
              onClick={() => resetForm('REGISTER')}
              className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${
                mode === 'REGISTER' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Registrati
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'REGISTER' && (
              <Input
                label="Nome utente"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Come vuoi essere chiamato?"
                className="bg-slate-50"
              />
            )}
            
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="nome@esempio.com"
              className="bg-slate-50"
            />
            
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="******"
              className="bg-slate-50"
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center mt-4"
              isLoading={isLoading}
              icon={mode === 'LOGIN' ? LogIn : UserPlus}
              disabled={connectionStatus === 'ERROR'}
            >
              {mode === 'LOGIN' ? 'Accedi' : 'Crea Account'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
