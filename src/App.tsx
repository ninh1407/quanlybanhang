import { AppRoutes } from './app/AppRoutes'
import { StoreProvider } from './state/Store'
import { DialogProvider } from './ui-kit/Dialogs'

export default function App() {
  return (
    <DialogProvider>
      <StoreProvider>
        <AppRoutes />
      </StoreProvider>
    </DialogProvider>
  )
}
