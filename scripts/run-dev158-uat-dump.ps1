$ErrorActionPreference = 'Stop'

function Read-MaskedValue([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  return [System.Net.NetworkCredential]::new('', $secure).Password
}

$variableNames = @('NYSA_UAT158_EMAIL','NYSA_UAT158_PASSWORD')
try {
  $env:NYSA_UAT158_EMAIL = Read-MaskedValue 'Approved CRM Test Administrator email'
  $env:NYSA_UAT158_PASSWORD = Read-MaskedValue 'Approved CRM Test Administrator password'
  node scripts/dev158-manual-uat-provisioner.mjs --dump
  if ($LASTEXITCODE -ne 0) { throw "Dump command exited with code $LASTEXITCODE" }
}
finally {
  foreach ($name in $variableNames) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
}
