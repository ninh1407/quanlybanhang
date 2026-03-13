import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import type { StockVoucher } from '../domain/types'
import { nowIso } from '../lib/date'
import { newId } from '../lib/id'
import { useAppDispatch, useAppState } from '../state/Store'

export function MovementCreatePage() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const { can } = useAuth()
  const nav = useNavigate()

  const locations = useMemo(() => state.locations.filter((l) => l.active).slice().sort((a, b) => a.code.localeCompare(b.code)), [state.locations])

  useEffect(() => {
    if (!can('inventory:write')) {
      nav('/movements', { replace: true })
      return
    }

    const createdAt = nowIso()
    const v: StockVoucher = {
      id: newId('vch'),
      code: '',
      type: 'in',
      status: 'draft',
      fromLocationId: null,
      toLocationId: locations[0]?.id ?? null,
      note: '',
      createdAt,
      createdByUserId: state.currentUserId,
      finalizedAt: null,
      lines: [],
    }

    dispatch({ type: 'stockVouchers/upsert', voucher: v })
    nav('/movements', { replace: true, state: { openId: v.id } })
  }, [can, dispatch, locations, nav, state.currentUserId])

  return null
}

