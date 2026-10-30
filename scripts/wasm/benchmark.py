"""Serial real-browser/native/JS measurements; run fixtures.mjs first."""
from pathlib import Path
import json,sys,re,subprocess,tempfile,time,importlib.util,os
from contextlib import ExitStack
from browser import launch_browser,check_resources
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/os.environ.get('REVERSI_WASM_OUTPUT','.local-research/wasm-20261030')
spec=importlib.util.spec_from_file_location('native_client',ROOT/'scripts/native/client.py');client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
fixtures=json.loads((OUT/'fixtures.json').read_text())
def resources():
 if os.environ.get('REVERSI_WINDOWS_BROWSER')!='1':return None
 spec=importlib.util.spec_from_file_location('pc_resources',ROOT/'scripts/windows-pc/resources.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 return m.latest()

def command(board,player,model):
    b=sum(1<<q for q,v in enumerate(board) if v==1);w=sum(1<<q for q,v in enumerate(board) if v==-1)
    return f'{b:x} {w:x} {player} {0 if model=="B" else 2}'

def main():
 with tempfile.TemporaryDirectory() as temp:
  server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  try:
   url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
   with sync_playwright() as pw,client.NativeEngine() as native,ExitStack() as extra:
    host=extra.enter_context(client.NativeEngine(os.environ['REVERSI_HOST_RECEIPT'])) if os.environ.get('REVERSI_HOST_RECEIPT') else None
    browser=launch_browser(pw);page=browser.new_page();page.goto(url+'tests/wasm_benchmark.html');page.wait_for_function('()=>typeof window.measure==="function"')
    measure=lambda op,**args:page.evaluate('([op,args])=>window.measure(op,args)',[op,args])
    cold=measure('init');rows=[];timed=[];boundary=[]
    for model in ['B','P']:
     for p in fixtures['positions']:
      for op in ['search','javascript']:measure(op,p=p,model=model,depth=3)
      measure('js-static',p=p,model=model,n=1000)
    for rep in range(5):
     check_resources()
     for model in ['B','P']:
      for p in fixtures['positions']:
       condition=resources()
       depth=7 if p['occupied']<28 else 6 if p['occupied']<52 else max(1,min(9,64-p['occupied']))
       results={}
       order=['native','wasm','javascript'] if rep%2==0 else ['javascript','wasm','native']
       if host:order=(['host']+order) if rep%2==0 else (order+['host'])
       args=command(p['board'],p['player'],model)
       for backend in order:
        if backend in ['native','host']:results[backend]=(native if backend=='native' else host).request(f'search {args} {depth} 0 1 0 0 0')
        else:results[backend]=measure('search' if backend=='wasm' else 'javascript',p=p,model=model,depth=depth)
       assert abs(results['native']['score']-results['wasm']['score'])<=1e-10
       assert abs(results['javascript']['score']-results['wasm']['score'])<=1e-10
       assert results['native']['nodes']==results['wasm']['nodes']
       if host:assert results['host']['score']==results['native']['score'] and results['host']['nodes']==results['native']['nodes']
       static={}
       for backend in order:
        static[backend]=(native if backend=='native' else host).request(f'evalbench {args} 100000') if backend in ['native','host'] else measure('static' if backend=='wasm' else 'js-static',p=p,model=model,n=100000)
       for r in static.values():assert abs(r['checksum']-static['native']['checksum'])<=1e-5
       rows.append(dict(rep=rep,model=model,position=p['id'],occupied=p['occupied'],depth=depth,results=results,static=static,resourcesBefore=condition,resourcesAfter=resources()))
     print(json.dumps({'fixedRepComplete':rep+1}),flush=True)
    for rep in range(3):
     check_resources()
     for model in ['B','P']:
      for budget in [80,300]:
       for p in fixtures['positions'][:6]:
        condition=resources()
        args=command(p['board'],p['player'],model)
        results={}
        order=['native','wasm','javascript'] if rep%2==0 else ['javascript','wasm','native']
        if host:order=(['host']+order) if rep%2==0 else (order+['host'])
        for backend in order:
         results[backend]=(native if backend=='native' else host).request(f'search {args} 0 {budget} 1 0 0 0') if backend in ['native','host'] else measure('search' if backend=='wasm' else 'javascript',p=p,model=model,timeMs=budget)
        native_r,wasm,js=(results[k] for k in ['native','wasm','javascript'])
        timed.append(dict(rep=rep,model=model,budgetMs=budget,position=p['id'],native=native_r,wasm=wasm,javascript=js,resourcesBefore=condition,resourcesAfter=resources()))
        if host:timed[-1]['host']=results['host']
     print(json.dumps({'timedRepComplete':rep+1}),flush=True)
    for model in ['B','P']:
     for p in fixtures['positions'][:2]:boundary.append(dict(model=model,position=p['id'],result=measure('boundary',p=p,model=model,n=1000)))
    (OUT/'browser-timings.json').write_text(json.dumps(dict(browser=browser.version,cold=cold,fixtures=fixtures,rows=rows,timed=timed,boundary=boundary)))
    profiles=[];cdp=browser.new_browser_cdp_session();targets=cdp.send('Target.getTargets')['targetInfos']
    target=next(t for t in targets if t['type']=='worker' and t['url'].endswith('wasm_benchmark_worker.js'))
    sid=cdp.send('Target.attachToTarget',{'targetId':target['targetId'],'flatten':False})['sessionId'];replies={};seq=0
    def receive(event):
     if event['sessionId']==sid:
      msg=json.loads(event['message'])
      if 'id' in msg:replies[msg['id']]=msg
    cdp.on('Target.receivedMessageFromTarget',receive)
    def rpc(method,params={}):
     nonlocal seq
     seq+=1;call=seq;cdp.send('Target.sendMessageToTarget',{'sessionId':sid,'message':json.dumps(dict(id=call,method=method,params=params))})
     deadline=time.monotonic()+10
     while call not in replies:
      if time.monotonic()>deadline:raise RuntimeError('Profiler response timeout')
      page.wait_for_timeout(10)
     msg=replies.pop(call)
     if 'error' in msg:raise RuntimeError(msg['error'])
     return msg.get('result',{})
    rpc('Profiler.enable');rpc('Profiler.setSamplingInterval',{'interval':100})
    for phase,index,depth in [('opening',1,8),('middle',3,7),('endgame',4,12)]:
     rpc('Profiler.start');work=measure('profile',p=fixtures['positions'][index],model='P',depth=depth)
     profile=rpc('Profiler.stop')['profile'];(OUT/f'wasm-{phase}.cpuprofile').write_text(json.dumps(profile))
     nodes={n['id']:n['callFrame'] for n in profile['nodes']};counts={}
     for sample in profile.get('samples',[]):
      frame=nodes[sample];name=frame['functionName'];counts[name]=counts.get(name,0)+1
     profiles.append(dict(phase=phase,work=work,selfSamples=counts,totalSamples=len(profile.get('samples',[]))))
    data=dict(browser=browser.version,cold=cold,fixtures=fixtures,hostBuild=host.receipt if host else None,rows=rows,timed=timed,boundary=boundary,profiles=profiles)
    (OUT/'browser-benchmarks.json').write_text(json.dumps(data))
    print(json.dumps(dict(browser=browser.version,fixed=len(rows),timed=len(timed),profiles=len(profiles),cold=cold)),flush=True)
    browser.close()
  finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
