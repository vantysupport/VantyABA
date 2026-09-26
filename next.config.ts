import type { NextConfig } from "next";

// Only CSP directives that can't break script/style loading; a full script-src policy needs a nonce pass over the inline scripts in app/layout.tsx first.
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests" },
]

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['pdf-parse', '@huggingface/transformers', 'onnxruntime-node', 'sharp'],
  poweredByHeader: false,
  // Fotos de la portada con más calidad que el valor por defecto (75)
  images: { qualities: [75, 90] },
  // Center signup uploads a logo (max 2 MB) through a server action.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  // Asegura que los archivos de conocimiento (knowledge-seed/*.md|.txt) se
  // incluyan en el bundle de la función serverless que los indexa.
  outputFileTracingIncludes: {
    '/api/knowledge/seed-archivos': ['./knowledge-seed/**/*'],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig;
