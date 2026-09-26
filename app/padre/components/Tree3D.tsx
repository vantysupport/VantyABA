'use client'
// app/padre/components/Tree3D.tsx
// Árboles 3D (three.js / react-three-fiber) para el "Modo Bosque". Estilo "cozy" low-poly,
// todo procedural (sin archivos de modelos):
//  • Cuatro especies con personalidad: pino por niveles, manzano con ramas y frutos,
//    cerezo en flor con pétalos que caen y roble frondoso.
//  • Crecimiento por etapas (semilla → brote → arbolito → árbol) con un "pop" elástico
//    y una lluvia de destellos en cada cambio; al terminar, explosión dorada.
//  • Islita de pasto con flores y piedras que gira despacio; polen flotando.
//  • SingleTree3D → la vista "Plantar". Forest3D → "Mi bosque", todos los árboles juntos.
//  • Se cargan con next/dynamic ssr:false desde ForestTimer (nunca en el servidor).

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, useGLTF } from '@react-three/drei'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// Las escenas son solo para mirar: sin gestor de eventos del puntero. Así r3f no se engancha
// al contenedor (evita "addEventListener of null" si la vista se desmonta rápido) y ahorra trabajo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SIN_EVENTOS = (() => ({ enabled: false, priority: 0 })) as any

export type Species3D = 'pino' | 'manzano' | 'cerezo' | 'roble'
type V3 = [number, number, number]

// Pseudoaleatorio estable (misma forma en cada render)
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

const PALETA: Record<Species3D, { hojas: string[]; tronco: string }> = {
  pino:    { hojas: ['#1f5e3a', '#2a7446', '#358a52', '#46a060'], tronco: '#6b4a2f' },
  manzano: { hojas: ['#3f8f37', '#56a843', '#6cc24a', '#83d160'], tronco: '#7a5230' },
  cerezo:  { hojas: ['#f472b6', '#f9a8d4', '#fbcfe8', '#ec4899'], tronco: '#6f4a3a' },
  roble:   { hojas: ['#4d7d33', '#628f3d', '#7cab46', '#93bd55'], tronco: '#5e3f27' },
}

// ── Piezas ───────────────────────────────────────────────────────────────────
function Mat({ color, flat = true, rough = 0.9, emissive }: { color: string; flat?: boolean; rough?: number; emissive?: string }) {
  return <meshStandardMaterial color={color} roughness={rough} flatShading={flat} emissive={emissive || '#000000'} emissiveIntensity={emissive ? 0.6 : 0} />
}

function Trunk({ color, h, r, ramas = [] }: { color: string; h: number; r: number; ramas?: [number, number, number][] }) {
  // ramas: [altura, ángulo alrededor del tronco, inclinación]
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[r * 0.68, r * 1.12, h, 9]} />
        <Mat color={color} />
      </mesh>
      {/* raíces que se hunden en el pasto */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} position={[Math.cos(i * 1.26) * r * 1.05, 0.05, Math.sin(i * 1.26) * r * 1.05]} rotation={[Math.sin(i * 1.26) * 0.9, 0, -Math.cos(i * 1.26) * 0.9]} castShadow>
          <coneGeometry args={[r * 0.45, r * 1.6, 5]} />
          <Mat color={color} />
        </mesh>
      ))}
      {ramas.map(([y, a, inc], i) => (
        <group key={i} position={[0, y, 0]} rotation={[0, a, 0]}>
          <mesh position={[0.22, 0.16, 0]} rotation={[0, 0, -inc]} castShadow>
            <cylinderGeometry args={[r * 0.28, r * 0.42, 0.55, 6]} />
            <Mat color={color} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Manzana({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <mesh castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#e0342b" roughness={0.25} metalness={0.05} />
      </mesh>
      <mesh position={[-0.05, 0.06, 0.1]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.55} roughness={0} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.09, 5]} />
        <Mat color="#5a3b2c" />
      </mesh>
      <mesh position={[0.07, 0.18, 0]} rotation={[0, 0, -0.8]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <Mat color="#4f9a45" />
      </mesh>
    </group>
  )
}

// ── Árboles realistas generados por código ─────────────────────────────────
// Ramas que se dividen y afinan (instancias de cilindros con corteza) + miles de "tarjetas"
// de hojas, flores o agujas dibujadas en un canvas (instancias con transparencia), cada una
// con un tono un poco distinto. Todo se genera una vez por especie/etapa y se reutiliza.

type Seg = { a: THREE.Vector3; b: THREE.Vector3; r: number }
type Tarjeta = { p: THREE.Vector3; q: THREE.Quaternion; s: [number, number]; color: THREE.Color }
type Nucleo = { p: THREE.Vector3; r: number; color: THREE.Color; sy?: number }
type Modelo = { segs: Seg[]; tarjetas: Tarjeta[]; nucleos: Nucleo[]; frutos: THREE.Vector3[]; textura: 'hoja' | 'flor' | 'aguja'; corteza: string }

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Texturas dibujadas en canvas (en escala de grises para teñirlas por instancia)
const texturas: Record<string, THREE.Texture> = {}
function textura(tipo: 'hoja' | 'flor' | 'aguja' | 'corteza'): THREE.Texture {
  if (texturas[tipo]) return texturas[tipo]
  const c = document.createElement('canvas')
  const n = tipo === 'corteza' ? 128 : 256
  c.width = n; c.height = tipo === 'corteza' ? 256 : n
  const x = c.getContext('2d')!
  const rng = mulberry32(tipo.length * 97)
  if (tipo === 'hoja') {
    // ramillete de hojas con nervadura
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 + rng() * 0.4, d = 22 + rng() * 62
      x.save(); x.translate(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); x.rotate(a + Math.PI / 2 + (rng() - 0.5) * 0.6)
      const L = 46 + rng() * 22, W = 17 + rng() * 7
      const g = x.createLinearGradient(-W, 0, W, 0); g.addColorStop(0, '#d8d8d8'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#bdbdbd')
      x.fillStyle = g
      x.beginPath(); x.moveTo(0, -L); x.bezierCurveTo(W, -L * 0.5, W, L * 0.45, 0, L); x.bezierCurveTo(-W, L * 0.45, -W, -L * 0.5, 0, -L); x.fill()
      x.strokeStyle = 'rgba(90,90,90,.55)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, -L * 0.9); x.lineTo(0, L); x.stroke()
      x.lineWidth = 0.8
      for (let k = -3; k <= 3; k++) { if (!k) continue; x.beginPath(); x.moveTo(0, k * L * 0.2); x.lineTo(Math.sign(k) * W * 0.7, k * L * 0.2 - L * 0.12); x.stroke() }
      x.restore()
    }
  } else if (tipo === 'flor') {
    // flores de 5 pétalos (cerezo en flor)
    for (let i = 0; i < 34; i++) {
      const cx = 22 + rng() * 212, cy = 22 + rng() * 212, R = 12 + rng() * 10
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + i
        x.save(); x.translate(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55); x.rotate(a)
        const g = x.createRadialGradient(0, 0, 1, 0, 0, R * 0.7); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ececec')
        x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, R * 0.62, R * 0.45, 0, 0, Math.PI * 2); x.fill()
        x.restore()
      }
      x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(cx, cy, R * 0.22, 0, Math.PI * 2); x.fill()
      x.fillStyle = 'rgba(120,80,80,.5)'
      for (let k = 0; k < 5; k++) { const a = k * 1.3; x.beginPath(); x.arc(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28, 1.2, 0, Math.PI * 2); x.fill() }
    }
  } else if (tipo === 'aguja') {
    // ramita de pino: silueta rellena (se ve de lejos) + agujas dibujadas encima
    const g = x.createLinearGradient(0, 60, 0, 196); g.addColorStop(0, '#e8e8e8'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#bfbfbf')
    x.fillStyle = g
    x.beginPath(); x.moveTo(6, 128)
    for (let t = 0; t <= 1; t += 0.05) x.lineTo(6 + t * 244, 128 - Math.sin(Math.PI * Math.pow(t, 0.8)) * (62 - t * 22) - (rng() - 0.5) * 8)
    for (let t = 1; t >= 0; t -= 0.05) x.lineTo(6 + t * 244, 128 + Math.sin(Math.PI * Math.pow(t, 0.8)) * (62 - t * 22) + (rng() - 0.5) * 8)
    x.closePath(); x.fill()
    for (let i = 0; i < 110; i++) {
      const t = 10 + (i / 110) * 232, lado = i % 2 ? 1 : -1, L = 26 + rng() * 26 - (t / 256) * 12
      x.strokeStyle = rng() > 0.5 ? 'rgba(255,255,255,.9)' : 'rgba(120,120,120,.55)'; x.lineWidth = 2.4
      x.beginPath(); x.moveTo(t, 128); x.lineTo(t + 14 + rng() * 10, 128 + lado * L); x.stroke()
    }
    x.strokeStyle = 'rgba(90,70,60,.8)'; x.lineWidth = 3; x.beginPath(); x.moveTo(6, 128); x.lineTo(240, 128); x.stroke()
  } else {
    // corteza: vetas verticales
    x.fillStyle = '#b5b5b5'; x.fillRect(0, 0, 128, 256)
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = rng() > 0.5 ? 'rgba(60,60,60,.35)' : 'rgba(255,255,255,.25)'
      x.lineWidth = 1 + rng() * 3
      const px = rng() * 128
      x.beginPath(); x.moveTo(px, 0)
      for (let y = 0; y <= 256; y += 32) x.lineTo(px + (rng() - 0.5) * 10, y)
      x.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (tipo === 'corteza') { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1) }
  texturas[tipo] = t
  return t
}

type Cfg = { tronco: number; radio: number; hijos: number[]; ratio: number; ang: number; sube: number; cae: number; porPunta: number; nube: number; tam: number; colores: string[]; nucleo: string; corteza: string; textura: 'hoja' | 'flor'; semilla: number; frutos: number }
const CFG: Record<Exclude<Species3D, 'pino'>, Cfg> = {
  manzano: { tronco: 1.05, radio: 0.15, hijos: [4, 3, 3], ratio: 0.62, ang: 0.8, sube: 0.35, cae: 0.06, porPunta: 12, nube: 0.36, tam: 0.46, colores: ['#3f8f37', '#56a843', '#6cc24a', '#4a9a3c', '#7bc55a'], nucleo: '#3d7f33', corteza: '#6b4a33', textura: 'hoja', semilla: 11, frutos: 10 },
  cerezo:  { tronco: 1.05, radio: 0.15, hijos: [4, 3, 3], ratio: 0.64, ang: 0.8, sube: 0.3, cae: 0.05, porPunta: 14, nube: 0.4, tam: 0.5, colores: ['#f9a8d4', '#f7b2d6', '#fbcfe8', '#f472b6', '#fde4f1', '#f8bcdc'], nucleo: '#e27fb3', corteza: '#4a3228', textura: 'flor', semilla: 23, frutos: 0 },
  roble:   { tronco: 1.15, radio: 0.22, hijos: [5, 3, 3], ratio: 0.64, ang: 0.85, sube: 0.24, cae: 0.07, porPunta: 13, nube: 0.42, tam: 0.52, colores: ['#4d7d33', '#628f3d', '#7cab46', '#56853a', '#8aba58'], nucleo: '#44702d', corteza: '#5a4030', textura: 'hoja', semilla: 37, frutos: 0 },
}

const UP = new THREE.Vector3(0, 1, 0)

function generarFrondoso(cfg: Cfg, profundidad: number, densidad: number): Modelo {
  const rng = mulberry32(cfg.semilla * 131 + profundidad)
  const segs: Seg[] = []
  const puntas: { p: THREE.Vector3; d: THREE.Vector3 }[] = []
  const rama = (ini: THREE.Vector3, dir: THREE.Vector3, largo: number, radio: number, nivel: number) => {
    const pasos = 3
    let p = ini.clone()
    const d = dir.clone()
    const puntos: THREE.Vector3[] = []
    for (let s = 0; s < pasos; s++) {
      d.add(new THREE.Vector3((rng() - 0.5) * 0.35, (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.35))
        .addScaledVector(UP, cfg.sube * 0.25).add(new THREE.Vector3(0, -cfg.cae * nivel * 0.6, 0)).normalize()
      const q = p.clone().addScaledVector(d, largo / pasos)
      segs.push({ a: p, b: q, r: radio * (1 - s * 0.14) })
      puntos.push(q); p = q
    }
    if (nivel >= profundidad) { puntas.push({ p, d: d.clone() }); return }
    if (nivel >= 1) puntas.push({ p, d: d.clone() })
    const n = cfg.hijos[nivel] ?? 2
    const base = rng() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const t = nivel === 0 ? 0.45 + 0.55 * (i / Math.max(1, n - 1)) : 0.3 + 0.7 * rng()
      const origen = puntos[Math.min(pasos - 1, Math.floor(t * pasos))]
      const ref = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP
      const perp = new THREE.Vector3().crossVectors(d, ref).normalize().applyAxisAngle(d, base + i * 2.399)
      const ang = cfg.ang * (0.8 + rng() * 0.4)
      const dh = d.clone().multiplyScalar(Math.cos(ang)).addScaledVector(perp, Math.sin(ang)).normalize()
      const largoHijo = (nivel === 0 ? cfg.tronco * 0.95 : largo * cfg.ratio) * (0.85 + rng() * 0.3)
      rama(origen, dh, largoHijo, radio * 0.6, nivel + 1)
    }
  }
  rama(new THREE.Vector3(0, 0, 0), UP.clone(), cfg.tronco, cfg.radio, 0)

  const tarjetas: Tarjeta[] = []
  const nucleos: Nucleo[] = []
  const frutos: THREE.Vector3[] = []
  const e = new THREE.Euler()
  const porPunta = Math.max(2, Math.round(cfg.porPunta * densidad))
  puntas.forEach((pt, k) => {
    for (let i = 0; i < porPunta; i++) {
      const off = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(cfg.nube * Math.cbrt(rng()))
      const p = pt.p.clone().add(off).addScaledVector(pt.d, cfg.nube * 0.35)
      e.set(rng() * Math.PI, rng() * Math.PI * 2, rng() * Math.PI)
      const s = cfg.tam * (0.75 + rng() * 0.5)
      tarjetas.push({ p, q: new THREE.Quaternion().setFromEuler(e), s: [s, s], color: new THREE.Color(cfg.colores[Math.floor(rng() * cfg.colores.length)]).multiplyScalar(0.85 + rng() * 0.3) })
    }
    // volumen interior: de lejos la copa se ve tupida y sin huecos oscuros
    nucleos.push({ p: pt.p.clone().addScaledVector(pt.d, cfg.nube * 0.2), r: cfg.nube * (0.62 + rng() * 0.2), color: new THREE.Color(cfg.nucleo).multiplyScalar(0.9 + rng() * 0.2) })
    if (cfg.frutos && k % 3 === 0 && frutos.length < cfg.frutos) frutos.push(pt.p.clone().add(new THREE.Vector3((rng() - 0.5) * 0.3, -0.12, (rng() - 0.5) * 0.3)))
  })
  return { segs, tarjetas, nucleos, frutos, textura: cfg.textura, corteza: cfg.corteza }
}

function generarPino(profundidad: number, densidad: number): Modelo {
  const rng = mulberry32(777 + profundidad)
  const segs: Seg[] = []
  const tarjetas: Tarjeta[] = []
  const frutos: THREE.Vector3[] = []
  const H = profundidad >= 3 ? 3.2 : 1.9
  const colores = ['#1f5e3a', '#2a7446', '#316f45', '#3a8a52', '#255f3c']
  // tronco recto que se afina
  const pasos = 6
  for (let s = 0; s < pasos; s++) segs.push({ a: new THREE.Vector3(0, (s / pasos) * H, 0), b: new THREE.Vector3(0, ((s + 1) / pasos) * H, 0), r: 0.17 * (1 - s / pasos * 0.8) })
  const W = profundidad >= 3 ? 11 : 6
  for (let w = 0; w < W; w++) {
    const f = w / W
    const h = 0.5 + f * (H - 0.75)
    const largo = (1 - f) * 1.25 + 0.22
    const n = 6 + (w % 2)
    for (let i = 0; i < n; i++) {
      const a = w * 0.9 + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.3
      const dir = new THREE.Vector3(Math.cos(a), 0.12 - 0.1 * (1 - f), Math.sin(a)).normalize()
      const ini = new THREE.Vector3(0, h, 0)
      const mid = ini.clone().addScaledVector(dir, largo * 0.55)
      const fin = mid.clone().addScaledVector(new THREE.Vector3(dir.x, dir.y - 0.35, dir.z).normalize(), largo * 0.45)
      segs.push({ a: ini, b: mid, r: 0.035 * (1 - f * 0.5) }, { a: mid, b: fin, r: 0.022 })
      // ramitas con agujas a lo largo de la rama, casi horizontales
      const cards = Math.max(3, Math.round((4 + largo * 4) * densidad))
      for (let k = 0; k < cards; k++) {
        const t = 0.25 + (k / cards) * 0.8
        const p = t < 0.55 ? ini.clone().lerp(mid, t / 0.55) : mid.clone().lerp(fin, (t - 0.55) / 0.45)
        p.add(new THREE.Vector3((rng() - 0.5) * 0.12, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.12))
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + (rng() - 0.5) * 0.5, 0, 0))
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, -a + (rng() - 0.5) * 0.9))
        const s = 0.55 + largo * 0.3 * rng()
        tarjetas.push({ p, q, s: [s, s * 0.6], color: new THREE.Color(colores[Math.floor(rng() * colores.length)]).multiplyScalar(0.85 + rng() * 0.3) })
      }
      if (profundidad >= 3 && w > 2 && w < W - 2 && i % 3 === 0 && rng() > 0.5) frutos.push(fin.clone().add(new THREE.Vector3(0, -0.08, 0)))
    }
  }
  // punta
  for (let k = 0; k < Math.round(8 * densidad); k++) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 0.6, rng() * 6.28, Math.PI / 2 + (rng() - 0.5) * 0.4))
    tarjetas.push({ p: new THREE.Vector3((rng() - 0.5) * 0.1, H - 0.1 - rng() * 0.35, (rng() - 0.5) * 0.1), q, s: [0.4, 0.26], color: new THREE.Color(colores[3]) })
  }
  // volumen interior por nivel (discos achatados), así el pino se ve lleno y no "esqueleto"
  const nucleos: Nucleo[] = []
  for (let w = 0; w < W; w++) {
    const f = w / W
    nucleos.push({ p: new THREE.Vector3(0, 0.45 + f * (H - 0.75), 0), r: ((1 - f) * 1.25 + 0.22) * 0.62, sy: 0.32, color: new THREE.Color(colores[w % 2 ? 0 : 1]).multiplyScalar(0.9) })
  }
  return { segs, tarjetas, nucleos, frutos, textura: 'aguja', corteza: '#5b3f2a' }
}

const cacheModelos = new Map<string, Modelo>()
function modeloDe(species: Species3D, profundidad: number, densidad: number): Modelo {
  const k = `${species}-${profundidad}-${densidad}`
  let m = cacheModelos.get(k)
  if (!m) { m = species === 'pino' ? generarPino(profundidad, densidad) : generarFrondoso(CFG[species], profundidad, densidad); cacheModelos.set(k, m) }
  return m
}

const GEO_RAMA = new THREE.CylinderGeometry(0.72, 1, 1, 7, 1).translate(0, 0.5, 0)
const GEO_TARJETA = new THREE.PlaneGeometry(1, 1)
const GEO_NUCLEO = new THREE.IcosahedronGeometry(1, 1)

function ArbolRealista({ species, etapa, fruto, densidad = 1 }: { species: Species3D; etapa: 2 | 3; fruto: boolean; densidad?: number }) {
  const m = useMemo(() => modeloDe(species, etapa === 3 ? 3 : 2, densidad), [species, etapa, densidad])
  const ramas = useRef<THREE.InstancedMesh>(null)
  const hojas = useRef<THREE.InstancedMesh>(null)
  const nucleos = useRef<THREE.InstancedMesh>(null)
  const matNucleo = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 1 }), [])
  const matCorteza = useMemo(() => new THREE.MeshStandardMaterial({ color: m.corteza, map: textura('corteza'), roughness: 1 }), [m])
  const matHojas = useMemo(() => new THREE.MeshStandardMaterial({ map: textura(m.textura), alphaTest: m.textura === 'aguja' ? 0.35 : 0.45, side: THREE.DoubleSide, roughness: 0.85 }), [m])

  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const dir = new THREE.Vector3()
    if (ramas.current) {
      m.segs.forEach((s, i) => {
        dir.subVectors(s.b, s.a)
        const len = dir.length()
        o.position.copy(s.a)
        o.quaternion.setFromUnitVectors(UP, dir.normalize())
        o.scale.set(s.r, len * 1.04, s.r)
        o.updateMatrix()
        ramas.current!.setMatrixAt(i, o.matrix)
      })
      ramas.current.instanceMatrix.needsUpdate = true
    }
    if (hojas.current) {
      m.tarjetas.forEach((t, i) => {
        o.position.copy(t.p); o.quaternion.copy(t.q); o.scale.set(t.s[0], t.s[1], 1); o.updateMatrix()
        hojas.current!.setMatrixAt(i, o.matrix)
        hojas.current!.setColorAt(i, t.color)
      })
      hojas.current.instanceMatrix.needsUpdate = true
      if (hojas.current.instanceColor) hojas.current.instanceColor.needsUpdate = true
    }
    if (nucleos.current && m.nucleos.length) {
      o.quaternion.identity()
      m.nucleos.forEach((n, i) => {
        o.position.copy(n.p); o.scale.set(n.r, n.r * (n.sy ?? 1), n.r); o.updateMatrix()
        nucleos.current!.setMatrixAt(i, o.matrix)
        nucleos.current!.setColorAt(i, n.color)
      })
      nucleos.current.instanceMatrix.needsUpdate = true
      if (nucleos.current.instanceColor) nucleos.current.instanceColor.needsUpdate = true
    }
  }, [m])

  const escala = etapa === 2 ? (species === 'pino' ? 0.75 : 0.62) : 1
  return (
    <group scale={escala}>
      <instancedMesh ref={ramas} args={[GEO_RAMA, matCorteza, m.segs.length]} castShadow receiveShadow />
      {m.nucleos.length > 0 && <instancedMesh ref={nucleos} args={[GEO_NUCLEO, matNucleo, m.nucleos.length]} castShadow />}
      <instancedMesh ref={hojas} args={[GEO_TARJETA, matHojas, m.tarjetas.length]} />
      {etapa === 3 && species === 'manzano' && m.frutos.slice(0, fruto ? 10 : 6).map((p, i) => <Manzana key={i} p={[p.x, p.y, p.z]} />)}
      {etapa === 3 && species === 'pino' && fruto && m.frutos.slice(0, 8).map((p, i) => (
        <mesh key={i} position={p} scale={[1, 1.5, 1]} castShadow>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#7a5230" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}


// ── Modelos realistas (Poly Haven, CC0), comprimidos para la web ─────────────
// cerezo = Jacaranda con el follaje convertido a rosado (en el propio archivo) · manzano = árbol frondoso con manzanas agregadas
// roble = Island Tree 02 · pino = Fir Sapling. Mientras cargan se ve el árbol generado.
const URL_MODELO: Record<Species3D, string> = {
  pino: '/modelos/arboles/pino.glb',
  manzano: '/modelos/arboles/manzano.glb',
  cerezo: '/modelos/arboles/cerezo.glb',
  roble: '/modelos/arboles/roble.glb',
}
const MEDIDA: Record<Species3D, { alto: number; ancho: number }> = {
  pino: { alto: 3.6, ancho: 3.2 },
  manzano: { alto: 3.0, ancho: 3.8 },
  cerezo: { alto: 3.0, ancho: 4.2 },
  roble: { alto: 3.2, ancho: 4.0 },
}

function ModeloReal({ species, fruto }: { species: Species3D; fruto: boolean }) {
  const { scene } = useGLTF(URL_MODELO[species], false, true)
  const { obj, manzanas } = useMemo(() => {
    const c = scene.clone(true)
    const box = new THREE.Box3().setFromObject(c)
    const size = box.getSize(new THREE.Vector3())
    const m = MEDIDA[species]
    const esc = Math.min(m.alto / size.y, m.ancho / Math.max(size.x, size.z))
    c.scale.setScalar(esc)
    c.updateMatrixWorld(true)
    box.setFromObject(c)
    // Centrar por la base del tronco (no por la copa, que puede ser asimétrica)
    const centro = box.getCenter(new THREE.Vector3())
    const limite = box.min.y + (box.max.y - box.min.y) * 0.06
    const base = new THREE.Vector3(); let nBase = 0
    const tmp = new THREE.Vector3()
    c.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || /leaves|twig/i.test((mesh.material as THREE.Material).name)) return
      const pos = mesh.geometry.getAttribute('position')
      const paso = Math.max(1, Math.floor(pos.count / 4000))
      for (let i = 0; i < pos.count; i += paso) {
        tmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
        if (tmp.y <= limite) { base.add(tmp); nBase++ }
      }
    })
    if (nBase > 0) { base.divideScalar(nBase); centro.x = base.x; centro.z = base.z }
    c.position.set(c.position.x - centro.x, c.position.y - box.min.y, c.position.z - centro.z)
    c.updateMatrixWorld(true)
    const manzanas: THREE.Vector3[] = []
    c.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
      const hojas = /leaves|twig/i.test(mat.name)
      // Hojas recortadas: alphaToCoverage suaviza los bordes (con antialias) y evita que las hojitas
      // finas desaparezcan de lejos.
      if (hojas) { mat.alphaTest = 0.35; mat.alphaToCoverage = true; mat.side = THREE.DoubleSide; if (mat.map) mat.map.anisotropy = 8 }
      mesh.material = mat
      // manzanas: sobre puntos al azar del follaje
      if (hojas && species === 'manzano') {
        const pos = mesh.geometry.getAttribute('position')
        const r = mulberry32(99)
        const v = new THREE.Vector3()
        for (let i = 0; i < 60; i++) {
          v.fromBufferAttribute(pos, Math.floor(r() * pos.count)).applyMatrix4(mesh.matrixWorld)
          if (v.y > m.alto * 0.35) manzanas.push(v.clone())
        }
      }
    })
    return { obj: c, manzanas }
  }, [scene, species])
  return (
    <group>
      <primitive object={obj} />
      {manzanas.slice(0, fruto ? 42 : 30).map((p, i) => (
        <group key={i} position={p} scale={0.36}><Manzana p={[0, 0, 0]} /></group>
      ))}
    </group>
  )
}

function ArbolFinal({ species, etapa, fruto, densidad }: { species: Species3D; etapa: 2 | 3; fruto: boolean; densidad: number }) {
  const escala = etapa === 2 ? 0.55 : 1
  return (
    <Suspense fallback={<ArbolRealista species={species} etapa={etapa} fruto={fruto} densidad={densidad} />}>
      <group scale={escala}><ModeloReal species={species} fruto={fruto && etapa === 3} /></group>
    </Suspense>
  )
}

function Marchito() {
  const gris = '#8f7f6d'
  return (
    <group>
      <mesh position={[0, 0.65, 0]} rotation={[0, 0, 0.08]} castShadow>
        <cylinderGeometry args={[0.07, 0.15, 1.3, 7]} />
        <Mat color={gris} />
      </mesh>
      {[[0.22, 1.05, 0, -0.9, 0.55], [-0.2, 0.9, 0.08, 1.0, 0.48], [0.05, 1.3, -0.12, -0.3, 0.4]].map(([x, y, z, rz, l], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, rz]} castShadow>
          <cylinderGeometry args={[0.025, 0.05, l, 5]} />
          <Mat color={gris} />
        </mesh>
      ))}
      {/* hojas secas en el suelo */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i * 1.1) * (0.4 + rnd(i) * 0.4), 0.03, Math.sin(i * 1.1) * (0.4 + rnd(i) * 0.4)]} rotation={[-Math.PI / 2, 0, i]} scale={[1, 0.6, 1]}>
          <circleGeometry args={[0.08, 5]} />
          <Mat color={i % 2 ? '#b7793c' : '#c9954d'} />
        </mesh>
      ))}
    </group>
  )
}

// ── Etapas tempranas ─────────────────────────────────────────────────────────
function Semilla() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} scale={[1, 0.72, 1]} castShadow>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshStandardMaterial color="#8a5a33" roughness={0.6} />
      </mesh>
      <mesh position={[0.04, 0.27, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.05, 0.16, 6]} />
        <Mat color="#7ccf5a" />
      </mesh>
    </group>
  )
}

function Brote() {
  return (
    <group>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.045, 0.64, 6]} />
        <Mat color="#4d9b46" />
      </mesh>
      {[[-0.17, 0.5, 0, 0.75, '#7ccf5a'], [0.17, 0.6, 0, -0.75, '#5fb34a'], [0, 0.7, 0.12, 0, '#8bdc68']].map(([x, y, z, rz, col], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} rotation={[i === 2 ? 0.7 : 0, 0, rz as number]} scale={[1, 0.5, 1]} castShadow>
          <sphereGeometry args={[i === 2 ? 0.11 : 0.17, 8, 8]} />
          <Mat color={col as string} />
        </mesh>
      ))}
    </group>
  )
}

// ── Transición entre etapas: "pop" elástico al aparecer ────────────────────
function Pop({ children, activo = true }: { children: React.ReactNode; activo?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const st = useRef({ s: activo ? 0 : 1, v: 0 })
  useFrame((_, dt) => {
    if (!g.current) return
    const k = 170, d = 13 // resorte con rebote
    const a = (1 - st.current.s) * k - st.current.v * d
    st.current.v += a * Math.min(dt, 0.033)
    st.current.s += st.current.v * Math.min(dt, 0.033)
    const s = Math.max(0.001, st.current.s)
    g.current.scale.set(s, s, s)
  })
  return <group ref={g}>{children}</group>
}

// Destellos que saltan desde la base (en cada cambio de etapa) y lluvia dorada al terminar
function Destellos({ disparo, dorado = false, cantidad = 18 }: { disparo: number; dorado?: boolean; cantidad?: number }) {
  const g = useRef<THREE.Group>(null)
  const t0 = useRef(-1)
  const ultimo = useRef(disparo)
  const datos = useMemo(() => Array.from({ length: cantidad }, (_, i) => ({
    a: rnd(i * 3.1) * Math.PI * 2, v: 1.4 + rnd(i * 5.7) * 1.6, up: 2.2 + rnd(i * 2.3) * 2.2, s: 0.05 + rnd(i * 9.1) * 0.06,
  })), [cantidad])
  useFrame(state => {
    if (!g.current) return
    if (disparo !== ultimo.current) { ultimo.current = disparo; t0.current = state.clock.elapsedTime }
    const t = t0.current < 0 ? 99 : state.clock.elapsedTime - t0.current
    const vivo = t < 1.6
    g.current.visible = vivo
    if (!vivo) return
    g.current.children.forEach((m, i) => {
      const d = datos[i]
      m.position.set(Math.cos(d.a) * d.v * t, 0.4 + d.up * t - 2.4 * t * t, Math.sin(d.a) * d.v * t)
      const s = d.s * (1 - t / 1.6)
      m.scale.setScalar(Math.max(0.001, s / 0.08))
      m.rotation.set(t * 4 + i, t * 3, 0)
    })
  })
  return (
    <group ref={g} visible={false}>
      {datos.map((_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial color={dorado ? (i % 3 ? '#fde047' : '#fbbf24') : (i % 2 ? '#bbf7d0' : '#fef9c3')} emissive={dorado ? '#f59e0b' : '#86efac'} emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// Pétalos (cerezo) u hojitas que caen suavemente alrededor del árbol
function Caida({ color, cantidad = 14, alto = 3 }: { color: string[]; cantidad?: number; alto?: number }) {
  const g = useRef<THREE.Group>(null)
  const datos = useMemo(() => Array.from({ length: cantidad }, (_, i) => ({
    x: (rnd(i * 4.3) - 0.5) * 2.6, z: (rnd(i * 6.1) - 0.5) * 2.6, off: rnd(i * 8.7) * 10, vel: 0.25 + rnd(i * 1.9) * 0.25,
  })), [cantidad])
  useFrame(state => {
    if (!g.current) return
    const t = state.clock.elapsedTime
    g.current.children.forEach((m, i) => {
      const d = datos[i]
      const y = alto - ((t * d.vel + d.off) % alto)
      m.position.set(d.x + Math.sin(t * 1.3 + d.off) * 0.25, y, d.z + Math.cos(t * 1.1 + d.off) * 0.2)
      m.rotation.set(t * 1.7 + d.off, t * 1.2, t * 0.9)
    })
  })
  return (
    <group ref={g}>
      {datos.map((_, i) => (
        <mesh key={i} scale={[1, 0.25, 0.7]}>
          <sphereGeometry args={[0.055, 6, 4]} />
          <Mat color={color[i % color.length]} />
        </mesh>
      ))}
    </group>
  )
}

// Polen / luciérnagas flotando
function Polen({ cantidad = 12, radio = 2.2 }: { cantidad?: number; radio?: number }) {
  const g = useRef<THREE.Group>(null)
  const datos = useMemo(() => Array.from({ length: cantidad }, (_, i) => ({ a: rnd(i) * 6.28, r: 0.8 + rnd(i * 3) * radio, y: 0.6 + rnd(i * 5) * 2.4, o: rnd(i * 7) * 6 })), [cantidad, radio])
  useFrame(state => {
    if (!g.current) return
    const t = state.clock.elapsedTime
    g.current.children.forEach((m, i) => {
      const d = datos[i]
      m.position.set(Math.cos(d.a + t * 0.15) * d.r, d.y + Math.sin(t * 0.8 + d.o) * 0.18, Math.sin(d.a + t * 0.15) * d.r)
      const s = 0.6 + Math.sin(t * 2 + d.o) * 0.4
      m.scale.setScalar(s)
    })
  })
  return (
    <group ref={g}>
      {datos.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.028, 6, 6]} />
          <meshBasicMaterial color="#fffbd1" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  )
}

// ── Árbol completo: etapa + balanceo ─────────────────────────────────────────
function etapaDe(grow: number) { return grow < 0.1 ? 0 : grow < 0.32 ? 1 : grow < 0.62 ? 2 : 3 }

function Tree({ species, grow = 1, fruit = false, withered = false, swayPhase = 0, animate = true, efectos = false, densidad = 1 }: {
  species: Species3D; grow?: number; fruit?: boolean; withered?: boolean; swayPhase?: number; animate?: boolean; efectos?: boolean; densidad?: number
}) {
  const g = useRef<THREE.Group>(null)
  const etapa = etapaDe(grow)
  // dentro de la etapa "árbol" termina de crecer suave 0.84 → 1
  const escalaAdulto = etapa === 3 ? 0.84 + 0.16 * Math.min(1, (grow - 0.62) / 0.38) : 1
  const sRef = useRef(escalaAdulto)
  useFrame((state, dt) => {
    if (!g.current) return
    sRef.current += (escalaAdulto - sRef.current) * Math.min(1, dt * 2.5)
    g.current.scale.setScalar(sRef.current)
    if (animate && !withered) {
      const t = state.clock.elapsedTime
      g.current.rotation.z = Math.sin(t * 1.1 + swayPhase) * 0.022
      g.current.rotation.x = Math.sin(t * 0.8 + swayPhase * 1.7) * 0.012
    }
  })
  const clave = `${species}-${withered ? 'x' : etapa}`
  return (
    <group>
      <group ref={g}>
        <Pop key={clave} activo={animate}>
          {withered ? <Marchito />
            : etapa === 0 ? <Semilla />
            : etapa === 1 ? <Brote />
            : <ArbolFinal species={species} etapa={etapa === 2 ? 2 : 3} fruto={fruit} densidad={densidad} />}
        </Pop>
      </group>
      {efectos && <Destellos disparo={etapa} />}
      {efectos && <Destellos disparo={fruit ? 1 : 0} dorado cantidad={30} />}
      {efectos && species === 'cerezo' && etapa === 3 && !withered && <Caida color={['#fbcfe8', '#f9a8d4', '#fff1f7']} />}
    </group>
  )
}

function Luces() {
  return (
    <>
      <hemisphereLight args={['#fff8e7', '#5f8f63', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 8, 5]} intensity={1.35} color="#fff4dc" castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <directionalLight position={[-5, 3, -4]} intensity={0.45} color="#c7e6ff" />
    </>
  )
}

// ── Islita de pasto (vista "Plantar") ───────────────────────────────────────
function Isla() {
  const flores = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + rnd(i) * 0.5, r = 1.1 + rnd(i * 3) * 0.55
    return { p: [Math.cos(a) * r, 0.02, Math.sin(a) * r] as V3, c: ['#f472b6', '#fde047', '#ffffff', '#a78bfa', '#fb923c'][i % 5] }
  }), [])
  const pasto = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const a = rnd(i * 11) * Math.PI * 2, r = 0.55 + rnd(i * 13) * 1.15
    return { p: [Math.cos(a) * r, 0, Math.sin(a) * r] as V3, h: 0.14 + rnd(i * 17) * 0.14, rot: rnd(i) * 3 }
  }), [])
  return (
    <group>
      {/* tierra (se ve el corte de la isla) */}
      <mesh position={[0, -0.34, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.95, 1.55, 0.6, 14]} />
        <Mat color="#8a5a3b" />
      </mesh>
      <mesh position={[0, -0.75, 0]} castShadow>
        <coneGeometry args={[1.5, 0.7, 12]} />
        <Mat color="#6f4630" />
      </mesh>
      {/* pasto */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[2.02, 1.96, 0.1, 18]} />
        <Mat color="#7cc76a" />
      </mesh>
      {/* tierra removida donde se planta */}
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.42, 14]} />
        <Mat color="#7a4f33" />
      </mesh>
      {pasto.map((b, i) => (
        <mesh key={i} position={[b.p[0], b.h / 2 + 0.02, b.p[2]]} rotation={[0, b.rot, 0]} castShadow>
          <coneGeometry args={[0.04, b.h, 4]} />
          <Mat color={i % 2 ? '#5fb34a' : '#8bdc68'} />
        </mesh>
      ))}
      {flores.map((f, i) => (
        <group key={i} position={f.p}>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.18, 4]} />
            <Mat color="#4d9b46" />
          </mesh>
          <mesh position={[0, 0.19, 0]}>
            <octahedronGeometry args={[0.055, 0]} />
            <Mat color={f.c} />
          </mesh>
        </group>
      ))}
      {([[1.3, 0.05, -0.9, 0.16], [-1.45, 0.04, 0.6, 0.12], [0.7, 0.04, 1.4, 0.1]] as [number, number, number, number][]).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} scale={[1, 0.6, 1]} castShadow>
          <dodecahedronGeometry args={[r, 0]} />
          <Mat color="#b8b2a7" />
        </mesh>
      ))}
    </group>
  )
}

// Gira la escena despacio (efecto "mesa giratoria") y flota un poquito
function Giratorio({ children, activo = true, vel = 0.18 }: { children: React.ReactNode; activo?: boolean; vel?: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame((state, dt) => {
    if (!g.current || !activo) return
    g.current.rotation.y += dt * vel
    g.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.05
  })
  return <group ref={g} rotation={[0, -0.5, 0]}>{children}</group>
}

export function SingleTree3D({ species, grow = 1, done = false, withered = false, animate = true }: {
  species: Species3D; grow?: number; done?: boolean; withered?: boolean; animate?: boolean
}) {
  return (
    <Canvas dpr={[1, 2]} shadows frameloop={animate ? 'always' : 'demand'}
      camera={{ position: [3.2, 3.0, 7.6], fov: 32 }}
      gl={{ antialias: true, alpha: true }}
      events={SIN_EVENTOS}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ camera, gl }) => { camera.lookAt(0, 1.45, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05 }}>
      <Luces />
      <Giratorio activo={animate}>
        <Isla />
        <Tree species={species} grow={grow} fruit={done} withered={withered} animate={animate} efectos={animate} />
      </Giratorio>
      {animate && <Polen />}
      <ContactShadows position={[0, -1.1, 0]} opacity={0.22} scale={7} blur={2.8} far={3} />
    </Canvas>
  )
}

// ── Granjita 3D (vista "Mi bosque") ─────────────────────────────────────────
export type ForestItem = { species: Species3D; ok: boolean }

function Pradera({ radio }: { radio: number }) {
  const flores = useMemo(() => Array.from({ length: 40 }, (_, i) => {
    const a = rnd(i * 3.3) * Math.PI * 2, r = rnd(i * 5.1) * radio
    return { p: [Math.cos(a) * r, 0.02, Math.sin(a) * r] as V3, c: ['#f472b6', '#fde047', '#ffffff', '#a78bfa'][i % 4] }
  }), [radio])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radio + 1.5, 40]} />
        <Mat color="#7cc76a" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[radio + 6, 40]} />
        <Mat color="#9bd98a" />
      </mesh>
      {flores.map((f, i) => (
        <mesh key={i} position={[f.p[0], 0.08, f.p[2]]}>
          <octahedronGeometry args={[0.06, 0]} />
          <Mat color={f.c} />
        </mesh>
      ))}
    </group>
  )
}

// Máximo 12 árboles en escena: son modelos realistas y más harían lenta la vista en celulares
function Arboleda({ items }: { items: ForestItem[] }) {
  const list = items.slice(0, 12)
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)))
  const filas = Math.ceil(list.length / cols)
  const gap = 2.3
  return (
    <group>
      {list.map((it, i) => {
        const r = Math.floor(i / cols), c = i % cols
        const x = (c - (cols - 1) / 2) * gap + (rnd(i * 2.1) - 0.5) * 0.7
        const z = (r - (filas - 1) / 2) * gap + (rnd(i * 4.7) - 0.5) * 0.7
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, rnd(i) * 6.28, 0]} scale={0.58 + rnd(i * 9.3) * 0.12}>
            <Tree species={it.species} grow={1} fruit withered={!it.ok} swayPhase={i * 1.3} densidad={items.length > 12 ? 0.45 : 0.7} />
          </group>
        )
      })}
    </group>
  )
}

export function Forest3D({ items }: { items: ForestItem[] }) {
  const n = Math.min(12, items.length)
  const radio = Math.max(2.5, Math.sqrt(Math.max(1, n)) * 1.4)
  const dist = 4.2 + Math.sqrt(Math.max(1, n)) * 2.3
  return (
    <Canvas dpr={[1, 2]} shadows
      camera={{ position: [dist * 0.55, dist * 0.65, dist], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      events={SIN_EVENTOS}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ camera, gl }) => { camera.lookAt(0, 0.7, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05 }}>
      <fog attach="fog" args={['#cfeee0', dist * 1.1, dist * 2.4]} />
      <Luces />
      <Giratorio vel={0.06}>
        <Pradera radio={radio} />
        <Arboleda items={items} />
        <Polen cantidad={20} radio={radio} />
      </Giratorio>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.25} scale={radio * 3} blur={2.6} far={6} />
    </Canvas>
  )
}
