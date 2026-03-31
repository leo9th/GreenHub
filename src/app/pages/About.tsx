import React from 'react';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">About GreenHub</h1>
      <div className="prose prose-lg text-gray-700 space-y-6">
        <p>
          Welcome to GreenHub, Nigeria's most trusted C2C (Consumer-to-Consumer) marketplace. We are dedicated to providing a safe, fast, and seamless platform for buyers and sellers across the nation.
        </p>
        <p>
          Our mission is to empower individuals and small businesses by creating a robust digital economy where anyone can trade with confidence. Whether you are looking for the latest electronics, trendy fashion items, a reliable vehicle, or prime real estate, GreenHub connects you natively to quality offerings.
        </p>
        <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Our Services</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Secure Transactions:</strong> We provide safety guidelines and verification tools to enhance trust.</li>
          <li><strong>Nationwide Reach:</strong> Access thousands of active listings from every state and LGA in Nigeria.</li>
          <li><strong>Instant Messaging:</strong> Communicate directly with buyers or sellers safely within the app.</li>
          <li><strong>Local Delivery Support:</strong> Resources to help you calculate and arrange local logistics.</li>
        </ul>
        <p className="mt-8">
          Join the GreenHub community today and experience a marketplace tailored precisely for you!
        </p>
      </div>
    </div>
  );
}
