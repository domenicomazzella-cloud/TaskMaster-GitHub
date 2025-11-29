
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot,
  orderBy,
  getDocs,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Task, User, LogAction, Project, AppNotification } from '../types';
import { logService } from './logService';

const TASKS_COLLECTION = 'tasks';
const PROJECTS_COLLECTION = 'projects';
const NOTIFICATIONS_COLLECTION = 'notifications';

// Utility per rimuovere campi undefined (Firestore non li accetta)
const cleanData = (data: any) => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

// --- Notification Helpers ---
const sendNotifications = async (
  recipientIds: string[], 
  title: string, 
  message: string, 
  link: string, 
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' = 'INFO'
) => {
  if (recipientIds.length === 0) return;
  
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  recipientIds.forEach(userId => {
    const newRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
    const notif: AppNotification = {
      id: newRef.id,
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: now,
      link
    };
    batch.set(newRef, notif);
  });

  await batch.commit();
};

export const dataService = {
  // Ascolta i task in tempo reale
  subscribeToTasks: (callback: (tasks: Task[]) => void) => {
    const q = query(collection(db, TASKS_COLLECTION), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => {
        const data = doc.data();
        // Backward compatibility: map projectId to projectIds if projectIds is missing
        let projectIds = data.projectIds || [];
        if (projectIds.length === 0 && data.projectId) {
          projectIds = [data.projectId];
        }

        return {
          ...data,
          id: doc.id,
          projectIds
        };
      }) as Task[];
      callback(tasks);
    });
  },

  createTask: async (task: Omit<Task, 'id' | 'createdAt'>, currentUser: User) => {
    const rawData = {
      ...task,
      createdAt: new Date().toISOString()
    };
    
    // RIMUOVE I CAMPI UNDEFINED (es. projectId se non selezionato)
    const taskData = cleanData(rawData);

    // Rimuoviamo projectId legacy se presente nei dati raw, usiamo solo projectIds
    if (taskData.projectId) delete taskData.projectId;

    const docRef = await addDoc(collection(db, TASKS_COLLECTION), taskData);
    
    // Log
    await logService.addLog(
      currentUser, 
      LogAction.CREATE, 
      docRef.id, 
      task.title, 
      "Task creato"
    );

    // Notifiche: Condivisi
    if (task.sharedWith && task.sharedWith.length > 0) {
      await sendNotifications(
        task.sharedWith.filter(id => id !== currentUser.id),
        "Nuovo Task Condiviso",
        `${currentUser.username} ha condiviso con te: "${task.title}"`,
        `/task/${docRef.id}`
      );
    }
  },

  updateTask: async (taskId: string, updates: Partial<Task>, currentUser: User, originalTaskTitle?: string) => {
    const docRef = doc(db, TASKS_COLLECTION, taskId);
    
    // RIMUOVE I CAMPI UNDEFINED
    const updatesCleaned = cleanData(updates);
    
    // Cleanup legacy
    if (updatesCleaned.projectId) delete updatesCleaned.projectId;

    await updateDoc(docRef, updatesCleaned);

    // Determina tipo di log
    const title = updates.title || originalTaskTitle || "Task sconosciuto";
    let action = LogAction.UPDATE;
    let details = "Task modificato";

    if (updates.status) {
      action = LogAction.STATUS_CHANGE;
      details = `Stato cambiato in ${updates.status}`;
    } else if (updates.sharedWith) {
      details = `Modifica condivisioni`;
    }

    await logService.addLog(
      currentUser,
      action,
      taskId,
      title,
      details
    );

    // Notifiche Update: Proprietario + Condivisi (escluso chi ha fatto l'update)
    // Per semplificare, qui notifichiamo solo se c'è un campo rilevante cambiato (status, commenti, etc)
    // In una app reale recupereremmo prima il task per avere la lista completa di sharedWith
    // Qui assumiamo che updates.sharedWith contenga la lista aggiornata o non notifichiamo tutti
  },

  deleteTask: async (taskId: string, currentUser: User, taskTitle: string) => {
    await deleteDoc(doc(db, TASKS_COLLECTION, taskId));
    
    await logService.addLog(
      currentUser,
      LogAction.DELETE,
      taskId,
      taskTitle,
      "Task eliminato"
    );
  },

  // --- PROJECTS ---

  subscribeToProjects: (callback: (projects: Project[]) => void) => {
    const q = query(collection(db, PROJECTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Project[];
      callback(projects);
    });
  },

  createProject: async (projectData: Partial<Project>, currentUser: User) => {
    const project: Omit<Project, 'id'> = {
      title: projectData.title || 'Nuovo Progetto',
      description: projectData.description || '',
      ownerId: currentUser.id,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      sharedWith: projectData.sharedWith || [],
      teamIds: projectData.teamIds || [],
      responsibleIds: projectData.responsibleIds || [],
      parentProjectId: projectData.parentProjectId || undefined, 
      priority: projectData.priority || undefined
    };
    
    const cleaned = cleanData(project);
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), cleaned);

    await logService.addLog(
      currentUser,
      LogAction.PROJECT_CREATE,
      docRef.id,
      project.title,
      project.parentProjectId ? "Nuovo Sotto-Progetto creato" : "Nuovo Progetto creato"
    );

    // Notifica Team/Leader
    const recipients = [...(project.sharedWith || []), ...(project.responsibleIds || [])]
      .filter((id, index, self) => id !== currentUser.id && self.indexOf(id) === index);
    
    if (recipients.length > 0) {
      await sendNotifications(
        recipients,
        "Nuovo Progetto",
        `Sei stato aggiunto al progetto: "${project.title}"`,
        `/project/${docRef.id}`
      );
    }
  },

  updateProject: async (projectId: string, updates: Partial<Project>, currentUser: User, originalTitle: string) => {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId);
    
    const updatesCleaned = cleanData(updates);
    await updateDoc(docRef, updatesCleaned);

    let details = "Progetto aggiornato";
    if (updates.status) details = `Stato progetto: ${updates.status}`;

    await logService.addLog(
      currentUser,
      LogAction.PROJECT_UPDATE,
      projectId,
      updates.title || originalTitle,
      details
    );
  },

  deleteProject: async (projectId: string, currentUser: User, originalTitle: string) => {
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
    
    await logService.addLog(
      currentUser,
      LogAction.PROJECT_DELETE,
      projectId,
      originalTitle,
      "Progetto eliminato"
    );
  },

  // --- NOTIFICATIONS ---
  
  subscribeToNotifications: (userId: string, callback: (notifs: AppNotification[]) => void) => {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION), 
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      // limit(20) // Opzionale
    );
    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => doc.data() as AppNotification);
      callback(notifs);
    });
  },

  markNotificationRead: async (notifId: string) => {
    // Note: Since we are querying, getting doc ID is tricky if we store ID inside data.
    // In subscribeToNotifications map, we should probably verify doc.id matches.
    // Assuming AppNotification.id corresponds to document ID.
    const ref = doc(db, NOTIFICATIONS_COLLECTION, notifId);
    await updateDoc(ref, { read: true });
  },

  markAllNotificationsRead: async (userId: string) => {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), where("userId", "==", userId), where("read", "==", false));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  },

  // --- MAINTENANCE (ADMIN ONLY) ---

  deleteOrphanTasks: async (currentUser: User) => {
    // Trova task senza ownerId o con ownerId non valido (richiede un controllo incrociato con users, 
    // ma qui semplifichiamo: task con ownerId mancante)
    // Firestore non supporta query "where field is null" facilmente, facciamo una query generica e filtriamo
    const q = query(collection(db, TASKS_COLLECTION));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.ownerId) {
        batch.delete(doc.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      await logService.addLog(currentUser, LogAction.DELETE, "maintenance", "System", `Eliminati ${count} task orfani`);
    }
    return count;
  },

  deleteArchivedProjects: async (currentUser: User) => {
    const q = query(collection(db, PROJECTS_COLLECTION), where("status", "==", "ARCHIVED"));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    const count = snapshot.size;

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (count > 0) {
      await batch.commit();
      await logService.addLog(currentUser, LogAction.DELETE, "maintenance", "System", `Eliminati ${count} progetti archiviati`);
    }
    return count;
  }
};
