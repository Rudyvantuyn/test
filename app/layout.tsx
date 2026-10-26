import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Prijsdaler – bol.com prijsalerts", template: "%s | Prijsdaler" },
  description:
    "Volg de prijs van elk bol.com product. Ontvang een e-mail zodra de prijs daalt. Gratis, zonder account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <header>
          <nav>
            <Link href="/">Prijsdaler</Link>
            <Link href="/dalers">Grootste dalers</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer style={{ textAlign: "center", padding: 24 }}>
          <small>
            Prijsdaler is niet verbonden aan bol. Productlinks zijn affiliate-links; bij aankoop ontvangen wij een
            commissie, jij betaalt niets extra.
          </small>
        </footer>
      </body>
    </html>
  );
}
