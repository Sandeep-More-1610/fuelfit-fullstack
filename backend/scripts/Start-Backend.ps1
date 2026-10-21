param([ValidateRange(1024,65535)][int]$Port = 8080)
$ErrorActionPreference = 'Stop'
if (-not $env:DB_USERNAME -or -not $env:DB_PASSWORD) { throw 'Set DB_USERNAME and DB_PASSWORD in this PowerShell session first. No password is stored in source.' }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to your Java 21 installation first.' }
$java = Join-Path $env:JAVA_HOME 'bin\java.exe'
$jar = Join-Path $PSScriptRoot '..\target\fuelfit-backend-phase2.jar'
if (-not (Test-Path -LiteralPath $jar)) { throw 'Build the backend with mvnw.cmd verify first.' }
# Java 21 AF_UNIX loopback initialization fails on this Windows machine.
# This workspace path makes Java use its built-in TCP fallback. No global settings change.
$socketDirectory = Join-Path $PSScriptRoot '..\target\fuelfit-local-socket-temporary-directory-for-java21-fallback'
& $java "-Djdk.net.unixdomain.tmpdir=$socketDirectory" -jar $jar --spring.profiles.active=mysql "--server.port=$Port"
exit $LASTEXITCODE
