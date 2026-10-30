"""Real-browser Wasm integration checks. Test-only Playwright, no user storage."""
from pathlib import Path
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
OUT=ROOT/os.environ.get('REVERSI_WASM_OUTPUT','.local-research/wasm-20261030')

def main():
    with tempfile.TemporaryDirectory(prefix='reversi-wasm-') as temp:
        server = subprocess.Popen([sys.executable, str(ROOT/'launch.py'), '--no-browser', '--port', '0', '--http-log', str(Path(temp)/'http.log')], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            url = re.search(r'http://127\.0\.0\.1:\d+/', server.stdout.readline()).group()
            with sync_playwright() as p:
                browser = launch_browser(p)
                page = browser.new_page(accept_downloads=True)
                errors=[]
                page.on('pageerror',lambda e: errors.append(str(e)))
                page.goto(url)
                expect(page.locator('#move-rows tr')).to_have_count(4)
                expect(page.locator('#evaluator')).to_have_value('custom')
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
                    page.locator('#review-game').click()
                    expect(page.locator('#game-review button').first).to_be_visible(timeout=120000)
                    expect(page.locator('#backend-status')).to_contain_text(f'{model} · WebAssembly')
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
                failed.locator('#evaluator').select_option('custom')
                expect(failed.locator('#search-metrics')).to_contain_text('custom · JavaScript')
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
                output={'passed':True,'browser':browser.version,'wasm':wasm,'checks':['B/L/P all-move coach','complete B/P games and model-consistent review','P timed play','undo/replay','rapid cancellation/model changes','reload/cache','B fallback','P fail closed','custom recovery','browser ABI mismatch/reload recovery']}
                (OUT/'browser-integration.json').write_text(json.dumps(output,indent=2)+'\n')
                page.screenshot(path=str(OUT/'integration.png'),full_page=True)
                print(json.dumps(output))
                browser.close()
        finally:
            server.terminate();server.communicate(timeout=5)

if __name__=='__main__':main()
