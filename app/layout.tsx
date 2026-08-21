import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./library.css";
import "./diagnostics.css";
import "./coach.css";
import "./programme.css";
import "./navigation.css";
export const metadata: Metadata = { metadataBase: new URL("https://vector-golf-performance.vercel.app"), title: { default: "Vector Golf Performance", template: "%s · Vector Golf Performance" }, description: "A 12-week, data-led golf performance programme that turns every round into focused practice.", applicationName: "Vector Golf Performance", manifest: "/manifest.webmanifest", icons: { icon: "/favicon.svg", apple: "/icon-192.svg" }, openGraph: { title: "Vector Golf Performance", description: "Know what to practise. Understand why. Improve with purpose.", images: ["/vector-golf-social.png"] }, twitter: { card: "summary_large_image", title: "Vector Golf Performance", description: "Know what to practise. Understand why. Improve with purpose.", images: ["/vector-golf-social.png"] } };
export const viewport: Viewport = { themeColor: "#102a24", colorScheme: "light" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}` }} /></body></html>; }
