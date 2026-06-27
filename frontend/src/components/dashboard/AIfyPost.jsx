import React, { useMemo, useState } from 'react';
import { Search, Sparkles, AlertCircle, Video, CheckCircle2, Play, Activity, Heart, MessageCircle, TrendingUp, ExternalLink } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const viralityKeywords = [
  'new', 'secret', 'proven', 'viral', 'trend', 'ai', 'launch', 'breakthrough', 'insane', 'must',
  'discover', 'boost', 'strategy', 'growth', 'creator', 'exclusive', 'free', 'today', 'now', 'ultimate'
];

const ctaKeywords = ['comment', 'share', 'save', 'follow', 'click', 'try', 'watch', 'join', 'dm'];

const countRegexMatches = (text, regex) => {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
};

const computeViralityScore = ({ text, likes, comments }) => {
  const content = String(text || '').trim();
  const lowered = content.toLowerCase();

  const likesCount = normalizeNumber(likes);
  const commentsCount = normalizeNumber(comments);

  const contentLength = content.length;
  const hashtagsCount = countRegexMatches(content, /#[\w]+/g);
  const emojiCount = countRegexMatches(content, /[\u{1F300}-\u{1FAFF}]/gu);

  const keywordHits = viralityKeywords.reduce((acc, term) => acc + (lowered.includes(term) ? 1 : 0), 0);
  const ctaHits = ctaKeywords.reduce((acc, term) => acc + (lowered.includes(term) ? 1 : 0), 0);

  // Strong hook formats like numbers + promise tend to perform better.
  const hookPatternHits = countRegexMatches(lowered, /\b\d+\s*(ways?|tips?|steps?|reasons?)\b/g);

  const lengthScore = contentLength > 0
    ? clamp(16 - Math.round(Math.abs(contentLength - 180) / 14), 0, 16)
    : 0;
  const keywordScore = clamp(keywordHits * 2, 0, 14);
  const ctaScore = clamp(ctaHits * 4, 0, 12);
  const hashtagScore = clamp(hashtagsCount * 2, 0, 8);
  const emojiScore = clamp(Math.round(emojiCount * 1.5), 0, 6);
  const hookScore = clamp(hookPatternHits * 4, 0, 9);

  const textScore = lengthScore + keywordScore + ctaScore + hashtagScore + emojiScore + hookScore;

  // Engagement component (comments weighted more because they signal deeper interaction).
  const weightedEngagement = likesCount + commentsCount * 3;
  const engagementScore = clamp(Math.round(Math.log10(weightedEngagement + 1) * 16), 0, 45);

  const total = clamp(Math.round(10 + textScore + engagementScore), 0, 100);
  return total;
};

const polarToCartesian = (cx, cy, radius, angle) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
};

const describeArc = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

const ViralitySpeedometer = ({ value, label, colorClass }) => {
  const safeValue = clamp(normalizeNumber(value), 0, 100);
  const startAngle = -120;
  const endAngle = 120;
  const needleAngle = startAngle + ((endAngle - startAngle) * safeValue) / 100;
  const progressArc = describeArc(70, 70, 50, startAngle, needleAngle);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${colorClass}`}>{label}</p>
      <svg viewBox="0 0 140 95" className="w-full h-24">
        {/* Gauge zones */}
        <path d={describeArc(70, 70, 50, -120, -40)} stroke="#ef4444" strokeOpacity="0.35" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={describeArc(70, 70, 50, -40, 40)} stroke="#f59e0b" strokeOpacity="0.35" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={describeArc(70, 70, 50, 40, 120)} stroke="#22c55e" strokeOpacity="0.35" strokeWidth="10" fill="none" strokeLinecap="round" />

        {/* Active arc */}
        <path d={progressArc} stroke="currentColor" className={colorClass} strokeWidth="8" fill="none" strokeLinecap="round" />

        {/* Needle */}
        <line
          x1="70"
          y1="70"
          x2={polarToCartesian(70, 70, 38, needleAngle).x}
          y2={polarToCartesian(70, 70, 38, needleAngle).y}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="70" cy="70" r="4.5" fill="white" />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider px-1">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  );
};

export default function AIfyPost() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const viralityScores = useMemo(() => {
    if (!result) {
      return { before: 0, after: 0, lift: 0 };
    }

    const before = computeViralityScore({
      text: result.original_text,
      likes: result.original_likes,
      comments: result.original_comments,
    });

    const after = computeViralityScore({
      text: result.enhanced_text,
      likes: result.projected_likes,
      comments: result.projected_comments,
    });

    return {
      before,
      after,
      lift: Math.max(0, after - before),
    };
  }, [result]);

  const handleAnalyze = async () => {
    if (!url) return;
    try {
      setLoading(true);
      setResult(null);
      const res = await fetch('http://localhost:4000/api/agents/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Decide what to render in the video slot
  const renderVideoAsset = () => {
    if (!result) return null;

    // Twitter/X: Use oEmbed HTML — shows the real tweet with any embedded video/GIF
    if (result.oembed_html) {
      const tweetPage = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; display: flex; justify-content: center; padding: 12px; }
  .twitter-tweet { margin: 0 auto !important; }
</style>
</head>
<body>
${result.oembed_html}
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</body>
</html>`;
      return (
        <div className="mt-6 rounded-2xl overflow-hidden border border-white/10 shadow-inner bg-black" style={{ minHeight: '280px' }}>
          <iframe
            srcDoc={tweetPage}
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="w-full"
            style={{ minHeight: '280px', border: 'none' }}
            title="Embedded Tweet"
          />
        </div>
      );
    }

    // YouTube: embed via iframe
    if (result.video_embed_url) {
      return (
        <div className="mt-6 aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-inner">
          <iframe
            src={result.video_embed_url}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
      );
    }

    // Twitter/Instagram: direct video URL
    if (result.video_url) {
      return (
        <div className="mt-6 aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-inner bg-[#080808]">
          <video
            src={result.video_url}
            controls
            className="w-full h-full object-contain"
            poster={result.thumbnail_url || undefined}
          />
        </div>
      );
    }

    // Only thumbnail available (image post or no video)
    if (result.thumbnail_url) {
      return (
        <div className="mt-6 aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-inner bg-[#080808] relative">
          <img
            src={result.thumbnail_url}
            alt="Post thumbnail"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur text-[10px] text-gray-300 px-2 py-1 rounded-lg border border-white/10">
            Post Preview
          </div>
        </div>
      );
    }

    // Fallback: placeholder
    return (
      <div className="mt-6 aspect-video bg-[#080808] border border-white/10 rounded-2xl relative overflow-hidden flex items-center justify-center shadow-inner">
        <Video className="text-white/20" size={64} />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <Play className="text-[#FF3D6E] fill-[#FF3D6E] mb-2 shadow-[0_0_16px_rgba(255,61,110,0.5)]" size={32} />
          <p className="text-white/90 text-sm font-semibold">No embed available</p>
        </div>
      </div>
    );
  };

  // Render frame cards — use real frame_thumbnails when available
  const renderFrameCard = (frame, i) => {
    const realThumb = result.frame_thumbnails && result.frame_thumbnails[i];
    const gradients = [
      'from-[#8B5CF6]/40 via-[#1a0f2e] to-[#080808]',
      'from-[#FF3D6E]/40 via-[#1a0808] to-[#080808]',
      'from-[#00F5FF]/25 via-[#00141a] to-[#080808]',
    ];
    const grad = gradients[i % gradients.length];

    return (
      <div key={i} className="rounded-2xl overflow-hidden border border-white/10 shadow-lg group hover:border-white/20 transition-all">
        {/* Frame thumbnail – real image or gradient fallback */}
        <div className={`relative h-36 overflow-hidden ${realThumb ? 'bg-[#080808]' : `bg-gradient-to-br ${grad}`} flex items-center justify-center`}>
          {realThumb ? (
            <img
              src={realThumb}
              alt={`Frame at ${frame.timestamp}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <>
              {/* Scanlines on gradient fallback */}
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)' }}></div>
              <span className="font-mono font-black text-5xl text-white/10 select-none">{frame.timestamp}</span>
            </>
          )}
          {/* Semi-transparent overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none"></div>
          {/* Frame label */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/10 z-10">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF3D6E] animate-pulse"></div>
            <span className="text-white text-[10px] font-bold uppercase tracking-widest">Frame {i + 1}</span>
          </div>
          {/* Timestamp badge */}
          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-[#00F5FF] font-mono font-bold text-xs px-2.5 py-1.5 rounded-lg border border-[#00F5FF]/30 shadow-[0_0_8px_rgba(0,245,255,0.3)] z-10">
            ⏱ {frame.timestamp}
          </div>
        </div>
        {/* Analysis body */}
        <div className="p-4 bg-[#080808]/60 backdrop-blur-md">
          <p className="text-sm font-bold text-white mb-1.5 flex items-center gap-1.5">
            <AlertCircle size={13} className="text-[#FF3D6E] shrink-0"/> {frame.issue}
          </p>
          <p className="text-sm text-gray-400 italic leading-relaxed">"{frame.tip}"</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20 text-[#F0F0F0]">
      <div className="max-w-3xl">
        <h2 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3 tracking-tight" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
           <Sparkles size={36} className="text-[#8B5CF6]" /> AIfy Post Analyzer
        </h2>
        <p className="text-gray-400 mt-2 text-lg">Paste a link from Instagram, LinkedIn, X, or YouTube. We'll extract your post, rewrite it for virality, and analyze your video frame-by-frame.</p>
      </div>

      <div className="bg-white/5 p-4 md:p-6 rounded-[2rem] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] backdrop-blur-md flex flex-col md:flex-row gap-4 items-center">
         <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/p/..."
              className="w-full bg-[#080808]/50 border border-white/10 outline-none pl-12 pr-4 py-4 rounded-xl text-white font-medium placeholder:text-gray-600 focus:ring-2 focus:ring-[#8B5CF6]/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
         </div>
         <button
           onClick={handleAnalyze}
           disabled={loading || !url}
           className="w-full md:w-auto bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/40 text-[#8B5CF6] px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 shadow-[0_0_16px_rgba(139,92,246,0.2)]"
         >
           {loading ? <Activity className="animate-spin" size={20} /> : "Run Deep Analysis"}
         </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-white/10 bg-white/5 backdrop-blur-md rounded-[2rem] text-gray-400">
           <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-[#8B5CF6]/20 rounded-full animate-ping opacity-75"></div>
              <div className="absolute inset-0 border-4 border-[#8B5CF6] rounded-full border-t-transparent animate-spin shadow-[0_0_16px_rgba(139,92,246,0.6)]"></div>
           </div>
           <p className="text-lg font-medium animate-pulse text-[#8B5CF6]">Scraping social link & running AI models...</p>
           <p className="text-sm mt-2 text-gray-500 text-center">This dynamically connects to Apify and queries Llama3 via Groq.</p>
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

           {/* LEFT: ORIGINAL DATA */}
           <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-md p-6 rounded-[2rem] border border-white/10 flex flex-col shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
                 {/* Header row: title + metrics */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       Original Scraped Content
                       <span className="bg-white/10 text-gray-300 px-2 py-0.5 rounded text-[10px] border border-white/10">{result.platform}</span>
                    </h3>
                 </div>

                <div className="mt-4 mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Virality Score</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <ViralitySpeedometer value={viralityScores.before} label="Before (Scraped)" colorClass="text-[#FF3D6E]" />
                   <ViralitySpeedometer value={viralityScores.after} label="After (AIfied)" colorClass="text-[#8B5CF6]" />
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00F5FF] bg-[#00F5FF]/10 border border-[#00F5FF]/25 px-3 py-1.5 rounded-lg">
                   <TrendingUp size={12} />
                   Lift {viralityScores.lift > 0 ? `+${viralityScores.lift}` : 'No change'}
                  </div>
                </div>

                <div className="flex gap-2 text-gray-400 font-bold mb-4">
                  <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg text-sm border border-white/5">
                    <Heart size={13} className="text-[#FF3D6E] fill-[#FF3D6E]/20"/> {result.original_likes?.toLocaleString() || 0}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg text-sm border border-white/5">
                    <MessageCircle size={13} className="text-[#00F5FF] fill-[#00F5FF]/20"/> {result.original_comments?.toLocaleString() || 0}
                  </span>
                 </div>

                 <p className="text-white text-base whitespace-pre-wrap leading-relaxed">{result.original_text}</p>

                 {result.scrape_error && (
                    <div className="mt-4 bg-[#FF3D6E]/10 text-[#FF3D6E] p-3 rounded-xl border border-[#FF3D6E]/20 text-sm">
                       <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle size={14}/> Live Apify Scrape Failed (Fired Clean Mock)</p>
                       <p className="font-mono text-xs break-all">{result.scrape_error}</p>
                    </div>
                 )}

                 {/* Dynamic video asset */}
                 {renderVideoAsset()}
              </div>
           </div>

           {/* RIGHT: AIFIED RESULTS */}
           <div className="space-y-6">
              <div className="bg-gradient-to-br from-[#8B5CF6]/20 to-[#FF3D6E]/20 border border-[rgba(255,255,255,0.08)] backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-[0_0_40px_rgba(139,92,246,0.15)] text-white relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                    <Sparkles size={120} className="text-[#8B5CF6]" />
                 </div>
                 <h3 className="text-sm font-bold text-[#8B5CF6] uppercase tracking-widest mb-4 flex items-center justify-between relative z-10 w-full drop-shadow-md">
                    <span className="flex items-center gap-2">AIfied Replacement</span>
                    <div className="flex gap-3 text-white font-bold bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs md:text-sm border border-white/10">
                       <span className="flex items-center gap-1 text-[#00F5FF]"><TrendingUp size={14} className="mr-1 shadow-sm"/></span>
                       <span className="flex items-center gap-1 text-[#FF3D6E]"><Heart size={14} className="fill-[#FF3D6E]/30"/> {result.projected_likes?.toLocaleString() || 0}</span>
                       <span className="flex items-center gap-1 text-[#00F5FF]"><MessageCircle size={14} className="fill-[#00F5FF]/30"/> {result.projected_comments?.toLocaleString() || 0}</span>
                    </div>
                 </h3>
                 <p className="text-white text-lg md:text-xl font-medium leading-relaxed whitespace-pre-wrap relative z-10">
                    {result.enhanced_text}
                 </p>
                 <button
                   onClick={() => navigator.clipboard.writeText(result.enhanced_text)}
                   className="mt-6 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 relative z-10 shadow-sm"
                 >
                    <CheckCircle2 size={16} className="text-[#00F5FF]" /> Copy to Clipboard
                 </button>
              </div>

              {/* FRAME ANALYSIS */}
              <div className="bg-white/5 backdrop-blur-md p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
                 <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
                    <Video className="text-[#FF3D6E]" /> Frame-by-Frame Retention Analysis
                 </h3>
                 {result.frame_thumbnails && result.frame_thumbnails.length > 0 ? (
                   <p className="text-xs text-gray-500 mb-5 uppercase tracking-widest">Real frames extracted from source video</p>
                 ) : (
                   <p className="text-xs text-gray-500 mb-5 uppercase tracking-widest">AI-simulated retention markers</p>
                 )}

                 <div className="grid grid-cols-1 gap-4">
                    {result.video_analysis && result.video_analysis.map((frame, i) => renderFrameCard(frame, i))}
                 </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
}
