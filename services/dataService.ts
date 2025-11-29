
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { Task, User, LogAction, Project } from '../types';
import { logService } from './logService';

const TASKS_COLLECTION = 'tasks';
const PROJECTS_COLLECTION = 'projects';

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
      parentProjectId: projectData.parentProjectId || undefined, // Supporto Sub-Progetti
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
  }
};
