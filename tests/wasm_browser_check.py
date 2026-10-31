"""Real-browser Wasm integration checks. Test-only Playwright, no user storage."""
from pathlib import Path
import importlib.util
import ast
import json
import re
import subprocess
import sys
import tempfile
import os
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/wasm'))
from browser import launch_browser
spec=importlib.util.spec_from_file_location('independent_rules',ROOT/'scripts/native/verify.py')
independent=importlib.util.module_from_spec(spec);spec.loader.exec_module(independent)
OUT=ROOT/os.environ.get('REVERSI_WASM_OUTPUT','.local-research/wasm-20261030')
observer=ROOT/'scripts/wasm/fast-flips-production-acceptance.py'
SPY=next(ast.literal_eval(n.value) for n in ast.parse(observer.read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SPY' for t in n.targets))

def main():
    with tempfile.TemporaryDirectory(prefix='reversi-wasm-') as temp:
        server = subprocess.Popen([sys.executable, str(ROOT/'launch.py'), '--no-browser', '--port', '0', '--http-log', str(Path(temp)/'http.log')], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            url = re.search(r'http://127\.0\.0\.1:\d+/', server.stdout.readline()).group()
            with sync_playwright() as p:
                browser = launch_browser(p)
                context = browser.new_context()
                context.add_init_script(SPY)
                page = context.new_page()
                migrations=[]
                for preference, expected in [(None,'B'),('custom','B'),('B','B'),('L','L'),('P','P'),('unknown','B')]:
                    isolated=browser.new_context()
                    seeded=isolated.new_page();seeded.goto(url)
                    seeded.evaluate("""preference=>{
                        localStorage.setItem('reversi-coach-lab-learning-v1','historical saved bytes');
                        if(preference===null)localStorage.removeItem('reversi-engine-preferences-v1');
                        else localStorage.setItem('reversi-engine-preferences-v1',JSON.stringify({evaluator:preference,timeMs:'80'}));
                    }""",preference)
                    seeded.reload()
                    expect(seeded.locator('#evaluator')).to_have_value(expected)
                    expect(seeded.locator('#search-metrics')).to_contain_text(expected+' · WebAssembly')
                    expect(seeded.locator('#train, #export-model, #reset-model, #weights-table, .trainer-panel')).to_have_count(0)
                    assert seeded.evaluate("localStorage.getItem('reversi-coach-lab-learning-v1')")=='historical saved bytes'
                    seeded.reload();expect(seeded.locator('#evaluator')).to_have_value(expected)
                    migrations.append({'previous':preference,'selected':expected,'savedBytesPreserved':True})
                    isolated.close()
                errors=[]
                page.on('pageerror',lambda e: errors.append(str(e)))
                page.goto(url)
                expect(page.locator('#move-rows tr')).to_have_count(4)
                expect(page.locator('#evaluator')).to_have_value('B')
                assert page.evaluate('__accept.created')==3,'Only three player workers expected'
                for model in ['B','L','P']:
                    page.locator('#evaluator').select_option(model)
                    expect(page.locator('#search-metrics')).to_contain_text(f'{model} · WebAssembly')
                    expect(page.locator('#move-rows tr')).to_have_count(4)
                    page.locator('#move-rows tr').nth(1).click()
                    expect(page.locator('#interpretation')).to_contain_text('verified depth-3 line')
                expect(page.locator('#interpretation')).to_contain_text('pattern corrections')
                page.locator('#computer-time').select_option('80')
                page.get_by_role('gridcell',name='D3: legal move',exact=True).click()
                expect(page.locator('#history .history-item')).to_have_count(2)
                expect(page.locator('#play-metrics')).to_contain_text('P · WebAssembly')
                page.locator('#review-slider').fill('0')
                expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                page.locator('#review-slider').fill('2')
                page.locator('#undo').click()
                expect(page.locator('#history .history-item')).to_have_count(0)
                # Terminate busy search/initialization repeatedly, then verify final revision.
                for model in ['B','P','B','P']:
                    page.locator('#evaluator').select_option(model)
                    page.locator('#analysis-depth').select_option('6')
                    page.locator('#new-game').click()
                page.locator('#analysis-depth').select_option('2')
                expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                expect(page.locator('#depth-label')).to_have_text('Depth 2')
                page.reload()
                expect(page.locator('#evaluator')).to_have_value('P')
                expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                completed=[]
                for model in ['B','P']:
                    page.locator('#evaluator').select_option(model)
                    page.locator('#analysis-depth').select_option('2')
                    page.locator('#computer-time').select_option('80')
                    page.locator('#new-game').click()
                    for _ in range(64):
                        page.wait_for_function("document.querySelector('#turn-title').textContent === 'Game over' || document.querySelector('#board button:not(:disabled)')")
                        if page.locator('#turn-title').inner_text()=='Game over':break
                        page.locator('#board button:not(:disabled)').first.click()
                    expect(page.locator('#turn-title')).to_have_text('Game over')
                    # Replay every placement with the independent Python mailbox rules.
                    board=[0]*64;board[28]=board[35]=1;board[27]=board[36]=-1;turn=1;passes=0
                    for label in page.locator('#history .history-item').all_text_contents():
                        match=re.fullmatch(r'\d+\. ([BW]) ([A-H])([1-8])',label);assert match,label
                        moves=independent.children(board,turn)
                        if not moves:
                            turn=-turn;passes+=1;moves=independent.children(board,turn);assert moves
                        move=(int(match[3])-1)*8+ord(match[2])-65
                        assert (1 if match[1]=='B' else -1)==turn and move in moves
                        board=moves[move];turn=-turn
                    assert not independent.children(board,1) and not independent.children(board,-1)
                    expect(page.locator('#black-count')).to_have_text(str(board.count(1)))
                    expect(page.locator('#white-count')).to_have_text(str(board.count(-1)))
                    page.locator('#review-game').click()
                    expect(page.locator('#game-review')).to_contain_text('evaluator '+model+' · WebAssembly')
                    expect(page.locator('#game-review button').first).to_be_visible(timeout=120000)
                    expect(page.locator('#backend-status')).to_contain_text(f'{model} · WebAssembly')
                    assert 'saved version' not in page.locator('#game-review').inner_text()
                    completed.append({'model':model,'plies':page.locator('#history .history-item').count(),'reviewDecisions':page.locator('#game-review button').count(),'independentlyReplayed':True,'forcedPasses':passes})
                    page.locator('#game-review button').first.click()
                    expect(page.locator('#status')).to_contain_text('earlier position')
                # Confirm server MIME and distribution execution.
                wasm=page.evaluate("async()=>{const {default:m}=await import('./src/wasm/manifest.js');const r=await fetch('./src/wasm/'+m.module.replace('.mjs','.wasm'));return {type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength};}")
                assert wasm['type']=='application/wasm',wasm
                # Loading failure: equivalent B fallback visible; P refuses substitution.
                context=browser.new_context()
                context.route('**/*.wasm',lambda route:route.abort())
                failed=context.new_page();failed.goto(url)
                failed.locator('#evaluator').select_option('B')
                expect(failed.locator('#backend-status')).to_contain_text('JavaScript fallback')
                failed.locator('#evaluator').select_option('P')
                expect(failed.locator('#backend-status')).to_contain_text('No evaluator was substituted')
                failed.locator('#evaluator').select_option('B')
                expect(failed.locator('#search-metrics')).to_contain_text('B · JavaScript')
                context.close()
                # A stale/mixed manifest must fail closed, then recover on reload.
                mismatch=browser.new_context()
                def wrong_abi(route):
                    response=route.fetch()
                    route.fulfill(response=response,body=response.text().replace('"abi": 1','"abi": 999',1))
                mismatch.route('**/manifest.js',wrong_abi)
                stale=mismatch.new_page();stale.goto(url);stale.locator('#evaluator').select_option('P')
                expect(stale.locator('#backend-status')).to_contain_text('module version mismatch')
                mismatch.unroute('**/manifest.js',wrong_abi)
                stale.reload()
                expect(stale.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                mismatch.close()
                assert not errors,errors
                events=page.evaluate('__accept.events')
                assert events and all(e['request']['type'] in ['analyze','play','review'] and 'weights' not in e['request'] for e in events)
                output={'passed':True,'migrations':migrations,'completedGames':completed,'errors':errors,'browser':browser.version,'wasm':wasm,'checks':['B/L/P all-move coach','complete B/P games and model-consistent review','P timed play','undo/replay','rapid cancellation/model changes','reload/cache','B fallback','P fail closed','B recovery','browser ABI mismatch/reload recovery']}
                OUT.mkdir(parents=True,exist_ok=True)
                (OUT/'browser-integration.json').write_text(json.dumps(output,indent=2)+'\n')
                page.screenshot(path=str(OUT/'integration.png'),full_page=True)
                print(json.dumps(output))
                browser.close()
        finally:
            server.terminate();server.communicate(timeout=5)

if __name__=='__main__':main()
