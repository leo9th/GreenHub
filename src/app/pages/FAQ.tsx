import React from 'react';

export default function FAQ() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h1>
      <div className="space-y-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">How do I sell an item?</h3>
          <p className="mt-2 text-gray-600">Click on the "Sell" button at the top or bottom navigation bar, fill in the product details, upload clear photos, and publish your ad. It's completely free to start!</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">Is it safe to buy on GreenHub?</h3>
          <p className="mt-2 text-gray-600">Yes, but always remember to use common sense. Meet in public places, inspect the item thoroughly before paying, and never pay in advance unless securely handled by a trusted verified system.</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">How can I contact support?</h3>
          <p className="mt-2 text-gray-600">You can easily reach us via email at support@greenhub.ng or contact us via WhatsApp/Tel at +234 812 522 1542.</p>
        </div>
      </div>
    </div>
  );
}
