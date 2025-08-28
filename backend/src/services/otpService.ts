import { cache } from '../config/redis';
import CommunicationService from './communicationService';
import { AppError, ValidationError } from '../middleware/errorHandler';

/**
 * Service for managing One-Time Passwords (OTP).
 * Handles generation, storage, verification, and rate limiting.
 */
export class OtpService {
  private communicationService: CommunicationService;
  private readonly OTP_TTL_SECONDS = 600; // 10 minutes
  private readonly RATE_LIMIT_TTL_SECONDS = 3600; // 1 hour
  private readonly MAX_ATTEMPTS = 5;

  constructor() {
    this.communicationService = new CommunicationService();
  }

  /**
   * Generates, stores, and sends a verification code to a user.
   * @param phoneNumber The user's phone number.
   * @param language The preferred language for the notification.
   */
  async sendVerificationCode(phoneNumber: string, language: string = 'en'): Promise<void> {
    // 1. Format and validate phone number
    const formattedPhone = this.communicationService.formatPhoneNumber(phoneNumber);
    if (!this.communicationService.isValidPhoneNumber(formattedPhone)) {
      throw new ValidationError('Invalid phone number format');
    }

    // 2. Check rate limiting to prevent abuse
    await this.checkRateLimiting(formattedPhone);

    // 3. Generate and store the code
    const code = this.generateCode();
    await this.storeCode(formattedPhone, code);

    // 4. Send the code via SMS using the communication service's template system
    await this.communicationService.sendSMS({
      to: [formattedPhone],
      template: 'otpVerification',
      variables: { otp: code },
      language: language,
    });
  }

  /**
   * Verifies a code for a given phone number.
   * @param phoneNumber The user's phone number.
   * @param code The code to verify.
   * @returns A boolean indicating if the verification was successful.
   */
  async verifyCode(phoneNumber: string, code: string): Promise<boolean> {
    const formattedPhone = this.communicationService.formatPhoneNumber(phoneNumber);
    const cacheKey = `verification:${formattedPhone}`;
    
    try {
      const storedCode = await cache.get(cacheKey);
      
      if (storedCode === code) {
        await cache.del(cacheKey); // Code is single-use, delete it upon success
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error verifying code from cache:', error);
      return false;
    }
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async storeCode(phoneNumber: string, code: string): Promise<void> {
    await cache.set(`verification:${phoneNumber}`, code, this.OTP_TTL_SECONDS);
  }

  private async checkRateLimiting(phoneNumber: string): Promise<void> {
    const rateLimitKey = `sms_rate_limit:${phoneNumber}`;
    const attempts = await cache.increment(rateLimitKey, this.RATE_LIMIT_TTL_SECONDS);

    if (attempts > this.MAX_ATTEMPTS) {
      throw new AppError('Too many verification attempts. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    }
  }
}

export default OtpService;