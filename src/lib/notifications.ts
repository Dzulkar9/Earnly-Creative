export interface NotificationItem {
  id: string;
  projectId: number;
  projectTitle: string;
  type: 'pledge' | 'lock_budget' | 'purchase' | 'milestone_vote' | 'milestone_claim' | 'complete' | 'abort' | 'refund';
  amount?: number;
  xlmAmount?: number;
  xlmPrice?: number;
  userAddress: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export function getNotifications(): NotificationItem[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem('earnly_notifications');
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return [];
}

export function saveNotifications(notifications: NotificationItem[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('earnly_notifications', JSON.stringify(notifications));
  }
}

export function addNotification(
  type: NotificationItem['type'],
  projectId: number,
  projectTitle: string,
  userAddress: string,
  message: string,
  amount?: number,
  xlmAmount?: number,
  xlmPrice?: number
): NotificationItem {
  const notifications = getNotifications();
  const newNotif: NotificationItem = {
    id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    projectId,
    projectTitle,
    type,
    amount,
    xlmAmount,
    xlmPrice,
    userAddress,
    message,
    timestamp: Date.now(),
    read: false
  };
  
  notifications.unshift(newNotif);
  // Keep only last 50 notifications
  if (notifications.length > 50) {
    notifications.pop();
  }
  
  saveNotifications(notifications);
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('earnly_new_notification', { detail: newNotif }));
    
    // Asynchronously sync to Supabase transaction history
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNotif)
    }).catch(err => console.error('Error syncing notification to Supabase:', err));
  }
  
  return newNotif;
}

export async function fetchUserTransactions(address: string): Promise<NotificationItem[]> {
  try {
    const res = await fetch(`/api/transactions?address=${address}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch transactions from Supabase:', error);
  }
  return [];
}

export function markAllNotificationsAsRead() {
  const notifications = getNotifications();
  notifications.forEach(n => n.read = true);
  saveNotifications(notifications);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('earnly_notifications_updated'));
  }
}

export function clearNotifications() {
  saveNotifications([]);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('earnly_notifications_updated'));
  }
}
