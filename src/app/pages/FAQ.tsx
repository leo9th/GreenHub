import React from "react";
import { Link } from "react-router";

export default function FAQ() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h1>
      <div className="space-y-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">How do I browse items for sale?</h3>
          <p className="mt-2 text-gray-600">
            Tap <strong>Shop</strong> next to the GreenHub logo (or use the green <strong>Shop</strong> shortcut in the bottom bar on your phone). You can also search from the home page — the same search takes you to the full listings view with your words applied as a filter.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">How do I sell an item?</h3>
          <p className="mt-2 text-gray-600">
            After you sign in, use the orange <strong>SELL</strong> button in the top bar to add a listing. The bottom bar has a <strong>How to sell</strong> guide if you want step-by-step help. It is free to start — add details, clear photos, then publish.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">Where is my cart and how do I check out?</h3>
          <p className="mt-2 text-gray-600">
            The <strong>cart</strong> icon is in the top bar next to the logo. Open it to review items and continue to checkout from there. You need to be signed in for some steps.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">How do I see my orders or track a purchase?</h3>
          <p className="mt-2 text-gray-600">
            When you are signed in, open your avatar menu in the top bar and tap <strong>Orders</strong>. That page lists your purchases and their status. You can also{" "}
            <Link to="/orders" className="text-[#22c55e] font-semibold hover:underline">
              open your orders page here
            </Link>
            . For questions about a specific item, use <strong>Messages</strong> (speech bubble in the top bar) to chat with the seller.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">How do I message a seller?</h3>
          <p className="mt-2 text-gray-600">
            Sign in, then open <strong>Messages</strong> from the top bar. You can start or continue a conversation from a product page or your inbox so your phone number stays private until you choose to share it.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">Is it safe to buy on GreenHub?</h3>
          <p className="mt-2 text-gray-600">
            Yes, but always remember to use common sense. Meet in public places, inspect the item thoroughly before paying, and never pay in advance unless securely handled by a trusted verified system.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg text-gray-900">How can I contact support?</h3>
          <p className="mt-2 text-gray-600">
            You can easily reach us via email at support@greenhub.ng or contact us via WhatsApp/Tel at +234 812 522 1542.
          </p>
        </div>
      </div>
    </div>
  );
}
