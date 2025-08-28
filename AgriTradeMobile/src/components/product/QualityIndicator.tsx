import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { QualityIndicatorProps } from '@/types';

const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  score,
  size = 'medium',
  showLabel = true,
  animated = true,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: score / 10, // Convert to 0-1 scale
        duration: 1000,
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(score / 10);
    }
  }, [score, animated, animatedValue]);

  const getSize = () => {
    switch (size) {
      case 'small':
        return { width: 40, height: 40, strokeWidth: 3 };
      case 'large':
        return { width: 80, height: 80, strokeWidth: 6 };
      default:
        return { width: 60, height: 60, strokeWidth: 4 };
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 8.5) return '#4CAF50'; // Excellent - Green
    if (score >= 7.0) return '#8BC34A'; // Good - Light Green
    if (score >= 5.5) return '#FF9800'; // Fair - Orange
    return '#FF5722'; // Poor - Red
  };

  const getQualityLabel = (score: number) => {
    if (score >= 8.5) return 'Excellent';
    if (score >= 7.0) return 'Good';
    if (score >= 5.5) return 'Fair';
    return 'Poor';
  };

  const { width, height, strokeWidth } = getSize();
  const radius = (width - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const qualityColor = getQualityColor(score);

  return (
    <View style={[styles.container, { width, height }]} testID="quality-score">
      {/* Background Circle */}
      <View style={[styles.circle, { width, height, borderWidth: strokeWidth }]}>
        {/* Animated Progress Circle */}
        <Animated.View
          style={[
            styles.progressCircle,
            {
              width,
              height,
              borderWidth: strokeWidth,
              borderColor: qualityColor,
              transform: [
                {
                  rotate: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-90deg', '270deg'],
                  }),
                },
              ],
            },
          ]}
        />
        
        {/* Score Text */}
        <View style={styles.scoreContainer}>
          <Text style={[
            styles.scoreText,
            {
              fontSize: size === 'small' ? 12 : size === 'large' ? 20 : 16,
              color: qualityColor,
            },
          ]}>
            {score.toFixed(1)}
          </Text>
          <Text style={[
            styles.maxScore,
            {
              fontSize: size === 'small' ? 8 : size === 'large' ? 12 : 10,
            },
          ]}>
            /10
          </Text>
        </View>
      </View>

      {/* Quality Label */}
      {showLabel && (
        <Text style={[
          styles.qualityLabel,
          {
            fontSize: size === 'small' ? 10 : size === 'large' ? 14 : 12,
            color: qualityColor,
          },
        ]}>
          {getQualityLabel(score)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    borderRadius: 999,
    borderColor: '#E0E0E0',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontWeight: '700',
    lineHeight: undefined,
  },
  maxScore: {
    color: '#757575',
    fontWeight: '500',
    marginTop: -2,
  },
  qualityLabel: {
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default QualityIndicator;