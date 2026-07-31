"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Modal } from "@/components/modal"
import { signOut } from "@/app/actions/auth"

/** Ícone de logout com confirmação ("Deseja realmente fazer logout?"). */
export function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sair"
        title="Sair"
        className={cn(
          "flex items-center justify-center rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger",
          collapsed ? "w-full px-0" : "shrink-0",
        )}
      >
        <LogOut size={18} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Sair da conta"
        description="Deseja realmente fazer logout?"
        className="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90"
            >
              <LogOut size={16} />
              Sair
            </button>
          </form>
        </div>
      </Modal>
    </>
  )
}
