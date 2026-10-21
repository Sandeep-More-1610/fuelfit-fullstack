param([Parameter(Mandatory=$true)][string]$Email)
$ErrorActionPreference = 'Stop'
if (-not $env:DB_USERNAME -or -not $env:DB_PASSWORD) { throw 'Set DB_USERNAME and DB_PASSWORD in this PowerShell session first.' }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to your Java 21 installation first.' }
$java = Join-Path $env:JAVA_HOME 'bin\java.exe'
$jar = Join-Path $PSScriptRoot '..\target\fuelfit-backend.jar'
if (-not (Test-Path -LiteralPath $jar)) { throw 'Build the backend with mvnw.cmd verify first.' }
$previousAdminEmail = $env:ADMIN_EMAIL
try {
    $env:ADMIN_EMAIL = $Email
    & $java -jar $jar --spring.profiles.active=mysql,admin-provision
    if ($LASTEXITCODE -ne 0) { throw 'Provisioning failed; check the connection and existing account email.' }
} finally {
    if ($null -eq $previousAdminEmail) { Remove-Item Env:ADMIN_EMAIL -ErrorAction SilentlyContinue }
    else { $env:ADMIN_EMAIL = $previousAdminEmail }
}
