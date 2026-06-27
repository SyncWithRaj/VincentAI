const toQuery = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value))
    }
  })
  return search.toString()
}

const handleResponse = async (response) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed')
  }
  return payload
}

export const fetchLiveStoreItems = async (params = {}) => {
  const query = toQuery(params)
  const response = await fetch(`/api/live-store/items${query ? `?${query}` : ''}`)
  return handleResponse(response)
}

export const fetchLiveStoreItem = async (itemId) => {
  const response = await fetch(`/api/live-store/items/${itemId}`)
  return handleResponse(response)
}

export const getLiveStoreWsUrl = () => {
  const envUrl = import.meta.env.VITE_BACKEND_WS_URL
  if (envUrl) {
    return envUrl
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host || 'localhost:5173'
  return `${protocol}://${host}/ws/live-store`
}
