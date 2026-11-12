"""Headless smoke test for Notewise production build."""
import json
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

PORT = 4173
URL = f"http://localhost:{PORT}/"

# Start vite preview in the background.
server = subprocess.Popen(
    ["npm", "run", "preview", "--", "--port", str(PORT), "--strictPort"],
    cwd="/home/hatch/workspace/hybridai-2026",
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)

try:
    # Wait for the server to answer.
    for _ in range(30):
        try:
            with urllib.request.urlopen(URL, timeout=2) as r:
                assert r.status == 200
                break
        except Exception:
            time.sleep(1)
    else:
        print("FAIL: preview server did not start")
        sys.exit(1)

    errors = []
    failed_requests = []
    # This VM's headless Chromium cannot reach ANY external host via the
    # proxy (ERR_TUNNEL_CONNECTION_FAILED on every external URL). Firebase
    # calls therefore fail at the network layer here — that is environmental,
    # not an app bug. Filter those out; a real pageerror or any other console
    # error still fails the test.
    def _is_env_noise(text):
        return "ERR_TUNNEL_CONNECTION_FAILED" in text

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and not _is_env_noise(m.text) else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("requestfailed", lambda r: failed_requests.append(r.url) if "googleapis.com" not in r.url and "google.com" not in r.url else None)
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2500)

        checks = {}
        checks["title"] = page.title()
        checks["engine_status"] = page.locator("#engine-label").inner_text()
        checks["mode_note"] = page.locator("#mode-note").inner_text()
        checks["notes_in_list"] = page.locator(".note-item").count()
        checks["editor_title"] = page.locator("#note-title").input_value()
        checks["editor_body_chars"] = len(page.locator("#note-body").input_value())

        # Click "Summarize on-device" and wait for a result.
        page.locator("#summarize-btn").click()
        page.wait_for_selector(".ai-output h3", timeout=15000)
        page.wait_for_timeout(500)
        checks["summary_heading"] = page.locator(".ai-output h3").first.inner_text()
        checks["result_badge"] = page.locator(".ai-output .badge").first.inner_text()
        checks["fallback_note_shown"] = page.locator(".fallback-note").count() > 0
        checks["summary_text_len"] = len(page.locator(".ai-output").inner_text())

        # Quiz flow.
        page.locator("#quiz-btn").click()
        page.wait_for_selector(".quiz-q", timeout=15000)
        checks["quiz_questions"] = page.locator(".quiz-q").count()
        page.locator(".quiz-opt").first.click()
        page.wait_for_timeout(300)
        checks["quiz_feedback"] = page.locator(".quiz-feedback").first.inner_text()[:80]

        # Research flow.
        page.locator("#research-btn").click()
        page.wait_for_selector(".ai-output h3", timeout=15000)
        checks["research_heading"] = page.locator(".ai-output h3").first.inner_text()

        page.screenshot(path="/home/hatch/workspace/hybridai-2026/smoke-test.png", full_page=True)
        browser.close()

    print(json.dumps({"checks": checks, "console_errors": errors, "failed_requests": failed_requests}, indent=2))
    if errors:
        print("FAIL: console errors present")
        sys.exit(1)
    print("SMOKE TEST PASSED")
finally:
    server.terminate()
