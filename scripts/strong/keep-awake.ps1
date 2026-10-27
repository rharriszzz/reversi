param([string]$ManifestPath, [string]$StatusPath, [double]$Hours = 6.05)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class ReversiStrongPower {
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern uint SetThreadExecutionState(uint flags);
}
'@
$deadline = [DateTime]::UtcNow.AddHours($Hours)
function Write-Status([string]$state, [string]$reason) {
    $data = @{pid=$PID;state=$state;reason=$reason;updatedUtc=[DateTime]::UtcNow.ToString('o');deadlineUtc=$deadline.ToString('o')}
    [IO.File]::WriteAllText($StatusPath, ($data | ConvertTo-Json))
}
try {
    if ([ReversiStrongPower]::SetThreadExecutionState([uint32]2147483649) -eq 0) { throw 'Power request failed' }
    Write-Status 'active' 'temporary system keep-awake; saved settings unchanged'
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Seconds 10
        try {
            $state = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
            if ($state.status -ne 'running') { break }
            # Release after a crashed coordinator, even if Windows stayed up.
            if (([DateTime]::UtcNow - [DateTime]::Parse($state.updated).ToUniversalTime()).TotalSeconds -gt 180) { break }
        } catch { break }
    }
} finally {
    [void][ReversiStrongPower]::SetThreadExecutionState([uint32]2147483648)
    Write-Status 'released' 'run stopped, stale heartbeat, or bounded power-request deadline'
}
