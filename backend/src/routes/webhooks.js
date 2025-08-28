/**
 * GitHub Webhook Routes for AgriTrade AI Platform
 * Handles incoming webhook events from GitHub
 */

const express = require('express');
const crypto = require('crypto');
const GitHubIntegrationService = require('../services/github-integration');

const router = express.Router();
const githubService = new GitHubIntegrationService();

/**
 * Middleware to verify GitHub webhook signature
 */
const verifyGitHubSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      error: 'Missing signature header'
    });
  }

  const payload = JSON.stringify(req.body);
  const isValid = githubService.verifyWebhookSignature(payload, signature);
  
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid signature'
    });
  }

  next();
};

/**
 * Middleware to parse raw body for signature verification
 */
const parseRawBody = express.raw({ type: 'application/json' });

/**
 * Main webhook endpoint
 * POST /api/v1/webhooks/github
 */
router.post('/github', parseRawBody, verifyGitHubSignature, async (req, res) => {
  try {
    const eventType = req.headers['x-github-event'];
    const deliveryId = req.headers['x-github-delivery'];
    
    console.log(`Received GitHub webhook event: ${eventType} (${deliveryId})`);
    
    // Parse the JSON payload
    const payload = JSON.parse(req.body);
    
    // Process the webhook event
    const result = await githubService.processWebhookEvent(eventType, payload);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        deliveryId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        deliveryId
      });
    }
  } catch (error) {
    console.error('Error processing GitHub webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Deployment status endpoint
 * GET /api/v1/webhooks/github/deployment-status
 */
router.get('/github/deployment-status', async (req, res) => {
  try {
    const { environment = 'production', limit = 5 } = req.query;
    
    // Get recent workflow runs
    const workflowRuns = await githubService.getWorkflowRuns(null, limit);
    
    if (!workflowRuns.success) {
      return res.status(500).json({
        success: false,
        error: workflowRuns.error
      });
    }

    // Filter deployment-related workflows
    const deploymentRuns = workflowRuns.runs.filter(run => 
      run.name.toLowerCase().includes('deploy') || 
      run.name.toLowerCase().includes('cd')
    );

    res.json({
      success: true,
      data: {
        environment,
        deployments: deploymentRuns.map(run => ({
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          branch: run.head_branch,
          commit: run.head_sha.substring(0, 7),
          author: run.actor.login,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          htmlUrl: run.html_url
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching deployment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deployment status'
    });
  }
});

/**
 * Repository statistics endpoint
 * GET /api/v1/webhooks/github/stats
 */
router.get('/github/stats', async (req, res) => {
  try {
    const stats = await githubService.getRepositoryStats();
    
    if (stats.success) {
      res.json({
        success: true,
        data: stats.stats
      });
    } else {
      res.status(500).json({
        success: false,
        error: stats.error
      });
    }
  } catch (error) {
    console.error('Error fetching repository stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch repository statistics'
    });
  }
});

/**
 * Trigger deployment endpoint
 * POST /api/v1/webhooks/github/deploy
 */
router.post('/github/deploy', async (req, res) => {
  try {
    const { environment = 'staging', branch = 'main' } = req.body;
    
    // Validate environment
    const allowedEnvironments = ['staging', 'production'];
    if (!allowedEnvironments.includes(environment)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid environment. Must be staging or production'
      });
    }

    // Determine workflow file based on environment
    const workflowFile = environment === 'production' 
      ? 'deploy-production.yml' 
      : 'deploy-staging.yml';

    // Trigger the deployment workflow
    const result = await githubService.triggerWorkflow(workflowFile, branch, {
      environment,
      triggered_by: 'api'
    });

    if (result.success) {
      res.json({
        success: true,
        message: `Deployment to ${environment} triggered successfully`,
        environment,
        branch
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error triggering deployment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger deployment'
    });
  }
});

/**
 * Create release endpoint
 * POST /api/v1/webhooks/github/release
 */
router.post('/github/release', async (req, res) => {
  try {
    const { 
      tagName, 
      releaseName, 
      releaseNotes, 
      prerelease = false 
    } = req.body;

    // Validate required fields
    if (!tagName || !releaseName) {
      return res.status(400).json({
        success: false,
        error: 'tagName and releaseName are required'
      });
    }

    const result = await githubService.createRelease(
      tagName, 
      releaseName, 
      releaseNotes, 
      prerelease
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Release created successfully',
        release: {
          id: result.release.id,
          name: result.release.name,
          tagName: result.release.tag_name,
          htmlUrl: result.release.html_url,
          publishedAt: result.release.published_at
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating release:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create release'
    });
  }
});

/**
 * Create issue endpoint
 * POST /api/v1/webhooks/github/issue
 */
router.post('/github/issue', async (req, res) => {
  try {
    const { 
      title, 
      body, 
      labels = [], 
      assignees = [] 
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'title is required'
      });
    }

    const result = await githubService.createIssue(title, body, labels, assignees);

    if (result.success) {
      res.json({
        success: true,
        message: 'Issue created successfully',
        issue: {
          id: result.issue.id,
          number: result.issue.number,
          title: result.issue.title,
          state: result.issue.state,
          htmlUrl: result.issue.html_url,
          createdAt: result.issue.created_at
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create issue'
    });
  }
});

/**
 * Health check endpoint for webhooks
 * GET /api/v1/webhooks/github/health
 */
router.get('/github/health', (req, res) => {
  res.json({
    success: true,
    message: 'GitHub webhook service is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;