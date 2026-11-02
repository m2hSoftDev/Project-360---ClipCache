# ClipCache — Manual Testing Guide

## Phase 2: Capture, Tray, Area Crop & Full Preview

### 1. Shortcut Capture via `Alt+Shift+S` (`captureVisibleTab` with no picker)
1. **Service Worker Console Check**:
   - Open `chrome://extensions` in developer mode, find ClipCache, and click "service worker" to open DevTools.
   - Run `chrome.commands.getAll().then(console.log)` in the console.
   - **Expected Outcome**: The output must list exactly one command, `capture-visible-v2`, with shortcut `"Alt+Shift+S"` (or `"Command+Shift+S"` on Mac). Stale commands (`capture_visible`, `_execute_action`, `area-capture`) must NOT appear.
2. **Stale Shortcut Immunity Check**:
   - Navigate to any regular web page (e.g. `https://example.com`).
   - Press <kbd>Alt+C</kbd> and <kbd>Alt+Shift+C</kbd>.
   - **Expected Outcome**: Confirm that **nothing happens** — no capture is taken, no error is thrown, and no image is added to the tray.
3. **Capture via Official Shortcut**:
   - On the web page, press the global extension shortcut <kbd>Alt+Shift+S</kbd> (or click **"Capture Visible Tab"** in the Side Panel).
   - **Expected Outcome**:
     - The visible tab is captured immediately using `chrome.tabs.captureVisibleTab`.
     - **No browser picker or permission prompt appears.**
     - The screenshot auto-saves to Dexie with `mode: 'visible'` and `parentId: null`.
     - The captured image appears in the Recent Captures tray.

### 2. Restricted Pages Error Handling
1. Navigate to `chrome://extensions` or the Chrome Web Store.
2. Press <kbd>Alt+Shift+S</kbd> or click **"Capture Visible Tab"**.
3. **Expected Outcome**:
   - An alert banner clearly informs the user:
     `"chrome://, edge://, and Chrome Web Store pages cannot be captured."`
   - No crash or silent failure occurs.

### 3. Thumbnail Card Layout (Zero Overlap & Bottom Mode Bar)
1. Inspect the Recent Captures tray in the Side Panel.
2. **Expected Outcome**:
   - The thumbnail image container is completely clean — **nothing overlaps the image** (no floating badges, no hover overlays covering the image).
   - In a dedicated bar **below** each thumbnail, the mode label (`VISIBLE`, `WINDOW`, `AREA`) is displayed with action buttons (Crop, Delete) and metadata (dimensions, relative timestamp).

### 4. 360 px Responsive Grid
1. Resize the Chrome Side Panel to its standard width of **360 px**.
2. Observe the Recent Captures tray.
3. **Expected Outcome**:
   - The thumbnail grid uses `minmax(140px, 1fr)`.
   - Cards render neatly in two responsive columns without horizontal scrollbars, text clipping, or overflow.
   - Shrinking the panel below 320 px gracefully adapts to a single column.

### 5. Drop Zone Formats Validation
1. Drag and drop a `.png`, `.jpg`, or `.webp` file into the **"Drop Image or Browse"** zone.
2. Observe that the drop zone explicitly lists: `"Accepts PNG, JPG, or WebP"`.
3. The image is processed and auto-saved to Dexie with `mode: 'visible'`.
4. Drag and drop an unsupported format (e.g. `.svg` or `.pdf`).
5. **Expected Outcome**:
   - A warning banner alerts: `"Only PNG, JPG, and WebP files are supported. Please drop a valid image file."`

### 6. Full-Image Preview (ResizeObserver)
1. Click any thumbnail card in the Recent Captures tray.
2. A full-image preview dialog opens.
3. **Expected Outcome**:
   - The full image is centered inside a scrollable container with `max-width: 100%, height: auto`.
   - A `ResizeObserver` monitors the container width and displays the current displayed dimensions and scale percentage (e.g. `Displayed: 328 × 185 px • Scale: 17%`).
   - The natural dimensions are displayed (e.g. `Natural: 1920 × 1080 px`).
   - Clicking **"Crop Area"** transitions smoothly into the Area Crop overlay.
   - Clicking **"X"** closes the preview and cleanly revokes the object URL.

### 7. Interactive Area Crop & Schema Compliance
1. Trigger a capture or click the crop icon on any thumbnail card.
2. Drag a rectangle across the image to define a crop region.
3. Click **"Save Cropped Area"**.
4. **Expected Outcome**:
   - The crop is executed via canvas at native resolution.
   - The cropped screenshot is saved as a **NEW record** in Dexie with `mode: 'area'` and `parentId` referencing the original screenshot's ID.
   - The original screenshot remains unchanged in Dexie.
   - The new cropped screenshot immediately appears in the Recent Captures tray.

## Phase 3: Gallery, Preview Page with Toolbar, Delete Cascade & Free Plan Limit

### 1. Gallery Layout & Live Reactivity (`useLiveQuery`)
1. Open the ClipCache Side Panel in Chrome at 360 px width.
2. Observe the top header counter:
   - Free plan quota is displayed clearly as `"X / 20"` (e.g. `0 / 20`).
3. Take 2–3 screenshots or paste images.
4. **Expected Outcome**:
   - Gallery renders a responsive grid using CSS grid `minmax(140px, 1fr)`.
   - Each card displays the full thumbnail image in its own container — **nothing overlaps the image** (no badges, buttons, or text on the image).
   - In a dedicated label bar **below** the image:
     - Mode badge in uppercase: `VISIBLE`, `WINDOW`, `FULL`, or `AREA`.
     - Date formatted cleanly (e.g. `Oct 16, 2026`).
     - Size in pixels (e.g. `1920 × 1080 px`).
     - Delete icon button.
   - `useLiveQuery` reactively updates the grid and header quota instantly whenever a capture is added or removed, without page reloads.

### 2. Full Preview Page Navigation & Scaling (`ResizeObserver`)
1. Click any thumbnail card in the gallery.
2. **Expected Outcome**:
   - The app transitions to the **Preview page**.
   - Above the image, the header displays:
     - Full capture title (`pageTitle`).
     - Mode badge (`VISIBLE`, `WINDOW`, `FULL`, `AREA`).
     - Dimensions in pixels (`width × height px`).
     - Created timestamp (`Date.now()` formatted).
     - Delete button.
   - An object URL (`URL.createObjectURL`) is allocated for the image blob.
   - A `ResizeObserver` monitors the side panel container width and dynamically computes scale and display dimensions.
   - The image is scaled to panel width (`max-w-full h-auto`) inside a vertically scrollable container: **the image is never clipped**, even for extremely tall full-page captures.

### 3. Preview Toolbar & Disabled State Verification
1. On the Preview page, inspect the horizontal editing toolbar located directly below the header.
2. Verify the exact button sequence:
   `Crop` → `Blur` → `Draw` → `Text` → `Arrow` → `Undo` → `Redo` → `Reset` → `Save` → `Back`.
3. Hover over and click each button from `Crop` through `Save`:
   - **Expected Outcome**: Every button from `Crop` to `Save` is `disabled` with a tooltip (`title`) stating:
     `"Coming in Phase 4"`.
   - No editing logic is executed.
4. Click the **`Back`** button:
   - **Expected Outcome**: The `Back` button is enabled, navigates immediately back to the Gallery view, and the object URL is revoked cleanly (`URL.revokeObjectURL`).

### 4. Cascade Delete with Confirmation Dialog
1. Take a screenshot (Parent).
2. Save an Area Crop from that screenshot (Child with `parentId`).
3. Click the Delete button either from the gallery card or on the Preview page.
4. **Expected Outcome**:
   - An accessible confirmation modal appears:
     - Dialog title: `"Delete Screenshot?"`
     - Explicit explanation: `"Deleting this record removes both originalBlob and any edit or crop children linked by parentId."`
     - Displays the count of linked children (e.g. `"⚠️ Note: This capture has 1 linked crop/edit that will also be permanently deleted."`).
     - Actions: `"Cancel"` and `"Delete Permanently"`.
5. Click `"Cancel"`: dialog closes, no records are deleted.
6. Click Delete again and click `"Delete Permanently"`:
   - Both the parent capture and all child records (with their respective `originalBlob`s) are purged from Dexie IndexedDB.
   - Gallery and header quota update reactively.
   - If deleting from the Preview page, the user is navigated back to the Gallery.

### 5. 20-Item Free Plan Limit Enforcement
1. Add captures until the gallery reaches 20 items.
2. The header quota displays `"20 / 20"`.
3. Attempt to capture another tab (<kbd>Alt+Shift+S</kbd> or click "Capture Visible Tab"), paste from clipboard, or drag-and-drop an image.
4. **Expected Outcome**:
   - The operation is blocked before any storage save occurs (`src/background/limits.ts`).
   - A clear warning banner appears:
     `"Free limit reached (20/20). Delete a capture to add a new one."`
   - No 21st item is added to IndexedDB.
   - Deleting one capture decrements quota to `"19 / 20"`, re-enabling capture.

## Phase 4: Editor & Editing Tools

### 1. Canvas Display at Panel Width & ResizeObserver
1. Open any capture in the Preview page.
2. Resize the Chrome Side Panel between 320 px and 500 px.
3. **Expected Outcome**:
   - Fabric.js canvas dynamically resizes to fit container width via `ResizeObserver`.
   - The image is scaled proportionally without clipping or horizontal scrollbars.
   - All annotations, drawings, and tools render scaled to panel view.

### 2. Crop Tool (New Record with `parentId`)
1. In the editor toolbar, click **"Crop"**.
2. Click and drag a rectangle over the image. A dashed blue crop selection appears.
3. The sub-bar prompts: `"Selection ready. Save as new capture?"`.
4. Click **"Save Crop (New Record)"**.
5. **Expected Outcome**:
   - The cropped region is extracted using `src/sidepanel/lib/cropMath.ts`.
   - Saved as a **new Dexie screenshot record** with `mode: 'area'`, `parentId` set to the original screenshot's ID, and its own `originalBlob`.
   - The original capture remains completely intact.
   - A success banner confirms the new capture ID and parent ID.

### 3. Blur Tool (Sensitive Area Obfuscation)
1. Click **"Blur"** on the editor toolbar.
2. Click and drag a rectangle over any sensitive text or area.
3. Release the mouse button.
4. **Expected Outcome**:
   - A copy of that region clipped to the rectangle is instantly pixelated (block size 8) for high performance even on 4K/high-res captures.
   - The blurred region can be selected, moved, or deleted as an object on the canvas.
   - Undo/Redo tracking records the blur action.

### 4. Draw Tool (Freehand Brush)
1. Click **"Draw"** on the editor toolbar.
2. Select a color preset (or choose a custom color via the native color picker).
3. Adjust the brush size slider (1 px to 30 px).
4. Draw freehand strokes on the canvas.
5. **Expected Outcome**:
   - Smooth freehand drawing appears on the canvas in the selected color and stroke width.
   - Changing colors or stroke widths updates immediately for subsequent strokes.

### 5. Text Tool
1. Click **"Text"** on the editor toolbar.
2. Click anywhere on the image canvas.
3. **Expected Outcome**:
   - An editable text box (`IText`) appears with placeholder `"Type text here"`.
   - Type custom text.
   - Click the **"Confirm Text"** button on the sub-bar or click outside the text box to finalize.
   - The text object is selectable, movable, and resizable.

### 6. Arrow Tool
1. Click **"Arrow"** on the editor toolbar.
2. Select desired color and size from the sub-bar.
3. Click and drag across the canvas from start point to destination.
4. Release the mouse.
5. **Expected Outcome**:
   - A straight line with a prominent arrow head oriented along the drag direction is created.
   - Grouped into a single movable Fabric object.

### 7. Undo and Redo (30-Step History Limit)
1. Perform a series of edits (e.g. Draw, Arrow, Text, Blur).
2. Click **"Undo"** repeatedly:
   - **Expected Outcome**: Canvas reverts step-by-step through prior states.
   - The Undo button disables when the oldest state is reached.
3. Click **"Redo"**:
   - **Expected Outcome**: Canvas steps forward through reverted states.
4. History is strictly capped at 30 steps in memory and cleared automatically when navigating away or closing the page.

### 8. Reset Tool
1. Make several edits on the canvas.
2. Click **"Reset"**.
3. **Expected Outcome**:
   - Canvas is restored back to the original image state.
   - Any previously saved edits in IndexedDB are not deleted.

### 9. Save Tool (Full Natural Resolution Export & DB Update)
1. Add drawings, text, or arrows to the image.
2. Note that the **"Save"** button pulses green to indicate unsaved changes.
3. Click **"Save"**.
4. **Expected Outcome**:
   - Canvas is exported to a full-resolution PNG blob at natural pixel size (e.g. 1920 × 1080 px, not the 360 px display size).
   - Writes `editedBlob`, `editState` (Fabric JSON), and `isEdited = true` to the existing Dexie record.
   - `originalBlob` remains 100% unchanged.
   - Unsaved changes indicator turns off.
   - Returning to the gallery displays the updated thumbnail reactively via `useLiveQuery`.

### 10. Back with Unsaved Changes Confirmation
1. Add any drawing or text without clicking Save.
2. Click the **"Back"** button (or header back arrow).
3. **Expected Outcome**:
   - A modal dialog appears: `"Discard changes?"`.
   - Explains that leaving now will lose unsaved edits.
   - Contains two buttons: **"Keep Editing"** (closes modal, stays in editor) and **"Discard"** (discards edits and navigates back to gallery).

### 11. Editor Bug Fixes Manual Verification
1. **Bug 1 (Export Screenshot with Edits)**:
   - Open a capture in the editor.
   - Draw a box (or rectangle annotation) on the screenshot.
   - Click **"Save"**.
   - Open the saved image (or inspect the saved thumbnail/preview in the gallery) and confirm the saved image shows the screenshot with the box (not just the drawing on a blank background).
2. **Bug 2 (Arrow Head Tip Alignment)**:
   - Click **"Arrow"** on the toolbar.
   - Draw an arrow from `(100, 100)` towards `(300, 200)` and release the mouse.
   - Confirm that the arrow head tip is located precisely at the drag end point and moves together with the line as a single group.
3. **Bug 3 (Undo / Redo Shortcuts)**:
   - Add an object to the canvas (e.g. draw a stroke, arrow, or shape).
   - Press <kbd>Ctrl+Z</kbd> (or <kbd>Cmd+Z</kbd> on Mac).
   - Confirm the object immediately disappears.
   - Press <kbd>Ctrl+Y</kbd> or <kbd>Ctrl+Shift+Z</kbd> (or <kbd>Cmd+Shift+Z</kbd> on Mac).
   - Confirm the object reappears.
   - While editing text inside a text box, confirm <kbd>Ctrl+Z</kbd> does not unexpectedly delete canvas objects.
4. **Bug 4 (Delete / Backspace Key Removal)**:
   - Click to select an object or multiple objects on the canvas.
   - Press <kbd>Delete</kbd> or <kbd>Backspace</kbd>.
   - Confirm the selected object disappears from the canvas, and the screenshot itself is NOT deleted from storage.
   - Press <kbd>Ctrl+Z</kbd> (or <kbd>Cmd+Z</kbd>) and confirm the deleted object returns.
   - While editing text inside a text box, confirm <kbd>Delete</kbd> and <kbd>Backspace</kbd> edit text normally without removing the text box object.

## Phase 5: Compare View & Export Options

### 1. Compare View with Draggable Before/After Slider
1. **Unedited Capture State**:
   - Open a fresh screenshot that has no edits saved (`editedBlob` is null).
   - In the action bar above the toolbar, check the **"Compare"** button.
   - **Expected Outcome**:
     - The Compare button is disabled (`opacity-60 cursor-not-allowed`).
     - A hint text appears next to it: `"No edits yet. Edit and save first."`.
     - Hover tooltip displays: `"No edits yet. Edit and save first."`.
2. **Edited Capture State**:
   - Use the editor toolbar to add annotations (e.g. Draw, Text, Blur, or Arrow).
   - Click **"Save"** to store `editedBlob`.
   - **Expected Outcome**:
     - The **"Compare"** button is now enabled (purple button with active state).
     - Hint text disappears.
3. **Draggable Slider Interaction**:
   - Click the **"Compare"** button.
   - A modal dialog opens showing the before/after comparison.
   - **Expected Outcome**:
     - Draggable divider line starts at 50%.
     - Left side displays the **Original** capture (`originalBlob`).
     - Right side displays the **Edited** capture (`editedBlob`).
     - Drag the center handle left and right: the divider moves smoothly, updating the percentage and revealing more of either the original or edited version.
     - The image scales to the Side Panel container width (tested at 360 px) and is never clipped.
     - Clicking the **X** button closes the compare view cleanly.

### 2. Export to Local Disk (PNG & JPG)
1. **Format Choice (Edited vs Original)**:
   - On an edited capture, click **"PNG"**.
   - **Expected Outcome**:
     - The browser downloads the edited version of the screenshot (`editedBlob`) to local disk/storage.
     - A success alert confirms: `"Saved PNG to local disk successfully!"`.
   - On an unedited capture, click **"PNG"**.
   - **Expected Outcome**:
     - The browser downloads the original version (`originalBlob`).
2. **JPG Export with Solid White Background**:
   - Open a capture with transparent areas (or crop/shape).
   - Click **"JPG"**.
   - **Expected Outcome**:
     - The image is converted to `image/jpeg` with all transparent regions filled with a solid white background (`#ffffff`).
     - Downloaded to local disk with `.jpg` file extension.
     - Success alert confirms: `"Saved JPG to local disk successfully!"`.

### 3. Copy PNG to Clipboard
1. Click the **"Copy"** button on the action bar.
2. **Expected Outcome**:
   - The screenshot (edited version if available, otherwise original) is copied to the clipboard as an `image/png` blob via `navigator.clipboard.write`.
   - A success banner confirms: `"Copied PNG screenshot to clipboard!"`.
   - Open any graphics program or chat (e.g. Discord, Slack, Paint) and press <kbd>Ctrl+V</kbd> to paste the full-resolution PNG image.
3. **Error Reporting**:
   - If clipboard permissions are blocked by the browser, a clear error banner alerts the user:
     `"Clipboard access blocked: [details]. Please ensure clipboard permissions are enabled."`
