'use client'
import { useCentroBranding } from '@/components/CentroBrandingContext'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShoppingBag, Plus, Pencil, Trash2, Package, X, Save, Loader2, Upload, ImageIcon, CheckCircle, Clock,
  AlertTriangle, Phone, ChevronDown, XCircle, Search, BadgeCheck, TrendingUp, ShoppingCart, Boxes,
  Puzzle, ClipboardList, Gamepad2, BookOpen, Gift, FileDown, Star, Eye, EyeOff, MessageCircle, StickyNote,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useCurrency } from '@/components/CurrencyContext'
import { confirmar } from '@/components/ui/confirmar'

interface Product {
  id: string; nombre: string; descripcion: string; precio_soles: number
  stock: number; categoria: string; tipo: 'fisico' | 'digital'
  imagen_url: string | null; activo: boolean; destacado: boolean; created_at: string
}
interface OrderItem {
  id: string; product_nombre: string; product_imagen: string
  cantidad: number; precio_unitario: number; subtotal: number
}
interface Order {
  id: string; parent_name: string; parent_email: string; parent_phone: string
  total_soles: number; estado: string; notas: string; admin_notas: string
  created_at: string; store_order_items: OrderItem[]
}

// Un color e icono por estado del pedido (tokens Vanty)
const ESTADO_CFG: Record<string, { icon: any; pill: string; dot: string; tile: string }> = {
  pendiente:  { icon: Clock,       pill: 'bg-v-warning/15 text-v-warning', dot: 'bg-v-warning', tile: 'bg-v-warning/15 text-v-warning' },
  confirmado: { icon: CheckCircle, pill: 'bg-v-accent-soft text-v-accent', dot: 'bg-v-accent',  tile: 'bg-v-accent-soft text-v-accent' },
  listo:      { icon: Package,     pill: 'bg-v-accent-soft text-v-accent', dot: 'bg-v-accent',  tile: 'bg-v-accent-soft text-v-accent' },
  entregado:  { icon: BadgeCheck,  pill: 'bg-v-success/15 text-v-success', dot: 'bg-v-success', tile: 'bg-v-success/15 text-v-success' },
  cancelado:  { icon: XCircle,     pill: 'bg-v-danger/10 text-v-danger',   dot: 'bg-v-danger',  tile: 'bg-v-danger/10 text-v-danger' },
}
const CATEGORIAS = ['material', 'guia', 'juego', 'libro', 'otro']
const ESTADOS_FLUJO = ['pendiente', 'confirmado', 'listo', 'entregado', 'cancelado']
const CAT_ICON: Record<string, any> = { material: Puzzle, guia: ClipboardList, juego: Gamepad2, libro: BookOpen, otro: Gift }
const CAT_LABEL: Record<string, string> = { material: 'Material', guia: 'Guía', juego: 'Juego', libro: 'Libro', otro: 'Otro' }
const CAT_LABEL_EN: Record<string, string> = { material: 'Material', guia: 'Guide', juego: 'Game', libro: 'Book', otro: 'Other' }
// Etiqueta de categoría a mostrar (el valor guardado sigue siendo el canónico ES)
const catLabel = (cat: string, locale: string) => (locale === 'en' ? CAT_LABEL_EN : CAT_LABEL)[cat] || cat
const EMPTY_FORM = { nombre: '', descripcion: '', precio_soles: '', stock: '', categoria: 'material', tipo: 'fisico' as 'fisico' | 'digital', activo: true, destacado: false }
const inputCls = 'w-full rounded-v-sm border border-v-border bg-v-bg px-3.5 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none transition-shadow placeholder:text-v-subtle focus:border-v-accent focus:ring-4 focus:ring-v-accent-soft disabled:opacity-50'

function Toggle({ on }: { on: boolean }) {
  return (
    <span role="switch" aria-checked={on} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-v-accent' : 'bg-v-border'}`}>
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </span>
  )
}

function ProductModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const { symbol } = useCurrency()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<any>(product ? {
    nombre: product.nombre, descripcion: product.descripcion || '', precio_soles: String(product.precio_soles), stock: String(product.stock),
    categoria: product.categoria, tipo: product.tipo, activo: product.activo, destacado: product.destacado,
  } : EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imagen_url || null)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleImage = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error(t('auto.storeManagementView.soloImagenes')); return }
    if (file.size > 5 * 1024 * 1024) { toast.error(t('auto.storeManagementView.maximo5mb')); return }
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return product?.imagen_url || null
    try {
      const fd = new FormData()
      fd.append('file', imageFile); fd.append('folder', 'products'); fd.append('bucket', 'store-images')
      const res = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.url) { toast.error(data.error || L('Error uploading image', 'Error subiendo imagen')); return null }
      return data.url as string
    } catch (e: any) { toast.error(L('Error uploading image: ', 'Error subiendo imagen: ') + e.message); return null }
  }
  const handleSave = async () => {
    if (!form.nombre.trim()) { toast.error(t('auto.storeManagementView.elNombreEsObligatorio')); return }
    if (!form.precio_soles || Number(form.precio_soles) < 0) { toast.error(t('auto.storeManagementView.precioInvalido')); return }
    if (form.tipo === 'fisico' && (form.stock === '' || Number(form.stock) < 0)) { toast.error(L('Enter the available stock', 'Ingresá el stock disponible')); return }
    setSaving(true)
    try {
      const imagen_url = await uploadImage()
      const payload = {
        nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), precio_soles: Number(form.precio_soles),
        stock: form.tipo === 'digital' ? 9999 : Number(form.stock), categoria: form.categoria, tipo: form.tipo,
        activo: form.activo, destacado: form.destacado, imagen_url, updated_at: new Date().toISOString(),
      }
      if (product) {
        const { error } = await supabase.from('store_products').update(payload).eq('id', product.id)
        if (error) throw error; toast.success(t('auto.storeManagementView.productoActualizado'))
      } else {
        const { error } = await supabase.from('store_products').insert(payload)
        if (error) throw error; toast.success(t('auto.storeManagementView.productoCreado'))
      }
      onSaved()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <motion.div className="v-scope fixed inset-0 z-50 flex items-end justify-center bg-[#081426]/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 30, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-v-lg bg-v-elevated shadow-v-lg sm:rounded-v-lg">
        <div className="flex items-center gap-3 border-b border-v-border px-5 py-4">
          <span className="v-brand grid size-10 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><ShoppingBag size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight text-v-text">{product ? L('Edit product', 'Editar producto') : L('New product', 'Nuevo producto')}</p>
            <p className="text-xs text-v-subtle">{L('Families see it in the store of their portal', 'Las familias lo ven en la tienda de su portal')}</p>
          </div>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full text-v-subtle transition-colors hover:bg-v-fill hover:text-v-text"><X size={17} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            {/* Imagen */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('ui.product_image')}</label>
              <div role="button" tabIndex={0}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImage(f) }}
                onClick={() => fileRef.current?.click()}
                className={`group relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-v-sm border-2 border-dashed transition-colors ${dragOver ? 'border-v-accent bg-v-accent-soft' : 'border-v-border bg-v-bg hover:border-v-accent/50'}`}>
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="" className="absolute inset-0 size-full object-cover" />
                    <span className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-black/60 py-1.5 text-xs font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"><Upload size={13} /> {t('tienda.cambiarImagen')}</span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-3 text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-v-accent-soft text-v-accent"><ImageIcon size={22} /></span>
                    <p className="text-xs font-semibold text-v-text">{t('tienda.arrastraClic')}</p>
                    <p className="text-[11px] text-v-subtle">{t('tienda.jpgPng')}</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f) }} />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('tienda.nombre2')}</label>
                <input value={form.nombre} onChange={e => setForm((f: any) => ({ ...f, nombre: e.target.value }))} placeholder={t('tienda.phNombreProd')} className={`${inputCls} h-11`} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('common.descripcion')}</label>
                <textarea value={form.descripcion} onChange={e => setForm((f: any) => ({ ...f, descripcion: e.target.value }))} rows={4} placeholder={t('ui.describe_product')} className={`${inputCls} resize-none py-2.5 leading-relaxed`} />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('tienda.tipoProd')}</label>
            <div className="grid grid-cols-2 gap-2">
              {([['fisico', Package, L('Physical', 'Físico'), L('Picked up at the center', 'Se retira en el centro')], ['digital', FileDown, 'Digital', L('PDF or downloadable file', 'PDF o archivo descargable')]] as const).map(([val, Ic, lbl, desc]) => {
                const on = form.tipo === val
                return (
                  <button key={val} type="button" onClick={() => setForm((f: any) => ({ ...f, tipo: val }))}
                    className={`flex items-center gap-3 rounded-v-sm border p-3 text-left transition-all ${on ? 'border-v-accent bg-v-accent-soft ring-1 ring-v-accent' : 'border-v-border bg-v-bg hover:border-v-accent/40'}`}>
                    <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${on ? 'bg-v-accent text-white' : 'bg-v-fill text-v-muted'}`}><Ic size={17} /></span>
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${on ? 'text-v-accent' : 'text-v-text'}`}>{lbl}</span>
                      <span className="block text-xs text-v-subtle">{desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('tienda.precioSoles')}</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-v-subtle">{symbol}</span>
                <input type="number" inputMode="decimal" min="0" step="0.50" value={form.precio_soles} onChange={e => setForm((f: any) => ({ ...f, precio_soles: e.target.value }))} placeholder="0.00" className={`${inputCls} h-11 pl-10 font-semibold tabular-nums`} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-v-muted">{form.tipo === 'digital' ? L('Stock', 'Stock') : 'Stock *'}</label>
              <input type="number" min="0" value={form.tipo === 'digital' ? '' : form.stock} onChange={e => setForm((f: any) => ({ ...f, stock: e.target.value }))}
                disabled={form.tipo === 'digital'} placeholder={form.tipo === 'digital' ? L('Unlimited', 'Ilimitado') : '0'} className={`${inputCls} h-11 tabular-nums`} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-v-muted">{t('common.categoria')}</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map(cat => {
                const Ic = CAT_ICON[cat]; const on = form.categoria === cat
                return (
                  <button key={cat} type="button" onClick={() => setForm((f: any) => ({ ...f, categoria: cat }))}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${on ? 'border-v-accent bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-bg text-v-muted hover:text-v-text'}`}>
                    <Ic size={14} /> {catLabel(cat, locale)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="divide-y divide-v-border rounded-v-sm border border-v-border">
            {[
              { key: 'activo', Icon: Eye, label: L('Visible in store', 'Visible en la tienda'), desc: L('Families can see and order it', 'Las familias pueden verlo y pedirlo') },
              { key: 'destacado', Icon: Star, label: L('Featured', 'Destacado'), desc: L('Shown first in the store', 'Aparece primero en la tienda') },
            ].map(({ key, Icon, label, desc }) => (
              <button key={key} type="button" onClick={() => setForm((f: any) => ({ ...f, [key]: !f[key] }))} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <span className={`grid size-9 shrink-0 place-items-center rounded-[30%] ${form[key] ? 'bg-v-accent-soft text-v-accent' : 'bg-v-fill text-v-subtle'}`}><Icon size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-v-text">{label}</span>
                  <span className="block text-xs text-v-subtle">{desc}</span>
                </span>
                <Toggle on={!!form[key]} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-v-border px-5 py-4 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="h-11 rounded-full px-5 text-sm font-semibold text-v-muted transition-colors hover:bg-v-fill">{t('common.cancelar')}</button>
          <button onClick={handleSave} disabled={saving} className="v-brand inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? L('Saving…', 'Guardando…') : product ? L('Save changes', 'Guardar cambios') : L('Create product', 'Crear producto')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ProductCard({ p, index, onEdit, onToggle, onDelete }: { p: Product; index: number; onEdit: () => void; onToggle: () => void | Promise<void>; onDelete: () => void | Promise<void>; key?: any }) {
  const { t, locale } = useI18n()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const { fmt } = useCurrency()
  const [conf, setConf] = useState(false)
  const Ic = CAT_ICON[p.categoria] || Package
  const sinStock = p.tipo === 'fisico' && p.stock === 0
  const stockBajo = p.tipo === 'fisico' && p.stock > 0 && p.stock <= 3

  return (
    <motion.article layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 9) * 0.03 }}
      className={`group flex flex-col overflow-hidden rounded-v border border-v-border bg-v-elevated shadow-v transition-shadow hover:shadow-v-lg ${p.activo ? '' : 'opacity-70'}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-v-accent-soft to-v-fill">
        {p.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagen_url} alt={p.nombre} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[30%] bg-v-elevated text-v-accent shadow-v"><Ic size={28} /></span>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-v-elevated/95 px-2.5 py-1 text-[11px] font-semibold text-v-text shadow-v">
            {p.tipo === 'digital' ? <FileDown size={11} /> : <Package size={11} />} {p.tipo === 'digital' ? 'Digital' : L('Physical', 'Físico')}
          </span>
          {p.destacado && <span className="inline-flex items-center gap-1 rounded-full bg-v-warning px-2.5 py-1 text-[11px] font-semibold text-white shadow-v"><Star size={11} fill="currentColor" /> {L('Featured', 'Destacado')}</span>}
        </div>
        {!p.activo && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"><EyeOff size={11} /> {t('tienda.oculto')}</span>}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-v-subtle"><Ic size={12} /> {catLabel(p.categoria, locale)}</p>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-v-text">{p.nombre}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-v-muted">{p.descripcion || L('No description', 'Sin descripción')}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="v-headline text-xl tabular-nums text-v-text">{fmt(Number(p.precio_soles))}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.tipo === 'digital' ? 'bg-v-accent-soft text-v-accent' : sinStock ? 'bg-v-danger/10 text-v-danger' : stockBajo ? 'bg-v-warning/15 text-v-warning' : 'bg-v-success/15 text-v-success'}`}>
            {p.tipo === 'digital' ? L('Unlimited', 'Ilimitado') : sinStock ? L('Out of stock', 'Sin stock') : `${p.stock} ${L('in stock', 'en stock')}`}
          </span>
        </div>
        <div className="mt-auto flex items-center gap-1 border-t border-v-border pt-3" style={{ marginTop: '0.875rem' }}>
          <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded-full py-1 text-left text-xs font-semibold text-v-muted">
            <Toggle on={p.activo} /> <span className="truncate">{p.activo ? L('Visible', 'Visible') : L('Hidden', 'Oculto')}</span>
          </button>
          <button onClick={onEdit} title={t('common.editar')} className="grid size-8 place-items-center rounded-full text-v-muted transition-colors hover:bg-v-fill hover:text-v-text"><Pencil size={14} /></button>
          <button onClick={() => setConf(c => !c)} title={t('common.eliminar')} className={`grid size-8 place-items-center rounded-full transition-colors ${conf ? 'bg-v-danger/10 text-v-danger' : 'text-v-muted hover:bg-v-danger/10 hover:text-v-danger'}`}><Trash2 size={14} /></button>
        </div>
      </div>
      <AnimatePresence>
        {conf && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-t border-v-border bg-v-danger/10 px-4 py-2.5">
              <p className="min-w-0 flex-1 text-xs text-v-danger">{L('Delete this product?', '¿Eliminar este producto?')}</p>
              <button onClick={() => setConf(false)} className="h-8 rounded-full px-3 text-xs font-semibold text-v-muted hover:bg-v-fill">{t('common.cancelar')}</button>
              <button onClick={() => { setConf(false); onDelete() }} className="h-8 rounded-full bg-v-danger px-3.5 text-xs font-semibold text-white">{t('common.eliminar')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

export default function StoreManagementView() {
  const { name: centroNombre } = useCentroBranding()
  const toast = useToast(); const { locale, t } = useI18n()
  const { fmt } = useCurrency()
  const L = (en: string, es: string) => (locale === 'en' ? en : es)
  const [tab, setTab] = useState<'productos' | 'pedidos'>('productos')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterEstado, setFilterEstado] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('store_products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
  }, [])
  const loadOrders = useCallback(async () => {
    const { data } = await supabase.from('store_orders').select('*, store_order_items(*)').order('created_at', { ascending: false })
    setOrders(data || [])
  }, [])

  useEffect(() => {
    const load = async () => { setLoading(true); await Promise.all([loadProducts(), loadOrders()]); setLoading(false) }
    load()
  }, [loadProducts, loadOrders])

  const toggleActivo = async (p: Product) => {
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, activo: !x.activo } : x))
    const { error } = await supabase.from('store_products').update({ activo: !p.activo }).eq('id', p.id)
    if (error) { setProducts(prev => prev.map(x => x.id === p.id ? { ...x, activo: p.activo } : x)); toast.error('Error: ' + error.message); return }
    toast.success(p.activo ? L('Product hidden', 'Producto ocultado') : L('Product visible', 'Producto visible'))
  }
  const deleteProduct = async (p: Product) => {
    const { error } = await supabase.from('store_products').delete().eq('id', p.id)
    if (error) { toast.error('Error: ' + error.message); return }
    setProducts(prev => prev.filter(x => x.id !== p.id)); toast.success(t('auto.storeManagementView.productoEliminado'))
  }
  const updateOrderEstado = async (orderId: string, estado: string) => {
    setUpdatingOrder(orderId)
    const { error } = await supabase.from('store_orders').update({ estado, updated_at: new Date().toISOString() }).eq('id', orderId)
    setUpdatingOrder(null)
    if (error) { toast.error('Error: ' + error.message); return }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, estado } : o))
    toast.success(`${L('Order', 'Pedido')}: ${t('pedido.' + estado)}`)
  }
  const deleteOrder = async (order: Order) => {
    if (!await confirmar(L(`Delete ${order.parent_name || 'this'}'s order for ${fmt(Number(order.total_soles))}? This cannot be undone.`,
      `¿Eliminar el pedido de ${order.parent_name || 'esta familia'} por ${fmt(Number(order.total_soles))}? Esta acción no se puede deshacer.`))) return
    setUpdatingOrder(order.id)
    const { error: errItems } = await supabase.from('store_order_items').delete().eq('order_id', order.id)
    const { error } = errItems ? { error: errItems } : await supabase.from('store_orders').delete().eq('id', order.id)
    setUpdatingOrder(null)
    if (error) { toast.error('Error: ' + error.message); return }
    setOrders(prev => prev.filter(o => o.id !== order.id))
    if (expandedOrder === order.id) setExpandedOrder(null)
    toast.success(L('Order deleted', 'Pedido eliminado'))
  }
  const updateAdminNota = async (order: Order, nota: string) => {
    if ((order.admin_notas || '') === nota) return // sin cambios: no guardar
    const { error } = await supabase.from('store_orders').update({ admin_notas: nota }).eq('id', order.id)
    if (error) { toast.error('Error: ' + error.message); return }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, admin_notas: nota } : o))
    toast.success(L('Note saved', 'Nota guardada'))
  }

  const stats = {
    total: products.length, activos: products.filter(p => p.activo).length,
    stockBajo: products.filter(p => p.tipo === 'fisico' && p.stock <= 3 && p.activo).length,
    pendientes: orders.filter(o => o.estado === 'pendiente').length,
    // Entregados y cancelados ya están cerrados: no cuentan como pedidos por atender
    pedidosAbiertos: orders.filter(o => !['entregado', 'cancelado'].includes(o.estado)).length,
    ventas: orders.filter(o => o.estado !== 'cancelado').reduce((s, o) => s + Number(o.total_soles), 0),
  }
  const norm = (x: string) => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const filteredProducts = products.filter(p => norm(p.nombre).includes(norm(search)) && (filterTipo === 'todos' || p.tipo === filterTipo))
  const filteredOrders = orders.filter(o => filterEstado === 'todos' || o.estado === filterEstado)

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-3 py-32">
      <Loader2 size={26} className="animate-spin text-v-accent" />
      <p className="text-sm text-v-subtle">{t('tienda.cargandoTienda')}</p>
    </div>
  )

  return (
    <div className="v-scope space-y-4 md:space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="v-brand grid size-11 shrink-0 place-items-center rounded-[30%]" style={{ boxShadow: 'none' }}><ShoppingBag size={20} /></span>
        <div className="min-w-0 flex-[1_1_220px]">
          <h2 className="v-headline text-xl text-v-text">{t('tienda.gestionTienda')}</h2>
          <p className="text-xs text-v-subtle">{t('tienda.productosStockPedidos')}</p>
        </div>
        <button onClick={() => { setEditProduct(null); setShowModal(true) }} className="v-brand inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold sm:w-auto">
          <Plus size={16} /> {L('New product', 'Nuevo producto')}
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {[
          { label: L('Products', 'Productos'), value: stats.total, sub: `${stats.activos} ${L('visible', 'visibles')}`, Icon: Boxes, tone: 'bg-v-accent-soft text-v-accent' },
          { label: L('Low stock', 'Stock bajo'), value: stats.stockBajo, sub: L('3 units or less', '3 unidades o menos'), Icon: AlertTriangle, tone: stats.stockBajo ? 'bg-v-warning/15 text-v-warning' : 'bg-v-fill text-v-subtle' },
          { label: L('Pending orders', 'Pedidos pendientes'), value: stats.pendientes, sub: L('To attend', 'Por atender'), Icon: ShoppingCart, tone: stats.pendientes ? 'bg-v-danger/10 text-v-danger' : 'bg-v-fill text-v-subtle' },
          { label: L('Sales', 'Ventas'), value: fmt(stats.ventas), sub: L('Excluding cancelled', 'Sin contar cancelados'), Icon: TrendingUp, tone: 'bg-v-success/15 text-v-success' },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-v border border-v-border bg-v-elevated p-4 shadow-v">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-v-muted">{k.label}</p>
              <span className={`grid size-8 shrink-0 place-items-center rounded-[30%] ${k.tone}`}><k.Icon size={15} /></span>
            </div>
            <p className="v-headline truncate text-2xl tabular-nums text-v-text">{k.value}</p>
            <p className="truncate text-[11px] text-v-subtle">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Pestañas */}
      <div className="flex w-full gap-1 rounded-full bg-v-fill p-1 sm:w-fit">
        {[
          { id: 'productos', label: L('Products', 'Productos'), count: products.length, Icon: Boxes },
          { id: 'pedidos', label: L('Orders', 'Pedidos'), count: stats.pedidosAbiertos, Icon: ShoppingCart, badge: stats.pendientes },
        ].map(({ id, label, count, Icon, badge }) => {
          const on = tab === id
          return (
            <button key={id} onClick={() => setTab(id as 'productos' | 'pedidos')}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors sm:flex-none ${on ? 'text-v-accent' : 'text-v-muted hover:text-v-text'}`}>
              {on && <motion.span layoutId="tienda-tab" className="absolute inset-0 rounded-full bg-v-elevated shadow-v" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <Icon size={15} className="relative" /><span className="relative">{label}</span>
              <span className="relative tabular-nums opacity-60">{count}</span>
              {!!badge && <span className="relative grid min-w-5 place-items-center rounded-full bg-v-danger px-1.5 text-[10px] font-bold text-white">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* PRODUCTOS */}
      {tab === 'productos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-[1_1_240px]">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-v-subtle" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('ui.search_product')}
                className="h-10 w-full rounded-full border border-v-border bg-v-elevated pl-10 pr-4 text-sm sm:!text-sm [font-family:inherit] text-v-text outline-none placeholder:text-v-subtle focus:border-v-accent" />
            </div>
            <div className="flex gap-1.5">
              {([['todos', L('All', 'Todos'), Boxes], ['fisico', L('Physical', 'Físicos'), Package], ['digital', 'Digitales', FileDown]] as const).map(([f, lbl, Ic]) => (
                <button key={f} onClick={() => setFilterTipo(f)}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${filterTipo === f ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                  <Ic size={13} /> {f === 'digital' ? L('Digital', 'Digitales') : lbl}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated px-6 py-16 text-center">
              <span className="mb-3 grid size-14 place-items-center rounded-full bg-v-accent-soft text-v-accent"><ShoppingBag size={24} /></span>
              <p className="text-sm font-semibold text-v-text">{products.length ? L('No products match', 'Ningún producto coincide') : t('tienda.sinProductos')}</p>
              <p className="mt-1 text-xs text-v-subtle">{products.length ? L('Try another search.', 'Probá con otra búsqueda.') : t('tienda.creaPrimerArticulo')}</p>
              {!products.length && (
                <button onClick={() => { setEditProduct(null); setShowModal(true) }} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-v-accent-soft px-4 text-xs font-semibold text-v-accent hover:bg-v-accent hover:text-white">
                  <Plus size={14} /> {L('Create first product', 'Crear primer producto')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((p, i) => (
                <ProductCard key={p.id} p={p} index={i} onEdit={() => { setEditProduct(p); setShowModal(true) }} onToggle={() => toggleActivo(p)} onDelete={() => deleteProduct(p)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* PEDIDOS */}
      {tab === 'pedidos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {['todos', ...ESTADOS_FLUJO].map(e => {
              const cfg = ESTADO_CFG[e]; const count = e === 'todos' ? orders.length : orders.filter(o => o.estado === e).length; const on = filterEstado === e
              return (
                <button key={e} onClick={() => setFilterEstado(e)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${on ? 'border-v-accent/40 bg-v-accent-soft text-v-accent' : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                  {cfg && <span className={`size-2 rounded-full ${cfg.dot}`} />}
                  {e === 'todos' ? t('pedido.todos') : t('pedido.' + e)} <span className="tabular-nums opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center rounded-v border border-dashed border-v-border bg-v-elevated px-6 py-16 text-center">
              <span className="mb-3 grid size-14 place-items-center rounded-full bg-v-fill text-v-subtle"><ShoppingCart size={24} /></span>
              <p className="text-sm font-semibold text-v-text">{t('tienda.sinPedidos2')}</p>
              <p className="mt-1 text-xs text-v-subtle">{t('tienda.sinPedidos')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order, oi) => {
                const cfg = ESTADO_CFG[order.estado] || ESTADO_CFG.pendiente; const StatusIcon = cfg.icon; const open = expandedOrder === order.id
                const items = order.store_order_items || []
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(oi, 8) * 0.03 }}
                    className={`overflow-hidden rounded-v border bg-v-elevated shadow-v transition-colors ${open ? 'border-v-accent/30' : 'border-v-border'}`}>
                    <button onClick={() => setExpandedOrder(open ? null : order.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-v-bg sm:px-5">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-[30%] ${cfg.tile}`}><StatusIcon size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-v-text">{order.parent_name || L('Parent', 'Padre/Madre')}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.pill}`}>{t('pedido.' + order.estado)}</span>
                        </div>
                        <p className="truncate text-xs text-v-subtle">
                          {new Date(order.created_at).toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {items.length} {items.length === 1 ? L('item', 'artículo') : L('items', 'artículos')}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-bold tabular-nums text-v-text">{fmt(Number(order.total_soles))}</p>
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full transition-all ${open ? 'rotate-180 bg-v-accent-soft text-v-accent' : 'text-v-subtle'}`}><ChevronDown size={16} /></span>
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="space-y-4 border-t border-v-border bg-v-bg p-4 sm:p-5">
                            <div className="divide-y divide-v-border overflow-hidden rounded-v-sm border border-v-border bg-v-elevated">
                              {items.map(item => (
                                <div key={item.id} className="flex items-center gap-3 p-3">
                                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-v-sm bg-v-fill text-v-subtle">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    {item.product_imagen ? <img src={item.product_imagen} alt="" className="size-full object-cover" /> : <Package size={18} />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-v-text">{item.product_nombre}</p>
                                    <p className="text-xs text-v-subtle">{item.cantidad} × {fmt(Number(item.precio_unitario))}</p>
                                  </div>
                                  <p className="shrink-0 text-sm font-semibold tabular-nums text-v-text">{fmt(Number(item.subtotal) || Number(item.precio_unitario) * item.cantidad)}</p>
                                </div>
                              ))}
                              <div className="flex items-center justify-between bg-v-bg px-3 py-2.5">
                                <span className="text-xs font-semibold text-v-muted">Total</span>
                                <span className="text-sm font-bold tabular-nums text-v-text">{fmt(Number(order.total_soles))}</span>
                              </div>
                            </div>

                            {order.notas && (
                              <div className="flex items-start gap-2.5 rounded-v-sm bg-v-warning/10 px-3.5 py-3">
                                <MessageCircle size={15} className="mt-0.5 shrink-0 text-v-warning" />
                                <div className="min-w-0"><p className="text-[11px] font-semibold text-v-warning">{t('tienda.notaPadre')}</p><p className="text-sm text-v-text [overflow-wrap:anywhere]">{order.notas}</p></div>
                              </div>
                            )}

                            <div>
                              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-v-muted"><StickyNote size={13} /> {t('tienda.notaInterna')}</p>
                              <textarea defaultValue={order.admin_notas || ''} rows={2} placeholder={t('tienda.phNotaInterna')} onBlur={e => updateAdminNota(order, e.target.value)}
                                className={`${inputCls} resize-none bg-v-elevated py-2.5`} />
                            </div>

                            <div>
                              <p className="mb-1.5 text-xs font-semibold text-v-muted">{t('tienda.actualizarEstado')}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ESTADOS_FLUJO.map(e => {
                                  const c = ESTADO_CFG[e]; const act = order.estado === e
                                  return (
                                    <button key={e} onClick={() => updateOrderEstado(order.id, e)} disabled={act || updatingOrder === order.id}
                                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${act ? `border-transparent ${c.pill}` : 'border-v-border bg-v-elevated text-v-muted hover:text-v-text'}`}>
                                      {updatingOrder === order.id && !act ? <Loader2 size={12} className="animate-spin" /> : <span className={`size-2 rounded-full ${c.dot}`} />}
                                      {t('pedido.' + e)} {act && <CheckCircle size={12} />}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {order.parent_phone && (
                              <a href={`https://wa.me/51${order.parent_phone.replace(/\D/g, '')}?text=${encodeURIComponent(L(
                                `Hello! Your order is ${t('pedido.' + order.estado).toLowerCase()}. Total: ${fmt(Number(order.total_soles))} — ${centroNombre}`,
                                `¡Hola! Su pedido está ${t('pedido.' + order.estado).toLowerCase()}. Total: ${fmt(Number(order.total_soles))} — ${centroNombre}`))}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-semibold text-white transition-opacity hover:opacity-90">
                                <Phone size={15} /> {L('Contact via WhatsApp', 'Contactar por WhatsApp')} · {order.parent_phone}
                              </a>
                            )}

                            <div className="flex justify-end border-t border-v-border pt-3">
                              <button onClick={() => deleteOrder(order)} disabled={updatingOrder === order.id}
                                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-v-danger/30 px-4 text-xs font-semibold text-v-danger transition-colors hover:bg-v-danger/10 disabled:opacity-50">
                                {updatingOrder === order.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} {L('Delete order', 'Eliminar pedido')}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <ProductModal
            product={editProduct}
            onClose={() => { setShowModal(false); setEditProduct(null) }}
            onSaved={async () => { setShowModal(false); setEditProduct(null); await loadProducts() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
