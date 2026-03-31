import { Link } from "react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      toast.success("Password reset instructions sent to your email.");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col pt-12">
      <div className="px-4 py-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-8">
          <Link to="/" className="text-4xl font-bold text-[#22c55e] flex items-center justify-center gap-2 mb-2 hover:opacity-80 transition-opacity">
            🌿 GreenHub
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Reset Password</h1>
          <p className="text-gray-600">Enter your email to receive a reset link</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4 max-w-md mx-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          {success && (
             <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center">
               Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22c55e] text-white py-3 rounded-lg font-medium hover:bg-[#16a34a] transition-colors flex justify-center items-center gap-2 disabled:opacity-70 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-8">
          Remember your password?{" "}
          <Link to="/login" className="text-[#22c55e] font-medium hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
