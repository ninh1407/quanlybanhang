import { AppRoutes } from './app/AppRoutes'
import { StoreProvider } from './state/Store'
import { DialogProvider } from './ui-kit/Dialogs'
import { UpdateManager } from './ui-kit/UpdateManager'

export default function App() {
  return (
    <DialogProvider>
      <StoreProvider>
        <AppRoutes />
        <UpdateManager />
      </StoreProvider>
    </DialogProvider>
  )
}
