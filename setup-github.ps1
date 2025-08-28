# AgriTrade AI - GitHub Integration Setup (Simplified)

Write-Host "🚀 AgriTrade AI - GitHub Integration Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ .env file created from template" -ForegroundColor Green
    } else {
        # Create basic .env file
        $envContent = @"
# AgriTrade AI Platform Environment Configuration
NODE_ENV=development
PORT=3000
GITHUB_TOKEN=
GITHUB_REPO_OWNER=topsucces-code
GITHUB_REPO_NAME=agritrade
GITHUB_WEBHOOK_SECRET=
"@
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "✅ Basic .env file created" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  .env file already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔐 GitHub Token Setup" -ForegroundColor Yellow
Write-Host "=====================" -ForegroundColor Yellow
Write-Host ""

Write-Host "To complete the setup:" -ForegroundColor Cyan
Write-Host "1. Go to: https://github.com/settings/tokens"
Write-Host "2. Click 'Generate new token (classic)'"
Write-Host "3. Select these scopes:"
Write-Host "   - repo (Full control of private repositories)"
Write-Host "   - workflow (Update GitHub Action workflows)"
Write-Host "   - write:packages (Upload packages)"
Write-Host ""

$token = Read-Host "Enter your new GitHub token"

if ($token) {
    # Update .env file
    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace "GITHUB_TOKEN=.*", "GITHUB_TOKEN=$token"
    
    # Generate webhook secret
    $webhookSecret = [System.Web.Security.Membership]::GeneratePassword(32, 0)
    $envContent = $envContent -replace "GITHUB_WEBHOOK_SECRET=.*", "GITHUB_WEBHOOK_SECRET=$webhookSecret"
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline
    
    Write-Host ""
    Write-Host "✅ GitHub token added to .env file" -ForegroundColor Green
    
    # Test connection
    Write-Host ""
    Write-Host "Testing GitHub connection..." -ForegroundColor Yellow
    
    try {
        $headers = @{
            'Authorization' = "token $token"
            'Accept' = 'application/vnd.github.v3+json'
        }
        
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/topsucces-code/agritrade" -Headers $headers
        
        Write-Host "✅ Connection successful!" -ForegroundColor Green
        Write-Host "Repository: $($response.full_name)"
        Write-Host "Stars: $($response.stargazers_count)"
        
    } catch {
        Write-Host "❌ Connection failed. Please check your token." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow

if (Test-Path "package.json") {
    npm install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  No package.json found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Add secrets to GitHub repository:"
Write-Host "   https://github.com/topsucces-code/agritrade/settings/secrets/actions"
Write-Host ""
Write-Host "2. Required secrets:"
Write-Host "   - DOCKERHUB_USERNAME"
Write-Host "   - DOCKERHUB_TOKEN"  
Write-Host "   - AWS_ACCESS_KEY_ID"
Write-Host "   - AWS_SECRET_ACCESS_KEY"
Write-Host "   - AWS_REGION"
Write-Host ""
Write-Host "3. Start development server:"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green