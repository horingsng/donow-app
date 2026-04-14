@echo off
chcp 65001 >nul
cls
echo ==========================================
echo    DoNow Firebase 一鍵部署工具 (修復版)
echo ==========================================
echo.
echo 按任何鍵開始...
pause >nul

REM 檢查 Node.js
echo.
echo [檢查] 正在檢查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 未檢測到 Node.js！
    echo.
    echo 請先安裝 Node.js：https://nodejs.org/
    echo 建議安裝 LTS 版本
    echo.
    pause
    exit /b 1
)
echo [✓] Node.js 已安裝
node --version

REM 檢查 Firebase CLI
echo.
echo [檢查] 正在檢查 Firebase CLI...
firebase --version >nul 2>&1
if errorlevel 1 (
    echo [警告] Firebase CLI 未安裝，正在安裝...
    npm install -g firebase-tools
    if errorlevel 1 (
        echo [錯誤] Firebase CLI 安裝失敗！
        echo 請手動執行：npm install -g firebase-tools
        pause
        exit /b 1
    )
)
echo [✓] Firebase CLI 已安裝
firebase --version

echo.
echo ==========================================
echo    開始安裝依賴
pause
echo ==========================================

cd functions
echo.
echo [1/4] 正在安裝依賴 (可能需要幾分鐘)...
npm install --legacy-peer-deps
if errorlevel 1 (
    echo [錯誤] 依賴安裝失敗！
    pause
    exit /b 1
)

echo.
echo [2/4] 正在編譯 TypeScript...
npm run build
if errorlevel 1 (
    echo [警告] 編譯可能出現問題，繼續嘗試部署...
    pause
)

echo.
echo ==========================================
echo    登入 Firebase
pause
echo ==========================================
echo.
echo [3/4] 請在瀏覽器中登入你的 Google 帳戶
echo     (應該係 quickmoneyapp888@gmail.com)
echo.
firebase login
if errorlevel 1 (
    echo [錯誤] 登入失敗！
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    設定 Stripe Key
pause
echo ==========================================
echo.
echo [4/4] 正在設定 Stripe Key...
firebase functions:config:set stripe.secret_key="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"
if errorlevel 1 (
    echo [錯誤] 設定 Stripe Key 失敗！
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    🚀 準備就緒！即將部署 Cloud Functions
echo ==========================================
echo.
pause

echo.
echo 正在部署 Cloud Functions (可能需要幾分鐘)...
firebase deploy --only functions

if errorlevel 1 (
    echo.
    echo [錯誤] 部署失敗！
    echo 請檢查上面的錯誤訊息
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    🎉 部署成功！
echo ==========================================
echo.
echo 你的 Cloud Functions 網址：
echo.
echo [1] createPaymentIntent:
echo     https://asia-east2-donow-app-9a2ca.cloudfunctions.net/createPaymentIntent
echo.
echo [2] stripeWebhook:
echo     https://asia-east2-donow-app-9a2ca.cloudfunctions.net/stripeWebhook
echo.
echo 請將這些網址填入你的 App 配置中
echo.
pause