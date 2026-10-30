"""Visible-main-thread responsiveness and cancellation trace, all frame gaps."""
from pathlib import Path
import json,sys,re,subprocess,tempfile,time
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/wasm-20261030'
def main():
 with tempfile.TemporaryDirectory() as temp:
  server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  try:
   url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
   with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=False);page=browser.new_page();page.goto(url);page.locator('#evaluator').select_option('P');page.locator('#analysis-depth').select_option('2');expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly')
    page.evaluate('''()=>{window.uiFrames=[];window.uiLongTasks=[];let last=performance.now();window.uiRunning=true;
     function frame(now){uiFrames.push(now-last);last=now;if(uiRunning)requestAnimationFrame(frame);}requestAnimationFrame(frame);
     new PerformanceObserver(list=>uiLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration,name:e.name})))).observe({type:'longtask',buffered:false});}''')
    cdp=page.context.new_cdp_session(page);complete={};cdp.on('Tracing.tracingComplete',lambda e:complete.update(e));cdp.send('Tracing.start',{'categories':'devtools.timeline,v8,disabled-by-default-devtools.timeline','transferMode':'ReturnAsStream'})
    page.locator('#computer-time').select_option('300');page.locator('#human-color').select_option('-1');actions=[]
    for i in range(20):
     start=time.monotonic();page.locator('#new-game').click();actions.append((time.monotonic()-start)*1000);page.wait_for_timeout(25)
    page.locator('#human-color').select_option('1');expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly');page.wait_for_timeout(300)
    observed=page.evaluate('()=>{uiRunning=false;return {frames:uiFrames,longTasks:uiLongTasks}}');cdp.send('Tracing.end')
    while 'stream' not in complete:page.wait_for_timeout(10)
    chunks=[]
    while True:
     part=cdp.send('IO.read',{'handle':complete['stream']});chunks.append(part['data'])
     if part.get('eof'):break
    cdp.send('IO.close',{'handle':complete['stream']});trace=''.join(chunks);(OUT/'ui-stress.trace.json').write_text(trace)
    events=json.loads(trace)['traceEvents'];mains={(e['pid'],e['tid']) for e in events if e.get('name')=='thread_name' and e.get('args',{}).get('name')=='CrRendererMain'}
    longest=sorted([{'name':e['name'],'durationMs':e['dur']/1000,'args':e.get('args',{})} for e in events if e.get('ph')=='X' and (e['pid'],e['tid']) in mains and e.get('dur',0)>20000],key=lambda e:-e['durationMs'])[:12]
    frames=observed['frames'];result={'browser':browser.version,'cancellations':20,'frameCount':len(frames),'maxAllFrameGapMs':max(frames),'p95AllFrameGapMs':sorted(frames)[int(len(frames)*.95)],'mainLongTasks':observed['longTasks'],'clickWallMs':actions,'longestMainTraceEvents':longest}
    (OUT/'ui-stress.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));browser.close()
  finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
