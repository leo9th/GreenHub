import React from 'react';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms & Conditions</h1>
      <div className="prose text-gray-700">
        <p className="mb-4">By using GreenHub, you agree to comply with our Terms & Conditions. Read these guidelines carefully as they outline the rules for buying and selling on our platform.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. User Responsibilities</h2>
        <p className="mb-4">Users must provide accurate information when registering and listing items. Fraudulent or misleading listings will result in instant ban and possible legal action.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. Prohibited Items</h2>
        <p className="mb-4">Selling illegal goods, stolen items, or restricted materials is strictly forbidden. Please refer to our robust safety guidelines before placing an ad.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Limitation of Liability</h2>
        <p className="mb-4">GreenHub is an intermediary platform connecting buyers and sellers. We are not liable for direct disputes arising from offline transactions. Please use caution and adhere to our safety tips.</p>
      </div>
    </div>
  );
}
