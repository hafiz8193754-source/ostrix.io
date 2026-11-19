import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify a prescription",
  description: "Check that an Ostrix prescription code is genuine and unchanged.",
};

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
