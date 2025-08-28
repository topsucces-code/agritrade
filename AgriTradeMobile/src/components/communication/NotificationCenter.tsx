import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NotificationCenterProps, Notification, NotificationType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications = [],
  isVisible = false,
  unreadCount = 0,
  isOffline = false,
  onClose,
  onNotificationPress,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onRefresh,
  isRefreshing = false,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | NotificationType>('all');
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>(notifications);
  const slideAnimation = new Animated.Value(screenHeight);

  const notificationFilters: Array<{ key: 'all' | NotificationType; label: string; icon: string }> = [
    { key: 'all', label: 'All', icon: 'notifications' },
    { key: 'message', label: 'Messages', icon: 'message' },
    { key: 'order', label: 'Orders', icon: 'shopping-cart' },
    { key: 'quality', label: 'Quality', icon: 'verified' },
    { key: 'price', label: 'Prices', icon: 'trending-up' },
    { key: 'system', label: 'System', icon: 'settings' },
  ];

  useEffect(() => {
    if (isVisible) {
      showNotificationCenter();
    } else {
      hideNotificationCenter();
    }
  }, [isVisible]);

  useEffect(() => {
    filterNotifications();
  }, [notifications, selectedFilter]);

  const showNotificationCenter = () => {
    Animated.spring(slideAnimation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const hideNotificationCenter = () => {
    Animated.timing(slideAnimation, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const filterNotifications = () => {
    if (selectedFilter === 'all') {
      setFilteredNotifications(notifications);
    } else {
      setFilteredNotifications(
        notifications.filter(notification => notification.type === selectedFilter)
      );
    }
  };

  const getNotificationIcon = (type: NotificationType): string => {
    const icons = {
      message: 'message',
      order: 'shopping-cart',
      quality: 'verified',
      price: 'trending-up',
      system: 'info',
      payment: 'payment',
      shipping: 'local-shipping',
    };
    return icons[type] || 'notifications';
  };

  const getNotificationColor = (type: NotificationType): string => {
    const colors = {
      message: '#2196F3',
      order: '#4CAF50',
      quality: '#FF9800',
      price: '#9C27B0',
      system: '#757575',
      payment: '#00BCD4',
      shipping: '#FF5722',
    };
    return colors[type] || '#757575';
  };

  const getPriorityIndicator = (priority: 'low' | 'medium' | 'high'): JSX.Element | null => {
    if (priority === 'high') {
      return <View style={styles.highPriorityIndicator} />;
    }
    return null;
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead?.(notification.id);
    }
    onNotificationPress?.(notification);
  };

  const handleDeleteNotification = (notificationId: string) => {
    onDeleteNotification?.(notificationId);
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const timeAgo = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.unreadNotification,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          {/* Icon and Priority */}
          <View style={styles.notificationLeft}>
            <View style={[
              styles.iconContainer,
              { backgroundColor: getNotificationColor(item.type) },
            ]}>
              <Icon
                name={getNotificationIcon(item.type)}
                size={20}
                color="#FFFFFF"
              />
            </View>
            {getPriorityIndicator(item.priority)}
          </View>

          {/* Content */}
          <View style={styles.notificationText}>
            <Text style={[
              styles.notificationTitle,
              !item.read && styles.unreadTitle,
            ]}>
              {item.title}
            </Text>
            <Text style={styles.notificationMessage} numberOfLines={2}>
              {item.message}
            </Text>
            <View style={styles.notificationMeta}>
              <Text style={styles.notificationTime}>{timeAgo}</Text>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.notificationActions}>
            {item.actionable && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
              >
                <Icon name="arrow-forward-ios" size={16} color="#757575" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteNotification(item.id)}
              activeOpacity={0.7}
            >
              <Icon name="close" size={16} color="#757575" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={notificationFilters}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const isSelected = selectedFilter === item.key;
          const count = item.key === 'all' 
            ? notifications.length 
            : notifications.filter(n => n.type === item.key).length;

          return (
            <TouchableOpacity
              style={[
                styles.filterTab,
                isSelected && styles.selectedFilterTab,
              ]}
              onPress={() => setSelectedFilter(item.key)}
              activeOpacity={0.7}
            >
              <Icon
                name={item.icon}
                size={18}
                color={isSelected ? '#2E7D32' : '#757575'}
              />
              <Text style={[
                styles.filterTabText,
                isSelected && styles.selectedFilterTabText,
              ]}>
                {item.label}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.filterBadge,
                  isSelected && styles.selectedFilterBadge,
                ]}>
                  <Text style={[
                    styles.filterBadgeText,
                    isSelected && styles.selectedFilterBadgeText,
                  ]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.headerActions}>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onMarkAllAsRead}
            activeOpacity={0.7}
          >
            <Icon name="done-all" size={20} color="#2E7D32" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.headerButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Icon name="close" size={24} color="#757575" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="notifications-none" size={64} color="#E0E0E0" />
      <Text style={styles.emptyStateTitle}>No notifications</Text>
      <Text style={styles.emptyStateText}>
        {selectedFilter === 'all'
          ? "You're all caught up!"
          : `No ${selectedFilter} notifications`}
      </Text>
    </View>
  );

  const renderOfflineIndicator = () => {
    if (!isOffline) return null;

    return (
      <View style={styles.offlineIndicator}>
        <Icon name="wifi-off" size={16} color="#FF5722" />
        <Text style={styles.offlineText}>
          Notifications will sync when online
        </Text>
      </View>
    );
  };

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
              transform: [{ translateY: slideAnimation }],
            },
          ]}
        >
          {renderHeader()}
          {renderOfflineIndicator()}
          {renderFilterTabs()}

          <FlatList
            data={filteredNotifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.notificationsList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={['#2E7D32']}
                tintColor="#2E7D32"
              />
            }
            ListEmptyComponent={renderEmptyState}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.9,
    minHeight: screenHeight * 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212121',
  },
  unreadBadge: {
    backgroundColor: '#F44336',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
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
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  selectedFilterTab: {
    backgroundColor: '#E8F5E8',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#757575',
    marginLeft: 4,
  },
  selectedFilterTabText: {
    color: '#2E7D32',
  },
  filterBadge: {
    backgroundColor: '#BDBDBD',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
    minWidth: 16,
    alignItems: 'center',
  },
  selectedFilterBadge: {
    backgroundColor: '#4CAF50',
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedFilterBadgeText: {
    color: '#FFFFFF',
  },
  notificationsList: {
    paddingBottom: 20,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  unreadNotification: {
    backgroundColor: '#FAFAFA',
  },
  notificationContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  notificationLeft: {
    marginRight: 12,
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highPriorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
    marginTop: 4,
  },
  notificationText: {
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212121',
    marginBottom: 2,
  },
  unreadTitle: {
    fontWeight: '600',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTime: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E7D32',
    marginLeft: 8,
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#757575',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
  },
});

export default NotificationCenter;