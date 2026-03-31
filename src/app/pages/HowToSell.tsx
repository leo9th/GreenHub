import React from 'react';

export default function HowToSell() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-8">How to Sell on GreenHub</h1>
      <div className="space-y-8 text-gray-700 prose prose-lg">
        <p className="text-lg">
          Selling your items on GreenHub is fast, free, and incredibly easy. Follow these simple steps to reach thousands of potential buyers across Nigeria.
        </p>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">1</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Create an Account</h3>
            <p>Sign up using your email and phone number. Verify your details so buyers know you are a genuine seller. Go to the "Profile" section and set up your seller profile.</p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">2</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Take Clear Photos</h3>
            <p>Snap good, bright photos of your item from multiple angles. Make sure the background is clean. Good photos are the easiest way to sell your item fast!</p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">3</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Click "Sell" and Fill the Details</h3>
            <p>Tap the big "Sell" button. Choose the right category, add a descriptive title, set a fair price, and write an honest description of the item's condition.</p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-green-100 text-green-700 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0 mt-1">4</div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Reply to Messages & Close the Deal</h3>
            <p>Soon, interested buyers will message you through our in-app chat. Agree on a meeting place, preferably open and public, let them inspect the item, and receive your payment safely!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
