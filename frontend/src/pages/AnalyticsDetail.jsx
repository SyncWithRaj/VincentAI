import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageSquare, Users, Eye, Loader2, Smile, Frown, Minus } from 'lucide-react';
import { fetchAnalyticsDetail } from '../services/analyticsApi';

const numberFormatter = new Intl.NumberFormat('en-US');

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const n = Number(value);
  if (Number.isFinite(n)) {
    return numberFormatter.format(n);
  }

  return String(value);
};

const sentimentIcon = (overall) => {
  const normalized = String(overall || '').toLowerCase();
  if (normalized === 'positive') return <Smile size={18} className="text-emerald-400" />;
  if (normalized === 'negative') return <Frown size={18} className="text-rose-400" />;
  return <Minus size={18} className="text-amber-300" />;
};

const isCorsRestrictedImageUrl = (url) => {
  try {
    if (!url) return false;
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('cdninstagram.com') || host.includes('fbcdn.net');
  } catch {
    return false;
  }
};

export default function AnalyticsDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { platform, itemId } = useParams();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);

  useEffect(() => {
    const run = async () => {
      if (!platform || !itemId) {
        setError('Missing platform or item identifier.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const params = {
          platform,
          itemId: decodeURIComponent(itemId),
          maxComments: 100,
        };

        const username = searchParams.get('username');
        const channelId = searchParams.get('channelId');

        if (username) params.username = username;
        if (channelId) params.channelId = channelId;

        const payload = await fetchAnalyticsDetail(params);
        setDetail(payload);
        setThumbnailIndex(0);
      } catch (err) {
        setError(err.message || 'Failed to load detailed analysis.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [platform, itemId, searchParams]);

  const quickItem = location.state?.item;
  const thumbnailCandidates = detail
    ? [detail.thumbnail, ...(Array.isArray(detail.thumbnailFallbacks) ? detail.thumbnailFallbacks : [])]
        .filter(Boolean)
        .filter((url) => !isCorsRestrictedImageUrl(url))
    : [];
  const activeThumbnail = thumbnailCandidates[thumbnailIndex] || null;

  return (
    <div className="min-h-screen bg-[#080808] text-[#F0F0F0] p-4 md:p-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {loading ? (
          <div className="p-10 rounded-3xl border border-white/10 bg-white/5 flex items-center justify-center gap-3 text-gray-300">
            <Loader2 size={18} className="animate-spin" />
            Loading detailed analysis...
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
            {error}
          </div>
        ) : detail ? (
          <>
            <div className="p-6 md:p-8 rounded-3xl border border-white/10 bg-white/5 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Detailed Analysis</p>
                  <h1 className="text-2xl md:text-3xl font-bold text-white mt-1" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
                    {detail.title || quickItem?.title || quickItem?.caption || 'Content Analysis'}
                  </h1>
                  <p className="text-sm text-gray-400 mt-2">
                    Platform: <span className="text-white font-medium">{detail.platform}</span>
                    {detail.publishedAt ? ` • ${new Date(detail.publishedAt).toLocaleString()}` : ''}
                  </p>
                </div>

                {activeThumbnail && (
                  <img
                    src={activeThumbnail}
                    alt="content preview"
                    className="w-24 h-24 rounded-xl object-cover border border-white/10"
                    onError={() => {
                      setThumbnailIndex((prev) => {
                        if (prev + 1 < thumbnailCandidates.length) {
                          return prev + 1;
                        }
                        return prev;
                      });
                    }}
                  />
                )}
              </div>

              {detail.permalink && (
                <a
                  href={detail.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#00F5FF] hover:underline"
                >
                  Open original post/video
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Likes</p>
                <p className="text-2xl font-bold text-white flex items-center gap-2"><Heart size={18} className="text-[#FF3D6E]" />{formatNumber(detail.metrics?.likesCount)}</p>
              </div>
              <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Comments</p>
                <p className="text-2xl font-bold text-white flex items-center gap-2"><MessageSquare size={18} className="text-[#00F5FF]" />{formatNumber(detail.metrics?.commentsCount)}</p>
              </div>
              <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Views</p>
                <p className="text-2xl font-bold text-white flex items-center gap-2"><Eye size={18} className="text-[#8B5CF6]" />{formatNumber(detail.metrics?.viewsCount)}</p>
              </div>
              <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Est. New Subscribers</p>
                <p className="text-2xl font-bold text-white flex items-center gap-2"><Users size={18} className="text-emerald-400" />{formatNumber(detail.metrics?.estimatedNewSubscribers)}</p>
              </div>
              <div className="p-5 rounded-2xl border border-white/10 bg-white/5">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Engagement Rate</p>
                <p className="text-2xl font-bold text-white">{detail.metrics?.engagementRate !== null && detail.metrics?.engagementRate !== undefined ? `${detail.metrics.engagementRate}%` : '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="p-6 rounded-3xl border border-white/10 bg-white/5 space-y-4">
                <div className="flex items-center gap-2">
                  {sentimentIcon(detail.sentiment?.overall)}
                  <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
                    Audience Sentiment
                  </h2>
                </div>

                <div className="flex items-end gap-3">
                  <p className="text-4xl font-black text-[#00F5FF]">{formatNumber(detail.sentiment?.score)}</p>
                  <p className="text-sm uppercase tracking-widest text-gray-400 pb-1">/ 100</p>
                </div>

                <p className="text-sm text-gray-300">
                  Overall: <span className="font-semibold text-white capitalize">{detail.sentiment?.overall || 'neutral'}</span>
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-300"><span>Positive</span><span>{formatNumber(detail.sentiment?.breakdown?.positive)}%</span></div>
                  <div className="flex justify-between text-gray-300"><span>Neutral</span><span>{formatNumber(detail.sentiment?.breakdown?.neutral)}%</span></div>
                  <div className="flex justify-between text-gray-300"><span>Negative</span><span>{formatNumber(detail.sentiment?.breakdown?.negative)}%</span></div>
                </div>

                <p className="text-sm text-gray-400">{detail.sentiment?.summary}</p>
              </section>

              <section className="p-6 rounded-3xl border border-white/10 bg-white/5 space-y-4">
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
                  Comment Sample
                </h2>

                {Array.isArray(detail.comments) && detail.comments.length > 0 ? (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {detail.comments.slice(0, 5).map((comment, index) => (
                      <div key={`c-${index}`} className="p-3 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-300 leading-relaxed">
                        "{comment}"
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No comments available for this content.</p>
                )}
              </section>
            </div>

            {Array.isArray(detail.notes) && detail.notes.length > 0 && (
              <section className="p-5 rounded-2xl border border-white/10 bg-white/5">
                <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-2">Notes</h3>
                <div className="space-y-1">
                  {detail.notes.map((note) => (
                    <p key={note} className="text-sm text-gray-300">{note}</p>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
