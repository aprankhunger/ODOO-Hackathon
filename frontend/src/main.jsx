import { StrictMode } from 'react'
import { BrowserRouter as Router } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import JigglyCursor from './components/JigglyCursor.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <JigglyCursor />
      <App />
    </Router>
  </StrictMode>,
)
