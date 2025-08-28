/**
 * GitHub Integration Service for AgriTrade AI Platform
 * Handles repository operations, webhooks, and CI/CD automation
 */

const axios = require('axios');
const crypto = require('crypto');

class GitHubIntegrationService {
  constructor() {
    this.token = process.env.GITHUB_TOKEN;
    this.repoOwner = process.env.GITHUB_REPO_OWNER || 'topsucces-code';
    this.repoName = process.env.GITHUB_REPO_NAME || 'agritrade';
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AgriTrade-AI-Platform'
      }
    });

    if (!this.token) {
      console.warn('GitHub token not provided. Some features will be disabled.');
    }
  }

  /**
   * Create a new release on GitHub
   * @param {string} tagName - The name of the tag
   * @param {string} releaseName - The name of the release
   * @param {string} releaseNotes - The description of the release
   * @param {boolean} prerelease - Whether this is a prerelease
   */
  async createRelease(tagName, releaseName, releaseNotes, prerelease = false) {
    try {
      const response = await this.client.post(`/repos/${this.repoOwner}/${this.repoName}/releases`, {
        tag_name: tagName,
        target_commitish: 'main',
        name: releaseName,
        body: releaseNotes,
        draft: false,
        prerelease
      });

      return {
        success: true,
        release: response.data
      };
    } catch (error) {
      console.error('Error creating release:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Create an issue on GitHub
   * @param {string} title - Issue title
   * @param {string} body - Issue description
   * @param {string[]} labels - Array of label names
   * @param {string[]} assignees - Array of GitHub usernames
   */
  async createIssue(title, body, labels = [], assignees = []) {
    try {
      const response = await this.client.post(`/repos/${this.repoOwner}/${this.repoName}/issues`, {
        title,
        body,
        labels,
        assignees
      });

      return {
        success: true,
        issue: response.data
      };
    } catch (error) {
      console.error('Error creating issue:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Trigger a workflow dispatch
   * @param {string} workflowId - The workflow file name or ID
   * @param {string} ref - The git reference (branch or tag)
   * @param {object} inputs - Input parameters for the workflow
   */
  async triggerWorkflow(workflowId, ref = 'main', inputs = {}) {
    try {
      const response = await this.client.post(
        `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${workflowId}/dispatches`,
        {
          ref,
          inputs
        }
      );

      return {
        success: true,
        status: response.status
      };
    } catch (error) {
      console.error('Error triggering workflow:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats() {
    try {
      const [repoResponse, contributorsResponse, languagesResponse] = await Promise.all([
        this.client.get(`/repos/${this.repoOwner}/${this.repoName}`),
        this.client.get(`/repos/${this.repoOwner}/${this.repoName}/contributors`),
        this.client.get(`/repos/${this.repoOwner}/${this.repoName}/languages`)
      ]);

      return {
        success: true,
        stats: {
          stars: repoResponse.data.stargazers_count,
          forks: repoResponse.data.forks_count,
          watchers: repoResponse.data.watchers_count,
          size: repoResponse.data.size,
          contributors: contributorsResponse.data.length,
          languages: languagesResponse.data,
          lastUpdated: repoResponse.data.updated_at,
          defaultBranch: repoResponse.data.default_branch
        }
      };
    } catch (error) {
      console.error('Error fetching repository stats:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - The raw payload body
   * @param {string} signature - The X-Hub-Signature-256 header
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      console.warn('Webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    const actualSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(actualSignature, 'hex')
    );
  }

  /**
   * Process webhook events
   * @param {string} eventType - The X-GitHub-Event header
   * @param {object} payload - The webhook payload
   */
  async processWebhookEvent(eventType, payload) {
    try {
      switch (eventType) {
        case 'push':
          return await this.handlePushEvent(payload);
        
        case 'pull_request':
          return await this.handlePullRequestEvent(payload);
        
        case 'issues':
          return await this.handleIssueEvent(payload);
        
        case 'workflow_run':
          return await this.handleWorkflowRunEvent(payload);
        
        default:
          console.log(`Received unhandled webhook event: ${eventType}`);
          return { success: true, message: 'Event received but not processed' };
      }
    } catch (error) {
      console.error('Error processing webhook event:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle push events
   */
  async handlePushEvent(payload) {
    const { ref, commits, pusher } = payload;
    
    console.log(`Push event received:`, {
      ref,
      commits: commits.length,
      pusher: pusher.name
    });

    // Auto-deploy logic for specific branches
    if (ref === 'refs/heads/main') {
      console.log('Main branch push detected - triggering production deployment');
      // Trigger production deployment workflow
      await this.triggerWorkflow('deploy-production.yml', 'main');
    } else if (ref === 'refs/heads/develop') {
      console.log('Develop branch push detected - triggering staging deployment');
      // Trigger staging deployment workflow
      await this.triggerWorkflow('deploy-staging.yml', 'develop');
    }

    return { success: true, message: 'Push event processed' };
  }

  /**
   * Handle pull request events
   */
  async handlePullRequestEvent(payload) {
    const { action, pull_request } = payload;
    
    console.log(`Pull request event received:`, {
      action,
      number: pull_request.number,
      title: pull_request.title,
      state: pull_request.state
    });

    // Auto-assign reviewers based on file changes
    if (action === 'opened') {
      // Logic to auto-assign reviewers based on changed files
      // This could be enhanced to assign specific team members based on the files changed
    }

    return { success: true, message: 'Pull request event processed' };
  }

  /**
   * Handle issue events
   */
  async handleIssueEvent(payload) {
    const { action, issue } = payload;
    
    console.log(`Issue event received:`, {
      action,
      number: issue.number,
      title: issue.title,
      state: issue.state
    });

    // Auto-label issues based on title/body content
    if (action === 'opened') {
      const labels = this.detectIssueLabels(issue.title, issue.body);
      if (labels.length > 0) {
        // Add labels to the issue
        await this.client.post(`/repos/${this.repoOwner}/${this.repoName}/issues/${issue.number}/labels`, {
          labels
        });
      }
    }

    return { success: true, message: 'Issue event processed' };
  }

  /**
   * Handle workflow run events
   */
  async handleWorkflowRunEvent(payload) {
    const { action, workflow_run } = payload;
    
    console.log(`Workflow run event received:`, {
      action,
      name: workflow_run.name,
      status: workflow_run.status,
      conclusion: workflow_run.conclusion
    });

    // Send notifications for failed workflows
    if (action === 'completed' && workflow_run.conclusion === 'failure') {
      console.error(`Workflow failed: ${workflow_run.name}`);
      // Here you could integrate with your notification service
      // to alert the development team about the failure
    }

    return { success: true, message: 'Workflow run event processed' };
  }

  /**
   * Detect appropriate labels for issues based on content
   */
  detectIssueLabels(title, body) {
    const labels = [];
    const content = `${title} ${body}`.toLowerCase();

    // Bug detection
    if (content.includes('bug') || content.includes('error') || content.includes('issue')) {
      labels.push('bug');
    }

    // Feature request detection
    if (content.includes('feature') || content.includes('enhancement') || content.includes('new')) {
      labels.push('enhancement');
    }

    // Documentation detection
    if (content.includes('documentation') || content.includes('docs') || content.includes('readme')) {
      labels.push('documentation');
    }

    // Mobile specific
    if (content.includes('mobile') || content.includes('react native') || content.includes('android') || content.includes('ios')) {
      labels.push('mobile');
    }

    // AI/ML specific
    if (content.includes('ai') || content.includes('machine learning') || content.includes('vision') || content.includes('quality')) {
      labels.push('ai/ml');
    }

    // Backend specific
    if (content.includes('api') || content.includes('backend') || content.includes('database') || content.includes('server')) {
      labels.push('backend');
    }

    return labels;
  }

  /**
   * Get workflow runs for the repository
   */
  async getWorkflowRuns(workflowId = null, limit = 10) {
    try {
      let url = `/repos/${this.repoOwner}/${this.repoName}/actions/runs?per_page=${limit}`;
      
      if (workflowId) {
        url = `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${workflowId}/runs?per_page=${limit}`;
      }

      const response = await this.client.get(url);
      
      return {
        success: true,
        runs: response.data.workflow_runs
      };
    } catch (error) {
      console.error('Error fetching workflow runs:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = GitHubIntegrationService;