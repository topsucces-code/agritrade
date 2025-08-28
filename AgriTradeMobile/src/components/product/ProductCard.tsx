import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ProductCardProps } from '@/types';
import QualityIndicator from './QualityIndicator';

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = (screenWidth - 48) / 2; // 2 columns with margins

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  showActions = false,
  compact = false,
}) => {
  const handlePress = () => {
    onPress(product._id);
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    if (currency === 'USD') {
      return `$${price.toLocaleString()}`;
    }
    return `${price.toLocaleString()} ${currency}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#4CAF50';
      case 'sold':
        return '#F44336';
      case 'reserved':
        return '#FF9800';
      case 'expired':
        return '#9E9E9E';
      default:
        return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.compactContainer,
        { width: compact ? '100%' : cardWidth },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID="product-card"
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        <FastImage
          source={{
            uri: product.images[0] || 'https://via.placeholder.com/200x150?text=No+Image',
            priority: FastImage.priority.normal,
          }}
          style={styles.productImage}
          resizeMode={FastImage.resizeMode.cover}
        />
        
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(product.status) }]}>
          <Text style={styles.statusText}>{getStatusText(product.status)}</Text>
        </View>

        {/* Favorite Button */}
        {showActions && (
          <TouchableOpacity style={styles.favoriteButton} activeOpacity={0.7}>
            <Icon name="favorite-border" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Image Count Indicator */}
        {product.images.length > 1 && (
          <View style={styles.imageCountBadge}>
            <Icon name="photo-library" size={12} color="#FFFFFF" />
            <Text style={styles.imageCountText}>{product.images.length}</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        {/* Title and Category */}
        <View style={styles.titleRow}>
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {product.category}
          </Text>
        </View>

        {/* Quality Score */}
        {product.qualityAnalysis && (
          <View style={styles.qualityRow}>
            <QualityIndicator
              score={product.qualityAnalysis.overallScore}
              size="small"
              showLabel={true}
            />
          </View>
        )}

        {/* Price and Quantity */}
        <View style={styles.priceRow}>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>
              {formatPrice(product.pricing.estimatedPrice, product.pricing.currency)}
            </Text>
            <Text style={styles.priceUnit}>
              /{product.quantity.unit}
            </Text>
          </View>
          <Text style={styles.quantity}>
            {product.quantity.available} {product.quantity.unit} available
          </Text>
        </View>

        {/* Location and Date */}
        <View style={styles.metaRow}>
          <View style={styles.locationContainer}>
            <Icon name="location-on" size={12} color="#757575" />
            <Text style={styles.location} numberOfLines={1}>
              {product.location.address}
            </Text>
          </View>
          <Text style={styles.harvestDate}>
            Harvested {formatDate(product.harvestDate)}
          </Text>
        </View>

        {/* Action Buttons */}
        {showActions && (
          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <Icon name="message" size={16} color="#2E7D32" />
              <Text style={styles.actionText}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.primaryAction]} activeOpacity={0.7}>
              <Icon name="shopping-cart" size={16} color="#FFFFFF" />
              <Text style={[styles.actionText, styles.primaryActionText]}>Order</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    position: 'relative',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 120,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 4,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageCountText: {
    fontSize: 10,
    color: '#FFFFFF',
    marginLeft: 2,
  },
  infoContainer: {
    padding: 12,
  },
  titleRow: {
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: '#757575',
  },
  qualityRow: {
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  priceUnit: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 2,
  },
  quantity: {
    fontSize: 11,
    color: '#757575',
  },
  metaRow: {
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  location: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
    flex: 1,
  },
  harvestDate: {
    fontSize: 11,
    color: '#757575',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    flex: 1,
    marginHorizontal: 4,
  },
  primaryAction: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
  },
});

export default ProductCard;