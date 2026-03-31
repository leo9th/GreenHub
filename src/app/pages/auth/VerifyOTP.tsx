import { Link, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function VerifyOTP() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(59);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 py-6 max-w-7xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="p-2 mb-6">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#22c55e]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📱</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Verify Your Phone</h1>
          <p className="text-gray-600">We sent a 6-digit code to</p>
          <p className="font-medium text-gray-800">+234 XXX XXX 1234</p>
        </div>

        <div className="mb-6">
          <div className="flex gap-3 justify-center mb-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
              />
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={otp.some((d) => !d)}
            className="w-full bg-[#22c55e] text-white py-3 rounded-lg font-medium hover:bg-[#16a34a] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Verify
          </button>
        </div>

        <div className="text-center">
          <p className="text-gray-600 mb-2">
            Didn't receive code?{" "}
            {countdown > 0 ? (
              <span className="text-gray-500">Resend in {countdown}s</span>
            ) : (
              <button className="text-[#22c55e] font-medium">Resend</button>
            )}
          </p>
          <Link to="/register" className="text-[#22c55e] text-sm">
            Change Phone Number
          </Link>
        </div>
      </div>
    </div>
  );
}
