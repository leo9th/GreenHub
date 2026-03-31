import { Star, MessageSquare, PhoneCall, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";

export interface SellerCardProps {
  avatarUrl?: string;
  name: string;
  rating: number;
  totalReviews: number;
  totalSales: number;
  isVerified?: boolean;
}

export function SellerCard({
  avatarUrl,
  name,
  rating,
  totalReviews,
  totalSales,
  isVerified = false,
}: SellerCardProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border border-gray-100">
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{name}</h3>
              {isVerified && (
                <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
              )}
            </div>
            
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium text-gray-900">{rating.toFixed(1)}</span>
                <span className="text-gray-500">({totalReviews})</span>
              </div>
              <div className="flex items-center gap-1">
                <span>📦</span>
                <span>{totalSales} sales</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 w-full mt-1">
          <Button variant="outline" className="flex-1 gap-2 border-primary text-primary hover:bg-primary/5">
            <MessageSquare className="w-4 h-4" />
            Chat
          </Button>
          <Button variant="default" className="flex-1 gap-2 bg-primary hover:bg-primary-dark">
            <PhoneCall className="w-4 h-4" />
            Call
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
