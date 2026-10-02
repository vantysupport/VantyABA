// Poses de ARIA (public/aria/poses/*.webp, 512×512 con fondo transparente).
// Las mismas imágenes están en la app móvil (res/drawable-nodpi/aria_<nombre>.webp).

export const POSES_ARIA = [
  'saluda', 'hola', 'bienvenida', 'de-pie', 'atenta', 'explica', 'idea', 'pensando', 'preocupada',
  'contenta', 'pulgar-arriba', 'celebra', 'festeja', 'salta', 'brinca', 'corre',
  'laptop', 'laptop-sentada', 'trabajando', 'estudia', 'lee', 'celular', 'cafe', 'te', 'descansa', 'mochila', 'espalda',
] as const

export type PoseImagenAria = typeof POSES_ARIA[number]

export const poseAria = (p: PoseImagenAria) => `/aria/poses/${p}.webp`
