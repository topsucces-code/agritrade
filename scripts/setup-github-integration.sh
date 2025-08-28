#!/bin/bash

# AgriTrade AI Platform - GitHub Integration Setup Script
# This script helps you configure GitHub integration securely

set -e

echo "🚀 AgriTrade AI Platform - GitHub Integration Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_info "Creating .env file from template..."
    cp .env.example .env
    print_status ".env file created from template"
else
    print_warning ".env file already exists"
fi

echo ""
echo "🔐 GitHub Token Configuration"
echo "============================="

# Get GitHub token from user
echo ""
print_info "Please enter your GitHub Personal Access Token:"
print_warning "Make sure your token has the following scopes:"
echo "  - repo (Full control of private repositories)"
echo "  - workflow (Update GitHub Action workflows)"
echo "  - write:packages (Upload packages to GitHub Package Registry)"
echo ""

read -s -p "GitHub Token: " GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_TOKEN" ]; then
    print_error "GitHub token is required!"
    exit 1
fi

# Validate token format
if [[ ! "$GITHUB_TOKEN" =~ ^ghp_[a-zA-Z0-9]{36}$ ]] && [[ ! "$GITHUB_TOKEN" =~ ^github_pat_[a-zA-Z0-9_]{82}$ ]]; then
    print_warning "Token format doesn't match expected GitHub token patterns"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update .env file with GitHub token
print_info "Updating .env file with GitHub token..."

# Use sed to update the GITHUB_TOKEN line in .env
if grep -q "^GITHUB_TOKEN=" .env; then
    sed -i.bak "s/^GITHUB_TOKEN=.*/GITHUB_TOKEN=$GITHUB_TOKEN/" .env
else
    echo "GITHUB_TOKEN=$GITHUB_TOKEN" >> .env
fi

print_status "GitHub token added to .env file"

# Get repository information
echo ""
echo "📁 Repository Configuration"
echo "========================="

# Default values
DEFAULT_OWNER="topsucces-code"
DEFAULT_REPO="agritrade"

read -p "GitHub Repository Owner [$DEFAULT_OWNER]: " REPO_OWNER
REPO_OWNER=${REPO_OWNER:-$DEFAULT_OWNER}

read -p "GitHub Repository Name [$DEFAULT_REPO]: " REPO_NAME
REPO_NAME=${REPO_NAME:-$DEFAULT_REPO}

# Update .env with repository info
if grep -q "^GITHUB_REPO_OWNER=" .env; then
    sed -i.bak "s/^GITHUB_REPO_OWNER=.*/GITHUB_REPO_OWNER=$REPO_OWNER/" .env
else
    echo "GITHUB_REPO_OWNER=$REPO_OWNER" >> .env
fi

if grep -q "^GITHUB_REPO_NAME=" .env; then
    sed -i.bak "s/^GITHUB_REPO_NAME=.*/GITHUB_REPO_NAME=$REPO_NAME/" .env
else
    echo "GITHUB_REPO_NAME=$REPO_NAME" >> .env
fi

print_status "Repository configuration updated"

# Test GitHub API connection
echo ""
echo "🔗 Testing GitHub API Connection"
echo "==============================="

print_info "Testing GitHub API connection..."

# Test API call using curl
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME")

if [ "$HTTP_STATUS" -eq 200 ]; then
    print_status "GitHub API connection successful!"
    
    # Get repository info
    REPO_INFO=$(curl -s \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME")
    
    REPO_DESCRIPTION=$(echo "$REPO_INFO" | grep -o '"description":"[^"]*"' | cut -d'"' -f4)
    REPO_PRIVATE=$(echo "$REPO_INFO" | grep -o '"private":[^,]*' | cut -d':' -f2)
    REPO_STARS=$(echo "$REPO_INFO" | grep -o '"stargazers_count":[^,]*' | cut -d':' -f2)
    
    echo "  Repository: $REPO_OWNER/$REPO_NAME"
    echo "  Description: $REPO_DESCRIPTION"
    echo "  Private: $REPO_PRIVATE"
    echo "  Stars: $REPO_STARS"
    
elif [ "$HTTP_STATUS" -eq 401 ]; then
    print_error "Authentication failed! Please check your GitHub token."
    exit 1
elif [ "$HTTP_STATUS" -eq 404 ]; then
    print_error "Repository not found! Please check the owner/repo name."
    exit 1
else
    print_error "API request failed with status: $HTTP_STATUS"
    exit 1
fi

# Setup webhook secret
echo ""
echo "🔒 Webhook Security Configuration"
echo "==============================="

print_info "Generating webhook secret..."

# Generate a secure random webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Update .env with webhook secret
if grep -q "^GITHUB_WEBHOOK_SECRET=" .env; then
    sed -i.bak "s/^GITHUB_WEBHOOK_SECRET=.*/GITHUB_WEBHOOK_SECRET=$WEBHOOK_SECRET/" .env
else
    echo "GITHUB_WEBHOOK_SECRET=$WEBHOOK_SECRET" >> .env
fi

print_status "Webhook secret generated and added to .env"

# Install dependencies if needed
echo ""
echo "📦 Installing Dependencies"
echo "========================"

if [ -f "package.json" ]; then
    print_info "Installing Node.js dependencies..."
    npm install
    print_status "Dependencies installed"
else
    print_warning "No package.json found, skipping dependency installation"
fi

# Setup GitHub secrets (instructions)
echo ""
echo "🔧 GitHub Repository Secrets Setup"
echo "================================="

print_info "You need to add the following secrets to your GitHub repository:"
print_info "Go to: https://github.com/$REPO_OWNER/$REPO_NAME/settings/secrets/actions"
echo ""
echo "Required Secrets:"
echo "  - DOCKERHUB_USERNAME: Your Docker Hub username"
echo "  - DOCKERHUB_TOKEN: Your Docker Hub access token"
echo "  - AWS_ACCESS_KEY_ID: Your AWS access key"
echo "  - AWS_SECRET_ACCESS_KEY: Your AWS secret key"
echo "  - AWS_REGION: Your AWS region (e.g., us-west-2)"
echo "  - SNYK_TOKEN: Your Snyk security token (optional)"
echo ""

read -p "Press Enter to continue after setting up GitHub secrets..."

# Test webhook endpoint locally (if backend is running)
echo ""
echo "🔍 Testing Local Setup"
echo "===================="

if [ -f "backend/src/index.js" ] || [ -f "backend/src/app.js" ]; then
    print_info "Backend files detected. You can test the webhook endpoint by:"
    echo "  1. Start your backend: npm run dev"
    echo "  2. Use ngrok to expose local endpoint: ngrok http 3000"
    echo "  3. Configure webhook URL in GitHub: https://yourdomain.ngrok.io/api/v1/webhooks/github"
    echo "  4. Set webhook secret to: $WEBHOOK_SECRET"
fi

# Final summary
echo ""
echo "✅ Setup Complete!"
echo "=================="

print_status "GitHub integration configured successfully!"
echo ""
print_info "Summary:"
echo "  ✅ GitHub token configured"
echo "  ✅ Repository settings updated"
echo "  ✅ Webhook secret generated"
echo "  ✅ Dependencies installed"
echo "  ✅ Environment file created"
echo ""

print_warning "Next steps:"
echo "  1. Add required secrets to your GitHub repository"
echo "  2. Configure webhook URL in GitHub repository settings"
echo "  3. Start your backend server: npm run dev"
echo "  4. Test webhook functionality"
echo ""

print_info "For webhook testing, your endpoint will be:"
echo "  POST /api/v1/webhooks/github"
echo ""

print_warning "Security reminder:"
echo "  - Never commit .env files to version control"
echo "  - Regularly rotate your GitHub tokens"
echo "  - Monitor webhook deliveries in GitHub settings"
echo ""

print_status "Happy coding! 🚀"

# Clean up backup files
rm -f .env.bak