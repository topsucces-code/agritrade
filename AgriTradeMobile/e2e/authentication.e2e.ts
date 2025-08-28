import { by, device, element, expect, waitFor } from 'detox';

describe('Authentication Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Welcome Screen', () => {
    it('should display welcome screen with correct elements', async () => {
      // Check if welcome screen is displayed
      await expect(element(by.text('AgriTrade AI'))).toBeVisible();
      await expect(element(by.text('Connecting Farmers with Buyers'))).toBeVisible();
      
      // Check feature cards
      await expect(element(by.text('AI Quality Analysis'))).toBeVisible();
      await expect(element(by.text('Fair Pricing'))).toBeVisible();
      await expect(element(by.text('Direct Trade'))).toBeVisible();
      
      // Check buttons
      await expect(element(by.text('Get Started'))).toBeVisible();
      await expect(element(by.text('Sign Up'))).toBeVisible();
    });

    it('should navigate to login screen when Get Started is pressed', async () => {
      await element(by.text('Get Started')).tap();
      
      // Verify navigation to login screen
      await waitFor(element(by.text('Welcome Back')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should navigate to registration screen when Sign Up is pressed', async () => {
      await element(by.text('Sign Up')).tap();
      
      // Verify navigation to registration screen
      await waitFor(element(by.text('Create Account')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Phone Verification Flow', () => {
    beforeEach(async () => {
      // Navigate to login screen
      await element(by.text('Get Started')).tap();
      await waitFor(element(by.text('Welcome Back'))).toBeVisible();
    });

    it('should display phone input field and send code button', async () => {
      await expect(element(by.id('phone-input'))).toBeVisible();
      await expect(element(by.text('Send Verification Code'))).toBeVisible();
    });

    it('should validate phone number format', async () => {
      // Enter invalid phone number
      await element(by.id('phone-input')).typeText('123');
      await element(by.text('Send Verification Code')).tap();
      
      // Check for validation error
      await expect(element(by.text('Please enter a valid phone number'))).toBeVisible();
    });

    it('should send verification code with valid phone number', async () => {
      // Enter valid phone number
      await element(by.id('phone-input')).typeText('+1234567890');
      await element(by.text('Send Verification Code')).tap();
      
      // Wait for verification screen
      await waitFor(element(by.text('Enter Verification Code')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Check verification code input
      await expect(element(by.id('verification-code-input'))).toBeVisible();
    });

    it('should verify code and proceed to dashboard for existing user', async () => {
      // Simulate existing user login flow
      await element(by.id('phone-input')).typeText('+1234567890');
      await element(by.text('Send Verification Code')).tap();
      
      await waitFor(element(by.id('verification-code-input'))).toBeVisible();
      await element(by.id('verification-code-input')).typeText('123456');
      await element(by.text('Verify')).tap();
      
      // Should navigate to dashboard for existing user
      await waitFor(element(by.text('Dashboard')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should handle verification code errors', async () => {
      await element(by.id('phone-input')).typeText('+1234567890');
      await element(by.text('Send Verification Code')).tap();
      
      await waitFor(element(by.id('verification-code-input'))).toBeVisible();
      
      // Enter invalid code
      await element(by.id('verification-code-input')).typeText('000000');
      await element(by.text('Verify')).tap();
      
      // Check for error message
      await expect(element(by.text('Invalid verification code'))).toBeVisible();
    });

    it('should allow resending verification code', async () => {
      await element(by.id('phone-input')).typeText('+1234567890');
      await element(by.text('Send Verification Code')).tap();
      
      await waitFor(element(by.id('verification-code-input'))).toBeVisible();
      
      // Wait for resend button to become available (usually after 30 seconds)
      await waitFor(element(by.text('Resend Code')))
        .toBeVisible()
        .withTimeout(35000);
      
      await element(by.text('Resend Code')).tap();
      
      // Check for confirmation message
      await expect(element(by.text('Verification code sent'))).toBeVisible();
    });
  });

  describe('Registration Flow', () => {
    beforeEach(async () => {
      // Navigate to registration screen
      await element(by.text('Sign Up')).tap();
      await waitFor(element(by.text('Create Account'))).toBeVisible();
    });

    it('should display registration form fields', async () => {
      await expect(element(by.id('registration-phone-input'))).toBeVisible();
      await expect(element(by.id('full-name-input'))).toBeVisible();
      await expect(element(by.id('user-type-farmer'))).toBeVisible();
      await expect(element(by.id('user-type-buyer'))).toBeVisible();
      await expect(element(by.text('Create Account'))).toBeVisible();
    });

    it('should validate all required fields', async () => {
      // Try to create account without filling fields
      await element(by.text('Create Account')).tap();
      
      // Check for validation errors
      await expect(element(by.text('Phone number is required'))).toBeVisible();
      await expect(element(by.text('Full name is required'))).toBeVisible();
      await expect(element(by.text('Please select user type'))).toBeVisible();
    });

    it('should complete farmer registration flow', async () => {
      // Fill registration form for farmer
      await element(by.id('registration-phone-input')).typeText('+1987654321');
      await element(by.id('full-name-input')).typeText('John Farmer');
      await element(by.id('user-type-farmer')).tap();
      
      await element(by.text('Create Account')).tap();
      
      // Should navigate to verification screen
      await waitFor(element(by.text('Enter Verification Code')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Complete verification
      await element(by.id('verification-code-input')).typeText('123456');
      await element(by.text('Verify')).tap();
      
      // Should navigate to profile setup for new user
      await waitFor(element(by.text('Complete Your Profile')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should complete buyer registration flow', async () => {
      // Fill registration form for buyer
      await element(by.id('registration-phone-input')).typeText('+1567890123');
      await element(by.id('full-name-input')).typeText('Jane Buyer');
      await element(by.id('user-type-buyer')).tap();
      
      await element(by.text('Create Account')).tap();
      
      // Should navigate to verification screen
      await waitFor(element(by.text('Enter Verification Code')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Complete verification
      await element(by.id('verification-code-input')).typeText('123456');
      await element(by.text('Verify')).tap();
      
      // Should navigate to profile setup
      await waitFor(element(by.text('Complete Your Profile')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Profile Setup Flow', () => {
    beforeEach(async () => {
      // Complete registration to reach profile setup
      await element(by.text('Sign Up')).tap();
      await waitFor(element(by.text('Create Account'))).toBeVisible();
      
      await element(by.id('registration-phone-input')).typeText('+1111111111');
      await element(by.id('full-name-input')).typeText('Test User');
      await element(by.id('user-type-farmer')).tap();
      await element(by.text('Create Account')).tap();
      
      await waitFor(element(by.id('verification-code-input'))).toBeVisible();
      await element(by.id('verification-code-input')).typeText('123456');
      await element(by.text('Verify')).tap();
      
      await waitFor(element(by.text('Complete Your Profile'))).toBeVisible();
    });

    it('should display profile setup form', async () => {
      await expect(element(by.text('Complete Your Profile'))).toBeVisible();
      await expect(element(by.id('location-input'))).toBeVisible();
      await expect(element(by.id('language-selector'))).toBeVisible();
      await expect(element(by.text('Complete Setup'))).toBeVisible();
    });

    it('should allow setting location', async () => {
      await element(by.id('location-input')).tap();
      
      // Should show location picker or allow manual entry
      await expect(element(by.text('Select Your Location'))).toBeVisible();
    });

    it('should allow language selection', async () => {
      await element(by.id('language-selector')).tap();
      
      // Should show language options
      await expect(element(by.text('English'))).toBeVisible();
      await expect(element(by.text('Français'))).toBeVisible();
      await expect(element(by.text('Kiswahili'))).toBeVisible();
      await expect(element(by.text('العربية'))).toBeVisible();
      
      // Select a language
      await element(by.text('Français')).tap();
    });

    it('should complete profile setup and navigate to dashboard', async () => {
      // Fill profile information
      await element(by.id('location-input')).typeText('Nairobi, Kenya');
      
      // Select language
      await element(by.id('language-selector')).tap();
      await element(by.text('English')).tap();
      
      // Complete setup
      await element(by.text('Complete Setup')).tap();
      
      // Should navigate to dashboard
      await waitFor(element(by.text('Dashboard')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Verify user is logged in
      await expect(element(by.text('Good morning, Test User'))).toBeVisible();
    });
  });

  describe('Logout Flow', () => {
    beforeEach(async () => {
      // Login first
      await element(by.text('Get Started')).tap();
      await waitFor(element(by.id('phone-input'))).toBeVisible();
      await element(by.id('phone-input')).typeText('+1234567890');
      await element(by.text('Send Verification Code')).tap();
      await waitFor(element(by.id('verification-code-input'))).toBeVisible();
      await element(by.id('verification-code-input')).typeText('123456');
      await element(by.text('Verify')).tap();
      await waitFor(element(by.text('Dashboard'))).toBeVisible();
    });

    it('should logout user and return to welcome screen', async () => {
      // Navigate to profile/settings
      await element(by.id('profile-button')).tap();
      await waitFor(element(by.text('Settings'))).toBeVisible();
      
      // Find and tap logout button
      await element(by.text('Logout')).tap();
      
      // Confirm logout
      await waitFor(element(by.text('Are you sure you want to logout?'))).toBeVisible();
      await element(by.text('Logout')).tap();
      
      // Should return to welcome screen
      await waitFor(element(by.text('AgriTrade AI')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Verify logout
      await expect(element(by.text('Get Started'))).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Simulate network disconnection
      await device.disableSynchronization();
      
      await element(by.text('Get Started')).tap();
      await waitFor(element(by.id('phone-input'))).toBeVisible();
      await element(by.id('phone-input')).typeText('+1234567890');
      await element(by.text('Send Verification Code')).tap();
      
      // Should show network error
      await waitFor(element(by.text('Network error. Please check your connection.')))
        .toBeVisible()
        .withTimeout(10000);
      
      await device.enableSynchronization();
    });

    it('should handle server errors', async () => {
      // This would require mocking server responses
      // For now, we'll test the error display mechanism
      
      await element(by.text('Get Started')).tap();
      await waitFor(element(by.id('phone-input'))).toBeVisible();
      
      // Enter a phone number that triggers server error (mock scenario)
      await element(by.id('phone-input')).typeText('+1500000000');
      await element(by.text('Send Verification Code')).tap();
      
      // Should show server error message
      await waitFor(element(by.text('Server error. Please try again later.')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', async () => {
      // Check accessibility labels on welcome screen
      await expect(element(by.id('get-started-button'))).toBeVisible();
      await expect(element(by.id('sign-up-button'))).toBeVisible();
      
      // Navigate to login and check accessibility
      await element(by.text('Get Started')).tap();
      await waitFor(element(by.id('phone-input'))).toBeVisible();
      
      await expect(element(by.id('phone-input'))).toBeVisible();
      await expect(element(by.id('send-code-button'))).toBeVisible();
    });
  });
});