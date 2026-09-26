import 'server-only'
import crypto from 'node:crypto'

// Cliente mínimo de Lemon Squeezy (Merchant of Record: cobra y declara impuestos por nosotros).
// Variables en .env.local:
//   LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_WEBHOOK_SECRET
// Las variantes (plan × ciclo y el paquete de tokens) se configuran desde /control.

const API = 'https://api.lemonsqueezy.com/v1'

export function lemonConfigurado() {
  return !!(process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID)
}

async function lemon<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) {
    const detalle = (json as { errors?: { detail?: string }[] })?.errors?.[0]?.detail ?? `HTTP ${r.status}`
    throw new Error(`Lemon Squeezy: ${detalle}`)
  }
  return json as T
}

/**
 * Crea un checkout y devuelve su URL.
 * `centavos`: precio en la moneda de la tienda (USD), en centavos. En suscripciones se mantiene en cada renovación.
 * `custom`: datos que Lemon devuelve en los webhooks (meta.custom_data) para saber qué se pagó.
 */
export async function crearCheckout(opts: {
  variantId: string
  centavos: number | null
  email?: string | null
  nombre?: string | null
  custom: Record<string, string>
  redirectUrl: string
  descripcion?: string
  locale?: 'es' | 'en'
}): Promise<string> {
  const res = await lemon<{ data: { attributes: { url: string } } }>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          // Sin centavos se cobra el precio base de la variante (lo que Lemon muestra en el checkout)
          ...(opts.centavos != null ? { custom_price: Math.max(50, Math.round(opts.centavos)) } : {}),
          product_options: {
            redirect_url: opts.redirectUrl,
            enabled_variants: [Number(opts.variantId)],
            ...(opts.descripcion ? { description: opts.descripcion } : {}),
            // Botón de vuelta a Vanty en el recibo por correo (la imagen de ARIA se sube en el producto, en Lemon → Media)
            receipt_button_text: opts.locale === 'en' ? 'Go to Vanty ABA' : 'Ir a Vanty ABA',
            receipt_link_url: opts.redirectUrl,
            receipt_thank_you_note: opts.locale === 'en'
              ? 'Thank you for trusting Vanty ABA. ARIA and your whole team are ready to keep your center and every family connected.'
              : 'Gracias por confiar en Vanty ABA. ARIA y todo tu equipo están listos para mantener conectados a tu centro y a cada familia.',
          },
          checkout_options: { button_color: '#0071e3', embed: false, media: true, logo: true, ...(opts.locale ? { locale: opts.locale } : {}) },
          checkout_data: {
            ...(opts.email ? { email: opts.email } : {}),
            ...(opts.nombre ? { name: opts.nombre } : {}),
            custom: opts.custom,
          },
          expires_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
        },
        relationships: {
          store: { data: { type: 'stores', id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: 'variants', id: String(opts.variantId) } },
        },
      },
    }),
  })
  return res.data.attributes.url
}

/** Enlace al portal del cliente de una suscripción (cambiar tarjeta, ver facturas, cancelar). */
export async function portalSuscripcion(subscriptionId: string): Promise<string | null> {
  const res = await lemon<{ data: { attributes: { urls?: { customer_portal?: string } } } }>(`/subscriptions/${subscriptionId}`)
  return res.data.attributes.urls?.customer_portal ?? null
}

/** Verifica la firma HMAC-SHA256 (cabecera X-Signature) del cuerpo crudo del webhook. */
export function firmaValida(cuerpo: string, firma: string | null): boolean {
  const secreto = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secreto || !firma) return false
  const esperado = Buffer.from(crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex'), 'utf8')
  const recibido = Buffer.from(firma, 'utf8')
  return esperado.length === recibido.length && crypto.timingSafeEqual(esperado, recibido)
}

export const hashCuerpo = (cuerpo: string) => crypto.createHash('sha256').update(cuerpo).digest('hex')

/** Suscripciones de la tienda para un correo (la más reciente primero). Respaldo cuando el webhook no llega. */
export async function suscripcionesPorEmail(email: string): Promise<{ id: string; attributes: Record<string, unknown> }[]> {
  const q = `/subscriptions?filter[store_id]=${process.env.LEMONSQUEEZY_STORE_ID}&filter[user_email]=${encodeURIComponent(email)}&page[size]=10`
  const res = await lemon<{ data: { id: string; attributes: Record<string, unknown> }[] }>(q)
  return (res.data ?? []).sort((x, y) => String(y.attributes.created_at ?? '').localeCompare(String(x.attributes.created_at ?? '')))
}
