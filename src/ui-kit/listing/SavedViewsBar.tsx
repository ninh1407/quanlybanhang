import type { SavedView } from './useListView'
import { useDialogs } from '../Dialogs'

export function SavedViewsBar<F extends Record<string, unknown>>(props: {
  views: SavedView<F>[]
  onApply: (id: string) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
}) {
  const dialogs = useDialogs()
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <select
        defaultValue=""
        onChange={(e) => {
          const id = e.target.value
          if (!id) return
          props.onApply(id)
          e.currentTarget.value = ''
        }}
      >
        <option value="">Saved views…</option>
        {props.views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <button
        className="btn btn-small"
        onClick={async () => {
          const name = await dialogs.prompt({ message: 'Tên view để lưu:', required: true })
          if (name == null) return
          if (!name.trim()) return
          props.onSave(name.trim())
        }}
      >
        Lưu view
      </button>

      <button
        className="btn btn-small btn-danger"
        disabled={!props.views.length}
        onClick={async () => {
          const options = props.views.map((v) => `${v.name} (${v.id})`).join('\n')
          const id = await dialogs.prompt({ message: `Nhập id view để xóa:\n${options}`, required: true })
          if (!id) return
          if (!id.trim()) return
          props.onDelete(id.trim())
        }}
      >
        Xóa view
      </button>
    </div>
  )
}

