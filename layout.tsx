import type { Metadata, Viewport } from "next";
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/components/ThemeContext'
import { PLATFORM_NAME } from '@/lib/branding'
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

export const viewport: Viewport = {
  themeColor: "#5B3FC8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: `${PLATFORM_NAME} | Gestión clínica para centros de terapia`,
  description: "Plataforma de gestión clínica para centros de terapia ABA, neuropsicología y desarrollo infantil: expedientes, agenda, informes con IA y portal para familias.",
  keywords: "gestión clínica, software terapia ABA, centros de terapia, TEA, TDAH, neurodesarrollo, portal familias",
  authors: [{ name: PLATFORM_NAME }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: PLATFORM_NAME,
    startupImage: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: `${PLATFORM_NAME} | Gestión clínica para centros de terapia`,
    description: "Plataforma de gestión clínica para centros de terapia, con IA y portal para familias.",
    type: "website",
    locale: "es_PE",
    ...(SITE_URL ? { url: SITE_URL } : {}),
    siteName: PLATFORM_NAME,
    images: [{ url: "/images/og-image.jpg", width: 1200, height: 630, alt: `${PLATFORM_NAME} - Gestión clínica` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PLATFORM_NAME} | Gestión clínica para centros de terapia`,
    description: "Plataforma de gestión clínica para centros de terapia, con IA y portal para familias.",
    images: ["/images/og-image.jpg"],
  },
  robots: { index: true, follow: true },
  ...(SITE_URL ? { alternates: { canonical: SITE_URL } } : {}),
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={PLATFORM_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registrado:', reg.scope); })
                  .catch(function(err) { console.log('SW error:', err); });
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
