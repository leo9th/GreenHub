import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { session } = useAuth();

  // If already logged in (e.g. from clicking an implicit grant confirmation link)
  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  // Handle PKCE Email Confirmation Flow
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setLoading(true);
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        setLoading(false);
        if (!error) {
          toast.success("Email confirmed successfully! You are now logged in.");
          navigate("/");
        } else {
          toast.error("Verification link expired or invalid.");
          setError("Verification failed. Please try logging in or requesting a new link.");
          // Clear code from URL to prevent infinite loop
          navigate("/login", { replace: true });
        }
      });
    } else {
      // Check for implicit grant error pattern in URL hash
      const hash = window.location.hash;
      if (hash && hash.includes("error_description")) {
        const params = new URLSearchParams(hash.substring(1));
        const errorDesc = params.get("error_description");
        if (errorDesc) {
           setError(errorDesc.replace(/\+/g, " "));
           // Clear hash from URL
           window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      } else if (hash && hash.includes("access_token")) {
        // Implicit grant successful. The AuthContext automatically grabs the session,
        // so the `session` effect above will handle the redirect.
        toast.success("Email confirmed successfully! You are now logged in.");
      }
    }
  }, [searchParams, navigate]);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (signInError) {
      toast.error(`Failed to sign in securely: ${signInError.message}`);
      setError(signInError.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col pt-12">
      <div className="px-4 py-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-8">
          <Link to="/" className="text-4xl font-bold text-[#22c55e] flex items-center justify-center gap-2 mb-2 hover:opacity-80 transition-opacity">
            🌿 GreenHub
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Welcome Back</h1>
          <p className="text-gray-600">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 max-w-md mx-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 text-[#22c55e] rounded focus:ring-[#22c55e]" />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-[#22c55e] hover:underline">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22c55e] text-white py-3 rounded-lg font-medium hover:bg-[#16a34a] transition-colors flex justify-center items-center gap-2 disabled:opacity-70 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <div className="flex items-center gap-4 my-8 max-w-md mx-auto">
          <div className="flex-1 border-t border-gray-200"></div>
          <span className="text-sm text-gray-500">Or continue with</span>
          <div className="flex-1 border-t border-gray-200"></div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8 max-w-md mx-auto">
          <button 
            type="button"
            onClick={() => handleSocialLogin('google')}
            className="flex items-center justify-center gap-2 border border-gray-200 py-3 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-gray-700"
          >
            <span className="text-xl">G</span> Google
          </button>
          <button 
            type="button"
            onClick={() => handleSocialLogin('facebook')}
            className="flex items-center justify-center gap-2 border border-gray-200 py-3 rounded-lg hover:bg-[#1877F2] hover:text-white transition-colors hover:border-[#1877F2] font-semibold text-gray-700"
          >
            <span className="text-xl">f</span> Facebook
          </button>
        </div>

        <p className="text-center text-gray-600">
          New to GreenHub?{" "}
          <Link to="/register" className="text-[#22c55e] font-medium hover:underline">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
