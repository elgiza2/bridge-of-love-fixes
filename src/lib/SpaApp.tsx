import { HelmetProvider } from "react-helmet-async";
import { LazyMotion } from "framer-motion";
import App from "@/App";
import ClerkGate from "@/components/auth/ClerkGate";

// Keep `domMax` — the app uses drag/pan/layoutId across sidebars, sheets,
// and chat (see ChatPage, MobilePushShell, MobileBottomSheet, AppSidebar).
// Downgrading to `domAnimation` disables those features silently.
const loadMotionFeatures = () => import("framer-motion").then((m) => m.domMax);

/**
 * Full client-side app tree. Only ever imported dynamically from the "/$"
 * route on the client, so nothing here is evaluated during SSR.
 */
export default function SpaApp() {
  return (
    <HelmetProvider>
      <LazyMotion features={loadMotionFeatures} strict={false}>
        <ClerkGate>
          <App />
        </ClerkGate>
      </LazyMotion>
    </HelmetProvider>
  );
}
