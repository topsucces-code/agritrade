import { createTamagui } from '@tamagui/core';
import { createInterFont } from '@tamagui/font-inter';
import { shorthands } from '@tamagui/shorthands';
import { themes, tokens } from '@tamagui/themes';
import { createMedia } from '@tamagui/responsive-media';
import { createAnimations } from '@tamagui/animations-react-native';

// Create custom font
const interFont = createInterFont();

// Custom colors for AgriTrade
const customTokens = {
  ...tokens,
  color: {
    ...tokens.color,
    // Primary colors (Agricultural green)
    primary: '#2E7D32',
    primaryLight: '#4CAF50',
    primaryDark: '#1B5E20',
    
    // Secondary colors (Harvest orange)
    secondary: '#FF8F00',
    secondaryLight: '#FFB74D',
    secondaryDark: '#E65100',
    
    // Background colors
    backgroundDefault: '#F5F5F5',
    backgroundPaper: '#FFFFFF',
    backgroundDisabled: '#E0E0E0',
    
    // Text colors
    textPrimary: '#212121',
    textSecondary: '#757575',
    textDisabled: '#BDBDBD',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',
    
    // Status colors
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    
    // Border colors
    border: '#E0E0E0',
    borderLight: '#F0F0F0',
    borderDark: '#BDBDBD',
    
    // Quality score colors
    qualityExcellent: '#4CAF50',
    qualityGood: '#8BC34A',
    qualityFair: '#FF9800',
    qualityPoor: '#FF5722',
    
    // Transparent overlays
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
  },
  space: {
    ...tokens.space,
    // Custom spacing
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  size: {
    ...tokens.size,
    // Component sizes
    buttonSmall: 32,
    buttonMedium: 44,
    buttonLarge: 56,
    inputHeight: 48,
    cardRadius: 12,
    imageRadius: 8,
  },
  radius: {
    ...tokens.radius,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
  },
};

// Custom themes
const customThemes = {
  ...themes,
  light: {
    ...themes.light,
    primary: customTokens.color.primary,
    primaryLight: customTokens.color.primaryLight,
    primaryDark: customTokens.color.primaryDark,
    secondary: customTokens.color.secondary,
    secondaryLight: customTokens.color.secondaryLight,
    secondaryDark: customTokens.color.secondaryDark,
    background: customTokens.color.backgroundDefault,
    backgroundStrong: customTokens.color.backgroundPaper,
    color: customTokens.color.textPrimary,
    colorPress: customTokens.color.textSecondary,
  },
  dark: {
    ...themes.dark,
    primary: customTokens.color.primaryLight,
    primaryLight: customTokens.color.primary,
    primaryDark: customTokens.color.primaryDark,
    secondary: customTokens.color.secondaryLight,
    secondaryLight: customTokens.color.secondary,
    secondaryDark: customTokens.color.secondaryDark,
    background: '#121212',
    backgroundStrong: '#1E1E1E',
    color: '#FFFFFF',
    colorPress: '#E0E0E0',
  },
};

// Media queries for responsive design
const media = createMedia({
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1420 },
  xxl: { maxWidth: 1600 },
  gtXs: { minWidth: 660 + 1 },
  gtSm: { minWidth: 800 + 1 },
  gtMd: { minWidth: 1020 + 1 },
  gtLg: { minWidth: 1280 + 1 },
  short: { maxHeight: 820 },
  tall: { minHeight: 820 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
});

// Animations
const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  tooltip: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
});

// Create and export the configuration
export const theme = createTamagui({
  animations,
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: true,
  shorthands,
  fonts: {
    heading: interFont,
    body: interFont,
  },
  themes: customThemes,
  tokens: customTokens,
  media,
});

export type Conf = typeof theme;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {}
}

// Export specific theme values for use in components
export const colors = customTokens.color;
export const spacing = customTokens.space;
export const sizes = customTokens.size;
export const borderRadius = customTokens.radius;