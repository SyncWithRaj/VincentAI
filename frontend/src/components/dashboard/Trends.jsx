import React, { useState, useEffect, useMemo } from 'react';
import { Flame, Activity, Music, PlaySquare, Zap, Target, Gauge, Sparkles, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';

const SOURCE_COLORS = {
  Reddit: '#ff6b6b',
  YouTube: '#f97316',
  Spotify: '#10b981',
  Web: '#06b6d4',
};

const formatCompact = (value) => {
  const numeric = Number(value || 0);
  if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(1)}M`;
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}K`;
  return `${numeric}`;
};

const toPercent = (value) => {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const normalizeTrend = (trend, index) => {
  const fallbackName = `Opportunity Cluster ${index + 1}`;
  const signalStats = trend?.signal_stats || {};
  const sourceMixRaw = trend?.source_mix || {};

  const sourceMix = Object.entries(sourceMixRaw)
    .map(([key, share]) => ({
      source: key === 'web' ? 'Web' : `${key.charAt(0).toUpperCase()}${key.slice(1)}`,
      share: toPercent(share),
    }))
    .filter((row) => row.share > 0);

  const evidencePoints = Array.isArray(trend?.evidence_points)
    ? trend.evidence_points.slice(0, 4)
    : [];

  const executionPlaybook = Array.isArray(trend?.execution_playbook)
    ? trend.execution_playbook.slice(0, 3)
    : [];

  const tags = Array.isArray(trend?.tags)
    ? trend.tags.slice(0, 6)
    : [];

  return {
    trend_name: trend?.trend_name || fallbackName,
    origin_signal: trend?.origin_signal || 'Cross-platform trend acceleration',
    virality_hypothesis: trend?.virality_hypothesis || 'The format is simple to remix and emotionally sticky, so it propagates quickly.',
    how_to_leverage: trend?.how_to_leverage || 'Ship a fast test series and double down on the best-performing narrative angle.',
    confidence_score: toPercent(trend?.confidence_score ?? 62),
    momentum_score: toPercent(trend?.momentum_score ?? 58),
    signal_stats: {
      mentions_24h: Number(signalStats?.mentions_24h || 0),
      growth_rate_pct: Number(signalStats?.growth_rate_pct || 0),
      engagement_proxy: toPercent(signalStats?.engagement_proxy ?? 55),
    },
    source_mix: sourceMix,
    evidence_points: evidencePoints,
    tags,
    next_7_days_outlook: trend?.next_7_days_outlook || 'Momentum likely to hold across the next week if posting cadence stays high.',
    execution_playbook: executionPlaybook,
    risk_factor: trend?.risk_factor || 'Trend fatigue can hit quickly if creatives are too similar.',
    format_recommendations: Array.isArray(trend?.format_recommendations)
      ? trend.format_recommendations.slice(0, 3)
      : [],
  };
};

export default function Trends() {
  const [hashtagData, setHashtagData] = useState({ items: [], mocked: false });
  const [spotifyData, setSpotifyData] = useState({ items: [], mocked: false });
  const [youtubeData, setYoutubeData] = useState({ items: [] });
  const [trendPredictions, setTrendPredictions] = useState({ items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllTrends = async () => {
      try {
        setLoading(true);
        const [googleRes, spotifyRes, ytRes, predictRes] = await Promise.allSettled([
          fetch('http://localhost:4000/api/trends/hashtags').then(x => x.json()),
          fetch('http://localhost:4000/api/trends/spotify').then(x => x.json()),
          fetch('http://localhost:4000/api/trends/youtube').then(x => x.json()),
          fetch('http://localhost:4000/api/trends/predict').then(x => x.json())
        ]);
        
        if (googleRes.status === 'fulfilled' && googleRes.value.items) setHashtagData(googleRes.value);
        if (spotifyRes.status === 'fulfilled' && spotifyRes.value.items) setSpotifyData(spotifyRes.value);
        if (ytRes.status === 'fulfilled' && ytRes.value.items) setYoutubeData(ytRes.value);
        if (predictRes.status === 'fulfilled' && predictRes.value.items) setTrendPredictions(predictRes.value);
        
      } catch (error) {
        console.error("Failed to load trends data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllTrends();
  }, []);

  const normalizedTrends = useMemo(
    () => (trendPredictions?.items || []).map((trend, index) => normalizeTrend(trend, index)),
    [trendPredictions]
  );

  const predictionMeta = trendPredictions?.meta || {};
  const predictionPlots = trendPredictions?.plots || {};

  const sourceHeatmap = useMemo(() => {
    if (Array.isArray(predictionPlots?.source_heatmap) && predictionPlots.source_heatmap.length > 0) {
      return predictionPlots.source_heatmap.map((row) => ({
        source: row.source,
        signal: Number(row.signal || 0),
      }));
    }

    const scanned = predictionMeta?.sources_scanned || {};
    return [
      { source: 'Reddit', signal: Number(scanned.reddit_posts || 0) },
      { source: 'YouTube', signal: Number(scanned.youtube_videos || 0) },
      { source: 'Spotify', signal: Number(scanned.spotify_tracks || 0) },
      { source: 'Web', signal: Number(scanned.web_hits || 0) },
    ];
  }, [predictionMeta, predictionPlots]);

  const tagVelocity = useMemo(() => {
    if (Array.isArray(predictionPlots?.tag_velocity) && predictionPlots.tag_velocity.length > 0) {
      return predictionPlots.tag_velocity.map((row) => ({
        tag: row.tag,
        velocity: Number(row.velocity || 0),
      }));
    }
    if (Array.isArray(predictionMeta?.top_tags) && predictionMeta.top_tags.length > 0) {
      return predictionMeta.top_tags.slice(0, 6).map((tag, i) => ({
        tag,
        velocity: Math.max(14, 52 - i * 6),
      }));
    }
    return [];
  }, [predictionMeta, predictionPlots]);

  const momentumCurve = useMemo(() => {
    if (Array.isArray(predictionPlots?.momentum_curve) && predictionPlots.momentum_curve.length > 0) {
      return predictionPlots.momentum_curve.map((row) => ({
        day: row.day,
        score: Number(row.score || 0),
      }));
    }

    const baseline = normalizedTrends.length > 0
      ? Math.round(normalizedTrends.reduce((acc, trend) => acc + trend.momentum_score, 0) / normalizedTrends.length)
      : 54;

    return [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map((d) => ({
      day: `D${d >= 0 ? '+' : ''}${d}`,
      score: Math.max(18, Math.min(99, baseline + d * 2 + (d > 0 ? 3 : 0))),
    }));
  }, [normalizedTrends, predictionPlots]);

  const avgConfidence = normalizedTrends.length > 0
    ? Math.round(normalizedTrends.reduce((acc, trend) => acc + trend.confidence_score, 0) / normalizedTrends.length)
    : 0;

  const marketTemperature = Number(
    predictionMeta.market_temperature
      || (normalizedTrends.length > 0
        ? Math.round(normalizedTrends.reduce((acc, trend) => acc + trend.momentum_score, 0) / normalizedTrends.length)
        : 0)
  );

  const totalSignalsScanned = Object.values(predictionMeta.sources_scanned || {}).reduce(
    (acc, value) => acc + Number(value || 0),
    0
  );

  const topOpportunityTag = predictionMeta.top_tags?.[0] || normalizedTrends[0]?.tags?.[0] || '#earlysignal';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Activity className="animate-pulse mb-4 text-rose-400" size={48} />
        <p className="font-medium text-lg">Analyzing global trends data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 text-[#F0F0F0]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3 tracking-tight" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
             <Flame size={36} className="text-[#FF3D6E]" /> Market Pulse
          </h2>
          <p className="text-gray-400 mt-2 text-lg">Real-time data from Google, YouTube, Spotify, and Social feeds.</p>
        </div>
      </div>

      {/* Hashtag Frequency Bar Chart */}
      <div className="bg-white/5 backdrop-blur-md p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        <div className="mb-6 flex items-center justify-between">
           <h3 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}><Activity className="text-[#00F5FF]"/> Trending Video Hashtags</h3>
           <div className="flex gap-2 items-center">
               {hashtagData.mocked && <span className="text-[10px] font-bold bg-[#FF3D6E]/20 text-[#FF3D6E] px-2 py-1 rounded border border-[#FF3D6E]/30">MOCKED</span>}
               <span className="text-xs font-semibold px-3 py-1 bg-white/10 text-gray-300 rounded-full border border-white/10 tracking-widest uppercase">Global YouTube Scrape</span>
           </div>
        </div>
        <div className="h-80 w-full font-medium">
          {hashtagData.items.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hashtagData.items} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#9ca3af', fontWeight: '500' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(8,8,8,0.9)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', color: '#fff', fontWeight: '600' }}
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-gray-500 uppercase tracking-widest text-sm font-bold">Failed to load hashtag data</div>
          )}
        </div>
      </div>

      <section className="bg-gradient-to-br from-[#091120] via-[#10192B] to-[#08161C] rounded-[2.2rem] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 md:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
              <Target className="text-[#00F5FF]" size={32} /> Autonomous Micro-Trend Lab
            </h3>
            <p className="mt-2 text-gray-300 max-w-3xl leading-relaxed">
              This section tracks where trends are emerging, how strong the momentum is, and what execution moves can convert early signals into measurable growth.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#00F5FF]/10 border border-[#00F5FF]/25 text-[#00F5FF] flex items-center gap-1">
              <Database size={11} /> {predictionMeta.synthesis_source === 'groq' ? 'AI + Signal Fusion' : 'Signal Engine'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 border border-white/20 text-gray-300 flex items-center gap-1">
              <Sparkles size={11} /> {predictionMeta.generated_at ? 'Live Snapshot' : 'Estimated Snapshot'}
            </span>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl p-4 bg-black/25 border border-white/10">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Market Temperature</p>
            <p className="text-3xl font-black text-[#00F5FF] mt-2">{toPercent(marketTemperature)}</p>
            <p className="text-xs text-gray-400 mt-1">Composite momentum score</p>
          </div>
          <div className="rounded-2xl p-4 bg-black/25 border border-white/10">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Signals Scanned</p>
            <p className="text-3xl font-black text-[#FF3D6E] mt-2">{formatCompact(totalSignalsScanned)}</p>
            <p className="text-xs text-gray-400 mt-1">Posts, tracks, videos, and web hits</p>
          </div>
          <div className="rounded-2xl p-4 bg-black/25 border border-white/10">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Average Confidence</p>
            <p className="text-3xl font-black text-white mt-2">{avgConfidence}%</p>
            <p className="text-xs text-gray-400 mt-1">Across active micro-trends</p>
          </div>
          <div className="rounded-2xl p-4 bg-black/25 border border-white/10">
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Top Opportunity Tag</p>
            <p className="text-2xl md:text-3xl font-black text-[#8B5CF6] mt-2 truncate">{topOpportunityTag}</p>
            <p className="text-xs text-gray-400 mt-1">Most repeated high-velocity signal</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
            <h4 className="text-sm uppercase tracking-widest text-gray-300 font-bold mb-4 flex items-center gap-2">
              <Gauge size={14} className="text-[#00F5FF]" /> Momentum Curve (Last + Next Days)
            </h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={momentumCurve} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5FF" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00F5FF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(7,10,17,0.92)' }}
                    cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#00F5FF" fill="url(#momentumFill)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
            <h4 className="text-sm uppercase tracking-widest text-gray-300 font-bold mb-4 flex items-center gap-2">
              <Database size={14} className="text-[#8B5CF6]" /> Source Heatmap
            </h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceHeatmap} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="source" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(7,10,17,0.92)' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="signal" radius={[7, 7, 0, 0]} fill="#8B5CF6" barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5">
          <h4 className="text-sm uppercase tracking-widest text-gray-300 font-bold mb-4 flex items-center gap-2">
            <Zap size={14} className="text-[#FF3D6E]" /> Tag Velocity Radarline
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tagVelocity} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="tag" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(7,10,17,0.92)' }}
                />
                <Line type="monotone" dataKey="velocity" stroke="#FF3D6E" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
          {normalizedTrends.length > 0 ? normalizedTrends.map((trend, i) => (
            <article key={`${trend.trend_name}-${i}`} className="rounded-2xl border border-white/10 bg-black/30 p-5 md:p-6 hover:bg-black/40 transition-all">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h4 className="text-xl font-bold text-white leading-tight pr-2">{trend.trend_name}</h4>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Origin: {trend.origin_signal}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className="text-[10px] font-bold bg-[#00F5FF]/15 text-[#00F5FF] border border-[#00F5FF]/25 px-2 py-1 rounded-lg">Conf {trend.confidence_score}%</span>
                  <span className="text-[10px] font-bold bg-[#FF3D6E]/15 text-[#FF3D6E] border border-[#FF3D6E]/25 px-2 py-1 rounded-lg">Mom {trend.momentum_score}%</span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div>
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                    <span>Confidence</span>
                    <span>{trend.confidence_score}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#00F5FF] to-[#22d3ee]" style={{ width: `${trend.confidence_score}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-gray-400 mb-1">
                    <span>Momentum</span>
                    <span>{trend.momentum_score}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FF3D6E] to-[#f97316]" style={{ width: `${trend.momentum_score}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">Mentions 24h</p>
                  <p className="text-base font-black text-white mt-1">{formatCompact(trend.signal_stats.mentions_24h)}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">Growth</p>
                  <p className="text-base font-black text-[#8B5CF6] mt-1">{trend.signal_stats.growth_rate_pct}%</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-2">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">Engagement</p>
                  <p className="text-base font-black text-[#00F5FF] mt-1">{trend.signal_stats.engagement_proxy}</p>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed">{trend.virality_hypothesis}</p>

              {trend.source_mix.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {trend.source_mix.map((sourceRow) => (
                    <span
                      key={`${trend.trend_name}-${sourceRow.source}`}
                      className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border"
                      style={{
                        color: SOURCE_COLORS[sourceRow.source] || '#e5e7eb',
                        borderColor: `${SOURCE_COLORS[sourceRow.source] || '#ffffff'}55`,
                        background: `${SOURCE_COLORS[sourceRow.source] || '#ffffff'}18`,
                      }}
                    >
                      {sourceRow.source} {sourceRow.share}%
                    </span>
                  ))}
                </div>
              )}

              {trend.evidence_points.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold">Evidence Trail</p>
                  {trend.evidence_points.map((ev, evIdx) => (
                    <div key={`${trend.trend_name}-ev-${evIdx}`} className="flex items-start justify-between gap-3 text-sm">
                      <p className="text-gray-300 leading-relaxed line-clamp-2">{ev.snippet}</p>
                      <span className="shrink-0 text-[10px] px-2 py-1 rounded-md border border-white/20 bg-white/10 text-gray-200 uppercase">{ev.source}</span>
                    </div>
                  ))}
                </div>
              )}

              {trend.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {trend.tags.map((tag, tagIdx) => (
                    <span key={`${trend.trend_name}-tag-${tagIdx}`} className="text-xs px-2 py-1 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 text-[#d8b4fe] font-semibold">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 rounded-xl p-3 bg-[#00F5FF]/8 border border-[#00F5FF]/20">
                <p className="text-xs font-bold uppercase tracking-wider text-[#00F5FF] mb-1">How to leverage</p>
                <p className="text-sm text-gray-200 leading-relaxed">{trend.how_to_leverage}</p>
              </div>

              {trend.execution_playbook.length > 0 && (
                <div className="mt-4 space-y-2">
                  {trend.execution_playbook.map((step, stepIdx) => (
                    <div key={`${trend.trend_name}-step-${stepIdx}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">{step.day}</p>
                      <p className="text-sm text-gray-200 mt-1">{step.action}</p>
                      <p className="text-[11px] text-[#FF3D6E] mt-1 font-semibold">KPI: {step.kpi}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">7-Day Outlook</p>
                <p className="text-sm text-gray-300">{trend.next_7_days_outlook}</p>
                <p className="text-xs text-amber-300/90 mt-2">Risk: {trend.risk_factor}</p>
              </div>
            </article>
          )) : (
            <div className="xl:col-span-2 flex items-center justify-center rounded-2xl border border-white/10 bg-black/25 min-h-[220px] text-gray-400 font-semibold tracking-wide">
              Mining multi-source data and generating forecasted micro-trends...
            </div>
          )}
        </div>

        {predictionMeta?.quality_note && (
          <p className="mt-5 text-xs text-gray-400">{predictionMeta.quality_note}</p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* YouTube Trending Tab */}
        <div className="space-y-4">
            <div className="flex items-center justify-between mx-2">
                <h3 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}><PlaySquare className="text-[#FF3D6E]"/> Trending Videos</h3>
            </div>
            <div className="flex flex-col gap-4">
                {youtubeData.items.length > 0 ? youtubeData.items.map((video) => (
                    <a key={video.id} href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:shadow-[0_0_16px_rgba(255,61,110,0.2)] hover:border-white/20 transition-all group">
                        <div className="relative w-32 md:w-40 aspect-video rounded-xl overflow-hidden shrink-0 bg-[#080808] border border-white/5">
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                        </div>
                        <div className="flex flex-col justify-between h-full py-1">
                            <h4 className="font-bold text-white line-clamp-2 text-sm md:text-base leading-snug group-hover:text-[#00F5FF] transition-colors">{video.title}</h4>
                            <div>
                                <p className="text-gray-400 text-xs font-medium mt-1">{video.channelTitle}</p>
                                <p className="text-gray-500 text-xs mt-1 flex gap-3 font-bold">
                                    <span>{(video.viewCount / 1000000).toFixed(1)}M views</span>
                                    <span>{(video.likeCount / 1000).toFixed(0)}K likes</span>
                                </p>
                            </div>
                        </div>
                    </a>
                )) : (
                    <div className="p-8 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center text-gray-500 uppercase tracking-widest text-sm font-bold">Add YouTube API Key to see live trends</div>
                )}
            </div>
        </div>

        {/* Right Column: Spotify */}
        <div className="space-y-8">
            
            {/* Spotify Viral Audio */}
            <div className="bg-gradient-to-br from-[#8B5CF6]/10 to-[#00F5FF]/10 backdrop-blur-md rounded-[2rem] border border-[rgba(255,255,255,0.05)] p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-20 pointer-events-none">
                    <Music size={120} className="text-[#00F5FF]" />
                </div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}><Music className="text-[#00F5FF]"/> Viral Sounds</h3>
                    {spotifyData.mocked && <span className="text-[10px] font-bold bg-[#FF3D6E]/20 text-[#FF3D6E] px-2 py-1 rounded border border-[#FF3D6E]/30">MOCKED</span>}
                </div>
                <div className="space-y-4 relative z-10">
                    {spotifyData.items.map((track, i) => (
                        <div key={track.id} className="flex items-center gap-4 bg-black/20 p-3 rounded-2xl hover:bg-black/40 border border-white/5 transition-all">
                            <div className="w-6 text-center font-bold text-[#8B5CF6]">{i + 1}</div>
                            <img src={track.image} alt="Album Art" className="w-12 h-12 rounded-xl object-cover shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/10" />
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white truncate">{track.title}</h4>
                                <p className="text-gray-400 text-xs truncate">{track.artist}</p>
                            </div>
                            <div className="pr-3">
                                <div className="text-xs font-mono font-bold text-[#00F5FF] p-1.5 bg-[#00F5FF]/10 rounded-lg border border-[#00F5FF]/20 shadow-sm">
                                    {track.popularity}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
