module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@': './src',
          '@/components': './src/components',
          '@/screens': './src/screens',
          '@/services': './src/services',
          '@/store': './src/store',
          '@/types': './src/types',
          '@/utils': './src/utils',
          '@/assets': './src/assets'
        }
      }
    ],
    'react-native-reanimated/plugin'
  ]
};