import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { 
  AndroidImportance, 
  AndroidStyle, 
  EventType,
  Notification as NotifeeNotification,
  AndroidChannel,
} from '@notifee/react-native';
import { Platform, AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationData, PushNotificationPermission, OfflineMessage } from '@/types';

interface NotificationServiceCallbacks {
  onNotificationReceived?: (notification: NotificationData) => void;
  onNotificationOpened?: (notification: NotificationData) => void;
  onTokenRefresh?: (token: string) => void;
}

class PushNotificationService {
  private isInitialized = false;
  private callbacks: NotificationServiceCallbacks = {};
  private fcmToken: string | null = null;
  private offlineMessageQueue: OfflineMessage[] = [];
  private notificationChannels: AndroidChannel[] = [];

  /**
   * Initialize push notification service
   */
  async initialize(callbacks: NotificationServiceCallbacks = {}): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.callbacks = callbacks;

      // Request notification permissions
      await this.requestPermissions();

      // Create notification channels (Android)
      await this.createNotificationChannels();

      // Get FCM token
      await this.getFCMToken();

      // Set up message handlers
      this.setupMessageHandlers();

      // Load offline message queue
      await this.loadOfflineMessageQueue();

      this.isInitialized = true;
      console.log('Push notification service initialized');
    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
      throw error;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<PushNotificationPermission> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        return enabled ? 'granted' : 'denied';
      } else {
        // Android permissions are handled automatically
        return 'granted';
      }
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return 'denied';
    }
  }

  /**
   * Get FCM token
   */
  async getFCMToken(): Promise<string | null> {
    try {
      if (!this.fcmToken) {
        this.fcmToken = await messaging().getToken();
        console.log('FCM Token:', this.fcmToken);
      }
      return this.fcmToken;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  /**
   * Create notification channels for Android
   */
  async createNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const channels: AndroidChannel[] = [
        {
          id: 'default',
          name: 'Default Notifications',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibration: true,
        },
        {
          id: 'messages',
          name: 'Messages',
          description: 'New messages from farmers and buyers',
          importance: AndroidImportance.HIGH,
          sound: 'message',
          vibration: true,
        },
        {
          id: 'orders',
          name: 'Orders',
          description: 'Order updates and notifications',
          importance: AndroidImportance.HIGH,
          sound: 'order',
          vibration: true,
        },
        {
          id: 'quality',
          name: 'Quality Analysis',
          description: 'Quality analysis results',
          importance: AndroidImportance.DEFAULT,
          sound: 'default',
        },
        {
          id: 'price_alerts',
          name: 'Price Alerts',
          description: 'Price change notifications',
          importance: AndroidImportance.DEFAULT,
          sound: 'price',
        },
        {
          id: 'system',
          name: 'System',
          description: 'App updates and system notifications',
          importance: AndroidImportance.LOW,
          sound: 'default',
        },
      ];

      for (const channel of channels) {
        await notifee.createChannel(channel);
      }

      this.notificationChannels = channels;
      console.log('Notification channels created');
    } catch (error) {
      console.error('Failed to create notification channels:', error);
    }
  }

  /**
   * Set up message handlers
   */
  setupMessageHandlers(): void {
    // Foreground message handler
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message received:', remoteMessage);
      await this.handleForegroundMessage(remoteMessage);
    });

    // Background message handler
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message received:', remoteMessage);
      await this.handleBackgroundMessage(remoteMessage);
    });

    // Notification opened handler
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened:', remoteMessage);
      this.handleNotificationOpened(remoteMessage);
    });

    // Initial notification (app launched from notification)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('Initial notification:', remoteMessage);
          this.handleNotificationOpened(remoteMessage);
        }
      });

    // Token refresh handler
    messaging().onTokenRefresh((token) => {
      console.log('FCM token refreshed:', token);
      this.fcmToken = token;
      this.callbacks.onTokenRefresh?.(token);
    });

    // Notifee event handlers
    notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('Local notification pressed:', detail.notification);
        if (detail.notification?.data) {
          this.handleNotificationOpened(detail.notification.data as any);
        }
      }
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('Background local notification pressed:', detail.notification);
        if (detail.notification?.data) {
          this.handleNotificationOpened(detail.notification.data as any);
        }
      }
    });
  }

  /**
   * Handle foreground messages
   */
  async handleForegroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    try {
      const notificationData = this.parseRemoteMessage(remoteMessage);
      
      // Show local notification for foreground messages
      await this.showLocalNotification(notificationData);
      
      // Notify callback
      this.callbacks.onNotificationReceived?.(notificationData);
    } catch (error) {
      console.error('Failed to handle foreground message:', error);
    }
  }

  /**
   * Handle background messages
   */
  async handleBackgroundMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    try {
      const notificationData = this.parseRemoteMessage(remoteMessage);
      
      // Add to offline queue if needed
      await this.addToOfflineQueue(notificationData);
      
      console.log('Background message processed:', notificationData);
    } catch (error) {
      console.error('Failed to handle background message:', error);
    }
  }

  /**
   * Handle notification opened
   */
  handleNotificationOpened(remoteMessage: any): void {
    try {
      const notificationData = this.parseRemoteMessage(remoteMessage);
      this.callbacks.onNotificationOpened?.(notificationData);
    } catch (error) {
      console.error('Failed to handle notification opened:', error);
    }
  }

  /**
   * Parse remote message to notification data
   */
  parseRemoteMessage(remoteMessage: any): NotificationData {
    return {
      id: remoteMessage.messageId || Date.now().toString(),
      title: remoteMessage.notification?.title || 'AgriTrade',
      message: remoteMessage.notification?.body || '',
      type: remoteMessage.data?.type || 'system',
      category: remoteMessage.data?.category || 'general',
      data: remoteMessage.data || {},
      timestamp: new Date().toISOString(),
      read: false,
      actionable: remoteMessage.data?.actionable === 'true',
      priority: remoteMessage.data?.priority || 'medium',
    };
  }

  /**
   * Show local notification
   */
  async showLocalNotification(notification: NotificationData): Promise<void> {
    try {
      const channelId = this.getChannelForType(notification.type);
      
      const notificationConfig: NotifeeNotification = {
        title: notification.title,
        body: notification.message,
        data: notification.data,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          actions: notification.actionable ? [
            {
              title: 'View',
              pressAction: {
                id: 'view',
              },
            },
            {
              title: 'Dismiss',
              pressAction: {
                id: 'dismiss',
              },
            },
          ] : undefined,
        },
        ios: {
          sound: 'default',
          interruptionLevel: 'active',
        },
      };

      await notifee.displayNotification(notificationConfig);
    } catch (error) {
      console.error('Failed to show local notification:', error);
    }
  }

  /**
   * Get notification channel for type
   */
  getChannelForType(type: string): string {
    const channelMap: Record<string, string> = {
      message: 'messages',
      order: 'orders',
      quality: 'quality',
      price: 'price_alerts',
      system: 'system',
    };

    return channelMap[type] || 'default';
  }

  /**
   * Send local notification
   */
  async sendLocalNotification(notification: NotificationData): Promise<void> {
    await this.showLocalNotification(notification);
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(
    notification: NotificationData,
    scheduledTime: Date
  ): Promise<string> {
    try {
      const channelId = this.getChannelForType(notification.type);
      
      const notificationId = await notifee.createTriggerNotification(
        {
          title: notification.title,
          body: notification.message,
          data: notification.data,
          android: {
            channelId,
          },
        },
        {
          type: 'timestamp',
          timestamp: scheduledTime.getTime(),
        }
      );

      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled notification
   */
  async cancelScheduledNotification(notificationId: string): Promise<void> {
    try {
      await notifee.cancelNotification(notificationId);
    } catch (error) {
      console.error('Failed to cancel scheduled notification:', error);
    }
  }

  /**
   * Add message to offline queue
   */
  async addToOfflineQueue(notification: NotificationData): Promise<void> {
    try {
      const offlineMessage: OfflineMessage = {
        id: notification.id,
        notification,
        timestamp: Date.now(),
        retryCount: 0,
      };

      this.offlineMessageQueue.push(offlineMessage);
      await this.saveOfflineMessageQueue();
    } catch (error) {
      console.error('Failed to add to offline queue:', error);
    }
  }

  /**
   * Process offline message queue
   */
  async processOfflineQueue(): Promise<void> {
    try {
      const processedIds: string[] = [];

      for (const message of this.offlineMessageQueue) {
        try {
          // Process the notification
          this.callbacks.onNotificationReceived?.(message.notification);
          processedIds.push(message.id);
        } catch (error) {
          console.error('Failed to process offline message:', error);
          message.retryCount++;
          
          // Remove messages that have failed too many times
          if (message.retryCount > 3) {
            processedIds.push(message.id);
          }
        }
      }

      // Remove processed messages
      this.offlineMessageQueue = this.offlineMessageQueue.filter(
        message => !processedIds.includes(message.id)
      );

      await this.saveOfflineMessageQueue();
    } catch (error) {
      console.error('Failed to process offline queue:', error);
    }
  }

  /**
   * Load offline message queue from storage
   */
  async loadOfflineMessageQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('offline_notification_queue');
      if (queueData) {
        this.offlineMessageQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  /**
   * Save offline message queue to storage
   */
  async saveOfflineMessageQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'offline_notification_queue',
        JSON.stringify(this.offlineMessageQueue)
      );
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Get notification permission status
   */
  async getPermissionStatus(): Promise<PushNotificationPermission> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().hasPermission();
        return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
               authStatus === messaging.AuthorizationStatus.PROVISIONAL
          ? 'granted'
          : 'denied';
      } else {
        // For Android, check if notifications are enabled
        const settings = await notifee.getNotificationSettings();
        return settings.authorizationStatus === 1 ? 'granted' : 'denied';
      }
    } catch (error) {
      console.error('Failed to get permission status:', error);
      return 'denied';
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  /**
   * Get current token
   */
  getCurrentToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Check if initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Show permission request alert
   */
  showPermissionAlert(): void {
    Alert.alert(
      'Enable Notifications',
      'Stay updated with important messages, orders, and price alerts by enabling notifications.',
      [
        { text: 'Not Now', style: 'cancel' },
        { 
          text: 'Enable', 
          onPress: async () => {
            await this.requestPermissions();
          }
        },
      ]
    );
  }

  /**
   * Cleanup service
   */
  async cleanup(): Promise<void> {
    try {
      await this.saveOfflineMessageQueue();
      this.isInitialized = false;
      this.callbacks = {};
    } catch (error) {
      console.error('Failed to cleanup push notification service:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;