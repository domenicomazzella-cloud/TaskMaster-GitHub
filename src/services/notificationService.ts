

export const notificationService = {
  // Richiede il permesso all'utente
  requestPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  // Controlla lo stato attuale del permesso
  getPermissionState: (): NotificationPermission => {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  },

  // Invia una notifica tramite il Service Worker
  sendNotification: async (title: string, body: string, tag?: string) => {
    if (Notification.permission !== 'granted') return;

    // Controlla se abbiamo già inviato questa notifica (per evitare spam)
    if (tag) {
      const alreadyNotified = localStorage.getItem(`notified_${tag}`);
      if (alreadyNotified) return;
      
      // Salva nel localStorage che abbiamo notificato questo evento
      localStorage.setItem(`notified_${tag}`, 'true');
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      // Fix: Cast to any because vibrate might not be in the default NotificationOptions type definition
      await registration.showNotification(title, {
        body,
        icon: 'https://unpkg.com/lucide-static@latest/icons/layout.svg', // Icona placeholder
        badge: 'https://unpkg.com/lucide-static@latest/icons/check-square.svg',
        tag: tag, // Il tag impedisce notifiche duplicate native del browser se ravvicinate
        vibrate: [200, 100, 200]
      } as any);
    } catch (e) {
      console.error("Errore invio notifica:", e);
      // Fallback per browser senza SW attivo in dev
      new Notification(title, { body, icon: '/icon.png' });
    }
  },

  // Resetta lo stato delle notifiche per un task (es. se la data cambia)
  resetNotificationState: (taskId: string) => {
    localStorage.removeItem(`notified_deadline_${taskId}`);
  }
};
