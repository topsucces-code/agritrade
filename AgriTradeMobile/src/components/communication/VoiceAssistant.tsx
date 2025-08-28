import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from 'react-native-voice';
import { VoiceAssistantProps, VoiceCommand, SupportedLanguage } from '@/types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isVisible = false,
  language = 'en',
  isOffline = false,
  onClose,
  onCommand,
  onLanguageChange,
  commands = [],
}) => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(language);
  const [availableLanguages] = useState<SupportedLanguage[]>(['en', 'fr', 'sw', 'ar']);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Animation values
  const scaleAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      showModal();
      initializeVoice();
    } else {
      hideModal();
    }

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [isVisible]);

  useEffect(() => {
    if (isListening) {
      startPulseAnimation();
      startWaveAnimation();
    } else {
      stopAnimations();
    }
  }, [isListening]);

  const initializeVoice = () => {
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechRecognized = onSpeechRecognized;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
  };

  const showModal = () => {
    Animated.spring(scaleAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 7,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(scaleAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startWaveAnimation = () => {
    Animated.loop(
      Animated.timing(waveAnimation, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopAnimations = () => {
    pulseAnimation.stopAnimation();
    waveAnimation.stopAnimation();
    pulseAnimation.setValue(1);
    waveAnimation.setValue(0);
  };

  const onSpeechStart = () => {
    console.log('Speech recognition started');
  };

  const onSpeechRecognized = () => {
    console.log('Speech recognized');
  };

  const onSpeechEnd = () => {
    setIsListening(false);
    console.log('Speech recognition ended');
  };

  const onSpeechError = (error: SpeechErrorEvent) => {
    console.error('Speech recognition error:', error);
    setIsListening(false);
    setIsProcessing(false);
    
    if (error.error?.message) {
      Alert.alert('Voice Error', error.error.message);
    }
  };

  const onSpeechResults = (result: SpeechResultsEvent) => {
    if (result.value && result.value.length > 0) {
      const recognizedText = result.value[0];
      setRecognizedText(recognizedText);
      processCommand(recognizedText);
    }
  };

  const onSpeechPartialResults = (result: SpeechResultsEvent) => {
    if (result.value && result.value.length > 0) {
      setRecognizedText(result.value[0]);
    }
  };

  const startListening = async () => {
    try {
      setRecognizedText('');
      setIsProcessing(false);
      setIsListening(true);

      const locale = getLocaleForLanguage(currentLanguage);
      await Voice.start(locale);
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      setIsListening(false);
      Alert.alert('Error', 'Could not start voice recognition');
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  const processCommand = async (text: string) => {
    setIsProcessing(true);

    try {
      // Find matching command
      const matchedCommand = findMatchingCommand(text.toLowerCase());
      
      if (matchedCommand) {
        await onCommand(matchedCommand, text);
        setRecognizedText(`✓ ${getLocalizedText('commandExecuted', currentLanguage)}`);
      } else {
        setRecognizedText(`❌ ${getLocalizedText('commandNotRecognized', currentLanguage)}`);
      }
    } catch (error) {
      console.error('Error processing command:', error);
      setRecognizedText(`❌ ${getLocalizedText('errorProcessing', currentLanguage)}`);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setRecognizedText('');
      }, 2000);
    }
  };

  const findMatchingCommand = (text: string): VoiceCommand | null => {
    return commands.find(command => {
      return command.phrases.some(phrase => 
        text.includes(phrase.toLowerCase()) ||
        phrase.toLowerCase().includes(text)
      );
    }) || null;
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setCurrentLanguage(lang);
    setShowLanguageSelector(false);
    onLanguageChange?.(lang);
  };

  const getLocaleForLanguage = (lang: SupportedLanguage): string => {
    const locales = {
      en: 'en-US',
      fr: 'fr-FR',
      sw: 'sw-KE',
      ar: 'ar-SA',
    };
    return locales[lang];
  };

  const getLocalizedText = (key: string, lang: SupportedLanguage): string => {
    const texts = {
      listening: {
        en: 'Listening...',
        fr: 'Écoute...',
        sw: 'Nasikiliza...',
        ar: 'أستمع...',
      },
      tapToSpeak: {
        en: 'Tap to speak',
        fr: 'Appuyez pour parler',
        sw: 'Gonga ili uongee',
        ar: 'اضغط للتحدث',
      },
      processing: {
        en: 'Processing...',
        fr: 'Traitement...',
        sw: 'Inachakata...',
        ar: 'معالجة...',
      },
      commandExecuted: {
        en: 'Command executed',
        fr: 'Commande exécutée',
        sw: 'Amri imetekelezwa',
        ar: 'تم تنفيذ الأمر',
      },
      commandNotRecognized: {
        en: 'Command not recognized',
        fr: 'Commande non reconnue',
        sw: 'Amri haijatambuliwa',
        ar: 'الأمر غير معروف',
      },
      errorProcessing: {
        en: 'Error processing command',
        fr: 'Erreur de traitement',
        sw: 'Hitilafu katika uchakataji',
        ar: 'خطأ في المعالجة',
      },
      offlineMode: {
        en: 'Voice assistant works offline',
        fr: 'Assistant vocal fonctionne hors ligne',
        sw: 'Msaidizi wa sauti anafanya kazi bila mtandao',
        ar: 'مساعد الصوت يعمل دون اتصال',
      },
    };

    return texts[key]?.[lang] || texts[key]?.en || key;
  };

  const getLanguageName = (lang: SupportedLanguage): string => {
    const names = {
      en: 'English',
      fr: 'Français',
      sw: 'Kiswahili',
      ar: 'العربية',
    };
    return names[lang];
  };

  const renderWaveform = () => {
    const waves = Array.from({ length: 5 }, (_, index) => (
      <Animated.View
        key={index}
        style={[
          styles.wave,
          {
            height: waveAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 60 + index * 10],
            }),
            opacity: waveAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
            transform: [{
              scaleY: waveAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
            }],
          },
        ]}
      />
    ));

    return <View style={styles.waveformContainer}>{waves}</View>;
  };

  const renderLanguageSelector = () => (
    <Modal
      visible={showLanguageSelector}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLanguageSelector(false)}
    >
      <View style={styles.languageModalOverlay}>
        <View style={styles.languageModal}>
          <Text style={styles.languageModalTitle}>Select Language</Text>
          {availableLanguages.map(lang => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageOption,
                currentLanguage === lang && styles.selectedLanguageOption,
              ]}
              onPress={() => handleLanguageChange(lang)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.languageOptionText,
                currentLanguage === lang && styles.selectedLanguageOptionText,
              ]}>
                {getLanguageName(lang)}
              </Text>
              {currentLanguage === lang && (
                <Icon name="check" size={20} color="#2E7D32" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnimation }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setShowLanguageSelector(true)}
              activeOpacity={0.7}
            >
              <Icon name="language" size={20} color="#757575" />
              <Text style={styles.languageText}>{currentLanguage.toUpperCase()}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Icon name="close" size={24} color="#757575" />
            </TouchableOpacity>
          </View>

          {/* Voice Interface */}
          <View style={styles.voiceInterface}>
            {/* Microphone Button */}
            <Animated.View
              style={[
                styles.microphoneContainer,
                {
                  transform: [{ scale: pulseAnimation }],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.microphoneButton,
                  isListening && styles.listeningButton,
                  isProcessing && styles.processingButton,
                ]}
                onPress={isListening ? stopListening : startListening}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                <Icon
                  name={
                    isProcessing ? "hourglass-empty" :
                    isListening ? "mic" : "mic-none"
                  }
                  size={48}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </Animated.View>

            {/* Waveform */}
            {isListening && renderWaveform()}

            {/* Status Text */}
            <Text style={styles.statusText}>
              {isProcessing
                ? getLocalizedText('processing', currentLanguage)
                : isListening
                ? getLocalizedText('listening', currentLanguage)
                : getLocalizedText('tapToSpeak', currentLanguage)}
            </Text>

            {/* Recognized Text */}
            {recognizedText ? (
              <View style={styles.textContainer}>
                <Text style={styles.recognizedText}>{recognizedText}</Text>
              </View>
            ) : null}

            {/* Offline Indicator */}
            {isOffline && (
              <View style={styles.offlineContainer}>
                <Icon name="wifi-off" size={16} color="#FF5722" />
                <Text style={styles.offlineText}>
                  {getLocalizedText('offlineMode', currentLanguage)}
                </Text>
              </View>
            )}
          </View>

          {/* Available Commands */}
          <View style={styles.commandsContainer}>
            <Text style={styles.commandsTitle}>Try saying:</Text>
            <View style={styles.commandsList}>
              {commands.slice(0, 3).map((command, index) => (
                <Text key={index} style={styles.commandExample}>
                  "{ command.phrases[0] }"
                </Text>
              ))}
            </View>
          </View>
        </Animated.View>

        {renderLanguageSelector()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  languageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
    marginLeft: 4,
  },
  closeButton: {
    padding: 8,
  },
  voiceInterface: {
    alignItems: 'center',
    marginBottom: 32,
  },
  microphoneContainer: {
    marginBottom: 24,
  },
  microphoneButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#757575',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  listeningButton: {
    backgroundColor: '#2E7D32',
  },
  processingButton: {
    backgroundColor: '#FF9800',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    marginBottom: 16,
  },
  wave: {
    width: 4,
    backgroundColor: '#2E7D32',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 16,
  },
  textContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    minHeight: 60,
    justifyContent: 'center',
    width: '100%',
  },
  recognizedText: {
    fontSize: 16,
    color: '#212121',
    textAlign: 'center',
    lineHeight: 24,
  },
  offlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 16,
  },
  offlineText: {
    fontSize: 12,
    color: '#FF5722',
    marginLeft: 4,
  },
  commandsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  commandsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  commandsList: {
    gap: 4,
  },
  commandExample: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
  },
  languageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: screenWidth * 0.8,
    maxHeight: screenHeight * 0.6,
  },
  languageModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedLanguageOption: {
    backgroundColor: '#E8F5E8',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#212121',
  },
  selectedLanguageOptionText: {
    color: '#2E7D32',
    fontWeight: '500',
  },
});

export default VoiceAssistant;