
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Inserisci qui le tue chiavi Firebase reali
// Se usi Vite/CreateReactApp, puoi usare le variabili d'ambiente (crea un file .env)
// Altrimenti sostituisci le stringhe che iniziano con "TUO_" o "INSERISCI_"
const defaultConfig = {
  apiKey: "AIzaSyDoRvLYNrc-B4B4LVhpyL_qM7khVd3lxQd",
  authDomain: "task-acdl.firebaseapp.com",
  projectId: "task-acdl",
  storageBucket: "task-acdl.appspot.com",
  messagingSenderId: "1070342625896",
  appId: "1:1070342625896:web:30de092e120659d192b9dd",
  measurementId: "G-M5I2021DP3"
};

const envConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '',
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || ''
};

let runtimeConfig = { ...defaultConfig };
for (const k of Object.keys(envConfig) as (keyof typeof envConfig)[]) {
  const v = envConfig[k];
  if (v) (runtimeConfig as any)[k] = v;
}

try {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      runtimeConfig = { ...runtimeConfig, ...parsed };
    }
  }
} catch {}

// Normalize storage bucket domain if pasted from wrong source
if (runtimeConfig.storageBucket && runtimeConfig.storageBucket.endsWith('firebasestorage.app')) {
  const projectId = runtimeConfig.projectId || defaultConfig.projectId;
  runtimeConfig.storageBucket = `${projectId}.appspot.com`;
}

export const firebaseConfig = runtimeConfig;


// Controllo robusto per vedere se le chiavi sono state inserite
const isPlaceholder = (value: string | undefined) => 
  !value || value.includes("TUO_") || value.includes("INSERISCI_");

export const isFirebaseConfigured = 
  !isPlaceholder(firebaseConfig.apiKey) && 
  !isPlaceholder(firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Funzione di diagnostica per verificare la connessione
export const checkDatabaseConnection = async () => {
  if (!isFirebaseConfigured) {
    return { success: false, error: 'Configurazione mancante (Placeholder rilevati)' };
  }
  try {
    // Tenta di leggere un documento di test per verificare permessi e connettività
    // Non importa se il documento non esiste, l'importante è che non dia errore di permesso o rete
    await getDoc(doc(db, 'system_health_check', 'ping'));
    return { success: true };
  } catch (error: any) {
    console.error("Firebase Connection Check Failed:", error);
    let msg = error.message;
    if (error.code === 'permission-denied') {
      msg = "Permesso negato. Assicurati che le regole del Database siano in 'Test Mode'.";
    } else if (error.code === 'unavailable') {
      msg = "Database non raggiungibile (Offline o Client Offline).";
    }
    return { success: false, error: msg, code: error.code };
  }
};
