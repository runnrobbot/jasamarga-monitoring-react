import { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  if (!user || !user.uid) {
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
    return;
  }

  console.log('📬 Setting up notification listeners for:', user.username, 'role:', user.role);
  setLoading(true);

  const validRoles = ['admin', 'pic'];
  if (!validRoles.includes(user.role)) {
    console.warn('⚠️ Invalid role for notifications:', user.role);
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
    return;
  }

  let isMounted = true;
  const allNotifications = new Map();
  let listenersReady = 0;
  const totalListeners = 5; // 
  const unsubscribers = [];

  const updateNotifications = () => {
    if (!isMounted) return;
    
    const notifArray = Array.from(allNotifications.values())
      .filter(n => n.createdAt)
      .sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      })
      .slice(0, 50);
    
    setNotifications(notifArray);
    setUnreadCount(notifArray.filter(n => !n.read).length);
    
    if (listenersReady === totalListeners) {
      setLoading(false);
    }

    console.log('📬 Notifications updated:', {
      total: notifArray.length,
      unread: notifArray.filter(n => !n.read).length,
      role: user.role
    });
  };

  const query1 = query(
    collection(db, 'notifications'),
    where('uid', '==', user.uid)
  );

  const query2 = query(
    collection(db, 'notifications'),
    where('userId', '==', user.uid)
  );

  const query3 = query(
    collection(db, 'notifications'),
    where('uid', '==', 'system'),
    where('targetRoles', '==', 'all')
  );

  const query4 = query(
    collection(db, 'notifications'),
    where('uid', '==', 'system'),
    where('targetRoles', '==', user.role)
  );

  const query5 = query(
    collection(db, 'notifications'),
    where('targetRoles', '==', user.role)
  );

  // Setup listeners for all queries
  [query1, query2, query3, query4, query5].forEach((q, index) => {
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted) return;
        console.log(`📥 Query ${index + 1} received:`, snapshot.size);
        
        snapshot.forEach((doc) => {
          allNotifications.set(doc.id, {
            id: doc.id,
            ...doc.data()
          });
        });
        
        listenersReady++;
        updateNotifications();
      },
      (error) => {
        if (!isMounted) return;
        listenersReady++;
        updateNotifications();
      }
    );
    
    unsubscribers.push(unsubscribe);
  });

  return () => {
    console.log('🔌 Cleaning up notification listeners');
    isMounted = false;
    unsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') {
        try {
          unsub();
        } catch (error) {
          console.warn('Warning during cleanup:', error);
        }
      }
    });
  };
}, [user]);

  const value = {
    notifications,
    unreadCount,
    loading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;