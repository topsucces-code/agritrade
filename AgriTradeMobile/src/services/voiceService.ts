import Voice, { SpeechResultsEvent, SpeechErrorEvent } from 'react-native-voice';
import { Alert, Platform } from 'react-native';
import { VoiceCommand, SupportedLanguage, VoiceCommandResult } from '@/types';

class VoiceService {
  private isInitialized = false;
  private currentLanguage: SupportedLanguage = 'en';
  private commands: VoiceCommand[] = [];
  private isListening = false;

  /**
   * Initialize voice service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      Voice.onSpeechStart = this.onSpeechStart;
      Voice.onSpeechRecognized = this.onSpeechRecognized;
      Voice.onSpeechEnd = this.onSpeechEnd;
      Voice.onSpeechError = this.onSpeechError;
      Voice.onSpeechResults = this.onSpeechResults;
      Voice.onSpeechPartialResults = this.onSpeechPartialResults;

      this.isInitialized = true;
      console.log('Voice service initialized');
    } catch (error) {
      console.error('Failed to initialize voice service:', error);
      throw error;
    }
  }

  /**
   * Clean up voice service
   */
  async cleanup(): Promise<void> {
    try {
      await Voice.destroy();
      Voice.removeAllListeners();
      this.isInitialized = false;
      this.isListening = false;
    } catch (error) {
      console.error('Error cleaning up voice service:', error);
    }
  }

  /**
   * Set current language
   */
  setLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
  }

  /**
   * Register voice commands
   */
  registerCommands(commands: VoiceCommand[]): void {
    this.commands = commands;
  }

  /**
   * Start listening for voice input
   */
  async startListening(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isListening) {
      console.warn('Already listening');
      return;
    }

    try {
      const locale = this.getLocaleForLanguage(this.currentLanguage);
      await Voice.start(locale);
      this.isListening = true;
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      throw error;
    }
  }

  /**
   * Stop listening for voice input
   */
  async stopListening(): Promise<void> {
    try {
      await Voice.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  }

  /**
   * Cancel voice recognition
   */
  async cancelListening(): Promise<void> {
    try {
      await Voice.cancel();
      this.isListening = false;
    } catch (error) {
      console.error('Error canceling voice recognition:', error);
    }
  }

  /**
   * Check if voice recognition is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await Voice.isAvailable();
    } catch (error) {
      console.error('Error checking voice availability:', error);
      return false;
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      return await Voice.getSupportedLocales();
    } catch (error) {
      console.error('Error getting supported languages:', error);
      return [];
    }
  }

  /**
   * Process recognized speech and match with commands
   */
  private processCommand(recognizedText: string): VoiceCommandResult | null {
    const text = recognizedText.toLowerCase().trim();
    
    for (const command of this.commands) {
      for (const phrase of command.phrases) {
        if (this.matchesPhrase(text, phrase.toLowerCase())) {
          return {
            command,
            recognizedText,
            confidence: this.calculateConfidence(text, phrase.toLowerCase()),
            parameters: this.extractParameters(text, command),
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if text matches a phrase pattern
   */
  private matchesPhrase(text: string, phrase: string): boolean {
    // Exact match
    if (text === phrase) return true;

    // Contains match
    if (text.includes(phrase) || phrase.includes(text)) return true;

    // Word-based fuzzy matching
    const textWords = text.split(' ');
    const phraseWords = phrase.split(' ');
    
    if (phraseWords.length <= textWords.length) {
      const matchCount = phraseWords.filter(word => 
        textWords.some(textWord => 
          textWord.includes(word) || word.includes(textWord)
        )
      ).length;
      
      return matchCount / phraseWords.length >= 0.7; // 70% match threshold
    }

    return false;
  }

  /**
   * Calculate confidence score for command match
   */
  private calculateConfidence(text: string, phrase: string): number {
    if (text === phrase) return 1.0;
    
    const textWords = text.split(' ');
    const phraseWords = phrase.split(' ');
    const totalWords = Math.max(textWords.length, phraseWords.length);
    
    let matches = 0;
    phraseWords.forEach(phraseWord => {
      if (textWords.some(textWord => 
        textWord.includes(phraseWord) || phraseWord.includes(textWord)
      )) {
        matches++;
      }
    });

    return matches / totalWords;
  }

  /**
   * Extract parameters from recognized text based on command
   */
  private extractParameters(text: string, command: VoiceCommand): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (command.parameters) {
      command.parameters.forEach(param => {
        switch (param.type) {
          case 'number':
            const numbers = text.match(/\d+/g);
            if (numbers) {
              parameters[param.name] = parseInt(numbers[0], 10);
            }
            break;
          case 'string':
            // Extract text after the command phrase
            const commandPhrase = command.phrases[0].toLowerCase();
            const index = text.toLowerCase().indexOf(commandPhrase);
            if (index !== -1) {
              const afterCommand = text.substring(index + commandPhrase.length).trim();
              if (afterCommand) {
                parameters[param.name] = afterCommand;
              }
            }
            break;
          case 'category':
            if (param.options) {
              const foundOption = param.options.find(option => 
                text.toLowerCase().includes(option.toLowerCase())
              );
              if (foundOption) {
                parameters[param.name] = foundOption;
              }
            }
            break;
        }
      });
    }

    return parameters;
  }

  /**
   * Get locale string for language
   */
  private getLocaleForLanguage(language: SupportedLanguage): string {
    const locales = {
      en: 'en-US',
      fr: 'fr-FR',
      sw: 'sw-KE', // Swahili (Kenya)
      ar: 'ar-SA', // Arabic (Saudi Arabia)
    };
    return locales[language] || 'en-US';
  }

  // Voice event handlers
  private onSpeechStart = () => {
    console.log('Speech recognition started');
  };

  private onSpeechRecognized = () => {
    console.log('Speech recognized');
  };

  private onSpeechEnd = () => {
    console.log('Speech recognition ended');
    this.isListening = false;
  };

  private onSpeechError = (error: SpeechErrorEvent) => {
    console.error('Speech recognition error:', error);
    this.isListening = false;
  };

  private onSpeechResults = (result: SpeechResultsEvent) => {
    if (result.value && result.value.length > 0) {
      const recognizedText = result.value[0];
      console.log('Speech results:', recognizedText);
      
      // Process the command
      const commandResult = this.processCommand(recognizedText);
      if (commandResult) {
        // Emit command event (would be handled by the component using this service)
        console.log('Command matched:', commandResult);
      }
    }
  };

  private onSpeechPartialResults = (result: SpeechResultsEvent) => {
    if (result.value && result.value.length > 0) {
      console.log('Partial results:', result.value[0]);
    }
  };

  /**
   * Get predefined commands for the AgriTrade app
   */
  getDefaultCommands(): VoiceCommand[] {
    return [
      // Navigation commands
      {
        id: 'navigate_dashboard',
        phrases: [
          'go to dashboard', 'open dashboard', 'show dashboard',
          'aller au tableau de bord', 'ouvrir le tableau de bord', // French
          'enda kwenye dashibodi', 'fungua dashibodi', // Swahili
          'اذهب إلى لوحة القيادة', 'افتح لوحة القيادة' // Arabic
        ],
        action: 'NAVIGATE',
        description: 'Navigate to dashboard',
        category: 'navigation',
        parameters: [
          { name: 'screen', type: 'string', required: true, value: 'Dashboard' }
        ]
      },
      {
        id: 'navigate_products',
        phrases: [
          'show products', 'view products', 'open products',
          'montrer les produits', 'voir les produits', // French
          'onyesha bidhaa', 'fungua bidhaa', // Swahili
          'أظهر المنتجات', 'افتح المنتجات' // Arabic
        ],
        action: 'NAVIGATE',
        description: 'Navigate to products list',
        category: 'navigation',
        parameters: [
          { name: 'screen', type: 'string', required: true, value: 'ProductList' }
        ]
      },
      // Quality analysis commands
      {
        id: 'start_quality_analysis',
        phrases: [
          'analyze quality', 'check quality', 'start analysis',
          'analyser la qualité', 'vérifier la qualité', // French
          'chunguza ubora', 'angalia ubora', // Swahili
          'تحليل الجودة', 'فحص الجودة' // Arabic
        ],
        action: 'START_QUALITY_ANALYSIS',
        description: 'Start quality analysis',
        category: 'analysis'
      },
      // Product search commands
      {
        id: 'search_products',
        phrases: [
          'search for', 'find products', 'look for',
          'chercher', 'trouver des produits', // French
          'tafuta', 'pata bidhaa', // Swahili
          'ابحث عن', 'ابحث عن المنتجات' // Arabic
        ],
        action: 'SEARCH_PRODUCTS',
        description: 'Search for products',
        category: 'search',
        parameters: [
          { name: 'query', type: 'string', required: true }
        ]
      },
      // Filter commands
      {
        id: 'filter_by_category',
        phrases: [
          'show vegetables', 'show fruits', 'show grains',
          'montrer les légumes', 'montrer les fruits', // French
          'onyesha mboga', 'onyesha matunda', // Swahili
          'أظهر الخضروات', 'أظهر الفواكه' // Arabic
        ],
        action: 'FILTER_PRODUCTS',
        description: 'Filter products by category',
        category: 'filter',
        parameters: [
          { 
            name: 'category', 
            type: 'category', 
            required: true,
            options: ['vegetables', 'fruits', 'grains', 'legumes']
          }
        ]
      },
      // Price commands
      {
        id: 'check_price',
        phrases: [
          'what is the price', 'check price', 'show price',
          'quel est le prix', 'vérifier le prix', // French
          'bei ni ngapi', 'angalia bei', // Swahili
          'ما هو السعر', 'تحقق من السعر' // Arabic
        ],
        action: 'CHECK_PRICE',
        description: 'Check product price',
        category: 'pricing'
      },
      // Help commands
      {
        id: 'help',
        phrases: [
          'help', 'what can I say', 'voice commands',
          'aide', 'que puis-je dire', // French
          'msaada', 'nini ninaweza kusema', // Swahili
          'مساعدة', 'ماذا يمكنني أن أقول' // Arabic
        ],
        action: 'SHOW_HELP',
        description: 'Show available voice commands',
        category: 'help'
      }
    ];
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }
}

export const voiceService = new VoiceService();
export default voiceService;