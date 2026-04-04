import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import WorkersSectionHeader from "../../components/workers/WorkersSectionHeader";
import { WORKER_AVAILABILITY_OPTIONS, WORKER_TRADE_CATEGORIES } from "../../data/workerProfileConstants";

const EDU_LEVELS = ["", "Primary", "SSCE", "OND", "HND", "Bachelor's", "Master's", "Other"] as const;

export default function WorkerProfileRegister() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cityState, setCityState] = useState("");
  const [headline, setHeadline] = useState("");
  const [tradeCategory, setTradeCategory] = useState<string>(WORKER_TRADE_CATEGORIES[0]);
  const [skillsSummary, setSkillsSummary] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [availability, setAvailability] = useState<string>(WORKER_AVAILABILITY_OPTIONS[0]);
  const [educationLevel, setEducationLevel] = useState("");
  const [languages, setLanguages] = useState("");
  const [expectedPay, setExpectedPay] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setAuthUserId(u?.id ?? null);
      if (u?.email) setEmail((prev) => (prev.trim() ? prev : u.email ?? ""));
    });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agree) {
      toast.error("Confirm that your details are accurate.");
      return;
    }
    if (
      !fullName.trim() ||
      phone.trim().length < 6 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      !cityState.trim() ||
      !headline.trim() ||
      !skillsSummary.trim() ||
      skillsSummary.trim().length < 20
    ) {
      toast.error("Fill in all required fields. Describe your skills in at least 20 characters.");
      return;
    }
    const y = yearsExperience.trim() === "" ? null : Number(yearsExperience);
    if (yearsExperience.trim() !== "" && (y == null || Number.isNaN(y) || y < 0)) {
      toast.error("Years of experience must be a valid number.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("worker_profiles").insert({
        user_id: authUserId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city_state: cityState.trim(),
        headline: headline.trim(),
        trade_category: tradeCategory,
        skills_summary: skillsSummary.trim(),
        years_experience: y,
        availability,
        education_level: educationLevel.trim() || null,
        languages: languages.trim() || null,
        expected_pay: expectedPay.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        status: "active",
      });
      if (error) throw error;
      toast.success("Your profile is live. Employers can find you in the directory.");
      navigate("/workers");
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your connection or try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf8] pb-20">
      <WorkersSectionHeader />
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">List yourself for work</h1>
        <p className="text-gray-600 text-sm mt-2">
          Share honest details. Employers use this to shortlist and contact you by phone or email. You can sign in
          first to link this profile to your account (optional).
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-800">
            Full name *
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Phone * (employers will call)
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Email *
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            City / state *
            <input
              required
              value={cityState}
              onChange={(e) => setCityState(e.target.value)}
              placeholder="e.g. Ikeja, Lagos"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            What you do (short headline) *
            <input
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Experienced site labourer / Office cleaner"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Type of work *
            <select
              value={tradeCategory}
              onChange={(e) => setTradeCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {WORKER_TRADE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Skills & experience (details) *
            <textarea
              required
              rows={5}
              value={skillsSummary}
              onChange={(e) => setSkillsSummary(e.target.value)}
              placeholder="Tools you use, past jobs, physical fitness, licences, references…"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Years of experience (optional)
            <input
              type="number"
              min={0}
              step={0.5}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            When you can start *
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {WORKER_AVAILABILITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Education (optional)
            <select
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {EDU_LEVELS.map((l) => (
                <option key={l || "none"} value={l}>
                  {l || "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Languages (optional)
            <input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="e.g. English, Yoruba, Pidgin"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Pay expectations (optional)
            <input
              value={expectedPay}
              onChange={(e) => setExpectedPay(e.target.value)}
              placeholder="e.g. ₦15,000/day or negotiable"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-800">
            Portfolio / LinkedIn (optional)
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="https://"
            />
          </label>

          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>I confirm my details are accurate and I agree GreenHub only displays this information—employers hire me directly.</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#22c55e] py-3 font-bold text-white hover:bg-[#16a34a] disabled:opacity-60"
          >
            {submitting ? "Publishing…" : "Publish my profile"}
          </button>
          <p className="text-xs text-gray-500 text-center">
            Need a formal GreenHub job pipeline?{" "}
            <Link to="/apply" className="text-[#166534] font-medium underline">
              Apply for job
            </Link>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
