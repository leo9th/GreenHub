import React from 'react';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
      <div className="prose text-gray-700">
        <p className="mb-4">At GreenHub, we take your privacy extremely seriously. This policy explains how we collect, use, and protect your personal information.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Information We Collect</h2>
        <p className="mb-4">We collect details provided during registration (Name, Email, Phone number) as well as usage data to improve our marketplace experience.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">How We Use Information</h2>
        <p className="mb-4">Your information is solely used to verify your identity, secure transactions, and connect you properly with other users on the platform. We will never sell your personal data to third parties.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">Data Security</h2>
        <p className="mb-4">We implement industry-standard encryption and robust database scaling to ensure your personal data is protected against unauthorized access.</p>
      </div>
    </div>
  );
}
