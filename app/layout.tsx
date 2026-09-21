import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAD Transfer",
  description:
    "Demo web app for converting MWK into USDT and funding a virtual card for international purchases.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
