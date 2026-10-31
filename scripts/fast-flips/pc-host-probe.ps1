# Read-only Windows host inventory. No elevation, feature or settings changes.
$ErrorActionPreference = 'Continue'
$result = [ordered]@{}
$os = Get-CimInstance Win32_OperatingSystem
$result.os = $os | Select-Object Caption,Version,BuildNumber,TotalVisibleMemorySize,FreePhysicalMemory
$result.cpu = Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors
$result.wslVersion = (& wsl.exe --version 2>&1 | Out-String).Replace("`0",'')
$result.elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$names = @('wpr.exe','wpa.exe','xperf.exe','vtune.exe','cl.exe','clang++.exe','g++.exe','cmake.exe','Get-VM','Get-VMProcessor','Set-VMProcessor')
$result.commands = @($names | ForEach-Object {
    $command = Get-Command $_ -ErrorAction SilentlyContinue
    [pscustomobject]@{name=$_;available=[bool]$command;source=($command.Source -join ',')}
})
$result.hyperVModule = @(Get-Module -ListAvailable Hyper-V | Select-Object Name,Version)
if (Get-Command Get-VM -ErrorAction SilentlyContinue) {
    $result.managedVMs = (Get-VM 2>&1 | Out-String)
}
$wpr = Get-Command wpr.exe -ErrorAction SilentlyContinue
if ($wpr) {
    $result.wprSources = (& $wpr.Source -pmcsources 2>&1 | Out-String)
    $result.wprExitCode = $LASTEXITCODE
    $result.wprVersion = (Get-Item $wpr.Source).VersionInfo.FileVersion
}
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$result.vswhereAvailable = Test-Path $vswhere
if (Test-Path $vswhere) {
    $result.visualStudio = (& $vswhere -all -products '*' -format json | Out-String)
    $result.compilers = @(& $vswhere -all -products '*' -find 'VC\Tools\MSVC\**\bin\Hostx64\x64\cl.exe')
}
$roots = @('C:\Program Files (x86)\Intel\oneAPI\vtune','C:\Program Files\Intel\oneAPI\vtune','C:\msys64\ucrt64\bin\g++.exe','C:\msys64\mingw64\bin\g++.exe','C:\Program Files\LLVM\bin\clang++.exe','C:\Program Files (x86)\Windows Kits\10\Windows Performance Toolkit')
$result.existingToolLocations = @($roots | Where-Object {Test-Path $_})
try {
    $result.deviceGuard = Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard -ErrorAction Stop | Select-Object VirtualizationBasedSecurityStatus,SecurityServicesConfigured,SecurityServicesRunning
} catch { $result.deviceGuardError = $_.Exception.Message }
$result.processes = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 8 ProcessName,WorkingSet64,CPU)
$result | ConvertTo-Json -Depth 8
