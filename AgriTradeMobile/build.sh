#!/bin/bash

# AgriTrade Mobile App Build Script
# This script helps set up and build the React Native mobile application

set -e

echo "🌾 AgriTrade AI Mobile App - Build Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    print_status "Node.js version: $NODE_VERSION"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    print_status "npm version: $NPM_VERSION"
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    if [ -f "package-lock.json" ]; then
        print_status "Installing npm dependencies..."
        npm ci
    elif [ -f "yarn.lock" ]; then
        print_status "Installing yarn dependencies..."
        yarn install --frozen-lockfile
    else
        print_status "Installing npm dependencies..."
        npm install
    fi
    
    print_status "Dependencies installed successfully!"
}

# Setup environment file
setup_environment() {
    print_header "Setting Up Environment"
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            print_status "Creating .env file from .env.example..."
            cp .env.example .env
            print_warning "Please update the .env file with your actual configuration values."
        else
            print_status "Creating basic .env file..."
            cat > .env << EOL
# AgriTrade Mobile App Environment Configuration
API_BASE_URL=http://localhost:3000/api
WS_URL=ws://localhost:3000
NODE_ENV=development

# API Keys (replace with actual values)
GOOGLE_MAPS_API_KEY=your_google_maps_key_here
MAPBOX_API_KEY=your_mapbox_key_here

# Feature Flags
ENABLE_DEBUG_LOGS=true
ENABLE_ANALYTICS=false
EOL
            print_warning "Created basic .env file. Please update with your actual API keys."
        fi
    else
        print_status "Environment file already exists."
    fi
}

# Type checking
type_check() {
    print_header "Type Checking"
    print_status "Running TypeScript type checking..."
    
    if npm run typecheck; then
        print_status "Type checking passed!"
    else
        print_error "Type checking failed. Please fix the TypeScript errors."
        exit 1
    fi
}

# Linting
lint_code() {
    print_header "Code Linting"
    print_status "Running ESLint..."
    
    if npm run lint; then
        print_status "Linting passed!"
    else
        print_warning "Linting issues found. Running lint:fix..."
        npm run lint:fix || print_warning "Some linting issues require manual fixing."
    fi
}

# Build for Android
build_android() {
    print_header "Building for Android"
    
    # Check if Android SDK is available
    if [ -z "$ANDROID_HOME" ]; then
        print_warning "ANDROID_HOME is not set. Make sure Android SDK is installed."
    fi
    
    print_status "Cleaning previous builds..."
    cd android && ./gradlew clean && cd ..
    
    print_status "Building Android app..."
    npm run android
}

# Build for iOS
build_ios() {
    print_header "Building for iOS"
    
    # Check if we're on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_warning "iOS builds are only supported on macOS."
        return
    fi
    
    # Check if Xcode is installed
    if ! command -v xcodebuild &> /dev/null; then
        print_warning "Xcode is not installed. iOS build skipped."
        return
    fi
    
    print_status "Installing iOS dependencies..."
    cd ios && pod install && cd ..
    
    print_status "Building iOS app..."
    npm run ios
}

# Run tests
run_tests() {
    print_header "Running Tests"
    print_status "Running unit tests..."
    
    if npm test; then
        print_status "All tests passed!"
    else
        print_error "Some tests failed. Please fix the failing tests."
        exit 1
    fi
}

# Main function
main() {
    print_header "AgriTrade Mobile App Setup"
    
    # Parse command line arguments
    COMMAND=${1:-"setup"}
    
    case $COMMAND in
        "setup")
            check_node
            check_npm
            install_dependencies
            setup_environment
            print_status "Setup completed! You can now run 'npm start' to start the development server."
            ;;
        "build")
            check_node
            check_npm
            type_check
            lint_code
            run_tests
            
            PLATFORM=${2:-"android"}
            if [ "$PLATFORM" = "android" ]; then
                build_android
            elif [ "$PLATFORM" = "ios" ]; then
                build_ios
            else
                print_error "Unknown platform: $PLATFORM. Use 'android' or 'ios'."
                exit 1
            fi
            ;;
        "test")
            check_node
            check_npm
            run_tests
            ;;
        "lint")
            check_node
            check_npm
            lint_code
            ;;
        "typecheck")
            check_node
            check_npm
            type_check
            ;;
        *)
            echo "Usage: $0 {setup|build|test|lint|typecheck} [platform]"
            echo ""
            echo "Commands:"
            echo "  setup     - Install dependencies and setup environment"
            echo "  build     - Build the app (specify platform: android|ios)"
            echo "  test      - Run tests"
            echo "  lint      - Run code linting"
            echo "  typecheck - Run TypeScript type checking"
            echo ""
            echo "Examples:"
            echo "  $0 setup"
            echo "  $0 build android"
            echo "  $0 build ios"
            echo "  $0 test"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"