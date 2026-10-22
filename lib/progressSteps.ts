// Step definitions for the simulated real-time progress UI (hooks/useStepProgress.ts).
// Purely a client-side perceived-progress simulation — no real server events
// back these steps. Copy is taken directly from the product spec.

export interface ProgressContext {
  brief?: string;
  hasPhoto?: boolean;
  changeRequest?: string;
  fileNames?: string[];
}

export type DetailEntry = string | ((ctx: ProgressContext) => string);

export interface StepDef {
  id: string;
  label: string;
  /** Fixed seconds, or an [min, max] range — a random duration in range is picked at start(). */
  seconds: number | [number, number];
  details: DetailEntry[];
  /** Omit this step entirely when it returns false. */
  include?: (ctx: ProgressContext) => boolean;
}

// Best-effort, cosmetic only: decides whether to show the "Adding backend
// functions" step. The real decision happens server-side in Claude's output.
export function briefImpliesBackend(brief?: string): boolean {
  if (!brief) return false;
  const text = brief.toLowerCase();
  return ["contact form", "booking", "reservation", "newsletter", "subscribe", "order", "inquiry"].some((kw) =>
    text.includes(kw)
  );
}

export const BUILDER_STEPS: StepDef[] = [
  {
    id: "analyze",
    label: "Analyzing your brief",
    seconds: 1.5,
    details: ["Reading your description...", "Understanding requirements..."],
  },
  {
    id: "classify",
    label: "Detecting business type",
    seconds: 1.0,
    details: ["Classifying industry type...", "Matching to specialized agent..."],
  },
  {
    id: "design",
    label: "Selecting design system",
    seconds: 1.5,
    details: ["Choosing color palette...", "Selecting typography pairing...", "Defining spacing system..."],
  },
  {
    id: "html",
    label: "Generating HTML structure",
    seconds: [8, 12],
    details: [
      "Writing navigation with mobile menu...",
      "Building hero section with headline and CTA...",
      "Creating features grid with icons...",
      "Adding testimonials section...",
      "Generating contact form with validation...",
      "Building footer with links and social icons...",
    ],
  },
  {
    id: "css",
    label: "Writing CSS styles",
    seconds: [3, 4],
    details: [
      "Applying design tokens and custom properties...",
      "Styling responsive breakpoints...",
      "Adding hover effects and transitions...",
    ],
  },
  {
    id: "js",
    label: "Programming JavaScript",
    seconds: [3, 4],
    details: [
      "Coding mobile hamburger menu...",
      "Adding smooth scroll navigation...",
      "Programming scroll reveal animations...",
      "Writing form validation logic...",
    ],
  },
  {
    id: "backend",
    label: "Adding backend functions",
    seconds: [2, 3],
    details: ["Creating contact form API endpoint...", "Adding input validation and sanitization..."],
    include: (ctx) => briefImpliesBackend(ctx.brief),
  },
  {
    id: "review",
    label: "Quality review & polish",
    seconds: [2, 3],
    details: [
      "Reviewing visual hierarchy...",
      "Checking mobile responsiveness...",
      "Refining color harmony...",
      "Polishing hover states and transitions...",
    ],
  },
  {
    id: "final",
    label: "Final checks",
    seconds: [1, 2],
    details: ["Validating all links and sections...", "Confirming accessibility basics...", "Packaging project files..."],
  },
];

export const FARM_STEPS: StepDef[] = [
  {
    id: "read",
    label: "Reading crop details",
    seconds: 1.0,
    details: ["Processing crop type and location...", "Checking regional growing conditions..."],
  },
  {
    id: "soil",
    label: "Analyzing soil",
    seconds: 2.0,
    details: [
      "Examining soil color and texture...",
      "Identifying visible nutrient indicators...",
      "Comparing with regional soil profiles...",
    ],
    include: (ctx) => !!ctx.hasPhoto,
  },
  {
    id: "fertilizer",
    label: "Calculating fertilizer plan",
    seconds: [3, 4],
    details: [
      "Computing nutrient requirements per acre...",
      "Calculating urea and DAP quantities...",
      "Determining application schedule...",
    ],
  },
  {
    id: "irrigation",
    label: "Planning irrigation",
    seconds: 2.0,
    details: ["Analyzing water requirements...", "Creating irrigation schedule..."],
  },
  {
    id: "pests",
    label: "Assessing pest risks",
    seconds: 2.0,
    details: ["Identifying common pests for this crop and region...", "Recommending prevention measures..."],
  },
  {
    id: "prepare",
    label: "Preparing season plan",
    seconds: 1.5,
    details: ["Compiling complete farm plan...", "Estimating costs in PKR...", "Finalizing recommendations..."],
  },
];

export const REFINE_STEPS: StepDef[] = [
  {
    id: "read",
    label: "Reading your feedback",
    seconds: 0.8,
    details: ["Understanding requested changes..."],
  },
  {
    id: "identify",
    label: "Identifying affected files",
    seconds: 1.0,
    details: ["Checking which files need updates..."],
  },
  {
    id: "apply",
    label: "Applying changes",
    seconds: [3, 5],
    details: [
      (ctx) => (ctx.changeRequest ? `Applying your change: "${ctx.changeRequest}"...` : "Applying your requested changes..."),
      "Preserving existing structure...",
      "Updating styles to match...",
    ],
  },
  {
    id: "verify",
    label: "Verifying changes",
    seconds: 1.0,
    details: ["Confirming all sections still work...", "Done!"],
  },
];

export const DEPLOY_STEPS: StepDef[] = [
  {
    id: "prepare",
    label: "Preparing files",
    seconds: 0.5,
    details: ["Packaging project for deployment..."],
  },
  {
    id: "github",
    label: "Creating GitHub repository",
    seconds: [2, 3],
    details: [
      "Initializing repository...",
      (ctx) => (ctx.fileNames?.length ? `Committing ${ctx.fileNames[0]}...` : "Committing files..."),
      (ctx) => (ctx.fileNames && ctx.fileNames[1] ? `Committing ${ctx.fileNames[1]}...` : "Committing files..."),
      (ctx) => (ctx.fileNames && ctx.fileNames[2] ? `Committing ${ctx.fileNames[2]}...` : "Committing remaining files..."),
    ],
  },
  {
    id: "vercel",
    label: "Deploying to Vercel",
    seconds: [3, 5],
    details: ["Uploading files to Vercel...", "Building project...", "Configuring domain...", "Running final checks..."],
  },
  {
    id: "live",
    label: "Going live!",
    seconds: 0.5,
    details: ["Your site is now live on the internet!"],
  },
];
