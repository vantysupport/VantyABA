'use client'

import { Blobatar } from '@blobatar/react'
import { fileUrl } from '@/lib/file-url'
import 'blobatar/motion.css'

type UserAvatarProps = {
  seed: string
  imageUrl?: string | null
  size?: number
  alt?: string
  className?: string
}

// Real photo when the user uploaded one; otherwise a deterministic blobatar from a stable seed (use the profile id, not the name, so it survives renames).
export function UserAvatar({ seed, imageUrl, size = 40, alt = '', className = '' }: UserAvatarProps) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-v-border ${className}`}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(imageUrl)} alt={alt} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <Blobatar name={seed} animate="hover" size={size} />
      )}
    </span>
  )
}
