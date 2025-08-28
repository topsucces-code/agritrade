import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { VoiceAssistant } from '@/components/communication';
import { useVoiceAssistant, useVoiceAssistantState, useI18n } from '@/hooks/useVoiceI18n';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FloatingVoiceButtonProps {
  isVisible?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size?: 'small' | 'medium' | 'large';
  onVoiceCommand?: (command: any, text: string) => void;
}

const FloatingVoiceButton: React.FC<FloatingVoiceButtonProps> = ({
  isVisible = true,
  position = 'bottom-right',
  size = 'medium',
  onVoiceCommand,
}) => {
  const { t, currentLanguage } = useI18n();
  const {
    isListening,
    isProcessing,
    isAvailable,
    startListening,
    stopListening,
    processCommand,
    getAvailableCommands,
  } = useVoiceAssistant();
  
  const {
    isVoiceAssistantVisible,
    showVoiceAssistant,
    hideVoiceAssistant,
  } = useVoiceAssistantState();

  const [isDragging, setIsDragging] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
  
  // Animations
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const dragAnimation = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    // Set initial position based on prop
    setInitialPosition();
  }, [position]);

  useEffect(() => {
    // Start pulse animation when listening
    if (isListening) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [isListening]);

  const setInitialPosition = () => {
    const buttonSize = getButtonSize();
    const margin = 20;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'bottom-right':
        x = screenWidth - buttonSize - margin;
        y = screenHeight - buttonSize - margin - 100; // Account for bottom tab bar
        break;
      case 'bottom-left':
        x = margin;
        y = screenHeight - buttonSize - margin - 100;
        break;
      case 'top-right':
        x = screenWidth - buttonSize - margin;
        y = margin + 100; // Account for header
        break;
      case 'top-left':
        x = margin;
        y = margin + 100;
        break;
    }

    setButtonPosition({ x, y });
    dragAnimation.setValue({ x, y });
  };

  const getButtonSize = () => {
    switch (size) {
      case 'small': return 48;
      case 'large': return 72;
      default: return 60;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'large': return 32;
      default: return 24;
    }
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

  const stopPulseAnimation = () => {
    pulseAnimation.stopAnimation();
    pulseAnimation.setValue(1);
  };

  const handlePress = () => {
    if (isListening) {
      stopListening();
    } else {
      showVoiceAssistant();
    }

    // Scale animation feedback
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLongPress = () => {
    if (!isAvailable) return;
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleVoiceCommand = async (command: any, recognizedText: string) => {
    try {
      await processCommand(command, recognizedText);
      onVoiceCommand?.(command, recognizedText);
    } catch (error) {
      console.error('Error processing voice command:', error);
    }
  };

  const getButtonColor = () => {
    if (isProcessing) return '#FF9800'; // Orange
    if (isListening) return '#4CAF50'; // Green
    if (!isAvailable) return '#BDBDBD'; // Gray
    return '#2E7D32'; // Default green
  };

  const getButtonIcon = () => {
    if (isProcessing) return 'hourglass-empty';
    if (isListening) return 'mic';
    if (!isAvailable) return 'mic-off';
    return 'mic-none';
  };

  if (!isVisible) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateX: dragAnimation.x },
              { translateY: dragAnimation.y },
              { scale: scaleAnimation },
              { scale: pulseAnimation },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              width: getButtonSize(),
              height: getButtonSize(),
              borderRadius: getButtonSize() / 2,
              backgroundColor: getButtonColor(),
            },
          ]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
          disabled={!isAvailable}
        >
          <Icon
            name={getButtonIcon()}
            size={getIconSize()}
            color="#FFFFFF"
          />
          
          {/* Status indicator */}
          {(isListening || isProcessing) && (
            <View style={[styles.statusIndicator, {
              backgroundColor: isListening ? '#4CAF50' : '#FF9800'
            }]} />
          )}
        </TouchableOpacity>

        {/* Ripple effect for listening state */}
        {isListening && (
          <Animated.View
            style={[
              styles.ripple,
              {
                width: getButtonSize() * 1.5,
                height: getButtonSize() * 1.5,
                borderRadius: (getButtonSize() * 1.5) / 2,
                transform: [{ scale: pulseAnimation }],
              },
            ]}
          />
        )}
      </Animated.View>

      {/* Voice Assistant Modal */}
      <VoiceAssistant
        isVisible={isVoiceAssistantVisible}
        language={currentLanguage}
        commands={getAvailableCommands()}
        onClose={hideVoiceAssistant}
        onCommand={handleVoiceCommand}
        onLanguageChange={(language) => {
          // Handle language change if needed
          console.log('Language changed to:', language);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statusIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  ripple: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: 'rgba(46, 125, 50, 0.2)',
    marginTop: -36, // Half of ripple size
    marginLeft: -36,
  },
});

export default FloatingVoiceButton;