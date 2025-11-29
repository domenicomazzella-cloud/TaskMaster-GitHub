
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { LogEntry, LogAction, User, UserRole } from '../types';

const LOGS_COLLECTION = 'logs';

export const logService = {
  
  addLog: async (
    user: User, 
    action: LogAction, 
    targetId: string, 
    targetTitle: string, 
    details: string
  ) => {
    try {
      // Se l'utente non è definito (es. azioni di sistema), usiamo un placeholder
      const userId = user?.id || 'system';
      const username = user?.username || 'Sistema';
      const teamId = user?.teamId || null;

      const entry: Omit<LogEntry, 'id'> = {
        action,
        userId,
        username,
        teamId: teamId || undefined,
        targetId,
        targetTitle,
        details,
        timestamp: new Date().toISOString()
      };
      
      await addDoc(collection(db, LOGS_COLLECTION), entry);
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  },

  getLogs: async (currentUser: User): Promise<LogEntry[]> => {
    const logsRef = collection(db, LOGS_COLLECTION);
    
    try {
      let q;
      let rawDocs = [];

      // STRATEGIA IBRIDA:
      // Per evitare errori di "Indice Mancante" complessi da configurare per l'utente,
      // scarichiamo gli ultimi 100 log globali e filtriamo in memoria (Client-side).
      // Questo è molto più robusto per piccole/medie applicazioni.

      if (currentUser.role === UserRole.ADMIN) {
        // L'Admin vede tutto, ordiniamo per data
        q = query(logsRef, orderBy('timestamp', 'desc'), limit(150));
        const snapshot = await getDocs(q);
        rawDocs = snapshot.docs;
      } else {
        // Per gli altri ruoli, scarichiamo un po' di dati e filtriamo JS
        // Scarichiamo gli ultimi 200 eventi globali per essere sicuri di trovarne alcuni pertinenti
        q = query(logsRef, orderBy('timestamp', 'desc'), limit(200));
        const snapshot = await getDocs(q);
        
        // Filtraggio Client-Side
        rawDocs = snapshot.docs.filter(doc => {
          const data = doc.data() as LogEntry;
          
          if (currentUser.role === UserRole.MANAGER && currentUser.teamId) {
            // Manager: vede le sue azioni O azioni fatte da membri del suo team
            return data.userId === currentUser.id || data.teamId === currentUser.teamId;
          } else {
            // User Base: vede solo le sue azioni
            return data.userId === currentUser.id;
          }
        });
      }

      return rawDocs.map(doc => ({ ...doc.data(), id: doc.id } as LogEntry));
      
    } catch (e: any) {
      console.error("Errore fetch logs:", e);
      // Fallback estremo in caso di errore indici orderBy
      try {
        const fallbackQ = query(logsRef, limit(50));
        const snap = await getDocs(fallbackQ);
        return snap.docs.map(doc => ({...doc.data(), id: doc.id} as LogEntry));
      } catch (err2) {
        return [];
      }
    }
  },

  // Admin Only: Clear all logs
  clearAllLogs: async () => {
    const q = query(collection(db, LOGS_COLLECTION), limit(500)); // Limit batch size for safety
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }
};
