import { NavigationProp } from '@react-navigation/native';
import { Dispatch } from '@reduxjs/toolkit';
import { VoiceCommand, VoiceCommandResult, SupportedLanguage } from '@/types';
import { voiceService } from './voiceService';
import { i18nService } from './i18nService';
import { RootStackParamList } from '@/types';

interface VoiceCommandHandlerProps {
  navigation: NavigationProp<RootStackParamList>;
  dispatch: Dispatch;
  currentLanguage: SupportedLanguage;
}

class VoiceCommandHandler {
  private navigation: NavigationProp<RootStackParamList> | null = null;
  private dispatch: Dispatch | null = null;
  private currentLanguage: SupportedLanguage = 'en';

  /**
   * Initialize the voice command handler
   */
  initialize({ navigation, dispatch, currentLanguage }: VoiceCommandHandlerProps): void {
    this.navigation = navigation;
    this.dispatch = dispatch;
    this.currentLanguage = currentLanguage;
    
    // Set up voice service
    voiceService.setLanguage(currentLanguage);
    voiceService.registerCommands(voiceService.getDefaultCommands());
    
    // Set up i18n service
    i18nService.setLanguage(currentLanguage);
  }

  /**
   * Handle voice command execution
   */
  async handleCommand(command: VoiceCommand, recognizedText: string): Promise<void> {
    try {
      console.log(`Executing command: ${command.action}`, { command, recognizedText });

      switch (command.action) {
        case 'NAVIGATE':
          await this.handleNavigationCommand(command);
          break;
        case 'START_QUALITY_ANALYSIS':
          await this.handleQualityAnalysisCommand();
          break;
        case 'SEARCH_PRODUCTS':
          await this.handleSearchCommand(command, recognizedText);
          break;
        case 'FILTER_PRODUCTS':
          await this.handleFilterCommand(command, recognizedText);
          break;
        case 'CHECK_PRICE':
          await this.handlePriceCheckCommand();
          break;
        case 'SHOW_HELP':
          await this.handleHelpCommand();
          break;
        default:
          console.warn(`Unknown command action: ${command.action}`);
      }
    } catch (error) {
      console.error('Error executing voice command:', error);
      throw error;
    }
  }

  /**
   * Handle navigation commands
   */
  private async handleNavigationCommand(command: VoiceCommand): Promise<void> {
    if (!this.navigation) {
      throw new Error('Navigation not available');
    }

    const screenParam = command.parameters?.find(p => p.name === 'screen');
    if (!screenParam?.value) {
      throw new Error('Screen parameter not found');
    }

    const screenName = screenParam.value as keyof RootStackParamList;
    
    try {
      this.navigation.navigate(screenName as any);
      console.log(`Navigated to ${screenName}`);
    } catch (error) {
      console.error(`Failed to navigate to ${screenName}:`, error);
      throw error;
    }
  }

  /**
   * Handle quality analysis command
   */
  private async handleQualityAnalysisCommand(): Promise<void> {
    if (!this.navigation) {
      throw new Error('Navigation not available');
    }

    try {
      this.navigation.navigate('QualityAnalysis' as any);
      console.log('Navigated to Quality Analysis');
    } catch (error) {
      console.error('Failed to start quality analysis:', error);
      throw error;
    }
  }

  /**
   * Handle search commands
   */
  private async handleSearchCommand(command: VoiceCommand, recognizedText: string): Promise<void> {
    if (!this.navigation) {
      throw new Error('Navigation not available');
    }

    // Extract search query from recognized text
    const searchQuery = this.extractSearchQuery(recognizedText, command);
    
    if (!searchQuery) {
      throw new Error('Search query not found');
    }

    try {
      // Navigate to product list with search query
      this.navigation.navigate('ProductList' as any, { 
        searchQuery,
        filters: { query: searchQuery }
      });
      console.log(`Searching for: ${searchQuery}`);
    } catch (error) {
      console.error('Failed to perform search:', error);
      throw error;
    }
  }

  /**
   * Handle filter commands
   */
  private async handleFilterCommand(command: VoiceCommand, recognizedText: string): Promise<void> {
    if (!this.navigation) {
      throw new Error('Navigation not available');
    }

    // Extract category from recognized text
    const category = this.extractCategory(recognizedText);
    
    if (!category) {
      throw new Error('Category not found');
    }

    try {
      // Navigate to product list with category filter
      this.navigation.navigate('ProductList' as any, {
        filters: { category }
      });
      console.log(`Filtering by category: ${category}`);
    } catch (error) {
      console.error('Failed to apply filter:', error);
      throw error;
    }
  }

  /**
   * Handle price check commands
   */
  private async handlePriceCheckCommand(): Promise<void> {
    if (!this.navigation) {
      throw new Error('Navigation not available');
    }

    try {
      this.navigation.navigate('PriceRecommendations' as any);
      console.log('Navigated to Price Recommendations');
    } catch (error) {
      console.error('Failed to check prices:', error);
      throw error;
    }
  }

  /**
   * Handle help commands
   */
  private async handleHelpCommand(): Promise<void> {
    if (!this.navigation) {
      throw new Error('Navigation not available');
    }

    try {
      // You might want to show a help modal or navigate to a help screen
      // For now, we'll just log the available commands
      const commands = voiceService.getDefaultCommands();
      const helpText = this.generateHelpText(commands);
      console.log('Available voice commands:', helpText);
      
      // Could also dispatch an action to show help modal
      // this.dispatch?.({ type: 'ui/showHelpModal', payload: { commands } });
    } catch (error) {
      console.error('Failed to show help:', error);
      throw error;
    }
  }

  /**
   * Extract search query from recognized text
   */
  private extractSearchQuery(text: string, command: VoiceCommand): string | null {
    const lowerText = text.toLowerCase();
    
    // Find the first matching phrase
    const matchingPhrase = command.phrases.find(phrase => 
      lowerText.includes(phrase.toLowerCase())
    );
    
    if (!matchingPhrase) return null;
    
    // Extract text after the command phrase
    const phraseIndex = lowerText.indexOf(matchingPhrase.toLowerCase());
    const afterPhrase = text.substring(phraseIndex + matchingPhrase.length).trim();
    
    return afterPhrase || null;
  }

  /**
   * Extract category from recognized text
   */
  private extractCategory(text: string): string | null {
    const lowerText = text.toLowerCase();
    const categories = ['vegetables', 'fruits', 'grains', 'legumes'];
    
    // Check for category keywords in different languages
    const categoryMappings = {
      // English
      'vegetables': 'vegetables',
      'vegetable': 'vegetables',
      'fruits': 'fruits',
      'fruit': 'fruits',
      'grains': 'grains',
      'grain': 'grains',
      'legumes': 'legumes',
      'legume': 'legumes',
      
      // French
      'légumes': 'vegetables',
      'légume': 'vegetables',
      'fruits': 'fruits',
      'fruit': 'fruits',
      'céréales': 'grains',
      'céréale': 'grains',
      'légumineuses': 'legumes',
      
      // Swahili
      'mboga': 'vegetables',
      'matunda': 'fruits',
      'tunda': 'fruits',
      'nafaka': 'grains',
      'kunde': 'legumes',
      
      // Arabic
      'خضروات': 'vegetables',
      'خضرة': 'vegetables',
      'فواكه': 'fruits',
      'فاكهة': 'fruits',
      'حبوب': 'grains',
      'بقوليات': 'legumes'
    };

    for (const [keyword, category] of Object.entries(categoryMappings)) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return category;
      }
    }

    return null;
  }

  /**
   * Generate help text for available commands
   */
  private generateHelpText(commands: VoiceCommand[]): string {
    const helpItems = commands.map(command => {
      const phrase = command.phrases[0]; // Use first phrase as example
      return `"${phrase}" - ${command.description}`;
    });

    return helpItems.join('\n');
  }

  /**
   * Update language and reinitialize services
   */
  updateLanguage(language: SupportedLanguage): void {
    this.currentLanguage = language;
    voiceService.setLanguage(language);
    i18nService.setLanguage(language);
    
    // Re-register commands with new language
    voiceService.registerCommands(voiceService.getDefaultCommands());
  }

  /**
   * Get localized error messages
   */
  getLocalizedError(errorType: string): string {
    const errorMessages = {
      'navigationNotAvailable': i18nService.t('error.navigationNotAvailable'),
      'commandNotRecognized': i18nService.t('voice.commandNotRecognized'),
      'processingError': i18nService.t('voice.errorProcessing'),
      'networkError': i18nService.t('error.networkError'),
      'serverError': i18nService.t('error.serverError')
    };

    return errorMessages[errorType as keyof typeof errorMessages] || 
           i18nService.t('common.error');
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Check if voice service is available
   */
  async isVoiceAvailable(): Promise<boolean> {
    return await voiceService.isAvailable();
  }

  /**
   * Start listening for voice commands
   */
  async startListening(): Promise<void> {
    return await voiceService.startListening();
  }

  /**
   * Stop listening for voice commands
   */
  async stopListening(): Promise<void> {
    return await voiceService.stopListening();
  }

  /**
   * Get current listening status
   */
  isListening(): boolean {
    return voiceService.getIsListening();
  }
}

export const voiceCommandHandler = new VoiceCommandHandler();
export default voiceCommandHandler;