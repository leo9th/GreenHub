import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Bell, HelpCircle, Loader2, Lock, Save, Shield, Trash2, User } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { setNotificationSoundEnabled } from "../utils/soundNotifications";
import { toast } from "sonner";

type ProfileSettingsForm = {
  full_name: string;
  username: string;
  bio: string;
  avatar_url: string;
};

type PasswordForm = {
  newPassword: string;
  confirmPassword: string;
};

type SettingsPrefs = {
  push_notifications_enabled: boolean;
  email_updates_enabled: boolean;
  sound_notifications: boolean;
  show_phone_on_profile: boolean;
  show_email_on_profile: boolean;
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, loading, updateProfile, refreshProfile } = useAuth();
  const [profileForm, setProfileForm] = useState<ProfileSettingsForm>({
    full_name: "",
    username: "",
    bio: "",
    avatar_url: "",
  });
  const [email, setEmail] = useState("");
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newPassword: "",
    confirmPassword: "",
  });
  const [prefs, setPrefs] = useState<SettingsPrefs>({
    push_notifications_enabled: true,
    email_updates_enabled: true,
    sound_notifications: true,
    show_phone_on_profile: false,
    show_email_on_profile: false,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPref, setSavingPref] = useState<keyof SettingsPrefs | null>(null);

  const handleDeleteAccount = () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      toast.message("Contact support to permanently delete your account.");
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      full_name: profile?.full_name ?? user.user_metadata?.full_name ?? "",
      username: profile?.username ?? user.user_metadata?.username ?? "",
      bio: profile?.bio ?? user.user_metadata?.bio ?? "",
      avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? "",
    });
    setEmail(profile?.email ?? user.email ?? "");
    setPrefs((prev) => ({
      ...prev,
      show_phone_on_profile: Boolean(profile?.show_phone_on_profile),
      show_email_on_profile: Boolean(profile?.show_email_on_profile),
    }));
  }, [profile, user]);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const loadPrefs = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("push_notifications_enabled, email_updates_enabled, sound_notifications, show_phone_on_profile, show_email_on_profile")
        .eq("id", user.id)
        .maybeSingle();
      if (!alive) return;
      if (!error) {
        const row = data as Partial<SettingsPrefs> | null;
        setPrefs((prev) => {
          const next = {
            ...prev,
            push_notifications_enabled: row?.push_notifications_enabled !== false,
            email_updates_enabled: row?.email_updates_enabled !== false,
            sound_notifications: row?.sound_notifications !== false,
            show_phone_on_profile: Boolean(row?.show_phone_on_profile),
            show_email_on_profile: Boolean(row?.show_email_on_profile),
          };
          setNotificationSoundEnabled(next.sound_notifications);
          return next;
        });
      }
    };
    void loadPrefs();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const saveProfileDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = profileForm.full_name.trim();
    if (!fullName) {
      toast.error("Full name is required.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({
        full_name: fullName,
        username: profileForm.username.trim() || null,
        bio: profileForm.bio.trim() || null,
        avatar_url: profileForm.avatar_url.trim() || null,
      });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail || !nextEmail.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (nextEmail === user?.email?.toLowerCase()) {
      toast.message("This is already your account email.");
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      toast.success("Confirmation email sent to your new address.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change email");
    } finally {
      setSavingEmail(false);
    }
  };

  const savePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      toast.success("Password updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const updatePreference = async (key: keyof SettingsPrefs, value: boolean) => {
    const previous = prefs[key];
    setPrefs((current) => ({ ...current, [key]: value }));
    if (key === "sound_notifications") setNotificationSoundEnabled(value);
    setSavingPref(key);
    try {
      await updateProfile({ [key]: value });
      if (key === "sound_notifications") setNotificationSoundEnabled(value);
      await refreshProfile();
      toast.success("Setting updated");
    } catch (error) {
      setPrefs((current) => ({ ...current, [key]: previous }));
      if (key === "sound_notifications") setNotificationSoundEnabled(previous);
      toast.error(error instanceof Error ? error.message : "Could not update setting");
    } finally {
      setSavingPref(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  const toggleClass =
    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#22c55e]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]";

  const renderToggle = (key: keyof SettingsPrefs) => (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={prefs[key]}
        disabled={savingPref === key}
        onChange={(event) => {
          void updatePreference(key, event.target.checked);
        }}
        className="sr-only peer"
      />
      <div className={toggleClass} />
    </label>
  );

  const fieldClass =
    "h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/15";

  const textAreaClass =
    "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/15";

  const saveButtonClass =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 text-sm font-semibold text-white hover:bg-[#16a34a] disabled:opacity-60";

  const sectionClass = "bg-white rounded-lg border border-gray-100 shadow-sm";

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-5xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">Settings</h1>
            <p className="text-xs text-gray-500">Manage your private account and public profile.</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 max-w-5xl mx-auto space-y-5">
        <section className={sectionClass}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-600" />
              <div>
                <h2 className="font-semibold text-gray-800">Public Profile</h2>
                <p className="text-sm text-gray-600">Update the details buyers see on your profile.</p>
              </div>
            </div>
            <Link to="/profile" className="text-sm font-semibold text-[#15803d] hover:underline">
              View profile
            </Link>
          </div>

          <form className="grid gap-4 p-4 md:grid-cols-2" onSubmit={(event) => void saveProfileDetails(event)}>
            <div>
              <label htmlFor="settings-full-name" className="mb-1 block text-xs font-semibold text-gray-600">
                Full name
              </label>
              <input
                id="settings-full-name"
                type="text"
                value={profileForm.full_name}
                onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="settings-username" className="mb-1 block text-xs font-semibold text-gray-600">
                Username
              </label>
              <input
                id="settings-username"
                type="text"
                value={profileForm.username}
                onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                className={fieldClass}
                placeholder="greenhub_user"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="settings-avatar-url" className="mb-1 block text-xs font-semibold text-gray-600">
                Avatar URL
              </label>
              <input
                id="settings-avatar-url"
                type="url"
                value={profileForm.avatar_url}
                onChange={(event) => setProfileForm((current) => ({ ...current, avatar_url: event.target.value }))}
                className={fieldClass}
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="settings-bio" className="mb-1 block text-xs font-semibold text-gray-600">
                Bio
              </label>
              <textarea
                id="settings-bio"
                rows={4}
                value={profileForm.bio}
                onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))}
                className={textAreaClass}
                placeholder="Short intro buyers see on your profile..."
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={savingProfile} className={saveButtonClass}>
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Save profile
              </button>
            </div>
          </form>
        </section>

        <section className={sectionClass}>
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <Lock className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="font-semibold text-gray-800">Account Security</h2>
              <p className="text-sm text-gray-600">Change your email and password.</p>
            </div>
          </div>

          <div className="grid gap-5 p-4 lg:grid-cols-2">
            <form className="space-y-3" onSubmit={(event) => void saveEmailChange(event)}>
              <div>
                <label htmlFor="settings-email" className="mb-1 block text-xs font-semibold text-gray-600">
                  Email address
                </label>
                <input
                  id="settings-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                />
                <p className="mt-1 text-xs text-gray-500">Supabase will send a confirmation link before changing your email.</p>
              </div>
              <button type="submit" disabled={savingEmail} className={saveButtonClass}>
                {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Change email
              </button>
            </form>

            <form className="space-y-3" onSubmit={(event) => void savePasswordChange(event)}>
              <div>
                <label htmlFor="settings-new-password" className="mb-1 block text-xs font-semibold text-gray-600">
                  New password
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="settings-confirm-password" className="mb-1 block text-xs font-semibold text-gray-600">
                  Confirm new password
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  className={fieldClass}
                />
              </div>
              <button type="submit" disabled={savingPassword} className={saveButtonClass}>
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Update password
              </button>
            </form>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="font-semibold text-gray-800">Notifications</h2>
              <p className="text-sm text-gray-600">Choose how GreenHub alerts you.</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-gray-800">Push Notifications</p>
                <p className="text-sm text-gray-600">Get updates about chats, orders, and listings.</p>
              </div>
              {renderToggle("push_notifications_enabled")}
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-gray-800">Email Updates</p>
                <p className="text-sm text-gray-600">Receive product and marketplace emails.</p>
              </div>
              {renderToggle("email_updates_enabled")}
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-gray-800">Sound Notifications</p>
                <p className="text-sm text-gray-600">Play sounds for chat, orders, and delivery updates.</p>
              </div>
              {renderToggle("sound_notifications")}
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <Shield className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="font-semibold text-gray-800">Privacy</h2>
              <p className="text-sm text-gray-600">Control which contact details appear publicly.</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-gray-800">Show phone on profile</p>
                <p className="text-sm text-gray-600">Let buyers call you from your public profile.</p>
              </div>
              {renderToggle("show_phone_on_profile")}
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-gray-800">Show email on profile</p>
                <p className="text-sm text-gray-600">Display your email address to profile visitors.</p>
              </div>
              {renderToggle("show_email_on_profile")}
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <button type="button" onClick={() => navigate("/help")} className="w-full flex items-center justify-between gap-4 p-4 hover:bg-gray-50">
            <span className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-gray-600" />
              <span className="text-left">
                <span className="block font-medium text-gray-800">Help Center</span>
                <span className="block text-sm text-gray-600">FAQs and support</span>
              </span>
            </span>
          </button>
        </section>

        <section className={sectionClass}>
          <button type="button" onClick={handleDeleteAccount} className="w-full flex items-center justify-between p-4 hover:bg-red-50">
            <span className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span className="text-left">
                <span className="block font-medium text-red-600">Delete Account</span>
                <span className="block text-sm text-gray-600">Request permanent account deletion</span>
              </span>
            </span>
          </button>
        </section>

        <p className="text-center text-sm text-gray-500">GreenHub v1.0.0</p>
      </div>
    </div>
  );
}
