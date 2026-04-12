import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowUpRight,
  Leaf,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

const SUPPORT_EMAIL = "support@greenhub.ng";
const PHONE_DISPLAY = "+234 812 522 1542";
const PHONE_HREF = "tel:+2348125221542";
const MAIL_HREF = `mailto:${SUPPORT_EMAIL}`;
const WA_HREF = "https://wa.me/2348125221542";
const MAPS_QUERY = "https://www.google.com/maps/search/?api=1&query=Abuja%2C+Nigeria";

const SOCIAL = [
  { label: "Twitter", href: "https://twitter.com", emoji: "𝕏" },
  { label: "Instagram", href: "https://instagram.com", emoji: "📷" },
  { label: "LinkedIn", href: "https://linkedin.com", emoji: "💼" },
  { label: "Facebook", href: "https://facebook.com", emoji: "📘" },
] as const;

type ContactCardProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
};

function ContactCard({ icon, title, subtitle, children, className }: ContactCardProps) {
  return (
    <div
      className={cn(
        "gh-card-green-glow group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/45 p-6 shadow-xl backdrop-blur-xl md:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/25 to-emerald-600/15 text-emerald-300 ring-1 ring-emerald-400/25">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
          </div>
        </div>
        <div className="pt-1">{children}</div>
      </div>
    </div>
  );
}

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !subject.trim()) {
      toast.error("Please add a subject and message.");
      return;
    }
    setSending(true);
    const body = [
      message.trim(),
      "",
      name.trim() ? `Name: ${name.trim()}` : null,
      email.trim() ? `Reply-to: ${email.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    toast.success("Opening your email app…", { description: `If nothing opens, write us at ${SUPPORT_EMAIL}` });
    setTimeout(() => setSending(false), 1200);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030806] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[min(520px,80vw)] w-[140%] max-w-6xl -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-400/12 blur-[100px]" />
        <div className="absolute bottom-1/4 left-0 h-56 w-56 rounded-full bg-teal-500/10 blur-[90px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:pb-32 lg:pt-24">
        <header className="mx-auto max-w-3xl text-center">
          <div className="mb-8 flex flex-col items-center gap-5">
            <div className="gh-green-signal" aria-hidden />
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/95">
              <Leaf className="h-3.5 w-3.5" aria-hidden />
              Green Light Connection
            </div>
          </div>
          <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-emerald-400/90">
            <Sparkles className="h-4 w-4" aria-hidden />
            Get in touch
            <Sparkles className="h-4 w-4" aria-hidden />
          </p>
          <h1 className="bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl md:text-6xl">
            Let&apos;s grow something great together.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Questions, partnerships, or a little help with your account — follow the green light. We typically reply within one business day.
          </p>
        </header>

        <div className="gh-shine-line my-14 sm:my-16" aria-hidden />

        <section className="grid gap-5 md:grid-cols-2 md:gap-6" aria-label="Contact options">
          <ContactCard
            icon={<Mail className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
            title="Email us"
            subtitle="Best for detailed questions, screenshots, and order help."
          >
            <a
              href={MAIL_HREF}
              className="inline-flex items-center gap-2 text-base font-medium text-emerald-300/95 hover:text-emerald-200"
            >
              {SUPPORT_EMAIL}
              <ArrowUpRight className="h-4 w-4 opacity-70" aria-hidden />
            </a>
            <div className="mt-5">
              <a
                href={MAIL_HREF}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-500 sm:w-auto"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Send email
              </a>
            </div>
          </ContactCard>

          <ContactCard
            icon={<MessageCircle className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
            title="Live chat"
            subtitle="Message buyers, sellers, or jump into your inbox for real-time help."
          >
            <p className="text-sm text-zinc-400">Open the GreenHub messenger — same place you chat about listings.</p>
            <div className="mt-5">
              <Link
                to="/messages"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 backdrop-blur-sm transition hover:border-emerald-400/50 hover:bg-emerald-500/15 sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Start chat
              </Link>
            </div>
          </ContactCard>

          <ContactCard
            icon={<Phone className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
            title="Phone & WhatsApp"
            subtitle="Voice or WhatsApp — Nigeria hours, fast answers for urgent issues."
          >
            <a href={PHONE_HREF} className="text-lg font-semibold tracking-wide text-white">
              {PHONE_DISPLAY}
            </a>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={PHONE_HREF}
                className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
              >
                <Phone className="h-4 w-4" aria-hidden />
                Call now
              </a>
              <a
                href={WA_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25"
              >
                WhatsApp
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </ContactCard>

          <ContactCard
            icon={<MapPin className="h-6 w-6" strokeWidth={1.75} aria-hidden />}
            title="Visit us"
            subtitle="Rooted in Abuja — building nationwide trust, one listing at a time."
          >
            <p className="font-medium text-zinc-200">Abuja, Nigeria</p>
            <div className="mt-5">
              <a
                href={MAPS_QUERY}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
              >
                <MapPin className="h-4 w-4" aria-hidden />
                Get directions
              </a>
            </div>
          </ContactCard>
        </section>

        <section className="mt-16 md:mt-20" aria-labelledby="contact-form-heading">
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-zinc-900/50 p-6 shadow-2xl shadow-emerald-950/50 backdrop-blur-2xl sm:p-10 md:p-12">
            <div className="pointer-events-none absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-teal-400/10 blur-3xl" />

            <div className="relative">
              <h2 id="contact-form-heading" className="text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Send a message
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-center text-sm text-zinc-400">
                Tell us what you need — we&apos;ll route it to the right team. Opens your mail app with everything filled in.
              </p>

              <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-xl space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block text-left">
                    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Name</span>
                    <input
                      type="text"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none ring-emerald-500/0 transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="Your name"
                    />
                  </label>
                  <label className="block text-left">
                    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Email</span>
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="you@example.com"
                    />
                  </label>
                </div>
                <label className="block text-left">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Subject</span>
                  <input
                    type="text"
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="What is this about?"
                  />
                </label>
                <label className="block text-left">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Message</span>
                  <textarea
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="How can we help?"
                  />
                </label>
                <div className="flex justify-center pt-2">
                  <button
                    type="submit"
                    disabled={sending}
                    className="group inline-flex min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 px-8 py-3.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                    )}
                    Send message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="mt-16 md:mt-20" aria-labelledby="social-heading">
          <div className="gh-card-green-glow rounded-[2rem] border border-white/10 bg-zinc-900/40 px-6 py-10 text-center backdrop-blur-xl sm:px-10">
            <h2 id="social-heading" className="text-xl font-semibold text-white sm:text-2xl">
              Follow the green light
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              Updates, tips, and community stories — join us where you scroll.
            </p>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-emerald-500/35 hover:bg-emerald-500/10 hover:text-white"
                  >
                    <span aria-hidden className="text-base">
                      {s.emoji}
                    </span>
                    {s.label}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
