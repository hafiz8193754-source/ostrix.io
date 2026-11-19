import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Ostrix to continue your visit, booking, or doctor tools.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
