export type SkuCodeSeparator = '-' | '_' | ''

export type SkuCodeField = 'prefix' | 'color' | 'size' | 'material' | 'volume' | 'capacity' | 'power'

export type SkuCodeTemplate = {
  prefix: string
  separator: SkuCodeSeparator
  order: SkuCodeField[]
}

export function parseVariantValues(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/\n|,|;|\|/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export function slugifySkuPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

export function buildSkuCode(template: SkuCodeTemplate, attrs: {
  color?: string
  size?: string
  material?: string
  volume?: string
  capacity?: string
  power?: string
}): string {
  const getPart = (k: SkuCodeField): string => {
    if (k === 'prefix') return slugifySkuPart(template.prefix || '')
    if (k === 'color') return slugifySkuPart(attrs.color || '')
    if (k === 'size') return slugifySkuPart(attrs.size || '')
    if (k === 'material') return slugifySkuPart(attrs.material || '')
    if (k === 'volume') return slugifySkuPart(attrs.volume || '')
    if (k === 'capacity') return slugifySkuPart(attrs.capacity || '')
    if (k === 'power') return slugifySkuPart(attrs.power || '')
    return ''
  }

  const order: SkuCodeField[] = template.order.length ? template.order : (['prefix', 'color', 'size'] as SkuCodeField[])
  const parts = order.map(getPart)
    .filter(Boolean)

  return parts.join(template.separator || '-')
}

