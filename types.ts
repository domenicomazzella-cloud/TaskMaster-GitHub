
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum TaskPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER', // Usato globalmente o come ruolo specifico nel team
  USER = 'USER',
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole; // Ruolo Globale (Admin vs Standard)
  
  // Multi-Team Support
  teamId?: string; // DEPRECATO (Mantenuto per retrocompatibilità temporanea)
  teamIds?: string[]; // Lista degli ID dei team a cui appartiene
  teamRoles?: Record<string, UserRole>; // Mappa { teamId: UserRole } per definire se è LEADER o MEMBER in quello specifico team

  isPending: boolean; 
  isDisabled?: boolean;
  photoURL?: string;
  isDeleted?: boolean;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  // Status aggiornato
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  
  // New fields for Project-as-Task parity
  sharedWith?: string[];
  teamIds?: string[];
  responsibleIds?: string[]; // Leaders
  priority?: TaskPriority;
  dueDate?: string;

  // Hierarchy
  parentProjectId?: string; // ID del progetto padre (se questo è un sotto-progetto)
}

export interface Attachment {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'FILE';
  data: string; 
  size: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  tags: string[];
  status: TaskStatus;
  priority?: TaskPriority; 
  createdAt: string; 
  dueDate?: string; 
  ownerId: string;
  ownerUsername?: string; 
  sharedWith: string[]; 
  attachments?: Attachment[];
  
  // Multi-Project Support
  projectIds?: string[]; // Array di ID dei progetti a cui appartiene
  projectId?: string; // DEPRECATO (Mantenuto per retrocompatibilità in lettura)
  
  // Dependencies
  dependencyIds?: string[]; // Task che devono essere completati prima di questo
}

export interface TagSuggestionRequest {
  title: string;
  description?: string;
}

export type ThemeColor = 'blue' | 'green' | 'yellow' | 'red' | 'gray';

// --- LOGGING TYPES ---

export enum LogAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  REGISTER = 'REGISTER',
  // New granular actions
  PROJECT_CREATE = 'PROJECT_CREATE',
  PROJECT_UPDATE = 'PROJECT_UPDATE',
  PROJECT_DELETE = 'PROJECT_DELETE',
  TEAM_CREATE = 'TEAM_CREATE',
  TEAM_UPDATE = 'TEAM_UPDATE',
  TEAM_DELETE = 'TEAM_DELETE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE'
}

export interface LogEntry {
  id: string;
  action: LogAction;
  userId: string;       // Chi ha fatto l'azione
  username: string;     // Nome di chi ha fatto l'azione
  teamId?: string;      // Team di appartenenza (per filtraggio Manager)
  targetId: string;     // ID dell'oggetto (Task ID)
  targetTitle: string;  // Titolo del task (per leggibilità)
  details: string;      // Descrizione leggibile (es. "Status cambiato da TODO a DONE")
  timestamp: string;    // ISO Date
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  read: boolean;
  createdAt: string;
  link?: string;
}
