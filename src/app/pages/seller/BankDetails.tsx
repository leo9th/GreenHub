import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { nigerianBanks } from "../../data/catalogConstants";
import { useCurrency } from "../../hooks/useCurrency";

export default function BankDetails() {
  const formatPrice = useCurrency();
  const navigate = useNavigate();
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleVerifyAccount = () => {
    if (!bankName || accountNumber.length !== 10) return;

    setIsVerifying(true);
    // Simulate account verification
    setTimeout(() => {
      setAccountName("John Doe Enterprises");
      setIsVerified(true);
      setIsVerifying(false);
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Submit bank details
    console.log({ bankName, accountNumber, accountName });
    navigate("/seller/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Bank Details</h1>
        </div>
      </header>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Setup Your Bank Account</h3>
              <p className="text-sm text-gray-700">
                Add your bank account to receive payments from your sales. We'll verify your account details.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 space-y-4">
          {/* Bank Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bank Name *
            </label>
            <select
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
                setIsVerified(false);
                setAccountName("");
              }}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="">Select your bank</option>
              {nigerianBanks.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Number *
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                setAccountNumber(value);
                setIsVerified(false);
                setAccountName("");
              }}
              required
              maxLength={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="0123456789"
            />
            <p className="text-xs text-gray-600 mt-1">Enter your 10-digit account number</p>
          </div>

          {/* Verify Button */}
          {bankName && accountNumber.length === 10 && !isVerified && (
            <button
              type="button"
              onClick={handleVerifyAccount}
              disabled={isVerifying}
              className="w-full py-2 border border-[#22c55e] text-[#22c55e] rounded-lg font-medium disabled:opacity-50"
            >
              {isVerifying ? "Verifying..." : "Verify Account"}
            </button>
          )}

          {/* Account Name (After Verification) */}
          {isVerified && (
            <div className="p-4 bg-[#22c55e]/10 border border-[#22c55e] rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-[#22c55e] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Account Verified</p>
                  <p className="text-lg font-bold text-gray-900">{accountName}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isVerified}
            className="w-full py-3 bg-[#22c55e] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Bank Details
          </button>
        </form>

        {/* Security Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Security & Privacy</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Your bank details are encrypted and secure</li>
            <li>• We only use this for transferring your earnings</li>
            <li>• You can update your bank details anytime</li>
            <li>• Withdrawals are processed within 24 hours</li>
          </ul>
        </div>

        {/* Current Bank (if exists) */}
        <div className="bg-white rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Current Bank Account</h3>
          <div className="text-center py-6 text-gray-500">
            <p className="text-sm">No bank account added yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
