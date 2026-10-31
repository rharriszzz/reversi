"""Short packaged-Wasm check in actual Mac Chrome or Windows Chrome/Edge.

Uses existing browser helpers and an isolated profile; no SDK or model export.
"""
import json,os,re,subprocess,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts/wasm'))
from browser import launch_browser
def main():
    manifest=json.loads((ROOT/'src/wasm/manifest.js').read_text().split('export default ')[1].strip().removesuffix(';'))
    with tempfile.TemporaryDirectory(prefix='reversi-production-') as temp:
        server=subprocess.Popen([str(ROOT/'start.sh'),'--no-browser','--port','0','--http-log',str(Path(temp)/'http.log')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env={**os.environ,'REVERSI_PYTHON':sys.executable})
        try:
            url=re.search(r'http://127\.0\.0\.1:\d+/',server.stdout.readline()).group()
            with sync_playwright() as pw:
                browser=launch_browser(pw);page=browser.new_page();errors=[];requests=[]
                page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));page.goto(url+'tests/safari_qualification.html');page.wait_for_function('typeof safariReset==="function"')
                init=page.evaluate('safariReset()');assert init['buildIdentity']==manifest['fingerprint'] and init['models']==manifest['models']
                digest=page.evaluate('''async(name)=>{const r=await fetch('/src/wasm/'+name);if(!r.ok)throw Error(r.status);const hash=await crypto.subtle.digest('SHA-256',await r.arrayBuffer());return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}''',manifest['module'].replace('.mjs','.wasm'))
                assert digest==manifest['artifacts'][manifest['module'].replace('.mjs','.wasm')]
                assert any(manifest['module'].replace('.mjs','.wasm') in r for r in requests) and not any('/.local-research/' in r for r in requests)
                agent=page.evaluate('navigator.userAgent')
                if os.environ.get('REVERSI_WINDOWS_BROWSER')=='1':assert 'Windows NT' in agent
                page.goto(url)
                for model in ['B','L','P']:
                    page.locator('#evaluator').select_option(model);expect(page.locator('#search-metrics')).to_contain_text(f'{model} · WebAssembly')
                page.locator('#computer-time').select_option('80');page.get_by_role('gridcell',name='D3: legal move',exact=True).click();expect(page.locator('#history .history-item')).to_have_count(2)
                page.reload();expect(page.locator('#search-metrics')).to_contain_text('P · WebAssembly')
                assert not errors,errors
                print(json.dumps({'passed':True,'browser':browser.version,'userAgent':agent,'buildIdentity':init['buildIdentity'],'models':init['models'],'wasmSha256':digest,'errors':errors}))
                browser.close()
        finally:server.terminate();server.communicate(timeout=5)
if __name__=='__main__':main()
