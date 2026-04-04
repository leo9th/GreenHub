import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Star,
  MapPin,
  Edit,
  BadgeCheck,
  MessageCircle,
  Phone,
  Settings,
  LogOut,
  Loader2,
  Shield,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAvatarUrl } from "../utils/getAvatar";
import { supabase } from "../../lib/supabase";
import { useCurrency } from "../hooks/useCurrency";
import { getProductPrice } from "../utils/getProductPrice";

type TabId = "products" | "reviews" | "about" | "contact";

type Listing = {
  id: string | number;
  title: string;
  image: string | null;
  condition: string | null;
  price_local: number | null;
  price: number | null;
  status: string | null;
};

type ReviewRow = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
};

function isActiveListing(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  if (!s || s === "active") return true;
  return s !== "sold" && s !== "inactive";
}

function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get("tab") || "").toLowerCase();
  const formatPrice = useCurrency();
  const { profile, user: authUser, loading: authLoading, signOut } = useAuth();

  const validTabs: TabId[] = ["products", "reviews", "about", "contact"];
  const initialTab = validTabs.includes(tabFromUrl as TabId) ? (tabFromUrl as TabId) : "products";
  const [tab, setTab] = useState<TabId>(initialTab);

  useEffect(() => {
    const t = (searchParams.get("tab") || "").toLowerCase();
    if (validTabs.includes(t as TabId)) setTab(t as TabId);
  }, [searchParams]);

  const setTabAndUrl = (next: TabId) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [soldCount, setSoldCount] = useState(0);
  const [verificationLabel, setVerificationLabel] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const displayName = profile?.full_name || authUser?.user_metadata?.full_name || "Member";
  const avatar = getAvatarUrl(
    profile?.avatar_url || authUser?.user_metadata?.avatar_url,
    profile?.gender || authUser?.user_metadata?.gender,
    displayName
  );
  const locationLabel =
    profile?.state && profile?.lga
      ? `${profile.lga}, ${profile.state}`
      : profile?.address || profile?.state || "Nigeria";

  const memberSince =
    authUser?.created_at || profile?.created_at
      ? new Date(authUser?.created_at || profile?.created_at || "").toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        })
      : "—";

  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;

  const activeListings = listings.filter((p) => isActiveListing(p.status));

  const loadData = useCallback(async () => {
    if (!authUser?.id) {
      setListings([]);
      setReviews([]);
      setSoldCount(0);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setLoadError(null);

    try {
      const { data: productRows, error: pErr } = await supabase
        .from("products")
        .select("id, title, image, condition, price_local, price, status")
        .eq("seller_id", authUser.id)
        .order("created_at", { ascending: false });

      if (pErr) throw pErr;
      setListings((productRows ?? []) as Listing[]);
      setSoldCount((productRows ?? []).filter((r: { status?: string | null }) => (r.status ?? "").toLowerCase() === "sold").length);

      const { data: verRows, error: vErr } = await supabase
        .from("seller_verification")
        .select("status")
        .eq("seller_id", authUser.id);

      if (vErr && vErr.code !== "PGRST116" && !vErr.message.includes("does not exist")) {
        console.warn(vErr);
      }
      const statuses = (verRows ?? []).map((r: { status: string }) => String(r.status).toLowerCase());
      if (statuses.includes("approved")) setVerificationLabel("approved");
      else if (statuses.includes("pending")) setVerificationLabel("pending");
      else if (statuses.includes("rejected")) setVerificationLabel("rejected");
      else setVerificationLabel("none");

      const { data: revRows, error: rErr } = await supabase
        .from("seller_reviews")
        .select("id, rating, comment, created_at, reviewer_id")
        .eq("seller_id", authUser.id)
        .order("created_at", { ascending: false });

      if (rErr) {
        if (rErr.code === "42P01" || rErr.message.includes("does not exist") || rErr.message.includes("schema cache")) {
          setReviews([]);
        } else throw rErr;
      } else {
        const rows = (revRows ?? []) as {
          id: string;
          rating: number;
          comment: string;
          created_at: string;
          reviewer_id: string;
        }[];
        const ids = [...new Set(rows.map((r) => r.reviewer_id))];
        let nameMap = new Map<string, string>();
        if (ids.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
          for (const p of profs ?? []) {
            if (p.id) nameMap.set(String(p.id), (p.full_name as string) || "Buyer");
          }
        }
        setReviews(
          rows.map((r) => ({
            ...r,
            reviewer_name: nameMap.get(r.reviewer_id) || "Buyer",
          }))
        );
      }
    } catch (e: unknown) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : "Could not load profile data");
      setListings([]);
      setReviews([]);
    } finally {
      setDataLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void loadData();
  }, [authLoading, authUser, navigate, loadData]);

  if (authLoading || !authUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "products", label: "Products" },
    { id: "reviews", label: "Reviews" },
    { id: "about", label: "About" },
    { id: "contact", label: "Contact" },
  ];

  const phoneDisplay = profile?.phone || authUser.user_metadata?.phone || null;

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Profile</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-4 space-y-4">
        <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-gray-200/80 text-center">
          <img
            src={avatar}
            alt=""
            className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-gray-50 shadow-md border border-gray-100"
          />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{displayName}</h2>

          <div className="mt-2 flex flex-col items-center gap-1">
            <StarRow value={avgRating} />
            <p className="text-sm text-gray-600">
              {avgRating > 0 ? avgRating.toFixed(1) : "—"} · {reviewCount} review{reviewCount !== 1 ? "s" : ""}
            </p>
          </div>

          <p className="mt-2 text-sm text-gray-500 flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {locationLabel}
          </p>

          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            {verificationLabel === "approved" ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803d] bg-[#dcfce7] px-2.5 py-1 rounded-full">
                <BadgeCheck className="w-3.5 h-3.5" />
                Verified
              </span>
            ) : verificationLabel === "pending" ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                Verification pending
              </span>
            ) : verificationLabel === "rejected" ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-800 bg-red-100 px-2.5 py-1 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5" />
                Verification needs update
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                <Shield className="w-3.5 h-3.5" />
                Not verified
              </span>
            )}
          </div>

          <Link
            to="/settings/profile/edit"
            className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 shadow-sm"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit profile
          </Link>
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/80 overflow-hidden">
          <div className="border-b border-gray-100 overflow-x-auto no-scrollbar">
            <div className="flex min-w-max gap-0.5 px-2 pt-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTabAndUrl(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-xl whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? "text-[#15803d] bg-gray-50 border border-b-0 border-gray-200 -mb-px z-10"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5 min-h-[200px]">
          {loadError ? (
            <p className="text-sm text-red-600 text-center py-8 px-2">{loadError}</p>
          ) : null}

          {tab === "products" && (
            <div>
              {dataLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
                </div>
              ) : activeListings.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-12">No active listings yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  {activeListings.map((p) => (
                    <Link
                      key={String(p.id)}
                      to={`/products/${p.id}`}
                      className="bg-white rounded-xl ring-1 ring-gray-100 overflow-hidden hover:ring-gray-200 hover:shadow-sm transition-shadow"
                    >
                      <div className="aspect-[4/3] bg-gray-100">
                        <img
                          src={p.image || undefined}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              "data:image/svg+xml," +
                              encodeURIComponent(
                                `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="#f3f4f6" width="200" height="150"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="12">No image</text></svg>`
                              );
                          }}
                        />
                      </div>
                      <div className="p-3">
                        {p.condition ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{p.condition}</span>
                        ) : null}
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 mt-0.5 leading-snug">{p.title}</p>
                        <p className="text-sm font-bold text-[#15803d] mt-1">{formatPrice(getProductPrice(p))}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div className="space-y-3">
              {dataLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-12">No reviews yet.</p>
              ) : (
                reviews.map((r) => (
                  <article key={r.id} className="bg-gray-50/80 rounded-xl ring-1 ring-gray-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{r.reviewer_name}</p>
                      <StarRow value={r.rating} max={5} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(r.created_at).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </p>
                    {r.comment ? <p className="text-sm text-gray-700 mt-3 leading-relaxed">{r.comment}</p> : null}
                  </article>
                ))
              )}
            </div>
          )}

          {tab === "about" && (
            <div className="rounded-xl ring-1 ring-gray-100 bg-gray-50/50 p-4 space-y-4 text-sm">
              <div className="flex justify-between gap-4 py-2 border-b border-gray-50">
                <span className="text-gray-500">Member since</span>
                <span className="font-medium text-gray-900 text-right">{memberSince}</span>
              </div>
              <div className="flex justify-between gap-4 py-2 border-b border-gray-50">
                <span className="text-gray-500">Response rate</span>
                <span className="font-medium text-gray-900 text-right">Coming soon</span>
              </div>
              <div className="flex justify-between gap-4 py-2 border-b border-gray-50">
                <span className="text-gray-500">Listings marked sold</span>
                <span className="font-medium text-gray-900 text-right">{soldCount}</span>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Bio</p>
                <p className="text-gray-900 leading-relaxed">
                  {profile?.bio?.trim() ? profile.bio : "Add a short bio in Edit profile → About you."}
                </p>
              </div>
              <div className="flex justify-between gap-4 py-2 border-t border-gray-50 pt-3">
                <span className="text-gray-500">Verification</span>
                <span className="font-medium text-gray-900 text-right capitalize">{verificationLabel}</span>
              </div>
            </div>
          )}

          {tab === "contact" && (
            <div className="space-y-4">
              <div className="rounded-xl ring-1 ring-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Phone</p>
                {phoneDisplay ? (
                  <a href={`tel:${phoneDisplay}`} className="inline-flex items-center gap-2 text-[#15803d] font-medium text-sm">
                    <Phone className="w-4 h-4 shrink-0" />
                    {phoneDisplay}
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Add a phone number in Edit profile.</p>
                )}
              </div>

              <Link
                to="/messages"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#22c55e] text-white font-semibold text-sm hover:bg-[#16a34a] transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Open messages
              </Link>
              <p className="text-xs text-center text-gray-500">Chats with interested buyers appear here.</p>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-950 mb-2">Safety tips</p>
                <ul className="text-sm text-amber-900/90 space-y-2 list-disc pl-4">
                  <li>Meet in a public place and inspect items before you pay.</li>
                  <li>Keep communication on GreenHub when possible.</li>
                  <li>Never share bank PINs or pressure to pay off-platform.</li>
                </ul>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-6">
          <Link
            to="/settings"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
            className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </footer>
    </div>
  );
}
