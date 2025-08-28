import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Recommendation } from '@/types';

interface RecommendationListProps {
  recommendations: Recommendation[];
  onRecommendationPress?: (recommendation: Recommendation) => void;
  onMarkAsImplemented?: (recommendationId: string) => void;
  showActions?: boolean;
}

const RecommendationList: React.FC<RecommendationListProps> = ({
  recommendations,
  onRecommendationPress,
  onMarkAsImplemented,
  showActions = true,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#757575';
    }
  };

  const getPriorityIcon = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'remove';
      case 'low':
        return 'keyboard-arrow-down';
      default:
        return 'help';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quality_improvement':
        return 'star';
      case 'pricing':
        return 'attach-money';
      case 'marketing':
        return 'campaign';
      case 'storage':
        return 'storage';
      default:
        return 'lightbulb';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quality_improvement':
        return '#2E7D32';
      case 'pricing':
        return '#FF8F00';
      case 'marketing':
        return '#2196F3';
      case 'storage':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  const handleMarkAsImplemented = (recommendationId: string) => {
    Alert.alert(
      'Mark as Implemented',
      'Have you successfully implemented this recommendation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Mark as Done',
          style: 'default',
          onPress: () => onMarkAsImplemented?.(recommendationId),
        },
      ]
    );
  };

  if (recommendations.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Icon name="lightbulb-outline" size={48} color="#E0E0E0" />
        <Text style={styles.emptyStateTitle}>No Recommendations Yet</Text>
        <Text style={styles.emptyStateText}>
          Complete a quality analysis to get personalized recommendations
        </Text>
      </View>
    );
  }

  // Group recommendations by priority
  const groupedRecommendations = recommendations.reduce((groups, rec) => {
    const priority = rec.priority;
    if (!groups[priority]) {
      groups[priority] = [];
    }
    groups[priority].push(rec);
    return groups;
  }, {} as Record<string, Recommendation[]>);

  const priorityOrder: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Recommendations</Text>
        <Text style={styles.headerSubtitle}>
          Personalized suggestions to improve your crop quality and sales
        </Text>
      </View>

      {priorityOrder.map((priority) => {
        const items = groupedRecommendations[priority];
        if (!items || items.length === 0) return null;

        return (
          <View key={priority} style={styles.prioritySection}>
            <View style={styles.priorityHeader}>
              <Icon
                name={getPriorityIcon(priority)}
                size={20}
                color={getPriorityColor(priority)}
              />
              <Text style={[styles.priorityTitle, { color: getPriorityColor(priority) }]}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
              </Text>
              <Text style={styles.priorityCount}>({items.length})</Text>
            </View>

            {items.map((recommendation) => {
              const isExpanded = expandedItems.has(recommendation.id);
              
              return (
                <TouchableOpacity
                  key={recommendation.id}
                  style={styles.recommendationCard}
                  onPress={() => {
                    toggleExpanded(recommendation.id);
                    onRecommendationPress?.(recommendation);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.recommendationHeader}>
                    <View style={styles.recommendationTitleRow}>
                      <View style={[
                        styles.typeIcon,
                        { backgroundColor: `${getTypeColor(recommendation.type)}20` }
                      ]}>
                        <Icon
                          name={getTypeIcon(recommendation.type)}
                          size={16}
                          color={getTypeColor(recommendation.type)}
                        />
                      </View>
                      <Text style={styles.recommendationTitle} numberOfLines={isExpanded ? 0 : 2}>
                        {recommendation.title}
                      </Text>
                      <Icon
                        name={isExpanded ? 'expand-less' : 'expand-more'}
                        size={24}
                        color="#757575"
                      />
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.recommendationContent}>
                      <Text style={styles.recommendationDescription}>
                        {recommendation.description}
                      </Text>

                      {recommendation.estimatedImpact && (
                        <View style={styles.impactContainer}>
                          <Icon name="trending-up" size={16} color="#4CAF50" />
                          <Text style={styles.impactText}>
                            Expected Impact: {recommendation.estimatedImpact}
                          </Text>
                        </View>
                      )}

                      <View style={styles.recommendationMeta}>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaLabel}>Type:</Text>
                          <Text style={styles.metaValue}>
                            {recommendation.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Text style={styles.metaLabel}>Actionable:</Text>
                          <Text style={[
                            styles.metaValue,
                            { color: recommendation.actionable ? '#4CAF50' : '#FF9800' }
                          ]}>
                            {recommendation.actionable ? 'Yes' : 'Informational'}
                          </Text>
                        </View>
                      </View>

                      {showActions && recommendation.actionable && (
                        <View style={styles.actionButtons}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleMarkAsImplemented(recommendation.id)}
                            activeOpacity={0.7}
                          >
                            <Icon name="check" size={16} color="#4CAF50" />
                            <Text style={styles.actionButtonText}>Mark as Done</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryActionButton]}
                            onPress={() => {
                              // Handle "Learn More" action
                              Alert.alert(
                                'Learn More',
                                'This feature will provide detailed guidance on implementing this recommendation.',
                                [{ text: 'OK' }]
                              );
                            }}
                            activeOpacity={0.7}
                          >
                            <Icon name="info" size={16} color="#2196F3" />
                            <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>
                              Learn More
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}

      {/* Tips Section */}
      <View style={styles.tipsSection}>
        <View style={styles.tipsHeader}>
          <Icon name="tips-and-updates" size={20} color="#FF8F00" />
          <Text style={styles.tipsTitle}>💡 Pro Tips</Text>
        </View>
        <View style={styles.tipsList}>
          <Text style={styles.tipText}>
            • Implement high-priority recommendations first for maximum impact
          </Text>
          <Text style={styles.tipText}>
            • Take new photos after implementing recommendations to track improvements
          </Text>
          <Text style={styles.tipText}>
            • Market conditions change - check recommendations regularly
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
  },
  prioritySection: {
    marginBottom: 16,
  },
  priorityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  priorityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  priorityCount: {
    fontSize: 12,
    color: '#757575',
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recommendationHeader: {
    padding: 16,
  },
  recommendationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
    lineHeight: 20,
  },
  recommendationContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  recommendationDescription: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
    marginBottom: 12,
  },
  impactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  impactText: {
    fontSize: 12,
    color: '#2E7D32',
    marginLeft: 6,
  },
  recommendationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#212121',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 6,
  },
  secondaryActionButton: {
    backgroundColor: '#E3F2FD',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#757575',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  tipsSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginLeft: 8,
  },
  tipsList: {
    gap: 6,
  },
  tipText: {
    fontSize: 12,
    color: '#757575',
    lineHeight: 16,
  },
});

export default RecommendationList;