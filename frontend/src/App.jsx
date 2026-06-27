import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import AnalyticsDetail from './pages/AnalyticsDetail'

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/analytics/:platform/:itemId" element={<AnalyticsDetail />} />
    </Routes>
  )
}

export default App