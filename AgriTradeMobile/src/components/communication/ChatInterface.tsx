import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ChatInterfaceProps, Message, MessageType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window');

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatId,
  currentUserId,
  otherUser,
  messages: initialMessages = [],
  onSendMessage,
  onSendImage,
  onSendVoice,
  onTyping,
  isTyping = false,
  isLoading = false,
  isOffline = false,
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    setInputText('');

    try {
      await onSendMessage(messageText);
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setInputText(messageText); // Restore text on error
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    onTyping?.(text.length > 0);
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Send Image',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => onSendImage?.('camera') },
        { text: 'Gallery', onPress: () => onSendImage?.('gallery') },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const handleVoiceRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      onSendVoice?.('stop');
    } else {
      setIsRecording(true);
      onSendVoice?.('start');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUserId;
    const messageTime = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownBubble : styles.otherBubble,
        ]}>
          {/* Message Content */}
          {item.type === 'text' && (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}>
              {item.content}
            </Text>
          )}

          {item.type === 'image' && (
            <View style={styles.imageMessage}>
              <Icon name="image" size={32} color="#757575" />
              <Text style={styles.imageText}>Image</Text>
            </View>
          )}

          {item.type === 'voice' && (
            <View style={styles.voiceMessage}>
              <Icon name="mic" size={20} color="#757575" />
              <Text style={styles.voiceText}>Voice message</Text>
              <Text style={styles.voiceDuration}>{item.duration || '0:10'}</Text>
            </View>
          )}

          {item.type === 'product' && (
            <View style={styles.productMessage}>
              <Icon name="inventory" size={24} color="#2E7D32" />
              <Text style={styles.productText}>Product shared</Text>
            </View>
          )}

          {/* Message Status */}
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}>
              {messageTime}
            </Text>
            
            {isOwnMessage && (
              <Icon
                name={
                  item.status === 'sent' ? 'check' :
                  item.status === 'delivered' ? 'done-all' :
                  item.status === 'read' ? 'done-all' : 'schedule'
                }
                size={14}
                color={
                  item.status === 'read' ? '#4CAF50' :
                  item.status === 'delivered' ? '#757575' :
                  '#9E9E9E'
                }
                style={styles.statusIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <View style={[styles.messageContainer, styles.otherMessage]}>
        <View style={[styles.messageBubble, styles.otherBubble, styles.typingBubble]}>
          <Text style={styles.typingText}>{otherUser.name} is typing...</Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {otherUser.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{otherUser.name}</Text>
          <Text style={styles.userStatus}>
            {isOffline ? 'Offline' : 'Online'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderInput = () => (
    <View style={styles.inputContainer}>
      {/* Offline Indicator */}
      {isOffline && (
        <View style={styles.offlineIndicator}>
          <Icon name="wifi-off" size={16} color="#FF5722" />
          <Text style={styles.offlineText}>Messages will be sent when online</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        {/* Attachment Button */}
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleImagePicker}
          activeOpacity={0.7}
        >
          <Icon name="attach-file" size={24} color="#757575" />
        </TouchableOpacity>

        {/* Text Input */}
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Type a message..."
          placeholderTextColor="#9E9E9E"
          multiline
          maxLength={1000}
          editable={!isLoading}
        />

        {/* Voice/Send Button */}
        {inputText.trim() ? (
          <TouchableOpacity
            style={[styles.sendButton, isLoading && styles.disabledButton]}
            onPress={handleSendMessage}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Icon name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isRecording && styles.recordingButton,
            ]}
            onPress={handleVoiceRecording}
            activeOpacity={0.7}
          >
            <Icon 
              name={isRecording ? "stop" : "mic"} 
              size={20} 
              color={isRecording ? "#FFFFFF" : "#757575"} 
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderHeader()}
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderTypingIndicator}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {renderInput()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  userStatus: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ownBubble: {
    backgroundColor: '#2E7D32',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  typingBubble: {
    backgroundColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#212121',
  },
  typingText: {
    fontSize: 14,
    color: '#757575',
    fontStyle: 'italic',
  },
  imageMessage: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  imageText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  voiceText: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 8,
    flex: 1,
  },
  voiceDuration: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  productMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  productText: {
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 8,
    fontWeight: '500',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    marginRight: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#9E9E9E',
  },
  statusIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#FFF3E0',
  },
  offlineText: {
    fontSize: 12,
    color: '#FF5722',
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: '#F8F9FA',
  },
  sendButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  recordingButton: {
    backgroundColor: '#F44336',
  },
  disabledButton: {
    backgroundColor: '#BDBDBD',
  },
});

export default ChatInterface;