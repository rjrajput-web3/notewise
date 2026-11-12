"""Mandatory self-audit for the Notewise redesign (spec sections 1-5).

Checks: build (done separately), desktop + mobile viewports, logo/favicon,
fonts actually loaded, 1px glass borders, canvas animation running,
fallback flow (AI endpoint blocked -> Live Preview Mode, ZERO raw error text),
presets (all tabs filled instantly), screenshots saved for review.
"""
import json
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

PORT = 4173
BASE = f"http://localhost:{PORT}/"
DIR = "/home/hatch/workspace/hybridai-2026"

FORBIDDEN = [
    "Model Busy", "503", "500", "404", "ERR_TUNNEL", "fetch-error",
    "Firebase App Check token is invalid", "no longer available",
    "Something went wrong", "Failed to fetch", "generateContent",
]

server = subprocess.Popen(
    ["npm", "run", "preview", "--", "--port", str(PORT), "--strictPort"],
    cwd=DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)

results = {}

def _is_env_noise(text):
    return "ERR_TUNNEL_CONNECTION_FAILED" in text

try:
    for _ in range(30):
        try:
            with urllib.request.urlopen(BASE, timeout=2) as r:
                assert r.status == 200
                break
        except Exception:
            time.sleep(1)
    else:
        print("FAIL: preview server did not start")
        sys.exit(1)

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- DESKTOP 1920x1080 ----------
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        errors, failed = [], []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" and not _is_env_noise(m.text) else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        # Collect EVERY failed request (no filtering): in this sandbox Chromium
        # cannot reach external hosts, so Firebase backend calls (Identity
        # Toolkit, Firestore sync) fail here but succeed in a real browser.
        # Anything outside those hosts would be a real bug.
        page.on("requestfailed", lambda r: failed.append(r.url))
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(2500)

        d = {}
        d["title"] = page.title()
        d["fonts"] = page.evaluate("""async () => {
            await document.fonts.ready;
            return {
              spaceGrotesk: document.fonts.check('700 16px "Space Grotesk"'),
              inter: document.fonts.check('400 16px "Inter"'),
              loadedFamilies: [...document.fonts].map(f => f.family + ' ' + f.weight)
            };
        }""")
        d["logo_visible"] = page.locator(".brand-mark svg").is_visible()
        logo_box = page.locator(".brand-mark svg").bounding_box()
        d["logo_size"] = [logo_box["width"], logo_box["height"]] if logo_box else None
        d["favicon_svg_ok"] = page.evaluate("async () => (await fetch('/favicon.svg')).status")
        d["favicon_png_ok"] = page.evaluate("async () => (await fetch('/favicon.png')).status")
        d["og_png_ok"] = page.evaluate("async () => (await fetch('/og.png')).status")
        d["glass_border"] = page.evaluate("""() => {
            const el = document.querySelector('.bento-card');
            const cs = getComputedStyle(el);
            return { width: cs.borderTopWidth, color: cs.borderTopColor, backdrop: cs.backdropFilter };
        }""")
        d["canvas_running"] = page.evaluate("""async () => {
            const c = document.querySelector('#hero-canvas');
            if (!c || !c.width) return { present: false };
            const a = c.toDataURL().length;
            await new Promise(r => setTimeout(r, 600));
            const b = c.toDataURL().length;
            return { present: true, w: c.width, h: c.height, frameBytesChanged: a !== b, a, b };
        }""")
        d["hero_preview_lines"] = page.locator("#preview-out-lines p").count()
        d["nav_links_visible"] = page.locator(".nav-links").is_visible()
        page.screenshot(path=f"{DIR}/audit-desktop-hero.png")
        results["desktop"] = d
        results["desktop_console_errors"] = errors
        results["desktop_failed_requests"] = failed
        results["desktop_failed_requests_expected_only"] = all(
            "identitytoolkit.googleapis.com" in u
            or "firestore.googleapis.com" in u
            or "google.com/images/cleardot.gif" in u
            for u in failed
        )

        # ---------- WORKSPACE (desktop): preset flow ----------
        page.locator("#workspace").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.locator('[data-preset="lecture-nn"]').first.click()
        page.wait_for_timeout(1200)
        w = {}
        w["summary_text_len"] = len(page.locator("#panel-summary").inner_text())
        w["summary_badge"] = page.locator("#panel-summary .badge").first.inner_text()
        page.locator('[data-tab="takeaways"]').click()
        page.wait_for_timeout(300)
        w["takeaways_items"] = page.locator("#panel-takeaways li").count()
        page.locator('[data-tab="flashcards"]').click()
        page.wait_for_timeout(300)
        w["quiz_questions"] = page.locator("#panel-flashcards .quiz-q").count()
        page.locator(".quiz-opt").first.click()
        page.wait_for_timeout(300)
        w["quiz_feedback"] = page.locator("#panel-flashcards .quiz-feedback").first.inner_text()[:60]
        page.locator('[data-tab="research"]').click()
        page.wait_for_timeout(300)
        w["research_headings"] = page.locator("#panel-research h3").count()
        w["ws_badge"] = page.locator("#ws-badge").inner_text()
        w["forbidden_text_present"] = [f for f in FORBIDDEN if f in page.locator("body").inner_text()]
        page.screenshot(path=f"{DIR}/audit-workspace.png", full_page=False)
        results["workspace_preset"] = w

        # ---------- FALLBACK FLOW: block the AI endpoint ----------
        page2 = browser.new_page(viewport={"width": 1280, "height": 900})
        errors2, errors2_urls, failed2_all = [], [], []
        def _on_console(m):
            if m.type == "error" and not _is_env_noise(m.text):
                errors2.append(m.text)
                try:
                    errors2_urls.append(m.location.get("url", "") if m.location else "")
                except Exception:
                    errors2_urls.append("")
        page2.on("console", _on_console)
        page2.on("pageerror", lambda e: errors2.append(str(e)))
        # Collect EVERY failed request. Expected failures here:
        # (a) the 6 intentionally aborted AI calls (3 retries x 2 models);
        # (b) Firebase backend calls (Identity Toolkit sign-up, Firestore sync
        #     channel, google.com cleardot beacons) which fail ONLY because this
        #     sandbox's Chromium cannot reach any external host (known VM proxy
        #     limitation — ERR_TUNNEL_CONNECTION_FAILED; they succeed in a real
        #     browser). A failed request from any other host would be a real bug.
        page2.on("requestfailed", lambda r: failed2_all.append(r.url))
        page2.route("**/firebasevertexai.googleapis.com/**", lambda route: route.abort())
        page2.route("**/generativelanguage.googleapis.com/**", lambda route: route.abort())
        page2.goto(BASE, wait_until="networkidle")
        page2.wait_for_timeout(1500)
        page2.locator("#new-note-btn").click()
        page2.wait_for_timeout(300)
        page2.locator("#note-body").fill(
            "Photosynthesis is how plants make food using sunlight, water and carbon dioxide. "
            "It takes place in the leaves, inside chloroplasts. The light reactions split water and "
            "release oxygen, while the Calvin cycle fixes carbon dioxide into glucose. Light intensity, "
            "carbon dioxide concentration and temperature all affect the rate."
        )
        page2.locator("#summarize-btn").click()
        # Retries + model fallback chain take ~15-25s when the endpoint is blocked.
        page2.wait_for_selector("#panel-summary .badge-demo", timeout=90000)
        page2.wait_for_timeout(2500)  # let the typewriter finish
        f = {}
        f["badge"] = page2.locator("#panel-summary .badge").first.inner_text()
        f["summary_text"] = page2.locator("#summary-text").inner_text()[:120]
        f["preview_note"] = page2.locator("#panel-summary .preview-note").inner_text() if page2.locator("#panel-summary .preview-note").count() else None
        body_text = page2.locator("body").inner_text()
        f["forbidden_text_present"] = [x for x in FORBIDDEN if x in body_text]
        f["raw_error_banner"] = page2.locator(".ai-error").count()
        f["failed_requests_all"] = failed2_all
        f["failed_requests_expected_only"] = all(
            ("generateContent" in u and ("firebasevertexai" in u or "generativelanguage" in u))
            or "identitytoolkit.googleapis.com" in u
            or "firestore.googleapis.com" in u
            or "google.com/images/cleardot.gif" in u
            for u in failed2_all
        )
        f["console_error_urls"] = errors2_urls
        f["console_errors_all_from_aborted_ai"] = (
            len(errors2) > 0
            and len(errors2_urls) == len(errors2)
            and all("generateContent" in (u or "") for u in errors2_urls)
        )
        results["fallback"] = f
        # The "Failed to load resource: net::ERR_FAILED" console lines are the
        # browser reporting the intentionally aborted AI calls. Filter them ONLY
        # when every console error is provably attributed (via location.url) to
        # one of those aborted generateContent calls.
        if f["console_errors_all_from_aborted_ai"]:
            errors2 = [e for e in errors2 if "Failed to load resource: net::ERR_FAILED" not in e]
        results["fallback_console_errors"] = errors2
        results["fallback_failed_requests"] = [u for u in failed2_all if not (
            "generateContent" in u or "identitytoolkit.googleapis.com" in u
            or "firestore.googleapis.com" in u or "google.com/images/cleardot.gif" in u
        )]
        page2.close()

        # ---------- MOBILE 390x844 ----------
        mob = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        errors3 = []
        mob.on("console", lambda m: errors3.append(m.text) if m.type == "error" and not _is_env_noise(m.text) else None)
        mob.on("pageerror", lambda e: errors3.append(str(e)))
        mob.goto(BASE, wait_until="networkidle")
        mob.wait_for_timeout(2000)
        m = {}
        m["logo_visible"] = mob.locator(".brand-mark svg").is_visible()
        m["nav_links_hidden"] = not mob.locator(".nav-links").is_visible()
        m["horizontal_overflow"] = mob.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")
        m["hero_h1"] = mob.locator(".hero h1").inner_text()[:60]
        mob.screenshot(path=f"{DIR}/audit-mobile-hero.png")
        mob.locator("#workspace").scroll_into_view_if_needed()
        mob.wait_for_timeout(500)
        mob.locator("#sidebar-open-btn").click()
        mob.wait_for_timeout(600)
        m["sidebar_opens"] = mob.locator("#sidebar").is_visible()
        m["preset_buttons"] = mob.locator(".side-preset-btn").count()
        # Realistic mobile flow: tap the preset INSIDE the open drawer.
        # (The section preset button is covered by the drawer while it is open;
        # loadPreset -> selectNote closes the drawer, so the result is visible.)
        mob.locator('.side-preset-btn[data-preset="meeting-atlas"]').first.click()
        mob.wait_for_timeout(1200)
        m["drawer_closed_after_preset"] = not mob.evaluate("() => document.getElementById('workspace-shell').classList.contains('sidebar-open')")
        m["preset_summary_len"] = len(mob.locator("#panel-summary").inner_text())
        mob.screenshot(path=f"{DIR}/audit-mobile-workspace.png")
        results["mobile"] = m
        results["mobile_console_errors"] = errors3

        browser.close()

    print(json.dumps(results, indent=2))
    all_errors = results.get("desktop_console_errors", []) + results.get("fallback_console_errors", []) + results.get("mobile_console_errors", [])
    if all_errors:
        print("FAIL: console errors present:", all_errors)
        sys.exit(1)
    print("AUDIT SCRIPT DONE")
finally:
    server.terminate()
