import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";

export function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl text-foreground mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to continue shopping</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-foreground mb-2">
              Email or Phone Number
            </label>
            <input
              type="text"
              placeholder="Enter your email or phone"
              className="w-full px-4 py-3 rounded-lg bg-input-background border border-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>

          <div>
            <label className="block text-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              <span className="text-sm text-muted-foreground">Remember me</span>
            </label>
            <Link to="#" className="text-sm text-[#22c55e]">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full bg-[#22c55e] text-white py-3 rounded-lg hover:bg-[#16a34a] transition-colors"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/auth/register" className="text-[#22c55e]">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
