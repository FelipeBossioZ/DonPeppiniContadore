param(
    [Parameter(Mandatory=$true)][ValidateSet('pull','push')][string]$Modo,
    [switch]$Silencioso
)

# ============================================================
#  Don Peppini Contadore - Sincronizacion de base de datos
#  pull: trae la copia mas nueva de la boveda (OneDrive)
#  push: cierra el sistema y sube la base local a la boveda
# ============================================================

$ErrorActionPreference = 'Stop'
$root       = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $root 'CONFIG_LOCAL.txt'
$localDb    = Join-Path $root 'backend\db.sqlite3'
$vaultName  = 'donpeppini_db.sqlite3'

function Show-Alert($msg, $tipo) {
    if ($Silencioso) { return }
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $icon = [System.Windows.Forms.MessageBoxIcon]::Information
        if ($tipo -eq 'warn')  { $icon = [System.Windows.Forms.MessageBoxIcon]::Warning }
        if ($tipo -eq 'error') { $icon = [System.Windows.Forms.MessageBoxIcon]::Error }
        [void][System.Windows.Forms.MessageBox]::Show($msg, 'Don Peppini Contadore', 'OK', $icon)
    } catch { }
}

function Ask-YesNo($msg) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $r = [System.Windows.Forms.MessageBox]::Show($msg, 'Don Peppini Contadore', 'YesNo', 'Warning', 'Button1')
        return ($r -eq [System.Windows.Forms.DialogResult]::Yes)
    } catch { return $false }
}

function Read-Vault {
    if (-not (Test-Path -LiteralPath $configPath)) { return $null }
    foreach ($line in (Get-Content -LiteralPath $configPath)) {
        if ($line -match '^\s*BOVEDA\s*=\s*(.+?)\s*$') {
            $p = $Matches[1]
            if (Test-Path -LiteralPath $p) { return $p }
            return $null
        }
    }
    return $null
}

function Step($pct, $txt) {
    Write-Host "  $txt"
    Write-Progress -Activity 'Base de datos Don Peppini' -Status $txt -PercentComplete $pct
    Start-Sleep -Milliseconds 200
}

function Get-Ts { return (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss') }

function Sync-SuffixFiles($srcBase, $dstBase) {
    foreach ($suf in @('-journal','-wal','-shm')) {
        $s = $srcBase + $suf
        $d = $dstBase + $suf
        if (Test-Path -LiteralPath $s) { Copy-Item -LiteralPath $s -Destination $d -Force }
        elseif (Test-Path -LiteralPath $d) { Remove-Item -LiteralPath $d -Force }
    }
}

function Stop-System {
    # Cierra las ventanas del sistema por titulo y libera los puertos
    taskkill /FI "WINDOWTITLE eq Don Peppini - Backend*"  /T /F 2>$null | Out-Null
    taskkill /FI "WINDOWTITLE eq Don Peppini - Frontend*" /T /F 2>$null | Out-Null
    foreach ($port in @(8000, 5173)) {
        try {
            $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
            foreach ($pidKill in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
                taskkill /PID $pidKill /T /F 2>$null | Out-Null
            }
        } catch { }
    }
    Start-Sleep -Seconds 2
}

function Backup-Local($prefix, $folder, $maxKeep) {
    if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }
    Copy-Item -LiteralPath $localDb -Destination (Join-Path $folder ($prefix + (Get-Ts) + '.sqlite3')) -Force
    $olds = Get-ChildItem -LiteralPath $folder -Filter ($prefix + '*.sqlite3') | Sort-Object Name
    if ($olds.Count -gt $maxKeep) {
        $olds | Select-Object -First ($olds.Count - $maxKeep) | Remove-Item -Force
    }
}

Write-Host ''
Write-Host '=================================================='
Write-Host '  DON PEPPINI - Sincronizacion de base de datos'
Write-Host '=================================================='

try {
    $vault = Read-Vault
    if (-not $vault) {
        Write-Host '  AVISO: La boveda no esta configurada o no esta disponible.' -ForegroundColor Yellow
        Write-Host '  Se usara la copia local. Configurala en CONFIG_LOCAL.txt'
        Show-Alert "No se encontro la boveda de OneDrive.`n`nSe trabajara con la copia local de esta PC.`n`nPara configurar la boveda, edita el archivo CONFIG_LOCAL.txt`nque esta en la carpeta del sistema." 'warn'
        exit 1
    }

    $vaultDb = Join-Path $vault $vaultName
    $vaultBk = Join-Path $vault 'backups'
    $localBk = Join-Path $root 'backend\db_backups'

    if ($Modo -eq 'pull') {
        # Seguridad: no bajar nada con el sistema abierto
        $busy = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
        if ($busy) {
            Show-Alert "El sistema esta abierto en esta PC.`nCierralo (o usa CERRAR) antes de iniciar de nuevo." 'warn'
            exit 2
        }

        $localTime = [datetime]::MinValue
        if (Test-Path -LiteralPath $localDb) { $localTime = (Get-Item -LiteralPath $localDb).LastWriteTime }
        $vaultTime = [datetime]::MinValue
        if (Test-Path -LiteralPath $vaultDb) { $vaultTime = (Get-Item -LiteralPath $vaultDb).LastWriteTime }

        if (-not (Test-Path -LiteralPath $vaultDb)) {
            # La boveda no tiene la DB principal. ¿Hay respaldos? -> ofrecer recuperacion
            $latestBk = $null
            if (Test-Path -LiteralPath $vaultBk) {
                $latestBk = Get-ChildItem -LiteralPath $vaultBk -Filter '*.sqlite3' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            }
            if ($latestBk) {
                if ($Silencioso) {
                    Write-Host '  AVISO: La boveda no tiene la DB principal, pero SI hay respaldos fechados.' -ForegroundColor Yellow
                    exit 1
                }
                $fecha = $latestBk.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
                $recuperar = Ask-YesNo "La boveda de OneDrive NO contiene la base de datos principal,`npero SI hay respaldos de seguridad.`n`nRespaldo mas reciente: $($latestBk.Name)`nFecha del respaldo: $fecha`n`nSI  = Recuperar ese respaldo y trabajar con el (recomendado si era tu informacion)`nNO = Continuar con la copia local de esta PC`n`nSi no esperabas esto, elige SI y revisa la papelera de OneDrive despues."
                if ($recuperar) {
                    Step 50 'Recuperando respaldo desde la boveda...'
                    Backup-Local 'pre_pull_' $localBk 5
                    Copy-Item -LiteralPath $latestBk.FullName -Destination $vaultDb -Force
                    Copy-Item -LiteralPath $latestBk.FullName -Destination $localDb -Force
                    Sync-SuffixFiles $vaultDb $localDb
                    Step 80 'Verificando integridad...'
                    if ((Get-FileHash -LiteralPath $latestBk.FullName -Algorithm MD5).Hash -ne (Get-FileHash -LiteralPath $localDb -Algorithm MD5).Hash) {
                        throw 'El respaldo recuperado no pasa la verificacion de integridad.'
                    }
                    Write-Progress -Activity 'Base de datos Don Peppini' -Completed
                    Write-Host '  LISTO: Respaldo recuperado. Trabajas con la informacion recuperada.' -ForegroundColor Green
                    Show-Alert "Respaldo RECUPERADO con exito.`n`nSe restauro: $($latestBk.Name)`n`nSe dejo como base principal en la boveda y como`ncopia local de esta PC. Ya puedes entrar al sistema." 'ok'
                    exit 0
                }
                Show-Alert "Continuaras con la copia LOCAL de esta PC.`n`nLa boveda sigue sin base principal: al cerrar con CERRAR,`nesta PC subira su copia como principal.`n`nSi eso no es lo que querias, no cierres y revisa OneDrive." 'warn'
                exit 1
            }
            else {
                Write-Host '  AVISO: La boveda no tiene base de datos ni respaldos (primera instalacion?).' -ForegroundColor Yellow
                Show-Alert "La boveda de OneDrive esta vacia: no tiene base de datos`nni respaldos.`n`nSi YA trabajabas con datos antes, NO continues:`nrevisa la papelera de OneDrive en onedrive.com.`n`nSi es una instalacion nueva desde cero, continua con confianza:`nse creara la base al aplicar migraciones." 'warn'
                exit 1
            }
        }

        Step 30 'Comparando copia local con la boveda...'

        if ($vaultTime -gt $localTime) {
            Step 55 'La boveda es mas nueva. Respaldo previo y descargando...'
            Backup-Local 'pre_pull_' $localBk 5
            Copy-Item -LiteralPath $vaultDb -Destination $localDb -Force
            Sync-SuffixFiles $vaultDb $localDb
            Step 85 'Verificando integridad de la copia...'
            if ((Get-FileHash -LiteralPath $vaultDb -Algorithm MD5).Hash -ne (Get-FileHash -LiteralPath $localDb -Algorithm MD5).Hash) {
                throw 'La copia descargada no coincide con la boveda (hash distinto).'
            }
            Write-Progress -Activity 'Base de datos Don Peppini' -Completed
            Step 100 'OK: Base de datos actualizada desde la boveda.'
            Write-Host '  LISTO: La copia local se actualizo desde OneDrive.' -ForegroundColor Green
            exit 0
        }
        elseif ($localTime -gt $vaultTime) {
            Write-Progress -Activity 'Base de datos Don Peppini' -Completed
            Step 100 'La copia local es mas nueva que la boveda.'
            Write-Host '  AVISO: La copia LOCAL es mas nueva (se conservara).' -ForegroundColor Yellow
            Write-Host '  Al terminar, usa CERRAR_DonPeppini.bat para subirla.'
            Show-Alert "La copia LOCAL de esta PC es mas nueva que la boveda.`n`nCopia local: $($localTime.ToString('yyyy-MM-dd HH:mm'))`nBoveda:      $($vaultTime.ToString('yyyy-MM-dd HH:mm'))`n`nSe trabajara con la copia local.`nAl terminar, usa CERRAR para subirla a OneDrive.`n`nSi esperabas datos que aun no estan aqui, otra PC`npuede no haber guardado con CERRAR todavia. Revisalo`nantes de sobreescribir." 'warn'
            exit 1
        }
        else {
            Write-Progress -Activity 'Base de datos Don Peppini' -Completed
            Step 100 'Todo sincronizado.'
            Write-Host '  OK: La copia local y la boveda ya estan sincronizadas.' -ForegroundColor Green
            exit 0
        }
    }

    if ($Modo -eq 'push') {
        Step 10 'Cerrando el sistema (backend y frontend)...'
        Stop-System

        if (-not (Test-Path -LiteralPath $localDb)) {
            Show-Alert "No existe base de datos local en esta PC. No hay nada que subir." 'error'
            exit 2
        }

        Step 30 'Respaldo local de seguridad...'
        Backup-Local 'pre_push_' $localBk 5

        Step 50 'Subiendo a la boveda (copia temporal + verificacion)...'
        $tmp = Join-Path $vault ($vaultName + '.tmp')
        Copy-Item -LiteralPath $localDb -Destination $tmp -Force
        if ((Get-FileHash -LiteralPath $tmp -Algorithm MD5).Hash -ne (Get-FileHash -LiteralPath $localDb -Algorithm MD5).Hash) {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
            throw 'La verificacion de la copia fallo. La boveda NO fue modificada.'
        }
        Move-Item -LiteralPath $tmp -Destination $vaultDb -Force
        Sync-SuffixFiles $localDb $vaultDb

        Step 75 'Guardando respaldo con fecha en la boveda...'
        if (-not (Test-Path -LiteralPath $vaultBk)) { New-Item -ItemType Directory -Force -Path $vaultBk | Out-Null }
        Copy-Item -LiteralPath $localDb -Destination (Join-Path $vaultBk ('donpeppini_db_' + (Get-Ts) + '.sqlite3')) -Force
        $olds = Get-ChildItem -LiteralPath $vaultBk -Filter 'donpeppini_db_*.sqlite3' | Sort-Object Name
        if ($olds.Count -gt 10) {
            $olds | Select-Object -First ($olds.Count - 10) | Remove-Item -Force
        }

        Step 95 'Verificacion final...'
        if ((Get-FileHash -LiteralPath $vaultDb -Algorithm MD5).Hash -ne (Get-FileHash -LiteralPath $localDb -Algorithm MD5).Hash) {
            throw 'La verificacion final fallo.'
        }
        Write-Progress -Activity 'Base de datos Don Peppini' -Completed

        Write-Host ''
        Write-Host '  ====================================================' -ForegroundColor Green
        Write-Host '    TODO OK - Base de datos guardada en la boveda' -ForegroundColor Green
        Write-Host '  ====================================================' -ForegroundColor Green
        Show-Alert "TODO OK`n`nLa base de datos se guardo correctamente en la`nboveda de OneDrive y quedo respaldada con fecha.`n`nPuedes cerrar esta PC con tranquilidad." 'ok'
        exit 0
    }
}
catch {
    Write-Progress -Activity 'Base de datos Don Peppini' -Completed
    Write-Host ("  ERROR: " + $_.Exception.Message) -ForegroundColor Red
    Show-Alert "ERROR al sincronizar la base de datos:`n`n$($_.Exception.Message)`n`nLa boveda conservo su version anterior intacta.`nIntenta de nuevo o revisa OneDrive/internet." 'error'
    exit 2
}
