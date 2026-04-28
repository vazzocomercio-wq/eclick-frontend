// PII formatters — pure helpers usados em listas, exports e cards.
// O dado em si NUNCA é mascarado no banco; máscara é só apresentação.

export function formatCPF(cpf: string | null | undefined, masked = true): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length === 11) {
    return masked
      ? `${d.slice(0,3)}.***.***-${d.slice(-2)}`
      : `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  }
  if (d.length === 14) {
    return masked
      ? `${d.slice(0,2)}.***.***/****-${d.slice(-2)}`
      : `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }
  return cpf
}

export function formatPhone(phone: string | null | undefined, masked = true): string {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length < 10) return phone
  const cc   = d.length > 11 ? d.slice(0, 2) : '55'
  const rest = d.length > 11 ? d.slice(2) : d
  const ddd  = rest.slice(0, 2)
  const num  = rest.slice(2)
  // 9XXXX-XXXX (celular) ou XXXX-XXXX (fixo)
  if (num.length === 9) {
    return masked
      ? `+${cc} (${ddd}) 9****-${num.slice(-4)}`
      : `+${cc} (${ddd}) ${num.slice(0,5)}-${num.slice(5)}`
  }
  return masked
    ? `+${cc} (${ddd}) ****-${num.slice(-4)}`
    : `+${cc} (${ddd}) ${num.slice(0,4)}-${num.slice(4)}`
}

export function formatEmail(email: string | null | undefined, masked = true): string {
  if (!email) return '—'
  if (!masked) return email
  const at = email.indexOf('@')
  if (at <= 0) return email
  const user   = email.slice(0, at)
  const domain = email.slice(at)
  if (user.length <= 1) return `*${domain}`
  return `${user[0]}***${domain}`
}

export type PiiType = 'cpf' | 'phone' | 'email'

export function formatPii(type: PiiType, value: string | null | undefined, masked: boolean): string {
  switch (type) {
    case 'cpf':   return formatCPF(value, masked)
    case 'phone': return formatPhone(value, masked)
    case 'email': return formatEmail(value, masked)
  }
}
