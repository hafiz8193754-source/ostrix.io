import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an Ostrix account to book a doctor or register as a physician.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
