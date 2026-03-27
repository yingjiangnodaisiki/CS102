$ErrorActionPreference = "Stop"

$pgBin = "D:\somethings\tools\pgsql\bin"
$pgData = "D:\somethings\tools\pgdata"
$pgLog = Join-Path $pgData "postgres.log"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$pgIsReady = Join-Path $pgBin "pg_isready.exe"

if (!(Test-Path $pgCtl)) {
  throw "未找到 PostgreSQL 启动程序: $pgCtl"
}

if (!(Test-Path $pgData)) {
  throw "未找到 PostgreSQL 数据目录: $pgData"
}

Write-Host "检查 PostgreSQL 状态..."
& $pgIsReady -h localhost -p 5432 | Out-Null
$isReady = $LASTEXITCODE -eq 0

if (-not $isReady) {
  Write-Host "PostgreSQL 未启动，正在启动..."
  & $pgCtl -D $pgData -l $pgLog start | Out-Host

  Start-Sleep -Seconds 1
  & $pgIsReady -h localhost -p 5432 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL 启动失败，请查看日志: $pgLog"
  }
}

Write-Host "PostgreSQL 已就绪，启动 Next.js 开发服务..."
npm run dev
