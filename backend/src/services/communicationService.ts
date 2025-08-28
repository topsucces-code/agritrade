import axios from 'axios';
import { cache } from '../config/redis';
import { serviceCircuitBreakers } from '../middleware/circuitBreaker';
import { IUser, INotification } from '../types';

// Communication interfaces
interface SMSMessage {
  to: string[];
  message?: string;
  from?: string;
  language?: string;
  template?: string;
  variables?: Record<string, string>;
}

interface VoiceCall {
  to: string;
  from?: string;
  message?: string;
  audioUrl?: string;
  language?: string;
}

interface WhatsAppMessage {
  to: string;
  message?: string;
  template?: string;
  variables?: Record<string, string>;
  language?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
}

interface EmailMessage {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  language?: string;
  template?: string;
  variables?: Record<string, string>;
}

// Response interfaces
interface SMSResponse {
  SMSMessageData: {
    Message: string;
    Recipients: Array<{
      statusCode: number;
      number: string;
      status: string;
      cost: string;
      messageId: string;
    }>;
  };
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Message template types
type TemplateKey = 'orderReceived' | 'orderAccepted' | 'paymentConfirmed' | 'qualityAnalysisComplete' | 'priceAlert' | 'otpVerification' | 'welcomeMessage';
type LanguageCode = 'en' | 'fr' | 'sw';
type MessageTemplates = Record<TemplateKey, Record<LanguageCode, string>>;

// Message templates by language
const MESSAGE_TEMPLATES: MessageTemplates = {
  orderReceived: {
    en: 'New order #{orderNumber} received for {productName}. Amount: {currency}{amount}. Check your AgriTrade app.',
    fr: 'Nouvelle commande #{orderNumber} reçue pour {productName}. Montant: {currency}{amount}. Vérifiez votre app AgriTrade.',
    sw: 'Oda mpya #{orderNumber} imepokewa kwa {productName}. Kiasi: {currency}{amount}. Angalia app yako ya AgriTrade.'
  },
  orderAccepted: {
    en: 'Your order #{orderNumber} has been accepted! Payment of {currency}{amount} is now required.',
    fr: 'Votre commande #{orderNumber} a été acceptée! Le paiement de {currency}{amount} est maintenant requis.',
    sw: 'Oda yako #{orderNumber} imekubaliwa! Malipo ya {currency}{amount} yanahitajika sasa.'
  },
  paymentConfirmed: {
    en: 'Payment confirmed for order #{orderNumber}. Your {productName} will be prepared for delivery.',
    fr: 'Paiement confirmé pour la commande #{orderNumber}. Votre {productName} sera préparé pour la livraison.',
    sw: 'Malipo yamethibitishwa kwa oda #{orderNumber}. {productName} yako itaandaliwa kwa utoaji.'
  },
  qualityAnalysisComplete: {
    en: 'Quality analysis complete! Your {productType} scored {score}% (Grade {grade}). See recommendations in app.',
    fr: 'Analyse de qualité terminée! Votre {productType} a obtenu {score}% (Grade {grade}). Voir recommandations dans l\'app.',
    sw: 'Uchambuzi wa ubora umekamilika! {productType} yako imepata {score}% (Daraja {grade}). Ona mapendekezo kwenye app.'
  },
  priceAlert: {
    en: '{productType} prices increased by {percentage}% to {currency}{price}/MT. Consider selling now!',
    fr: 'Les prix de {productType} ont augmenté de {percentage}% à {currency}{price}/MT. Considérez vendre maintenant!',
    sw: 'Bei za {productType} zimeongezeka kwa {percentage}% hadi {currency}{price}/MT. Fikiria kuuza sasa!'
  },
  otpVerification: {
    en: 'Your AgriTrade verification code is: {otp}. Valid for 5 minutes. Do not share this code.',
    fr: 'Votre code de vérification AgriTrade est: {otp}. Valide 5 minutes. Ne partagez pas ce code.',
    sw: 'Msimbo wako wa kuthibitisha AgriTrade ni: {otp}. Unatumika kwa dakika 5. Usishiriki msimbo huu.'
  },
  welcomeMessage: {
    en: 'Welcome to AgriTrade! Connect directly with buyers, get AI quality analysis, and increase your income by 30-50%.',
    fr: 'Bienvenue sur AgriTrade! Connectez-vous directement avec les acheteurs, obtenez une analyse de qualité IA, et augmentez vos revenus de 30-50%.',
    sw: 'Karibu AgriTrade! Unganishwa moja kwa moja na wanunuzi, pata uchambuzi wa ubora wa AI, na ongeza mapato yako kwa 30-50%.'
  }
};

/**
 * Enhanced Communication Service with multilingual support
 */
export class CommunicationService {
  private africastalkingApiKey: string;
  private africastalkingUsername: string;
  private shortCode: string;
  private whatsappToken: string;
  private whatsappPhoneNumberId: string;
  private baseUrl: string;

  // Constants for configuration and magic numbers
  private readonly WHATSAPP_API_VERSION = 'v18.0';
  private readonly CACHE_TTL_SECONDS = 86400; // 24 hours

  private whatsappBaseUrl = 'https://graph.facebook.com/v18.0';
  
  constructor() {
    this.africastalkingApiKey = process.env.AFRICASTALKING_API_KEY || '';
    this.africastalkingUsername = process.env.AFRICASTALKING_USERNAME || 'sandbox';
    this.shortCode = process.env.AFRICASTALKING_SHORT_CODE || '2020';
    this.whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    
    this.whatsappBaseUrl = `https://graph.facebook.com/${this.WHATSAPP_API_VERSION}`;
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.africastalking.com/version1'
      : 'https://api.sandbox.africastalking.com/version1';
  }

  /**
   * Send SMS with template and multilingual support
   */
  async sendSMS(smsData: SMSMessage): Promise<SMSResponse> {
    return serviceCircuitBreakers.africasTalking.execute(async () => {
      const { to, message, template, variables, language = 'en', from } = smsData;

      // Validate that either message or template is provided
      if (!message && !template) {
        throw new Error('Either message or template must be provided');
      }

      // Validate phone numbers
      const validNumbers = to.filter(number => /^\+[1-9]\d{1,14}$/.test(number));
      
      if (validNumbers.length === 0) {
        throw new Error('No valid phone numbers provided');
      }

      // Get message from template if provided, otherwise use direct message
      let finalMessage = message || '';
      if (template && this.isValidTemplateKey(template)) {
        const templateKey = template as TemplateKey;
        const languageKey = this.isValidLanguageCode(language) ? (language as LanguageCode) : 'en';
        const templateData = MESSAGE_TEMPLATES[templateKey][languageKey];
        finalMessage = this.interpolateTemplate(templateData, variables || {});
      }

      const payload = {
        to: validNumbers.join(','),
        message: finalMessage.substring(0, 1600),
        from: from || this.shortCode,
        bulkSMSMode: (validNumbers.length > 1 ? 1 : 0).toString()
      };

      const response = await axios.post<SMSResponse>(
        `${this.baseUrl}/messaging`,
        new URLSearchParams(payload).toString(),
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiKey': this.africastalkingApiKey
          },
          timeout: 10000
        }
      );

      // Cache SMS status for tracking
      const cacheKey = `sms:${Date.now()}`;
      await cache.setJSON(cacheKey, {
        ...response.data,
        sentAt: new Date(),
        template,
        language
      }, this.CACHE_TTL_SECONDS);

      return response.data;
    });
  }

  /**
   * Send order-related SMS notifications
   */
  async sendOrderSMS(
    phoneNumber: string,
    orderNumber: string,
    eventType: string,
    farmerId: string,
    buyerId: string,
    additionalData?: Record<string, string>
  ): Promise<SMSResponse> {
    const templateMap: Record<string, TemplateKey> = {
      'order_received': 'orderReceived',
      'order_accepted': 'orderAccepted',
      'payment_confirmed': 'paymentConfirmed',
      'contract_signed': 'orderAccepted',
      'contract_partially_signed': 'orderAccepted'
    };

    const templateKey = templateMap[eventType] || 'orderReceived';
    const variables = {
      orderNumber,
      productName: additionalData?.productName || 'Agricultural Product',
      amount: additionalData?.amount || '0',
      currency: additionalData?.currency || 'USD',
      ...additionalData
    };

    return this.sendSMS({
      to: [phoneNumber],
      template: templateKey,
      variables,
      language: additionalData?.language || 'en'
    });
  }

  /**
   * Send WhatsApp message using Business API
   */
  async sendWhatsAppMessage(whatsappData: WhatsAppMessage): Promise<WhatsAppResponse> {
    if (!this.whatsappToken || !this.whatsappPhoneNumberId) {
      throw new Error('WhatsApp Business API not configured');
    }

    // It's better to use a dedicated circuit breaker for each external service
    return serviceCircuitBreakers.whatsApp.execute(async () => {
      const { to, message, template, variables, language = 'en', mediaUrl, mediaType } = whatsappData;

      // Validate phone number (WhatsApp format)
      const phoneNumber = to.replace(/[^\d]/g, '');
      if (phoneNumber.length < 10) {
        throw new Error('Invalid WhatsApp phone number');
      }

      let payload: any = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text'
      };

      // Handle template messages
      if (template && this.isValidTemplateKey(template)) {
        const templateKey = template as TemplateKey;
        const languageKey = this.isValidLanguageCode(language) ? (language as LanguageCode) : 'en';
        const templateData = MESSAGE_TEMPLATES[templateKey][languageKey];
        const finalMessage = this.interpolateTemplate(templateData, variables || {});
        payload.text = { body: finalMessage };
      } else if (message) {
        payload.text = { body: message };
      }

      // Handle media messages
      if (mediaUrl && mediaType) {
        payload.type = mediaType;
        payload[mediaType] = {
          link: mediaUrl,
          caption: message || ''
        };
        delete payload.text;
      }

      const response = await axios.post(
        `${this.whatsappBaseUrl}/${this.whatsappPhoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.whatsappToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      // Cache WhatsApp message status
      const cacheKey = `whatsapp:${Date.now()}`;
      await cache.setJSON(cacheKey, {
        messageId: response.data.messages[0].id,
        to: phoneNumber,
        sentAt: new Date(),
        template,
        language
      }, this.CACHE_TTL_SECONDS);

      return {
        success: true,
        messageId: response.data.messages[0].id
      };
    });
  }

  /**
   * Enhanced voice call with multilingual support
   */
  async makeVoiceCall(callData: VoiceCall): Promise<{ errorMessage?: string; entries?: any[] }> {
    return serviceCircuitBreakers.africasTalking.execute(async () => {
      const { to, from, message, audioUrl, language = 'en' } = callData;

      // Validate phone number
      if (!/^\+[1-9]\d{1,14}$/.test(to)) {
        throw new Error('Invalid phone number format');
      }

      const payload: any = {
        to: to,
        from: from || this.shortCode
      };

      // Either use audio URL or text-to-speech
      if (audioUrl) {
        payload.url = audioUrl;
      } else if (message) {
        // For multilingual voice, we'd need to use appropriate voice synthesis
        payload.message = message.substring(0, 1000);
      } else {
        throw new Error('Either message or audioUrl must be provided');
      }

      const response = await axios.post(
        `${this.baseUrl}/voice/call`,
        new URLSearchParams(payload).toString(),
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiKey': this.africastalkingApiKey
          },
          timeout: 15000
        }
      );

      return response.data;
    });
  }

  /**
   * Send comprehensive notification based on user preferences
   */
  async sendNotificationToUser(
    user: IUser,
    notificationType: string,
    variables: Record<string, string> = {}
  ): Promise<{ sms?: any; whatsapp?: any; email?: any }> {
    const results: any = {};
    const language = user.profile.languages?.[0] || 'en';

    try {
      // Send SMS if enabled
      if (user.preferences.notifications.sms && user.phoneNumber) {
        results.sms = await this.sendSMS({
          to: [user.phoneNumber],
          message: '',
          template: notificationType,
          variables,
          language
        });
      }

      // Send WhatsApp if enabled
      if (user.preferences.notifications.whatsapp && user.phoneNumber) {
        results.whatsapp = await this.sendWhatsAppMessage({
          to: user.phoneNumber,
          template: notificationType,
          variables,
          language
        });
      }

      // Send Email if enabled and email exists
      if (user.preferences.notifications.email && user.email) {
        // Email implementation would go here
        // results.email = await this.sendEmail(...);
      }

      return results;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      throw error;
    }
  }

  /**
   * Send voice notification in local language
   */
  async sendVoiceNotification(
    phoneNumber: string,
    messageKey: string,
    language: string = 'en',
    variables?: { [key: string]: string }
  ): Promise<any> {
    try {
      // This logic can be merged with the main MESSAGE_TEMPLATES for consistency
      const message = this.getLocalizedVoiceMessage(messageKey, language, variables);
      
      return await this.makeVoiceCall({
        to: phoneNumber,
        from: this.shortCode,
        message,
        language
      });

    } catch (error) {
      console.error('Error sending voice notification:', error);
      throw error;
    }
  }

  /**
   * Interpolate variables in message templates
   */
  private interpolateTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value || '');
    });
    return result;
  }

  /**
   * Send email notification (placeholder for future SMTP integration)
   */
  async sendEmail(emailData: EmailMessage): Promise<any> {
    // TODO: Implement email service (SMTP, SendGrid, etc.)
    console.log('Email service not yet implemented:', emailData);
    return { success: false, message: 'Email service not configured' };
  }

  /**
   * Send bulk SMS to multiple farmers
   */
  async sendBulkSMS(
    phoneNumbers: string[],
    message: string,
    chunkSize: number = 100
  ): Promise<void> {
    try {
      // Split into chunks to avoid API limits
      const chunks = this.chunkArray(phoneNumbers, chunkSize);
      
      for (const chunk of chunks) {
        await this.sendSMS({
          to: chunk,
          message
        });
        
        // Add delay between chunks to respect rate limits
        await this.delay(1000);
      }

    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      throw error;
    }
  }

  /**
   * Send market update SMS to subscribers
   */
  async sendMarketUpdateSMS(
    subscribers: Array<{ phone: string; crops: string[] }>,
    marketData: { [cropType: string]: { price: number; change: number; currency: string } }
  ): Promise<void> {
    try {
      for (const subscriber of subscribers) {
        const relevantCrops = subscriber.crops.filter(crop => marketData[crop]);
        
        if (relevantCrops.length === 0) continue;
        
        let message = 'Market Update:\n';
        relevantCrops.forEach(crop => {
          const data = marketData[crop];
          const changeSymbol = data.change >= 0 ? '+' : '';
          message += `${crop}: ${data.currency}${data.price} (${changeSymbol}${data.change}%)\n`;
        });
        message += '- AgriTrade';
        
        await this.sendSMS({
          to: [subscriber.phone],
          message
        });
        
        // Small delay between messages
        await this.delay(100);
      }

    } catch (error) {
      console.error('Error sending market update SMS:', error);
    }
  }

  /**
   * Check SMS delivery status
   */
  async checkSMSStatus(messageId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/messaging?messageId=${messageId}`,
        {
          headers: {
            'Accept': 'application/json',
            'apiKey': this.africastalkingApiKey
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('Error checking SMS status:', error);
      return null;
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/user?username=${this.africastalkingUsername}`,
        {
          headers: {
            'Accept': 'application/json',
            'apiKey': this.africastalkingApiKey
          }
        }
      );

      return response.data;

    } catch (error) {
      console.error('Error fetching account balance:', error);
      return null;
    }
  }


  // RECOMMENDATION: Merge this logic into the main MESSAGE_TEMPLATES object to have a single source of truth for all message templates.
  private getLocalizedVoiceMessage(
    key: string,
    language: string,
    variables?: { [key: string]: string }
  ): string {
    const messages: { [lang: string]: { [key: string]: string } } = {
      en: {
        order_received: 'Hello farmer, you have received a new order {orderNumber}. Please check your AgriTrade application.',
        price_alert: 'Price alert: {cropType} price is now {price} {currency}. Good time to sell your crops.',
        weather_alert: 'Weather alert: {message}. Please take necessary precautions for your crops.'
      },
      fr: {
        order_received: 'Bonjour fermier, vous avez reçu une nouvelle commande {orderNumber}. Veuillez vérifier votre application AgriTrade.',
        price_alert: 'Alerte de prix: le prix de {cropType} est maintenant {price} {currency}. Bon moment pour vendre vos cultures.',
        weather_alert: 'Alerte météo: {message}. Veuillez prendre les précautions nécessaires pour vos cultures.'
      },
      sw: {
        order_received: 'Hujambo mkulima, umepokea agizo jipya {orderNumber}. Tafadhali angalia programu yako ya AgriTrade.',
        price_alert: 'Onyo la bei: bei ya {cropType} sasa ni {price} {currency}. Wakati mzuri wa kuuza mazao yako.',
        weather_alert: 'Onyo la hali ya hewa: {message}. Tafadhali chukua tahadhari zinazohitajika kwa mazao yako.'
      }
    };

    let message = messages[language]?.[key] || messages.en[key] || 'AgriTrade notification';

    // Replace variables
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        message = message.replace(`{${key}}`, value);
      });
    }

    return message;
  }

  /**
   * Type guard to check if template key is valid
   */
  private isValidTemplateKey(template: string): template is TemplateKey {
    return template in MESSAGE_TEMPLATES;
  }

  /**
   * Type guard to check if language code is valid
   */
  private isValidLanguageCode(language: string): language is LanguageCode {
    return ['en', 'fr', 'sw'].includes(language);
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility function to add delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format phone number to international format
   */
  formatPhoneNumber(phoneNumber: string, countryCode: string = '+254'): string {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If number starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      return countryCode + cleaned.substring(1);
    }
    
    // If number doesn't start with +, add country code
    if (!cleaned.startsWith('+')) {
      return countryCode + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
  }
}

export default CommunicationService;