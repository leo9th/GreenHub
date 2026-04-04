import { Link } from "react-router";
import { Apple, Play } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#22c55e] text-white py-12 mt-12 w-full">
      <div className="max-w-7xl mx-auto px-4 md:px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-white">
          
          {/* Column 1 */}
          <div>
            <h3 className="font-bold text-lg mb-4">About us</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/about" className="hover:underline">About GreenHub</Link></li>
              <li><Link to="/apply" className="hover:underline">Apply for Job</Link></li>
              <li>
                <Link to="/workers" className="hover:underline">
                  Hire artisans &amp; workers (public directory)
                </Link>
              </li>
              <li><Link to="/terms" className="hover:underline">Terms & Conditions</Link></li>
              <li><Link to="/privacy" className="hover:underline">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h3 className="font-bold text-lg mb-4">Support</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="mailto:support@greenhub.ng" className="hover:underline">support@greenhub.ng</a></li>
              <li><a href="https://wa.me/2348125221542" className="hover:underline">+234 812 522 1542 (WhatsApp/Tel)</a></li>
              <li><Link to="/faq" className="hover:underline">FAQ</Link></li>
              <li><Link to="/how-to-sell" className="hover:underline">How to Sell</Link></li>
              <li><Link to="/how-to-buy" className="hover:underline">How to Buy</Link></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h3 className="font-bold text-lg mb-4">Our apps</h3>
            <div className="space-y-3">
              <a href="#" className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors w-max shadow-md">
                <Apple className="w-6 h-6" />
                <div className="flex flex-col">
                  <span className="text-[10px] leading-tight">Download on the</span>
                  <span className="text-sm font-semibold leading-tight">App Store</span>
                </div>
              </a>
              <a href="#" className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors w-max shadow-md">
                <Play className="w-5 h-5 ml-1" />
                <div className="flex flex-col ml-1">
                  <span className="text-[10px] leading-tight text-left">GET IT ON</span>
                  <span className="text-sm font-semibold leading-tight">Google Play</span>
                </div>
              </a>
            </div>
          </div>

          {/* Column 4 */}
          <div>
            <h3 className="font-bold text-lg mb-4">Our resources</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:underline">GreenHub on FB</a></li>
              <li><a href="#" className="hover:underline">Our Instagram</a></li>
              <li><a href="#" className="hover:underline">Our YouTube</a></li>
              <li><a href="#" className="hover:underline">Our Twitter</a></li>
            </ul>
          </div>

          {/* Column 5 */}
          <div>
            <h3 className="font-bold text-lg mb-4">Hot links</h3>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className="hover:underline">GreenHub Global</Link></li>
              <li><Link to="/" className="hover:underline">GreenHub Stores</Link></li>
            </ul>
          </div>

        </div>
      </div>
    </footer>
  );
}
