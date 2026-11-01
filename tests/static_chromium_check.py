"""Run static-site acceptance in Chrome or Windows Chrome/Edge with Playwright.

python3 tests/static_chromium_check.py [--url https://rharriszzz.github.io/reversi/]
"""
import argparse
import json
import os
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright
from static_safari_check import check, ROOT

sys.path.insert(0, str(ROOT/'scripts/wasm'))
from browser import launch_browser


class Chrome:
    device = None
    dom_input = False

    def __init__(self, page, out, version, name='Chrome'):
        self.page, self.out = page, out
        self.capabilities = {'browserName':name,'browserVersion':version}

    def js(self, script, *args):
        return self.page.evaluate('(args)=>(function(){'+script+'}).apply(null,args)', list(args))

    def async_js(self, expression):
        return self.page.evaluate('()=>('+expression+')')

    def request(self, path, body):
        if path=='/url':
            self.page.goto(body['url'])
        elif path=='/refresh':
            self.page.reload()
        else:
            raise ValueError(path)

    def wait(self, condition, timeout=45):
        return self.page.wait_for_function(condition, timeout=timeout*1000)

    def select(self, selector, value):
        loc = self.page.locator(selector)
        if selector=='#review-slider':
            loc.fill(str(value))
        else:
            loc.select_option(str(value))

    def click(self, selector, touch=False):
        self.page.locator(selector).first.click()

    def screenshot(self, name):
        self.page.screenshot(path=str(self.out/name),full_page=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:8920/reversi/')
    parser.add_argument('--output',type=Path,default=ROOT/'.local-research/iphone-pages/chrome-static')
    args = parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser = launch_browser(p, channel='chrome')
        try:
            context = browser.new_context(viewport={'width':1280,'height':900})
            page = context.new_page()
            errors, failed, requests, responses = [], [], [], []
            page.on('pageerror',lambda error:errors.append(str(error)))
            context.on('requestfailed',lambda req:failed.append(req.url))
            context.on('request',lambda req:requests.append(req.url))
            context.on('response',lambda response:responses.append({'url':response.url,'status':response.status}))
            name = os.environ.get('REVERSI_WINDOWS_CHANNEL','chrome') if os.environ.get('REVERSI_WINDOWS_BROWSER')=='1' else 'Chrome'
            result = check(Chrome(page,args.output,browser.version,name),args.url)
            http_errors = [r for r in responses if r['status']>=400]
            assert not errors and not failed and not http_errors, (errors,failed,http_errors)
            assert all(url.startswith(args.url) for url in requests), requests
            result.update(errors=errors,failedRequests=failed,requestedURLs=sorted(set(requests)),
                          responses=responses,userAgent=page.evaluate('navigator.userAgent'))
            (args.output/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
            print(json.dumps({k:v for k,v in result.items() if k!='observations'}))
        finally:
            browser.close()


if __name__=='__main__':
    main()
