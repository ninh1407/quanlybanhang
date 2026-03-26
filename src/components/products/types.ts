import type { Sku } from '../../../shared/types/domain'

export type VariantSetupMode = 'single' | 'multi'

export type SkuDraft = Sku & {
  _isNew?: boolean
}

export type VariantDefaults = {
  price: number
  cost: number
  unit: string
  active: boolean
  material?: string
  volume?: string
  capacity?: string
  power?: string
}

export type SkuDraftErrors = Record<string, string[]>

export type VariantStockFlag = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock'

export type VariantStatusFilter = 'all' | 'active' | 'inactive'

