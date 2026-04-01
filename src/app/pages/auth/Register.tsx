import { Link, useNavigate } from "react-router";
import { Eye, EyeOff, ArrowLeft, HelpCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { nigerianStates, getLGAsForState } from "../../data/mockData";
import { supabase } from "../../../lib/supabase";

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"options" | "form">("options");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Prefer not to say");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const selectedRole = "buyer"; // Unified accounts 
  const [selectedState, setSelectedState] = useState("");
  const [lga, setLga] = useState("");
  const [address, setAddress] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lgas = selectedState ? getLGAsForState(selectedState) : [];

  const getPasswordStrength = () => {
    if (password.length === 0) return { label: "", color: "" };
    if (password.length < 6) return { label: "Weak", color: "bg-[#ef4444]" };
    if (password.length < 10) return { label: "Medium", color: "bg-[#eab308]" };
    return { label: "Strong", color: "bg-[#22c55e]" };
  };

  const strength = getPasswordStrength();

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (signInError) {
      setError(`Failed to sign in with ${provider}: ${signInError.message}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: fullName,
          phone: phone,
          role: selectedRole,
          gender: gender,
          state: selectedState,
          lga: lga,
          address: address,
        }
      }
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("rate limit")) {
        setError("Test Limit Reached: You've created too many accounts recently! Please wait a bit, or increase your 'Email Rate Limits' directly in your Supabase Dashboard settings.");
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
    } else {
      if (data?.session) {
        navigate("/");
      } else {
        setError("Registration succeeded! Check your email to verify your account (or disable 'Confirm Email' in Supabase Auth Settings).");
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-lg shadow-2xl overflow-hidden">
        
        {/* Header Ribbon exactly like Jiji */}
        {step === "options" ? (
          <div className="flex border-b border-gray-100">
            <button className="flex-1 py-4 text-[#22c55e] font-bold border-b-[3px] border-[#22c55e] text-[15px]">English</button>
            <button className="flex-1 py-4 text-gray-400 font-medium border-b-[3px] border-transparent hover:bg-gray-50 text-[15px] cursor-not-allowed">Hausa</button>
          </div>
        ) : (
          <div className="flex items-center p-4 border-b border-gray-100 bg-[#22c55e] text-white">
            <button onClick={() => setStep("options")} className="p-2 -ml-2 hover:bg-white/20 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <span className="font-bold text-lg flex-1 text-center pr-6">Register</span>
          </div>
        )}

        <div className="p-6 md:p-8">
          {step === "options" ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="text-3xl">🌿</span>
                <span className="text-2xl font-black tracking-tight text-[#00695c]">GreenHub</span>
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleSocialLogin('google')}
                  className="flex items-center justify-center gap-6 w-full py-3.5 border border-gray-300 rounded shadow-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors text-[15px]"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Google
                </button>
                
                <button 
                  onClick={() => handleSocialLogin('facebook')}
                  className="flex items-center justify-center gap-6 w-full py-3.5 bg-[#1877F2] text-white rounded font-bold hover:bg-[#166fe5] transition-colors shadow-sm text-[15px]"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#ffffff"/></svg>
                  Facebook
                </button>

                <button 
                  onClick={() => setStep("form")}
                  className="w-full py-3.5 mt-2 bg-[#22c55e] text-white rounded font-bold hover:bg-[#16a34a] transition-colors shadow-sm text-[15px]"
                >
                  Register via email or phone
                </button>
              </div>

              <p className="mt-8 text-[15px] font-bold tracking-wide">
                Already have an account? <Link to="/login" className="text-[#22c55e] hover:underline">Sign in</Link>
              </p>

              <p className="mt-6 text-[12px] text-gray-400 max-w-[280px] mx-auto leading-relaxed font-medium">
                By continuing you agree to our <br/><Link to="/terms" className="underline hover:text-gray-600">Terms</Link> and <Link to="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">Complete Your Details</h1>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 font-medium text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e]"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e]"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number (e.g. 080XXXXXXXX)"
                    className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e]"
                  />
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password && (
                  <div className="text-left mt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${strength.color} transition-all`} style={{ width: password.length < 6 ? "33%" : password.length < 10 ? "66%" : "100%" }}></div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">{strength.label}</span>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] pr-12"
                  />
                </div>

                <div className="pt-2">
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] appearance-none bg-transparent"
                  >
                    <option value="Prefer not to say">Prefer not to say (Default)</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div className="pt-2">
                  <select
                    required
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] appearance-none bg-transparent"
                  >
                    <option value="">Select State</option>
                    {nigerianStates.map((state) => (
                      <option key={state.code} value={state.name}>{state.name}</option>
                    ))}
                  </select>
                </div>

                {selectedState && (
                  <div>
                    <select 
                      required
                      value={lga}
                      onChange={(e) => setLga(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#22c55e] focus:border-[#22c55e] appearance-none bg-transparent"
                    >
                      <option value="">Select LGA</option>
                      {lgas.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#f97316] text-white py-3.5 rounded font-bold text-[15px] shadow-sm hover:bg-[#ea580c] transition-colors flex justify-center items-center gap-2 mt-6 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "CREATE ACCOUNT"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
