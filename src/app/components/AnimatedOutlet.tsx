import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router";

/**
 * Route-level fade transition; keyed by pathname so exit completes before enter (mode="wait").
 */
export default function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname + location.search}
        className="flex flex-1 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
