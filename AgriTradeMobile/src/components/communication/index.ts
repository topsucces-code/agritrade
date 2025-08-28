export { default as ChatInterface } from './ChatInterface';
export { default as VoiceAssistant } from './VoiceAssistant';
export { default as NotificationCenter } from './NotificationCenter';

// Re-export types for convenience
export type { 
  ChatInterfaceProps, 
  VoiceAssistantProps, 
  NotificationCenterProps,
  Message,
  MessageType,
  VoiceCommand,
  Notification,
  NotificationType,
  SupportedLanguage,
} from '@/types';