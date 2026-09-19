import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAD Transfer",
  description:
    "Demo web app for converting MWK into USDT and funding a virtual card for international purchases.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
