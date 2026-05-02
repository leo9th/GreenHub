type ServiceType = "shop" | "ride" | "send";

type BannerItem = {
  id: string;
  service: ServiceType;
  title: string;
  subtitle: string;
  image: string;
};

type FeaturedBannerStripProps = {
  selectedService: ServiceType;
};

const BANNERS: BannerItem[] = [
  {
    id: "shop-1",
    service: "shop",
    title: "Fresh arrivals in Electronics",
    subtitle: "Shop trusted sellers near you",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=80&auto=format&fit=crop",
  },
  {
    id: "shop-2",
    service: "shop",
    title: "Deals on Home Essentials",
    subtitle: "Save more on verified listings",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80&auto=format&fit=crop",
  },
  {
    id: "ride-1",
    service: "ride",
    title: "Quick city rides",
    subtitle: "Book in seconds and go",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&q=80&auto=format&fit=crop",
  },
  {
    id: "send-1",
    service: "send",
    title: "Send packages safely",
    subtitle: "Track every delivery step",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80&auto=format&fit=crop",
  },
];

export default function FeaturedBannerStrip({ selectedService }: FeaturedBannerStripProps) {
  const banners = BANNERS.filter((item) => item.service === selectedService);

  return (
    <div className="mb-6 flex gap-3 overflow-x-auto pl-4 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
      {banners.map((banner) => (
        <button
          key={banner.id}
          type="button"
          onClick={() => {}}
          aria-label={banner.title}
          className="relative h-40 w-[85%] shrink-0 snap-start overflow-hidden rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
        >
          <img src={banner.image} alt={banner.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/10" />
          <div className="absolute bottom-0 left-0 p-3 text-white">
            <p className="text-[15px] font-semibold">{banner.title}</p>
            <p className="text-xs opacity-85">{banner.subtitle}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
