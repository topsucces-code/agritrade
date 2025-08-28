import { beforeAll, beforeEach, afterAll } from '@jest/globals';
import { cleanup, init } from 'detox';

const config = require('../.detoxrc.json');

// Extend Jest timeout for E2E tests
jest.setTimeout(300000);

beforeAll(async () => {
  // Initialize Detox
  await init(config, { initGlobals: false });
  
  // Set up global test configurations
  console.log('🚀 Starting AgriTrade E2E Tests');
  console.log('📱 Testing Environment:', process.env.DETOX_CONFIGURATION || 'android.emu.debug');
});

beforeEach(async () => {
  // Reload React Native before each test for clean state
  await device.reloadReactNative();
  
  // Clear any previous app data/state
  await device.clearKeychain();
  
  // Reset permissions to default state
  await device.resetPermissions();
  
  // Ensure device is ready
  await device.waitForApp();
});

afterAll(async () => {
  // Cleanup Detox
  await cleanup();
  console.log('✅ E2E Tests Completed');
});

// Global test utilities
global.testUtils = {
  /**
   * Wait for element with custom timeout and error message
   */
  waitForElementById: async (id: string, timeout = 5000, errorMessage?: string) => {
    try {
      await waitFor(element(by.id(id)))
        .toBeVisible()
        .withTimeout(timeout);
    } catch (error) {
      throw new Error(errorMessage || `Element with id "${id}" not found within ${timeout}ms`);
    }
  },

  /**
   * Wait for text element with custom timeout
   */
  waitForText: async (text: string, timeout = 5000, errorMessage?: string) => {
    try {
      await waitFor(element(by.text(text)))
        .toBeVisible()
        .withTimeout(timeout);
    } catch (error) {
      throw new Error(errorMessage || `Text "${text}" not found within ${timeout}ms`);
    }
  },

  /**
   * Scroll to element if needed
   */
  scrollToElement: async (scrollViewId: string, elementId: string, direction = 'down') => {
    try {
      await element(by.id(elementId)).tap();
    } catch (error) {
      // Element not visible, try scrolling
      await element(by.id(scrollViewId)).scroll(300, direction);
      await element(by.id(elementId)).tap();
    }
  },

  /**
   * Take screenshot for debugging
   */
  takeScreenshot: async (name: string) => {
    if (process.env.CI) {
      // Only take screenshots in CI environment
      await device.takeScreenshot(name);
    }
  },

  /**
   * Simulate slow network conditions
   */
  simulateSlowNetwork: async () => {
    if (device.getPlatform() === 'ios') {
      // iOS specific network simulation
      await device.setNetworkConditions({
        enabled: true,
        speed: '2g',
      });
    }
  },

  /**
   * Reset network conditions
   */
  resetNetworkConditions: async () => {
    if (device.getPlatform() === 'ios') {
      await device.setNetworkConditions({
        enabled: false,
      });
    }
  },

  /**
   * Grant all permissions needed for tests
   */
  grantAllPermissions: async () => {
    try {
      await device.grantPermission({
        name: 'camera',
        type: 'always',
      });
      await device.grantPermission({
        name: 'photos',
        type: 'always',
      });
      await device.grantPermission({
        name: 'location',
        type: 'always',
      });
      await device.grantPermission({
        name: 'microphone',
        type: 'always',
      });
      await device.grantPermission({
        name: 'notifications',
        type: 'always',
      });
    } catch (error) {
      console.warn('Some permissions could not be granted:', error.message);
    }
  },

  /**
   * Login helper for tests that require authentication
   */
  loginTestUser: async (phoneNumber = '+1234567890') => {
    try {
      // Navigate to login if not already there
      try {
        await element(by.text('Get Started')).tap();
      } catch (e) {
        // Already on login screen or logged in
      }

      // Check if already logged in
      try {
        await waitFor(element(by.text('Dashboard')))
          .toBeVisible()
          .withTimeout(2000);
        return; // Already logged in
      } catch (e) {
        // Need to login
      }

      // Perform login
      await waitFor(element(by.id('phone-input')))
        .toBeVisible()
        .withTimeout(5000);
      
      await element(by.id('phone-input')).clearText();
      await element(by.id('phone-input')).typeText(phoneNumber);
      await element(by.text('Send Verification Code')).tap();
      
      await waitFor(element(by.id('verification-code-input')))
        .toBeVisible()
        .withTimeout(10000);
      
      await element(by.id('verification-code-input')).typeText('123456');
      await element(by.text('Verify')).tap();
      
      await waitFor(element(by.text('Dashboard')))
        .toBeVisible()
        .withTimeout(10000);
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  },

  /**
   * Logout helper
   */
  logoutUser: async () => {
    try {
      // Navigate to profile/settings
      await element(by.id('profile-button')).tap();
      await waitFor(element(by.text('Settings')))
        .toBeVisible()
        .withTimeout(5000);
      
      await element(by.text('Logout')).tap();
      
      // Confirm logout if dialog appears
      try {
        await waitFor(element(by.text('Are you sure you want to logout?')))
          .toBeVisible()
          .withTimeout(2000);
        await element(by.text('Logout')).tap();
      } catch (e) {
        // No confirmation dialog
      }
      
      await waitFor(element(by.text('AgriTrade AI')))
        .toBeVisible()
        .withTimeout(5000);
    } catch (error) {
      console.warn('Logout failed, continuing with test:', error.message);
    }
  },

  /**
   * Setup test data
   */
  setupTestData: async () => {
    // This would typically involve:
    // - Creating test accounts
    // - Setting up test products
    // - Configuring test environment
    console.log('Setting up test data...');
  },

  /**
   * Cleanup test data
   */
  cleanupTestData: async () => {
    // This would typically involve:
    // - Removing test accounts
    // - Cleaning up test products
    // - Resetting test environment
    console.log('Cleaning up test data...');
  },

  /**
   * Mock API responses for testing
   */
  mockApiResponse: async (endpoint: string, response: any) => {
    // This would involve setting up mock responses
    // for specific API endpoints during testing
    console.log(`Mocking API response for ${endpoint}`);
  },

  /**
   * Verify element exists without throwing
   */
  elementExists: async (matcher: any): Promise<boolean> => {
    try {
      await expect(element(matcher)).toBeVisible();
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Wait for loading to complete
   */
  waitForLoadingToComplete: async (timeout = 10000) => {
    try {
      // Wait for any loading indicators to disappear
      await waitFor(element(by.text('Loading...')))
        .not.toBeVisible()
        .withTimeout(timeout);
    } catch (error) {
      // No loading indicator found, continue
    }
  },
};

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🔧 E2E Test Setup Complete');

// Export types for TypeScript
declare global {
  var testUtils: {
    waitForElementById: (id: string, timeout?: number, errorMessage?: string) => Promise<void>;
    waitForText: (text: string, timeout?: number, errorMessage?: string) => Promise<void>;
    scrollToElement: (scrollViewId: string, elementId: string, direction?: string) => Promise<void>;
    takeScreenshot: (name: string) => Promise<void>;
    simulateSlowNetwork: () => Promise<void>;
    resetNetworkConditions: () => Promise<void>;
    grantAllPermissions: () => Promise<void>;
    loginTestUser: (phoneNumber?: string) => Promise<void>;
    logoutUser: () => Promise<void>;
    setupTestData: () => Promise<void>;
    cleanupTestData: () => Promise<void>;
    mockApiResponse: (endpoint: string, response: any) => Promise<void>;
    elementExists: (matcher: any) => Promise<boolean>;
    waitForLoadingToComplete: (timeout?: number) => Promise<void>;
  };
}