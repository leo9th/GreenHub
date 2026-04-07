import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

type ProductRow = {
  id: unknown;
  title?: string | null;
  price?: unknown;
  price_local?: unknown;
  image?: string | null;
  images?: unknown;
  status?: string | null;
};

function parseImages(row: Pick<ProductRow, "image" | "images">): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  const imagesRaw = row.images;
  if (Array.isArray(imagesRaw)) {
    for (const x of imagesRaw) {
      if (typeof x === "string") push(x);
    }
  } else if (typeof imagesRaw === "string") {
    const t = imagesRaw.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        const p = JSON.parse(t) as unknown;
        if (Array.isArray(p)) {
          for (const x of p) {
            if (typeof x === "string") push(x);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
  const fb = row.image;
  if (out.length === 0 && typeof fb === "string" && fb.trim()) push(fb);
  return out.slice(0, 5);
}

function getPrice(row: Pick<ProductRow, "price" | "price_local">): number {
  const raw = row.price_local ?? row.price;
  if (raw == null || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function ogUnavailable() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #14532d 0%, #166534 40%, #22c55e 100%)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 112,
            height: 112,
            borderRadius: 28,
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            fontSize: 48,
            fontWeight: 800,
            marginBottom: 28,
          }}
        >
          GH
        </div>
        <div style={{ color: "#ecfccb", fontSize: 36, fontWeight: 700 }}>Listing unavailable</div>
        <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 26, marginTop: 16, fontWeight: 600 }}>
          {`GreenHub — Buy & Sell in Nigeria`}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const idRaw = segments[segments.length - 1];
  if (!idRaw) {
    return new Response("Missing product id", { status: 400 });
  }
  const productId = decodeURIComponent(idRaw);

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return new Response("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select("id, title, price, price_local, image, images, status")
    .eq("id", productId)
    .maybeSingle();

  const row = data as ProductRow | null;
  if (error || !row || row.status !== "active") {
    return ogUnavailable();
  }

  const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : "Listing";
  const price = getPrice(row);
  const imageUrl = parseImages(row)[0] ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          background: "linear-gradient(110deg, #ecfdf5 0%, #ffffff 52%, #f0fdf4 100%)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "52%",
            height: "100%",
            display: "flex",
            position: "relative",
            background: "#16a34a",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              width={624}
              height={630}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                color: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 140,
                  height: 140,
                  borderRadius: 32,
                  background: "rgba(255,255,255,0.2)",
                  fontSize: 56,
                  fontWeight: 800,
                }}
              >
                GH
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 24, opacity: 0.95 }}>GreenHub</div>
            </div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "44px 48px 40px 48px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: 46,
              fontWeight: 800,
              color: "#14532d",
              lineHeight: 1.2,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#16a34a",
              letterSpacing: "-0.02em",
            }}
          >
            {formatNaira(price)}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderTop: "2px solid #bbf7d0",
              paddingTop: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#16a34a",
                color: "#fff",
                fontWeight: 800,
                fontSize: 20,
              }}
            >
              GH
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#166534" }}>GreenHub</div>
              <div style={{ fontSize: 20, color: "#15803d", fontWeight: 600, marginTop: 4 }}>
                {`Buy & Sell in Nigeria`}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
