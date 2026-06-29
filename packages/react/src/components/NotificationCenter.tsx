import React, { useState, useEffect } from 'react';

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  timestamp: string;
  transactionId?: string;
  category?: string;
}

export interface NotificationPreferences {
  system: boolean;
  transactions: boolean;
  alerts: boolean;
}

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    system: true,
    transactions: true,
    alerts: true,
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Connect to real-time notification service
    const eventSource = new EventSource('/api/notifications/stream');
    
    eventSource.onmessage = (event) => {
      const newNotification = JSON.parse(event.data);
      setNotifications((prev) => [newNotification, ...prev]);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    // Ideally this would sync with a backend endpoint for user preferences
  };

  const groupedNotifications = notifications.reduce((acc, notif) => {
    const category = notif.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(notif);
    return acc;
  }, {} as Record<string, Notification[]>);

  return (
    <div className="notification-center">
      <button onClick={() => setIsOpen(!isOpen)}>
        Notifications ({notifications.filter((n) => !n.read).length})
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="preferences">
            <h4>Preferences</h4>
            <label>
              <input
                type="checkbox"
                checked={preferences.system}
                onChange={() => togglePreference('system')}
              />
              System
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences.transactions}
                onChange={() => togglePreference('transactions')}
              />
              Transactions
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences.alerts}
                onChange={() => togglePreference('alerts')}
              />
              Alerts
            </label>
          </div>

          <div className="notifications-list">
            {Object.keys(groupedNotifications).map((category) => (
              <div key={category} className="notification-group">
                <h4>{category}</h4>
                {groupedNotifications[category]
                  .filter((n) => preferences[n.type as keyof NotificationPreferences] ?? true)
                  .map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                    >
                      <p>{notif.message}</p>
                      <small>{new Date(notif.timestamp).toLocaleString()}</small>
                      {!notif.read && (
                        <button onClick={() => markAsRead(notif.id)}>Mark as read</button>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
