import { setTimeout as sleep } from "node:timers/promises";

const DEBUG_PORT = 9223;
const BASE_URL = "http://127.0.0.1:5173";

const state = {
  consoleEvents: [],
  exceptions: [],
};

let ws;
let nextId = 0;
const pending = new Map();
function logEvent(type, payload) {
  state.consoleEvents.push({ type, payload });
}

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  if (!res.ok) throw new Error(`CDP HTTP ${res.status} for ${path}`);
  return res.json();
}

async function waitForTarget(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const targets = await getJson("/json/list");
      const page = targets.find((t) => t.type === "page" && String(t.url || "").startsWith(BASE_URL));
      if (page?.webSocketDebuggerUrl) return page;
      if (targets[0]?.webSocketDebuggerUrl) return targets[0];
    } catch {
      // Retry until browser is ready.
    }
    await sleep(500);
  }
  throw new Error("Timed out waiting for browser target");
}

function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
}

async function navigate(url) {
  await send("Page.navigate", { url });
  await sleep(2500);
}

async function clickSelector(selector) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function pageSnapshot(label) {
  return evaluate(`(() => {
    const toastNodes = Array.from(document.querySelectorAll('[data-sonner-toast], [data-toast], [role="status"]'));
    const toastTexts = toastNodes
      .map((node) => (node.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 5);
    const authKeys = Object.keys(window.localStorage || {}).filter((k) => k.toLowerCase().includes('supabase'));
    const authValues = authKeys
      .map((k) => {
        try {
          return window.localStorage.getItem(k) || '';
        } catch {
          return '';
        }
      })
      .join(' ');
    return {
      label: ${JSON.stringify(label)},
      pathname: window.location.pathname,
      href: window.location.href,
      title: document.title,
      toastTexts,
      bodyTextIncludesLoginPrompt: document.body.innerText.includes('Login to like'),
      hasAuthToken: authValues.includes('access_token'),
      likeButtonCount: document.querySelectorAll('button[aria-label="Like"], button[aria-label="Unlike"]').length,
    };
  })()`);
}

async function run() {
  const target = await waitForTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.id) {
      const pendingItem = pending.get(message.id);
      if (!pendingItem) return;
      pending.delete(message.id);
      if (message.error) pendingItem.reject(new Error(message.error.message || pendingItem.method));
      else pendingItem.resolve(message.result);
      return;
    }

    if (message.method === "Runtime.consoleAPICalled") {
      logEvent("console", {
        level: message.params?.type,
        args: (message.params?.args || []).map((arg) => arg.value ?? arg.description ?? null),
      });
    } else if (message.method === "Runtime.exceptionThrown") {
      state.exceptions.push({
        text: message.params?.exceptionDetails?.text || "Unknown exception",
        description: message.params?.exceptionDetails?.exception?.description || null,
      });
    }
  });

  await send("Runtime.enable");

  const results = [];

  await navigate(`${BASE_URL}/`);
  const homeBefore = await pageSnapshot("home-before");
  const homeLikeClicked = await clickSelector('button[aria-label="Like"], button[aria-label="Unlike"]');
  await sleep(1200);
  const homeAfter = await pageSnapshot("home-after");
  results.push({ page: "home", before: homeBefore, clickedLike: homeLikeClicked, after: homeAfter });

  await navigate(`${BASE_URL}/products`);
  const productsBefore = await pageSnapshot("products-before");
  const productsLikeClicked = await clickSelector('button[aria-label="Like"], button[aria-label="Unlike"]');
  await sleep(1200);
  const productsAfter = await pageSnapshot("products-after");
  results.push({ page: "products", before: productsBefore, clickedLike: productsLikeClicked, after: productsAfter });

  const firstProductHref = await evaluate(`(() => {
    const link = document.querySelector('a[href^="/products/"]');
    return link ? new URL(link.getAttribute('href'), window.location.origin).href : null;
  })()`);

  if (firstProductHref) {
    await navigate(firstProductHref);
    const detailBefore = await pageSnapshot("detail-before");
    const detailLikeClicked = await clickSelector('button[aria-label="Like"], button[aria-label="Unlike"]');
    await sleep(1500);
    const detailAfter = await pageSnapshot("detail-after");
    results.push({ page: "product-detail", before: detailBefore, clickedLike: detailLikeClicked, after: detailAfter });
  } else {
    results.push({ page: "product-detail", error: "No product link found from products page" });
  }

  await navigate(`${BASE_URL}/messages`);
  await sleep(1200);
  const chatSnapshot = await pageSnapshot("messages");
  results.push({ page: "messages", snapshot: chatSnapshot });

  const output = {
    results,
    consoleEvents: state.consoleEvents,
    exceptions: state.exceptions,
  };

  console.log(JSON.stringify(output, null, 2));
  ws.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
