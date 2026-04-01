export const getAvatarUrl = (
  avatarUrl?: string | null,
  gender?: string | null,
  name?: string | null
): string => {
  if (avatarUrl) return avatarUrl;

  const getInitials = (n: string) => {
    return n
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "?";
  };

  const initial = getInitials(name || "Seller");
  const genderKey = (gender || "").toString().trim().toLowerCase();
  const isMale = genderKey === "male" || genderKey === "m";
  const isFemale = genderKey === "female" || genderKey === "f";

  let bgColor = "#f3f4f6";
  let textColor = "#9ca3af";

  if (isMale) {
    bgColor = "#e0e7ff";
    textColor = "#4338ca";
  } else if (isFemale) {
    bgColor = "#fce7f3";
    textColor = "#be185d";
  }

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${bgColor}" />
      <path d="M50 50 C 35 50 30 65 30 85 L 70 85 C 70 65 65 50 50 50 Z" fill="${textColor}" opacity="0.16" />
      <circle cx="50" cy="35" r="15" fill="${textColor}" opacity="0.16" />
      <text x="50" y="58" font-family="system-ui, sans-serif" font-weight="700" font-size="28" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">
        ${initial}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
};
