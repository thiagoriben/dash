"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Badge } from "@/components/ui"
import { saveListPref } from "@/app/actions/projects"
import { Plus, X } from "lucide-react"

type ListKey = "regions" | "currencies" | "offer_types" | "sources"

/** Editor de uma lista global (regiões, moedas, ofertas, origens). Valores em minúsculo. */
export function ListEditor({
  listKey,
  title,
  description,
  initial,
  placeholder,
  uppercaseDisplay,
}: {
  listKey: ListKey
  title: string
  description?: string
  initial: string[]
  placeholder: string
  uppercaseDisplay?: boolean
}) {
  const [items, setItems] = useState<string[]>(initial)
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function persist(next: string[]) {
    setItems(next)
    startTransition(async () => {
      await saveListPref(listKey, next)
      router.refresh()
    })
  }

  function add() {
    const v = draft.trim().toLowerCase()
    if (!v || items.includes(v)) {
      setDraft("")
      return
    }
    persist([...items, v])
    setDraft("")
  }

  function remove(v: string) {
    persist(items.filter((i) => i !== v))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? (
            <span className="text-sm text-muted">Nenhum item ainda.</span>
          ) : (
            items.map((item) => (
              <Badge key={item} tone="primary" className="gap-1.5 py-1 pl-2.5 pr-1">
                <span>{uppercaseDisplay ? item.toUpperCase() : item}</span>
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="rounded-full p-0.5 transition-colors hover:bg-white/10"
                  aria-label={`Remover ${item}`}
                >
                  <X size={12} />
                </button>
              </Badge>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                add()
              }
            }}
            placeholder={placeholder}
            disabled={pending}
          />
          <Button type="button" size="sm" onClick={add} disabled={pending}>
            <Plus size={16} /> Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
