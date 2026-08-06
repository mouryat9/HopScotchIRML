import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ThemeProvider } from './ThemeContext'
import { Toaster } from './Toast.jsx'
import { LanguageProvider } from './i18n.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <App />
          <Toaster />
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>,
)
