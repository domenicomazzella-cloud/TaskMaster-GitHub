
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configurazione fornita
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDoRVLYNrc-B4B4LVHpWy_qM7khVd3lxdQ",
  authDomain: "task-acdl.firebaseapp.com",
  projectId: "task-acdl",
  storageBucket: "task-acdl.firebasestorage.app",
  messagingSenderId: "1070342625896",
  appId: "1:1070342625896:web:30de092e120659d192b9dd",
  measurementId: "G-M512021DP3"
};

// 1. Check LocalStorage for saved config
const savedConfigStr = typeof window !== 'undefined' ? localStorage.getItem('firebase_config') : null;
let savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;

// Pulizia Cache: Se la config salvata ha una chiave corta (vecchia/errata), ignorala e usa quella hardcoded corretta
if (savedConfig && savedConfig.apiKey && savedConfig.apiKey.length < 35) {
  console.log("Rilevata configurazione salvata non valida. Ripristino configurazione di default.");
  savedConfig = null;
  if (typeof window !== 'undefined') localStorage.removeItem('firebase_config');
}

// 2. Determine active config
export const firebaseConfig = savedConfig || defaultFirebaseConfig;

// 3. Validation Logic
const isValidKey = (key: string | undefined) => key && key.length > 30 && !key.includes("TUO_");

export const isFirebaseConfigured = 
  isValidKey(firebaseConfig.apiKey) && 
  firebaseConfig.projectId && 
  !firebaseConfig.projectId.includes("TUO_");

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Diagnostics
export const checkDatabaseConnection = async () => {
  if (!isFirebaseConfigured) {
    return { success: false, error: 'Configurazione non valida o API Key troppo corta.' };
  }
  try {
    // Ping di test
    await getDoc(doc(db, 'system_health_check', 'ping'));
    return { success: true };
  } catch (error: any) {
    console.error("Firebase Connection Check Failed:", error);
    let msg = error.message;
    if (error.code === 'permission-denied') {
      msg = "Permesso negato. Assicurati che le regole del Database siano in 'Test Mode'.";
    } else if (error.code === 'unavailable') {
      msg = "Database non raggiungibile (Offline).";
    } else if (error.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
      msg = "API Key non valida.";
    }
    return { success: false, error: msg, code: error.code };
  }
};
