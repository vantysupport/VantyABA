import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/components/ThemeContext'
import { CurrencyProvider } from '@/components/CurrencyContext'
import { CentroBrandingProvider } from '@/components/CentroBrandingContext'
import { I18nProvider } from '@/lib/i18n-context'
import SessionGuard from '@/components/SessionGuard'
import SuscripcionGuard from '@/components/SuscripcionGuard'
import RecordarSesionGuard from '@/components/RecordarSesionGuard'
import ErrorBoundary from '@/components/ErrorBoundary'
import MaintenanceGate from '@/components/MaintenanceGate'
import { ConfirmarHost } from '@/components/ui/confirmar'
import { CambiarClaveHost } from '@/components/ui/cambiar-clave'
import { PLATFORM_NAME } from '@/lib/branding'
import "./globals.css";

import { SITIO, localeServidor } from '@/lib/seo'

// Sistema de dos tipografías:
//  • CUERPO → Plus Jakarta Sans (var --font-sans): legible, profesional.
//  • TÍTULOS / NEGRITAS → Poppins (var --font-display): geométrica y con
//    presencia; el bold marca elegancia y jerarquía premium.
// La diferencia clara entre ambas (display bold vs body normal) da el look premium.
// Fuentes servidas desde el propio sitio (app/fonts, subconjunto latin de Google Fonts) para que la
// compilación no dependa de fonts.googleapis.com: sus URLs "/l/font?kit=…&skey=…" rompen
// next/font/google en Turbopack ("next/font/google queries have exactly one entry").
const jakarta = localFont({
  src: [
    { path: "./fonts/jakarta-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jakarta-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jakarta-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/jakarta-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

export const viewport: Viewport = {
  themeColor: "#0069db",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
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
    url: SITIO,
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
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El middleware (proxy.ts) setea `vanty_locale` según el prefijo /en o /es de
  // la URL. Lo leemos en el servidor para renderizar ya en el idioma correcto
  // (sin "flash" de español) y para el atributo <html lang>.
  const initialLocale = await localeServidor()
  return (
    <html lang={initialLocale} translate="no" className={`notranslate ${jakarta.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        {/* La app ya tiene su propio selector ES/EN. Evitamos que el Google Translate
            del navegador traduzca/atenúe la página (causaba el aspecto "lavado"). */}
        <meta name="google" content="notranslate" />
        {/* La app maneja su propio claro/oscuro → el navegador NO debe forzar/invertir
            colores (el "force dark" dejaba el login gris e ilegible). */}
        <meta name="color-scheme" content="light dark" />
        {/*
          🚫 ANTI-FOUC (Flash of Unstyled Content)
          En caché frío (incógnito / primera visita) el navegador alcanza a pintar
          el HTML antes de aplicar el CSS, mostrando el texto amontonado un instante.
          Arrancamos el <body> invisible y lo revelamos con un fade apenas el DOM
          está listo (cuando el CSS ya aplicó). Dos redes de seguridad evitan que
          quede en blanco: un timeout failsafe y un <noscript>.
        */}
        <style dangerouslySetInnerHTML={{ __html: `body{opacity:0;transition:opacity .25s ease}` }} />
        <noscript><style dangerouslySetInnerHTML={{ __html: `body{opacity:1!important}` }} /></noscript>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function(){
              function show(){ try{ if(document.body) document.body.style.opacity='1'; }catch(e){} }
              if (document.readyState !== 'loading') show();
              else document.addEventListener('DOMContentLoaded', show);
              window.addEventListener('load', show);
              setTimeout(show, 1500); // failsafe: nunca dejar la página invisible
            })();
          `
        }} />
        <meta name="google-site-verification" content="xQbKWmWgeRRPlZbv5h7rEDXAOw0TPHC3140_cyWT9OI" />
        <meta name="google-site-verification" content="Vm989cC49i4_RMsZFi23exrJONLlBnEvu00C4Zs1Lm4" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={PLATFORM_NAME} />
        <meta name="mobile-web-app-capable" content="yes" />

        {/*
          🔒 SILENCIADOR DE CONSOLA EN PRODUCCIÓN
          Neutraliza console.log/info/debug/warn/error en el navegador para que NO
          se filtren detalles internos (respuestas, IDs, errores) por la consola.
          Solo aplica en producción — en desarrollo la consola funciona normal.
          NOTA: esto no oculta la pestaña Red (eso es propio del navegador), pero
          sí elimina toda la información que la app imprimía en consola.
        */}
        {process.env.NODE_ENV === 'production' && (
          <script dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var noop = function(){};
                  ['log','info','debug','warn','error','trace','table','dir','group','groupEnd','count','time','timeEnd'].forEach(function(m){
                    if (window.console) window.console[m] = noop;
                  });
                } catch(e) {}
              })();
            `
          }} />
        )}

        {/*
          Script de pre-hidratación: aplica la clase `dark` ANTES del primer paint
          para evitar el "flash" de modo claro cuando el usuario tiene modo oscuro
          configurado en el OS. Lee localStorage y/o prefers-color-scheme.
          También quita la clase si la ruta es login (login siempre claro).
        */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var p = window.location.pathname.replace(/^\\/(en|es)(?=\\/|$)/, '') || '/';
                var isLogin = p === '/' || p === '/login';
                if (isLogin) {
                  // El login SIEMPRE es claro. Forzamos only light para que el
                  // navegador no lo invierta (force-dark) desde el primer pintado.
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'only light';
                  return;
                }
                var stored = localStorage.getItem('app-theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var dark = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark);
                if (dark) document.documentElement.classList.add('dark');
                else document.documentElement.classList.remove('dark');
                var cs = dark ? 'dark' : 'light';
                document.documentElement.style.colorScheme = cs;
                if (document.body) document.body.style.colorScheme = cs;
              } catch (e) { /* silencioso */ }
            })();
          `
        }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ConfirmarHost />
        <CambiarClaveHost />
        <ErrorBoundary>
          <I18nProvider initialLocale={initialLocale}>
            <ThemeProvider>
              <CurrencyProvider>
                <CentroBrandingProvider>
                  <ToastProvider>
                    <SessionGuard />
                    <SuscripcionGuard />
                    <RecordarSesionGuard />
                    <MaintenanceGate>
                      {children}
                    </MaintenanceGate>
                  </ToastProvider>
                </CentroBrandingProvider>
              </CurrencyProvider>
            </ThemeProvider>
          </I18nProvider>
        </ErrorBoundary>

        {/* El footer legal vive en la página de login (y landing). Se quitó del
            layout global porque aparecía molestando en todas las pantallas. */}

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
