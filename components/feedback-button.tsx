"use client"

import { useState, useTransition } from "react"
import { Bug } from "lucide-react"
import { Modal } from "@/components/modal"
import { Button, Field, Select, Textarea } from "@/components/ui"
import { submitFeedback } from "@/app/actions/social"

export function FeedbackButton({ page }: { page: string }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setError(undefined)
    startTransition(async () => {
      const res = await submitFeedback(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setOpen(false)
      }, 1500)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar bug ou enviar feedback"
        title="Reportar bug"
        className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-muted transition-colors hover:text-foreground"
      >
        <Bug className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Reportar bug ou enviar feedback">
        {done ? (
          <p className="py-6 text-center text-sm text-primary">Obrigado! Seu feedback foi enviado.</p>
        ) : (
          <form action={onSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="page" value={page} />
            <Field label="Tipo">
              <Select name="kind" defaultValue="bug">
                <option value="bug">Reportar bug</option>
                <option value="suggestion">Sugestão</option>
                <option value="other">Outro</option>
              </Select>
            </Field>
            <Field label="Mensagem">
              <Textarea name="message" rows={4} placeholder="Descreva o problema ou a ideia..." required />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
