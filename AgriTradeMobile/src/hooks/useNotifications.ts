import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSelector, useDispatch } from 'react-redux';
import { 
  NotificationData, 
  SMSMessage, 
  PushNotificationPermission,
  SupportedLanguage 
} from '@/types';
import { pushNotificationService } from '@/services/pushNotificationService';
import { smsService } from '@/services/smsService';
import { RootState } from '@/store';

/**
 * Hook for push notifications
 */
export const usePushNotifications = () => {
  const dispatch = useDispatch();
  const currentLanguage = useSelector((state: RootState) => state.auth.user?.language || 'en') as SupportedLanguage;
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PushNotificationPermission>('unknown');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    initializePushNotifications();
    
    return () => {
      pushNotificationService.cleanup();
    };
  }, []);

  useEffect(() => {
    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isInitialized) {
        // Process offline queue when app becomes active
        pushNotificationService.processOfflineQueue();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isInitialized]);

  const initializePushNotifications = async () => {
    try {
      await pushNotificationService.initialize({
        onNotificationReceived: (notification) => {
          setNotifications(prev => [notification, ...prev]);
          if (!notification.read) {
            setUnreadCount(prev => prev + 1);
          }
          
          // Dispatch to Redux store if needed
          // dispatch(addNotification(notification));
        },
        onNotificationOpened: (notification) => {
          // Handle navigation based on notification type
          handleNotificationNavigation(notification);
          
          // Mark as read
          markAsRead(notification.id);
        },
        onTokenRefresh: (token) => {
          setFcmToken(token);
          // Send token to backend
          updateFCMTokenOnServer(token);
        },
      });

      const permission = await pushNotificationService.getPermissionStatus();
      setPermissionStatus(permission);

      const token = await pushNotificationService.getFCMToken();
      setFcmToken(token);

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  };

  const requestPermission = useCallback(async () => {
    try {
      const permission = await pushNotificationService.requestPermissions();
      setPermissionStatus(permission);
      return permission;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return 'denied';
    }
  }, []);

  const sendLocalNotification = useCallback(async (notification: NotificationData) => {
    try {
      await pushNotificationService.sendLocalNotification(notification);
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  }, []);

  const scheduleNotification = useCallback(async (
    notification: NotificationData,
    scheduledTime: Date
  ) => {
    try {
      return await pushNotificationService.scheduleNotification(notification, scheduledTime);
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      throw error;
    }
  }, []);

  const cancelScheduledNotification = useCallback(async (notificationId: string) => {
    try {
      await pushNotificationService.cancelScheduledNotification(notificationId);
    } catch (error) {
      console.error('Failed to cancel scheduled notification:', error);
    }
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
  }, []);

  const clearAllNotifications = useCallback(async () => {
    try {
      await pushNotificationService.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }, []);

  const handleNotificationNavigation = (notification: NotificationData) => {
    // This would be implemented based on your navigation structure
    console.log('Handle notification navigation:', notification);
  };

  const updateFCMTokenOnServer = async (token: string) => {
    try {
      // Send token to your backend
      const response = await fetch('/api/notifications/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, language: currentLanguage }),
      });
      
      if (response.ok) {
        console.log('FCM token updated on server');
      }
    } catch (error) {
      console.error('Failed to update FCM token on server:', error);
    }
  };

  return {
    isInitialized,
    permissionStatus,
    fcmToken,
    notifications,
    unreadCount,
    requestPermission,
    sendLocalNotification,
    scheduleNotification,
    cancelScheduledNotification,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
  };
};

/**
 * Hook for SMS functionality
 */
export const useSMS = () => {
  const currentLanguage = useSelector((state: RootState) => state.auth.user?.language || 'en') as SupportedLanguage;
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [smsHistory, setSmsHistory] = useState<SMSMessage[]>([]);
  const [queueStatus, setQueueStatus] = useState({ count: 0, items: [] });

  useEffect(() => {
    initializeSMS();
    setupNetworkListener();
    
    return () => {
      smsService.cleanup();
    };
  }, []);

  const initializeSMS = async () => {
    try {
      await smsService.initialize(
        {
          apiKey: process.env.SMS_API_KEY,
          apiUrl: process.env.SMS_API_URL,
          senderId: 'AgriTrade',
          enableOfflineQueue: true,
        },
        {
          onSMSSent: (message) => {
            setSmsHistory(prev => [message, ...prev]);
            updateQueueStatus();
          },
          onSMSFailed: (message, error) => {
            console.error('SMS failed:', error);
            setSmsHistory(prev => [message, ...prev]);
          },
        }
      );

      setIsInitialized(true);
      updateQueueStatus();
    } catch (error) {
      console.error('Failed to initialize SMS service:', error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online);
      smsService.setOnlineStatus(online);
      
      if (online) {
        updateQueueStatus();
      }
    });

    return unsubscribe;
  };

  const updateQueueStatus = () => {
    const status = smsService.getQueueStatus();
    setQueueStatus(status);
  };

  const sendSMS = useCallback(async (
    phoneNumber: string,
    message: string,
    templateId?: string,
    variables?: Record<string, string>
  ) => {
    try {
      const result = await smsService.sendSMS(phoneNumber, message, templateId, variables);
      updateQueueStatus();
      return result;
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw error;
    }
  }, []);

  const sendVerificationCode = useCallback(async (phoneNumber: string, code: string) => {
    try {
      return await smsService.sendVerificationCode(phoneNumber, code, currentLanguage);
    } catch (error) {
      console.error('Failed to send verification code:', error);
      throw error;
    }
  }, [currentLanguage]);

  const sendOrderConfirmation = useCallback(async (
    phoneNumber: string,
    orderData: {
      orderNumber: string;
      farmerName: string;
      productName: string;
      deliveryDate: string;
      amount: string;
    }
  ) => {
    try {
      return await smsService.sendOrderConfirmation(phoneNumber, orderData, currentLanguage);
    } catch (error) {
      console.error('Failed to send order confirmation:', error);
      throw error;
    }
  }, [currentLanguage]);

  const sendPriceAlert = useCallback(async (
    phoneNumber: string,
    priceData: {
      productName: string;
      newPrice: string;
      change: string;
      marketName: string;
    }
  ) => {
    try {
      return await smsService.sendPriceAlert(phoneNumber, priceData, currentLanguage);
    } catch (error) {
      console.error('Failed to send price alert:', error);
      throw error;
    }
  }, [currentLanguage]);

  const sendQualityResult = useCallback(async (
    phoneNumber: string,
    qualityData: {
      productName: string;
      qualityScore: string;
      estimatedPrice: string;
    }
  ) => {
    try {
      return await smsService.sendQualityResult(phoneNumber, qualityData, currentLanguage);
    } catch (error) {
      console.error('Failed to send quality result:', error);
      throw error;
    }
  }, [currentLanguage]);

  const openSMSApp = useCallback(async (phoneNumber?: string, message?: string) => {
    try {
      await smsService.openSMSApp(phoneNumber, message);
    } catch (error) {
      console.error('Failed to open SMS app:', error);
    }
  }, []);

  const generateMessage = useCallback((
    templateId: string,
    variables: Record<string, string> = {}
  ) => {
    return smsService.generateMessageFromTemplate(templateId, variables, currentLanguage);
  }, [currentLanguage]);

  const clearQueue = useCallback(async () => {
    try {
      await smsService.clearQueue();
      updateQueueStatus();
    } catch (error) {
      console.error('Failed to clear SMS queue:', error);
    }
  }, []);

  const getTemplates = useCallback(() => {
    return smsService.getTemplates();
  }, []);

  return {
    isInitialized,
    isOnline,
    smsHistory,
    queueStatus,
    sendSMS,
    sendVerificationCode,
    sendOrderConfirmation,
    sendPriceAlert,
    sendQualityResult,
    openSMSApp,
    generateMessage,
    clearQueue,
    getTemplates,
  };
};

/**
 * Combined hook for all notification functionality
 */
export const useNotifications = () => {
  const pushNotifications = usePushNotifications();
  const sms = useSMS();

  const sendEmergencyNotification = useCallback(async (
    message: string,
    phoneNumbers: string[],
    useBotsChannels = true
  ) => {
    try {
      const promises: Promise<any>[] = [];

      // Send push notification if enabled
      if (useBotsChannels && pushNotifications.isInitialized) {
        promises.push(
          pushNotifications.sendLocalNotification({
            id: Date.now().toString(),
            title: 'Emergency Alert',
            message,
            type: 'system',
            category: 'emergency',
            timestamp: new Date().toISOString(),
            read: false,
            actionable: true,
            priority: 'high',
          })
        );
      }

      // Send SMS to all phone numbers
      phoneNumbers.forEach(phoneNumber => {
        promises.push(sms.sendSMS(phoneNumber, message));
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to send emergency notification:', error);
      throw error;
    }
  }, [pushNotifications, sms]);

  return {
    pushNotifications,
    sms,
    sendEmergencyNotification,
  };
};

/**
 * Hook for offline notification management
 */
export const useOfflineNotifications = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [offlineActions, setOfflineActions] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online);
      
      if (online) {
        processOfflineActions();
      }
    });

    return unsubscribe;
  }, []);

  const addOfflineAction = useCallback((action: any) => {
    setOfflineActions(prev => [...prev, action]);
  }, []);

  const processOfflineActions = useCallback(async () => {
    if (offlineActions.length === 0) return;

    try {
      // Process all offline actions
      for (const action of offlineActions) {
        // Handle different types of offline actions
        console.log('Processing offline action:', action);
      }

      setOfflineActions([]);
    } catch (error) {
      console.error('Failed to process offline actions:', error);
    }
  }, [offlineActions]);

  return {
    isOnline,
    offlineActions,
    addOfflineAction,
    processOfflineActions,
  };
};