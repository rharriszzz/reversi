"""Optional real Chromium acceptance check; Playwright is a test-only dependency.

Run: python3 tests/browser_check.py (after installing Playwright + Chromium).
"""
from pathlib import Path
from argparse import ArgumentParser
import re
import subprocess
import sys
import tempfile

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--screenshot', type=Path, help='Optional path for a completed-game review screenshot')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='reversi-browser-') as temp:
        server = subprocess.Popen([sys.executable, str(ROOT / 'launch.py'), '--no-browser',
                                   '--port', '0', '--http-log', str(Path(temp) / 'http.log')],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            url = re.search(r'http://127\.0\.0\.1:\d+/', server.stdout.readline()).group()
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(accept_downloads=True)
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(url)
                expect(page.locator('#move-rows tr')).to_have_count(4)
                page.locator('#move-rows tr').nth(1).focus()
                page.keyboard.press('Enter')
                page.locator('#compare-move').select_option('37')
                expect(page.locator('#interpretation h3')).to_contain_text('versus F5')
                expect(page.locator('#interpretation')).to_contain_text('verified depth-3 line')
                page.locator('#computer-depth').select_option('2')
                page.get_by_role('gridcell', name='D3: legal move', exact=True).click()
                expect(page.locator('#history .history-item')).to_have_count(2)
                page.locator('#review-slider').fill('0')
                expect(page.locator('#status')).to_contain_text('earlier position')
                page.locator('#review-slider').fill('2')
                page.locator('#undo').click()
                expect(page.locator('#history .history-item')).to_have_count(0)
                page.locator('#human-color').select_option('-1')
                expect(page.locator('#turn-title')).to_have_text('White to move')
                expect(page.locator('#history .history-item')).to_have_count(1)
                # Rapid actions while searches are busy.
                page.locator('#analysis-depth').select_option('6')
                page.locator('#analysis-depth').select_option('2')
                page.locator('#new-game').click()
                expect(page.locator('#turn-title')).to_have_text('White to move')
                expect(page.locator('#depth-label')).to_have_text('Depth 2')
                page.locator('#train').click()
                expect(page.locator('#train')).to_be_enabled(timeout=120000)
                expect(page.locator('#training-status')).to_contain_text('challenger', ignore_case=True)
                with page.expect_download() as download:
                    page.locator('#export-model').click()
                import json
                exported = json.loads(Path(download.value.path()).read_text())
                assert exported['attempts'] == 1
                page.reload()
                expect(page.locator('#training-status')).to_contain_text('1 training attempts')
                page.locator('#computer-depth').select_option('2')
                page.locator('#analysis-depth').select_option('2')
                page.locator('#new-game').click()
                # Finish a real browser game and run post-game review.
                for _ in range(65):
                    page.wait_for_function("document.querySelector('#turn-title').textContent === 'Game over' || document.querySelector('#board button:not(:disabled)')")
                    if page.locator('#turn-title').inner_text() == 'Game over':
                        break
                    page.locator('#board button:not(:disabled)').first.click()
                expect(page.locator('#turn-title')).to_have_text('Game over')
                page.locator('#review-game').click()
                expect(page.locator('#game-review button').first).to_be_visible(timeout=120000)
                page.locator('#game-review button').first.click()
                expect(page.locator('#status')).to_contain_text('earlier position')
                if args.screenshot:
                    page.screenshot(path=str(args.screenshot), full_page=True)
                assert not errors, errors
                print('PASS: real Chromium: colors, comparison, keyboard, undo/replay, rapid changes, training, export/reload, full game and mistake review')
                print('Browser:', browser.version)
                browser.close()
        finally:
            server.terminate()
            _, stderr = server.communicate(timeout=5)
            assert not stderr, stderr


if __name__ == '__main__':
    main()
