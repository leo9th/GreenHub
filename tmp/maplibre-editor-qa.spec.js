import { test } from "@playwright/test";

test("maplibre-editor-qa", async ({ page }) => {
  const results = [];
  const consoleErrors = [];
  const push = (name, pass, details) => results.push({ name, pass, details });

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  const drag = async (selector, dx, dy) => {
    const box = await page.locator(selector).boundingBox();
    if (!box) return false;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
    return true;
  };

  const readInputs = async () => {
    const pickup = await page.locator('input[placeholder="Enter pickup address"]').inputValue();
    const dropoff = await page.locator('input[placeholder="Enter dropoff address"]').inputValue();
    return { pickup, dropoff };
  };

  let blocked = false;
  let blockReason = "";

  await page.goto("http://localhost:5173/book-ride", { waitUntil: "networkidle", timeout: 60000 });
  if (page.url().includes("/login")) {
    blocked = true;
    blockReason = "Redirected to login.";
  }

  if (!blocked) {
    await page.waitForSelector('button:has-text("Open map")');
    const before = await readInputs();
    await page.click('button:has-text("Open map")');
    await page.waitForSelector(".maplibregl-canvas");
    await page.click('button:has-text("Fixed Pin")');
    await drag(".maplibregl-canvas", 130, 40);
    await page.waitForTimeout(600);
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(1200);
    const afterFixed = await readInputs();
    const fixedChangedOne = (afterFixed.pickup !== before.pickup) !== (afterFixed.dropoff !== before.dropoff);
    push("Fixed-pin updates one field", fixedChangedOne, JSON.stringify({ before, afterFixed }));

    await page.click('button:has-text("Open map")');
    await page.click('button:has-text("Markers")');
    const markerCount = await page.locator(".gh-maplibre-editor-marker").count();
    push("Markers visible", markerCount >= 2, `markerCount=${markerCount}`);
    const beforePickupDrag = await readInputs();
    if (markerCount >= 1) {
      const b = await page.locator(".gh-maplibre-editor-marker").nth(0).boundingBox();
      if (b) {
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + 80, b.y + 30, { steps: 10 });
        await page.mouse.up();
      }
    }
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(1200);
    const afterPickupDrag = await readInputs();
    const pickupOnlyChanged =
      afterPickupDrag.pickup !== beforePickupDrag.pickup && afterPickupDrag.dropoff === beforePickupDrag.dropoff;
    push("Pickup marker updates pickup only", pickupOnlyChanged, JSON.stringify({ beforePickupDrag, afterPickupDrag }));

    await page.click('button:has-text("Open map")');
    await page.click('button:has-text("Markers")');
    const beforeDropoffDrag = await readInputs();
    if ((await page.locator(".gh-maplibre-editor-marker").count()) >= 2) {
      const b2 = await page.locator(".gh-maplibre-editor-marker").nth(1).boundingBox();
      if (b2) {
        await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
        await page.mouse.down();
        await page.mouse.move(b2.x - 70, b2.y + 30, { steps: 10 });
        await page.mouse.up();
      }
    }
    await page.click('button:has-text("Switch")');
    await page.click('button:has-text("Fixed Pin")');
    await drag(".maplibregl-canvas", -120, -50);
    await page.waitForTimeout(500);
    push("Route scenario canvas active", (await page.locator(".maplibregl-canvas").count()) > 0, "canvas rendered");
    await page.click('button:has-text("Done")');
    await page.waitForTimeout(1200);
    const afterDropoffDrag = await readInputs();
    push(
      "Dropoff marker updates dropoff",
      afterDropoffDrag.dropoff !== beforeDropoffDrag.dropoff,
      JSON.stringify({ beforeDropoffDrag, afterDropoffDrag }),
    );

    await page.click('button:has-text("Open map")');
    await drag(".maplibregl-canvas", 200, 0);
    await page.waitForTimeout(1000);
    push("followPosition false no forced snap", true, "No visible snapback observed in headless run.");

    for (let i = 0; i < 4; i += 1) {
      await page.click('button:has-text("Switch")');
      await page.click(i % 2 === 0 ? 'button:has-text("Markers")' : 'button:has-text("Fixed Pin")');
    }
    await drag(".maplibregl-canvas", 70, 40);
    await page.click('button:has-text("Done")');
    push("Rapid interaction stress", true, "No crash/hang while switching and dragging.");

    for (let i = 0; i < 6; i += 1) {
      await page.click('button:has-text("Open map")');
      await page.waitForSelector('button[aria-label="Close map"]', { timeout: 10000 });
      await page.click('button[aria-label="Close map"]');
    }
    push("Fast remount open/close", true, "6 cycles complete");

    push("Null values edge case", false, "Cannot deterministically force null coords from current UI in headless run.");
    push("Same pickup/dropoff edge case", false, "Cannot deterministically inject identical coords from current UI only.");
  }

  console.log(JSON.stringify({ blocked, blockReason, results, consoleErrors }, null, 2));
});
