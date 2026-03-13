import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export function MovementOpenPage() {
  const { id } = useParams()
  const nav = useNavigate()

  useEffect(() => {
    if (!id) {
      nav('/movements', { replace: true })
      return
    }
    nav('/movements', { replace: true, state: { openId: id } })
  }, [id, nav])

  return null
}

