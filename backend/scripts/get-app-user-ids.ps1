$ErrorActionPreference = 'Stop'

$baseUrl = $env:FMS_BASE_URL
if ([string]::IsNullOrWhiteSpace($baseUrl)) {
  $baseUrl = 'http://localhost:3000'
}

$question = $env:FMS_AI_QUESTION
if ([string]::IsNullOrWhiteSpace($question)) {
  $question = '최근 운동 패턴과 개선점을 알려줘.'
}

$startDate = $env:FMS_AI_START_DATE
$endDate = $env:FMS_AI_END_DATE
$maxRecords = $env:FMS_AI_MAX_RECORDS
$timeoutSec = $env:FMS_AI_TIMEOUT_SEC
if ([string]::IsNullOrWhiteSpace($timeoutSec)) {
  $timeoutSec = 60
}

$usersUrl = "$baseUrl/api/app-users?include_trainers=true"
$users = Invoke-RestMethod -Uri $usersUrl -Method Get

if (-not $users) {
  Write-Host 'No app users returned.'
  exit 0
}

$users |
  Select-Object id, username, name, member_name, is_trainer, is_active |
  Format-Table -AutoSize

$targetUser = $users | Where-Object { $_.username -eq 'test' -or $_.member_name -eq 'test' } | Select-Object -First 1
$selectedId = $targetUser.id
if ([string]::IsNullOrWhiteSpace($selectedId)) {
  Write-Host 'No app_user_id found for username or member_name = test.'
  exit 0
}

$payload = [ordered]@{
  app_user_id = $selectedId
  question    = $question
}

if (-not [string]::IsNullOrWhiteSpace($startDate)) {
  $payload.start_date = $startDate
}
if (-not [string]::IsNullOrWhiteSpace($endDate)) {
  $payload.end_date = $endDate
}
if (-not [string]::IsNullOrWhiteSpace($maxRecords)) {
  $payload.max_records = [int]$maxRecords
}

$analysisUrl = "$baseUrl/api/ai/workout-analysis"
Write-Host "Requesting analysis for app_user_id: $selectedId"
try {
  $analysis = Invoke-RestMethod -Uri $analysisUrl -Method Post -ContentType 'application/json' -TimeoutSec $timeoutSec -Body ($payload | ConvertTo-Json -Depth 6)
} catch {
  Write-Host "Analysis request failed: $($_.Exception.Message)"
  throw
}

Write-Host '--- Gemini Analysis ---'
Write-Host $analysis.analysis
