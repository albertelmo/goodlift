$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'

function Get-DotEnvValue {
  param(
    [string]$content,
    [string]$key
  )
  $pattern = "(?m)^\s*$key\s*=\s*(.+)\s*$"
  $match = [regex]::Match($content, $pattern)
  if (-not $match.Success) { return $null }
  $value = $match.Groups[1].Value.Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Trim('"')
  }
  if ($value.StartsWith("'") -and $value.EndsWith("'")) {
    $value = $value.Trim("'")
  }
  return $value
}

$envContent = ''
if (Test-Path $envPath) {
  $envContent = Get-Content -Path $envPath -Raw
}

$apiKey = $env:GEMINI_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  $apiKey = Get-DotEnvValue -content $envContent -key 'GEMINI_API_KEY'
}

if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Write-Host 'GEMINI_API_KEY가 필요합니다. 환경변수 또는 backend/.env에 설정하세요.'
  exit 1
}

$modelsUrl = "https://generativelanguage.googleapis.com/v1beta/models?key=$apiKey"
$modelsResponse = Invoke-RestMethod -Uri $modelsUrl -Method Get

$models = @()
if ($modelsResponse.models) {
  $models = $modelsResponse.models |
    Where-Object { $_.supportedGenerationMethods -contains 'generateContent' }
}

if (-not $models -or $models.Count -eq 0) {
  Write-Host 'generateContent를 지원하는 모델을 찾지 못했습니다.'
  exit 1
}

$preferred = $models | Where-Object { $_.name -match 'gemini-1\.5-flash' } | Select-Object -First 1
if (-not $preferred) {
  $preferred = $models | Where-Object { $_.name -match 'gemini-1\.5-pro' } | Select-Object -First 1
}
if (-not $preferred) {
  $preferred = $models | Where-Object { $_.name -match 'gemini' } | Select-Object -First 1
}

if (-not $preferred) {
  Write-Host '추천할 모델을 찾지 못했습니다.'
  exit 1
}

$modelName = $preferred.name
if ($modelName.StartsWith('models/')) {
  $modelName = $modelName.Substring(7)
}

if ([string]::IsNullOrWhiteSpace($envContent)) {
  $envContent = ''
}

if ($envContent -match "(?m)^\s*GEMINI_MODEL\s*=") {
  $envContent = [regex]::Replace($envContent, "(?m)^\s*GEMINI_MODEL\s*=.*$", "GEMINI_MODEL=$modelName")
} else {
  if (-not $envContent.EndsWith("`n") -and $envContent.Length -gt 0) {
    $envContent += "`n"
  }
  $envContent += "GEMINI_MODEL=$modelName`n"
}

Set-Content -Path $envPath -Value $envContent -Encoding UTF8

Write-Host "GEMINI_MODEL을 '$modelName'로 설정했습니다."
Write-Host '서버를 재시작한 뒤 분석 스크립트를 실행하세요.'
