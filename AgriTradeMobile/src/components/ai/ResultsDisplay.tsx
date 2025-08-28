import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { QualityResult } from '@/types';
import QualityIndicator from '@/components/product/QualityIndicator';

const { width: screenWidth } = Dimensions.get('window');

interface ResultsDisplayProps {
  results: QualityResult;
  onRecommendationsPress?: () => void;
  onSaveResults?: () => void;
  onRetakePhotos?: () => void;
  showActions?: boolean;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  onRecommendationsPress,
  onSaveResults,
  onRetakePhotos,
  showActions = true,
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'details' | 'pricing'>('overview');

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getQualityGrade = (score: number) => {
    if (score >= 9.0) return { grade: 'A+', description: 'Premium Grade' };
    if (score >= 8.0) return { grade: 'A', description: 'Excellent' };
    if (score >= 7.0) return { grade: 'B+', description: 'Very Good' };
    if (score >= 6.0) return { grade: 'B', description: 'Good' };
    if (score >= 5.0) return { grade: 'C', description: 'Fair' };
    return { grade: 'D', description: 'Needs Improvement' };
  };

  const handleShare = async () => {
    try {
      const { grade, description } = getQualityGrade(results.overallScore);
      const shareMessage = `🌾 AgriTrade AI Quality Analysis Results

Product Quality Score: ${results.overallScore.toFixed(1)}/10 (${grade} - ${description})

Visual Quality Breakdown:
• Color: ${results.visualQuality.color.toFixed(1)}/10
• Texture: ${results.visualQuality.texture.toFixed(1)}/10
• Size: ${results.visualQuality.size.toFixed(1)}/10
• Uniformity: ${results.visualQuality.uniformity.toFixed(1)}/10

Estimated Price: $${results.priceImpact.adjustedPrice.toLocaleString()}

Analyzed on ${formatDate(results.analysisDate)}

#AgriTradeAI #SmartFarming #QualityAnalysis`;

      await Share.share({
        message: shareMessage,
        title: 'Quality Analysis Results',
      });
    } catch (error) {
      console.error('Error sharing results:', error);
    }
  };

  const renderOverviewTab = () => {
    const { grade, description } = getQualityGrade(results.overallScore);

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Overall Score Card */}
        <Animatable.View animation="fadeInUp" delay={100} style={styles.scoreCard}>
          <Text style={styles.cardTitle}>Overall Quality Score</Text>
          <View style={styles.scoreContainer}>
            <QualityIndicator
              score={results.overallScore}
              size="large"
              showLabel={false}
              animated={true}
            />
            <View style={styles.gradeInfo}>
              <Text style={styles.gradeText}>{grade}</Text>
              <Text style={styles.gradeDescription}>{description}</Text>
            </View>
          </View>
        </Animatable.View>

        {/* Visual Quality Breakdown */}
        <Animatable.View animation="fadeInUp" delay={200} style={styles.breakdownCard}>
          <Text style={styles.cardTitle}>Quality Breakdown</Text>
          <View style={styles.qualityMetrics}>
            {[
              { label: 'Color', value: results.visualQuality.color, icon: 'palette' },
              { label: 'Texture', value: results.visualQuality.texture, icon: 'texture' },
              { label: 'Size', value: results.visualQuality.size, icon: 'straighten' },
              { label: 'Uniformity', value: results.visualQuality.uniformity, icon: 'tune' },
            ].map((metric, index) => (
              <Animatable.View
                key={metric.label}
                animation="slideInLeft"
                delay={300 + index * 100}
                style={styles.metricRow}
              >
                <View style={styles.metricInfo}>
                  <Icon name={metric.icon} size={20} color="#2E7D32" />
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </View>
                <View style={styles.metricScore}>
                  <View style={styles.metricBar}>
                    <View
                      style={[
                        styles.metricFill,
                        { width: `${(metric.value / 10) * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.metricValue}>{metric.value.toFixed(1)}</Text>
                </View>
              </Animatable.View>
            ))}
          </View>
        </Animatable.View>

        {/* Price Impact */}
        <Animatable.View animation="fadeInUp" delay={600} style={styles.priceCard}>
          <Text style={styles.cardTitle}>Price Impact</Text>
          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Estimated Price:</Text>
              <Text style={styles.priceValue}>
                ${results.priceImpact.adjustedPrice.toLocaleString()}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Quality Adjustment:</Text>
              <Text style={[
                styles.priceAdjustment,
                {
                  color: results.priceImpact.adjustmentPercentage >= 0 ? '#4CAF50' : '#F44336'
                }
              ]}>
                {results.priceImpact.adjustmentPercentage >= 0 ? '+' : ''}
                {results.priceImpact.adjustmentPercentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        </Animatable.View>

        {/* Analysis Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Analysis completed on {formatDate(results.analysisDate)}
          </Text>
          <Text style={styles.infoSubtext}>
            Results are based on AI-powered visual analysis and current market conditions
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Defects Analysis */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Defects Analysis</Text>
        {results.defects.length > 0 ? (
          results.defects.map((defect, index) => (
            <View key={index} style={styles.defectItem}>
              <View style={styles.defectHeader}>
                <Icon
                  name="warning"
                  size={20}
                  color={defect.severity === 'high' ? '#F44336' : defect.severity === 'medium' ? '#FF9800' : '#4CAF50'}
                />
                <Text style={styles.defectType}>{defect.type}</Text>
                <View style={[
                  styles.severityBadge,
                  {
                    backgroundColor: defect.severity === 'high' ? '#FFEBEE' : 
                                   defect.severity === 'medium' ? '#FFF3E0' : '#E8F5E8'
                  }
                ]}>
                  <Text style={[
                    styles.severityText,
                    {
                      color: defect.severity === 'high' ? '#F44336' : 
                             defect.severity === 'medium' ? '#FF9800' : '#4CAF50'
                    }
                  ]}>
                    {defect.severity}
                  </Text>
                </View>
              </View>
              <View style={styles.confidenceBar}>
                <Text style={styles.confidenceLabel}>Confidence:</Text>
                <View style={styles.confidenceBarContainer}>
                  <View
                    style={[
                      styles.confidenceBarFill,
                      { width: `${defect.confidence * 100}%` }
                    ]}
                  />
                </View>
                <Text style={styles.confidenceValue}>
                  {(defect.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.noDefectsContainer}>
            <Icon name="check-circle" size={48} color="#4CAF50" />
            <Text style={styles.noDefectsText}>No significant defects detected</Text>
            <Text style={styles.noDefectsSubtext}>Your product shows excellent quality!</Text>
          </View>
        )}
      </View>

      {/* Technical Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Technical Details</Text>
        <View style={styles.technicalGrid}>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Analysis ID</Text>
            <Text style={styles.technicalValue}>{results._id.slice(-8)}</Text>
          </View>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Product ID</Text>
            <Text style={styles.technicalValue}>{results.productId.slice(-8)}</Text>
          </View>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Analysis Date</Text>
            <Text style={styles.technicalValue}>
              {new Date(results.analysisDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Analysis Time</Text>
            <Text style={styles.technicalValue}>
              {new Date(results.analysisDate).toLocaleTimeString()}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Price Breakdown */}
      <View style={styles.pricingCard}>
        <Text style={styles.cardTitle}>Price Analysis</Text>
        <View style={styles.priceBreakdown}>
          <View style={styles.priceBreakdownItem}>
            <Text style={styles.priceBreakdownLabel}>Base Market Price</Text>
            <Text style={styles.priceBreakdownValue}>$1,000</Text>
          </View>
          <View style={styles.priceBreakdownItem}>
            <Text style={styles.priceBreakdownLabel}>Quality Adjustment</Text>
            <Text style={[
              styles.priceBreakdownValue,
              { color: results.priceImpact.adjustmentPercentage >= 0 ? '#4CAF50' : '#F44336' }
            ]}>
              {results.priceImpact.adjustmentPercentage >= 0 ? '+' : ''}
              ${(results.priceImpact.adjustedPrice - 1000).toLocaleString()}
            </Text>
          </View>
          <View style={styles.priceBreakdownDivider} />
          <View style={styles.priceBreakdownItem}>
            <Text style={styles.priceBreakdownTotal}>Final Estimated Price</Text>
            <Text style={styles.priceBreakdownTotalValue}>
              ${results.priceImpact.adjustedPrice.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Market Insights */}
      <View style={styles.pricingCard}>
        <Text style={styles.cardTitle}>Market Insights</Text>
        <View style={styles.insightsList}>
          <View style={styles.insightItem}>
            <Icon name="trending-up" size={20} color="#4CAF50" />
            <Text style={styles.insightText}>
              High-quality products like yours are in demand
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Icon name="schedule" size={20} color="#FF9800" />
            <Text style={styles.insightText}>
              Best selling season: Next 2-3 months
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Icon name="location-on" size={20} color="#2196F3" />
            <Text style={styles.insightText}>
              Local demand is 15% above average
            </Text>
          </View>
        </View>
      </View>

      {/* Recommendations Preview */}
      <View style={styles.pricingCard}>
        <View style={styles.recommendationsHeader}>
          <Text style={styles.cardTitle}>Quick Recommendations</Text>
          <TouchableOpacity onPress={onRecommendationsPress}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.quickRecommendations}>
          {results.recommendations.slice(0, 2).map((rec, index) => (
            <View key={rec.id} style={styles.quickRecommendation}>
              <Icon name="lightbulb" size={16} color="#FF8F00" />
              <Text style={styles.quickRecommendationText} numberOfLines={2}>
                {rec.title}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        {[
          { key: 'overview', label: 'Overview', icon: 'dashboard' },
          { key: 'details', label: 'Details', icon: 'info' },
          { key: 'pricing', label: 'Pricing', icon: 'attach-money' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              selectedTab === tab.key && styles.activeTab
            ]}
            onPress={() => setSelectedTab(tab.key as any)}
            activeOpacity={0.7}
          >
            <Icon
              name={tab.icon}
              size={20}
              color={selectedTab === tab.key ? '#2E7D32' : '#757575'}
            />
            <Text style={[
              styles.tabLabel,
              selectedTab === tab.key && styles.activeTabLabel
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.tabContainer}>
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'details' && renderDetailsTab()}
        {selectedTab === 'pricing' && renderPricingTab()}
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.secondaryActionButton} onPress={handleShare}>
            <Icon name="share" size={20} color="#2196F3" />
            <Text style={styles.secondaryActionText}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.secondaryActionButton} onPress={onRetakePhotos}>
            <Icon name="camera-alt" size={20} color="#FF9800" />
            <Text style={styles.secondaryActionText}>Retake</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.primaryActionButton} onPress={onSaveResults}>
            <Icon name="save" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Save Results</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2E7D32',
  },
  tabLabel: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  tabContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  gradeInfo: {
    alignItems: 'center',
    flex: 1,
    marginLeft: 20,
  },
  gradeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2E7D32',
  },
  gradeDescription: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  qualityMetrics: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 14,
    color: '#212121',
    marginLeft: 8,
  },
  metricScore: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16,
  },
  metricBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginRight: 8,
  },
  metricFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    width: 30,
    textAlign: 'right',
  },
  priceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  priceContainer: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#757575',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  priceAdjustment: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 11,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  defectItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  defectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  defectType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginLeft: 8,
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  confidenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#757575',
    width: 70,
  },
  confidenceBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginHorizontal: 8,
  },
  confidenceBarFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    width: 35,
    textAlign: 'right',
  },
  noDefectsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noDefectsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 8,
  },
  noDefectsSubtext: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  technicalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  technicalItem: {
    flex: 1,
    minWidth: '45%',
  },
  technicalLabel: {
    fontSize: 11,
    color: '#9E9E9E',
    marginBottom: 2,
  },
  technicalValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#212121',
  },
  pricingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  priceBreakdown: {
    gap: 8,
  },
  priceBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  priceBreakdownLabel: {
    fontSize: 14,
    color: '#757575',
  },
  priceBreakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  priceBreakdownDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  priceBreakdownTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  priceBreakdownTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  insightsList: {
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightText: {
    fontSize: 14,
    color: '#757575',
    marginLeft: 8,
    flex: 1,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  quickRecommendations: {
    gap: 8,
  },
  quickRecommendation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 8,
    borderRadius: 6,
  },
  quickRecommendationText: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 6,
    flex: 1,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  primaryActionButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 4,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
    marginLeft: 4,
  },
});

export default ResultsDisplay;