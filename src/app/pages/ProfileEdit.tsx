import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Camera, User, Mail, Phone, MapPin, Save } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../../lib/supabase";

const ALLOWED_GENDERS = ["Male", "Female", "Prefer not to say"] as const;
type AllowedGender = (typeof ALLOWED_GENDERS)[number];

function normalizeGender(value?: string | null): AllowedGender {
  return ALLOWED_GENDERS.includes(value as AllowedGender) ? (value as AllowedGender) : "Prefer not to say";
}

export default function ProfileEdit() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile, user: authUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [profileImage, setProfileImage] = useState("https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    autoReply: "",
    bio: "",
    gender: "Prefer not to say"
  });

  useEffect(() => {
    if (authUser || profile) {
      setFormData({
        name: profile?.full_name || authUser?.user_metadata?.full_name || "",
        email: profile?.email || authUser?.email || "",
        phone: profile?.phone || authUser?.user_metadata?.phone || "",
        location: profile?.address || authUser?.user_metadata?.address || "",
        autoReply: profile?.auto_reply || authUser?.user_metadata?.auto_reply || "",
        bio: profile?.bio || (authUser?.user_metadata as { bio?: string })?.bio || "",
        gender: normalizeGender(profile?.gender || authUser?.user_metadata?.gender)
      });
      if (profile?.avatar_url || authUser?.user_metadata?.avatar_url) {
        setProfileImage(profile?.avatar_url || authUser?.user_metadata?.avatar_url);
      }
    }
  }, [profile, authUser]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Store real file for backend processing
      setSelectedFile(file);
      // Create a local object URL to preview the passport/profile image immediately
      const imageUrl = URL.createObjectURL(file);
      setProfileImage(imageUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setIsLoading(true);

    try {
      let finalAvatarUrl = profileImage;
      const normalizedGender = normalizeGender(formData.gender);

      // If user provided a tangible image file, push to Supabase storage
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${authUser.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, selectedFile);
          
        if (uploadError) {
          throw new Error('Failed to upload image. Please try again.');
        }

        // Successfully stored, now fetch public string URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        finalAvatarUrl = publicUrl;
      }

      // Update auth meta data
      await supabase.auth.updateUser({
        data: {
          full_name: formData.name,
          phone: formData.phone,
          address: formData.location,
          auto_reply: formData.autoReply,
          bio: formData.bio.trim() || undefined,
          gender: normalizedGender,
          avatar_url: finalAvatarUrl !== "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200" ? finalAvatarUrl : null,
        }
      });
      
      // Upsert into profile table
      await supabase.from("profiles").upsert({
        id: authUser.id,
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.location,
        auto_reply: formData.autoReply,
        bio: formData.bio.trim() || null,
        gender: normalizedGender,
        avatar_url: finalAvatarUrl !== "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200" ? finalAvatarUrl : null,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

      alert("Profile updated successfully!");
      // Reload the page to ensure fresh AuthContext values propagate everywhere
      window.location.href = "/profile";
    } catch (error) {
      console.error(error);
      alert("Error saving profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-20 pt-6">
      <div className="max-w-[1000px] mx-auto px-4 flex flex-col md:flex-row gap-6">
        
        {/* Left Sidebar (Settings Navigation) */}
        <div className="w-full md:w-[280px] flex-shrink-0">
          <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
            <button onClick={() => navigate(-1)} className="w-full flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 text-gray-800 font-semibold">
              <ArrowLeft className="w-4 h-4" />
              Settings
            </button>
            
            <div className="flex flex-col">
              <a href="#" className="p-4 border-b border-gray-100 text-[#22c55e] font-medium text-sm">Personal details</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm flex justify-between">Business details <span className="text-gray-400">&gt;</span></a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm mt-2">Add phone number</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm">Change email</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm">Change language</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm flex justify-between mt-2">Automatic ad sharing <span className="text-xs text-[#22c55e] font-bold">New!</span></a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm">Disable chats</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm">Disable Feedback</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm mt-2">Manage notifications</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm mt-2">Change password</a>
              <a href="#" className="p-4 border-b border-gray-100 text-gray-600 font-medium text-sm">Delete my account permanently</a>
              <a href="#" onClick={() => navigate("/login")} className="p-4 text-gray-600 font-medium text-sm">Log out</a>
            </div>
          </div>
        </div>

        {/* Main Content (Personal Details) */}
        <div className="flex-1">
          <div className="bg-white rounded shadow-sm border border-gray-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Personal details</h2>
              <button 
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-[#dcfce7] text-[#16a34a] font-medium text-sm px-4 py-1.5 rounded-full hover:bg-green-200 transition-colors disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Saved"}
              </button>
            </div>

            <div className="p-6 md:p-10 max-w-md mx-auto">
              {/* Avatar Section */}
              <div className="flex justify-center mb-8 relative">
                <div className="relative w-24 h-24">
                  <div className="w-full h-full rounded-full border-4 border-[#dcfce7] overflow-hidden bg-gray-100">
                    <img 
                      src={profileImage} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-[#f4f5f7] border border-gray-300 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-100 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path>
                      <path d="m15 5 4 4"></path>
                    </svg>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-5">
                {/* Name */}
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-[#22c55e] font-semibold">First Name*</label>
                  <input
                    type="text"
                    value={formData.name.split(" ")[0] || ""}
                    onChange={(e) => {
                      const lastName = formData.name.split(" ").slice(1).join(" ");
                      setFormData({...formData, name: `${e.target.value} ${lastName}`.trim()});
                    }}
                    className="w-full border border-gray-300 rounded p-3 text-sm focus:border-[#22c55e] focus:outline-none text-gray-800"
                  />
                  <span className="absolute -top-4 right-0 text-[10px] text-gray-400">5 / 20</span>
                </div>

                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-[#22c55e] font-semibold">Last Name*</label>
                  <input
                    type="text"
                    value={formData.name.split(" ").slice(1).join(" ") || ""}
                    onChange={(e) => {
                      const firstName = formData.name.split(" ")[0] || "";
                      setFormData({...formData, name: `${firstName} ${e.target.value}`.trim()});
                    }}
                    className="w-full border border-gray-300 rounded p-3 text-sm focus:border-[#22c55e] focus:outline-none text-gray-800"
                  />
                  <span className="absolute -top-4 right-0 text-[10px] text-gray-400">3 / 20</span>
                </div>

                {/* Location */}
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 font-semibold">Select Location*</label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full border border-gray-300 rounded p-3 text-sm focus:border-[#22c55e] focus:outline-none text-gray-800 appearance-none bg-transparent"
                  >
                    <option value="">Select location</option>
                    <option value="Lagos">Lagos</option>
                    <option value="Abuja">Abuja</option>
                    <option value="Kano">Kano</option>
                    <option value="Rivers">Rivers</option>
                  </select>
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>

                {/* Bio (public profile) */}
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-[#22c55e] font-semibold">About you (bio)</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Short intro buyers see on your profile..."
                    rows={3}
                    className="w-full border border-gray-300 rounded p-3 text-sm focus:border-[#22c55e] focus:outline-none text-gray-800 resize-y"
                  />
                </div>

                {/* Auto Reply (Substituting for Birthday) */}
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 font-semibold">Auto-Reply Message</label>
                  <input
                    type="text"
                    value={formData.autoReply}
                    onChange={(e) => setFormData({...formData, autoReply: e.target.value})}
                    placeholder="Auto reply msg..."
                    className="w-full border border-gray-300 rounded p-3 text-sm focus:border-[#22c55e] focus:outline-none text-gray-800"
                  />
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  </div>
                </div>

                {/* Sex */}
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-[#22c55e] font-semibold">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="w-full border border-gray-300 rounded p-3 text-sm focus:border-[#22c55e] focus:outline-none text-gray-800 appearance-none bg-transparent"
                  >
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>

                {/* Social Connect CTA */}
                <div className="mt-8 bg-[#f4f7f8] rounded-xl p-4 flex items-center gap-3 relative">
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#f4f7f8] rotate-45"></div>
                  <span className="text-xl">👏🏽</span>
                  <p className="text-xs text-gray-700 font-medium">Connect your social media accounts<br/>for smoother experience!</p>
                </div>

                {/* Social Toggles */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">T</div>
                      <span className="text-sm font-medium text-gray-800">Truecaller</span>
                    </div>
                    <div className="w-10 h-5 bg-gray-200 rounded-full relative">
                      <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      <span className="text-sm font-medium text-gray-800">Google</span>
                    </div>
                    <div className="w-10 h-5 bg-[#22c55e] rounded-full relative">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/></svg>
                      <span className="text-sm font-medium text-gray-800">Facebook</span>
                    </div>
                    <div className="w-10 h-5 bg-gray-200 rounded-full relative">
                      <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full bg-[#d2dbd7] text-gray-500 font-semibold py-3 rounded text-sm hover:bg-gray-300 transition-colors"
                  >
                    Saved
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
