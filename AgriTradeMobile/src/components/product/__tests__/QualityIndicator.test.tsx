import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import QualityIndicator from '../QualityIndicator';

// Mock Animated module for testing
jest.mock('react-native', () => {
  const ReactNative = jest.requireActual('react-native');
  return {
    ...ReactNative,
    Animated: {
      ...ReactNative.Animated,
      timing: jest.fn(() => ({
        start: jest.fn(),
      })),
      Value: jest.fn(() => ({
        setValue: jest.fn(),
        interpolate: jest.fn(() => '0deg'),
      })),
    },
  };
});

describe('QualityIndicator Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      const { getByTestId, getByText } = render(
        <QualityIndicator score={7.5} />
      );

      expect(getByTestId('quality-score')).toBeTruthy();
      expect(getByText('7.5')).toBeTruthy();
      expect(getByText('/10')).toBeTruthy();
    });

    it('should render score with one decimal place', () => {
      const { getByText } = render(
        <QualityIndicator score={8} />
      );

      expect(getByText('8.0')).toBeTruthy();
    });

    it('should show quality label by default', () => {
      const { getByText } = render(
        <QualityIndicator score={8.5} />
      );

      expect(getByText('Excellent')).toBeTruthy();
    });

    it('should hide quality label when showLabel is false', () => {
      const { queryByText } = render(
        <QualityIndicator score={8.5} showLabel={false} />
      );

      expect(queryByText('Excellent')).toBeNull();
    });
  });

  describe('Quality Labels and Colors', () => {
    it('should display "Excellent" for scores >= 8.5', () => {
      const { getByText } = render(
        <QualityIndicator score={9.2} />
      );

      expect(getByText('Excellent')).toBeTruthy();
    });

    it('should display "Good" for scores >= 7.0 and < 8.5', () => {
      const { getByText } = render(
        <QualityIndicator score={7.8} />
      );

      expect(getByText('Good')).toBeTruthy();
    });

    it('should display "Fair" for scores >= 5.5 and < 7.0', () => {
      const { getByText } = render(
        <QualityIndicator score={6.2} />
      );

      expect(getByText('Fair')).toBeTruthy();
    });

    it('should display "Poor" for scores < 5.5', () => {
      const { getByText } = render(
        <QualityIndicator score={4.1} />
      );

      expect(getByText('Poor')).toBeTruthy();
    });

    it('should handle edge case scores correctly', () => {
      // Test exact boundary values
      const { rerender, getByText } = render(
        <QualityIndicator score={8.5} />
      );
      expect(getByText('Excellent')).toBeTruthy();

      rerender(<QualityIndicator score={7.0} />);
      expect(getByText('Good')).toBeTruthy();

      rerender(<QualityIndicator score={5.5} />);
      expect(getByText('Fair')).toBeTruthy();
    });
  });

  describe('Size Variations', () => {
    it('should render small size correctly', () => {
      const { getByTestId } = render(
        <QualityIndicator score={7.5} size="small" />
      );

      const container = getByTestId('quality-score');
      expect(container.props.style).toEqual(
        expect.objectContaining({
          width: 40,
          height: 40,
        })
      );
    });

    it('should render medium size correctly (default)', () => {
      const { getByTestId } = render(
        <QualityIndicator score={7.5} size="medium" />
      );

      const container = getByTestId('quality-score');
      expect(container.props.style).toEqual(
        expect.objectContaining({
          width: 60,
          height: 60,
        })
      );
    });

    it('should render large size correctly', () => {
      const { getByTestId } = render(
        <QualityIndicator score={7.5} size="large" />
      );

      const container = getByTestId('quality-score');
      expect(container.props.style).toEqual(
        expect.objectContaining({
          width: 80,
          height: 80,
        })
      );
    });

    it('should default to medium size when no size prop provided', () => {
      const { getByTestId } = render(
        <QualityIndicator score={7.5} />
      );

      const container = getByTestId('quality-score');
      expect(container.props.style).toEqual(
        expect.objectContaining({
          width: 60,
          height: 60,
        })
      );
    });
  });

  describe('Animation', () => {
    it('should trigger animation by default', () => {
      const mockTiming = jest.mocked(Animated.timing);
      const mockStart = jest.fn();
      mockTiming.mockReturnValue({ start: mockStart });

      render(<QualityIndicator score={7.5} />);

      expect(mockTiming).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          toValue: 0.75, // 7.5 / 10
          duration: 1000,
          useNativeDriver: false,
        })
      );
      expect(mockStart).toHaveBeenCalled();
    });

    it('should not trigger animation when animated is false', () => {
      const mockTiming = jest.mocked(Animated.timing);
      const mockSetValue = jest.fn();
      const mockValue = {
        setValue: mockSetValue,
        interpolate: jest.fn(() => '0deg'),
      };
      jest.mocked(Animated.Value).mockReturnValue(mockValue as any);

      render(<QualityIndicator score={8.0} animated={false} />);

      expect(mockTiming).not.toHaveBeenCalled();
      expect(mockSetValue).toHaveBeenCalledWith(0.8); // 8.0 / 10
    });

    it('should update animation when score changes', async () => {
      const mockTiming = jest.mocked(Animated.timing);
      const mockStart = jest.fn();
      mockTiming.mockReturnValue({ start: mockStart });

      const { rerender } = render(<QualityIndicator score={6.0} />);

      expect(mockTiming).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          toValue: 0.6,
        })
      );

      // Change the score
      rerender(<QualityIndicator score={8.5} />);

      await waitFor(() => {
        expect(mockTiming).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            toValue: 0.85,
          })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum score (0)', () => {
      const { getByText } = render(
        <QualityIndicator score={0} />
      );

      expect(getByText('0.0')).toBeTruthy();
      expect(getByText('Poor')).toBeTruthy();
    });

    it('should handle maximum score (10)', () => {
      const { getByText } = render(
        <QualityIndicator score={10} />
      );

      expect(getByText('10.0')).toBeTruthy();
      expect(getByText('Excellent')).toBeTruthy();
    });

    it('should handle decimal scores correctly', () => {
      const { getByText } = render(
        <QualityIndicator score={7.53} />
      );

      expect(getByText('7.5')).toBeTruthy();
    });

    it('should handle scores with many decimal places', () => {
      const { getByText } = render(
        <QualityIndicator score={8.999999} />
      );

      expect(getByText('9.0')).toBeTruthy();
      expect(getByText('Excellent')).toBeTruthy();
    });
  });

  describe('Props Combinations', () => {
    it('should handle all props together', () => {
      const { getByTestId, getByText } = render(
        <QualityIndicator 
          score={9.1} 
          size="large" 
          showLabel={true} 
          animated={false} 
        />
      );

      expect(getByTestId('quality-score')).toBeTruthy();
      expect(getByText('9.1')).toBeTruthy();
      expect(getByText('Excellent')).toBeTruthy();
    });

    it('should handle minimal props', () => {
      const { getByTestId, getByText } = render(
        <QualityIndicator score={5.0} />
      );

      expect(getByTestId('quality-score')).toBeTruthy();
      expect(getByText('5.0')).toBeTruthy();
      expect(getByText('Poor')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper testID for automated testing', () => {
      const { getByTestId } = render(
        <QualityIndicator score={7.5} />
      );

      expect(getByTestId('quality-score')).toBeTruthy();
    });
  });
});