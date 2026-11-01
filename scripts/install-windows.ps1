# Instala (ou atualiza) o AgileBox no Windows a partir dos Releases do GitHub.
#
#   irm https://raw.githubusercontent.com/pedroemilio17/agilebox-handoff/HEAD/scripts/install-windows.ps1 | iex
#
# Baixa o instalador mais novo, instala para o usuário atual (sem pedir administrador) e abre o app.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # o download fica muito mais rápido sem a barra do PowerShell

$repo = 'pedroemilio17/agilebox-handoff'
$exe = Join-Path $env:LOCALAPPDATA 'Programs\AgileBox\AgileBox.exe'

function Say($text) { Write-Host "› $text" -ForegroundColor Cyan }

Say 'Procurando a versão mais nova'
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$asset = $release.assets | Where-Object { $_.name -like '*-setup.exe' } | Select-Object -First 1
if (-not $asset) { throw "O Release $($release.tag_name) não tem instalador do Windows." }

$setup = Join-Path $env:TEMP $asset.name
Say "Baixando o AgileBox $($release.tag_name)"
Invoke-WebRequest $asset.browser_download_url -OutFile $setup

# Fecha a versão aberta (inclusive a escondida perto do relógio) para o instalador substituir os arquivos.
Get-Process AgileBox -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

Say 'Instalando'
Start-Process -FilePath $setup -ArgumentList '/S' -Wait
Remove-Item $setup -ErrorAction SilentlyContinue

if (-not (Test-Path $exe)) { throw "A instalação não terminou: $exe não foi encontrado." }
Say "Pronto: AgileBox $($release.tag_name) instalado. Atalhos no Menu Iniciar e na Área de Trabalho."
Say 'Atualizações: Ajustes → Atualizações.'
Start-Process $exe
