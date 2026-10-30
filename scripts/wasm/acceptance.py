"""48 complete visible UI games, independently replayed. Engineering only."""
from pathlib import Path
import json,sys,re,subprocess,tempfile,time,importlib.util,random,statistics
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.local-research/wasm-20261030'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
children=module('independent','scripts/native/verify.py').children
client=module('client','scripts/native/client.py')
SPY="""(()=>{
const Original=window.Worker;
window.__accept={created:0,terminated:0,events:[],errors:[],frames:[],start:performance.now()};
window.Worker=class extends Original {
 constructor(...args){super(...args);this.number=++__accept.created;this.jobs=new Map();this.addEventListener('message',({data})=>{
  const j=this.jobs.get(data.id);if(j){__accept.events.push({request:j.request,response:data,roundTripMs:performance.now()-j.start,worker:this.number});this.jobs.delete(data.id);}
 });}
 postMessage(request,...args){this.jobs.set(request.id,{request,start:performance.now()});return super.postMessage(request,...args);}
 terminate(){__accept.terminated++;return super.terminate();}
};
let last=performance.now();function frame(now){__accept.frames.push(now-last);last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
})()"""
def board_from_page(page):
 labels=page.locator('#board button').evaluate_all('(nodes)=>nodes.map(n=>n.getAttribute("aria-label"))')
 return [1 if 'black disc' in s else -1 if 'white disc' in s else 0 for s in labels]
def args(board,player,model):
 b=sum(1<<q for q,v in enumerate(board) if v==1);w=sum(1<<q for q,v in enumerate(board) if v==-1)
 return f'{b:x} {w:x} {player} {0 if model=="B" else 2}'
def replay(moves):
 b=[0]*64;b[28]=b[35]=1;b[27]=b[36]=-1;p=1;passes=0
 for item in moves:
  expected=children(b,p)
  if not expected:assert children(b,-p);p=-p;passes+=1;expected=children(b,p)
  assert item['player']==p and item['move'] in expected
  b=expected[item['move']];p=-p
 assert not children(b,1) and not children(b,-1)
 return b,passes

def main():
 with tempfile.TemporaryDirectory() as temp:
  server=subprocess.Popen([sys.executable,str(ROOT/'launch.py'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  try:
   url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
   with sync_playwright() as pw,client.NativeEngine() as native:
    browser=pw.chromium.launch(headless=False);context=browser.new_context(viewport={'width':1440,'height':1000});context.add_init_script(SPY)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url)
    page.locator('#analysis-depth').select_option('2');games=[];checks=0;start=time.monotonic()
    session=browser.new_browser_cdp_session();cpu_start=session.send('SystemInfo.getProcessInfo')
    memory=[];resources=[]
    schedule=[(model,budget,color,i) for i in range(6) for budget in [80,300] for model in ['B','P'] for color in [1,-1]]
    for game_index,(model,budget,color,rep) in enumerate(schedule):
     rng=random.Random(0x57415300+game_index)
     page.locator('#evaluator').select_option(model);page.locator('#computer-time').select_option(str(budget));page.locator('#human-color').select_option(str(color))
     page.evaluate('__accept.events=[];__accept.frames=[]')
     page.locator('#new-game').click()
     coaching_checks=0
     for decision in range(64):
      page.wait_for_function("()=>document.querySelector('#turn-title').textContent==='Game over'||(document.querySelector('#board button:not(:disabled)')&&!document.querySelector('#move-rows .empty-row'))",timeout=15000)
      if page.locator('#turn-title').inner_text()=='Game over':break
      b=board_from_page(page);legal=children(b,color)
      assert legal
      analysis=page.evaluate('''(board)=>__accept.events.filter(e=>e.response.type==='analyzed'&&JSON.stringify(e.request.board)===JSON.stringify(board)).at(-1)''',b)
      # If a previous game's same root was canceled, wait for this game's analysis.
      assert analysis,('missing current analysis',game_index,decision)
      a=analysis['response']['analysis'];assert a['model']==model and a['backend']=='WebAssembly' and a['depth']==2
      assert {r['move'] for r in a['results']}==set(legal)
      assert a['results'][0]['score']==max(r['score'] for r in a['results'])
      for row in a['results']:
       current=b;turn=color;placements=0
       for q in row['pv']:
        moves=children(current,turn)
        if q=='pass':assert not moves and children(current,-turn);turn=-turn;continue
        move=(int(q[1])-1)*8+ord(q[0])-65;assert move in moves
        current=moves[move];turn=-turn;placements+=1
       assert placements<=2
       if decision==0 or sum(v!=0 for v in b)>=54:
        child=legal[row['move']]
        value=native.request(f'windows {args(child,-color,model)} 1 1 1 -1000000000 1000000000')['values'][0]
        assert abs(row['score']+value)<=1e-10
        checks+=1;coaching_checks+=1
      # Main-thread rendering remains active while a timed worker is busy.
      moves=sorted(legal);choice=moves[rng.randrange(len(moves))]
      page.get_by_role('gridcell',name=f'{chr(65+choice%8)}{choice//8+1}: legal move',exact=True).click()
     expect(page.locator('#turn-title')).to_have_text('Game over')
     labels=page.locator('#history .history-item').all_text_contents()
     moves=[]
     for label in labels:
      m=re.fullmatch(r'\d+\. ([BW]) ([A-H])([1-8])',label);assert m,label
      moves.append({'player':1 if m[1]=='B' else -1,'move':(int(m[3])-1)*8+ord(m[2])-65})
     final,passes=replay(moves);assert final==board_from_page(page)
     telemetry=page.evaluate('({events:__accept.events,frames:__accept.frames,created:__accept.created,terminated:__accept.terminated})')
     plays=[e for e in telemetry['events'] if e['response']['type']=='played']
     assert plays
     for event in plays:
      r=event['response']['choice'];assert r['backend']=='WebAssembly' and r['model']==model
      assert r['move'] in children(event['request']['board'],event['request']['player'])
      if r['depth']==0:assert r['score'] is None and not r['exact']
      memory.append(r['memoryBytes'])
     frames=telemetry.pop('frames');events=telemetry.pop('events')
     entry=dict(index=game_index,model=model,budgetMs=budget,human=color,seed=0x57415300+game_index,moves=moves,board=final,forcedPasses=passes,coachingChecks=coaching_checks,plays=plays,frames={'count':len(frames),'maxMs':max(frames,default=0),'p95Ms':sorted(frames)[int(len(frames)*.95)] if frames else 0},workers=telemetry)
     games.append(entry)
     if game_index in [0,11,23,35,47]:
      info=session.send('SystemInfo.getProcessInfo');pids=[str(p['id']) for p in info['processInfo']]
      ps=subprocess.run(['ps','-o','rss=','-p',','.join(pids)],capture_output=True,text=True)
      resources.append({'game':game_index,'browserProcessRssKiB':sum(int(s) for s in ps.stdout.split()),'swap':subprocess.check_output(['sysctl','vm.swapusage'],text=True).strip()})
     (OUT/'acceptance-games.json').write_text(json.dumps({'browser':browser.version,'games':games,'elapsedSeconds':time.monotonic()-start,'checks':checks,'memoryBytes':sorted(set(memory)),'resources':resources}))
     print(json.dumps({'complete':game_index+1,'model':model,'budget':budget,'moves':len(moves),'passes':passes,'checks':checks,'elapsedSeconds':round(time.monotonic()-start,1)}),flush=True)
    cpu_end=session.send('SystemInfo.getProcessInfo');assert not errors,errors
    (OUT/'acceptance-summary.json').write_text(json.dumps({'browser':browser.version,'games':len(games),'checks':checks,'elapsedSeconds':time.monotonic()-start,'memoryBytes':sorted(set(memory)),'resources':resources,'cpuStart':cpu_start,'cpuEnd':cpu_end,'errors':errors},indent=2))
    page.screenshot(path=str(OUT/'acceptance-final.png'),full_page=True);browser.close()
  finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
