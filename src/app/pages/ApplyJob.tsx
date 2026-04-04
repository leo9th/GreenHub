import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { encryptJobIdNumber } from "../utils/jobIdCrypto";
import { JOB_VERIFY_FAIL_MESSAGE, runJobIdVerification } from "../utils/jobIdVerification";
import { NIGERIA_GOV_ID_OPTIONS, type NigeriaGovIdType } from "../utils/nigeriaGovId";

const EDUCATION_LEVELS = ["SSCE", "OND", "HND", "Bachelor's", "Master's", "PhD"] as const;

const JOB_CATEGORIES = [
  "Sales",
  "Marketing",
  "Tech",
  "Driving",
  "Cleaning",
  "Delivery",
  "Customer Service",
  "Admin",
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

export default function ApplyJob() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<string>("");

  const [idType, setIdType] = useState<string>("");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [educationLevel, setEducationLevel] = useState<string>("");
  const [yearsExperience, setYearsExperience] = useState<string>("");
  const [skills, setSkills] = useState("");
  const [previousJobTitle, setPreviousJobTitle] = useState("");
  const [previousCompany, setPreviousCompany] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
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

  const imageOk = (f: File | null) =>
    f !== null && (f.type.startsWith("image/") || f.type === "image/jpeg" || f.type === "image/png");

  const canGoNext = (() => {
    switch (step) {
      case 0:
        return (
          fullName.trim().length > 1 &&
          phone.trim().length > 5 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
          !!dateOfBirth &&
          !!gender
        );
      case 1:
        return (
          !!idType &&
          idNumber.trim().length > 2 &&
          imageOk(idFrontFile) &&
          imageOk(idBackFile) &&
          imageOk(selfieFile)
        );
      case 2:
        return (
          !!educationLevel &&
          yearsExperience !== "" &&
          !Number.isNaN(Number(yearsExperience)) &&
          Number(yearsExperience) >= 0 &&
          skills.trim().length > 1 &&
          previousJobTitle.trim().length > 0 &&
          cvFile !== null
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

  const continueFromIdentification = async () => {
    if (!canGoNext || !idFrontFile || !selfieFile || !idType) return;
    setVerifyingId(true);
    try {
      await runJobIdVerification({
        idType: idType as NigeriaGovIdType,
        idNumber,
        fullName,
        idFrontFile,
        selfieFile,
      });
      setStep(2);
    } catch {
      toast.error(JOB_VERIFY_FAIL_MESSAGE);
    } finally {
      setVerifyingId(false);
    }
  };

  const goNext = () => {
    if (!canGoNext || submitting || verifyingId) return;
    if (step === 1) {
      void continueFromIdentification();
      return;
    }
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 0 && !submitting) setStep((s) => s - 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canGoNext || submitting || !idFrontFile || !idBackFile || !selfieFile || !idType) return;

    if (!import.meta.env.VITE_SUPABASE_URL) {
      toast.error("Application upload is not configured. Set Supabase environment variables.");
      return;
    }

    setSubmitting(true);
    const applicationId = crypto.randomUUID();

    try {
      await runJobIdVerification({
        idType: idType as NigeriaGovIdType,
        idNumber,
        fullName,
        idFrontFile,
        selfieFile,
      });

      const enc = await encryptJobIdNumber(idNumber.trim());
      const idFrontPath = `${applicationId}/id_front_${safeStorageFileName(idFrontFile.name)}`;
      const idBackPath = `${applicationId}/id_back_${safeStorageFileName(idBackFile.name)}`;
      const selfiePath = `${applicationId}/selfie_${safeStorageFileName(selfieFile.name)}`;

      const up = async (path: string, file: File) => {
        const { error } = await supabase.storage.from("job-application-uploads").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw new Error(error.message);
      };

      await up(idFrontPath, idFrontFile);
      await up(idBackPath, idBackFile);
      await up(selfiePath, selfieFile);

      let cvPath: string | null = null;
      if (cvFile) {
        cvPath = `${applicationId}/cv_${safeStorageFileName(cvFile.name)}`;
        const { error: cvErr } = await supabase.storage.from("job-application-uploads").upload(cvPath, cvFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (cvErr) throw new Error(cvErr.message);
      }

      const row: Record<string, unknown> = {
        id: applicationId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        date_of_birth: dateOfBirth,
        gender,
        id_type: idType,
        id_number: enc ? null : idNumber.trim(),
        id_number_ciphertext: enc?.ciphertextB64 ?? null,
        id_number_iv: enc?.ivB64 ?? null,
        id_document_storage_path: null,
        id_front_image: idFrontPath,
        id_back_image: idBackPath,
        selfie_image: selfiePath,
        id_verified: false,
        id_verification_status: "pending",
        verification_notes: null,
        client_auto_verification_passed: true,
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
      };

      const { error: insErr } = await supabase.from("job_applications").insert(row);
      if (insErr) throw new Error(insErr.message);

      if (!import.meta.env.VITE_JOB_CRYPTO_KEY) {
        toast("Tip: set VITE_JOB_CRYPTO_KEY so ID numbers are stored encrypted.", { duration: 6000 });
      }

      toast.success("Application submitted successfully! We'll contact you if there's a match.");
      setStep(0);
      setFullName("");
      setPhone("");
      setEmail("");
      setDateOfBirth("");
      setGender("");
      setIdType("");
      setIdNumber("");
      setIdFrontFile(null);
      setIdBackFile(null);
      setSelfieFile(null);
      setEducationLevel("");
      setYearsExperience("");
      setSkills("");
      setPreviousJobTitle("");
      setPreviousCompany("");
      setCvFile(null);
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
      if (err instanceof Error && err.message === JOB_VERIFY_FAIL_MESSAGE) {
        toast.error(JOB_VERIFY_FAIL_MESSAGE);
      } else {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
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
            <p className="text-xs text-gray-500">Nigerian government ID verification required</p>
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
          {step === 0 && (
            <>
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">Personal information</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Full name * (must match your ID)</span>
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
              <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-2">
                Nigerian government ID (front, back &amp; selfie)
              </h2>
              <p className="text-xs text-gray-500">
                Only National ID (NIN), Driver&apos;s License, Voter&apos;s Card, or International Passport. Photos must be
                clear JPEG/PNG/WebP — no PDF for ID images. We compare your selfie to your ID photo and read your name from the
                front of the ID.
              </p>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">ID type *</span>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                >
                  <option value="">Select…</option>
                  {NIGERIA_GOV_ID_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">ID number *</span>
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">ID front (photo) *</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setIdFrontFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">ID back (photo) *</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setIdBackFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Selfie (face clearly visible) *</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                />
              </label>
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
              <label className="block">
                <span className="text-sm font-medium text-gray-700">CV / Resume * (PDF or DOCX)</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#22c55e] file:text-white"
                />
                {cvFile && <p className="text-xs text-gray-500 mt-1">Selected: {cvFile.name}</p>}
              </label>
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
            disabled={step === 0 || submitting || verifyingId}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-40"
          >
            Back
          </button>
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext || verifyingId || (step === 1 && submitting)}
              className="px-5 py-2.5 rounded-lg bg-[#22c55e] text-white font-semibold hover:bg-[#16a34a] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {verifyingId && step === 1 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying ID…
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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
          This portal is only for employment interest. It does not create a seller account. Final approval is manual and may
          take a few business days.
        </p>
      </form>
    </div>
  );
}
