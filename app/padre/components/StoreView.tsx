'use client'
// app/padre/components/StoreView.tsx
// Tienda del centro para la familia: catálogo, carrito y seguimiento de pedidos (pago coordinado con el centro).

import { useCentroBranding } from '@/components/CentroBrandingContext'
import { useI18n } from '@/lib/i18n-context'
import { useCurrency } from '@/components/CurrencyContext'
import { toBCP47 } from '@/lib/i18n'
import { useTraducir } from '@/lib/use-traducir'
import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingBag, ShoppingCart, Plus, Minus, X, Package, Star, CheckCircle2, Clock, XCircle, Loader2,
  Phone, Search, Image as ImageIcon, FileText, Download, Info, ArrowRight, Receipt,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  nombre: string
  descripcion: string
  precio_soles: number
  stock: number
  categoria: string
  tipo: 'fisico' | 'digital'
  imagen_url: string | null
  destacado: boolean
}
interface CartItem { product: Product; cantidad: number }
interface Order { id: string; total_soles: number; estado: string; notas: string; created_at: string; store_order_items: any[] }

const cardClass = 'rounded-v border border-v-border bg-v-elevated shadow-v'
type Tr = (t?: string) => string

const ESTADO: Record<string, { es: string; en: string; Icon: any; tone: string }> = {
  pendiente: { es: 'Pendiente de confirmación', en: 'Awaiting confirmation', Icon: Clock, tone: 'bg-v-warning/15 text-v-warning' },
  confirmado: { es: 'Confirmado', en: 'Confirmed', Icon: CheckCircle2, tone: 'bg-v-accent-soft text-v-accent' },
  listo: { es: 'Listo para recoger', en: 'Ready for pickup', Icon: Package, tone: 'bg-v-accent-soft text-v-accent' },
  entregado: { es: 'Entregado', en: 'Delivered', Icon: CheckCircle2, tone: 'bg-v-success/15 text-v-success' },
  cancelado: { es: 'Cancelado', en: 'Cancelled', Icon: XCircle, tone: 'bg-v-danger/10 text-v-danger' },
}

function useL() {
  const { locale } = useI18n()
  const en = locale === 'en'
  return { en, locale, L: (e: string, s: string) => (en ? e : s) }
}

function Foto({ src, alt, icon = 30 }: { src: string | null; alt: string; icon?: number }) {
  const [error, setError] = useState(false)
  return src && !error
    ? <img src={src} alt={alt} onError={() => setError(true)} className="absolute inset-0 w-full object-cover" style={{ height: '100%' }} />
    : <div className="absolute inset-0 grid place-items-center bg-v-fill text-v-subtle"><ImageIcon size={icon} /></div>
}

function TipoChip({ tipo }: { tipo: string }) {
  const { L } = useL()
  return tipo === 'digital'
    ? <span className="inline-flex items-center gap-1 rounded-full bg-v-accent px-2 py-0.5 text-[10px] font-semibold text-white"><FileText size={10} /> {L('Digital', 'Digital')}</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-[#081426]/75 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur"><Package size={10} /> {L('Physical', 'Físico')}</span>
}

// ── Carrito (panel lateral) ───────────────────────────────────────────────────
function CartDrawer({ cart, onClose, onUpdate, onCheckout, tr }: { cart: CartItem[]; onClose: () => void; onUpdate: (id: string, n: number) => void; onCheckout: (nota: string) => Promise<boolean>; tr: Tr }) {
  const CONTACTO = useCentroBranding()
  const { L } = useL()
  const { symbol } = useCurrency()
  const total = cart.reduce((s, i) => s + i.product.precio_soles * i.cantidad, 0)
  const [nota, setNota] = useState('')
  const [placing, setPlacing] = useState(false)
  const [done, setDone] = useState(false)

  const confirmar = async () => {
    setPlacing(true)
    if (await onCheckout(nota)) setDone(true)
    setPlacing(false)
  }

  return (
    <motion.div className="v-scope fixed inset-0 z-[150] flex justify-end bg-[#081426]/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="flex h-full w-full max-w-md flex-col border-l border-v-border bg-v-elevated shadow-v-lg">
        <div className="relative flex items-center gap-3 border-b border-v-border px-5 py-4">
          <div aria-hidden className="v-brand absolute inset-x-0 top-0 h-[3px]" />
          <span className="grid size-10 place-items-center rounded-[30%] bg-v-accent-soft text-v-accent"><ShoppingCart size={18} /></span>
          <p className="flex-1 text-base font-semibold text-v-text">{L('My cart', 'Mi carrito')}</p>
          <button onClick={onClose} aria-label={L('Close', 'Cerrar')} className="grid size-9 place-items-center rounded-full text-v-muted hover:bg-v-fill"><X size={17} /></button>
        </div>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="grid size-16 place-items-center rounded-full bg-v-success/15 text-v-success"><CheckCircle2 size={32} /></motion.span>
            <p className="mt-4 text-xl font-semibold text-v-text">{L('Order sent!', '¡Pedido enviado!')}</p>
            <p className="mt-1.5 max-w-xs text-sm text-v-muted">{L('The center will contact you to coordinate payment and delivery.', 'El centro te contactará para coordinar el pago y la entrega.')}</p>
            {CONTACTO.telefono && (
              <a href={`https://wa.me/${CONTACTO.telefonoDigitos}`} target="_blank" rel="noopener noreferrer"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white hover:brightness-95">
                <Phone size={15} /> {L('Coordinate on WhatsApp', 'Coordinar por WhatsApp')}
              </a>
            )}
          </div>
        ) : cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-v-fill text-v-subtle"><ShoppingCart size={24} /></span>
            <p className="mt-3 text-sm font-semibold text-v-text">{L('Your cart is empty', 'Tu carrito está vacío')}</p>
            <p className="mt-1 text-xs text-v-muted">{L('Add items from the catalog.', 'Agrega productos del catálogo.')}</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {cart.map(({ product: p, cantidad }) => (
                <div key={p.id} className="flex items-center gap-3 rounded-v-sm border border-v-border bg-v-bg p-2.5">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-v-sm"><Foto src={p.imagen_url} alt={p.nombre} icon={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-v-text">{tr(p.nombre)}</p>
                    <p className="mt-0.5 text-xs font-semibold tabular-nums text-v-accent">{symbol} {(p.precio_soles * cantidad).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-v-fill p-1">
                    <button onClick={() => onUpdate(p.id, cantidad - 1)} aria-label="-" className="grid size-7 place-items-center rounded-full bg-v-elevated text-v-muted shadow-v"><Minus size={12} /></button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-v-text">{cantidad}</span>
                    <button onClick={() => onUpdate(p.id, cantidad + 1)} disabled={p.tipo === 'fisico' && cantidad >= p.stock} aria-label="+" className="grid size-7 place-items-center rounded-full bg-v-elevated text-v-muted shadow-v disabled:opacity-30"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
              <div className="pt-1">
                <label className="mb-1.5 block text-xs font-semibold text-v-muted">{L('Note for the center (optional)', 'Nota para el centro (opcional)')}</label>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder={L('E.g. please hold it until Friday', 'Ej. guárdenlo hasta el viernes')}
                  className="w-full resize-none rounded-v-sm border border-v-border bg-v-bg px-4 py-3 text-sm text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft" />
              </div>
              <div className="flex gap-2.5 rounded-v-sm bg-v-accent-soft/60 p-3.5">
                <Info size={15} className="mt-0.5 shrink-0 text-v-accent" />
                <p className="text-xs leading-relaxed text-v-text">
                  <span className="font-semibold">{L('How do I pay? ', '¿Cómo pago? ')}</span>
                  {L('Payment is made at the center or by transfer. The team will confirm your order.', 'El pago se realiza en el centro o por transferencia. El equipo confirmará tu pedido.')}
                </p>
              </div>
            </div>
            <div className="space-y-3 border-t border-v-border p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-v-muted">{L('Total to pay', 'Total a pagar')}</span>
                <span className="text-2xl font-bold tabular-nums text-v-text">{symbol} {total.toFixed(2)}</span>
              </div>
              <button onClick={confirmar} disabled={placing} className="v-brand inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60">
                {placing ? <Loader2 size={17} className="animate-spin" /> : <ShoppingBag size={17} />}
                {placing ? L('Sending order…', 'Enviando pedido…') : L('Confirm order', 'Confirmar pedido')}
              </button>
              <p className="text-center text-[11px] text-v-subtle">{L('The center will receive your order and contact you.', 'El centro recibirá tu pedido y te contactará.')}</p>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Vista principal de la tienda ──────────────────────────────────────────────
export default function StoreView({ profile }: { profile: any }) {
  const CONTACTO = useCentroBranding()
  const { L, locale } = useL()
  const { symbol } = useCurrency()
  const [view, setView] = useState<'catalogo' | 'mis-pedidos'>('catalogo')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterCat, setFilterCat] = useState('todos')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('store_products').select('*').eq('activo', true)
      .order('destacado', { ascending: false }).order('created_at', { ascending: false })
    setProducts(data || [])
  }, [])

  const loadOrders = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase.from('store_orders').select('*, store_order_items(*)').eq('parent_id', profile.id).order('created_at', { ascending: false })
    setOrders(data || [])
  }, [profile?.id])

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([loadProducts(), loadOrders()]); setLoading(false) })()
  }, [loadProducts, loadOrders])

  const addToCart = (product: Product) => {
    setCart(prev => prev.find(i => i.product.id === product.id)
      ? prev.map(i => i.product.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      : [...prev, { product, cantidad: 1 }])
    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 1500)
  }

  const updateCart = (productId: string, cantidad: number) => {
    if (cantidad <= 0) setCart(prev => prev.filter(i => i.product.id !== productId))
    else setCart(prev => prev.map(i => i.product.id === productId ? { ...i, cantidad } : i))
  }

  const checkout = async (nota: string) => {
    if (!profile?.id) return false
    const total = cart.reduce((s, i) => s + i.product.precio_soles * i.cantidad, 0)
    try {
      const { data: order, error } = await supabase.from('store_orders').insert({
        parent_id: profile.id, parent_name: profile.full_name || '', parent_email: profile.email || '', parent_phone: profile.phone || '',
        total_soles: total, estado: 'pendiente', notas: nota,
      }).select().single()
      if (error) throw error
      await supabase.from('store_order_items').insert(cart.map(i => ({
        order_id: order.id, product_id: i.product.id, product_nombre: i.product.nombre, product_imagen: i.product.imagen_url || '',
        cantidad: i.cantidad, precio_unitario: i.product.precio_soles, subtotal: i.product.precio_soles * i.cantidad,
      })))
      // Reducir stock de productos físicos
      for (const item of cart) {
        if (item.product.tipo === 'fisico') await supabase.from('store_products').update({ stock: item.product.stock - item.cantidad }).eq('id', item.product.id)
      }
      setCart([])
      await Promise.all([loadOrders(), loadProducts()])
      return true
    } catch { return false }
  }

  const tr = useTraducir([
    ...products.flatMap(p => [p.nombre, p.descripcion, p.categoria]),
    ...orders.flatMap(o => (o.store_order_items || []).map((i: any) => i.product_nombre)),
  ])

  const categorias = ['todos', ...new Set(products.map(p => p.categoria).filter(Boolean))]
  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0)
  const q = search.toLowerCase()
  const filtered = products.filter(p =>
    (!q || [p.nombre, p.descripcion, tr(p.nombre), tr(p.descripcion)].some(x => x?.toLowerCase().includes(q))) &&
    (filterTipo === 'todos' || p.tipo === filterTipo) && (filterCat === 'todos' || p.categoria === filterCat))
  const sinFiltros = !search && filterTipo === 'todos' && filterCat === 'todos'
  const destacados = sinFiltros ? filtered.filter(p => p.destacado) : []
  const resto = sinFiltros ? filtered.filter(p => !p.destacado) : filtered

  if (loading) return <div className="grid place-items-center py-24"><Loader2 size={26} className="animate-spin text-v-accent" /></div>

  const chip = (on: boolean) => `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${on ? 'bg-v-accent text-white' : 'border border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`
  const vistas = [
    { id: 'catalogo' as const, label: L('Catalog', 'Catálogo'), Icon: ShoppingBag, n: products.length },
    { id: 'mis-pedidos' as const, label: L('My orders', 'Mis pedidos'), Icon: Receipt, n: orders.filter(o => !['entregado', 'cancelado'].includes(o.estado)).length },
  ]

  return (
    <div className="v-scope space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 gap-1 rounded-full bg-v-fill p-1">
          {vistas.map(({ id, label, Icon, n }) => (
            <button key={id} onClick={() => setView(id)} className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${view === id ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {view === id && <motion.span layoutId="tienda-padre-vista" transition={{ type: 'spring', stiffness: 400, damping: 32 }} className="absolute inset-0 rounded-full bg-v-elevated shadow-v" />}
              <Icon size={13} className="relative" /><span className="relative">{label}</span>
              {n > 0 && <span className="relative rounded-full bg-v-accent-soft px-1.5 text-[10px] tabular-nums text-v-accent">{n}</span>}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCart(true)} aria-label={L('Cart', 'Carrito')} className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm sm:px-4 font-semibold transition-colors ${cartCount ? 'v-brand' : 'border border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
          <ShoppingCart size={16} /> <span className="hidden sm:inline">{L('Cart', 'Carrito')}</span>
          {cartCount > 0 && <motion.span key={cartCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold tabular-nums text-v-accent">{cartCount}</motion.span>}
        </button>
      </div>

      {view === 'catalogo' ? (
        <>
          <div className="space-y-2.5">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-v-subtle" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={L('Search products…', 'Buscar productos…')}
                className="h-11 w-full rounded-full border border-v-border bg-v-elevated pl-11 pr-4 text-sm text-v-text shadow-v outline-none placeholder:text-v-subtle focus:border-v-accent/50 focus:ring-4 focus:ring-v-accent-soft" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {[['todos', L('All', 'Todo')], ['fisico', L('Physical', 'Físicos')], ['digital', L('Digital', 'Digitales')]].map(([f, label]) => (
                <button key={f} onClick={() => setFilterTipo(f)} className={chip(filterTipo === f)}>{label}</button>
              ))}
              {categorias.length > 2 && <>
                <span className="mx-1 w-px shrink-0 self-stretch bg-v-border" />
                {categorias.map(c => <button key={c} onClick={() => setFilterCat(c)} className={chip(filterCat === c)}>{c === 'todos' ? L('All categories', 'Todas las categorías') : tr(c)}</button>)}
              </>}
            </div>
          </div>

          {destacados.length > 0 && (
            <section>
              <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-v-text"><span className="grid size-6 place-items-center rounded-full bg-v-warning/15 text-v-warning"><Star size={12} /></span>{L('Featured', 'Destacados')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {destacados.map((p, i) => <ProductCard key={p.id} i={i} product={p} tr={tr} onAdd={addToCart} onDetail={setSelectedProduct} justAdded={addedId === p.id} inCart={cart.find(c => c.product.id === p.id)?.cantidad || 0} featured />)}
              </div>
            </section>
          )}

          {resto.length > 0 ? (
            <section>
              {destacados.length > 0 && <p className="mb-2.5 text-sm font-semibold text-v-text">{L('All products', 'Todos los productos')}</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {resto.map((p, i) => <ProductCard key={p.id} i={i} product={p} tr={tr} onAdd={addToCart} onDetail={setSelectedProduct} justAdded={addedId === p.id} inCart={cart.find(c => c.product.id === p.id)?.cantidad || 0} />)}
              </div>
            </section>
          ) : filtered.length === 0 && (
            <div className={`${cardClass} px-6 py-12 text-center`}>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><ShoppingBag size={20} /></span>
              <p className="mt-3 text-sm font-semibold text-v-text">{products.length ? L('No products match', 'Ningún producto coincide') : L('The store is empty for now', 'La tienda está vacía por ahora')}</p>
              {products.length > 0 && <button onClick={() => { setSearch(''); setFilterTipo('todos'); setFilterCat('todos') }} className="mt-2 text-xs font-semibold text-v-accent hover:underline">{L('Clear filters', 'Limpiar filtros')}</button>}
            </div>
          )}

          <div className="flex gap-3 rounded-v border border-v-border bg-v-accent-soft/50 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-v-elevated text-v-accent shadow-v"><Info size={16} /></span>
            <div className="text-xs leading-relaxed text-v-text">
              <p className="mb-0.5 text-sm font-semibold">{L('How does the store work?', '¿Cómo funciona la tienda?')}</p>
              {L('Physical items are picked up at the center once your order is confirmed. Digital items are sent to you by WhatsApp after payment.', 'Los productos físicos se recogen en el centro cuando tu pedido esté confirmado. Los digitales te los enviamos por WhatsApp tras confirmar el pago.')}
              {CONTACTO.telefono && <> {L('Questions? Write to us at', '¿Dudas? Escríbenos al')} <a href={`https://wa.me/${CONTACTO.telefonoDigitos}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-v-accent underline">{CONTACTO.telefono}</a>.</>}
            </div>
          </div>
        </>
      ) : orders.length === 0 ? (
        <div className={`${cardClass} px-6 py-12 text-center`}>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-v-fill text-v-subtle"><Receipt size={20} /></span>
          <p className="mt-3 text-sm font-semibold text-v-text">{L('No orders yet', 'Aún no tienes pedidos')}</p>
          <p className="mt-1 text-xs text-v-muted">{L('Explore the catalog and place your first order.', 'Explora el catálogo y haz tu primer pedido.')}</p>
          <button onClick={() => setView('catalogo')} className="v-brand mt-4 inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold">{L('Go to the store', 'Ir a la tienda')} <ArrowRight size={15} /></button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {orders.map((order, i) => {
            const e = ESTADO[order.estado] || ESTADO.pendiente
            return (
              <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }} className={`${cardClass} overflow-hidden`}>
                <div className="flex items-center justify-between gap-2 border-b border-v-border px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${e.tone}`}><e.Icon size={12} /> {locale === 'en' ? e.en : e.es}</span>
                  <span className="text-xs text-v-subtle">{new Date(order.created_at).toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="space-y-2.5 p-4">
                  {(order.store_order_items || []).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-v-sm"><Foto src={item.product_imagen || null} alt="" icon={16} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-v-text">{tr(item.product_nombre)}</p>
                        <p className="text-xs tabular-nums text-v-subtle">x{item.cantidad} · {symbol} {Number(item.precio_unitario).toFixed(2)} {L('each', 'c/u')}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-v-text">{symbol} {Number(item.subtotal ?? item.precio_unitario * item.cantidad).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between border-t border-v-border pt-3">
                    <span className="text-sm text-v-muted">{L('Total', 'Total')}</span>
                    <span className="text-lg font-bold tabular-nums text-v-accent">{symbol} {Number(order.total_soles).toFixed(2)}</span>
                  </div>
                  {order.notas && <p className="rounded-v-sm bg-v-fill px-3 py-2 text-xs text-v-muted">{L('Your note: ', 'Tu nota: ')}{order.notas}</p>}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showCart && <CartDrawer cart={cart} tr={tr} onClose={() => setShowCart(false)} onUpdate={updateCart} onCheckout={checkout} />}
        {selectedProduct && <ProductDetail product={selectedProduct} tr={tr} onClose={() => setSelectedProduct(null)} onAdd={addToCart} inCart={cart.find(i => i.product.id === selectedProduct.id)?.cantidad || 0} justAdded={addedId === selectedProduct.id} />}
      </AnimatePresence>
    </div>
  )
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────
function ProductCard({ product: p, onAdd, onDetail, justAdded, inCart, featured, tr, i }: { product: Product; onAdd: (p: Product) => void; onDetail: (p: Product) => void; justAdded: boolean; inCart: number; featured?: boolean; tr: Tr; i: number }) {
  const { L } = useL()
  const { symbol } = useCurrency()
  const sinStock = p.tipo === 'fisico' && p.stock <= 0
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}
      className={`${cardClass} group flex overflow-hidden transition-all sm:flex-col hover:-translate-y-0.5 hover:shadow-v-lg ${featured ? 'ring-1 ring-v-warning/40' : ''}`}>
      <button onClick={() => onDetail(p)} className="relative min-h-32 w-32 shrink-0 overflow-hidden text-left sm:aspect-[4/3] sm:min-h-0 sm:w-full">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"><Foto src={p.imagen_url} alt={p.nombre} /></div>
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          <TipoChip tipo={p.tipo} />
          {featured && <span className="hidden size-5 sm:grid place-items-center rounded-full bg-v-warning text-white"><Star size={10} /></span>}
        </div>
        {sinStock && <div className="absolute inset-0 grid place-items-center bg-black/45"><span className="rounded-full bg-v-danger px-3 py-1 text-xs font-semibold text-white">{L('Sold out', 'Agotado')}</span></div>}
        {p.tipo === 'fisico' && p.stock > 0 && p.stock <= 3 && <span className="absolute bottom-2 right-2 rounded-full bg-v-warning px-2 py-0.5 text-[10px] font-semibold text-white">{L(`Only ${p.stock} left`, `Solo ${p.stock}`)}</span>}
      </button>
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <button onClick={() => onDetail(p)} className="text-left">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-v-text">{tr(p.nombre)}</p>
          {p.descripcion && <p className="mt-0.5 line-clamp-2 text-xs text-v-muted">{tr(p.descripcion)}</p>}
        </button>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="text-base font-bold tabular-nums text-v-text">{symbol} {Number(p.precio_soles).toFixed(2)}</span>
          <button onClick={() => !sinStock && onAdd(p)} disabled={sinStock}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:bg-v-fill disabled:text-v-subtle ${justAdded ? 'bg-v-success text-white' : 'v-brand'}`}>
            {justAdded ? <><CheckCircle2 size={13} /> {L('Added', 'Agregado')}</> : <><Plus size={13} /> {inCart ? `${L('Add', 'Agregar')} (${inCart})` : L('Add', 'Agregar')}</>}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Detalle de producto ───────────────────────────────────────────────────────
function ProductDetail({ product: p, onClose, onAdd, inCart, justAdded, tr }: { product: Product; onClose: () => void; onAdd: (p: Product) => void; inCart: number; justAdded: boolean; tr: Tr }) {
  const { L } = useL()
  const { symbol } = useCurrency()
  const sinStock = p.tipo === 'fisico' && p.stock <= 0
  return (
    <motion.div className="v-scope fixed inset-0 z-[150] flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-v-lg border border-v-border bg-v-elevated shadow-v-lg sm:rounded-v-lg">
        <div className="relative aspect-[16/10] shrink-0">
          <Foto src={p.imagen_url} alt={p.nombre} icon={36} />
          <button onClick={onClose} aria-label={L('Close', 'Cerrar')} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/55"><X size={17} /></button>
          <div className="absolute left-3 top-3"><TipoChip tipo={p.tipo} /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="flex-1 text-lg font-semibold leading-snug text-v-text">{tr(p.nombre)}</p>
            <span className="shrink-0 text-xl font-bold tabular-nums text-v-accent">{symbol} {Number(p.precio_soles).toFixed(2)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.categoria && <span className="rounded-full bg-v-fill px-2.5 py-0.5 text-[11px] font-semibold capitalize text-v-muted">{tr(p.categoria)}</span>}
            {p.tipo === 'fisico'
              ? <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p.stock > 3 ? 'bg-v-success/15 text-v-success' : p.stock > 0 ? 'bg-v-warning/15 text-v-warning' : 'bg-v-danger/10 text-v-danger'}`}>{p.stock > 0 ? L(`${p.stock} available`, `${p.stock} disponibles`) : L('Out of stock', 'Sin stock')}</span>
              : <span className="inline-flex items-center gap-1 rounded-full bg-v-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-v-accent"><Download size={10} /> {L('Sent after payment', 'Se envía tras el pago')}</span>}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-v-muted">{p.descripcion ? tr(p.descripcion) : L('No description available.', 'Sin descripción disponible.')}</p>
          {p.tipo === 'digital' && (
            <div className="mt-4 flex gap-2.5 rounded-v-sm bg-v-accent-soft/60 p-3.5">
              <FileText size={15} className="mt-0.5 shrink-0 text-v-accent" />
              <p className="text-xs leading-relaxed text-v-text"><span className="font-semibold">{L('Digital item. ', 'Artículo digital. ')}</span>{L('Once your order is confirmed, the center will send you the file by WhatsApp.', 'Al confirmar tu pedido, el centro te enviará el archivo por WhatsApp.')}</p>
            </div>
          )}
        </div>
        <div className="border-t border-v-border p-4">
          <button onClick={() => !sinStock && onAdd(p)} disabled={sinStock}
            className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:bg-v-fill disabled:text-v-subtle ${justAdded ? 'bg-v-success text-white' : 'v-brand'}`}>
            {justAdded ? <><CheckCircle2 size={17} /> {L('Added to cart', 'Agregado al carrito')}</> : sinStock ? L('Out of stock', 'Sin stock')
              : <><ShoppingCart size={17} /> {inCart ? `${L('Add another', 'Agregar otro')} (${inCart})` : L('Add to cart', 'Agregar al carrito')}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
