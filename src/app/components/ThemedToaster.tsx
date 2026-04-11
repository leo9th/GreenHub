import { Toaster } from "sonner";
import { useTheme } from "../context/ThemeContext";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="top-center" richColors theme={resolvedTheme} />;
}
