param([string]$Url, [string]$Profile)
$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$process = Start-Process -FilePath $chrome -ArgumentList @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', "--remote-debugging-port=$port", "--user-data-dir=`"$Profile`"", $Url) -PassThru
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$cancel = [System.Threading.CancellationTokenSource]::new(30000)
try {
    $page = $null
    for ($i = 0; $i -lt 100; $i++) {
        try {
            $tabs = Invoke-RestMethod "http://127.0.0.1:$port/json/list"
            $page = $tabs | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
            if ($page) { break }
        } catch { }
        Start-Sleep -Milliseconds 100
    }
    if (-not $page) { throw 'No Windows Chrome debugging target' }
    $null = $socket.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $cancel.Token).GetAwaiter().GetResult()
    $expression = @'
(async () => {
  for (let n = 0; n < 200; n++) {
    const rows = document.querySelectorAll('#move-rows tr');
    if (rows.length === 4 && document.querySelector('#interpretation').textContent.includes('verified depth-3 line')) {
      const depth = document.querySelector('#computer-depth');
      depth.value = '2'; depth.dispatchEvent(new Event('change'));
      document.querySelector('[aria-label="D3: legal move"]').click();
      for (let reply = 0; reply < 200; reply++) {
        if (document.querySelectorAll('#history .history-item').length === 2 &&
            document.querySelector('#turn-title').textContent === 'Black to move' &&
            document.querySelector('#interpretation').textContent.includes('verified depth-3 line'))
          return {title: document.title, rows: rows.length, plies: 2, url: location.href};
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Windows playing worker did not reply');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Windows browser app/worker did not finish: ' + document.body.innerText);
})()
'@
    $message = @{id=1; method='Runtime.evaluate'; params=@{expression=$expression; awaitPromise=$true; returnByValue=$true}} | ConvertTo-Json -Depth 6 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($message)
    $null = $socket.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cancel.Token).GetAwaiter().GetResult()
    do {
        $stream = [System.IO.MemoryStream]::new()
        do {
            $buffer = [byte[]]::new(65536)
            $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $cancel.Token).GetAwaiter().GetResult()
            $stream.Write($buffer, 0, $received.Count)
        } while (-not $received.EndOfMessage)
        $reply = [System.Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
        $stream.Dispose()
    } while ($reply.id -ne 1)
    if ($reply.result.exceptionDetails) { throw ($reply | ConvertTo-Json -Depth 10) }
    if ($reply.result.result.value.rows -ne 4 -or $reply.result.result.value.plies -ne 2) { throw 'Analysis or computer reply missing' }
    $version = Invoke-RestMethod "http://127.0.0.1:$port/json/version"
    $os = Get-CimInstance Win32_OperatingSystem
    Write-Output "Windows host: $($os.Caption), version $($os.Version), $($os.OSArchitecture)"
    Write-Output "PASS: actual Windows $($version.Browser) loaded $Url from WSL2, four analyzed moves, verified continuation and playing-worker reply"
} finally {
    $socket.Dispose()
    # Stop only processes using the disposable profile created by this test.
    Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($Profile) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $cancel.Dispose()
}
