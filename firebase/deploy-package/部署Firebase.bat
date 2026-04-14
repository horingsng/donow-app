@echo off
chcp 65001
cls
echo ==========================================
echo    DoNow Firebase 一鍵部署工具
echo ==========================================
echo.

REM 檢查是否已安裝 Firebase CLI
firebase --version >nul 2>&1
if errorlevel 1 (
    echo [1/5] 正在安裝 Firebase CLI...
    npm install -g firebase-tools
    if errorlevel 1 (
        echo 錯誤：無法安裝 Firebase CLI，請檢查 Node.js 是否已安裝
        pause
        exit /b 1
    )
) else (
    echo [1/5] Firebase CLI 已安裝 ✓
)

echo.
echo [2/5] 正在安裝依賴...
cd functions
npm install --legacy-peer-deps
if errorlevel 1 (
    echo 錯誤：安裝失敗
    pause
    exit /b 1
)

echo.
echo [3/5] 正在編譯 TypeScript...
npm run build
if errorlevel 1 (
    echo 警告：編譯可能出現問題，繼續嘗試部署...
)

echo.
echo [4/5] 正在登入 Firebase...
echo 請在瀏覽器中登入你的 Google 帳戶...
firebase login
if errorlevel 1 (
    echo 錯誤：登入失敗
    pause
    exit /b 1
)

echo.
echo [5/5] 正在設定 Stripe Key...
firebase functions:config:set stripe.secret_key="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"

echo.
echo ==========================================
echo    準備就緒！即將部署 Cloud Functions
echo ==========================================
echo.
pause

echo.
echo 正在部署 Cloud Functions...
firebase deploy --only functions

if errorlevel 1 (
    echo.
    echo 錯誤：部署失敗，請檢查錯誤訊息
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    🎉 部署成功！
echo ==========================================
echo.
echo 你的 Cloud Functions 網址：
echo - createPaymentIntent: https://asia-east2-donow-app-9a2ca.cloudfunctions.net/createPaymentIntent
echo - stripeWebhook: https://asia-east2-donow-app-9a2ca.cloudfunctions.net/stripeWebhook
echo.
pause