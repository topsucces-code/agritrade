@echo off
REM AgriTrade AI - GitHub Integration Setup

echo.
echo ===========================================
echo  AgriTrade AI - GitHub Integration Setup
echo ===========================================
echo.

REM Check if .env exists
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [SUCCESS] .env file created from template
    ) else (
        echo NODE_ENV=development > .env
        echo PORT=3000 >> .env
        echo GITHUB_TOKEN= >> .env
        echo GITHUB_REPO_OWNER=topsucces-code >> .env
        echo GITHUB_REPO_NAME=agritrade >> .env
        echo GITHUB_WEBHOOK_SECRET= >> .env
        echo [SUCCESS] Basic .env file created
    )
) else (
    echo [WARNING] .env file already exists
)

echo.
echo ===========================================
echo  GitHub Token Configuration
echo ===========================================
echo.
echo IMPORTANT: First revoke your old token at:
echo https://github.com/settings/tokens
echo.
echo Then create a new token with these scopes:
echo   - repo (Full control of repositories)
echo   - workflow (Update GitHub workflows)
echo   - write:packages (Upload packages)
echo.
echo Go to: https://github.com/settings/tokens
echo.

set /p GITHUB_TOKEN="Enter your new GitHub token: "

if "%GITHUB_TOKEN%"=="" (
    echo [ERROR] GitHub token is required!
    pause
    exit /b 1
)

REM Update .env file
powershell -Command "(Get-Content .env) -replace 'GITHUB_TOKEN=.*', 'GITHUB_TOKEN=%GITHUB_TOKEN%' | Set-Content .env"

echo [SUCCESS] GitHub token added to .env file

echo.
echo ===========================================
echo  Installing Dependencies
echo ===========================================
echo.

if exist package.json (
    echo Installing Node.js dependencies...
    npm install
    if %errorlevel%==0 (
        echo [SUCCESS] Dependencies installed
    ) else (
        echo [WARNING] Some dependencies may have failed
    )
) else (
    echo [WARNING] No package.json found
)

echo.
echo ===========================================
echo  Setup Complete!
echo ===========================================
echo.
echo Next steps:
echo.
echo 1. Add secrets to your GitHub repository:
echo    https://github.com/topsucces-code/agritrade/settings/secrets/actions
echo.
echo    Required secrets:
echo    - DOCKERHUB_USERNAME
echo    - DOCKERHUB_TOKEN
echo    - AWS_ACCESS_KEY_ID
echo    - AWS_SECRET_ACCESS_KEY
echo    - AWS_REGION
echo.
echo 2. Configure webhook in GitHub:
echo    Repository Settings ^> Webhooks ^> Add webhook
echo    URL: https://your-domain.com/api/v1/webhooks/github
echo    Content type: application/json
echo    Events: Push, Pull requests, Issues, Workflow runs
echo.
echo 3. Start development server:
echo    npm run dev
echo.
echo 4. Test webhook endpoints:
echo    GET  /api/v1/webhooks/github/health
echo    POST /api/v1/webhooks/github
echo.
echo Happy coding! 
echo.
pause