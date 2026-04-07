import React from "react";
import { Link } from "react-router";

export default function HowToBuy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-8">How to Buy on GreenHub</h1>
      <div className="space-y-8 text-gray-700 prose prose-lg">
        <p className="text-lg">
          Finding exactly what you need at the best price is simple on GreenHub. Follow this guide to shop smartly and safely.
        </p>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">1</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Search or browse listings</h3>
            <p>
              On the home page, use the green search area at the top, or tap <strong>Shop</strong> in the top bar (next to the logo) to open the full listings page. On a phone you can also use the bottom shortcut labeled <strong>Shop</strong>. Category chips and filters on the listings page help narrow results.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">2</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Review sellers and item details</h3>
            <p>
              Read the description carefully and check the seller&apos;s profile. Look out for &quot;Verified Seller&quot; badges and positive reviews to ensure you are dealing with reputable sellers.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">3</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat with the seller (Messages)</h3>
            <p>
              Sign in, then use <strong>Messages</strong> — the speech-bubble icon in the top bar — to ask questions or negotiate. It keeps your personal phone number private until you are ready to meet. You can also reach the seller from the product page when you are logged in.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">4</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Cart and checkout</h3>
            <p>
              When you are ready, add items to your <strong>cart</strong> using the trolley icon in the top bar. Open the cart to review everything, then continue through <strong>checkout</strong>. Some steps require you to be signed in.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">5</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Track orders and meet safely</h3>
            <p>
              After you buy, check <strong>Orders</strong> for updates on your purchases. When collecting an item, meet in a public, well-lit place and inspect it before paying. <strong>Never pay in advance for delivery.</strong> More tips: see our{" "}
              <Link to="/faq" className="text-[#22c55e] font-semibold hover:underline">
                FAQ
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
