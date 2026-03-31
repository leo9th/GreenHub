import React from 'react';

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
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Search for the Item</h3>
            <p>Use the search bar at the top of the page. You can type in exactly what you're looking for, or browse through our categories like Electronics, Vehicles, and Fashion.</p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">2</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Review Sellers & Item Details</h3>
            <p>Read the description carefully and check the seller's profile. Look out for "Verified Seller" badges and positive reviews to ensure you are dealing with reputable sellers.</p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">3</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat with the Seller</h3>
            <p>Don't hesitate to use our built-in chat to ask the seller questions or negotiate the price. It's safe and keeps your personal phone number private until you're ready to meet.</p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">4</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Meet Safely & Pay</h3>
            <p>Arrange to meet the seller in a public, well-lit place (like a mall or a busy street). Thoroughly inspect the item to make sure it matches the description before making any payment. <strong>Never pay in advance for delivery!</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
