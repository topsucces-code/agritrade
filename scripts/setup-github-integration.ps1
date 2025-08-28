# AgriTrade AI Platform - GitHub Integration Setup Script (PowerShell)
# This script helps you configure GitHub integration securely

param(
    [Parameter(HelpMessage="GitHub Personal Access Token")]
    [string]$GitHubToken,
    
    [Parameter(HelpMessage="GitHub Repository Owner")]
    [string]$RepoOwner = "topsucces-code",
    
    [Parameter(HelpMessage="GitHub Repository Name")]
    [string]$RepoName = "agritrade",
    
    [switch]$SkipTokenInput
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Color functions
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

# Main script
try {
    Write-Host "🚀 AgriTrade AI Platform - GitHub Integration Setup" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""

    # Check if .env file exists
    if (!(Test-Path ".env")) {
        Write-Info "Creating .env file from template..."
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Success ".env file created from template"
        } else {
            Write-Warning ".env.example not found, creating minimal .env file"
            $envTemplate = @'
# AgriTrade AI Platform Environment Configuration
NODE_ENV=development
PORT=3000
GITHUB_TOKEN=
GITHUB_REPO_OWNER=topsucces-code
GITHUB_REPO_NAME=agritrade
GITHUB_WEBHOOK_SECRET=
'@
            $envTemplate | Out-File -FilePath ".env" -Encoding UTF8
            Write-Success "Basic .env file created"
        }
    } else {
        Write-Warning ".env file already exists"
    }

    Write-Host ""
    Write-Host "🔐 GitHub Token Configuration" -ForegroundColor Yellow
    Write-Host "=============================" -ForegroundColor Yellow

    # Get GitHub token
    if (!$GitHubToken -and !$SkipTokenInput) {
        Write-Host ""
        Write-Info "Please enter your GitHub Personal Access Token:"
        Write-Warning "Make sure your token has the following scopes:"
        Write-Host "  - repo (Full control of private repositories)"
        Write-Host "  - workflow (Update GitHub Action workflows)"  
        Write-Host "  - write:packages (Upload packages to GitHub Package Registry)"
        Write-Host ""
        
        $GitHubToken = Read-Host "GitHub Token" -AsSecureString
        $GitHubToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($GitHubToken))
    }

    if (!$GitHubToken) {
        Write-Error "GitHub token is required!"
        exit 1
    }

    # Validate token format
    if ($GitHubToken -notmatch '^ghp_[a-zA-Z0-9]{36}$' -and $GitHubToken -notmatch '^github_pat_[a-zA-Z0-9_]{82}$') {
        Write-Warning "Token format doesn't match expected GitHub token patterns"
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            exit 1
        }
    }

    # Update .env file with GitHub token
    Write-Info "Updating .env file with GitHub token..."

    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "GITHUB_TOKEN=.*") {
        $envContent = $envContent -replace "GITHUB_TOKEN=.*", "GITHUB_TOKEN=$GitHubToken"
    } else {
        $envContent += "`nGITHUB_TOKEN=$GitHubToken"
    }

    # Update repository owner and name
    if ($envContent -match "GITHUB_REPO_OWNER=.*") {
        $envContent = $envContent -replace "GITHUB_REPO_OWNER=.*", "GITHUB_REPO_OWNER=$RepoOwner"
    } else {
        $envContent += "`nGITHUB_REPO_OWNER=$RepoOwner"
    }

    if ($envContent -match "GITHUB_REPO_NAME=.*") {
        $envContent = $envContent -replace "GITHUB_REPO_NAME=.*", "GITHUB_REPO_NAME=$RepoName"
    } else {
        $envContent += "`nGITHUB_REPO_NAME=$RepoName"
    }

    # Generate webhook secret
    $WebhookSecret = -join ((1..64) | ForEach { '{0:X}' -f (Get-Random -Maximum 16) })
    if ($envContent -match "GITHUB_WEBHOOK_SECRET=.*") {
        $envContent = $envContent -replace "GITHUB_WEBHOOK_SECRET=.*", "GITHUB_WEBHOOK_SECRET=$WebhookSecret"
    } else {
        $envContent += "`nGITHUB_WEBHOOK_SECRET=$WebhookSecret"
    }

    $envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline
    Write-Success "GitHub configuration added to .env file"

    # Test GitHub API connection
    Write-Host ""
    Write-Host "🔗 Testing GitHub API Connection" -ForegroundColor Yellow
    Write-Host "===============================" -ForegroundColor Yellow

    Write-Info "Testing GitHub API connection..."

    try {
        $headers = @{
            'Authorization' = "token $GitHubToken"
            'Accept' = 'application/vnd.github.v3+json'
            'User-Agent' = 'AgriTrade-AI-Setup'
        }

        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName" -Headers $headers -Method Get
        
        Write-Success "GitHub API connection successful!"
        Write-Host "  Repository: $RepoOwner/$RepoName"
        Write-Host "  Description: $($response.description)"
        Write-Host "  Private: $($response.private)"
        Write-Host "  Stars: $($response.stargazers_count)"
        Write-Host "  Forks: $($response.forks_count)"
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        switch ($statusCode) {
            401 { 
                Write-Error "Authentication failed! Please check your GitHub token."
                exit 1
            }
            404 { 
                Write-Error "Repository not found! Please check the owner/repo name."
                exit 1
            }
            default { 
                Write-Error "API request failed with status: $statusCode"
                Write-Error $_.Exception.Message
                exit 1
            }
        }
    }

    # Install dependencies
    Write-Host ""
    Write-Host "📦 Installing Dependencies" -ForegroundColor Yellow
    Write-Host "========================" -ForegroundColor Yellow

    if (Test-Path "package.json") {
        Write-Info "Installing Node.js dependencies..."
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Dependencies installed successfully"
        } else {
            Write-Warning "Some dependencies may have failed to install"
        }
    } else {
        Write-Warning "No package.json found, skipping dependency installation"
    }

    # GitHub secrets setup instructions
    Write-Host ""
    Write-Host "🔧 GitHub Repository Secrets Setup" -ForegroundColor Yellow
    Write-Host "=================================" -ForegroundColor Yellow

    Write-Info "You need to add the following secrets to your GitHub repository:"
    Write-Info "Go to: https://github.com/$RepoOwner/$RepoName/settings/secrets/actions"
    Write-Host ""
    Write-Host "Required Secrets:" -ForegroundColor Cyan
    Write-Host "  - DOCKERHUB_USERNAME: Your Docker Hub username"
    Write-Host "  - DOCKERHUB_TOKEN: Your Docker Hub access token"
    Write-Host "  - AWS_ACCESS_KEY_ID: Your AWS access key"
    Write-Host "  - AWS_SECRET_ACCESS_KEY: Your AWS secret key"
    Write-Host "  - AWS_REGION: Your AWS region (e.g., us-west-2)"
    Write-Host "  - SNYK_TOKEN: Your Snyk security token (optional)"
    Write-Host ""

    # Webhook configuration
    Write-Host ""
    Write-Host "🔗 Webhook Configuration" -ForegroundColor Yellow
    Write-Host "=======================" -ForegroundColor Yellow

    Write-Info "To configure webhooks in your GitHub repository:"
    Write-Host "1. Go to: https://github.com/$RepoOwner/$RepoName/settings/hooks"
    Write-Host "2. Click 'Add webhook'"
    Write-Host "3. Set Payload URL to: https://your-domain.com/api/v1/webhooks/github"
    Write-Host "4. Set Content type to: application/json"
    Write-Host "5. Set Secret to: $WebhookSecret"
    Write-Host "6. Select events: Push, Pull requests, Issues, Workflow runs"
    Write-Host ""

    # Final summary
    Write-Host ""
    Write-Host "✅ Setup Complete!" -ForegroundColor Green
    Write-Host "==================" -ForegroundColor Green

    Write-Success "GitHub integration configured successfully!"
    Write-Host ""
    Write-Info "Summary:"
    Write-Host "  ✅ GitHub token configured"
    Write-Host "  ✅ Repository settings updated ($RepoOwner/$RepoName)"
    Write-Host "  ✅ Webhook secret generated"
    Write-Host "  ✅ Dependencies installed"
    Write-Host "  ✅ Environment file configured"
    Write-Host ""

    Write-Warning "Next steps:"
    Write-Host "  1. Add required secrets to your GitHub repository"
    Write-Host "  2. Configure webhook URL in GitHub repository settings"  
    Write-Host "  3. Start your backend server: npm run dev"
    Write-Host "  4. Test webhook functionality"
    Write-Host ""

    Write-Info "Webhook endpoint will be available at:"
    Write-Host "  POST /api/v1/webhooks/github"
    Write-Host ""

    Write-Warning "Security reminders:"
    Write-Host "  - Never commit .env files to version control"
    Write-Host "  - Regularly rotate your GitHub tokens"
    Write-Host "  - Monitor webhook deliveries in GitHub settings"
    Write-Host "  - Use HTTPS for webhook URLs in production"
    Write-Host ""

    Write-Success "Happy coding! 🚀"

} catch {
    Write-Error "Setup failed: $($_.Exception.Message)"
    Write-Host "Stack trace:" -ForegroundColor Red
    Write-Host $_.Exception.StackTrace -ForegroundColor Red
    exit 1
}