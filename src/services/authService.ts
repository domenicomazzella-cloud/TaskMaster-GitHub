
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { auth, db, firebaseConfig } from '../firebase';
import { User, UserRole, Team, LogAction } from '../types';
import { logService } from './logService';

const USERS_COLLECTION = 'users';
const TEAMS_COLLECTION = 'teams';

export const authService = {
  // Listener per lo stato di autenticazione
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          // Se l'utente è soft-deleted, forziamo il logout
          if (userData.isDeleted) {
            await signOut(auth);
            callback(null);
            return;
          }
          // Normalizzazione dati per supporto multi-team
          const normalizedUser = {
             ...userData,
             id: firebaseUser.uid,
             email: firebaseUser.email || userData.email,
             teamIds: userData.teamIds || (userData.teamId ? [userData.teamId] : []),
             teamRoles: userData.teamRoles || {}
          };
          callback(normalizedUser);
        } else {
          callback({
            id: firebaseUser.uid,
            username: firebaseUser.displayName || 'Utente',
            email: firebaseUser.email || '',
            role: UserRole.USER,
            teamIds: [],
            teamRoles: {},
            isPending: false,
            isDeleted: false
          });
        }
      } else {
        callback(null);
      }
    });
  },

  register: async (username: string, email: string, password: string): Promise<User> => {
    const q = query(collection(db, USERS_COLLECTION), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    let pendingUserDoc = null;
    
    if (!querySnapshot.empty) {
      pendingUserDoc = querySnapshot.docs[0];
      if (pendingUserDoc.data().isDeleted) throw new Error("Utente eliminato. Contatta l'amministratore.");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    await updateProfile(firebaseUser, { displayName: username });

    let role = UserRole.USER;
    let teamIds: string[] = [];
    let teamRoles: Record<string, UserRole> = {};
    let isPending = false;
    let tempId = null;

    if (pendingUserDoc) {
      const pendingData = pendingUserDoc.data();
      role = pendingData.role;
      // Recupera configurazione team dall'invito
      if (pendingData.teamIds) teamIds = pendingData.teamIds;
      else if (pendingData.teamId) teamIds = [pendingData.teamId];
      
      teamRoles = pendingData.teamRoles || {};
      tempId = pendingData.id;
    } else {
      const allUsers = await getDocs(collection(db, USERS_COLLECTION));
      if (allUsers.empty) {
        role = UserRole.ADMIN;
      }
    }

    const newUser: User = {
      id: firebaseUser.uid,
      username,
      email,
      role,
      teamIds,
      teamRoles,
      isPending,
      isDeleted: false
    };

    const batch = writeBatch(db);
    const newUserRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
    batch.set(newUserRef, newUser);

    if (pendingUserDoc && tempId) {
      batch.delete(pendingUserDoc.ref);
      // Migrazione Task Condivisi
      const tasksRef = collection(db, 'tasks');
      const qTasks = query(tasksRef, where('sharedWith', 'array-contains', tempId));
      const sharedTasksSnapshot = await getDocs(qTasks);

      sharedTasksSnapshot.forEach((taskDoc) => {
        const taskData = taskDoc.data();
        const newSharedWith = (taskData.sharedWith || []).filter((id: string) => id !== tempId);
        newSharedWith.push(firebaseUser.uid);
        batch.update(taskDoc.ref, { sharedWith: newSharedWith });
      });
    }

    await batch.commit();
    await logService.addLog(newUser, LogAction.REGISTER, newUser.id, newUser.username, "Nuova registrazione utente");
    return newUser;
  },

  login: async (email: string, password: string): Promise<void> => {
    let finalEmail = email;
    if (!email.includes('@')) {
      const user = await authService.findUserByUsername(email);
      if (!user) throw { code: 'auth/invalid-credential' };
      if (user.isDisabled) throw { code: 'auth/user-disabled', message: 'Account disabilitato dall\'amministratore.' };
      if (user.isDeleted) throw { code: 'auth/user-disabled', message: 'Account eliminato.' };
      finalEmail = user.email;
    } else {
      const q = query(collection(db, USERS_COLLECTION), where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const u = snap.docs[0].data() as User;
        if (u.isDisabled) throw { code: 'auth/user-disabled', message: 'Account disabilitato dall\'amministratore.' };
        if (u.isDeleted) throw { code: 'auth/user-disabled', message: 'Account eliminato.' };
      }
    }
    await signInWithEmailAndPassword(auth, finalEmail, password);
  },

  logout: async (): Promise<void> => {
    await signOut(auth);
  },

  updatePassword: async (password: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("Utente non autenticato");
    await updatePassword(auth.currentUser, password);
  },

  // --- USER MANAGEMENT (ADMIN) ---

  createWithSecondaryApp: async (email: string, password: string) => {
    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    const secondaryAuth = getAuth(secondaryApp);
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return userCred.user;
  },

  createUserDirectly: async (username: string, email: string, password: string, role: UserRole, teamId?: string, adminUser?: User): Promise<void> => {
    const q = query(collection(db, USERS_COLLECTION), where("email", "==", email));
    const existing = await getDocs(q);
    if (!existing.empty) throw new Error("Utente già presente.");

    const firebaseUser = await authService.createWithSecondaryApp(email, password);
    
    // Configura Team iniziali
    const teamIds = teamId ? [teamId] : [];
    const teamRoles: Record<string, UserRole> = {};
    if (teamId) teamRoles[teamId] = UserRole.USER; // Default member role

    const newUser: User = {
      id: firebaseUser.uid,
      username,
      email,
      role,
      teamIds,
      teamRoles,
      isPending: false,
      isDeleted: false
    };

    await setDoc(doc(db, USERS_COLLECTION, firebaseUser.uid), newUser);

    if (adminUser) {
      await logService.addLog(adminUser, LogAction.REGISTER, newUser.id, newUser.username, `Creato utente ${newUser.username} (${role})`);
    }
  },

  updateUserDetails: async (userId: string, data: Partial<User>, adminUser?: User): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    // Pulizia e sicurezza update
    const safeUpdate: any = {};
    if (data.username !== undefined) safeUpdate.username = data.username;
    if (data.role !== undefined) safeUpdate.role = data.role;
    
    // Gestione legacy teamId -> teamIds
    if (data.teamId !== undefined) {
       safeUpdate.teamId = null; // Rimuovi campo deprecato
       safeUpdate.teamIds = data.teamId ? [data.teamId] : [];
       safeUpdate.teamRoles = data.teamId ? { [data.teamId]: UserRole.USER } : {};
    }

    await updateDoc(userRef, safeUpdate);
    if (adminUser) {
      await logService.addLog(adminUser, LogAction.UPDATE, userId, data.username || userId, "Modifica profilo utente");
    }
  },

  toggleUserStatus: async (userId: string, isDisabled: boolean, adminUser?: User): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { isDisabled });
    if (adminUser) {
      await logService.addLog(adminUser, LogAction.UPDATE, userId, "Utente", isDisabled ? "Accesso Disabilitato (Standby)" : "Accesso Riabilitato");
    }
  },

  softDeleteUser: async (userId: string, adminUser?: User) => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { isDeleted: true });
    if (adminUser) await logService.addLog(adminUser, LogAction.DELETE, userId, "Utente", "Utente spostato nel cestino (Soft Delete)");
  },

  restoreUser: async (userId: string, adminUser?: User) => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { isDeleted: false });
    if (adminUser) await logService.addLog(adminUser, LogAction.UPDATE, userId, "Utente", "Ripristino utente eliminato");
  },

  deleteUser: async (userId: string) => {
    await deleteDoc(doc(db, USERS_COLLECTION, userId));
  },

  adminResetPassword: async (email: string, adminUser?: User) => {
    await sendPasswordResetEmail(auth, email);
    if (adminUser) await logService.addLog(adminUser, LogAction.PASSWORD_CHANGE, email, "Email", "Inviata email reset password");
  },

  getAllUsers: async (): Promise<User[]> => {
    const snapshot = await getDocs(collection(db, USERS_COLLECTION));
    return snapshot.docs.map(doc => {
        const data = doc.data() as User;
        // Normalizza al volo per il frontend
        return {
            ...data,
            teamIds: data.teamIds || (data.teamId ? [data.teamId] : []),
            teamRoles: data.teamRoles || {}
        };
    });
  },
  
  searchUsers: async (searchTerm: string): Promise<User[]> => {
    if (!searchTerm || searchTerm.length < 1) return [];
    const allUsers = await authService.getAllUsers();
    const lowerTerm = searchTerm.toLowerCase();
    return allUsers.filter(u => 
      !u.isDeleted && (
        u.username.toLowerCase().includes(lowerTerm) || 
        (u.email && u.email.toLowerCase().includes(lowerTerm))
      )
    ).slice(0, 5); 
  },

  findUserByUsername: async (username: string): Promise<User | null> => {
    const q = query(collection(db, USERS_COLLECTION), where("username", "==", username));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as User;
  },

  getUsernameById: async (id: string): Promise<string> => {
    try {
      const docRef = doc(db, USERS_COLLECTION, id);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data().username : 'Sconosciuto';
    } catch {
      return 'Sconosciuto';
    }
  },

  // --- TEAM MANAGEMENT (MULTI-TEAM) ---

  createTeam: async (name: string, adminUser?: User): Promise<void> => {
    const newTeam: Team = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, TEAMS_COLLECTION, newTeam.id), newTeam);
    
    if (adminUser) {
      await logService.addLog(adminUser, LogAction.TEAM_CREATE, newTeam.id, name, "Team creato");
    }
  },

  updateTeamName: async (teamId: string, name: string, adminUser?: User): Promise<void> => {
    const teamRef = doc(db, TEAMS_COLLECTION, teamId);
    await updateDoc(teamRef, { name });
    
    if (adminUser) {
      await logService.addLog(adminUser, LogAction.TEAM_UPDATE, teamId, name, "Rinominato team");
    }
  },

  getTeams: async (): Promise<Team[]> => {
    const snapshot = await getDocs(collection(db, TEAMS_COLLECTION));
    return snapshot.docs.map(doc => doc.data() as Team);
  },

  deleteTeam: async (teamId: string, adminUser?: User): Promise<void> => {
    await deleteDoc(doc(db, TEAMS_COLLECTION, teamId));
    
    // Rimuovi il team da tutti gli utenti che lo hanno
    const allUsers = await authService.getAllUsers();
    const usersInTeam = allUsers.filter(u => u.teamIds?.includes(teamId));
    
    const batch = writeBatch(db);
    for (const user of usersInTeam) {
        const userRef = doc(db, USERS_COLLECTION, user.id);
        const newTeamIds = (user.teamIds || []).filter(id => id !== teamId);
        const newTeamRoles = { ...user.teamRoles };
        delete newTeamRoles[teamId];
        batch.update(userRef, { teamIds: newTeamIds, teamRoles: newTeamRoles });
    }
    await batch.commit();

    if (adminUser) {
      await logService.addLog(adminUser, LogAction.TEAM_DELETE, teamId, "Team", "Team eliminato");
    }
  },

  // Aggiunge utente a un team specifico (senza rimuoverlo da altri)
  addUserToTeam: async (userId: string, teamId: string, adminUser?: User): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    // Usa arrayUnion per non duplicare ID
    await updateDoc(userRef, {
        teamIds: arrayUnion(teamId),
        [`teamRoles.${teamId}`]: UserRole.USER // Ruolo default nel team
    });

    if (adminUser) {
      await logService.addLog(adminUser, LogAction.TEAM_UPDATE, teamId, userId, "Aggiunto utente al team");
    }
  },

  // Rimuove utente da un team specifico
  removeUserFromTeam: async (userId: string, teamId: string, adminUser?: User): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data() as User;
    const newRoles = { ...userData.teamRoles };
    delete newRoles[teamId];

    await updateDoc(userRef, {
        teamIds: arrayRemove(teamId),
        teamRoles: newRoles
    });

    if (adminUser) {
      await logService.addLog(adminUser, LogAction.TEAM_UPDATE, teamId, userId, "Rimosso utente dal team");
    }
  },

  // Aggiorna il ruolo specifico in un team (Leader vs Member)
  setTeamRole: async (userId: string, teamId: string, role: UserRole, adminUser?: User): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
        [`teamRoles.${teamId}`]: role
    });

    if (adminUser) {
      const roleName = role === UserRole.MANAGER ? "Team Leader" : "Membro";
      await logService.addLog(adminUser, LogAction.TEAM_UPDATE, teamId, userId, `Modificato ruolo team a: ${roleName}`);
    }
  },

  updateUserRole: async (userId: string, role: UserRole): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { role });
  }
};
