import "./globals.css";
import { League_Spartan } from "next/font/google";

const leagueSpartan = League_Spartan({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-league-spartan",
});

export const metadata = {
  title: {
    default: "TileLoop — tile cut planner",
    template: "%s | TileLoop",
  },
  description: "Create private tile projects, inspect kerf-aware cut estimates, and retain a versioned calculation history for on-site review.",
  applicationName: "TileLoop",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={leagueSpartan.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
