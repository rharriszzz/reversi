$ErrorActionPreference = 'Stop'
$os=Get-CimInstance Win32_OperatingSystem
$m=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$cpu=Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'"
$processes=@(Get-Process)
$groups=@($processes | Group-Object ProcessName | ForEach-Object {
 [pscustomobject]@{name=$_.Name; count=$_.Count; workingSetSumBytes=($_.Group|Measure-Object WorkingSet64 -Sum).Sum; privateBytesSum=($_.Group|Measure-Object PrivateMemorySize64 -Sum).Sum}
})
[pscustomobject]@{
 at=(Get-Date).ToUniversalTime().ToString('o'); installedBytes=(Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum;
 visibleBytes=[long]$os.TotalVisibleMemorySize*1024; availableBytes=[long]$m.AvailableBytes;
 committedBytes=[long]$m.CommittedBytes; commitLimitBytes=[long]$m.CommitLimit;
 pagesInputPerSec=$m.PagesInputPersec; pagesOutputPerSec=$m.PagesOutputPersec; pageReadsPerSec=$m.PageReadsPersec;
 cpuPercent=$cpu.PercentProcessorTime;
 topMemory=@($groups|Sort-Object workingSetSumBytes -Descending|Select-Object -First 15);
 applications=@($groups|Where-Object {$_.name -match 'chrome|msedge|code|codex|vmmem|powershell|node'});
 activeProcesses=@(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object {$_.Name -ne '_Total' -and $_.Name -ne 'Idle'} | Sort-Object PercentProcessorTime -Descending | Select-Object -First 8 Name,PercentProcessorTime,WorkingSet,PrivateBytes)
}|ConvertTo-Json -Depth 5 -Compress
