"""Attempt actual Safari qualification without enabling/changing automation settings."""
from pathlib import Path
import json,sys,re,subprocess,tempfile,time,socket,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/wasm-20261030'
def main():
 if sys.platform!='darwin' or not Path('/usr/bin/safaridriver').exists():
  result={'available':False,'reason':'SafariDriver is unavailable on this host'}
  OUT.mkdir(parents=True,exist_ok=True);(OUT/'safari.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));return
 with tempfile.TemporaryDirectory() as temp:
  server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  driver=subprocess.Popen(['/usr/bin/safaridriver','-p',str(port)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  base=f'http://127.0.0.1:{port}';session=None;result={}
  def req(path,body=None,method=None):
   data=None if body is None else json.dumps(body).encode()
   try:
    with urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers={'Content-Type':'application/json'},method=method),timeout=20) as r:return json.load(r)
   except urllib.error.HTTPError as e:return json.load(e)
  try:
   for _ in range(100):
    try:req('/status');break
    except urllib.error.URLError:time.sleep(.05)
   reply=req('/session',{'capabilities':{'alwaysMatch':{'browserName':'safari'}}})
   if 'sessionId' not in reply.get('value',{}):result={'available':False,'reply':reply}
   else:
    session=reply['value']['sessionId'];prefix=f'/session/{session}'
    result={'available':True,'capabilities':reply['value']['capabilities'],'checks':[]}
    req(prefix+'/url',{'url':url})
    def js(script):return req(prefix+'/execute/sync',{'script':script,'args':[]}).get('value')
    for model in ['B','P']:
     js(f"const e=document.querySelector('#evaluator');e.value='{model}';e.dispatchEvent(new Event('change'));")
     deadline=time.monotonic()+20
     while time.monotonic()<deadline:
      text=js("return document.querySelector('#search-metrics').textContent")
      if f'{model} · WebAssembly' in (text or ''):break
      time.sleep(.05)
     else:raise RuntimeError(f'Safari {model} coach failed: {text}')
     result['checks'].append(f'{model} coaching')
    js("const t=document.querySelector('#computer-time');t.value='80';t.dispatchEvent(new Event('change'));document.querySelector('#board button:not(:disabled)').click()")
    deadline=time.monotonic()+20
    while time.monotonic()<deadline:
     if js("return document.querySelectorAll('#history .history-item').length")>=2:break
     time.sleep(.05)
    else:raise RuntimeError('Safari P play did not reply')
    assert 'P · WebAssembly' in js("return document.querySelector('#play-metrics').textContent")
    result['checks'].append('P timed reply')
  except Exception as e:result={'available':bool(session),'error':str(e),'partial':result}
  finally:
   if session:req(f'/session/{session}',method='DELETE')
   driver.terminate();driver.communicate(timeout=5);server.terminate();server.communicate(timeout=5)
  (OUT/'safari.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
