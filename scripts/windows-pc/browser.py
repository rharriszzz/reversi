"""Launch isolated actual Windows Chrome or Edge and connect from WSL2."""
import json
import os
import subprocess
import sys
import time
import shutil
import uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PS='/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'

def powershell(code):
    return subprocess.check_output([PS,'-NoProfile','-NonInteractive','-Command',code],text=True,timeout=30).strip()

class WindowsBrowser:
    def __init__(self,pw,kind=None):
        self.pw=pw;self.browser=None;self.proxy=None;self.profile=None
        self.kind=kind or os.environ.get('REVERSI_WINDOWS_CHANNEL','chrome')
        if self.kind not in ('chrome','edge'):raise ValueError('Windows browser must be chrome or edge')
    def __enter__(self):
        tag='reversi-pc-'+self.kind+'-'+uuid.uuid4().hex
        # Profile name is generated locally, never interpolated from user input.
        code='''$ErrorActionPreference='Stop'; $p=Join-Path $env:TEMP 'TAG';
$l=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0);$l.Start();$port=$l.LocalEndpoint.Port;$l.Stop();
$proc=Start-Process 'BROWSER_PATH' -ArgumentList @('--no-first-run','--no-default-browser-check',"--remote-debugging-port=$port","--user-data-dir=$p",'about:blank') -PassThru;
for($i=0;$i -lt 100;$i++){try{$v=Invoke-RestMethod "http://127.0.0.1:$port/json/version";[pscustomobject]@{pid=$proc.Id;profile=$p;version=$v}|ConvertTo-Json -Depth 5 -Compress;exit}catch{Start-Sleep -Milliseconds 100}};throw 'Browser CDP startup timeout' '''.replace('TAG',tag).replace('BROWSER_PATH',r'C:\Program Files\Google\Chrome\Application\chrome.exe' if self.kind=='chrome' else r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
        self.identity=json.loads(powershell(code))
        self.profile=Path(subprocess.check_output(['wslpath','-u',self.identity['profile']],text=True).strip())
        self.proxy=subprocess.Popen([sys.executable,str(Path(__file__).with_name('proxy.py')),self.identity['version']['webSocketDebuggerUrl']],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
        endpoint=self.proxy.stdout.readline().strip()
        self.browser=self.pw.chromium.connect_over_cdp(endpoint,timeout=30000)
        self.original_close=self.browser.close
        assert 'Windows NT' in self.identity['version']['User-Agent']
        return self.browser
    def __exit__(self,*args):
        if getattr(self,'closed',False):return
        self.closed=True
        if self.browser:
            try:self.browser.new_browser_cdp_session().send('Browser.close')
            except Exception:pass
            try:self.original_close()
            except Exception:pass
        if self.proxy:self.proxy.terminate();self.proxy.communicate(timeout=10)
        # Only the PID this launcher created, and only while its command line
        # still identifies our disposable profile. Never kill ordinary Chrome.
        if hasattr(self,'identity'):
            # After Browser.close, CIM can briefly return an exited process with
            # a null command line. It no longer identifies a live owned process.
            powershell("""$p=Get-CimInstance Win32_Process -Filter 'ProcessId = <PID>';
if($p -and $p.CommandLine -and $p.CommandLine.Contains('<PROFILE>')) {
 taskkill.exe /PID <PID> /T /F 2>&1 | Out-Null;
 if($LASTEXITCODE -ne 0) {
  $remaining=Get-CimInstance Win32_Process -Filter 'ProcessId = <PID>';
  if($remaining -and $remaining.CommandLine -and $remaining.CommandLine.Contains('<PROFILE>')){throw 'Owned test browser could not be stopped'}
 }
}; exit 0""".replace('<PID>',str(self.identity['pid'])).replace('<PROFILE>',self.identity['profile']))
        if self.profile:
            for _ in range(20):
                try:shutil.rmtree(self.profile);break
                except FileNotFoundError:break
                except OSError:time.sleep(.1)

if __name__=='__main__':
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw,WindowsBrowser(pw) as browser:
        page=browser.new_page();page.goto('about:blank');print(json.dumps({'browser':browser.version,'platform':page.evaluate('navigator.platform')}))
