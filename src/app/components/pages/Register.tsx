import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, User, ShoppingBag } from "lucide-react";

export function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl text-foreground mb-2">Create Account</h1>
          <p className="text-muted-foreground">Join GreenHub marketplace</p>
        </div>

        <div className="mb-6">
          <label className="block text-foreground mb-3">I want to:</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("buyer")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                role === "buyer"
                  ? "border-[#22c55e] bg-[#22c55e]/5"
                  : "border-border bg-white"
              }`}
            >
              <User className={`w-8 h-8 ${role === "buyer" ? "text-[#22c55e]" : "text-muted-foreground"}`} />
              <span className={role === "buyer" ? "text-[#22c55e]" : "text-foreground"}>
                Buy Products
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRole("seller")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                role === "seller"
                  ? "border-[#22c55e] bg-[#22c55e]/5"
                  : "border-border bg-white"
              }`}
            >
              <ShoppingBag className={`w-8 h-8 ${role === "seller" ? "text-[#22c55e]" : "text-muted-foreground"}`} />
              <span className={role === "seller" ? "text-[#22c55e]" : "text-foreground"}>
                Sell Products
              </span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-foreground mb-2">Full Name</label>
            <input
              type="text"
              placeholder="Enter your full name"
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>

          <div>
            <label className="block text-foreground mb-2">Email Address</label>
            <input
              type="email"
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>

          <div>
            <label className="block text-foreground mb-2">Phone Number</label>
            <input
              type="tel"
              placeholder="080 1234 5678"
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>

          <div>
            <label className="block text-foreground mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded" required />
            <span className="text-sm text-muted-foreground">
              I agree to GreenHub's Terms of Service and Privacy Policy
            </span>
          </label>

          <button
            type="submit"
            className="w-full bg-[#22c55e] text-white py-3 rounded-lg hover:bg-[#16a34a] transition-colors"
          >
            Create Account
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth/login" className="text-[#22c55e]">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
