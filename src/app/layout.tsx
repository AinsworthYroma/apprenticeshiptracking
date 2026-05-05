import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ApprentiTrack — Suivi de candidatures en alternance",
  description:
    "Trouvez et suivez vos candidatures en alternance à Paris. Lettres de motivation générées automatiquement, actualités entreprises, alumni Rennes SB.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 font-sans">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="bg-white border-t border-gray-200 py-6 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-400">
              ApprentiTrack · Spécialement conçu pour les étudiants de{" "}
              <span className="text-indigo-500 font-medium">Rennes School of Business</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
