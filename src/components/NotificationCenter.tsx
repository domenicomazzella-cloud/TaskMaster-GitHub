import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from './UI';
import { notificationService } from '../services/notificationService';
import { User } from '../types';

interface NotificationCenterProps {
  currentUser: User;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ currentUser }) => {
  const [permission, setPermission] = React.useState<NotificationPermission>(notificationService.getPermissionState());
  const [isLoading, setIsLoading] = React.useState(false);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const granted = await notificationService.requestPermission();
      setPermission(granted ? 'granted' : notificationService.getPermissionState());
      if (granted) {
        await notificationService.sendNotification('TaskMaster', `Notifiche attivate per ${currentUser.username}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isGranted = permission === 'granted';

  return (
    <div className="flex items-center">
      <Button 
        variant="ghost" 
        size="md"
        onClick={handleRequestPermission}
        isLoading={isLoading}
        className={isGranted ? 'text-green-600 hover:text-green-700' : 'text-slate-500 hover:text-indigo-600'}
        title={isGranted ? 'Notifiche attive' : 'Abilita notifiche'}
        icon={isGranted ? Bell : BellOff}
      />
    </div>
  );
};
