import type { Metadata } from "next";
import "./globals.css";
import "./app.css";
import "./notifications.css";
import { MockStoreProvider } from "@/lib/mock-store";

export const metadata: Metadata = {
  title: "Provi Beans | Vietnamese specialty coffee, traced batch by batch",
  description:
    "Provi Beans sources Vietnamese specialty coffee and distributes it in the Philippines. Hà Nội, Huế and Saigon, slow roasted and accounted for batch by batch.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MockStoreProvider>{children}</MockStoreProvider>
      </body>
    </html>
  );
}
