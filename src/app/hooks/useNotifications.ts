/**
 * Notification Utilities for GreenHub Communication Hub
 * Provides helper functions and patterns for common notification scenarios
 */

import { useNotification } from "./NotificationProvider";

/**
 * Hook for message notifications (new message alerts)
 */
export function useMessageNotification() {
  const notif = useNotification();

  return {
    notifyNewMessage: (senderName: string, productName?: string) => {
      const title = `New message from ${senderName}`;
      const message = productName ? `Re: ${productName}` : undefined;
      notif.notify({
        type: "message",
        title,
        message,
        duration: 5000,
      });
    },

    notifyMessageSent: () => {
      notif.success("Message Sent", "Your message has been delivered.");
    },

    notifyMessageFailed: (error?: string) => {
      notif.error("Message Failed", error || "Could not send message. Try again.");
    },
  };
}

/**
 * Hook for order/transaction notifications
 */
export function useOrderNotification() {
  const notif = useNotification();

  return {
    notifyOrderConfirmed: (orderId: string) => {
      notif.success("Order Confirmed", `Order #${orderId} placed successfully.`);
    },

    notifyOrderShipped: (orderId: string) => {
      notif.notify({
        type: "order_update",
        title: "Order Shipped",
        message: `Order #${orderId} is on its way.`,
      });
    },

    notifyOrderDelivered: (orderId: string) => {
      notif.notify({
        type: "order_update",
        title: "Order Delivered",
        message: `Order #${orderId} has been delivered.`,
      });
    },

    notifyOrderFailed: (error?: string) => {
      notif.error("Order Error", error || "Could not process order. Try again.");
    },
  };
}

/**
 * Hook for product alerts
 */
export function useProductNotification() {
  const notif = useNotification();

  return {
    notifyPriceDrop: (productName: string, oldPrice: number, newPrice: number) => {
      notif.notify({
        type: "price_drop",
        title: "Price Drop!",
        message: `${productName}: ₦${oldPrice} → ₦${newPrice}`,
        duration: 6000,
      });
    },

    notifyProductReview: (productName: string, reviewerName: string) => {
      notif.notify({
        type: "message",
        title: "New Review",
        message: `${reviewerName} reviewed ${productName}`,
      });
    },

    notifyProductLiked: (likerName: string) => {
      notif.notify({
        type: "message",
        title: "Your Product Was Liked",
        message: `${likerName} liked your product.`,
      });
    },
  };
}

/**
 * Hook for user action notifications
 */
export function useActionNotification() {
  const notif = useNotification();

  return {
    notifyActionSuccess: (action: string, details?: string) => {
      notif.success(action, details);
    },

    notifyActionError: (action: string, error?: string) => {
      notif.error(action, error);
    },

    notifyActionWarning: (action: string, details?: string) => {
      notif.warning(action, details);
    },

    notifyActionInfo: (action: string, details?: string) => {
      notif.info(action, details);
    },
  };
}

/**
 * Hook for seller notifications
 */
export function useSellerNotification() {
  const notif = useNotification();

  return {
    notifyNewProductInquiry: (buyerName: string, productName: string) => {
      notif.notify({
        type: "message",
        title: "Product Inquiry",
        message: `${buyerName} asked about ${productName}`,
        duration: 5000,
      });
    },

    notifyProductBoostActive: (productName: string, daysRemaining: number) => {
      notif.success("Boost Active", `${productName} boost active for ${daysRemaining} days.`);
    },

    notifyProductBoostExpiring: (productName: string) => {
      notif.warning("Boost Expiring", `${productName} boost expires soon. Renew now.`);
    },

    notifyVerificationUpdate: (status: "approved" | "rejected" | "pending") => {
      const messages = {
        approved: { title: "Verified!", message: "Your seller account is now verified." },
        rejected: { title: "Verification Rejected", message: "Please review the requirements." },
        pending: { title: "Verification Pending", message: "Your application is being reviewed." },
      };
      const msg = messages[status];
      if (status === "approved") {
        notif.success(msg.title, msg.message);
      } else if (status === "rejected") {
        notif.error(msg.title, msg.message);
      } else {
        notif.info(msg.title, msg.message);
      }
    },
  };
}

/**
 * Hook for engagement notifications (likes, follows, etc.)
 */
export function useEngagementNotification() {
  const notif = useNotification();

  return {
    notifyNewFollower: (followerName: string) => {
      notif.notify({
        type: "message",
        title: "New Follower",
        message: `${followerName} started following you.`,
      });
    },

    notifyProfileLiked: (likerName: string) => {
      notif.notify({
        type: "message",
        title: "Profile Liked",
        message: `${likerName} liked your profile.`,
      });
    },

    notifyMentioned: (mentionerName: string) => {
      notif.notify({
        type: "message",
        title: "You Were Mentioned",
        message: `${mentionerName} mentioned you in a comment.`,
      });
    },
  };
}
