import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProductCard from '@/components/product/ProductCard';
import { Product } from '@/types';

// Mock dependencies
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-fast-image', () => 'FastImage');
jest.mock('@/components/product/QualityIndicator', () => 'QualityIndicator');

describe('ProductCard Component', () => {
  const mockProduct: Product = {
    _id: 'product-123',
    name: 'Premium Coffee Beans',
    category: 'Coffee',
    subcategory: 'Arabica',
    description: 'High-quality coffee beans from local farmers',
    images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    farmerId: 'farmer-123',
    location: {
      latitude: -1.2921,
      longitude: 36.8219,
      address: 'Nairobi, Kenya',
    },
    qualityAnalysis: {
      _id: 'analysis-123',
      productId: 'product-123',
      overallScore: 8.5,
      visualQuality: {
        color: 8.0,
        texture: 9.0,
        size: 8.5,
        uniformity: 8.0,
      },
      defects: [],
      recommendations: [],
      priceImpact: {
        adjustmentPercentage: 15,
        adjustedPrice: 1200,
      },
      analysisDate: new Date('2024-01-15'),
    },
    pricing: {
      basePrice: 1000,
      estimatedPrice: 1200,
      currency: 'USD',
    },
    quantity: {
      available: 500,
      unit: 'kg',
      minimumOrder: 50,
    },
    harvestDate: new Date('2024-01-01'),
    expiryDate: new Date('2024-12-31'),
    status: 'available',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders product information correctly', () => {
    const { getByText, getByTestId } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} />
    );

    expect(getByText('Premium Coffee Beans')).toBeTruthy();
    expect(getByText('Coffee')).toBeTruthy();
    expect(getByText('$1,200')).toBeTruthy();
    expect(getByText('500 kg available')).toBeTruthy();
    expect(getByText('Nairobi, Kenya')).toBeTruthy();
    expect(getByTestId('product-card')).toBeTruthy();
  });

  it('calls onPress when card is tapped', () => {
    const { getByTestId } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} />
    );

    fireEvent.press(getByTestId('product-card'));
    expect(mockOnPress).toHaveBeenCalledWith('product-123');
  });

  it('displays quality indicator when quality analysis is available', () => {
    const { UNSAFE_getByType } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} />
    );

    const qualityIndicator = UNSAFE_getByType('QualityIndicator');
    expect(qualityIndicator).toBeTruthy();
    expect(qualityIndicator.props.score).toBe(8.5);
    expect(qualityIndicator.props.size).toBe('small');
    expect(qualityIndicator.props.showLabel).toBe(true);
  });

  it('does not display quality indicator when quality analysis is not available', () => {
    const productWithoutQuality = { ...mockProduct, qualityAnalysis: undefined };
    const { queryByType } = render(
      <ProductCard product={productWithoutQuality} onPress={mockOnPress} />
    );

    expect(queryByType('QualityIndicator')).toBeNull();
  });

  it('displays action buttons when showActions is true', () => {
    const { getByText } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} showActions={true} />
    );

    expect(getByText('Message')).toBeTruthy();
    expect(getByText('Order')).toBeTruthy();
  });

  it('does not display action buttons when showActions is false', () => {
    const { queryByText } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} showActions={false} />
    );

    expect(queryByText('Message')).toBeNull();
    expect(queryByText('Order')).toBeNull();
  });

  it('displays correct status badge', () => {
    const { getByText } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} />
    );

    expect(getByText('Available')).toBeTruthy();
  });

  it('displays different status correctly', () => {
    const soldProduct = { ...mockProduct, status: 'sold' as const };
    const { getByText } = render(
      <ProductCard product={soldProduct} onPress={mockOnPress} />
    );

    expect(getByText('Sold')).toBeTruthy();
  });

  it('displays image count badge when multiple images are available', () => {
    const { getByText } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} />
    );

    expect(getByText('2')).toBeTruthy(); // Should show image count
  });

  it('formats price correctly', () => {
    const { getByText } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} />
    );

    expect(getByText('$1,200')).toBeTruthy();
    expect(getByText('/kg')).toBeTruthy();
  });

  it('formats harvest date correctly', () => {
    const { getByText } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} />
    );

    expect(getByText('Harvested Jan 1')).toBeTruthy();
  });

  it('handles missing subcategory gracefully', () => {
    const productWithoutSubcategory = { ...mockProduct, subcategory: undefined };
    const { getByText } = render(
      <ProductCard product={productWithoutSubcategory} onPress={mockOnPress} />
    );

    expect(getByText('Premium Coffee Beans')).toBeTruthy();
    expect(getByText('Coffee')).toBeTruthy();
  });

  it('handles missing images gracefully', () => {
    const productWithoutImages = { ...mockProduct, images: [] };
    const { UNSAFE_getByType } = render(
      <ProductCard product={productWithoutImages} onPress={mockOnPress} />
    );

    const fastImage = UNSAFE_getByType('FastImage');
    expect(fastImage.props.source.uri).toContain('placeholder');
  });

  it('handles compact layout correctly', () => {
    const { getByTestId } = render(
      <ProductCard product={mockProduct} onPress={mockOnPress} compact={true} />
    );

    const container = getByTestId('product-card');
    expect(container.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: '100%',
        }),
      ])
    );
  });

  it('displays correct currency format for different currencies', () => {
    const productWithDifferentCurrency = {
      ...mockProduct,
      pricing: {
        ...mockProduct.pricing,
        currency: 'XOF',
      },
    };

    const { getByText } = render(
      <ProductCard product={productWithDifferentCurrency} onPress={mockOnPress} />
    );

    expect(getByText('1,200 XOF')).toBeTruthy();
  });
});

describe('ProductCard Edge Cases', () => {
  const mockOnPress = jest.fn();

  it('handles extremely long product names', () => {
    const productWithLongName = {
      ...mockProduct,
      name: 'This is a very long product name that should be truncated to fit within the card layout and not overflow',
    };

    const { getByText } = render(
      <ProductCard product={productWithLongName} onPress={mockOnPress} />
    );

    const nameElement = getByText(productWithLongName.name);
    expect(nameElement.props.numberOfLines).toBe(1);
  });

  it('handles zero quantity correctly', () => {
    const productWithZeroQuantity = {
      ...mockProduct,
      quantity: {
        ...mockProduct.quantity,
        available: 0,
      },
    };

    const { getByText } = render(
      <ProductCard product={productWithZeroQuantity} onPress={mockOnPress} />
    );

    expect(getByText('0 kg available')).toBeTruthy();
  });

  it('handles very high prices correctly', () => {
    const expensiveProduct = {
      ...mockProduct,
      pricing: {
        ...mockProduct.pricing,
        estimatedPrice: 1000000,
      },
    };

    const { getByText } = render(
      <ProductCard product={expensiveProduct} onPress={mockOnPress} />
    );

    expect(getByText('$1,000,000')).toBeTruthy();
  });
});