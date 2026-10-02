# fal Value Map: handoff from a Claude Cowork chat

Written 2 Oct 2026. Read this file first, then run the build (section 6). Everything here was done in one earlier chat; this file replaces that conversation.

## 1. The person and the goal

- The user is Amir. English is not his first language, so use short, simple sentences and avoid jargon. His computer runs Windows, so give Windows-friendly commands (`python`, `py` or `python3`, whichever exists).
- He will build an app on fal.ai. He already has an account and an API key. His budget is very limited and he wants the best quality per dollar.
- Before any coding he wanted to know what each fal model costs and how good it is, in a way that lets him compare models. fal's site has no catalog with per-unit prices like OpenAI's.
- He then asked for "a well designed chart or an advanced thing I can work with", so the result is an interactive page plus CSV and JSON data.
- He has NOT said what the app does. The next step is to ask him, then shortlist 2 or 3 models and estimate his monthly cost with the planner tab. Do not write code for his own app until he answers and asks for it.
- A good later offer: a small script that refreshes prices through fal's pricing API (needs his key; he runs it locally; never ask him to paste the key into a chat; fal's docs use the `FAL_KEY` environment variable).

## 2. What exists

- Published page (private to him): https://claude.ai/artifact/KXAGUkRyW2y47x4mC2Yts7 (version 2, title "fal Value Map", icon "chart", capability `downloads`, runtime contract 0.2.66). It was published from `dist/fal_value_map.html`.
- If the chat has an Artifact tool: read the artifact first, then publish the rebuilt `dist/fal_value_map.html` with `url` set to the link above, so the link stays the same. Keep `capabilities: {downloads: true}`. The tool wraps the fragment in its own page skeleton.
- If it does not: open `dist/fal_value_map_standalone.html` in a browser. It is the same page with a plain skeleton. The in-page download buttons stay hidden there; use the CSV and JSON files instead.
- `dist/fal_models_catalog.csv` and `.json`: the same 60 models, ready to work with.
- `reference-screenshots/`: four renders of the finished page (images tab light and dark, text-to-video tab, cost planner).

## 3. Findings so far (what Amir was told)

Best value per job (price on fal, quality Elo):

| Job | Budget pick | Best value | Best quality |
|---|---|---|---|
| Images from text | FLUX.2 [dev] Turbo $0.008 (997); Krea 2 Medium Turbo $0.015 (1022) | Grok Imagine Image 2.0 $0.06 (1157) | GPT Image 2.5 about $0.21 (1195) |
| Image editing | Seedream 5.0 Lite $0.035 (1058) | Grok Imagine Image 2.0 $0.07 (1107) | GPT Image 2.5 about $0.21 (1182) |
| Text to video | H3 Max Turbo $0.04/s (not ranked) | MiniMax H3 Max $0.08/s at 768p (1134) | Wan 3.0 $0.20/s at 1080p (1157) |
| Image to video | H3 Max Turbo $0.04/s (not ranked) | MiniMax H3 Max $0.08/s (1195, number 1) | same model; next are Seedance 2.0 (1176, about $0.37/s) and Wan 3.0 (1164, $0.20/s) |
| Speech | xAI TTS $0.015 per 1k chars (1132) | Gemini 3.8 Flash-Lite TTS $0.03 (1240) | ElevenLabs Eleven v4 $0.08 (1320) |

- Biggest insight: in video, well-known models (Veo 3.1, Kling 3.0) are beaten by H3 Max, which scores higher at a lower or equal price. Veo 3.1 Lite costs the same $0.08/s and scores 949 against 1134.
- Best-value lines (computed by the page and by `build.py`): images = GPT Image 2.5, Grok Imagine Image 2.0, Nano Banana 2 Lite, Qwen Image 3, Krea 2 Medium Turbo, FLUX.2 [dev], FLUX.2 [dev] Turbo, Z-Image Turbo, FLUX.1 [schnell]. Editing = GPT Image 2.5, Nano Banana 2, Grok Imagine Image 2.0, Seedream 5.0 Lite. Text to video = Wan 3.0, H3 Max. Image to video = H3 Max only. Speech = Eleven v4, Gemini 3.8 Flash TTS, Gemini 3.8 Flash-Lite TTS, xAI TTS.
- Money tips given: resolution is the main price lever (1080p video costs twice 768p), draft cheap and render the final at higher quality, only successful outputs are billed, new accounts can run 2 requests at once, FLUX 3 has a 50% launch price until 8 Oct 2026.

## 4. How the data was made, and its caveats

Prices come from each model's own fal page ("Your request will cost ..." line), read on 2 Oct 2026. Eight headline prices were re-read on the live pages at the end and matched: Grok Imagine Image 2.0, Gemini 3.8 Flash-Lite TTS, xAI TTS, Krea 2 Medium Turbo, FLUX.2 [dev] Turbo, Wan 3.0, Eleven v4, and H3 Max at its regular rates (see the discount note below).

Units: images are per image at about 1 MP (1K); models billed per megapixel are rounded up. Video is per second at the resolution tier that matches the price Artificial Analysis (AA) lists for that model, so score and price describe the same setup; the chart multiplies by 60 for a per-minute axis. Speech is per 1,000 characters, roughly one minute of audio.

Quality is the AA arena Elo from blind human pairwise votes. Each board has its own scale, so compare only inside one category. Anchors: text-to-image has FLUX.2 [dev] fixed at 1000; text-to-video has Kling 3.0 Pro fixed at 1000. A gap of 25 points means the higher model wins about 54% of votes, 50 points about 57%, 100 points about 64%, 200 points about 76%. 95% intervals are roughly plus or minus 6 to 18 and are stored only where verified (`ci` is `null` otherwise).

"Best value" means no other ranked model has an equal or higher score at an equal or lower price (with at least one strictly better). `beatenBy` is the highest-scoring model that dominates it. Unranked models are listed in tables only.

Known weak spots:
- Estimated prices (`approx: true`, shown with a leading "≈"): GPT Image 2.5 and GPT Image 2, text-to-image and editing (about $0.21 for 1K high quality; billed by tokens at $30 per 1M image output tokens), Nano Banana 2 Lite (about $0.042, from $37.50 per 1M image tokens at roughly 1,120 tokens), and Seedance 2.0 image-to-video (fal says roughly $0.37/s).
- H3 Max and H3 Max Turbo: the data uses the regular rates (H3 Max $0.05/$0.08/$0.16 per second at 480p/768p/1080p; Turbo half of that). fal advertised 50% launch rates. fal's own press release (1 Sep 2026) said they end 7 Sep, the model pages say 30 Sep, and on 2 Oct the pages still showed the discounted numbers in their headline. If the discount is still live, real cost is half. Not resolved.
- Audio: Veo and Kling prices include generated audio (as AA lists them). fal's H3 Max page never mentions audio, so it is unconfirmed that H3 Max makes sound.
- Qwen Image 3: the Elo used (1077) may belong to a different variant than the cheap $0.04 (1K) endpoint; the Pro variant scores 1090. Seedance 2.0 image-to-video has no interval.
- Some models cost more on fal than on the maker's own API (for example Gemini TTS, about 2.7 times, and Google image models, about 10 to 20% more). This came from earlier research and was not re-checked in the last pass.
- Not covered at all: speech-to-text, music, 3D, avatars, upscaling, language models. Elo is general taste, not his use case; he should test his own prompts.
- Mistakes already fixed (do not reintroduce): per-5-second Seedance prices were wrong, use per-second; Qwen Image 3's $0.075 is the 2K price, 1K is $0.04; its text-to-image endpoint is `alibaba/qwen-image-3/text-to-image`; AA's intervals were once misread as plus or minus 99 to 119 (a text-merge error), the real range is about 6 to 18.

fal billing facts: output-based billing; only successful outputs are charged; server errors and queue time are free; credits are prepaid and expire 365 days after purchase; concurrency starts at 2 and rises to 40 as credits are bought. Live prices: `GET https://api.fal.ai/v1/models/pricing?endpoint_id=a,b,c` with the API key (up to 50 endpoint IDs per call; it cannot list every model). There is also an Estimate Cost API.

## 5. Code map

The page is one self-contained HTML file with no libraries (IBM Plex fonts come from Google Fonts, the only external host an Artifact page may use).

- `shell.html`: markup with three placeholders, `/*__CSS__*/`, `/*__DATA__*/`, `/*__JS__*/`.
- `style.css`: light and dark colour tokens, layout, chart, table and planner styles. Dark mode follows the system setting (and `data-theme`).
- `app1.js` to `app4.js`: ONE script (a single function wrapper) split over four files for editing. They must stay in this order; `build.py` joins them. Never run them separately.
  - `app1.js`: `CATS` (per-category labels, axis titles, footnotes and the editorial "picks"), `ORDER`, `BEST` (the strip at the top), helpers, data preparation (`x`, default price tier, who beats whom) and shared `state`.
  - `app2.js`: the SVG scatter chart (log price axis, quality axis, best-value staircase, label placement that avoids the line and other dots, sideways nudge for overlapping dots, hover, keyboard focus and tap tooltips).
  - `app3.js`: panels, picks cards, sortable table with expandable rows and copy-endpoint buttons, tabs, top strip, filters.
  - `app4.js`: cost planner (presets, per-month cost, budget meter, how long a one-time balance lasts, cost per user, saved in localStorage), CSV and JSON generation, `downloads` capability wiring, start-up.
- `data_t2i.json`, `data_edit.json`, `data_t2v.json`, `data_i2v.json`, `data_tts.json`: the catalogs. Fields per model: `id`, `name`, `maker`, `endpoint` (the fal endpoint ID), `price` (the price drawn on the chart; it must equal one of the `tiers` prices), `tiers` (`[{label, price}]`), `basis` (words describing which setting `price` is), `approx`, `elo` (`null` if not ranked), `ci` (`null` if unverified), `note`.
- Editing rule of thumb: change numbers in the data files; change wording, picks and footnotes in `app1.js` (`CATS`, `BEST`); change planner defaults in `app4.js` (`PLAN`). Every id used by picks or the planner must exist in the data.
- Design decisions to keep: blue marks are best value and gray marks are beaten (emphasis form); log price axis; quality axis does not start at zero (the page says so); the table is the chart's twin; phone layout has no sideways page scroll; hover, tap and keyboard all show the same readout.

## 6. Build and test

Needs Python 3 for the build; Node plus Playwright only for the tests.

```
python build.py            (or py build.py / python3 build.py)
```

This writes `dist/fal_value_map.html` (fragment for the Artifact tool), `dist/fal_value_map_standalone.html`, `dist/fal_models_catalog.csv` and `.json`, and prints each category's best-value line. The line "ids referenced by the page but not in the data" lists some element ids such as `p-total`; that is expected. A model id in that list would be a real bug. The build was checked byte for byte against the published version.

Optional tests (they open the standalone page in Chromium):

```
npm install
npx playwright install chromium
npm test
```

- `shoot.js`: screenshots of every tab (light, dark, phone), hover, selection, filters, budget, sorting, planner, presets and the download buttons (with a stand-in for the capability).
- `audit.js`: checks that no label sits on the best-value line, on another label or on a dot, at four screen widths.
- `dots.js`: checks that no two dots overlap. Known and accepted: at 390 px wide, the two best-value dots Nano Banana 2 Lite and Qwen Image 3 touch.
- `tap.js`: a phone tap shows the readout and a tap outside closes it.
- Offline runs print a "Failed to load resource" console error for Google Fonts; online there is none. Set `PLAYWRIGHT_PATH` or `CHROME_PATH` only if Playwright or Chromium live in a non-standard place.

## 7. Sources

- fal: https://fal.ai/pricing , https://fal.ai/docs/platform-apis/v1/models/pricing , https://fal.ai/docs/documentation/model-apis/faq and each model's page at `https://fal.ai/models/<endpoint id>`
- Artificial Analysis boards: https://artificialanalysis.ai/image/leaderboard/text-to-image , https://artificialanalysis.ai/image/leaderboard/editing , https://artificialanalysis.ai/video/leaderboard/text-to-video , https://artificialanalysis.ai/video/leaderboard/image-to-video , https://artificialanalysis.ai/text-to-speech/leaderboard
- H3 Max launch release: https://www.prnewswire.com/news-releases/fal-launches-h3-max-a-new-post-trained-video-model-with-frontier-quality-and-faster-than-real-time-generation-302866462.html

## 8. Suggested next steps, in order

1. Run the build, open the standalone page, and confirm it matches the screenshots.
2. Ask Amir what his app does (images, video, voice, or a mix) and roughly how much use he expects.
3. Narrow to 2 or 3 models and price his expected monthly use with the planner numbers.
4. Prices and scores go stale; re-check them against fal's pages before he buys credits, especially the H3 discount question.
5. Only when he asks: write the price-refresh script, extend the catalog (speech-to-text, language models, music, 3D), or start his app.
