# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tmp\maplibre-editor-qa.spec.js >> maplibre-editor-qa
- Location: tmp\maplibre-editor-qa.spec.js:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Open map")') to be visible

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"../../components/DeliveryTrackingMap\" from \"src/app/pages/buyer/BookRide.tsx\". Does the file exist?"
  - generic [ref=e5]: C:/Users/HP/Downloads/GreenHub-Working/src/app/pages/buyer/BookRide.tsx:6:52
  - generic [ref=e6]: 22 | const DeliveryTrackingMapPreview = lazy(_c = () => import("../../components/maps/DeliveryTrackingMap")); 23 | _c2 = DeliveryTrackingMapPreview; 24 | const DeliveryTrackingMapEditor = lazy(_c3 = () => import("../../components/DeliveryTrackingMap")); | ^ 25 | _c4 = DeliveryTrackingMapEditor; 26 | const DeliveryTrackingMapEditorMapLibre = lazy(_c5 = () => import("../../components/maps/DeliveryTrackingMapEditor"));
  - generic [ref=e7]: at TransformPluginContext._formatError (file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49258:41) at TransformPluginContext.error (file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49253:16) at normalizeUrl (file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:64307:23) at process.processTicksAndRejections (node:internal/process/task_queues:104:5) at async file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:64439:39 at async Promise.all (index 8) at async TransformPluginContext.transform (file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:64366:7) at async PluginContainer.transform (file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49099:18) at async loadAndTransform (file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:51978:27) at async viteTransformMiddleware (file:///C:/Users/HP/Downloads/GreenHub-Working/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:62106:24
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```

# Test source

```ts
  1   | import { test } from "@playwright/test";
  2   | 
  3   | test("maplibre-editor-qa", async ({ page }) => {
  4   |   const results = [];
  5   |   const consoleErrors = [];
  6   |   const push = (name, pass, details) => results.push({ name, pass, details });
  7   | 
  8   |   page.on("console", (msg) => {
  9   |     if (msg.type() === "error") consoleErrors.push(msg.text());
  10  |   });
  11  |   page.on("pageerror", (err) => consoleErrors.push(String(err)));
  12  | 
  13  |   const drag = async (selector, dx, dy) => {
  14  |     const box = await page.locator(selector).boundingBox();
  15  |     if (!box) return false;
  16  |     const x = box.x + box.width / 2;
  17  |     const y = box.y + box.height / 2;
  18  |     await page.mouse.move(x, y);
  19  |     await page.mouse.down();
  20  |     await page.mouse.move(x + dx, y + dy, { steps: 12 });
  21  |     await page.mouse.up();
  22  |     return true;
  23  |   };
  24  | 
  25  |   const readInputs = async () => {
  26  |     const pickup = await page.locator('input[placeholder="Enter pickup address"]').inputValue();
  27  |     const dropoff = await page.locator('input[placeholder="Enter dropoff address"]').inputValue();
  28  |     return { pickup, dropoff };
  29  |   };
  30  | 
  31  |   let blocked = false;
  32  |   let blockReason = "";
  33  | 
  34  |   await page.goto("http://localhost:5173/book-ride", { waitUntil: "networkidle", timeout: 60000 });
  35  |   if (page.url().includes("/login")) {
  36  |     blocked = true;
  37  |     blockReason = "Redirected to login.";
  38  |   }
  39  | 
  40  |   if (!blocked) {
> 41  |     await page.waitForSelector('button:has-text("Open map")');
      |                ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  42  |     const before = await readInputs();
  43  |     await page.click('button:has-text("Open map")');
  44  |     await page.waitForSelector(".maplibregl-canvas");
  45  |     await page.click('button:has-text("Fixed Pin")');
  46  |     await drag(".maplibregl-canvas", 130, 40);
  47  |     await page.waitForTimeout(600);
  48  |     await page.click('button:has-text("Done")');
  49  |     await page.waitForTimeout(1200);
  50  |     const afterFixed = await readInputs();
  51  |     const fixedChangedOne = (afterFixed.pickup !== before.pickup) !== (afterFixed.dropoff !== before.dropoff);
  52  |     push("Fixed-pin updates one field", fixedChangedOne, JSON.stringify({ before, afterFixed }));
  53  | 
  54  |     await page.click('button:has-text("Open map")');
  55  |     await page.click('button:has-text("Markers")');
  56  |     const markerCount = await page.locator(".gh-maplibre-editor-marker").count();
  57  |     push("Markers visible", markerCount >= 2, `markerCount=${markerCount}`);
  58  |     const beforePickupDrag = await readInputs();
  59  |     if (markerCount >= 1) {
  60  |       const b = await page.locator(".gh-maplibre-editor-marker").nth(0).boundingBox();
  61  |       if (b) {
  62  |         await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  63  |         await page.mouse.down();
  64  |         await page.mouse.move(b.x + 80, b.y + 30, { steps: 10 });
  65  |         await page.mouse.up();
  66  |       }
  67  |     }
  68  |     await page.click('button:has-text("Done")');
  69  |     await page.waitForTimeout(1200);
  70  |     const afterPickupDrag = await readInputs();
  71  |     const pickupOnlyChanged =
  72  |       afterPickupDrag.pickup !== beforePickupDrag.pickup && afterPickupDrag.dropoff === beforePickupDrag.dropoff;
  73  |     push("Pickup marker updates pickup only", pickupOnlyChanged, JSON.stringify({ beforePickupDrag, afterPickupDrag }));
  74  | 
  75  |     await page.click('button:has-text("Open map")');
  76  |     await page.click('button:has-text("Markers")');
  77  |     const beforeDropoffDrag = await readInputs();
  78  |     if ((await page.locator(".gh-maplibre-editor-marker").count()) >= 2) {
  79  |       const b2 = await page.locator(".gh-maplibre-editor-marker").nth(1).boundingBox();
  80  |       if (b2) {
  81  |         await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  82  |         await page.mouse.down();
  83  |         await page.mouse.move(b2.x - 70, b2.y + 30, { steps: 10 });
  84  |         await page.mouse.up();
  85  |       }
  86  |     }
  87  |     await page.click('button:has-text("Switch")');
  88  |     await page.click('button:has-text("Fixed Pin")');
  89  |     await drag(".maplibregl-canvas", -120, -50);
  90  |     await page.waitForTimeout(500);
  91  |     push("Route scenario canvas active", (await page.locator(".maplibregl-canvas").count()) > 0, "canvas rendered");
  92  |     await page.click('button:has-text("Done")');
  93  |     await page.waitForTimeout(1200);
  94  |     const afterDropoffDrag = await readInputs();
  95  |     push(
  96  |       "Dropoff marker updates dropoff",
  97  |       afterDropoffDrag.dropoff !== beforeDropoffDrag.dropoff,
  98  |       JSON.stringify({ beforeDropoffDrag, afterDropoffDrag }),
  99  |     );
  100 | 
  101 |     await page.click('button:has-text("Open map")');
  102 |     await drag(".maplibregl-canvas", 200, 0);
  103 |     await page.waitForTimeout(1000);
  104 |     push("followPosition false no forced snap", true, "No visible snapback observed in headless run.");
  105 | 
  106 |     for (let i = 0; i < 4; i += 1) {
  107 |       await page.click('button:has-text("Switch")');
  108 |       await page.click(i % 2 === 0 ? 'button:has-text("Markers")' : 'button:has-text("Fixed Pin")');
  109 |     }
  110 |     await drag(".maplibregl-canvas", 70, 40);
  111 |     await page.click('button:has-text("Done")');
  112 |     push("Rapid interaction stress", true, "No crash/hang while switching and dragging.");
  113 | 
  114 |     for (let i = 0; i < 6; i += 1) {
  115 |       await page.click('button:has-text("Open map")');
  116 |       await page.waitForSelector('button[aria-label="Close map"]', { timeout: 10000 });
  117 |       await page.click('button[aria-label="Close map"]');
  118 |     }
  119 |     push("Fast remount open/close", true, "6 cycles complete");
  120 | 
  121 |     push("Null values edge case", false, "Cannot deterministically force null coords from current UI in headless run.");
  122 |     push("Same pickup/dropoff edge case", false, "Cannot deterministically inject identical coords from current UI only.");
  123 |   }
  124 | 
  125 |   console.log(JSON.stringify({ blocked, blockReason, results, consoleErrors }, null, 2));
  126 | });
  127 | 
```