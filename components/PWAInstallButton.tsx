'use client'
import { PLATFORM_NAME } from '@/lib/branding'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, X, Share, MoreVertical, SquarePlus, Check, Compass, Smartphone } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

type Plataforma = 'android' | 'ios' | 'desktop'

// Aviso para instalar Vanty como app en el celular + guía paso a paso (iPhone / Android).
export default function PWAInstallButton() {
  const { locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [platform, setPlatform] = useState<Plataforma | null>(null)
  const [iosSafari, setIosSafari] = useState(true)
  const [showInstructions, setShowInstructions] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true)
      return
    }
    try { if (sessionStorage.getItem('pwa_install_dismissed')) { setDismissed(true); return } } catch { /* sin storage */ }

    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (isIOS) {
      setPlatform('ios')
      // En iPhone solo Safari permite "Añadir a pantalla de inicio"
      setIosSafari(!/crios|fxios|edgios|opios/.test(ua))
    } else setPlatform(/android/.test(ua) ? 'android' : 'desktop')

    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    const instalada = () => { setIsInstalled(true); setInstallPrompt(null) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', instalada)
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', instalada) }
  }, [])

  const bannerVisible = !isInstalled && !dismissed && !!platform && platform !== 'desktop' && !showInstructions

  // Avisa a otros avisos flotantes (notificaciones) para que no se encimen
  useEffect(() => {
    document.body.dataset.pwaBanner = bannerVisible || showInstructions ? '1' : ''
    window.dispatchEvent(new Event('vanty:pwa-banner'))
  }, [bannerVisible, showInstructions])

  const handleInstall = async () => {
    if (platform === 'android' && installPrompt) {
      setInstalling(true)
      try {
        installPrompt.prompt()
        const { outcome } = await installPrompt.userChoice
        if (outcome === 'accepted') setIsInstalled(true)
      } finally {
        setInstalling(false)
        setInstallPrompt(null)
      }
      return
    }
    setShowInstructions(true)
  }

  const dismiss = () => {
    try { sessionStorage.setItem('pwa_install_dismissed', '1') } catch { /* sin storage */ }
    setDismissed(true)
    setShowInstructions(false)
  }

  if (isInstalled || !platform || platform === 'desktop') return null

  const pasosIOS = iosSafari ? [
    { Icon: Share, t: L('Tap Share', 'Toca Compartir'), d: L('The square with an arrow, at the bottom of Safari.', 'El cuadrado con una flecha, en la barra inferior de Safari.') },
    { Icon: SquarePlus, t: L('"Add to Home Screen"', '"Añadir a pantalla de inicio"'), d: L('Scroll down the menu until you see it.', 'Desliza el menú hacia abajo hasta encontrarlo.') },
    { Icon: Check, t: L('Tap "Add"', 'Toca "Añadir"'), d: L(`${PLATFORM_NAME} will appear on your home screen like any app.`, `${PLATFORM_NAME} aparecerá en tu pantalla de inicio como cualquier app.`) },
  ] : [
    { Icon: Compass, t: L('Open this page in Safari', 'Abre esta página en Safari'), d: L('On iPhone, only Safari can install apps from the web.', 'En iPhone, solo Safari puede instalar apps desde la web.') },
    { Icon: Share, t: L('Tap Share', 'Toca Compartir'), d: L('The square with an arrow, at the bottom of Safari.', 'El cuadrado con una flecha, en la barra inferior de Safari.') },
    { Icon: SquarePlus, t: L('"Add to Home Screen"', '"Añadir a pantalla de inicio"'), d: L('Then tap "Add".', 'Luego toca "Añadir".') },
  ]
  const pasosAndroid = [
    { Icon: MoreVertical, t: L('Open the Chrome menu', 'Abre el menú de Chrome'), d: L('The three dots in the top-right corner.', 'Los tres puntos en la esquina superior derecha.') },
    { Icon: Download, t: L('"Install app"', '"Instalar app"'), d: L('Or "Add to Home screen", depending on your phone.', 'O "Añadir a pantalla de inicio", según tu celular.') },
    { Icon: Check, t: L('Confirm with "Install"', 'Confirma con "Instalar"'), d: L(`${PLATFORM_NAME} will appear with your other apps.`, `${PLATFORM_NAME} aparecerá junto a tus otras apps.`) },
  ]
  const pasos = platform === 'ios' ? pasosIOS : pasosAndroid

  return (
    <AnimatePresence>
      {/* ── Aviso de instalación ── */}
      {bannerVisible && (
        <motion.div data-app-chrome key="banner" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="v-scope fixed bottom-24 left-3 right-3 z-50">
          <div className="relative flex items-center gap-3 overflow-hidden rounded-v border border-v-border bg-v-elevated p-3 pr-2 shadow-v">
            <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
            <img src="/brand/vanty-logo-96.png" alt="" className="size-11 shrink-0 rounded-[26%] shadow-v" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-v-text">{L(`Install ${PLATFORM_NAME} ABA`, `Instala ${PLATFORM_NAME} ABA`)}</p>
              <p className="text-xs text-v-muted">{L('Faster access, like a real app', 'Acceso más rápido, como una app')}</p>
            </div>
            <button onClick={handleInstall} disabled={installing}
              className="v-brand inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60">
              {installing ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <><Download size={13} /> {L('Install', 'Instalar')}</>}
            </button>
            <button onClick={dismiss} aria-label={L('Close', 'Cerrar')} className="grid size-8 shrink-0 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={15} /></button>
          </div>
        </motion.div>
      )}

      {/* ── Guía paso a paso ── */}
      {showInstructions && (
        <motion.div data-app-chrome key="guia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="v-scope fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center" onClick={dismiss}>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            role="dialog" aria-modal="true" aria-labelledby="pwa-guia-titulo"
            className="w-full max-w-md overflow-hidden rounded-[26px] bg-v-elevated shadow-v" onClick={e => e.stopPropagation()}>

            {/* Cabecera con ARIA */}
            <div className="v-brand relative flex items-end gap-3 px-5 pt-5 text-white">
              <div className="min-w-0 flex-1 pb-5">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">
                  <Smartphone size={12} /> {platform === 'ios' ? 'iPhone / iPad' : 'Android'}
                </p>
                <h2 id="pwa-guia-titulo" className="mt-2 text-xl font-bold leading-tight">{L(`Install ${PLATFORM_NAME} ABA on your phone`, `Instala ${PLATFORM_NAME} ABA en tu celular`)}</h2>
                <p className="mt-1 text-[13px] text-white/85">{L('3 steps, less than a minute.', '3 pasos, menos de un minuto.')}</p>
              </div>
              <img src="/aria/poses/celular.webp" alt="" className="h-auto w-24 shrink-0 drop-shadow-[0_10px_18px_rgba(0,30,90,0.35)]" />
              <button onClick={dismiss} aria-label={L('Close', 'Cerrar')} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><X size={15} /></button>
            </div>

            {/* Pasos */}
            <ol className="space-y-2.5 p-5">
              {pasos.map(({ Icon, t, d }, i) => (
                <motion.li key={t} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-bg/60 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-v-fill text-xs font-bold text-v-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-v-text">{t}</p>
                    <p className="text-xs leading-relaxed text-v-muted">{d}</p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><Icon size={18} /></span>
                </motion.li>
              ))}
            </ol>

            <div className="px-5 pb-5">
              <button onClick={dismiss} className="v-brand h-11 w-full rounded-full text-sm font-semibold">{L('Got it', 'Entendido')}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
