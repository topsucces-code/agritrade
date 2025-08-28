import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SMS_STATUS, SMSMessage, SMSTemplate, SMSQueue, SupportedLanguage } from '@/types';
import { i18nService } from './i18nService';

interface SMSServiceConfig {
  apiKey?: string;
  apiUrl?: string;
  senderId?: string;
  enableOfflineQueue?: boolean;
}

interface SMSServiceCallbacks {
  onSMSSent?: (message: SMSMessage) => void;
  onSMSFailed?: (message: SMSMessage, error: string) => void;
  onSMSReceived?: (message: SMSMessage) => void;
}

class SMSService {
  private config: SMSServiceConfig = {};
  private callbacks: SMSServiceCallbacks = {};
  private smsQueue: SMSQueue[] = [];
  private isOnline = true;
  private templates: Record<string, SMSTemplate> = {};

  /**
   * Initialize SMS service
   */
  async initialize(config: SMSServiceConfig, callbacks: SMSServiceCallbacks = {}): Promise<void> {
    try {
      this.config = {
        enableOfflineQueue: true,
        ...config,
      };
      this.callbacks = callbacks;

      // Load SMS templates
      this.loadSMSTemplates();

      // Load offline SMS queue
      await this.loadSMSQueue();

      console.log('SMS service initialized');
    } catch (error) {
      console.error('Failed to initialize SMS service:', error);
      throw error;
    }
  }

  /**
   * Load SMS templates for different scenarios
   */
  loadSMSTemplates(): void {
    this.templates = {
      // Authentication templates
      verification_code: {
        id: 'verification_code',
        name: 'Verification Code',
        templates: {
          en: 'Your AgriTrade verification code is: {{code}}. Valid for 10 minutes.',
          fr: 'Votre code de vérification AgriTrade est: {{code}}. Valide pendant 10 minutes.',
          sw: 'Nambari yako ya uthibitisho wa AgriTrade ni: {{code}}. Halali kwa dakika 10.',
          ar: 'رمز التحقق الخاص بك في AgriTrade هو: {{code}}. صالح لمدة 10 دقائق.',
        },
      },

      // Order notifications
      order_confirmed: {
        id: 'order_confirmed',
        name: 'Order Confirmed',
        templates: {
          en: 'Order #{{orderNumber}} confirmed! {{farmerName}} will deliver {{productName}} on {{deliveryDate}}. Total: {{amount}}',
          fr: 'Commande #{{orderNumber}} confirmée! {{farmerName}} livrera {{productName}} le {{deliveryDate}}. Total: {{amount}}',
          sw: 'Agizo #{{orderNumber}} limethibitishwa! {{farmerName}} atawasilisha {{productName}} tarehe {{deliveryDate}}. Jumla: {{amount}}',
          ar: 'تم تأكيد الطلب #{{orderNumber}}! سيقوم {{farmerName}} بتوصيل {{productName}} في {{deliveryDate}}. المجموع: {{amount}}',
        },
      },

      order_delivered: {
        id: 'order_delivered',
        name: 'Order Delivered',
        templates: {
          en: 'Order #{{orderNumber}} has been delivered! Please confirm receipt and rate your experience.',
          fr: 'Commande #{{orderNumber}} livrée! Veuillez confirmer la réception et évaluer votre expérience.',
          sw: 'Agizo #{{orderNumber}} limewasilishwa! Tafadhali thibitisha upokeaji na kadiria uzoefu wako.',
          ar: 'تم توصيل الطلب #{{orderNumber}}! يرجى تأكيد الاستلام وتقييم تجربتك.',
        },
      },

      // Price alerts
      price_alert: {
        id: 'price_alert',
        name: 'Price Alert',
        templates: {
          en: 'Price Alert: {{productName}} is now {{newPrice}} ({{change}}) in your area. Market: {{marketName}}',
          fr: 'Alerte prix: {{productName}} est maintenant {{newPrice}} ({{change}}) dans votre région. Marché: {{marketName}}',
          sw: 'Tahadhari ya bei: {{productName}} sasa ni {{newPrice}} ({{change}}) katika eneo lako. Soko: {{marketName}}',
          ar: 'تنبيه السعر: {{productName}} الآن {{newPrice}} ({{change}}) في منطقتك. السوق: {{marketName}}',
        },
      },

      // Quality results
      quality_result: {
        id: 'quality_result',
        name: 'Quality Analysis Result',
        templates: {
          en: 'Quality analysis complete! {{productName}} scored {{qualityScore}}/10. Estimated price: {{estimatedPrice}}. View details in app.',
          fr: 'Analyse de qualité terminée! {{productName}} a obtenu {{qualityScore}}/10. Prix estimé: {{estimatedPrice}}. Voir détails dans l\'app.',
          sw: 'Uchambuzi wa ubora umekamilika! {{productName}} imepata alama {{qualityScore}}/10. Bei iliyokadiria: {{estimatedPrice}}. Ona maelezo katika programu.',
          ar: 'اكتمل تحليل الجودة! {{productName}} حصل على {{qualityScore}}/10. السعر المقدر: {{estimatedPrice}}. اعرض التفاصيل في التطبيق.',
        },
      },

      // Emergency notifications
      emergency_weather: {
        id: 'emergency_weather',
        name: 'Weather Emergency',
        templates: {
          en: 'WEATHER ALERT: {{weatherType}} expected in your area on {{date}}. Protect your crops and livestock. Stay safe!',
          fr: 'ALERTE MÉTÉO: {{weatherType}} attendu dans votre région le {{date}}. Protégez vos cultures et votre bétail. Restez en sécurité!',
          sw: 'TAHADHARI YA HALI YA HEWA: {{weatherType}} inatarajiwa katika eneo lako tarehe {{date}}. Linda mazao na mifugo yako. Kaa salama!',
          ar: 'تحذير الطقس: {{weatherType}} متوقع في منطقتك في {{date}}. احم محاصيلك وماشيتك. ابق آمناً!',
        },
      },

      // System notifications
      app_update: {
        id: 'app_update',
        name: 'App Update',
        templates: {
          en: 'AgriTrade update available! New features: {{features}}. Update from Play Store/App Store.',
          fr: 'Mise à jour AgriTrade disponible! Nouvelles fonctionnalités: {{features}}. Mettez à jour depuis Play Store/App Store.',
          sw: 'Sasisho la AgriTrade linapatikana! Vipengele vipya: {{features}}. Sasisha kutoka Play Store/App Store.',
          ar: 'تحديث AgriTrade متاح! ميزات جديدة: {{features}}. حدث من Play Store/App Store.',
        },
      },
    };
  }

  /**
   * Send SMS message
   */
  async sendSMS(
    phoneNumber: string,
    message: string,
    templateId?: string,
    variables?: Record<string, string>
  ): Promise<SMSMessage> {
    try {
      let finalMessage = message;

      // Use template if provided
      if (templateId && this.templates[templateId]) {
        finalMessage = this.generateMessageFromTemplate(templateId, variables);
      }

      const smsMessage: SMSMessage = {
        id: this.generateMessageId(),
        phoneNumber,
        message: finalMessage,
        templateId,
        variables,
        status: SMS_STATUS.PENDING,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      if (this.isOnline) {
        return await this.sendSMSImmediate(smsMessage);
      } else {
        return await this.addToQueue(smsMessage);
      }
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw error;
    }
  }

  /**
   * Send immediate SMS
   */
  async sendSMSImmediate(smsMessage: SMSMessage): Promise<SMSMessage> {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // For development/testing, we'll simulate SMS sending
        // In production, this would integrate with actual SMS service
        const success = await this.simulateSMSSending(smsMessage);
        
        if (success) {
          smsMessage.status = SMS_STATUS.SENT;
          smsMessage.sentAt = new Date().toISOString();
          this.callbacks.onSMSSent?.(smsMessage);
        } else {
          smsMessage.status = SMS_STATUS.FAILED;
          smsMessage.error = 'Failed to send SMS';
          this.callbacks.onSMSFailed?.(smsMessage, 'Failed to send SMS');
        }
      }

      return smsMessage;
    } catch (error) {
      console.error('Failed to send immediate SMS:', error);
      smsMessage.status = SMS_STATUS.FAILED;
      smsMessage.error = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onSMSFailed?.(smsMessage, smsMessage.error);
      return smsMessage;
    }
  }

  /**
   * Simulate SMS sending (for development)
   */
  async simulateSMSSending(smsMessage: SMSMessage): Promise<boolean> {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate 95% success rate
      const success = Math.random() > 0.05;

      if (success) {
        console.log(`SMS sent to ${smsMessage.phoneNumber}: ${smsMessage.message}`);
        return true;
      } else {
        console.log(`SMS failed to ${smsMessage.phoneNumber}`);
        return false;
      }
    } catch (error) {
      console.error('SMS simulation error:', error);
      return false;
    }
  }

  /**
   * Add SMS to offline queue
   */
  async addToQueue(smsMessage: SMSMessage): Promise<SMSMessage> {
    try {
      if (!this.config.enableOfflineQueue) {
        throw new Error('Offline queue is disabled');
      }

      const queueItem: SMSQueue = {
        id: this.generateQueueId(),
        smsMessage,
        queuedAt: new Date().toISOString(),
        priority: this.getMessagePriority(smsMessage.templateId),
      };

      this.smsQueue.push(queueItem);
      await this.saveSMSQueue();

      smsMessage.status = SMS_STATUS.QUEUED;
      console.log(`SMS queued for offline sending: ${smsMessage.phoneNumber}`);

      return smsMessage;
    } catch (error) {
      console.error('Failed to add SMS to queue:', error);
      throw error;
    }
  }

  /**
   * Process SMS queue when back online
   */
  async processSMSQueue(): Promise<void> {
    try {
      if (!this.isOnline || this.smsQueue.length === 0) return;

      console.log(`Processing ${this.smsQueue.length} queued SMS messages`);

      // Sort by priority and timestamp
      this.smsQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
      });

      const processedIds: string[] = [];

      for (const queueItem of this.smsQueue) {
        try {
          const result = await this.sendSMSImmediate(queueItem.smsMessage);
          
          if (result.status === SMS_STATUS.SENT) {
            processedIds.push(queueItem.id);
          } else {
            // Increment retry count
            queueItem.smsMessage.retryCount++;
            
            // Remove if too many retries
            if (queueItem.smsMessage.retryCount >= 3) {
              processedIds.push(queueItem.id);
              console.log(`SMS removed after 3 failed attempts: ${queueItem.smsMessage.phoneNumber}`);
            }
          }
        } catch (error) {
          console.error('Failed to process queued SMS:', error);
          queueItem.smsMessage.retryCount++;
          
          if (queueItem.smsMessage.retryCount >= 3) {
            processedIds.push(queueItem.id);
          }
        }

        // Add delay between sends
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Remove processed items
      this.smsQueue = this.smsQueue.filter(item => !processedIds.includes(item.id));
      await this.saveSMSQueue();

      console.log(`Processed ${processedIds.length} SMS messages from queue`);
    } catch (error) {
      console.error('Failed to process SMS queue:', error);
    }
  }

  /**
   * Generate message from template
   */
  generateMessageFromTemplate(
    templateId: string,
    variables: Record<string, string> = {},
    language: SupportedLanguage = 'en'
  ): string {
    try {
      const template = this.templates[templateId];
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      let message = template.templates[language] || template.templates.en;
      
      // Replace variables
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        message = message.replace(regex, variables[key]);
      });

      return message;
    } catch (error) {
      console.error('Failed to generate message from template:', error);
      return 'Message template error';
    }
  }

  /**
   * Send verification code SMS
   */
  async sendVerificationCode(phoneNumber: string, code: string, language: SupportedLanguage = 'en'): Promise<SMSMessage> {
    return await this.sendSMS(phoneNumber, '', 'verification_code', { code }, language);
  }

  /**
   * Send order confirmation SMS
   */
  async sendOrderConfirmation(
    phoneNumber: string,
    orderData: {
      orderNumber: string;
      farmerName: string;
      productName: string;
      deliveryDate: string;
      amount: string;
    },
    language: SupportedLanguage = 'en'
  ): Promise<SMSMessage> {
    return await this.sendSMS(phoneNumber, '', 'order_confirmed', orderData, language);
  }

  /**
   * Send price alert SMS
   */
  async sendPriceAlert(
    phoneNumber: string,
    priceData: {
      productName: string;
      newPrice: string;
      change: string;
      marketName: string;
    },
    language: SupportedLanguage = 'en'
  ): Promise<SMSMessage> {
    return await this.sendSMS(phoneNumber, '', 'price_alert', priceData, language);
  }

  /**
   * Send quality result SMS
   */
  async sendQualityResult(
    phoneNumber: string,
    qualityData: {
      productName: string;
      qualityScore: string;
      estimatedPrice: string;
    },
    language: SupportedLanguage = 'en'
  ): Promise<SMSMessage> {
    return await this.sendSMS(phoneNumber, '', 'quality_result', qualityData, language);
  }

  /**
   * Open native SMS app
   */
  async openSMSApp(phoneNumber?: string, message?: string): Promise<void> {
    try {
      let url = 'sms:';
      
      if (phoneNumber) {
        url += phoneNumber;
      }
      
      if (message) {
        const separator = Platform.OS === 'ios' ? '&' : '?';
        url += `${separator}body=${encodeURIComponent(message)}`;
      }

      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'SMS app is not available on this device');
      }
    } catch (error) {
      console.error('Failed to open SMS app:', error);
      Alert.alert('Error', 'Failed to open SMS app');
    }
  }

  /**
   * Set online/offline status
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    if (wasOffline && isOnline) {
      // Process queue when coming back online
      this.processSMSQueue();
    }
  }

  /**
   * Get message priority
   */
  getMessagePriority(templateId?: string): number {
    const priorityMap: Record<string, number> = {
      emergency_weather: 10,
      verification_code: 9,
      order_confirmed: 8,
      order_delivered: 7,
      quality_result: 6,
      price_alert: 5,
      app_update: 1,
    };

    return priorityMap[templateId || ''] || 5;
  }

  /**
   * Generate unique message ID
   */
  generateMessageId(): string {
    return `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique queue ID
   */
  generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load SMS queue from storage
   */
  async loadSMSQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('sms_queue');
      if (queueData) {
        this.smsQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Failed to load SMS queue:', error);
    }
  }

  /**
   * Save SMS queue to storage
   */
  async saveSMSQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('sms_queue', JSON.stringify(this.smsQueue));
    } catch (error) {
      console.error('Failed to save SMS queue:', error);
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { count: number; items: SMSQueue[] } {
    return {
      count: this.smsQueue.length,
      items: [...this.smsQueue],
    };
  }

  /**
   * Clear SMS queue
   */
  async clearQueue(): Promise<void> {
    this.smsQueue = [];
    await this.saveSMSQueue();
  }

  /**
   * Get available templates
   */
  getTemplates(): Record<string, SMSTemplate> {
    return { ...this.templates };
  }

  /**
   * Cleanup service
   */
  async cleanup(): Promise<void> {
    try {
      await this.saveSMSQueue();
      this.callbacks = {};
    } catch (error) {
      console.error('Failed to cleanup SMS service:', error);
    }
  }
}

export const smsService = new SMSService();
export default smsService;