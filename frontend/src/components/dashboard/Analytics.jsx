import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Camera,
  Eye,
  RefreshCw,
  Users,
  Video,
  MessageSquare,
  Award,
  Briefcase
} from 'lucide-react';
import {
  fetchInstagramAnalytics,
  fetchYouTubeAnalytics,
  fetchTwitterAnalytics,
  fetchLinkedinAnalytics
} from '../../services/analyticsApi';

import instagramLogo from '../../assets/instagram.jpg';
import youtubeLogo from '../../assets/youtube.jpg';
import twitterLogo from '../../assets/twitter.png';
import linkedinLogo from '../../assets/linkdin.png';

const numberFormatter = new Intl.NumberFormat('en-US');

const formatNumber = (value) => {
  if (typeof value !== 'number') {
    return value || '-';
  }
  return numberFormatter.format(value);
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

export default function Analytics() {
  const navigate = useNavigate();
  const [activePlatform, setActivePlatform] = useState('instagram');
  const [filters, setFilters] = useState({
    instagram: { username: '', mediaLimit: 10 },
    youtube: { channelId: '', maxResults: 8 },
    twitter: { username: '', maxResults: 5 },
    linkedin: { profileUrl: '', maxResults: 5 }
  });
  const [dataMap, setDataMap] = useState({ instagram: null, youtube: null, twitter: null, linkedin: null });
  const [loadingMap, setLoadingMap] = useState({ instagram: false, youtube: false, twitter: false, linkedin: false });
  const [errorMap, setErrorMap] = useState({ instagram: '', youtube: '', twitter: '', linkedin: '' });

  const loadPlatformData = async (platform) => {
    setLoadingMap((prev) => ({ ...prev, [platform]: true }));
    setErrorMap((prev) => ({ ...prev, [platform]: '' }));

    try {
      if (platform === 'instagram') {
        const payload = await fetchInstagramAnalytics(filters.instagram);
        setDataMap((prev) => ({ ...prev, instagram: payload }));
      } else if (platform === 'youtube') {
        const payload = await fetchYouTubeAnalytics(filters.youtube);
        setDataMap((prev) => ({ ...prev, youtube: payload }));
      } else if (platform === 'twitter') {
        const payload = await fetchTwitterAnalytics(filters.twitter);
        setDataMap((prev) => ({ ...prev, twitter: payload }));
      } else if (platform === 'linkedin') {
        const payload = await fetchLinkedinAnalytics(filters.linkedin);
        setDataMap((prev) => ({ ...prev, linkedin: payload }));
      }
    } catch (error) {
      setErrorMap((prev) => ({
        ...prev,
        [platform]: error.message || 'Failed to fetch analytics data.'
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [platform]: false }));
    }
  };

  useEffect(() => {
    loadPlatformData('instagram');
  }, []);

  useEffect(() => {
    if (!dataMap[activePlatform] && !loadingMap[activePlatform]) {
      loadPlatformData(activePlatform);
    }
  }, [activePlatform]);

  const activeData = dataMap[activePlatform];
  const activeError = errorMap[activePlatform];
  const isLoading = loadingMap[activePlatform];

  const stats = useMemo(() => {
    if (!activeData?.metrics) {
      return [];
    }

    if (activePlatform === 'instagram') {
      return [
        {
          title: 'Followers',
          value: formatNumber(activeData.metrics.followersCount),
          icon: Users,
          color: 'text-[#FF3D6E]',
          bg: 'bg-[#FF3D6E]/10',
          border: 'border-[#FF3D6E]/20'
        },
        {
          title: 'Reach',
          value: formatNumber(activeData.metrics.reach),
          icon: Activity,
          color: 'text-[#00F5FF]',
          bg: 'bg-[#00F5FF]/10',
          border: 'border-[#00F5FF]/20'
        },
        {
          title: 'Impressions',
          value: formatNumber(activeData.metrics.impressions),
          icon: Eye,
          color: 'text-[#8B5CF6]',
          bg: 'bg-[#8B5CF6]/10',
          border: 'border-[#8B5CF6]/20'
        },
        {
          title: 'Reels Uploaded',
          value: formatNumber(activeData.metrics.reelsUploaded),
          icon: Video,
          color: 'text-[#00F5FF]',
          bg: 'bg-[#00F5FF]/10',
          border: 'border-[#00F5FF]/20'
        }
      ];
    }

    if (activePlatform === 'youtube') {
      return [
        {
          title: 'Subscribers',
          value: formatNumber(activeData.metrics.subscribersCount),
          icon: Users,
          color: 'text-[#FF3D6E]',
          bg: 'bg-[#FF3D6E]/10',
          border: 'border-[#FF3D6E]/20'
        },
        {
          title: 'Estimated Reach',
          value: formatNumber(activeData.metrics.estimatedReach),
          icon: Activity,
          color: 'text-[#00F5FF]',
          bg: 'bg-[#00F5FF]/10',
          border: 'border-[#00F5FF]/20'
        },
        {
          title: 'Estimated Impressions',
          value: formatNumber(activeData.metrics.estimatedImpressions),
          icon: Eye,
          color: 'text-[#8B5CF6]',
          bg: 'bg-[#8B5CF6]/10',
          border: 'border-[#8B5CF6]/20'
        },
        {
          title: 'Videos Uploaded',
          value: formatNumber(activeData.metrics.videosUploaded),
          icon: Video,
          color: 'text-[#FF3D6E]',
          bg: 'bg-[#FF3D6E]/10',
          border: 'border-[#FF3D6E]/20'
        }
      ];
    }

    if (activePlatform === 'twitter') {
      return [
        {
          title: 'Followers',
          value: formatNumber(activeData.metrics.followersCount),
          icon: Users,
          color: 'text-[#00F5FF]',
          bg: 'bg-[#00F5FF]/10',
          border: 'border-[#00F5FF]/20'
        },
        {
          title: 'Following',
          value: formatNumber(activeData.metrics.followingCount),
          icon: Activity,
          color: 'text-[#8B5CF6]',
          bg: 'bg-[#8B5CF6]/10',
          border: 'border-[#8B5CF6]/20'
        },
        {
          title: 'Total Tweets',
          value: formatNumber(activeData.metrics.tweetCount),
          icon: MessageSquare,
          color: 'text-[#FF3D6E]',
          bg: 'bg-[#FF3D6E]/10',
          border: 'border-[#FF3D6E]/20'
        },
        {
          title: 'Listed Count',
          value: formatNumber(activeData.metrics.listedCount),
          icon: Eye,
          color: 'text-[#00F5FF]',
          bg: 'bg-[#00F5FF]/10',
          border: 'border-[#00F5FF]/20'
        }
      ];
    }

    return [
      {
        title: 'Connections',
        value: formatNumber(activeData.metrics.connectionsCount),
        icon: Users,
        color: 'text-[#0a66c2]', // LinkedIn Blue
        bg: 'bg-[#0a66c2]/10',
        border: 'border-[#0a66c2]/20'
      },
      {
        title: 'Followers',
        value: formatNumber(activeData.metrics.followersCount),
        icon: Activity,
        color: 'text-[#00F5FF]',
        bg: 'bg-[#00F5FF]/10',
        border: 'border-[#00F5FF]/20'
      },
      {
        title: 'Certifications',
        value: formatNumber(activeData.metrics.certificationsCount),
        icon: Award,
        color: 'text-[#8B5CF6]',
        bg: 'bg-[#8B5CF6]/10',
        border: 'border-[#8B5CF6]/20'
      },
      {
        title: 'Experiences',
        value: formatNumber(activeData.metrics.experiencesCount),
        icon: Briefcase,
        color: 'text-[#FF3D6E]',
        bg: 'bg-[#FF3D6E]/10',
        border: 'border-[#FF3D6E]/20'
      }
    ];
  }, [activeData, activePlatform]);

  const onFilterChange = (platform, key, value) => {
    setFilters((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [key]: value
      }
    }));
  };

  const onFetchSubmit = (event) => {
    event.preventDefault();
    loadPlatformData(activePlatform);
  };

  const openDetailPage = (item) => {
    if (!(activePlatform === 'instagram' || activePlatform === 'youtube')) {
      return;
    }

    const itemId = item?.id || item?.videoId;
    if (!itemId) {
      return;
    }

    const search = new URLSearchParams();
    if (activePlatform === 'instagram' && filters.instagram.username) {
      search.set('username', filters.instagram.username);
    }
    if (activePlatform === 'youtube' && filters.youtube.channelId) {
      search.set('channelId', filters.youtube.channelId);
    }

    const suffix = search.toString() ? `?${search.toString()}` : '';
    navigate(`/dashboard/analytics/${activePlatform}/${encodeURIComponent(String(itemId))}${suffix}`, {
      state: { item },
    });
  };

  return (
    <div className="space-y-6 text-[#F0F0F0]">
      <div className="p-2 rounded-2xl bg-white/5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-md inline-flex gap-2">
        {[
          { id: 'instagram', label: 'Instagram', img: instagramLogo },
          { id: 'youtube', label: 'YouTube', img: youtubeLogo },
          { id: 'twitter', label: 'X (Twitter)', img: twitterLogo },
          { id: 'linkedin', label: 'LinkedIn', img: linkedinLogo }
        ].map((platform) => {
          const Icon = platform.icon;
          const isActive = activePlatform === platform.id;

          let glowColor = 'rgba(255,61,110,0.1)';
          let activeBorder = 'border-[#FF3D6E]/20';
          let activeText = 'text-[#FF3D6E]';
          let activeBg = 'bg-[#FF3D6E]/10';

          if (platform.id === 'youtube') {
            glowColor = 'rgba(0,245,255,0.1)';
            activeBorder = 'border-[#00F5FF]/20';
            activeText = 'text-[#00F5FF]';
            activeBg = 'bg-[#00F5FF]/10';
          } else if (platform.id === 'twitter') {
            glowColor = 'rgba(139,92,246,0.1)';
            activeBorder = 'border-[#8B5CF6]/20';
            activeText = 'text-[#8B5CF6]';
            activeBg = 'bg-[#8B5CF6]/10';
          } else if (platform.id === 'linkedin') {
            glowColor = 'rgba(10,102,194,0.1)';
            activeBorder = 'border-[#0a66c2]/20';
            activeText = 'text-[#0a66c2]';
            activeBg = 'bg-[#0a66c2]/10';
          }

          return (
            <button
              key={platform.id}
              onClick={() => setActivePlatform(platform.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${isActive
                  ? `${activeBg} text-white border ${activeBorder} shadow-[0_0_16px_${glowColor}]`
                  : 'text-gray-400 hover:bg-white/5 border border-transparent hover:border-white/10'
                }`}
            >
              <div className={`w-[20px] h-[20px] rounded-[5px] flex items-center justify-center overflow-hidden shadow-sm ${!isActive ? 'opacity-75 grayscale-[30%]' : ''}`}>
                <img src={platform.img} alt={platform.label} className="w-full h-full object-cover" />
              </div>
              <span>{platform.label}</span>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={onFetchSubmit}
        className="p-5 rounded-3xl bg-white/5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] backdrop-blur-md"
      >
        {activePlatform === 'instagram' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Instagram Username</span>
              <input
                type="text"
                value={filters.instagram.username}
                onChange={(event) => onFilterChange('instagram', 'username', event.target.value)}
                placeholder="Optional if set in backend .env"
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF3D6E]/50 focus:border-[#FF3D6E]/50 transition-colors placeholder-gray-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Media Limit</span>
              <input
                type="number"
                min="1"
                max="25"
                value={filters.instagram.mediaLimit}
                onChange={(event) => onFilterChange('instagram', 'mediaLimit', event.target.value)}
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF3D6E]/50 focus:border-[#FF3D6E]/50 transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="h-[42px] rounded-xl bg-[#FF3D6E]/20 text-[#FF3D6E] border border-[#FF3D6E]/30 font-medium hover:bg-[#FF3D6E]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(255,61,110,0.2)]"
            >
              {isLoading ? 'Fetching...' : 'Fetch Instagram Data'}
            </button>
          </div>
        ) : activePlatform === 'youtube' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">YouTube Channel ID</span>
              <input
                type="text"
                value={filters.youtube.channelId}
                onChange={(event) => onFilterChange('youtube', 'channelId', event.target.value)}
                placeholder="Optional if set in backend .env"
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00F5FF]/50 focus:border-[#00F5FF]/50 transition-colors placeholder-gray-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Recent Videos Count</span>
              <input
                type="number"
                min="1"
                max="20"
                value={filters.youtube.maxResults}
                onChange={(event) => onFilterChange('youtube', 'maxResults', event.target.value)}
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00F5FF]/50 focus:border-[#00F5FF]/50 transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="h-[42px] rounded-xl bg-[#00F5FF]/20 text-[#00F5FF] border border-[#00F5FF]/30 font-medium hover:bg-[#00F5FF]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(0,245,255,0.2)]"
            >
              {isLoading ? 'Fetching...' : 'Fetch YouTube Data'}
            </button>
          </div>
        ) : activePlatform === 'twitter' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Twitter Username</span>
              <input
                type="text"
                value={filters.twitter.username}
                onChange={(event) => onFilterChange('twitter', 'username', event.target.value)}
                placeholder="Optional if set in backend .env"
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]/50 transition-colors placeholder-gray-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Recent Tweets Count</span>
              <input
                type="number"
                min="5"
                max="100"
                value={filters.twitter.maxResults}
                onChange={(event) => onFilterChange('twitter', 'maxResults', event.target.value)}
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]/50 transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="h-[42px] rounded-xl bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30 font-medium hover:bg-[#8B5CF6]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(139,92,246,0.2)]"
            >
              {isLoading ? 'Fetching...' : 'Fetch Twitter Data'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">LinkedIn Profile URL</span>
              <input
                type="text"
                value={filters.linkedin.profileUrl}
                onChange={(event) => onFilterChange('linkedin', 'profileUrl', event.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50 focus:border-[#0a66c2]/50 transition-colors placeholder-gray-600"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Recent Posts Count</span>
              <input
                type="number"
                min="1"
                max="50"
                value={filters.linkedin.maxResults}
                onChange={(event) => onFilterChange('linkedin', 'maxResults', event.target.value)}
                className="mt-2 w-full rounded-xl bg-[#080808]/50 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50 focus:border-[#0a66c2]/50 transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="h-[42px] rounded-xl bg-[#0a66c2]/20 text-[#0a66c2] border border-[#0a66c2]/30 font-medium hover:bg-[#0a66c2]/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_16px_rgba(10,102,194,0.2)]"
            >
              {isLoading ? 'Fetching...' : 'Fetch LinkedIn Data'}
            </button>
          </div>
        )}
      </form>

      {activeError && (
        <div className="p-4 rounded-2xl border border-[#FF3D6E]/30 bg-[#FF3D6E]/10 text-[#FF3D6E] flex items-start gap-3 backdrop-blur-md">
          <AlertCircle size={18} className="mt-0.5" />
          <p className="text-sm">{activeError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] flex items-center justify-center gap-3 text-gray-400 backdrop-blur-md">
          <RefreshCw size={18} className="animate-spin text-[#FF3D6E]" />
          <span>Pulling latest {activePlatform} analytics...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((stat) => (
              <div
                key={stat.title}
                className="p-6 rounded-3xl bg-white/5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 backdrop-blur-md"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-3.5 rounded-2xl ${stat.bg} border ${stat.border}`}>
                    <stat.icon size={22} className={stat.color} />
                  </div>
                </div>
                <p className="text-gray-400 text-sm font-medium mb-1">{stat.title}</p>
                <h3 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>{stat.value}</h3>
              </div>
            ))}
          </div>

          <div className="p-6 md:p-8 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/10 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FF3D6E]/10 blur-[100px] rounded-full" />

            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-2xl text-white font-bold" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
                    {activePlatform === 'instagram' ? 'Instagram' : activePlatform === 'youtube' ? 'YouTube' : activePlatform === 'twitter' ? 'X (Twitter)' : 'LinkedIn'} Feed Snapshot
                  </h3>
                  <p className="text-gray-400 mt-1 text-sm">
                    Showing latest {activeData?.items?.length || 0} records from your connected account.
                  </p>
                </div>
                <div className="text-sm text-gray-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md">
                  Account: <span className="font-medium text-white">{activeData?.account?.username || activeData?.account?.title || '-'}</span>
                </div>
              </div>

              {Array.isArray(activeData?.notes) && activeData.notes.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-300 backdrop-blur-md">
                  {activeData.notes.map((note) => (
                    <p key={note} className="text-sm">{note}</p>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {(activeData?.items || []).length > 0 ? (
                  (activeData?.items || []).map((item) => (
                    (() => {
                      const previewUrl = item.thumbnail || item.thumbnail_url || item.media_url;
                      const canRenderPreview = Boolean(previewUrl) && !isCorsRestrictedImageUrl(previewUrl);

                      return (
                        <article
                          key={item.id || item.videoId}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)] flex items-center justify-between gap-3 hover:bg-white/10 transition-colors backdrop-blur-md"
                        >
                          <div className="min-w-0 flex-1">
                            {(activePlatform === 'instagram' || activePlatform === 'youtube') ? (
                              <button
                                type="button"
                                onClick={() => openDetailPage(item)}
                                className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white text-left hover:text-[#00F5FF] transition-colors underline-offset-4 hover:underline"
                                title="Open detailed analysis"
                              >
                                {item.title || item.caption || 'Untitled'}
                              </button>
                            ) : (
                              <p className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-white">
                                {item.title || item.caption || 'Untitled'}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">
                              {item.media_type || 'VIDEO'}
                              {item.publishedAt || item.timestamp
                                ? ` • ${new Date(item.publishedAt || item.timestamp).toLocaleDateString()}`
                                : ''}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {canRenderPreview ? (
                              <img
                                src={previewUrl}
                                alt="media preview"
                                className="w-16 h-16 rounded-xl object-cover border border-white/10"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <div className="w-[30px] h-[30px] rounded-lg overflow-hidden opacity-50 grayscale border border-white/10 shadow-sm">
                                  <img 
                                    src={
                                      activePlatform === 'instagram' ? instagramLogo :
                                      activePlatform === 'youtube' ? youtubeLogo :
                                      activePlatform === 'twitter' ? twitterLogo :
                                      linkedinLogo
                                    } 
                                    alt={activePlatform}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })()
                  ))
                ) : (
                  <div className="p-8 rounded-2xl border border-white/10 bg-white/5 text-center text-gray-500 backdrop-blur-md">
                    No items available yet. Fetch analytics to load media details.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
