import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { SupportedLanguage, VoiceCommand, VoiceCommandResult } from '@/types';
import { voiceService } from '@/services/voiceService';
import { i18nService } from '@/services/i18nService';
import { voiceCommandHandler } from '@/services/voiceCommandHandler';
import { RootState } from '@/store';

/**
 * Hook for voice assistant functionality
 */
export const useVoiceAssistant = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const currentLanguage = useSelector((state: RootState) => state.auth.user?.language || 'en') as SupportedLanguage;
  
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeVoiceAssistant();
    
    return () => {
      voiceService.cleanup();
    };
  }, []);

  useEffect(() => {
    // Update language when it changes
    voiceCommandHandler.updateLanguage(currentLanguage);
  }, [currentLanguage]);

  const initializeVoiceAssistant = async () => {
    try {
      await voiceService.initialize();
      voiceCommandHandler.initialize({
        navigation: navigation as any,
        dispatch,
        currentLanguage
      });
      
      const available = await voiceService.isAvailable();
      setIsAvailable(available);
    } catch (error) {
      console.error('Failed to initialize voice assistant:', error);
      setError('Failed to initialize voice assistant');
    }
  };

  const startListening = useCallback(async () => {
    if (!isAvailable || isListening) return;

    try {
      setError(null);
      setRecognizedText('');
      setIsListening(true);
      await voiceService.startListening();
    } catch (error) {
      console.error('Failed to start listening:', error);
      setError('Failed to start voice recognition');
      setIsListening(false);
    }
  }, [isAvailable, isListening]);

  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await voiceService.stopListening();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop listening:', error);
      setError('Failed to stop voice recognition');
    }
  }, [isListening]);

  const processCommand = useCallback(async (command: VoiceCommand, recognizedText: string) => {
    setIsProcessing(true);
    
    try {
      await voiceCommandHandler.handleCommand(command, recognizedText);
      setRecognizedText(`✓ ${i18nService.t('voice.commandExecuted')}`);
    } catch (error) {
      console.error('Failed to process command:', error);
      setError('Failed to process voice command');
      setRecognizedText(`❌ ${i18nService.t('voice.errorProcessing')}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setRecognizedText('');
      }, 2000);
    }
  }, []);

  const getAvailableCommands = useCallback(() => {
    return voiceService.getDefaultCommands();
  }, []);

  return {
    isListening,
    isProcessing,
    recognizedText,
    isAvailable,
    error,
    startListening,
    stopListening,
    processCommand,
    getAvailableCommands,
    currentLanguage
  };
};

/**
 * Hook for internationalization functionality
 */
export const useI18n = () => {
  const dispatch = useDispatch();
  const currentLanguage = useSelector((state: RootState) => state.auth.user?.language || 'en') as SupportedLanguage;

  useEffect(() => {
    i18nService.setLanguage(currentLanguage);
  }, [currentLanguage]);

  const t = useCallback((key: string, params?: Record<string, string>) => {
    return i18nService.translate(key, params);
  }, []);

  const changeLanguage = useCallback((language: SupportedLanguage) => {
    i18nService.setLanguage(language);
    // You might want to dispatch an action to update the language in the store
    // dispatch(updateUserLanguage(language));
  }, [dispatch]);

  const formatNumber = useCallback((number: number) => {
    return i18nService.formatNumber(number);
  }, []);

  const formatCurrency = useCallback((amount: number, currency?: string) => {
    return i18nService.formatCurrency(amount, currency);
  }, []);

  const formatDate = useCallback((date: Date) => {
    return i18nService.formatDate(date);
  }, []);

  const getAvailableLanguages = useCallback(() => {
    return i18nService.getAvailableLanguages();
  }, []);

  const isRTL = useCallback(() => {
    return i18nService.isRTL();
  }, []);

  const getRTLStyle = useCallback((styles: any) => {
    return i18nService.getRTLStyle(styles);
  }, []);

  return {
    t,
    currentLanguage,
    changeLanguage,
    formatNumber,
    formatCurrency,
    formatDate,
    getAvailableLanguages,
    isRTL,
    getRTLStyle
  };
};

/**
 * Hook for combined voice and i18n functionality
 */
export const useVoiceI18n = () => {
  const voiceAssistant = useVoiceAssistant();
  const i18n = useI18n();

  return {
    ...voiceAssistant,
    ...i18n
  };
};

/**
 * Hook for language-aware voice commands
 */
export const useLocalizedVoiceCommands = () => {
  const { t, currentLanguage } = useI18n();
  const { getAvailableCommands } = useVoiceAssistant();

  const getLocalizedCommands = useCallback(() => {
    const commands = getAvailableCommands();
    
    return commands.map(command => ({
      ...command,
      localizedDescription: t(`voice.command.${command.id}`, { 
        defaultValue: command.description 
      }),
      localizedPhrases: command.phrases.filter(phrase => {
        // Filter phrases based on current language
        // This is a simple approach - you might want more sophisticated language detection
        if (currentLanguage === 'en') return /^[a-zA-Z\s]+$/.test(phrase);
        if (currentLanguage === 'fr') return /[àâäéèêëïîôöùûüÿ]/.test(phrase) || /^[a-zA-Z\s]+$/.test(phrase);
        if (currentLanguage === 'sw') return /^[a-zA-Z\s]+$/.test(phrase); // Simplified for Swahili
        if (currentLanguage === 'ar') return /[\u0600-\u06FF]/.test(phrase);
        return true;
      })
    }));
  }, [getAvailableCommands, t, currentLanguage]);

  return {
    getLocalizedCommands,
    currentLanguage
  };
};

/**
 * Hook for managing voice assistant state across the app
 */
export const useVoiceAssistantState = () => {
  const [isVoiceAssistantVisible, setIsVoiceAssistantVisible] = useState(false);
  const [voiceAssistantError, setVoiceAssistantError] = useState<string | null>(null);

  const showVoiceAssistant = useCallback(() => {
    setIsVoiceAssistantVisible(true);
    setVoiceAssistantError(null);
  }, []);

  const hideVoiceAssistant = useCallback(() => {
    setIsVoiceAssistantVisible(false);
  }, []);

  const setError = useCallback((error: string | null) => {
    setVoiceAssistantError(error);
  }, []);

  return {
    isVoiceAssistantVisible,
    voiceAssistantError,
    showVoiceAssistant,
    hideVoiceAssistant,
    setError
  };
};