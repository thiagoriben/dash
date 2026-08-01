"use client"

import { useEffect, useState, useTransition } from "react"
import { BellRing, Bell, Check } from "lucide-react"
import { Button, Select } from "@/components/ui"
import { saveNotifSettings } from "@/app/actions/notifications"
import {
  notificationsSupported,
  requestNotificationPermission,
  showNotification,
} from "@/lib/pwa"

const LEAD_OPTIONS = [
  { value: 0, label: "Na hora" },
  { value: 5, label: "5 minutos antes" },
  { value: 10, label: "10 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
]

export function NotifSettings({
  initial,
}: {
  initial: { enabled?: boolean; task_reminders?: boolean; default_lead?: number }
}) {
  const [perm, setPerm] = useState<NotificationPermission>("default")
  const [taskOn, setTaskOn] = useState(initial.task_reminders !== false)
  const [lead, setLead] = useState(initial.default_lead ?? 10)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (notificationsSupported()) setPerm(Notification.permission)
  }, [])

  function persist(patch: Record<string, unknown>) {
    setSaved(false)
    start(async () => {
      await saveNotifSettings(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  async function enable() {
    const p = await requestNotificationPermission()
    setPerm(p)
    if (p === "granted") persist({ enabled: true })
  }

  const supported = notificationsSupported()

  return (
    <div className="flex flex-col gap-4">
      {/* Permissão do navegador */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--color-border)] p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell size={18} />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">Notificações do navegador</p>
            <p className="text-xs text-muted">
              {!supported
                ? "Não suportado neste dispositivo."
                : perm === "granted"
                  ? "Ativadas neste dispositivo."
                  : perm === "denied"
                    ? "Bloqueadas — ajuste nas configurações do navegador."
                    : "Permita para receber lembretes."}
            </p>
          </div>
        </div>
        {supported && perm !== "granted" ? (
          <Button size="sm" onClick={enable} disabled={perm === "denied"}>
            <BellRing size={15} /> Ativar
          </Button>
        ) : perm === "granted" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => showNotification("Teste", "Notificações estão funcionando.")}
          >
            Testar
          </Button>
        ) : null}
      </div>

      {/* Lembretes de tarefas */}
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-foreground">Lembretes de tarefas</span>
          <span className="block text-xs text-muted">
            Avisa no horário da tarefa (a aba precisa estar aberta).
          </span>
        </span>
        <input
          type="checkbox"
          checked={taskOn}
          onChange={(e) => {
            setTaskOn(e.target.checked)
            persist({ task_reminders: e.target.checked })
          }}
          className="h-5 w-5 shrink-0 accent-[color:var(--color-primary)]"
        />
      </label>

      {/* Antecedência padrão */}
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-foreground">Antecedência padrão</span>
          <span className="block text-xs text-muted">Usada ao criar novas tarefas.</span>
        </span>
        <Select
          value={String(lead)}
          disabled={!taskOn}
          onChange={(e) => {
            const v = Number(e.target.value)
            setLead(v)
            persist({ default_lead: v })
          }}
          className="h-9 w-auto min-w-40"
        >
          {LEAD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>

      {saved && (
        <p className="flex items-center gap-1.5 text-xs text-positive">
          <Check size={13} /> Salvo
        </p>
      )}
      {pending && <p className="text-xs text-muted">Salvando…</p>}
    </div>
  )
}
