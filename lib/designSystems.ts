export type BusinessCategory = "restaurant" | "portfolio" | "service" | "ecommerce" | "tech" | "health";

export interface DesignSystem {
  fontUrl: string;
  displayFont: string;
  bodyFont: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  heroStyle: "centered" | "split" | "fullscreen";
  animationStyle: "subtle" | "bold" | "elegant";
  sectionOrder: string[];
  context: string;
}

export const DESIGN_SYSTEMS: Record<BusinessCategory, DesignSystem> = {
  restaurant: {
    fontUrl: "https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600&display=swap",
    displayFont: "'Fraunces', serif",
    bodyFont: "'Inter', sans-serif",
    primaryColor: "#8B4513",
    secondaryColor: "#FDF6E3",
    accentColor: "#D4A017",
    bgColor: "#FFFBF2",
    textColor: "#2B1B0E",
    heroStyle: "fullscreen",
    animationStyle: "elegant",
    sectionOrder: ["nav", "hero", "menu-highlights", "about-story", "testimonials", "reservation-cta", "footer"],
    context:
      "This is a restaurant, cafe, or food business. Tone: warm, appetite-driving, sensory. Use warm amber, cream, and deep brown as the palette — this should feel like a place people want to sit down in, not a generic template. Hero should evoke atmosphere — use a real Unsplash photo of a signature dish or a warm interior (e.g. https://source.unsplash.com/1600x900/?restaurant,food), not a generic gradient. Include a menu section with real dish names, prices in PKR, and short evocative descriptions (not just ingredient lists). A reservation or order-ahead CTA belongs near the top and again before the footer. Testimonials should read like real regulars, with Pakistani names and specific praise ('the karahi here is unmatched'). If the brief implies delivery or booking, wire a working contact/booking form. Typography should pair a warm serif display face with a clean sans body — nothing corporate."
  },
  portfolio: {
    fontUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&display=swap",
    displayFont: "'Space Grotesk', sans-serif",
    bodyFont: "'Inter', sans-serif",
    primaryColor: "#0F0F0F",
    secondaryColor: "#FAF9F6",
    accentColor: "#FF3B30",
    bgColor: "#FAF9F6",
    textColor: "#0F0F0F",
    heroStyle: "split",
    animationStyle: "bold",
    sectionOrder: ["nav", "hero", "selected-work", "about-story", "process", "cta", "footer"],
    context:
      "This is a portfolio for a creative individual — photographer, designer, developer, or similar. Tone: confident, minimal, personality-forward. Use near-black, warm off-white, and exactly one bold accent color — resist adding more colors than that. The hero should lead with a striking headline about their craft, not a generic 'Welcome to my portfolio.' A work/gallery section should showcase 4-6 pieces with hover states (scale/overlay), each using a real Unsplash photo matched to their craft (photography, design, development — pick keywords that fit) — describe each piece with a real-sounding project name and one-line result. About section should read like a real bio with a specific point of view, not corporate filler. Typography carries most of the visual weight here — use a distinctive geometric or grotesque display font at large sizes with generous whitespace. Scroll-reveal animations should feel intentional and a little bold, not timid."
  },
  service: {
    fontUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
    displayFont: "'Manrope', sans-serif",
    bodyFont: "'Inter', sans-serif",
    primaryColor: "#1D4ED8",
    secondaryColor: "#FFFFFF",
    accentColor: "#F97316",
    bgColor: "#FFFFFF",
    textColor: "#0F172A",
    heroStyle: "centered",
    animationStyle: "subtle",
    sectionOrder: ["nav", "hero", "trust-stats", "services-grid", "about-story", "cta-band", "footer"],
    context:
      "This is a local service business — plumbing, electrical, cleaning, tutoring, repair, or similar trade/professional service. Tone: trustworthy, responsive, no-nonsense. Palette: a dependable blue as primary, clean white background, orange as the single warm accent for CTAs. The hero must lead with the core promise (fast response, licensed/certified, guaranteed work) and a prominent 'Call now' or 'Book a visit' CTA — this audience wants to act immediately, not browse. Include a trust-stats row (years in business, jobs completed, response time) since credibility is the main conversion lever for service businesses. Services grid should list 3-6 concrete services with icons and pricing hints ('Starting from Rs. X'). A booking form with date/time validation belongs on its own page or the contact section. Keep animations subtle and fast — this audience is often on mobile with slower connections."
  },
  ecommerce: {
    fontUrl: "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
    displayFont: "'Poppins', sans-serif",
    bodyFont: "'Inter', sans-serif",
    primaryColor: "#DC2626",
    secondaryColor: "#F5F5F4",
    accentColor: "#FACC15",
    bgColor: "#FFFFFF",
    textColor: "#1C1917",
    heroStyle: "split",
    animationStyle: "bold",
    sectionOrder: ["nav", "hero", "product-grid", "value-props", "testimonials", "cta-band", "footer"],
    context:
      "This is a retail or ecommerce storefront. Tone: energetic, product-forward, conversion-focused. Palette: a bold primary brand color, neutral gray/white for breathing room, and a punchy accent color reserved for 'Add to cart' / 'Shop now' actions so it always stands out. Hero should showcase the flagship product or category with a clear value prop and discount/offer if implied by the brief. A product grid with 6-9 items needs real product names, prices in PKR, and short benefit-driven descriptions — never 'Product 1'. Include value props (free shipping threshold, easy returns, secure payment) as a trust row, since Pakistani ecommerce buyers weigh this heavily. If the brief implies a cart, implement working in-memory cart logic (add/remove/quantity, running total) in script.js. Testimonials should mention specific products. Bold, snappy scroll animations suit this category — it should feel alive, not static."
  },
  tech: {
    fontUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
    displayFont: "'Sora', sans-serif",
    bodyFont: "'Inter', sans-serif",
    primaryColor: "#0B1120",
    secondaryColor: "#F8FAFC",
    accentColor: "#3B82F6",
    bgColor: "#FFFFFF",
    textColor: "#0B1120",
    heroStyle: "centered",
    animationStyle: "subtle",
    sectionOrder: ["nav", "hero", "logo-cloud", "features-grid", "how-it-works", "pricing", "cta-band", "footer"],
    context:
      "This is a tech, SaaS, or startup product. Tone: sharp, modern, credible. Palette: deep navy as primary, electric blue as the interactive accent, clean white background — this should look like it belongs on Product Hunt. Hero needs a specific, benefit-focused headline (never 'The future of X') plus a subheadline that clarifies exactly what the product does, with a primary CTA (Get started / Book a demo) and a secondary link (See how it works). A logo cloud or stats row builds credibility even for a new product — use plausible metrics. Features grid should describe 3-6 real capabilities with icons, not vague marketing speak. If the brief implies pricing, include a pricing section with 2-3 tiers and a toggle for monthly/annual if relevant. Keep motion subtle and precise — fast fades, no bounce — this audience associates restraint with engineering quality."
  },
  health: {
    fontUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500;600&display=swap",
    displayFont: "'Plus Jakarta Sans', sans-serif",
    bodyFont: "'Inter', sans-serif",
    primaryColor: "#0F766E",
    secondaryColor: "#FFFFFF",
    accentColor: "#84CC16",
    bgColor: "#FFFFFF",
    textColor: "#134E4A",
    heroStyle: "split",
    animationStyle: "subtle",
    sectionOrder: ["nav", "hero", "services-grid", "credentials", "about-story", "appointment-cta", "footer"],
    context:
      "This is a health, wellness, or clinical business — doctor's clinic, dentist, physio, salon/spa, or similar. Tone: calm, reassuring, professional. Palette: clean white as the dominant surface, calm teal as primary, soft green as a gentle accent — avoid anything that reads clinical-cold or alarming. Hero should lead with reassurance and clarity (what condition/need this addresses, why this provider) plus a prominent 'Book an appointment' CTA. A credentials/trust section (qualifications, years of experience, certifications) matters more here than almost any other category. Services grid should list specific treatments/services with plain-language descriptions, not jargon. An appointment booking form needs real field validation (name, phone, preferred date, reason for visit). Keep visuals calm and spacious — generous whitespace, soft rounded corners, gentle subtle animations — this audience is often anxious and the design should lower that, not add to it."
  },
};

// Maps the fast classification call's one-word answer to a design system,
// defaulting to "tech" for anything unrecognized (safest generic fallback).
export function classificationToCategory(word: string): BusinessCategory {
  const key = word.trim().toLowerCase().replace(/[^a-z]/g, "");
  return key in DESIGN_SYSTEMS ? (key as BusinessCategory) : "tech";
}
