import { Star, MapPin } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";

export interface ProductCardProps {
  image: string;
  condition: "New" | "Like New" | "Good" | "Fair";
  title: string;
  price: number;
  location: string;
  rating: number;
  deliveryFee?: number;
}

export function ProductCard({
  image,
  condition,
  title,
  price,
  location,
  rating,
  deliveryFee,
}: ProductCardProps) {
  const getConditionColor = (cond: string) => {
    switch (cond) {
      case "New": return "bg-[#22c55e] hover:bg-[#16a34a]";
      case "Like New": return "bg-[#86efac] text-gray-800 hover:bg-[#22c55e] hover:text-white";
      case "Good": return "bg-[#eab308] hover:bg-[#ca8a04]";
      case "Fair": return "bg-gray-400 hover:bg-gray-500";
      default: return "bg-gray-200 text-gray-800";
    }
  };

  return (
    <Card className="overflow-hidden group cursor-pointer transition-all hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={title}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
        <Badge className={`absolute top-2 left-2 ${getConditionColor(condition)}`}>
          {condition}
        </Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[40px] mb-2 leading-tight">
          {title}
        </h3>
        <p className="text-lg font-bold text-gray-900 mb-2">
          ₦{price.toLocaleString()}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-[100px]">{location}</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-500">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-gray-700">{rating.toFixed(1)}</span>
          </div>
        </div>
        {deliveryFee !== undefined && (
          <p className="text-xs text-gray-500 font-medium">
            + ₦{deliveryFee.toLocaleString()} delivery
          </p>
        )}
      </CardContent>
    </Card>
  );
}
