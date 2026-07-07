# Feedbacks - 26 Feb 2026

## Issues Fixed

| # | Issue | Status |
|---|-------|--------|
| 1 | Conceptual Framework print/export only captures center portion — backgrounds and colors missing in PDF | Fixed |
| 2 | CF editor showing `<>` instead of placeholder text (e.g., `<<Topic 1>>`) | Fixed |
| 3 | CF editor text overflowing container boxes in all 3 templates | Fixed |
| 4 | CF editor topics and frameworks empty when LLM fails to structure data | Fixed |
| 5 | Mosaic (Polygon) template print preview missing all colored polygon backgrounds | Fixed |
| 6 | Page refresh jumps to last created session instead of staying on current session | Fixed |
| 7 | Higher Ed Faculty routing — restored dashboard access for all teachers/faculty | Fixed |
| 8 | Inactive students showing same as active in Teacher Dashboard | Fixed |
| 9 | "Average Progress by Class" chart cluttered — limited to 5 most recent classes | Fixed |
| 10 | Step 1 tick mark not showing when step is active and completed | Fixed |
| 11 | Video embed dark background showing in light mode | Fixed |
| 12 | Step 1 worldview selection not marking step as completed (race condition) | Fixed |
| 13 | Chat auto-scroll jumps to bottom instead of start of AI response | Fixed |
| 14 | Worldview selection message indistinguishable from regular chat messages | Fixed |
| 15 | Guided tour scrolls the page when stepping through highlights | Fixed |
| 16 | AI chat responses include "Quick references from our notes:" section at the end | Fixed |
| 17 | Step 4 methodology locked to worldview — no option to choose an alternative approach | Fixed |

## Details

### 1. Conceptual Framework Print/Export
- Browser print CSS was not preserving background colors and complex layouts
- Replaced native `window.print()` with **html2canvas** library that captures the diagram as a high-resolution image
- Works consistently across all 3 templates (Mosaic, Boxed, Extended)

### 2. Placeholder Text Rendering
- `<<Topic 1>>` was being parsed as HTML tags inside `dangerouslySetInnerHTML`
- Fixed by escaping `<` and `>` to `&lt;` / `&gt;` in the editable text component

### 3. Text Overflow in CF Templates
- Added `overflow: hidden` and `max-height` constraints to all text containers across Mosaic, Boxed, and Extended templates

### 4. Empty Topics/Frameworks Fallback
- When the LLM fails to return structured data, the raw text fields now get split into individual lines as a fallback

### 5. Mosaic Print Colors
- `html2canvas` does not support CSS `clip-path` — the 9 polygon backgrounds were invisible
- Replaced all CSS clip-path divs with a single inline **SVG** containing filled polygons
- Colors now render correctly in both screen and print

### 6. Session Persistence on Refresh
- Active `sessionId` is now saved to `localStorage`
- On page load, the app restores the saved session instead of defaulting to the most recent one

### 7. Higher Ed Faculty Dashboard
- All teachers and faculty (including Higher Ed) now have access to the class dashboard

### 8. Inactive Student Styling
- Inactive students now appear dimmed (reduced opacity) in the Teacher Dashboard table
- "Not Started" badge added for students with no activity

### 9. Chart — 5 Most Recent Classes
- "Average Progress by Class" bar chart now shows only the 5 most recently active classes instead of all classes

### 10. Step 1 Completion Tick Mark
- When a step was both active (currently selected) and completed, the green checkmark badge was hidden
- The active style (`::after { display: none }`) was overriding the completed checkmark
- Fixed by excluding completed cards from the hide rule: `--active:not(--completed)::after`
- Progress bar dot also now shows green (completed) instead of blue (active) when both apply

### 11. Video Embed Background in Light Mode
- Video iframe was stretching to fill the full panel height, exposing the Synthesia player's dark letterbox bars
- Set container background to white in light mode (black in dark mode)
- Constrained video container to 16:9 aspect ratio to match the player and eliminate letterboxing

### 12. Step 1 Worldview Completion Race Condition
- Selecting a worldview fired two competing API calls (`/step/save` and `/worldview/set`) simultaneously
- `/step/save` could overwrite the `worldview_id` key that `/worldview/set` just wrote
- Fixed by removing the redundant `/step/save` call — only `/worldview/set` saves to backend now

### 13. Chat Auto-Scroll Behavior
- Previously scrolled to the very bottom on every history update, hiding the start of long AI responses
- Now scrolls to the **start** of the AI response when streaming begins
- Stays in place during and after streaming — no more snapping to the bottom

### 14. Worldview Selection Event in Chat
- Added a centered system event badge (e.g., "Worldview selected: Pragmatist") in the chat when a worldview is chosen
- Visually separates automatic worldview messages from regular user-initiated conversations

### 15. Guided Tour Page Scrolling
- The react-joyride guided tour was scrolling the viewport to each highlighted element as the user advanced through steps
- Replaced `scrollToFirstStep` with `disableScrolling` on the Joyride component so the page stays in place

### 16. RAG "Quick References" in Chat Responses
- The LLM system prompt instructed the AI to append a "**Quick references from our notes:**" section with bullet points sourced from RAG snippets at the end of every response (Steps 4-9)
- Removed that instruction entirely and added a rule to never include article citations or reference sections
- Legacy messages in chat history that contain the section are still stripped so the LLM doesn't mimic the old pattern

### 17. Step 4 Methodology Override
- Previously, the worldview selection locked students into a single methodology path (e.g., positivist always got quantitative-only designs at Step 4)
- Now **all students** see both Quantitative and Qualitative design options side-by-side at Step 4
- A "Recommended" badge highlights the methodology aligned with their worldview (e.g., Quantitative for positivist/post-positivist, Qualitative for constructivist/transformative)
- Students can override the recommendation and pick the alternative methodology
- Steps 5-9 dynamically resolve to match the chosen methodology, including LLM guidance
- Pragmatist (mixed-methods) students see both options without a recommendation, same as before

## Compatibility Note
- **Conceptual Framework editor** works best on desktop and iPad (landscape). Phone screens are too small for the diagram layout.

## Infrastructure & Scaling Work

### LLM Backend Migration (Ollama → vLLM)
- Backend refactored to support both Ollama and vLLM with automatic failover via `LLM_BACKEND` environment variable
- Dual-backend `call_llm()` and streaming functions added in [app_chat.py](app_chat.py) — no frontend changes needed
- Configurable via [ecosystem.config.cjs](ecosystem.config.cjs); switching backends is a one-line env change
- Health endpoint now reports status of both backends
- [benchmark_llm.py](benchmark_llm.py) script added to measure concurrent user load

### Load Testing Results (measured on Lambda)
| Users | Ollama (Qwen 14B) | vLLM (Qwen 7B) | Speedup |
|---|---|---|---|
| 1 | 3.7s | 3.3s | 1.1x |
| 10 | 25.5s | 3.9s | 6.5x |
| 25 | 66.0s | 4.8s | 13.7x |
| 50 | 92.4s (28% fail) | 6.0s (100% success) | 15.4x |

- **Ollama fails at 50 concurrent users** (our pilot target) — 14 of 50 requests timed out, survivors waited 92s avg
- **vLLM handled all 50 users** in 6s avg with 100% success rate
- vLLM 14B could not run on the Lambda's 2080 Ti GPUs (FP16 precision issue on Turing architecture) — will be re-tested on GPU cluster once Dylan provisions access

### Server Reliability Hardening
- Switched backend/frontend to unique ports (9580/9581) to avoid conflicts with other services on Lambda
- Added PM2 process management with auto-restart on crash
- Added watchdog script running every 2 minutes via cron to detect and recover unresponsive services
- Verified auto-restart: killing backend/frontend/tunnel individually — all recover within seconds
