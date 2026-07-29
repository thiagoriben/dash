"use client"

import { useState, useTransition } from "react"
import { Pencil, Copy, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ActionResult = { ok?: boolean; error?: string } | void

/** Botões inline de editar / duplicar / excluir para linhas e cards. */
export function RowActions({
  onEdit,
  onDuplicate,
  onDelete,
  confirmDelete = true,
}: {
  onEdit?: () => void
  onDuplicate?: () => Promise<ActionResult>
  onDelete?: () => Promise<ActionResult>
  confirmDelete?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex items-center justify-end gap-1">
      {onEdit ? (
        <IconBtn label="Editar" onClick={onEdit}>
          <Pencil size={15} />
        </IconBtn>
      ) : null}
      {onDuplicate ? (
        <IconBtn
          label="Duplicar"
          onClick={() => startTransition(async () => void (await onDuplicate()))}
          disabled={pending}
        >
          <Copy size={15} />
        </IconBtn>
      ) : null}
      {onDelete ? (
        confirming ? (
          <>
            <button
              onClick={() => startTransition(async () => void (await onDelete()))}
              disabled={pending}
              className="rounded-md px-2 py-1 text-xs font-medium text-negative hover:bg-negative/10"
            >
              {pending ? "..." : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Cancelar
            </button>
          </>
        ) : (
          <IconBtn
            label="Excluir"
            onClick={() => (confirmDelete ? setConfirming(true) : startTransition(async () => void (await onDelete())))}
            danger
          >
            <Trash2 size={15} />
          </IconBtn>
        )
      ) : null}
    </div>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md p-1.5 text-muted transition-colors hover:bg-white/5 disabled:opacity-40",
        danger ? "hover:text-negative" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
