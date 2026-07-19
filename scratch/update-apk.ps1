# PowerShell script to automate ChatCorner Android APK building & syncing

$ErrorActionPreference = "Stop"

$chatcornerPath = "C:\Users\HP\.gemini\antigravity\scratch\chatcorner"
$androidPath = "C:\Users\HP\.gemini\antigravity\scratch\chatcorner-android"
$wwwPath = "$androidPath\www"

Write-Host "1. Syncing www repository with latest local changes..." -ForegroundColor Cyan
Copy-Item -Path "$chatcornerPath\*" -Destination $wwwPath -Recurse -Force -Exclude ".git", "node_modules", "chatcorner-updated.apk", "chatcorner.apk"

Write-Host "2. Running Capacitor sync..." -ForegroundColor Cyan
Set-Location $androidPath
npx cap sync android

Write-Host "3. Building Android APK via Gradle..." -ForegroundColor Cyan
Set-Location "$androidPath\android"
.\gradlew.bat assembleDebug

$builtApk = "$androidPath\android\app\build\outputs\apk\debug\app-debug.apk"
$targetApk = "$chatcornerPath\chatcorner.apk"

if (Test-Path $builtApk) {
    Write-Host "4. Copying built APK to chatcorner repository..." -ForegroundColor Cyan
    Copy-Item -Path $builtApk -Destination $targetApk -Force
    
    Write-Host "5. Calculating SHA-256 hash..." -ForegroundColor Cyan
    $hash = (Get-FileHash -Path $targetApk -Algorithm SHA256).Hash.ToLower()
    Write-Host "New SHA-256: $hash" -ForegroundColor Green
    
    Write-Host "6. Updating chat.html with new SHA-256..." -ForegroundColor Cyan
    $chatHtmlPath = "$chatcornerPath\chat.html"
    $htmlContent = Get-Content -Path $chatHtmlPath -Raw
    
    # Regex to match the span containing the SHA-256 hash
    $pattern = '(<span id="apk-sha256">)([a-f0-9]{64})(<\/span>)'
    $htmlContent = $htmlContent -replace $pattern, ('${1}' + $hash + '${3}')
    
    Set-Content -Path $chatHtmlPath -Value $htmlContent -NoNewline
    
    Write-Host "7. Committing and pushing updated APK and chat.html..." -ForegroundColor Cyan
    Set-Location $chatcornerPath
    git add chatcorner.apk chat.html
    git commit -m "Update Android APK & SHA-256 hash in chat.html"
    git push origin main
    
    Write-Host "✅ APK Build and Update completed successfully!" -ForegroundColor Green
} else {
    Write-Error "❌ Built APK not found at $builtApk"
}
