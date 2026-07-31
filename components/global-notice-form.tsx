"use client"

import { useState, useTransition } from "react"
import { Megaphone, Send } from "lucide-react"
import { Card, CardContent, Button } from "@/components/ui"
import { sendGlobalNotification } from "@/app/actions/social"

export function GlobalNoticeForm() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function submit(formData: FormData) {
    setMsg(null)
    startTransition(async () => {
      const res = await sendGlobalNotification(formData)
      if (res?.error) setMsg(res.error)
      else setMsg(`Aviso enviado para ${res?.count ?? 0} usuário(s).`)
    })
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Megaphone size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Aviso global</h2>
            <p className="text-xs text-muted">Envia uma notificação discreta para todos os usuários aprovados.</p>
          </div>
        </div>
        <form action={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gn-title" className="text-xs text-muted">Título</label>
            <input
              id="gn-title"
              name="title"
              required
              maxLength={120}
              placeholder="Ex.: Manutenção programada hoje às 22h"
              className="rounded-xl border border-[color:var(--color-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gn-body" className="text-xs text-muted">Mensagem (opcional)</label>
            <textarea
              id="gn-body"
              name="body"
              rows={3}
              maxLength={400}
              placeholder="Detalhe o aviso…"
              className="resize-none rounded-xl border border-[color:var(--color-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gn-link" className="text-xs text-muted">Link (opcional)</label>
            <input
              id="gn-link"
              name="link"
              placeholder="/projetos"
              className="rounded-xl border border-[color:var(--color-border)] bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending} className="gap-2">
              <Send size={15} /> {pending ? "Enviando…" : "Enviar aviso"}
            </Button>
            {msg && <span className="text-xs text-muted">{msg}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
