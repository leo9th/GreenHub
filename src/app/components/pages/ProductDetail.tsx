import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, Heart, Share2, Star, MapPin, ShieldCheck, MessageCircle, Phone, Truck, Package, Store } from "lucide-react";
import { BuyNowActionIcon, CartActionIcon } from "../icons/ActionIcons";

const productImages = [
  "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=600",
  "https://images.unsplash.com/photo-1678911820864-e5484e15c2b0?w=600",
  "https://images.unsplash.com/photo-1678685888437-7a96f0d2e9e0?w=600",
];

export function ProductDetail() {
  const [currentImage, setCurrentImage] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="max-w-7xl mx-auto bg-white min-h-screen">
      <div className="sticky top-0 bg-white border-b border-border p-4 flex items-center justify-between z-10">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <button className="text-foreground">
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="text-foreground"
          >
            <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="aspect-square bg-muted">
          <img
            src={productImages[currentImage]}
            alt="Product"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {productImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImage(index)}
              className={`w-2 h-2 rounded-full ${
                index === currentImage ? "bg-[#22c55e]" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-xl text-foreground flex-1">iPhone 14 Pro Max 256GB</h1>
            <div className="bg-[#22c55e]/10 text-[#22c55e] px-3 py-1 rounded text-sm">
              New
            </div>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-[#eab308] fill-[#eab308]" />
              <span className="text-foreground">4.8</span>
              <span className="text-muted-foreground text-sm">(127 reviews)</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>Lagos, Nigeria</span>
          </div>
        </div>

        <div className="bg-[#22c55e]/5 rounded-lg p-4">
          <p className="text-2xl text-[#22c55e] mb-1">₦850,000</p>
          <p className="text-sm text-muted-foreground">Free delivery within Lagos</p>
        </div>

        <div className="border border-border rounded-lg p-4 space-y-3">
          <Link to="/messages" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#22c55e] flex items-center justify-center">
              <span className="text-white">TH</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground">TechHub Store</h3>
                <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
              </div>
              <p className="text-sm text-muted-foreground">Verified Seller • 98% rating</p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link
              to="/messages"
              className="flex-1 flex items-center justify-center gap-2 py-2 border border-[#22c55e] text-[#22c55e] rounded-lg"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </Link>
            <button className="flex-1 flex items-center justify-center gap-2 py-2 border border-border text-foreground rounded-lg">
              <Phone className="w-4 h-4" />
              Call
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-foreground mb-3">Description</h3>
          <p className="text-muted-foreground leading-relaxed">
            Brand new iPhone 14 Pro Max with 256GB storage. Deep Purple color.
            Comes with original box, charger, and accessories. 6.7-inch Super Retina XDR display,
            A16 Bionic chip, Pro camera system with 48MP main camera. Never used, sealed in box.
            Full warranty included. Serious buyers only.
          </p>
        </div>

        <div>
          <h3 className="text-foreground mb-3">Product Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Condition</span>
              <span className="text-foreground">Brand New</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Brand</span>
              <span className="text-foreground">Apple</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Storage</span>
              <span className="text-foreground">256GB</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Color</span>
              <span className="text-foreground">Deep Purple</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-foreground mb-3">Delivery Options</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Truck className="w-5 h-5 text-[#22c55e] mt-0.5" />
              <div className="flex-1">
                <p className="text-foreground">GIGL Express Delivery</p>
                <p className="text-sm text-muted-foreground">1-2 days • ₦3,500</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Package className="w-5 h-5 text-[#22c55e] mt-0.5" />
              <div className="flex-1">
                <p className="text-foreground">Sendy Standard</p>
                <p className="text-sm text-muted-foreground">2-3 days • ₦2,500</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Store className="w-5 h-5 text-[#22c55e] mt-0.5" />
              <div className="flex-1">
                <p className="text-foreground">Pickup from Seller</p>
                <p className="text-sm text-muted-foreground">Free • Available today</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-4 bg-[#eab308]/10 rounded-lg">
          <img
            src="https://paystack.com/assets/img/logos/paystack-icon-blue.png"
            alt="Paystack"
            className="w-8 h-8"
          />
          <div className="flex-1">
            <p className="text-sm text-foreground">Secure Payment</p>
            <p className="text-xs text-muted-foreground">Protected by Paystack</p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-border p-4 flex gap-3">
        <button className="relative flex-1 py-3 border border-[#22c55e] text-[#22c55e] rounded-lg inline-flex items-center justify-center">
          <CartActionIcon className="absolute left-4 w-4 h-4 text-emerald-700" />
          Add to Cart
        </button>
        <Link
          to="/checkout"
          className="relative flex-1 py-3 bg-[#22c55e] text-white rounded-lg text-center inline-flex items-center justify-center"
        >
          <BuyNowActionIcon className="absolute left-4 w-4 h-4 text-white/95" />
          Buy Now
        </Link>
      </div>
    </div>
  );
}
