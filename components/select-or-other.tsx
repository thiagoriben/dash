"use client"

import { useState } from "react"
import { Input, Select } from "@/components/ui"

/**
 * Select com opção "Outro" que revela um input livre.
 * Emite o valor final via input hidden `name`, então funciona em <form action>.
 */
export function SelectOrOther({
  name,
  options,
  defaultValue,
  placeholder = "Escreva...",
  allowEmpty,
  emptyLabel = "—",
}: {
  name: string
  options: string[]
  defaultValue?: string | null
  placeholder?: string
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  const initial = defaultValue ?? (allowEmpty ? "" : options[0] ?? "")
  // Casa de forma case-insensitive para reaproveitar valores legados salvos em minúsculo
  // (ex.: "facebook ads" cai na opção canônica "Facebook Ads" em vez de "Outro").
  const canonical = options.find((o) => o.toLowerCase() === initial.toLowerCase())
  const initialIsKnown = initial === "" || Boolean(canonical)
  const [sel, setSel] = useState(initial === "" ? "" : (canonical ?? "__other__"))
  const [other, setOther] = useState(initialIsKnown ? "" : initial)

  const value = sel === "__other__" ? other : sel

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={value} />
      <Select value={sel} onChange={(e) => setSel(e.target.value)}>
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__other__">Outro...</option>
      </Select>
      {sel === "__other__" ? (
        <Input
          autoFocus
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder={placeholder}
        />
      ) : null}
    </div>
  )
}
