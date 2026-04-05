import { Navigate, useParams } from "react-router";

/** Legacy URL: forwards to the real profile reviews tab (Supabase-backed). */
export default function SellerReviews() {
  const { id } = useParams();
  const sid = id?.trim();
  if (!sid) return <Navigate to="/products" replace />;
  return <Navigate to={`/profile/${sid}?tab=reviews`} replace />;
}
