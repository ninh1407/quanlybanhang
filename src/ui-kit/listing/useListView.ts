import { useCallback, useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

export type ListViewState<F extends Record<string, unknown>> = {
  q: string
  sortKey: string
  sortDir: SortDir
  page: number
  pageSize: number
  filters: F
}

export type SavedView<F extends Record<string, unknown>> = {
  id: string
  name: string
  state: ListViewState<F>
  createdAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function newViewId(): string {
  return `view_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function storageKeyFor(scope: string): string {
  return `list_views_v1:${scope}`
}

function loadViews<F extends Record<string, unknown>>(scope: string): SavedView<F>[] {
  try {
    const raw = localStorage.getItem(storageKeyFor(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => x as SavedView<F>)
      .filter((x) => typeof x.id === 'string' && typeof x.name === 'string' && x.state)
  } catch {
    return []
  }
}

function saveViews<F extends Record<string, unknown>>(scope: string, views: SavedView<F>[]): void {
  localStorage.setItem(storageKeyFor(scope), JSON.stringify(views))
}

export function useListView<F extends Record<string, unknown>>(
  scope: string,
  defaults: ListViewState<F>,
): {
  state: ListViewState<F>
  setState: (next: ListViewState<F>) => void
  patch: (patch: Partial<ListViewState<F>>) => void
  patchFilters: (patch: Partial<F>) => void
  reset: () => void
  views: SavedView<F>[]
  saveCurrentAs: (name: string) => void
  deleteView: (id: string) => void
  applyView: (id: string) => void
} {
  const [state, setState] = useState<ListViewState<F>>(defaults)
  const [views, setViews] = useState<SavedView<F>[]>(() => loadViews<F>(scope))

  const patch = useCallback(
    (p: Partial<ListViewState<F>>) => {
      setState((prev) => {
        const next = { ...prev, ...p }
        if ('q' in p || 'sortKey' in p || 'sortDir' in p || 'filters' in p || 'pageSize' in p) next.page = 1
        return next
      })
    },
    [setState],
  )

  const patchFilters = useCallback(
    (p: Partial<F>) => {
      setState((prev) => ({ ...prev, filters: { ...prev.filters, ...p }, page: 1 }))
    },
    [setState],
  )

  const reset = useCallback(() => setState(defaults), [defaults])

  const saveCurrentAs = useCallback(
    (name: string) => {
      const n = name.trim()
      if (!n) return
      const next: SavedView<F> = { id: newViewId(), name: n, state, createdAt: nowIso() }
      setViews((prev) => {
        const views = [next, ...prev]
        saveViews(scope, views)
        return views
      })
    },
    [scope, state],
  )

  const deleteView = useCallback(
    (id: string) => {
      setViews((prev) => {
        const views = prev.filter((v) => v.id !== id)
        saveViews(scope, views)
        return views
      })
    },
    [scope],
  )

  const applyView = useCallback(
    (id: string) => {
      const v = views.find((x) => x.id === id)
      if (!v) return
      setState({ ...v.state, page: 1 })
    },
    [views],
  )

  return useMemo(
    () => ({ state, setState, patch, patchFilters, reset, views, saveCurrentAs, deleteView, applyView }),
    [applyView, deleteView, patch, patchFilters, reset, saveCurrentAs, state, views],
  )
}

