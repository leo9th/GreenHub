import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
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
import { useAuth, type UserProfile } from "../context/AuthContext";
import { getAvatarUrl } from "../utils/getAvatar";
import { supabase } from "../../lib/supabase";
import { useCurrency } from "../hooks/useCurrency";
import { getProductPrice } from "../utils/getProductPrice";
import { isOnlineFromLastActive, formatLastSeen } from "../utils/presence";

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

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

function isActiveListing(status: string | null | undefined): boolean {
  const st = (status ?? "").toLowerCase();
  if (!st || st === "active") return true;
  return st !== "sold" && st !== "inactive";
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
  const { id: routeUserId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = (searchParams.get("tab") || "").toLowerCase();
  const formatPrice = useCurrency();
  const { user: authUser, loading: authLoading, signOut } = useAuth();

  const targetUserId = useMemo(() => {
    const raw = routeUserId?.trim();
    if (raw) return raw;
    return authUser?.id ?? null;
  }, [routeUserId, authUser?.id]);

  const isOwnProfile = Boolean(authUser && targetUserId && authUser.id === targetUserId);

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

  const [viewProfile, setViewProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [soldCount, setSoldCount] = useState(0);
  const [verificationLabel, setVerificationLabel] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);

  const displayName =
    viewProfile?.full_name?.trim() ||
    (isOwnProfile ? authUser?.user_metadata?.full_name : null)?.trim() ||
    "Member";

  const avatar = getAvatarUrl(
    viewProfile?.avatar_url || (isOwnProfile ? authUser?.user_metadata?.avatar_url : null),
    viewProfile?.gender || (isOwnProfile ? authUser?.user_metadata?.gender : null),
    displayName,
  );

  const locationLabel = useMemo(() => {
    const state = viewProfile?.state?.trim();
    const lga = viewProfile?.lga?.trim();
    if (lga && state) return `${lga}, ${state}`;
    if (state) return state;
    if (lga) return lga;
    const addr = viewProfile?.address?.trim();
    if (addr) return addr;
    return "Location not set";
  }, [viewProfile?.state, viewProfile?.lga, viewProfile?.address]);

  const memberSince = viewProfile?.created_at
    ? new Date(viewProfile.created_at).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : isOwnProfile && authUser?.created_at
      ? new Date(authUser.created_at).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        })
      : "—";

  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;

  const activeListings = listings.filter((p) => isActiveListing(p.status));

  const loadData = useCallback(async () => {
    if (!targetUserId) {
      setViewProfile(null);
      setListings([]);
      setReviews([]);
      setSoldCount(0);
      setDataLoading(false);
      return;
    }

    if (routeUserId?.trim() && !isUuid(routeUserId)) {
      setLoadError("Invalid profile link.");
      setProfileMissing(true);
      setViewProfile(null);
      setListings([]);
      setReviews([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setLoadError(null);
    setProfileMissing(false);

    try {
      let profRow: UserProfile | null = null;

      if (isOwnProfile && authUser) {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, full_name, phone, avatar_url, gender, state, lga, address, bio, auto_reply, email, created_at, updated_at, last_active, show_phone_on_profile, show_email_on_profile",
          )
          .eq("id", targetUserId)
          .maybeSingle();
        if (error && error.code !== "PGRST116") throw error;
        profRow = (data as UserProfile) ?? null;

        if (!profRow) {
          profRow = {
            id: targetUserId,
            full_name: (authUser.user_metadata?.full_name as string) ?? null,
            phone: (authUser.user_metadata?.phone as string) ?? null,
            avatar_url: (authUser.user_metadata?.avatar_url as string) ?? null,
            gender: (authUser.user_metadata?.gender as string) ?? null,
            state: (authUser.user_metadata?.state as string) ?? null,
            lga: (authUser.user_metadata?.lga as string) ?? null,
            address: (authUser.user_metadata?.address as string) ?? null,
            bio: null,
            created_at: authUser.created_at,
          };
          setProfileMissing(false);
        }
      } else {
        const { data: pub, error: pubErr } = await supabase
          .from("profiles_public")
          .select("id, full_name, avatar_url, gender, bio, state, lga, created_at, updated_at, last_active, phone, public_email")
          .eq("id", targetUserId)
          .maybeSingle();

        if (!pubErr && pub) {
          const pubRow = pub as UserProfile & { public_email?: string | null };
          profRow = {
            ...pubRow,
            email: pubRow.public_email ?? null,
            address: null,
          };
        } else {
          const { data: fb, error: fbErr } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, gender, bio, state, lga, created_at, updated_at")
            .eq("id", targetUserId)
            .maybeSingle();
          if (fbErr && fbErr.code !== "PGRST116" && !String(fbErr.message).includes("permission")) {
            throw fbErr;
          }
          profRow = fb ? ({ ...(fb as UserProfile), phone: null, address: null } as UserProfile) : null;
        }

        if (!profRow) {
          setProfileMissing(true);
        }
      }

      setViewProfile(profRow);

      const { data: productRows, error: pErr } = await supabase
        .from("products")
        .select("id, title, image, condition, price_local, price, status")
        .eq("seller_id", targetUserId)
        .order("created_at", { ascending: false });

      if (pErr) throw pErr;
      setListings((productRows ?? []) as Listing[]);
      setSoldCount(
        (productRows ?? []).filter((r: { status?: string | null }) => (r.status ?? "").toLowerCase() === "sold").length,
      );

      const { data: verRows, error: vErr } = await supabase
        .from("seller_verification")
        .select("status")
        .eq("seller_id", targetUserId);

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
        .eq("seller_id", targetUserId)
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
          const { data: profs } = await supabase.from("profiles_public").select("id, full_name").in("id", ids);
          for (const p of profs ?? []) {
            if (p.id) nameMap.set(String(p.id), (p.full_name as string) || "Buyer");
          }
        }
        setReviews(
          rows.map((r) => ({
            ...r,
            reviewer_name: nameMap.get(r.reviewer_id) || "Buyer",
          })),
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
  }, [targetUserId, isOwnProfile, authUser, routeUserId]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!targetUserId) {
      navigate("/login", { replace: true });
      return;
    }
    void loadData();
  }, [authLoading, authUser, navigate, loadData, targetUserId]);

  if (authLoading || !authUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#22c55e]" />
      </div>
    );
  }

  if (!targetUserId) {
    return null;
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "products", label: "Products" },
    { id: "reviews", label: "Reviews" },
    { id: "about", label: "About" },
    { id: "contact", label: "Contact" },
  ];

  const phoneDisplay =
    isOwnProfile && (viewProfile?.phone || authUser.user_metadata?.phone)
      ? String(viewProfile?.phone || authUser.user_metadata?.phone || "")
      : null;

  const contactPhoneOthers =
    !isOwnProfile && viewProfile?.phone != null && String(viewProfile.phone).trim() !== ""
      ? String(viewProfile.phone).trim()
      : null;

  const contactEmailOthers =
    !isOwnProfile && viewProfile?.email != null && String(viewProfile.email).trim() !== ""
      ? String(viewProfile.email).trim()
      : null;

  const contactEmailOwn =
    isOwnProfile &&
    viewProfile?.show_email_on_profile &&
    viewProfile?.email != null &&
    String(viewProfile.email).trim() !== ""
      ? String(viewProfile.email).trim()
      : authUser?.email && viewProfile?.show_email_on_profile
        ? authUser.email
        : null;

  const profileOnline = isOnlineFromLastActive(viewProfile?.last_active);

  return (
    <div className="min-h-screen bg-gray-100 pb-28">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">{isOwnProfile ? "Profile" : "Member profile"}</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-4 space-y-4">
        {profileMissing && !dataLoading ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
            No public profile was found for this account. The user may not have completed their profile yet.
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-gray-200/80 text-center">
          <img
            src={avatar}
            alt=""
            className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-gray-50 shadow-md border border-gray-100"
          />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{displayName}</h2>

          <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-gray-500">
            {profileOnline ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Online now
              </span>
            ) : viewProfile?.last_active ? (
              <span className="inline-flex items-center gap-1 text-gray-500">
                <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                {formatLastSeen(viewProfile.last_active)}
              </span>
            ) : null}
          </div>

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

          <p className="mt-1 text-xs text-gray-400">Member since {memberSince}</p>

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

          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
            {isOwnProfile ? (
              <Link
                to="/settings/profile/edit"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 shadow-sm"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit profile
              </Link>
            ) : (
              <Link
                to={`/messages/u/${targetUserId}`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#22c55e] rounded-xl hover:bg-[#16a34a] shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Chat
              </Link>
            )}
          </div>
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
                                  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="#f3f4f6" width="200" height="150"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="12">No image</text></svg>`,
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
                    {viewProfile?.bio?.trim()
                      ? viewProfile.bio
                      : isOwnProfile
                        ? "Add a short bio in Edit profile → About you."
                        : "This member hasn’t added a bio yet."}
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
                {isOwnProfile ? (
                  <>
                    <div className="rounded-xl ring-1 ring-gray-100 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Phone</p>
                      {phoneDisplay ? (
                        <a
                          href={`tel:${phoneDisplay.replace(/\s/g, "")}`}
                          className="inline-flex items-center gap-2 text-[#15803d] font-medium text-sm"
                        >
                          <Phone className="w-4 h-4 shrink-0" />
                          {phoneDisplay}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500">Add a phone number in Edit profile.</p>
                      )}
                      {phoneDisplay && viewProfile?.show_phone_on_profile === false ? (
                        <p className="text-[11px] text-amber-700 mt-2">
                          Your number is hidden on your public profile. Enable “Show phone on profile” in Edit profile to let buyers call you from your page.
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl ring-1 ring-gray-100 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Email</p>
                      {contactEmailOwn ? (
                        <a
                          href={`mailto:${contactEmailOwn}`}
                          className="inline-flex items-center gap-2 text-[#15803d] font-medium text-sm break-all"
                        >
                          {contactEmailOwn}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {viewProfile?.show_email_on_profile
                            ? "Add an email on your profile in Edit profile."
                            : "Enable “Show email on profile” in Edit profile to display your contact email to others."}
                        </p>
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
                  </>
                ) : (
                  <>
                    <Link
                      to={`/messages/u/${targetUserId}`}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#22c55e] text-white font-semibold text-sm hover:bg-[#16a34a] transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Chat with {displayName.split(/\s+/)[0] || "seller"}
                    </Link>
                    {contactPhoneOthers ? (
                      <a
                        href={`tel:${contactPhoneOthers.replace(/\s/g, "")}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl ring-1 ring-gray-200 text-gray-800 font-semibold text-sm hover:bg-gray-50"
                      >
                        <Phone className="w-5 h-5 text-[#15803d]" />
                        {contactPhoneOthers}
                      </a>
                    ) : null}
                    {contactEmailOthers ? (
                      <a
                        href={`mailto:${contactEmailOthers}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl ring-1 ring-gray-200 text-gray-800 font-semibold text-sm hover:bg-gray-50"
                      >
                        Email
                      </a>
                    ) : null}
                    <p className="text-xs text-center text-gray-500">Start a conversation about a listing.</p>
                  </>
                )}

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

      {isOwnProfile ? (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-6">
            <Link to="/settings" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
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
      ) : null}
    </div>
  );
}
