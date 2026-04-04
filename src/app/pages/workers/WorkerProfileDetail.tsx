import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import WorkersSectionHeader from "../../components/workers/WorkersSectionHeader";
import type { WorkerProfileRow } from "../../types/workerProfile";

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

export default function WorkerProfileDetail() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<WorkerProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("worker_profiles").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (error || !data || (data as WorkerProfileRow).status !== "active") {
        setProfile(null);
      } else {
        setProfile(data as WorkerProfileRow);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <WorkersSectionHeader />
        <div className="flex justify-center py-24 text-[#166534]">
          <Loader2 className="w-10 h-10 animate-spin" aria-hidden />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f8faf8]">
        <WorkersSectionHeader />
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-gray-600">This profile is not available.</p>
          <Link to="/workers" className="text-[#166534] font-semibold mt-4 inline-block hover:underline">
            Back to directory
          </Link>
        </div>
      </div>
    );
  }

  const wa = digitsOnly(profile.phone);
  const waLink = wa.length >= 10 ? `https://wa.me/${wa.startsWith("0") ? `234${wa.slice(1)}` : wa}` : null;

  return (
    <div className="min-h-screen bg-[#f8faf8] pb-20">
      <WorkersSectionHeader />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/workers"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#166534] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          All profiles
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-[#ecfdf5] to-white p-6 md:p-8 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-wide text-[#166534]">{profile.trade_category}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{profile.full_name}</h1>
            <p className="text-lg font-semibold text-gray-800 mt-2">{profile.headline}</p>
            <p className="text-gray-600 mt-3 inline-flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#166534] shrink-0" aria-hidden />
              {profile.city_state}
            </p>
            {profile.years_experience != null && (
              <p className="text-sm text-gray-600 mt-1">Experience: ~{profile.years_experience} years</p>
            )}
          </div>

          <div className="p-6 md:p-8 space-y-6">
            <section>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">About & skills</h2>
              <p className="mt-2 text-gray-800 whitespace-pre-wrap leading-relaxed">{profile.skills_summary}</p>
            </section>

            <section className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-gray-700">Availability</span>
                <p className="text-gray-800">{profile.availability}</p>
              </div>
              {profile.expected_pay && (
                <div>
                  <span className="font-semibold text-gray-700">Pay expectations</span>
                  <p className="text-gray-800">{profile.expected_pay}</p>
                </div>
              )}
              {profile.education_level && (
                <div>
                  <span className="font-semibold text-gray-700">Education</span>
                  <p className="text-gray-800">{profile.education_level}</p>
                </div>
              )}
              {profile.languages && (
                <div>
                  <span className="font-semibold text-gray-700">Languages</span>
                  <p className="text-gray-800">{profile.languages}</p>
                </div>
              )}
            </section>

            {profile.portfolio_url && (
              <p>
                <span className="font-semibold text-gray-700">Link: </span>
                <a href={profile.portfolio_url} className="text-[#166534] underline break-all" target="_blank" rel="noreferrer">
                  {profile.portfolio_url}
                </a>
              </p>
            )}

            <section className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Contact for interview</h2>
              <p className="text-xs text-gray-500 mt-1">
                GreenHub does not employ these individuals; you hire directly. Verify identity and terms yourself.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-3">
                <a
                  href={`tel:${profile.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#22c55e] px-5 py-3 text-white font-bold hover:bg-[#16a34a]"
                >
                  <Phone className="w-5 h-5" aria-hidden />
                  Call {profile.phone}
                </a>
                <a
                  href={`mailto:${profile.email}?subject=${encodeURIComponent(`Interview opportunity — ${profile.headline}`)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#166534] px-5 py-3 font-bold text-[#14532d] hover:bg-[#ecfdf5]"
                >
                  <Mail className="w-5 h-5" aria-hidden />
                  Email
                </a>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#128C7E] px-5 py-3 text-white font-bold hover:opacity-95"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
