
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
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Task, User, LogAction, Project, AppNotification, Duty, Routine, TaskPriority, TaskStatus } from '../types';
import { logService } from './logService';

const TASKS_COLLECTION = 'tasks';
const PROJECTS_COLLECTION = 'projects';
const NOTIFICATIONS_COLLECTION = 'notifications';
const DUTIES_COLLECTION = 'duties';
const ROUTINES_COLLECTION = 'routines';

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
      priority: projectData.priority || undefined,
      isRoutineInstance: projectData.isRoutineInstance || false
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
    
    return docRef.id;
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

  // --- DUTIES (MANSIONI) ---

  getDuties: async (): Promise<Duty[]> => {
    const q = query(collection(db, DUTIES_COLLECTION), orderBy('title', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Duty));
  },

  createDuty: async (duty: Omit<Duty, 'id'>) => {
    await addDoc(collection(db, DUTIES_COLLECTION), duty);
  },

  deleteDuty: async (id: string) => {
    await deleteDoc(doc(db, DUTIES_COLLECTION, id));
  },

  // --- ROUTINES ---

  getRoutines: async (): Promise<Routine[]> => {
    const q = query(collection(db, ROUTINES_COLLECTION), orderBy('title', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
  },

  createRoutine: async (routine: Omit<Routine, 'id' | 'createdAt'>, currentUser: User) => {
    const data = {
      ...routine,
      createdAt: new Date().toISOString()
    };
    const ref = await addDoc(collection(db, ROUTINES_COLLECTION), data);
    await logService.addLog(currentUser, LogAction.ROUTINE_CREATE, ref.id, routine.title, "Creata nuova routine");
  },

  deleteRoutine: async (id: string) => {
    await deleteDoc(doc(db, ROUTINES_COLLECTION, id));
  },

  // --- ROUTINE ASSIGNMENT LOGIC ---
  
  assignRoutineToUser: async (
    routineId: string, 
    userId: string, 
    date: string, 
    adminUser: User
  ): Promise<void> => {
    // 1. Recupera Routine e Mansioni
    const routineDoc = await getDoc(doc(db, ROUTINES_COLLECTION, routineId));
    if (!routineDoc.exists()) throw new Error("Routine non trovata");
    const routine = routineDoc.data() as Routine;

    const dutyPromises = routine.dutyIds.map(did => getDoc(doc(db, DUTIES_COLLECTION, did)));
    const dutyDocs = await Promise.all(dutyPromises);
    const duties = dutyDocs.map(d => d.data() as Duty).filter(d => !!d);

    // 2. Crea Progetto Contenitore (Es. "Routine Pulizia - 2025-10-10")
    const projectTitle = `Routine: ${routine.title} - ${new Date(date).toLocaleDateString()}`;
    const projectId = await dataService.createProject({
      title: projectTitle,
      description: `Esecuzione routine programmata (${routine.frequency}).\n${routine.description || ''}`,
      ownerId: adminUser.id, // L'admin possiede il record generato
      sharedWith: [userId], // Condiviso con l'esecutore
      responsibleIds: [userId], // L'esecutore è responsabile
      priority: TaskPriority.MEDIUM,
      dueDate: date,
      isRoutineInstance: true
    }, adminUser);

    // 3. Crea i Task per ogni Mansione
    const batch = writeBatch(db);
    
    duties.forEach(duty => {
      const taskRef = doc(collection(db, TASKS_COLLECTION));
      const newTask: any = {
        title: duty.title,
        description: duty.description || `Mansione parte della routine ${routine.title}`,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        ownerId: adminUser.id, // Creato da admin
        ownerUsername: adminUser.username,
        sharedWith: [userId], // Visibile all'utente
        projectIds: [projectId], // Collegato al progetto routine
        tags: ['Routine', 'Auto-Generated'],
        createdAt: new Date().toISOString(),
        dueDate: date
      };
      batch.set(taskRef, newTask);
    });

    await batch.commit();

    // 4. Log e Notifica
    await logService.addLog(adminUser, LogAction.ROUTINE_ASSIGN, projectId, routine.title, `Assegnata routine a utente ${userId}`);
    await sendNotifications(
      [userId], 
      "Nuova Routine Assegnata", 
      `Ti è stata assegnata la routine "${routine.title}" per il giorno ${new Date(date).toLocaleDateString()}`,
      `/project/${projectId}`
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
