"""Cold worker/module costs, warmed boundary and actual browser CPU accounting."""
from pathlib import Path
import json,sys,re,subprocess,tempfile,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/wasm-20261030'
def main():
 with tempfile.TemporaryDirectory() as temp:
  server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  try:
   url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group();fixtures=json.loads((OUT/'fixtures.json').read_text());rows=[]
   with sync_playwright() as pw:
    browser=pw.chromium.launch();cdp=browser.new_browser_cdp_session()
    for rep in range(5):
     context=browser.new_context();page=context.new_page();start=time.monotonic();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof window.measure==="function"')
     result=page.evaluate('()=>measure("init")');result['navigationWorkerAndModuleMs']=(time.monotonic()-start)*1000;result['rep']=rep
     boundary=[]
     for _ in range(30):
      t=time.monotonic();page.evaluate('(p)=>measure("boundary",{p,n:1})',fixtures['positions'][0]);boundary.append((time.monotonic()-t)*1000)
     result['pythonBrowserWorkerInspectRoundTripMs']=boundary;rows.append(result)
     context.close()
    context=browser.new_context();page=context.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof window.measure==="function"');page.evaluate('()=>measure("init")')
    before=cdp.send('SystemInfo.getProcessInfo');start=time.monotonic();work=page.evaluate('(p)=>measure("profile",{p,model:"P",depth:8})',fixtures['positions'][1]);wall=time.monotonic()-start;after=cdp.send('SystemInfo.getProcessInfo')
    old={p['id']:p['cpuTime'] for p in before['processInfo']};cpu=sum(p['cpuTime']-old.get(p['id'],p['cpuTime']) for p in after['processInfo'])
    result={'browser':browser.version,'rows':rows,'profileWork':work,'wallSeconds':wall,'aggregateBrowserProcessCpuSeconds':cpu,'cpuScope':'All existing browser processes, including worker/transport; not per-search thread CPU'}
    (OUT/'lifecycle.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));browser.close()
  finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
