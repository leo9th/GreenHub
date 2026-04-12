import { ExternalLink } from "lucide-react";

type Props = {
  productTitle: string;
  className?: string;
};

const LINKS: { label: string; href: (q: string) => string }[] = [
  {
    label: "Jumia Nigeria",
    href: (q) => `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(q)}`,
  },
  {
    label: "Konga",
    href: (q) => `https://www.konga.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    label: "AliExpress",
    href: (q) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}`,
  },
  {
    label: "eBay",
    href: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
  },
];

export function SimilarProductsLinks({ productTitle, className = "" }: Props) {
  const q = productTitle.trim() || "product";
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ring-1 ring-gray-200/80 ${className}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Compare on other marketplaces</h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {LINKS.map(({ label, href }) => (
          <li key={label}>
            <a
              href={href(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#15803d] hover:underline"
            >
              {label}
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-gray-400">Opens a search for this title on each site (not affiliated).</p>
    </div>
  );
}
