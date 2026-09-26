import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Fetch for user-supplied URLs: blocks loopback/private/link-local/metadata targets (SSRF),
// and re-validates every redirect hop so a public URL can't bounce into the internal network.

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::') return true
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateAddress(mapped[1]) : false
  }
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('unsupported_protocol')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map(a => a.address)
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error('blocked_address')
  return url
}

export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let url = await assertPublicUrl(raw)
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(url, { ...init, redirect: 'manual' })
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!location) return res
    url = await assertPublicUrl(new URL(location, url).toString())
  }
  throw new Error('too_many_redirects')
}
