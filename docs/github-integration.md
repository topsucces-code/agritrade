# 🚀 GitHub Integration for AgriTrade AI Platform

This document describes the comprehensive GitHub integration setup for the AgriTrade AI platform, including CI/CD pipelines, automated releases, webhook handling, and deployment automation.

## 📋 Table of Contents

- [Features](#features)
- [Quick Setup](#quick-setup)
- [Configuration](#configuration)
- [Webhook Endpoints](#webhook-endpoints)
- [CI/CD Workflows](#cicd-workflows)
- [Security](#security)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### 🔄 Automated CI/CD Pipeline
- **Continuous Integration**: Automated testing, linting, and security scanning
- **Continuous Deployment**: Automatic deployment to staging and production
- **Multi-environment**: Separate workflows for staging and production
- **Docker Integration**: Automated image building and pushing to registries

### 📦 Release Management
- **Automated Releases**: Create releases with generated changelogs
- **Semantic Versioning**: Support for semantic version tags
- **Pre-release Support**: Beta and alpha release management
- **Docker Image Tagging**: Automatic Docker image versioning

### 🔗 Webhook Integration
- **Real-time Events**: Handle push, pull request, and issue events
- **Deployment Triggers**: Automatic deployment on main branch pushes
- **Notification System**: Team notifications for important events
- **Security**: Webhook signature verification

### 📊 Repository Management
- **Statistics API**: Repository metrics and analytics
- **Issue Management**: Automatic labeling and assignment
- **Workflow Monitoring**: Track deployment status and history

## 🚀 Quick Setup

### Step 1: Run Setup Script

**Windows:**
```batch
.\setup-github.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/setup-github-integration.sh
./scripts/setup-github-integration.sh
```

### Step 2: Generate GitHub Token

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select these scopes:
   - `repo` - Full control of private repositories
   - `workflow` - Update GitHub Action workflows
   - `write:packages` - Upload packages to GitHub Package Registry
4. Copy the token and run the setup script

### Step 3: Configure Repository Secrets

Add these secrets in your repository settings at:
`https://github.com/YOUR_OWNER/YOUR_REPO/settings/secrets/actions`

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `DOCKERHUB_USERNAME` | Docker Hub username | ✅ |
| `DOCKERHUB_TOKEN` | Docker Hub access token | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS access key for deployment | ✅ |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for deployment | ✅ |
| `AWS_REGION` | AWS region (e.g., us-west-2) | ✅ |
| `SNYK_TOKEN` | Snyk security scanning token | ⚠️ |

### Step 4: Configure Webhooks

1. Go to `https://github.com/YOUR_OWNER/YOUR_REPO/settings/hooks`
2. Click "Add webhook"
3. Configure:
   - **Payload URL**: `https://your-domain.com/api/v1/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Use the generated webhook secret from `.env`
   - **Events**: Select `Push`, `Pull requests`, `Issues`, `Workflow runs`

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# GitHub Integration
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO_OWNER=topsucces-code
GITHUB_REPO_NAME=agritrade
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Application
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/agritrade-dev
REDIS_URL=redis://localhost:6379

# External APIs
GOOGLE_VISION_API_KEY=your_google_vision_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-west-2
```

### Service Configuration

The GitHub integration service is automatically configured when you provide the required environment variables. The service handles:

- Repository operations
- Webhook event processing
- Workflow triggering
- Release management

## 🔗 Webhook Endpoints

### Base URL: `/api/v1/webhooks/github`

#### `POST /api/v1/webhooks/github`
Main webhook endpoint for receiving GitHub events.

**Headers:**
- `X-GitHub-Event`: Event type (push, pull_request, issues, etc.)
- `X-GitHub-Delivery`: Unique delivery ID
- `X-Hub-Signature-256`: Webhook signature for verification

**Supported Events:**
- `push` - Code pushes to repository
- `pull_request` - Pull request events
- `issues` - Issue creation and updates
- `workflow_run` - Workflow execution events

#### `GET /api/v1/webhooks/github/health`
Health check endpoint.

**Response:**
```json
{
  "success": true,
  "message": "GitHub webhook service is healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "environment": "development"
}
```

#### `GET /api/v1/webhooks/github/stats`
Get repository statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "stars": 42,
    "forks": 15,
    "watchers": 38,
    "contributors": 5,
    "languages": {
      "JavaScript": 45236,
      "TypeScript": 32891,
      "Shell": 1543
    },
    "lastUpdated": "2024-01-20T10:30:00.000Z"
  }
}
```

#### `POST /api/v1/webhooks/github/deploy`
Trigger manual deployment.

**Request:**
```json
{
  "environment": "staging|production",
  "branch": "main"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deployment to production triggered successfully",
  "environment": "production",
  "branch": "main"
}
```

#### `POST /api/v1/webhooks/github/release`
Create a new release.

**Request:**
```json
{
  "tagName": "v1.2.0",
  "releaseName": "AgriTrade AI v1.2.0",
  "releaseNotes": "## What's New\n- New AI quality assessment\n- Performance improvements",
  "prerelease": false
}
```

#### `POST /api/v1/webhooks/github/issue`
Create a new issue.

**Request:**
```json
{
  "title": "Feature request: Add mobile notifications",
  "body": "Description of the issue...",
  "labels": ["enhancement", "mobile"],
  "assignees": ["username"]
}
```

## 🔄 CI/CD Workflows

### Main CI/CD Pipeline (`.github/workflows/ci-cd.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**Jobs:**
1. **Test**: Run tests across Node.js 18.x and 20.x
2. **Build**: Build backend and frontend
3. **Security**: Security audit and Snyk scanning
4. **Docker**: Build and push Docker images
5. **Deploy Staging**: Deploy to staging environment (develop branch)
6. **Deploy Production**: Deploy to production (main branch)

### Release Workflow (`.github/workflows/release.yml`)

**Triggers:**
- Version tags (v1.0.0, v2.1.3, etc.)
- Manual workflow dispatch

**Features:**
- Automated changelog generation
- Multi-architecture Docker builds (AMD64, ARM64)
- Comprehensive release notes
- GitHub Container Registry and Docker Hub publishing

### Workflow Examples

**Trigger Production Deployment:**
```bash
# Push to main branch
git push origin main

# Or create a release tag
git tag v1.0.0
git push origin v1.0.0
```

**Manual Deployment:**
```bash
# Using GitHub CLI
gh workflow run ci-cd.yml -f environment=production -f deploy=true

# Or via API
curl -X POST \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/OWNER/REPO/actions/workflows/ci-cd.yml/dispatches" \
  -d '{"ref":"main","inputs":{"environment":"production","deploy":"true"}}'
```

## 🔒 Security

### Webhook Security

All webhook requests are verified using HMAC-SHA256 signatures:

1. GitHub signs each webhook payload with your secret
2. Our service verifies the signature before processing
3. Invalid signatures are rejected with 401 Unauthorized

### Token Security

- **Scoped Access**: Tokens have minimal required permissions
- **Environment Variables**: Tokens stored securely in `.env` files
- **Rotation**: Regular token rotation recommended
- **Monitoring**: Webhook delivery monitoring in GitHub settings

### Repository Secrets

Sensitive data is stored in GitHub repository secrets:

- Never commit secrets to version control
- Use separate secrets for different environments
- Regular secret rotation and monitoring
- Principle of least privilege

## 📚 API Reference

### GitHub Integration Service

```javascript
const GitHubIntegrationService = require('./services/github-integration');
const github = new GitHubIntegrationService();

// Create a release
const release = await github.createRelease('v1.0.0', 'Version 1.0.0', 'Release notes...');

// Get repository stats
const stats = await github.getRepositoryStats();

// Trigger workflow
const result = await github.triggerWorkflow('deploy-production.yml', 'main');

// Create issue
const issue = await github.createIssue('Bug report', 'Description...', ['bug']);
```

### Webhook Event Handling

```javascript
// In your Express.js route
const express = require('express');
const webhookRoutes = require('./routes/webhooks');

app.use('/api/v1/webhooks', webhookRoutes);

// Custom webhook processing
app.post('/webhook', (req, res) => {
  const eventType = req.headers['x-github-event'];
  const payload = req.body;
  
  // Process the webhook event
  // ...
});
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Webhook Signature Verification Failed
**Problem:** 401 Unauthorized on webhook requests
**Solution:**
- Check webhook secret in `.env` file
- Verify secret matches GitHub webhook configuration
- Ensure raw body parsing is enabled

#### 2. GitHub API Authentication Failed
**Problem:** 401 Unauthorized on GitHub API calls
**Solution:**
- Verify GitHub token has correct scopes
- Check token hasn't expired
- Regenerate token if necessary

#### 3. Workflow Not Triggering
**Problem:** GitHub Actions not running on push/PR
**Solution:**
- Check workflow file syntax
- Verify branch names in triggers
- Ensure repository has Actions enabled

#### 4. Docker Build Failing
**Problem:** Docker image build failures in CI/CD
**Solution:**
- Check Dockerfile syntax
- Verify build context
- Review build logs in Actions tab

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
DEBUG=github:*
```

### Health Checks

Monitor service health:

```bash
# Check webhook service health
curl http://localhost:3000/api/v1/webhooks/github/health

# Check GitHub API connectivity
curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/repos/OWNER/REPO
```

### Log Analysis

Review webhook delivery logs:
1. Go to GitHub repository settings
2. Navigate to Webhooks
3. Click on your webhook
4. Review "Recent Deliveries" section

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/topsucces-code/agritrade/issues)
- **Documentation**: [Project Wiki](https://github.com/topsucces-code/agritrade/wiki)
- **Email**: dev@agritrade-ai.com

## 📄 License

This GitHub integration is part of the AgriTrade AI Platform and is licensed under the MIT License.

---

**Happy coding! 🚀**