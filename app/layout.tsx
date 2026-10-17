import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./app.css";
import "./notifications.css";
import { MockStoreProvider } from "@/lib/mock-store";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Provi Beans | Vietnamese specialty coffee, traced batch by batch",
  description:
    "Provi Beans sources Vietnamese specialty coffee and distributes it in the Philippines. Hà Nội, Huế and Saigon, slow roasted and accounted for batch by batch.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8ded0" },
    { media: "(prefers-color-scheme: dark)", color: "#2c1f1b" },
  ],
};

const themeScript = `try{var t=localStorage.getItem("provi-beans-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else document.documentElement.removeAttribute("data-theme")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <MockStoreProvider>{children}</MockStoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
