import { by, device, element, expect, waitFor } from 'detox';

describe('Quality Analysis Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    
    // Login first to access quality analysis features
    await element(by.text('Get Started')).tap();
    await waitFor(element(by.id('phone-input'))).toBeVisible();
    await element(by.id('phone-input')).typeText('+1234567890');
    await element(by.text('Send Verification Code')).tap();
    await waitFor(element(by.id('verification-code-input'))).toBeVisible();
    await element(by.id('verification-code-input')).typeText('123456');
    await element(by.text('Verify')).tap();
    await waitFor(element(by.text('Dashboard'))).toBeVisible();
  });

  describe('Navigation to Quality Analysis', () => {
    it('should navigate to quality analysis from dashboard', async () => {
      // Find and tap quality analysis button on dashboard
      await element(by.id('quality-analysis-card')).tap();
      
      // Verify navigation to quality analysis screen
      await waitFor(element(by.text('Quality Analysis')))
        .toBeVisible()
        .withTimeout(3000);
      
      await expect(element(by.text('Upload Product Images'))).toBeVisible();
    });

    it('should navigate to quality analysis from bottom tab', async () => {
      // Tap quality analysis tab
      await element(by.id('quality-analysis-tab')).tap();
      
      // Verify navigation
      await waitFor(element(by.text('Quality Analysis')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should navigate to quality analysis from floating action button', async () => {
      // Tap floating quality analysis button
      await element(by.id('floating-quality-button')).tap();
      
      // Verify navigation
      await waitFor(element(by.text('Quality Analysis')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Image Upload Process', () => {
    beforeEach(async () => {
      // Navigate to quality analysis screen
      await element(by.id('quality-analysis-tab')).tap();
      await waitFor(element(by.text('Quality Analysis'))).toBeVisible();
    });

    it('should display image upload interface', async () => {
      await expect(element(by.text('Upload Product Images'))).toBeVisible();
      await expect(element(by.text('Add up to 5 high-quality images'))).toBeVisible();
      await expect(element(by.id('add-image-button'))).toBeVisible();
      
      // Check photo guidelines
      await expect(element(by.text('📸 Photo Guidelines'))).toBeVisible();
      await expect(element(by.text('Use good natural lighting'))).toBeVisible();
    });

    it('should show image source selection when add image is tapped', async () => {
      await element(by.id('add-image-button')).tap();
      
      // Should show image source alert/modal
      await waitFor(element(by.text('Select Image')))
        .toBeVisible()
        .withTimeout(2000);
      
      await expect(element(by.text('Camera'))).toBeVisible();
      await expect(element(by.text('Gallery'))).toBeVisible();
      await expect(element(by.text('Cancel'))).toBeVisible();
    });

    it('should handle camera selection', async () => {
      await element(by.id('add-image-button')).tap();
      await waitFor(element(by.text('Camera'))).toBeVisible();
      
      // Grant camera permission if needed (this might require device-specific handling)
      await element(by.text('Camera')).tap();
      
      // In a real test, this would open the camera
      // For E2E testing, we might need to mock the camera response
      // or use a test image
    });

    it('should handle gallery selection', async () => {
      await element(by.id('add-image-button')).tap();
      await waitFor(element(by.text('Gallery'))).toBeVisible();
      
      await element(by.text('Gallery')).tap();
      
      // This would open the gallery in real scenario
      // For testing, we might simulate selecting an image
    });

    it('should display selected images', async () => {
      // Simulate adding an image (this would need to be mocked in real tests)
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      
      // After image selection, should show the image
      await waitFor(element(by.id('selected-image-0')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Should show remove button
      await expect(element(by.id('remove-image-0'))).toBeVisible();
    });

    it('should allow removing selected images', async () => {
      // First add an image (mocked)
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      await waitFor(element(by.id('selected-image-0'))).toBeVisible();
      
      // Remove the image
      await element(by.id('remove-image-0')).tap();
      
      // Image should be removed
      await waitFor(element(by.id('selected-image-0')))
        .not.toBeVisible()
        .withTimeout(2000);
    });

    it('should enforce maximum image limit', async () => {
      // Try to add more than 5 images
      for (let i = 0; i < 6; i++) {
        await element(by.id('add-image-button')).tap();
        await element(by.text('Gallery')).tap();
        
        if (i === 5) {
          // Should show error for 6th image
          await waitFor(element(by.text('You can only select up to 5 images')))
            .toBeVisible()
            .withTimeout(3000);
        }
      }
    });
  });

  describe('Product Information Entry', () => {
    beforeEach(async () => {
      await element(by.id('quality-analysis-tab')).tap();
      await waitFor(element(by.text('Quality Analysis'))).toBeVisible();
      
      // Add at least one image first
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      await waitFor(element(by.id('selected-image-0'))).toBeVisible();
    });

    it('should show product information form after images are added', async () => {
      // Scroll to product information section
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      
      await expect(element(by.text('Product Information'))).toBeVisible();
      await expect(element(by.id('product-name-input'))).toBeVisible();
      await expect(element(by.id('product-category-selector'))).toBeVisible();
      await expect(element(by.id('harvest-date-picker'))).toBeVisible();
    });

    it('should allow entering product name', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      
      await element(by.id('product-name-input')).typeText('Fresh Tomatoes');
      
      // Verify text was entered
      await expect(element(by.id('product-name-input'))).toHaveText('Fresh Tomatoes');
    });

    it('should allow selecting product category', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      
      await element(by.id('product-category-selector')).tap();
      
      // Should show category options
      await waitFor(element(by.text('Vegetables'))).toBeVisible();
      await expect(element(by.text('Fruits'))).toBeVisible();
      await expect(element(by.text('Grains'))).toBeVisible();
      
      // Select vegetables
      await element(by.text('Vegetables')).tap();
      
      // Verify selection
      await expect(element(by.id('product-category-selector'))).toHaveText('Vegetables');
    });

    it('should allow setting harvest date', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      
      await element(by.id('harvest-date-picker')).tap();
      
      // Should show date picker
      await waitFor(element(by.id('date-picker-modal')))
        .toBeVisible()
        .withTimeout(2000);
    });
  });

  describe('Quality Analysis Process', () => {
    beforeEach(async () => {
      await element(by.id('quality-analysis-tab')).tap();
      await waitFor(element(by.text('Quality Analysis'))).toBeVisible();
      
      // Add image and fill product information
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      await waitFor(element(by.id('selected-image-0'))).toBeVisible();
      
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      await element(by.id('product-name-input')).typeText('Fresh Tomatoes');
      await element(by.id('product-category-selector')).tap();
      await element(by.text('Vegetables')).tap();
    });

    it('should start analysis when analyze button is pressed', async () => {
      // Scroll to analyze button
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      
      await element(by.id('start-analysis-button')).tap();
      
      // Should show analysis in progress
      await waitFor(element(by.text('Analyzing Quality...')))
        .toBeVisible()
        .withTimeout(3000);
      
      await expect(element(by.id('analysis-progress-bar'))).toBeVisible();
    });

    it('should display analysis progress steps', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      // Should show different progress steps
      await waitFor(element(by.text('Uploading images...'))).toBeVisible();
      
      await waitFor(element(by.text('AI processing...')))
        .toBeVisible()
        .withTimeout(5000);
      
      await waitFor(element(by.text('Generating results...')))
        .toBeVisible()
        .withTimeout(8000);
    });

    it('should display analysis results', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      // Wait for analysis to complete
      await waitFor(element(by.text('Analysis Complete!')))
        .toBeVisible()
        .withTimeout(15000);
      
      // Check results display
      await expect(element(by.text('Quality Score'))).toBeVisible();
      await expect(element(by.id('quality-score-indicator'))).toBeVisible();
      await expect(element(by.text('Estimated Price'))).toBeVisible();
      await expect(element(by.text('View Detailed Report'))).toBeVisible();
    });

    it('should show quality score with proper rating', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      await waitFor(element(by.text('Analysis Complete!'))).toBeVisible();
      
      // Check quality score display
      await expect(element(by.id('quality-score-indicator'))).toBeVisible();
      
      // Should show rating (Excellent, Good, Fair, or Poor)
      const possibleRatings = ['Excellent', 'Good', 'Fair', 'Poor'];
      let ratingFound = false;
      
      for (const rating of possibleRatings) {
        try {
          await expect(element(by.text(rating))).toBeVisible();
          ratingFound = true;
          break;
        } catch (e) {
          // Continue checking other ratings
        }
      }
      
      expect(ratingFound).toBe(true);
    });

    it('should display price recommendations', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      await waitFor(element(by.text('Analysis Complete!'))).toBeVisible();
      
      // Check price recommendations
      await expect(element(by.text('Price Recommendations'))).toBeVisible();
      await expect(element(by.text('Estimated Market Price'))).toBeVisible();
      await expect(element(by.text('Recommended Selling Price'))).toBeVisible();
    });

    it('should allow viewing detailed report', async () => {
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      await waitFor(element(by.text('Analysis Complete!'))).toBeVisible();
      
      // Tap detailed report button
      await element(by.text('View Detailed Report')).tap();
      
      // Should navigate to detailed report screen
      await waitFor(element(by.text('Quality Analysis Report')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Check detailed report content
      await expect(element(by.text('Analysis Details'))).toBeVisible();
      await expect(element(by.text('Quality Factors'))).toBeVisible();
      await expect(element(by.text('Market Comparison'))).toBeVisible();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await element(by.id('quality-analysis-tab')).tap();
      await waitFor(element(by.text('Quality Analysis'))).toBeVisible();
    });

    it('should handle missing images error', async () => {
      // Try to start analysis without images
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      // Should show error
      await waitFor(element(by.text('Please add at least one image')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should handle missing product information error', async () => {
      // Add image but no product info
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      await waitFor(element(by.id('selected-image-0'))).toBeVisible();
      
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      // Should show validation errors
      await waitFor(element(by.text('Product name is required')))
        .toBeVisible()
        .withTimeout(2000);
    });

    it('should handle analysis failure', async () => {
      // Setup complete analysis
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      await waitFor(element(by.id('selected-image-0'))).toBeVisible();
      
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      await element(by.id('product-name-input')).typeText('Test Product');
      await element(by.id('product-category-selector')).tap();
      await element(by.text('Vegetables')).tap();
      
      // Simulate network error during analysis
      await device.disableSynchronization();
      
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      // Should show error message
      await waitFor(element(by.text('Analysis failed. Please try again.')))
        .toBeVisible()
        .withTimeout(10000);
      
      await device.enableSynchronization();
    });

    it('should allow retrying failed analysis', async () => {
      // After a failed analysis, should show retry option
      // This builds on the previous test scenario
      
      await expect(element(by.text('Try Again'))).toBeVisible();
      
      await element(by.text('Try Again')).tap();
      
      // Should restart analysis process
      await waitFor(element(by.text('Analyzing Quality...')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Results Management', () => {
    beforeEach(async () => {
      // Complete a full analysis
      await element(by.id('quality-analysis-tab')).tap();
      await waitFor(element(by.text('Quality Analysis'))).toBeVisible();
      
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      await waitFor(element(by.id('selected-image-0'))).toBeVisible();
      
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      await element(by.id('product-name-input')).typeText('Fresh Tomatoes');
      await element(by.id('product-category-selector')).tap();
      await element(by.text('Vegetables')).tap();
      
      await element(by.id('quality-analysis-scroll')).scroll(500, 'down');
      await element(by.id('start-analysis-button')).tap();
      
      await waitFor(element(by.text('Analysis Complete!'))).toBeVisible();
    });

    it('should allow saving analysis results', async () => {
      await element(by.text('Save Results')).tap();
      
      // Should show save confirmation
      await waitFor(element(by.text('Results saved successfully')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should allow sharing analysis results', async () => {
      await element(by.text('Share Results')).tap();
      
      // Should open share sheet/modal
      await waitFor(element(by.text('Share Quality Analysis')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should allow creating product listing from results', async () => {
      await element(by.text('Create Listing')).tap();
      
      // Should navigate to product creation with pre-filled data
      await waitFor(element(by.text('Create Product Listing')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Verify pre-filled information
      await expect(element(by.id('product-name-input'))).toHaveText('Fresh Tomatoes');
    });

    it('should start new analysis', async () => {
      await element(by.text('New Analysis')).tap();
      
      // Should reset the form and return to image upload
      await waitFor(element(by.text('Upload Product Images')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Should be cleared
      await expect(element(by.id('selected-image-0'))).not.toBeVisible();
    });
  });

  describe('Navigation and State Management', () => {
    it('should maintain analysis state when navigating away and back', async () => {
      await element(by.id('quality-analysis-tab')).tap();
      await waitFor(element(by.text('Quality Analysis'))).toBeVisible();
      
      // Add image and some information
      await element(by.id('add-image-button')).tap();
      await element(by.text('Gallery')).tap();
      await waitFor(element(by.id('selected-image-0'))).toBeVisible();
      
      await element(by.id('quality-analysis-scroll')).scroll(300, 'down');
      await element(by.id('product-name-input')).typeText('Test Product');
      
      // Navigate away
      await element(by.id('dashboard-tab')).tap();
      await waitFor(element(by.text('Dashboard'))).toBeVisible();
      
      // Navigate back
      await element(by.id('quality-analysis-tab')).tap();
      await waitFor(element(by.text('Quality Analysis'))).toBeVisible();
      
      // Should maintain state
      await expect(element(by.id('selected-image-0'))).toBeVisible();
      await expect(element(by.id('product-name-input'))).toHaveText('Test Product');
    });
  });
});