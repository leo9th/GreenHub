export const getAvatarUrl = (
  avatarUrl?: string | null,
  gender?: string | null,
  name?: string | null
): string => {
  // If the user has explicitly uploaded a profile picture, use it
  if (avatarUrl) return avatarUrl;

  const getInitials = (n: string) => {
    return n.split(' ').map(part => part[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  const initial = getInitials(name || 'Seller');

  // Colors and Silhouettes Based on Gender
  let bgColor = "#f3f4f6"; // Light Gray (Neutral)
  let textColor = "#9ca3af";

  if (gender?.toLowerCase() === 'male') {
    bgColor = "#e0e7ff"; // Light Blue
    textColor = "#6366f1"; // Indigo
  } else if (gender?.toLowerCase() === 'female') {
    bgColor = "#fce7f3"; // Light Pink
    textColor = "#ec4899"; // Pink
  }

  // Create an inline scalable SVG string
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${bgColor}" />
      <!-- Base silhouette head/shoulders -->
      <path d="M50 50 C 35 50 30 65 30 85 L 70 85 C 70 65 65 50 50 50 Z" fill="${textColor}" opacity="0.15" />
      <circle cx="50" cy="35" r="15" fill="${textColor}" opacity="0.15" />
      <!-- Initials Overlay -->
      <text x="50" y="55" font-family="system-ui, sans-serif" font-weight="bold" font-size="28" fill="${textColor}" text-anchor="middle" dominant-baseline="central">
        ${initial}
      </text>
    </svg>
  `;

  // Return base64 or url encoded SVG
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
};
