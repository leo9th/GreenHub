import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, User, Lock, Globe, Bell, Shield, HelpCircle, Trash2, ChevronRight } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      // Delete account logic
      console.log("Delete account");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Settings</h1>
        </div>
      </header>

      <div className="px-4 py-4 max-w-7xl mx-auto space-y-4">
        {/* Account Settings */}
        <div className="bg-white rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Account Settings</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => navigate("/settings/profile/edit")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Personal Information</p>
                  <p className="text-sm text-gray-600">Update your profile details</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => navigate("/settings/password")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Change Password</p>
                  <p className="text-sm text-gray-600">Update your password</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => navigate("/settings/address")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">📍</span>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Saved Addresses</p>
                  <p className="text-sm text-gray-600">Manage delivery addresses</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Notifications</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-800">Push Notifications</p>
                  <p className="text-sm text-gray-600">Get updates about your orders</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#22c55e]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">📧</span>
                <div>
                  <p className="font-medium text-gray-800">Email Updates</p>
                  <p className="text-sm text-gray-600">Receive promotional emails</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailUpdates}
                  onChange={(e) => setEmailUpdates(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#22c55e]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="bg-white rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Privacy & Security</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => navigate("/settings/privacy")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Privacy Settings</p>
                  <p className="text-sm text-gray-600">Control your privacy</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => navigate("/settings/blocked-users")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🚫</span>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Blocked Users</p>
                  <p className="text-sm text-gray-600">Manage blocked accounts</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Preferences</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => navigate("/settings/language")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Language</p>
                  <p className="text-sm text-gray-600">English (Nigeria)</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Support */}
        <div className="bg-white rounded-lg">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Support</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <button
              onClick={() => navigate("/help")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-800">Help Center</p>
                  <p className="text-sm text-gray-600">FAQs and support</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => navigate("/contact")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div className="text-left">
                  <p className="font-medium text-gray-800">Contact Us</p>
                  <p className="text-sm text-gray-600">Get in touch with support</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={() => navigate("/about")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">ℹ️</span>
                <div className="text-left">
                  <p className="font-medium text-gray-800">About</p>
                  <p className="text-sm text-gray-600">Version 1.0.0</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Delete Account */}
        <div className="bg-white rounded-lg">
          <button
            onClick={handleDeleteAccount}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-600" />
              <div className="text-left">
                <p className="font-medium text-red-600">Delete Account</p>
                <p className="text-sm text-gray-600">Permanently delete your account</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* App Version */}
        <p className="text-center text-sm text-gray-500">
          GreenHub v1.0.0
        </p>
      </div>
    </div>
  );
}
