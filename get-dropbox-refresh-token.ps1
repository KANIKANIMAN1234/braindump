# Dropbox authorization code -> refresh_token (interactive)
# Usage: powershell -ExecutionPolicy Bypass -File "...\get-dropbox-refresh-token.ps1"

Write-Host ""
Write-Host "=== Dropbox refresh_token ===" -ForegroundColor Cyan
Write-Host "Paste the code from: http://127.0.0.1/?code=..." -ForegroundColor Gray
Write-Host "Default App key: 87hds0ednbx9z0i (press Enter to use)" -ForegroundColor Gray
Write-Host ""

$code = Read-Host 'authorization code'
$appKey = Read-Host 'App key'
if ([string]::IsNullOrWhiteSpace($appKey)) { $appKey = '87hds0ednbx9z0i' }

$secure = Read-Host 'App secret (Dropbox Settings > Show)' -AsSecureString
$appSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)

$pair = "${appKey}:${appSecret}"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [Convert]::ToBase64String($bytes)

try {
  $response = Invoke-RestMethod -Method Post -Uri 'https://api.dropbox.com/oauth2/token' `
    -Headers @{ Authorization = "Basic $base64" } `
    -Body @{
      code         = $code.Trim()
      grant_type   = 'authorization_code'
      redirect_uri = 'http://127.0.0.1'
    }

  Write-Host ""
  Write-Host "OK! Set this as DROPBOX_REFRESH_TOKEN in Vercel:" -ForegroundColor Green
  Write-Host ""
  Write-Host $response.refresh_token
  Write-Host ""
} catch {
  Write-Host ""
  Write-Host "Error:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  Write-Host ""
  Write-Host "invalid_grant -> get a new code from Allow screen" -ForegroundColor Yellow
  Write-Host "invalid_client -> check App secret" -ForegroundColor Yellow
}

Read-Host 'Press Enter to exit'
