$ErrorActionPreference = 'Stop'

function Read-MaskedValue([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  return [System.Net.NetworkCredential]::new('', $secure).Password
}

$variableNames = @(
  'NYSA_UAT158_CONFIRM',
  'NYSA_UAT158_EMAIL',
  'NYSA_UAT158_PASSWORD',
  'NYSA_UAT158_TEST_USER_PASSWORD'
)

try {
  $env:NYSA_UAT158_CONFIRM = 'CRM_TEST_DEV158_UAT_DATA_PROVISION_CONFIRMED'
  $env:NYSA_UAT158_EMAIL = Read-MaskedValue 'Approved CRM Test login email'
  $env:NYSA_UAT158_PASSWORD = Read-MaskedValue 'Approved CRM Test login password'
  $env:NYSA_UAT158_TEST_USER_PASSWORD = Read-MaskedValue 'Choose one temporary password (12+ characters) for all new UAT158 role users'

  node scripts/dev158-manual-uat-provisioner.mjs --apply
  if ($LASTEXITCODE -ne 0) {
    throw "Provisioning command exited with code $LASTEXITCODE"
  }
  node scripts/dev158-manual-uat-provisioner.mjs --dump
  if ($LASTEXITCODE -ne 0) {
    throw "Post-provisioning dump exited with code $LASTEXITCODE"
  }
}
finally {
  foreach ($name in $variableNames) {
    Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
  }
}
