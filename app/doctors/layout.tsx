import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doctors",
  description: "Browse PMDC-verified doctors on Ostrix and book an online or walk-in visit.",
};

export default function DoctorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
