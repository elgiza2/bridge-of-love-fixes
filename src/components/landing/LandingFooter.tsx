/** @doc Site-wide footer — Megsy "liquid glass" design with cinematic video backdrop. */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BrandLogo, BrandWord } from "@/components/brand/BrandLogo";
import { translateExactText, useUserLang } from "@/lib/authI18n";

/* ============================ Data ============================ */

type LinkItem = { label: string; href: string; external?: boolean };

// Only live destinations belong here — retired marketing routes silently
// redirect to /chat, which reads as a broken footer link.
const columns: { title: string; links: LinkItem[] }[] = [
  {
    title: "Product",
    links: [
      { label: "AI Chat", href: "/chat" },
      { label: "Pricing", href: "/pricing" },
      { label: "Restore Purchase", href: "/restore" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Refunds", href: "/refund" },
    ],
  },
];

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260429_114316_1c7889ad-2885-410e-b493-98119fee0ddb.mp4";

/* ============================ Footer ============================ */

const LandingFooter = () => {
  const lang = useUserLang();
  const tx = (text: string) => translateExactText(text, lang);
  const navigate = useNavigate();

  const onNavigate = (href: string, external?: boolean) => {
    if (external || /^https?:\/\//.test(href) || href.startsWith("mailto:")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className="relative w-full overflow-hidden font-sans selection:bg-foreground/20 selection:text-foreground"
      style={{ fontFamily: '"Helvetica Regular", ui-sans-serif, system-ui, sans-serif' }}
    >
      {/* Cinematic video backdrop */}
      <video
        className="absolute inset-0 w-full h-full object-cover z-0"
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      {/* Dark scrim so glass reads properly */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/70 via-black/40 to-black/80 pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-8 pt-24 md:pt-40 pb-8">
        <motion.footer
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="lumina-glass w-full rounded-3xl p-6 md:p-10 text-foreground/70"
        >
          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
            {/* Brand col */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <BrandLogo
                  alt="Megsy logo"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                  loading="lazy"
                  decoding="async"
                />

                <BrandWord className="text-xl font-medium tracking-wide">MEGSY</BrandWord>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                {tx("Megsy is the all-in-one AI workspace — chat, images, video, slides, docs and code, in one calm canvas.")}
              </p>
            </div>

            {/* Links col */}
            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
              {columns.map((col) => (
                <div key={col.title}>
                  <h3 className="text-sm uppercase tracking-wider text-foreground font-medium mb-4">
                    {tx(col.title)}
                  </h3>
                  <ul className="text-xs space-y-2">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <button
                          type="button"
                          onClick={() => onNavigate(l.href, l.external)}
                          className="text-left hover:text-foreground transition-colors"
                        >
                          {tx(l.label)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </motion.footer>
      </div>
    </div>
  );
};

export default LandingFooter;
