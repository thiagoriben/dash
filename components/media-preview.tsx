"use client"

import * as React from "react"
import { ImageIcon, PlayCircle, ExternalLink, X, LibraryBig } from "lucide-react"
import { Modal } from "@/components/modal"

/** Classificação do link de mídia a partir da URL. */
export type MediaKind = "image" | "video" | "youtube" | "ad-library" | "link"

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i

/** Detecta o tipo de mídia de uma URL para escolher a pré-visualização certa. */
export function detectMedia(url?: string | null): MediaKind {
  if (!url) return "link"
  const u = url.trim()
  if (/facebook\.com\/ads\/library|library\/?\?|adslibrary/i.test(u)) return "ad-library"
  if (/(youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts)/i.test(u)) return "youtube"
  if (IMAGE_EXT.test(u)) return "image"
  if (VIDEO_EXT.test(u)) return "video"
  return "link"
}

/** Extrai o id de um vídeo do YouTube para montar a thumbnail/embed. */
function youtubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/shorts\/([\w-]{11})/)
  return m ? m[1] : null
}

/**
 * Miniatura clicável de mídia (imagem, vídeo, YouTube ou biblioteca de anúncios)
 * que abre uma pré-visualização em modal. Usado em atalhos e notas.
 */
export function MediaPreview({ url, title = "Pré-visualização" }: { url?: string | null; title?: string }) {
  const [open, setOpen] = React.useState(false)
  const [broken, setBroken] = React.useState(false)
  const kind = detectMedia(url)
  if (!url || kind === "link") return null

  const ytId = kind === "youtube" ? youtubeId(url) : null
  const ytThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/mp relative mt-2 block aspect-video w-full overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]"
        aria-label={`Abrir ${title}`}
      >
        {kind === "image" && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url || "/placeholder.svg"}
            alt={title}
            crossOrigin="anonymous"
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : kind === "youtube" && ytThumb && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ytThumb || "/placeholder.svg"}
            alt={title}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted">
            {kind === "ad-library" ? <LibraryBig size={22} /> : kind === "video" ? <PlayCircle size={22} /> : <ImageIcon size={22} />}
            <span className="text-[11px]">
              {kind === "ad-library" ? "Biblioteca de anúncios" : kind === "video" ? "Vídeo" : "Pré-visualizar"}
            </span>
          </div>
        )}
        {(kind === "video" || kind === "youtube") && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white transition-transform group-hover/mp:scale-110">
              <PlayCircle size={26} />
            </span>
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl bg-black">
            {kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url || "/placeholder.svg"} alt={title} crossOrigin="anonymous" className="max-h-[70vh] w-full object-contain" />
            ) : kind === "youtube" && ytId ? (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title={title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : kind === "video" ? (
              <video src={url} controls className="max-h-[70vh] w-full" crossOrigin="anonymous">
                Seu navegador não suporta vídeo.
              </video>
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center text-muted">
                <LibraryBig size={32} className="text-primary" />
                <p className="text-sm">
                  A biblioteca de anúncios do concorrente abre em uma nova aba — muitos sites bloqueiam a exibição
                  incorporada.
                </p>
              </div>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/5"
          >
            <ExternalLink size={14} /> Abrir original
          </a>
        </div>
      </Modal>
    </>
  )
}
