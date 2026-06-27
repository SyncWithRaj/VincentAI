import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Link2,
  Mic,
  RefreshCw,
  Radio,
  Sparkles,
  Video
} from 'lucide-react'
import { fetchLiveStoreItems, getLiveStoreWsUrl } from '../../services/liveStoreApi'

const statusStyles = {
  queued: 'bg-white/5 text-gray-300 border-white/10',
  processing: 'bg-[#00F5FF]/10 text-[#00F5FF] border-[#00F5FF]/30',
  complete: 'bg-[#35F08B]/10 text-[#35F08B] border-[#35F08B]/30',
  error: 'bg-[#FF3D6E]/10 text-[#FF3D6E] border-[#FF3D6E]/30'
}

const contentIcons = {
  video: Video,
  audio: Mic,
  image: ImageIcon,
  link: Link2,
  text: Sparkles
}

const formatTimestamp = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

/* ─── Stat Card ─────────────────────────────────────────────── */
function StatCard({ label, value, tone, glow }) {
  return (
    <div
      className="relative overflow-hidden p-4 rounded-2xl border border-white/10 bg-white/5 flex flex-col gap-1 transition-transform duration-200 hover:-translate-y-0.5"
      style={glow ? { boxShadow: `0 0 18px ${glow}22` } : {}}
    >
      <div className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold ${tone} tabular-nums`}>{value}</div>
      {glow && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
          style={{ background: glow }}
        />
      )}
    </div>
  )
}

/* ─── Queue Item Card ────────────────────────────────────────── */
function QueueCard({ item, isSelected, onClick }) {
  const status = item.status || 'queued'
  const style = statusStyles[status] || statusStyles.queued
  const itemInput = item.input || {}
  const itemType = itemInput.content_type || (itemInput.link ? 'link' : 'text')
  const ItemIcon = contentIcons[itemType] || Sparkles

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
        isSelected
          ? 'border-[#FF3D6E]/40 bg-[#FF3D6E]/8 shadow-[0_0_22px_rgba(255,61,110,0.18)]'
          : 'border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/15'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
              isSelected
                ? 'bg-[#FF3D6E]/15 border border-[#FF3D6E]/30'
                : 'bg-white/5 border border-white/10 group-hover:bg-white/10'
            }`}
          >
            <ItemIcon size={16} className={isSelected ? 'text-[#FF3D6E]' : 'text-[#00F5FF]'} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">
              {itemInput.profile_name || 'Creator'}
            </div>
            <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
              {itemType} intake
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wide ${style}`}
        >
          {status}
        </span>
      </div>

      <p className="mt-3 text-xs text-gray-400 line-clamp-2 leading-relaxed">
        {itemInput.text || itemInput.link || 'Media submission received.'}
      </p>
      <div className="mt-2 text-[10px] text-gray-600">{formatTimestamp(item.created_at)}</div>
    </button>
  )
}

/* ─── Section Label ─────────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-600 mb-3 px-1">
      {children}
    </div>
  )
}

/* ─── Insight Panel Card ─────────────────────────────────────── */
function InsightCard({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl border border-white/10 bg-[#0C0C0F] hover:border-white/15 transition-colors duration-200">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon size={14} className="text-gray-400" />
        </div>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function LiveStore({ initialItemId }) {
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(initialItemId || '')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadItems = useCallback(async () => {
    setIsRefreshing(true)
    setError('')
    try {
      const payload = await fetchLiveStoreItems({ limit: 40 })
      setItems(payload.items || [])
    } catch (err) {
      setError(err.message || 'Failed to load Live Store items.')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!initialItemId) return
    setSelectedId(initialItemId)
  }, [initialItemId])

  useEffect(() => {
    const ws = new WebSocket(getLiveStoreWsUrl())
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setError('Live updates unavailable.')
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        const incoming = message?.payload
        if (!incoming?.id) return
        setItems((prev) => {
          const exists = prev.find((item) => item.id === incoming.id)
          if (!exists) {
            return [incoming, ...prev]
          }
          return prev.map((item) => (item.id === incoming.id ? { ...item, ...incoming } : item))
        })
      } catch (err) {
        setError('Live updates failed to parse.')
      }
    }
    return () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    if (selectedId || items.length === 0) return
    setSelectedId(items[0].id)
  }, [items, selectedId])

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0],
    [items, selectedId]
  )

  const statusCounts = useMemo(() => {
    const counts = { total: items.length, queued: 0, processing: 0, complete: 0, error: 0 }
    items.forEach((item) => {
      const status = item.status || 'queued'
      if (counts[status] !== undefined) {
        counts[status] += 1
      }
    })
    return counts
  }, [items])

  const input = selectedItem?.input || {}
  const contentType = input.content_type || (input.link ? 'link' : 'text')
  const ContentIcon = contentIcons[contentType] || Sparkles

  return (
    <div className="flex flex-col gap-6">
      {/* ── TOP ROW: Sidebar + Detail Panel ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <aside className="flex flex-col gap-5 min-h-0">

        {/* Header Card */}
        <div className="p-4 rounded-2xl bg-white/4 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl border ${connected ? 'border-[#35F08B]/30 bg-[#35F08B]/10' : 'border-white/10 bg-white/5'}`}>
                <Radio size={15} className={connected ? 'text-[#35F08B]' : 'text-gray-500'} />
                {connected && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#35F08B] shadow-[0_0_6px_#35F08B]" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-white leading-none">Live Store Queue</div>
                <div className="text-[10px] text-gray-500 mt-0.5">WhatsApp submissions</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadItems}
                disabled={isRefreshing}
                className="text-[11px] px-3 py-1.5 rounded-full border border-white/10 text-gray-300 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <span
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                  connected
                    ? 'border-[#35F08B]/30 text-[#35F08B] bg-[#35F08B]/8'
                    : 'border-white/10 text-gray-500 bg-white/3'
                }`}
              >
                {connected ? '● Live' : '○ Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total" value={statusCounts.total} tone="text-white" />
          <StatCard label="Queued" value={statusCounts.queued} tone="text-gray-300" />
          <StatCard label="Processing" value={statusCounts.processing} tone="text-[#00F5FF]" glow="#00F5FF" />
          <StatCard label="Completed" value={statusCounts.complete} tone="text-[#35F08B]" glow="#35F08B" />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-[#FF3D6E]/30 bg-[#FF3D6E]/8 text-[#FF3D6E] text-sm">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Queue list */}
        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
          <SectionLabel>Submissions ({items.length})</SectionLabel>
          {items.length === 0 && !isRefreshing && (
            <div className="text-center py-10 text-xs text-gray-600">
              No submissions yet. Waiting for WhatsApp messages…
            </div>
          )}
          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              onClick={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── RIGHT DETAIL PANEL ───────────────────────────────── */}
      <section className="flex flex-col gap-6">

        {/* Detail Header */}
        <div className="p-6 rounded-2xl bg-white/4 border border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FF3D6E]/12 border border-[#FF3D6E]/25 flex items-center justify-center shadow-[0_0_18px_rgba(255,61,110,0.15)]">
                <ContentIcon size={22} className="text-[#FF3D6E]" />
              </div>
              <div>
                <div className="text-lg font-bold text-white leading-tight">
                  Engagement Visualization Dashboard
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Frame-by-frame intelligence and algorithm signals
                </div>
              </div>
            </div>
            <span
              className={`text-xs px-3 py-1.5 rounded-full border font-semibold uppercase tracking-wide ${
                statusStyles[selectedItem?.status || 'queued'] || statusStyles.queued
              }`}
            >
              {selectedItem?.status || 'queued'}
            </span>
          </div>

          {/* Three insight cards */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Virality Score */}
            <InsightCard icon={Activity} title="Virality Score">
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-white tabular-nums leading-none">
                  {selectedItem?.viral_prediction?.score ?? '--'}
                </span>
                <span className="text-sm text-gray-500 mb-1">/100</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF3D6E] to-[#00F5FF] transition-all duration-700"
                  style={{ width: `${Math.min(selectedItem?.viral_prediction?.score || 0, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {selectedItem?.viral_prediction?.reasoning || 'Awaiting prediction summary.'}
              </p>
            </InsightCard>

            {/* Executive Summary */}
            <InsightCard icon={CheckCircle2} title="Executive Summary">
              <p className="text-sm text-gray-200 leading-relaxed flex-1">
                {selectedItem?.executive_summary || 'Processing multi-agent summary…'}
              </p>
            </InsightCard>

            {/* Algorithm Insights */}
            <InsightCard icon={Sparkles} title="Algorithm Insights">
              <ul className="space-y-3">
                {(selectedItem?.algorithm_insights || []).slice(0, 4).map((insight, index) => (
                  <li key={`${insight.signal}-${index}`} className="flex items-start gap-2.5">
                    <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-[#00F5FF] shadow-[0_0_6px_#00F5FF]" />
                    <div>
                      <div className="text-sm font-semibold text-white leading-tight">{insight.signal}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{insight.why_it_matters}</div>
                    </div>
                  </li>
                ))}
                {(selectedItem?.algorithm_insights || []).length === 0 && (
                  <li className="text-xs text-gray-600 italic">Insights are generating now…</li>
                )}
              </ul>
            </InsightCard>
          </div>
        </div>

      </section>
      </div>
      {/* ── END TOP ROW ──────────────────────────────────────── */}

      {/* Frame-Level Video Analysis — truly full-width row */}
      {contentType === 'video' &&
        (selectedItem?.frame_analysis?.attention_drop_segments || []).length > 0 && (
          <div className="p-5 rounded-2xl border border-white/10 bg-white/4 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
            <SectionLabel>Frame-Level Video Analysis</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {(selectedItem?.frame_analysis?.attention_drop_segments || []).map(
                (segment, index) => (
                  <div
                    key={`${segment.start}-${index}`}
                    className="p-3.5 rounded-xl border border-white/8 bg-[#0C0C0F] hover:border-white/12 transition-colors"
                  >
                    <div className="text-xs font-bold text-[#FF3D6E] tracking-wide mb-1">
                      {segment.start} – {segment.end}
                    </div>
                    <div className="text-sm text-white leading-snug">{segment.issue}</div>
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {segment.recommendation}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

      {/* Post Optimization — truly full-width row across entire page */}
      <div className="p-6 rounded-2xl border border-white/10 bg-white/4 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-[#00F5FF]/10 border border-[#00F5FF]/20 flex items-center justify-center">
            <Link2 size={15} className="text-[#00F5FF]" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">Post Optimization</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Link analysis &amp; improvements</div>
          </div>
        </div>

        {selectedItem?.platform_data?.scrape_error && (
          <div className="mb-5 text-xs text-[#FF3D6E] bg-[#FF3D6E]/8 border border-[#FF3D6E]/20 rounded-xl px-3.5 py-2.5 leading-relaxed">
            {selectedItem.platform_data.scrape_error}
          </div>
        )}

        {/* Score row — uses more columns now that we have full width */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl border border-white/8 bg-[#0C0C0F] flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">Baseline Score</div>
            <div className="text-3xl font-bold text-white tabular-nums">
              {selectedItem?.link_analysis?.baseline_score ?? '--'}
            </div>
          </div>
          <div className="p-4 rounded-xl border border-[#35F08B]/20 bg-[#35F08B]/5 flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">Predicted After</div>
            <div className="text-3xl font-bold text-[#35F08B] tabular-nums">
              {selectedItem?.link_analysis?.predicted_virality_after?.score ?? '--'}
            </div>
          </div>
          <div className="col-span-2 p-4 rounded-xl border border-white/8 bg-[#0C0C0F] flex flex-col justify-center gap-1">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">Suggestions</div>
            <div className="text-lg font-semibold text-white">
              {(selectedItem?.link_analysis?.suggested_improvements || []).length} improvements ready
            </div>
            <div className="text-xs text-gray-600">
              {selectedItem?.link_analysis?.enhanced_text ? 'Enhanced text available' : 'Awaiting scrape result'}
            </div>
          </div>
        </div>

        {/* Improvements + Enhanced Text — 3-col on xl for roomier layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <div className="text-[11px] uppercase tracking-widest text-gray-600 font-semibold mb-3">
              Suggested Improvements
            </div>
            <ul className="space-y-2.5">
              {(selectedItem?.link_analysis?.suggested_improvements || []).map((tip, index) => (
                <li key={`${tip}-${index}`} className="flex items-start gap-2.5 text-sm text-gray-300 leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 shrink-0 rounded-full bg-[#00F5FF] shadow-[0_0_5px_#00F5FF55]" />
                  {tip}
                </li>
              ))}
              {(selectedItem?.link_analysis?.suggested_improvements || []).length === 0 && (
                <li className="text-xs text-gray-600 italic">Link insights will appear after scraping.</li>
              )}
            </ul>
          </div>

          {selectedItem?.link_analysis?.enhanced_text ? (
            <div className="xl:col-span-2 p-5 rounded-xl border border-white/8 bg-[#0C0C0F]">
              <div className="text-[11px] uppercase tracking-widest text-gray-600 font-semibold mb-3">
                Enhanced Text
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed">
                {selectedItem.link_analysis.enhanced_text}
              </p>
            </div>
          ) : (
            <div className="xl:col-span-2 flex items-center justify-center rounded-xl border border-dashed border-white/8 bg-white/2 p-10">
              <div className="text-center">
                <Link2 size={24} className="text-gray-700 mx-auto mb-2" />
                <div className="text-xs text-gray-600">Enhanced text will appear once the link is scraped and processed.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
