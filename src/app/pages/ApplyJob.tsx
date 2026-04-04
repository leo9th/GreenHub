import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

const EDUCATION_LEVELS = ["SSCE", "OND", "HND", "Bachelor's", "Master's", "PhD"] as const;

const JOB_CATEGORIES = [
  "Sales",
  "Marketing",
  "Tech",
  "ICT (Information & Communications Technology)",
  "Driving",
  "Delivery",
  "Customer Service",
  "Cleaning",
  "Admin",
  "Security",
  "Accounting",
  "Hospitality",
  "Education",
  "Healthcare",
  "Engineering",
  "Others",
] as const;

const STEPS = [
  "Personal",
  "Identification",
  "Professional",
  "Preferences",
  "Review & submit",
] as const;

const TOTAL_STEPS = STEPS.length;

function safeStorageFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "file";
}

const CV_MAX_BYTES = 5 * 1024 * 1024;
const ID_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ID_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

function ageFromDateOfBirth(isoDate: string): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate + (isoDate.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

function validateIdPhoto(file: File | null, label: string): string | null {
  if (!file) return `Upload ${label}.`;
  if (file.size > ID_IMAGE_MAX_BYTES) return `${label} must be 5MB or smaller.`;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return `${label}: use JPG, PNG, or WebP.`;
  return null;
}

function validateCvFile(file: File | null): string | null {
  if (!file) return "Upload your CV.";
  if (file.size > CV_MAX_BYTES) return "CV must be 5MB or smaller.";
  const extOk = /\.(pdf|doc|docx)$/i.test(file.name);
  const mimeOk = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].includes(file.type);
  if (!extOk && !mimeOk) return "CV must be PDF or Word (.doc, .docx).";
  return null;
}

export default function ApplyJob() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<string>("");

  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [idSelfieFile, setIdSelfieFile] = useState<File | null>(null);
  const [idFrontKey, setIdFrontKey] = useState(0);
  const [idBackKey, setIdBackKey] = useState(0);
  const [idSelfieKey, setIdSelfieKey] = useState(0);

  const [educationLevel, setEducationLevel] = useState<string>("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  const [skills, setSkills] = useState("");
  const [previousJobTitle, setPreviousJobTitle] = useState("");
  const [previousCompany, setPreviousCompany] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvInputKey, setCvInputKey] = useState(0);
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [desiredCategory, setDesiredCategory] = useState<string>("");
  const [desiredLocation, setDesiredLocation] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [availableStart, setAvailableStart] = useState("");

  const [bio, setBio] = useState("");
  const [whyGreenhub, setWhyGreenhub] = useState("");
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  const ageForDob = dateOfBirth ? ageFromDateOfBirth(dateOfBirth) : null;
  const under18 = ageForDob !== null && ageForDob < 18;

  const canGoNext = (() => {
    switch (step) {
      case 0:
        return (
          fullName.trim().length > 1 &&
          phone.trim().length > 5 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
          !!dateOfBirth &&
          ageForDob !== null &&
          ageForDob >= 18 &&
          !!gender
        );
      case 1:
        return (
          validateIdPhoto(idFrontFile, "ID front") === null &&
          validateIdPhoto(idBackFile, "ID back") === null &&
          validateIdPhoto(idSelfieFile, "selfie with ID") === null
        );
      case 2:
        return (
          !!educationLevel &&
          yearsExperience !== "" &&
          !Number.isNaN(Number(yearsExperience)) &&
          Number(yearsExperience) >= 0 &&
          skills.trim().length > 1 &&
          previousJobTitle.trim().length > 0 &&
          validateCvFile(cvFile) === null
        );
      case 3:
        return (
          !!desiredCategory &&
          desiredLocation.trim().length > 1 &&
          salaryRange.trim().length > 1 &&
          !!availableStart
        );
      case 4:
        return (
          bio.trim().length > 10 &&
          whyGreenhub.trim().length > 10 &&
          confirmAccurate &&
          agreeTerms
        );
      default:
        return false;
    }
  })();

  const goNext = () => {
    if (canGoNext && step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canGoNext || submitting) return;

    const age = dateOfBirth ? ageFromDateOfBirth(dateOfBirth) : null;
    if (age === null || age < 18) {
      toast.error("You must be at least 18 years old to apply.");
      return;
    }
    const cvErr = validateCvFile(cvFile);
    if (cvErr) {
      toast.error(cvErr);
      return;
    }
    const idErr =
      validateIdPhoto(idFrontFile, "ID front") ||
      validateIdPhoto(idBackFile, "ID back") ||
      validateIdPhoto(idSelfieFile, "selfie with ID");
    if (idErr) {
      toast.error(idErr);
      return;
    }

    if (!import.meta.env.VITE_SUPABASE_URL) {
      toast.error("Application upload is not configured. Set Supabase environment variables.");
      return;
    }

    setSubmitting(true);
    const applicationId = crypto.randomUUID();

    try {
      let idFrontPath: string | null = null;
      let idBackPath: string | null = null;
      let idSelfiePath: string | null = null;
      let cvPath: string | null = null;

      if (idFrontFile) {
        idFrontPath = `${applicationId}/id_front_${safeStorageFileName(idFrontFile.name)}`;
        const { error } = await supabase.storage.from("job-application-uploads").upload(idFrontPath, idFrontFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw new Error(error.message);
      }
      if (idBackFile) {
        idBackPath = `${applicationId}/id_back_${safeStorageFileName(idBackFile.name)}`;
        const { error } = await supabase.storage.from("job-application-uploads").upload(idBackPath, idBackFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw new Error(error.message);
      }
      if (idSelfieFile) {
        idSelfiePath = `${applicationId}/id_selfie_${safeStorageFileName(idSelfieFile.name)}`;
        const { error } = await supabase.storage.from("job-application-uploads").upload(idSelfiePath, idSelfieFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw new Error(error.message);
      }

      if (cvFile) {
        cvPath = `${applicationId}/cv_${safeStorageFileName(cvFile.name)}`;
        const { error: cvErrUp } = await supabase.storage.from("job-application-uploads").upload(cvPath, cvFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (cvErrUp) throw new Error(cvErrUp.message);
      }

      const row: Record<string, unknown> = {
        id: applicationId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        date_of_birth: dateOfBirth,
        gender,
        id_document_front_storage_path: idFrontPath,
        id_document_back_storage_path: idBackPath,
        id_selfie_storage_path: idSelfiePath,
        education_level: educationLevel,
        years_experience: Number(yearsExperience),
        skills: skills.trim(),
        previous_job_title: previousJobTitle.trim(),
        previous_company: previousCompany.trim() || null,
        cv_storage_path: cvPath,
        portfolio_url: portfolioUrl.trim() || null,
        desired_job_category: desiredCategory,
        desired_location: desiredLocation.trim(),
        expected_salary_range: salaryRange.trim(),
        available_start_date: availableStart,
        bio: bio.trim(),
        why_greenhub: whyGreenhub.trim(),
        confirms_accurate: true,
        agrees_terms: true,
        review_status: "pending",
      };

      const { error: insErr } = await supabase.from("job_applications").insert(row);
      if (insErr) throw new Error(insErr.message);

      toast.success("Application submitted! Our team will review it and contact you if there is a match.");
      setStep(0);
      setFullName("");
      setPhone("");
      setEmail("");
      setDateOfBirth("");
      setGender("");
      setIdFrontFile(null);
      setIdBackFile(null);
      setIdSelfieFile(null);
      setIdFrontKey((k) => k + 1);
      setIdBackKey((k) => k + 1);
      setIdSelfieKey((k) => k + 1);
      setEducationLevel("");
      setYearsExperience("");
      setSkills("");
      setPreviousJobTitle("");
      setPreviousCompany("");
      setCvFile(null);
      setCvInputKey((k) => k + 1);
      setPortfolioUrl("");
      setDesiredCategory("");
      setDesiredLocation("");
      setSalaryRange("");
      setAvailableStart("");
      setBio("");
      setWhyGreenhub("");
      setConfirmAccurate(false);
      setAgreeTerms(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      const m = msg.toLowerCase();
      if (m.includes("bucket") && (m.includes("not found") || m.includes("does not exist"))) {
        toast.error(
          "File upload failed: storage bucket missing. In Supabase → Storage, create a private bucket named job-application-uploads, or run the migration 20260409120000_job_application_uploads_bucket.sql.",
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 text-gray-600 hover:text-[#16a34a]" aria-label="Home">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Jobs / Employment</h1>
            <p className="text-xs text-gray-500">Apply for opportunities with GreenHub & partners</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#22c55e] transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Step {step + 1} of {TOTAL_STEPS}: {STEPS[step]}
          </p>
        </div>
      </header>

      <form onSubmit={step === TOTAL_STEPS - 1 ? handleSubmit : (e) => e.preventDefault()} className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 md:p-8 space-y-5">
          <div className="rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3 text-sm text-gray-800 -mt-1 leading-relaxed">
            <strong className="text-[#14532d]">Looking for staff, a driver, or an artisan?</strong> Visit the{" "}
            <Link to="/workers" className="text-[#166534] font-semibold underline">
              public hire directory
            </Link>
            —anyone can search and contact people offering skills. <strong className="text-[#14532d]">Offering your skills?</strong>{" "}
            <Link to="/workers/register" className="text-[#166534] font-semibold underline">
              List your profile
            </Link>{" "}
            there (separate from this formal application form).
          </div>

          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">Personal information</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Full name *</span>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Phone number *</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Email *</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Date of birth *</span>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                  />
                  {under18 ? (
                    <p className="text-sm text-red-600 mt-1">You must be at least 18 years old to apply.</p>
                  ) : null}
                </label>
                <fieldset>
                  <legend className="text-sm font-medium text-gray-700">Gender *</legend>
                  <div className="mt-2 space-y-2">
                    {(["Male", "Female", "Prefer not to say"] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          checked={gender === g}
                          onChange={() => setGender(g)}
                          className="text-[#22c55e] focus:ring-[#22c55e]"
                        />
                        <span className="text-sm text-gray-700">{g}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">Means of identification</h2>
              <p className="text-sm text-gray-600">
                Upload clear photos: ID front, ID back, and a selfie of you holding the same ID. JPG, PNG, or WebP only — up
                to 5MB each.
              </p>

              <div className="space-y-4">
                <div className="block">
                  <span className="text-sm font-medium text-gray-700">ID document — front *</span>
                  <input
                    key={idFrontKey}
                    type="file"
                    accept={ID_IMAGE_ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      const err = validateIdPhoto(f, "ID front");
                      if (err && f) {
                        toast.error(err);
                        e.target.value = "";
                        setIdFrontFile(null);
                        return;
                      }
                      setIdFrontFile(f);
                    }}
                    className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                  />
                  {idFrontFile ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-gray-500">{idFrontFile.name}</p>
                      <button
                        type="button"
                        className="text-xs text-red-600 font-medium hover:underline"
                        onClick={() => {
                          setIdFrontFile(null);
                          setIdFrontKey((k) => k + 1);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="block">
                  <span className="text-sm font-medium text-gray-700">ID document — back *</span>
                  <input
                    key={idBackKey}
                    type="file"
                    accept={ID_IMAGE_ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      const err = validateIdPhoto(f, "ID back");
                      if (err && f) {
                        toast.error(err);
                        e.target.value = "";
                        setIdBackFile(null);
                        return;
                      }
                      setIdBackFile(f);
                    }}
                    className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                  />
                  {idBackFile ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-gray-500">{idBackFile.name}</p>
                      <button
                        type="button"
                        className="text-xs text-red-600 font-medium hover:underline"
                        onClick={() => {
                          setIdBackFile(null);
                          setIdBackKey((k) => k + 1);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="block">
                  <span className="text-sm font-medium text-gray-700">Selfie holding your ID *</span>
                  <input
                    key={idSelfieKey}
                    type="file"
                    accept={ID_IMAGE_ACCEPT}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      const err = validateIdPhoto(f, "selfie with ID");
                      if (err && f) {
                        toast.error(err);
                        e.target.value = "";
                        setIdSelfieFile(null);
                        return;
                      }
                      setIdSelfieFile(f);
                    }}
                    className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                  />
                  {idSelfieFile ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-gray-500">{idSelfieFile.name}</p>
                      <button
                        type="button"
                        className="text-xs text-red-600 font-medium hover:underline"
                        onClick={() => {
                          setIdSelfieFile(null);
                          setIdSelfieKey((k) => k + 1);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">Professional information</h2>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Highest education *</span>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                >
                  <option value="">Select…</option>
                  {EDUCATION_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Years of experience *</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Skills * (comma-separated)</span>
                <input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. Excel, customer service, logistics"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Previous job title *</span>
                <input
                  value={previousJobTitle}
                  onChange={(e) => setPreviousJobTitle(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Previous company (optional)</span>
                <input
                  value={previousCompany}
                  onChange={(e) => setPreviousCompany(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
              <div className="block">
                <span className="text-sm font-medium text-gray-700">CV / Resume * (PDF, DOC, DOCX — max 5MB)</span>
                <input
                  key={cvInputKey}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    const err = validateCvFile(f);
                    if (err && f) {
                      toast.error(err);
                      e.target.value = "";
                      setCvFile(null);
                      return;
                    }
                    setCvFile(f);
                  }}
                  className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                />
                {cvFile ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-gray-600">Selected: {cvFile.name}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCvFile(null);
                        setCvInputKey((k) => k + 1);
                      }}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Portfolio link (optional)</span>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">Job preferences</h2>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Desired job category *</span>
                <select
                  value={desiredCategory}
                  onChange={(e) => setDesiredCategory(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                >
                  <option value="">Select…</option>
                  {JOB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Desired location (city / state) *</span>
                <input
                  value={desiredLocation}
                  onChange={(e) => setDesiredLocation(e.target.value)}
                  placeholder="e.g. Yaba, Lagos"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Expected salary range *</span>
                <input
                  value={salaryRange}
                  onChange={(e) => setSalaryRange(e.target.value)}
                  placeholder="e.g. ₦120,000 – ₦180,000 / month"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Available to start *</span>
                <input
                  type="date"
                  value={availableStart}
                  onChange={(e) => setAvailableStart(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">About you & agreements</h2>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Tell us about yourself *</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Why should GreenHub consider you? *</span>
                <textarea
                  value={whyGreenhub}
                  onChange={(e) => setWhyGreenhub(e.target.value)}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent text-sm"
                />
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmAccurate}
                  onChange={(e) => setConfirmAccurate(e.target.checked)}
                  className="mt-1 rounded text-[#22c55e] focus:ring-[#22c55e]"
                />
                <span className="text-sm text-gray-700">I confirm that the information provided is true and correct *</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 rounded text-[#22c55e] focus:ring-[#22c55e]"
                />
                <span className="text-sm text-gray-700">
                  I agree to GreenHub&apos;s{" "}
                  <Link to="/terms" className="text-[#16a34a] underline font-medium">
                    terms
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-[#16a34a] underline font-medium">
                    privacy policy
                  </Link>
                  . *
                </span>
              </label>
            </>
          )}

        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-40"
          >
            Back
          </button>
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="px-5 py-2.5 rounded-lg bg-[#22c55e] text-white font-semibold hover:bg-[#16a34a] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canGoNext || submitting}
              className="px-5 py-2.5 rounded-lg bg-[#22c55e] text-white font-semibold hover:bg-[#16a34a] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Submit application
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          This portal is only for employment interest. It does not create a seller account or list products.
        </p>
      </form>
    </div>
  );
}
