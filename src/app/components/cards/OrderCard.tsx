import { Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";

export type OrderStatus = "Pending" | "Processing" | "Shipped" | "Delivered";

export interface OrderCardProps {
  orderNumber: string;
  date: string;
  productImage: string;
  productTitle: string;
  price: number;
  quantity: number;
  status: OrderStatus;
  trackingNumber?: string;
}

export function OrderCard({
  orderNumber,
  date,
  productImage,
  productTitle,
  price,
  quantity,
  status,
  trackingNumber,
}: OrderCardProps) {
  const getStatusBadge = () => {
    switch (status) {
      case "Delivered":
        return (
          <div className="flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Delivered
          </div>
        );
      case "Shipped":
        return (
          <div className="flex items-center gap-1 text-xs font-medium bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
            <Truck className="w-3.5 h-3.5" />
            Shipped
          </div>
        );
      case "Processing":
        return (
          <div className="flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
            <Package className="w-3.5 h-3.5" />
            Processing
          </div>
        );
      case "Pending":
      default:
        return (
          <div className="flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </div>
        );
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Order #{orderNumber}</p>
            <p className="text-xs text-gray-500 mt-0.5">{date}</p>
          </div>
          {getStatusBadge()}
        </div>

        <div className="flex gap-4 mb-4">
          <div className="h-20 w-20 shrink-0 rounded-md bg-gray-100 overflow-hidden border border-gray-200">
            <img 
              src={productImage} 
              alt={productTitle}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
              {productTitle}
            </h4>
            <p className="text-xs text-gray-500 mb-2">Quantity: {quantity}</p>
            <p className="text-sm font-bold text-gray-900">
              ₦{price.toLocaleString()}
            </p>
          </div>
        </div>

        {trackingNumber && status === "Shipped" && (
          <div className="bg-gray-50 p-2.5 rounded-md text-xs text-gray-600 mb-4 border border-gray-100">
            <span className="font-medium">Tracking:</span> {trackingNumber}
          </div>
        )}

        <div className="flex items-center gap-2 mt-auto">
          {status === "Delivered" ? (
            <>
              <Button variant="outline" className="flex-1 text-xs h-9">Write Review</Button>
              <Button className="flex-1 text-xs h-9 bg-primary hover:bg-primary-dark">Buy Again</Button>
            </>
          ) : (
            <>
              {status === "Shipped" && (
                <Button variant="outline" className="flex-1 text-xs h-9">Track Order</Button>
              )}
              <Button variant="secondary" className="flex-1 text-xs h-9 bg-gray-100 text-gray-800 hover:bg-gray-200">
                View Details
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
