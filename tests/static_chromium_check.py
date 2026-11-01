"""Run the static-site acceptance against real Chrome using test-only Playwright.

python3 tests/static_chromium_check.py [--url https://rharriszzz.github.io/reversi/]
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from static_safari_check import check, ROOT


class Chrome:
    device = None
    dom_input = False

    def __init__(self, page, out, version):
        self.page, self.out = page, out
        self.capabilities = {'browserName':'Chrome','browserVersion':version}

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
        browser = p.chromium.launch(channel='chrome')
        page = browser.new_page(viewport={'width':1280,'height':900})
        errors, failed, requests = [], [], []
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('requestfailed',lambda req:failed.append(req.url))
        page.on('request',lambda req:requests.append(req.url))
        result = check(Chrome(page,args.output,browser.version),args.url)
        assert not errors and not failed, (errors,failed)
        assert all(url.startswith(args.url) for url in requests), requests
        result.update(errors=errors,failedRequests=failed,requestedURLs=sorted(set(requests)))
        (args.output/'receipt.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps({k:v for k,v in result.items() if k!='observations'}))
        browser.close()


if __name__=='__main__':
    main()
