# AgriTrade AI Mobile Application

The AgriTrade AI mobile application is a React Native-based solution that connects African smallholder farmers with buyers through AI-powered agricultural trade.

## 🌟 Features

### For Farmers
- **AI Quality Analysis**: Upload crop photos for instant quality assessment and pricing
- **Product Management**: List and manage agricultural products
- **Direct Communication**: Connect directly with buyers
- **Price Recommendations**: AI-powered pricing based on quality and market conditions
- **Order Management**: Track sales and manage transactions

### For Buyers
- **Product Discovery**: Browse quality-verified agricultural products
- **Quality Insights**: View AI-generated quality scores and analysis
- **Direct Purchase**: Order directly from farmers
- **Communication Tools**: Message farmers directly

## 🏗️ Architecture

### Technology Stack
- **Framework**: React Native 0.81.0
- **Language**: TypeScript
- **State Management**: Redux Toolkit + React Query
- **Navigation**: React Navigation v6
- **UI Framework**: Tamagui
- **API Client**: Axios with offline support
- **Storage**: AsyncStorage + Redux Persist

### Key Components
- **Authentication Flow**: Phone-based authentication with SMS verification
- **Product Components**: ProductCard, QualityIndicator, ImageUploader
- **AI Integration**: Quality analysis and price estimation
- **Navigation**: Tab-based navigation with stack navigators

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- React Native development environment
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/agritrade-ai/platform-mvp.git
   cd platform-mvp/AgriTradeMobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install iOS dependencies (iOS only)**
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Start Metro bundler**
   ```bash
   npm start
   ```

5. **Run on device/emulator**
   ```bash
   # Android
   npm run android
   
   # iOS
   npm run ios
   ```

### Environment Configuration

Create a `.env` file in the root directory:

```env
API_BASE_URL=http://localhost:3000/api
WS_URL=ws://localhost:3000
GOOGLE_MAPS_API_KEY=your_key_here
MAPBOX_API_KEY=your_key_here
```

## 📱 App Structure

```
src/
├── components/           # Reusable UI components
│   ├── auth/            # Authentication components
│   ├── product/         # Product-related components
│   ├── ai/              # AI analysis components
│   ├── communication/   # Chat and messaging
│   ├── navigation/      # Navigation components
│   └── common/          # Common UI components
├── screens/             # Screen components
│   ├── auth/           # Authentication screens
│   └── main/           # Main app screens
├── navigation/         # Navigation configuration
├── services/           # API services
├── store/              # Redux store and slices
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── theme/              # Design system and themes
└── config/             # App configuration
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### End-to-End Tests
```bash
npm run detox:build
npm run detox:test
```

### Test Coverage
```bash
npm run test:coverage
```

## 🛠️ Development

### Code Quality
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Husky**: Git hooks

### Scripts
```bash
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint issues
npm run typecheck     # TypeScript type checking
npm run test:watch    # Watch mode testing
```

## 📦 Building

### Development Build
```bash
npm run bundle:android
```

### Production Build
```bash
# Android
cd android && ./gradlew assembleRelease

# iOS
# Use Xcode or
xcodebuild -workspace ios/AgriTradeMobile.xcworkspace -scheme AgriTradeMobile -configuration Release
```

## 🔧 Configuration

### API Integration
The app connects to the AgriTrade AI backend API. Configure the base URL in your environment file or config.

### AI Services
- Google Vision API for image analysis
- Custom AI models for quality assessment
- Price prediction algorithms

### Authentication
- SMS-based phone verification
- JWT token management
- Secure token storage

## 🌍 Internationalization

Supported languages:
- English (en)
- French (fr)
- Swahili (sw)
- Arabic (ar)

## 📊 Performance

### Optimization Features
- Image compression and caching
- Offline support with sync
- Lazy loading of components
- Bundle size optimization

### Monitoring
- Performance monitoring
- Error tracking
- Analytics integration

## 🚀 Deployment

### Android
1. Generate signed APK
2. Upload to Google Play Store
3. Configure app signing

### iOS
1. Create archive in Xcode
2. Upload to App Store Connect
3. Submit for review

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Email: support@agritrade.ai
- Documentation: [docs.agritrade.ai](https://docs.agritrade.ai)
- Issues: GitHub Issues

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Core app structure
- ✅ Authentication flow
- ✅ Product management
- ✅ AI quality analysis
- 🔄 Payment integration

### Phase 2 (Next)
- 📋 Voice assistant
- 📋 Advanced AI features
- 📋 Logistics optimization
- 📋 Multi-language support

### Phase 3 (Future)
- 📋 IoT sensor integration
- 📋 Blockchain payments
- 📋 Advanced analytics
- 📋 Market insights

---

Built with ❤️ for African farmers by the AgriTrade AI team.