param(
 [Parameter(Mandatory)][ValidateSet('production','test')][string]$Target,
 [Parameter(Mandatory)][string]$ExpectedHeaderSha256,
 [string]$RecoveryDirectory='C:\Users\ajitr\NYSA-Recovery\20261031-dev251-preparation',
 [string]$DownloadedHeader='C:\Users\ajitr\Downloads\recovery.encrypted.header.json',
 [string]$DownloadedCiphertext='C:\Users\ajitr\Downloads\recovery.encrypted.bin'
)
$ErrorActionPreference='Stop'
if([IO.Path]::GetFullPath($RecoveryDirectory) -ne 'C:\Users\ajitr\NYSA-Recovery\20261031-dev251-preparation'){throw 'Unapproved destination'}
function Sha([byte[]]$Bytes){[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant()}
if((Get-FileHash -LiteralPath $DownloadedHeader -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedHeaderSha256){throw 'Server/local header hash mismatch'}
$header=[IO.File]::ReadAllText($DownloadedHeader)|ConvertFrom-Json
if($header.schema -ne 'nysa.encrypted-recovery.v2' -or $header.cipher -ne 'AES-256-GCM' -or $header.keyWrap -ne 'RSA-OAEP-SHA256'){throw 'Unexpected encryption format'}
$meta=$header.aad|ConvertFrom-Json
$expectedVersion=if($Target -eq 'production'){'2.1.0-rc.1'}else{'2.1.0-dev.248'}
$expectedMigrations=if($Target -eq 'production'){140}else{159}
if($meta.target -ne $Target -or $meta.version -ne $expectedVersion -or $meta.migrations -ne $expectedMigrations){throw 'Backup baseline mismatch'}
$ciphertext=[IO.File]::ReadAllBytes($DownloadedCiphertext)
if($ciphertext.Length -ne $header.ciphertextBytes -or (Sha $ciphertext) -ne $header.ciphertextSha256){throw 'Ciphertext integrity mismatch'}
$pk=$null;$key=$null;$plain=$null;$rsa=$null;$aes=$null
try{
 $pk=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $RecoveryDirectory 'recovery-key.pkcs8.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $rsa=[Security.Cryptography.RSA]::Create();$used=0;$rsa.ImportPkcs8PrivateKey($pk,[ref]$used)
 $key=$rsa.Decrypt([Convert]::FromBase64String($header.wrappedKey),[Security.Cryptography.RSAEncryptionPadding]::OaepSHA256)
 $plain=[byte[]]::new($ciphertext.Length);$aes=[Security.Cryptography.AesGcm]::new($key,16)
 $aes.Decrypt([Convert]::FromBase64String($header.iv),$ciphertext,[Convert]::FromBase64String($header.tag),$plain,[Text.Encoding]::UTF8.GetBytes($header.aad))
 if((Sha $plain) -ne $header.plaintextArchiveSha256){throw 'Authenticated archive hash mismatch'}
 $source=[IO.MemoryStream]::new($plain,$false);$gzip=[IO.Compression.GZipStream]::new($source,[IO.Compression.CompressionMode]::Decompress);$tar=[System.Formats.Tar.TarReader]::new($gzip)
 $expected=@{};foreach($component in $meta.components){$expected[$component.name]=$component}
 $verified=@();$seen=@{};$receipt=$null
 try{
  while($null -ne ($entry=$tar.GetNextEntry())){
   $name=$entry.Name -replace '^\./',''
   if($seen.ContainsKey($name) -or ($name -ne 'BACKUP_RECEIPT.json' -and -not $expected.ContainsKey($name))){throw 'Unexpected recovery archive entry'}
   $seen[$name]=$true;$buffer=[IO.MemoryStream]::new();$entry.DataStream.CopyTo($buffer);$bytes=$buffer.ToArray()
   try{
    if($name -eq 'BACKUP_RECEIPT.json'){$receipt=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json;continue}
    $hash=Sha $bytes;if($bytes.Length -ne $expected[$name].bytes -or $hash -ne $expected[$name].sha256){throw 'Recovery component hash mismatch'}
    if($name -eq 'database.dump' -and [Text.Encoding]::ASCII.GetString($bytes,0,5) -ne 'PGDMP'){throw 'Invalid PostgreSQL dump'}
    if($name.EndsWith('.tar.gz')){$nested=[IO.MemoryStream]::new($bytes,$false);$nestedGz=[IO.Compression.GZipStream]::new($nested,[IO.Compression.CompressionMode]::Decompress);try{$nestedGz.CopyTo([IO.Stream]::Null)}finally{$nestedGz.Dispose();$nested.Dispose()}}
    $verified+=@{name=$name;bytes=$bytes.Length;sha256=$hash;verified=$true}
   }finally{[Array]::Clear($bytes,0,$bytes.Length);$buffer.Dispose()}
  }
 }finally{$tar.Dispose();$gzip.Dispose();$source.Dispose()}
 if($verified.Count -ne 7 -or $receipt.target -ne $Target -or $receipt.version -ne $expectedVersion -or $receipt.migrations -ne $expectedMigrations -or -not $receipt.ownersAndGrantsIncluded){throw 'Recovery completeness mismatch'}
 $destination=Join-Path $RecoveryDirectory $Target
 if(Test-Path -LiteralPath $destination){throw 'Refusing recovery overwrite'}
 New-Item -ItemType Directory -Path $destination|Out-Null
 Copy-Item -LiteralPath $DownloadedHeader -Destination (Join-Path $destination 'recovery.encrypted.header.json')
 Copy-Item -LiteralPath $DownloadedCiphertext -Destination (Join-Path $destination 'recovery.encrypted.bin')
 $result=@{schema='nysa.local-recovery-verification.v2';result='PASSED';checkedAt=[DateTime]::UtcNow.ToString('o');target=$Target;version=$expectedVersion;migrations=$expectedMigrations;headerSha256=$ExpectedHeaderSha256;ciphertextSha256=$header.ciphertextSha256;authenticatedDecryption=$true;components=$verified;plaintextFilesWritten=$false;keyProtection='Windows DPAPI CurrentUser';quiesced=$false;freshMaintenanceWindowBackupRequired=$true;productionMutation=$false}
 $result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $destination 'VERIFICATION.json')
 $result|ConvertTo-Json -Depth 8
}finally{
 if($aes){$aes.Dispose()};if($rsa){$rsa.Dispose()}
 foreach($secret in @($pk,$key,$plain)){if($null -ne $secret){[Array]::Clear($secret,0,$secret.Length)}}
}
