import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailVerificationBanner } from "@/components/auth/AccountEmailForms";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "BiletFlow",
  description: "Self-service event ticketing for Kazakhstan.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Suspense
            fallback={
              <header className="h-20 border-b border-divider bg-surface" />
            }
          >
            <Navbar />
          </Suspense>
          <EmailVerificationBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
