import type { Metadata } from "next";
import "./globals.css";
import "./app.css";

export const metadata: Metadata = {
  title: "Provi Beans | Vietnamese specialty coffee, traced lot by lot",
  description:
    "Provi Beans sources Vietnamese specialty coffee and distributes it in the Philippines. Hà Nội, Huế and Saigon, slow roasted and accounted for lot by lot.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
