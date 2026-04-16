const PLACEHOLDER_IMG = "/placeholder.png";

export type NewProductCardProps = {
  title: string;
  price: number | string;
  image?: string;
  images?: string[];
  location?: string;
  city?: string;
  sellerUsername?: string;
};

export default function NewProductCard({
  title,
  price,
  image,
  images,
  location,
  city,
  sellerUsername,
}: NewProductCardProps) {
  const firstImage = Array.isArray(images) && typeof images[0] === "string" ? images[0].trim() : "";
  const productImage = image?.trim() || firstImage || "";
  const resolvedLocation = (location?.trim() || city?.trim() || "").trim() || "—";
  const resolvedSellerUsername = (sellerUsername?.trim() || "seller").replace(/^@+/, "");
  console.log("ProductCard image prop:", image);

  return (
    <div
      className="new-product-card"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "white",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div style={{ height: "75%", width: "100%", background: "#f3f4f6" }}>
        <img
          src={productImage || PLACEHOLDER_IMG}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = PLACEHOLDER_IMG;
          }}
        />
      </div>
      <div style={{ height: "25%", padding: "8px 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ fontWeight: 700, color: "#10b981" }}>₦{price}</div>
        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>📍 {resolvedLocation}</div>
        <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>@{resolvedSellerUsername}</div>
      </div>
    </div>
  );
}
