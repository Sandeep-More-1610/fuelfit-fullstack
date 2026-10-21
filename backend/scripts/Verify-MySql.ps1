param([string]$MySqlExecutable = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe')
$ErrorActionPreference = 'Stop'
if (-not $env:DB_USERNAME -or -not $env:DB_PASSWORD) { throw 'Set DB_USERNAME and DB_PASSWORD in this PowerShell session first.' }
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { '3306' }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { 'fuelfit_db' }
$previousMySqlPassword = $env:MYSQL_PWD
try {
    $env:MYSQL_PWD = $env:DB_PASSWORD
    @'
SELECT DATABASE() AS selected_database, VERSION() AS mysql_version;
SELECT version, description, checksum, success FROM flyway_schema_history ORDER BY installed_rank;
SELECT COUNT(*) AS users FROM users;
SELECT COUNT(*) AS categories FROM categories;
SELECT COUNT(*) AS products, SUM(active) AS published_products FROM products;
SELECT COUNT(*) AS inventory_rows, SUM(quantity) AS total_stock FROM inventory;
SELECT COUNT(*) AS cart_items FROM cart_items;
SELECT COUNT(*) AS orders FROM orders;
SELECT COUNT(*) AS saved_addresses FROM addresses;
SELECT COUNT(*) AS wishlist_items FROM wishlist_items;
SELECT COUNT(*) AS newsletter_subscribers FROM newsletter_subscribers;
'@ | & $MySqlExecutable --no-defaults "--host=$dbHost" "--port=$dbPort" "--user=$env:DB_USERNAME" --batch $dbName
    if ($LASTEXITCODE -ne 0) { throw 'Read-only database verification failed.' }
} finally {
    if ($null -eq $previousMySqlPassword) { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
    else { $env:MYSQL_PWD = $previousMySqlPassword }
}
