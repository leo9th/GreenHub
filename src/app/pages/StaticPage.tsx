import { useParams, Link } from "react-router";
import { ArrowLeft } from "lucide-react";

export const pageContent: Record<string, { title: string; content: React.ReactNode }> = {
  about: {
    title: "About GreenHub",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>GreenHub is your premier global marketplace for buying and selling goods directly with people in your community and around the world.</p>
        <p>Our mission is to provide a safe, secure, and fast platform where anyone can turn their unused items into cash, or find amazing deals on electronics, vehicles, fashion, and real estate.</p>
        <p>Founded on the principles of trust and simplicity, GreenHub is designed to be deeply integrated with local communities.</p>
      </div>
    )
  },
  careers: {
    title: "Join the GreenHub Team",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>We are a fast-growing, innovative technology company looking for passionate individuals to join us in revolutionizing e-commerce.</p>
        <p>Currently, all positions are filled, but please check back later or send your resume to careers@greenhub.local.</p>
      </div>
    )
  },
  terms: {
    title: "Terms & Conditions",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>Welcome to GreenHub! By using our platform, you agree to these terms.</p>
        <h3 className="font-bold text-lg mt-4 text-gray-900 border-b border-gray-100 pb-1">1. Using our Services</h3>
        <p>You must follow any policies made available to you within the Services. Do not misuse our Services or try to access them using a method other than the interface and the instructions that we provide.</p>
        <h3 className="font-bold text-lg mt-4 text-gray-900 border-b border-gray-100 pb-1">2. Your Content</h3>
        <p>Some of our Services allow you to upload, submit, store, send or receive content. You retain ownership of any intellectual property rights that you hold in that content.</p>
      </div>
    )
  },
  privacy: {
    title: "Privacy Policy",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>Your privacy matters to us at GreenHub.</p>
        <p>We collect information to provide better services to all our users – from figuring out basic stuff like which language you speak, to more complex things like which ads you’ll find most useful.</p>
        <p>We do not sell your personal information to third parties.</p>
      </div>
    )
  },
  billing: {
    title: "Billing Policy",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>All premium ads and promotional services purchased on GreenHub are non-refundable unless otherwise specified by law.</p>
        <p>Payments are processed securely through our trusted payment partners.</p>
      </div>
    )
  },
  "candidate-privacy": {
    title: "Candidate Privacy Policy",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>If you apply for a job at GreenHub, we collect your professional history and contact details solely for recruitment purposes.</p>
        <p>We will keep your details on file for 12 months unless you request otherwise.</p>
      </div>
    )
  },
  cookie: {
    title: "Cookie Policy",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>GreenHub uses cookies to improve your browsing experience.</p>
        <p>Cookies are small text files stored on your device that help us remember your preferences, like your selected region and active session.</p>
      </div>
    )
  },
  copyright: {
    title: "Copyright Infringement",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>We respect intellectual property rights. If you believe your copyrighted work has been posted on GreenHub without authorization, please contact our support team immediately.</p>
      </div>
    )
  },
  safety: {
    title: "Safety Tips",
    content: (
      <div className="space-y-4 text-gray-700">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Never pay in advance:</strong> Meet the seller and inspect the item before you transfer any funds.</li>
          <li><strong>Meet in a public place:</strong> For your own safety, always arrange to meet buyers or sellers in busy, public areas.</li>
          <li><strong>Check the item thoroughly:</strong> Make sure the item matches the description and is fully functional before completing the transaction.</li>
          <li><strong>Protect your personal information:</strong> Do not share your bank details, BVN, or passwords with anyone on the platform.</li>
        </ul>
      </div>
    )
  },
  contact: {
    title: "Contact Us",
    content: (
      <div className="space-y-4 text-gray-700">
        <p>If you need help, our support team is available 24/7.</p>
        <p><strong>Email:</strong> support@greenhub.local</p>
        <p><strong>Phone:</strong> +1 (555) 000-0000</p>
        <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-500 italic">Interactive contact form coming soon...</p>
        </div>
      </div>
    )
  },
  faq: {
    title: "Frequently Asked Questions",
    content: (
      <div className="space-y-6 text-gray-700">
        <div>
          <h3 className="font-bold text-lg text-gray-900 border-b border-gray-100 pb-1">How do I post an ad?</h3>
          <p className="mt-2">Click the "Sell" button in the bottom navigation menu, fill in the details of your item, upload some clear photos, and publish your ad instantly.</p>
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900 border-b border-gray-100 pb-1">How much does it cost to use GreenHub?</h3>
          <p className="mt-2">Posting standard ads on GreenHub is entirely free! We only charge for premium or promoted listings that get more visibility.</p>
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900 border-b border-gray-100 pb-1">How do I change my location?</h3>
          <p className="mt-2">Click the location dropdown in the top header. You can switch between Nigeria, USA, and China to see local products and currencies.</p>
        </div>
      </div>
    )
  }
};

export default function StaticPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = pageContent[slug || ""] || {
    title: "Page Not Found",
    content: <p>The page you are looking for does not exist or is still under construction.</p>
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 min-h-[60vh]">
      <Link to="/" className="inline-flex items-center text-[#22c55e] hover:underline mb-8 font-medium bg-green-50 px-3 py-1.5 rounded-full">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Home
      </Link>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 pb-4 border-b border-gray-100">
          {page.title}
        </h1>
        <div className="text-base leading-relaxed">
          {page.content}
        </div>
      </div>
    </div>
  );
}
