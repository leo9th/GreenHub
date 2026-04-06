import { Link, useNavigate } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { nigerianStates } from "../../data/catalogConstants";
import { getLGAsForState } from "../../data/mockData";

/**
 * Shown after phone OTP signup — user is authenticated but should add profile details.
 */
export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("Prefer not to say");
  const [selectedState, setSelectedState] = useState("");
  const [lga, setLga] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const lgas = selectedState ? getLGAsForState(selectedState) : [];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    const meta = user.user_metadata as Record<string, string | undefined> | undefined;
    if (meta?.full_name) setFullName(meta.full_name);
    if (meta?.gender) setGender(meta.gender);
    if (meta?.state) setSelectedState(meta.state);
    if (meta?.lga) setLga(meta.lga);
    if (meta?.address) setAddress(meta.address);
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const name = fullName.trim();
    if (name.length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!selectedState || !lga) {
      toast.error("Please select state and LGA.");
      return;
    }

    setBusy(true);
    try {
      const { error: uErr } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          gender,
          state: selectedState,
          lga,
          address: address.trim() || null,
          role: "buyer",
        },
      });
      if (uErr) throw uErr;

      const { error: pErr } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: name,
          phone: user.phone ?? null,
          gender,
          state: selectedState,
          lga,
          address: address.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (pErr) {
        console.warn("Profile upsert:", pErr);
        toast.error(pErr.message);
        return;
      }

      toast.success("Profile saved. Welcome to GreenHub.");
      navigate("/", { replace: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0fdf4] via-white to-gray-50 py-12 px-4">
      <div className="mx-auto w-full max-w-[480px] rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/50 md:p-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900">Complete your profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Phone verified. Add a few details so buyers and sellers can trust your account.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Full name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              placeholder="As on your ID"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            >
              <option value="Prefer not to say">Prefer not to say</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">State</label>
            <select
              required
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setLga("");
              }}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            >
              <option value="">Select state</option>
              {nigerianStates.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {selectedState ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">LGA</label>
              <select
                required
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              >
                <option value="">Select LGA</option>
                {lgas.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Address (optional)</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
              placeholder="Street or area"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803d] py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#166534] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Save and continue
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          You can update these later in{" "}
          <Link to="/settings/profile/edit" className="font-medium text-[#15803d] hover:underline">
            profile settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
