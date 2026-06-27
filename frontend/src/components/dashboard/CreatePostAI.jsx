import React, { useState, useRef, useEffect } from 'react';
import { PenTool, Target, Zap, Loader2, CheckCircle, ArrowRight, Volume2, Video, Hash, Copy, Camera, Building2, Bird, ThumbsUp, Send, Link2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_BASE = 'http://localhost:4000/api';
const SOCIAL_PLATFORMS = [
    { id: 'instagram', label: 'Instagram', icon: Camera, accent: 'text-pink-300 border-pink-400/30 bg-pink-500/10' },
    { id: 'linkedin', label: 'LinkedIn', icon: Building2, accent: 'text-sky-300 border-sky-400/30 bg-sky-500/10' },
    { id: 'twitter', label: 'X / Twitter', icon: Bird, accent: 'text-gray-200 border-gray-300/30 bg-gray-500/10' },
    { id: 'facebook', label: 'Facebook', icon: ThumbsUp, accent: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10' },
];

const AGENT_STEPS = [
    { id: 'starting', label: 'Preparing Workspace', description: 'Setting up your creative session...' },
    { id: 'onboarding', label: 'Understanding Brand', description: 'Learning your offer and tone...' },
    { id: 'research', label: 'Reading Signals', description: 'Collecting what your audience cares about...' },
    { id: 'strategist', label: 'Shaping Direction', description: 'Building the best angle for this post...' },
    { id: 'copywriter', label: 'Writing Draft', description: 'Crafting clear, high-impact copy...' },
];

const VIDEO_PHASES = [
    { text: 'Preparing your audio for the avatar...', progress: 12 },
    { text: 'Syncing voice and on-screen delivery...', progress: 28 },
    { text: 'Applying expressions and pacing...', progress: 46 },
    { text: 'Composing visuals and scene style...', progress: 66 },
    { text: 'Final quality pass and export...', progress: 86 },
];

const AVATAR_OPTIONS = [
    { id: 'avatar_1', label: 'Avatar 1', src: '/avatar_1.png' },
    { id: 'avatar_2', label: 'Avatar 2', src: '/avatar_2.png' },
    { id: 'avatar_3', label: 'Avatar 3', src: '/avatar_3.png' },
    { id: 'avatar_4', label: 'Avatar 4', src: '/avatar_4.png' },
    { id: 'avatar_5', label: 'Avatar 5', src: '/avatar_5.png' },
];

const RESEARCH_FALLBACK_MESSAGE = 'Live web research is currently unavailable, so this draft was generated from your business context and goal.';

const sanitizeResearchData = (rawResearch) => {
    if (!rawResearch || typeof rawResearch !== 'string') return rawResearch;
    const normalized = rawResearch.trim();
    if (!normalized) return '';

    if (/unauthorized|missing or invalid api key|could not fetch live research/i.test(normalized)) {
        return RESEARCH_FALLBACK_MESSAGE;
    }

    return rawResearch;
};

export default function CreatePostAI() {
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStep, setAgentStep] = useState(null);
  const [agentState, setAgentState] = useState({});
  const [error, setError] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isVideoFinished, setIsVideoFinished] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);
    const [videoPhase, setVideoPhase] = useState('');
    const [videoTimeline, setVideoTimeline] = useState([]);
  const [editableDraft, setEditableDraft] = useState('');
  const [copied, setCopied] = useState(false);
    const [publishOptions, setPublishOptions] = useState(null);
    const [publishMethod, setPublishMethod] = useState('raw_api');
    const [publishingPlatform, setPublishingPlatform] = useState(null);
    const [publishResults, setPublishResults] = useState({});
    const [publishError, setPublishError] = useState(null);
    const [instagramConnectionStatus, setInstagramConnectionStatus] = useState(null);
    const [isCheckingInstagramConnection, setIsCheckingInstagramConnection] = useState(false);
    const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
    const [selectedAvatar, setSelectedAvatar] = useState('avatar_4');

    const fetchPublishOptions = async () => {
        try {
            const res = await fetch(`${API_BASE}/publish/options`);
            if (!res.ok) return;
            const data = await res.json();
            setPublishOptions(data);
            if (data?.recommended_method) {
                setPublishMethod(data.recommended_method);
            }
        } catch {
            // Optional feature; keep UI functional even if options endpoint fails.
        }
    };

    const fetchInstagramConnectionStatus = async () => {
        setIsCheckingInstagramConnection(true);
        try {
            const res = await fetch(`${API_BASE}/composio/connection-status?toolkit=instagram`);
            const data = await res.json();
            if (res.ok && data?.ok) {
                setInstagramConnectionStatus(Boolean(data?.toolkit_status?.has_active_connection));
            } else {
                setInstagramConnectionStatus(false);
            }
        } catch {
            setInstagramConnectionStatus(false);
        } finally {
            setIsCheckingInstagramConnection(false);
        }
    };

    const connectInstagramWithComposio = async () => {
        setPublishError(null);
        setIsConnectingInstagram(true);
        try {
            const callback = encodeURIComponent(window.location.href);
            const res = await fetch(`${API_BASE}/composio/connect-link?toolkit=instagram&callbackUrl=${callback}`, {
                method: 'POST',
            });
            const data = await res.json();

            if (!res.ok || !data?.redirect_url) {
                throw new Error(data?.message || 'Failed to create Instagram connect link.');
            }

            const popup = window.open(data.redirect_url, '_blank', 'noopener,noreferrer');
            if (!popup) {
                window.location.href = data.redirect_url;
            }

            // Give user time to complete auth, then re-check status.
            setTimeout(() => {
                fetchInstagramConnectionStatus();
            }, 2500);
        } catch (err) {
            setPublishError(err?.message || 'Failed to start Instagram connection flow.');
        } finally {
            setIsConnectingInstagram(false);
        }
    };

  useEffect(() => {
    if (agentState.draft) {
      setEditableDraft(agentState.draft);
    }
  }, [agentState.draft]);

    useEffect(() => {
        fetchPublishOptions();
    }, []);

    useEffect(() => {
        if (publishMethod === 'composio' && isVideoFinished) {
            fetchInstagramConnectionStatus();
        }
    }, [publishMethod, isVideoFinished]);

    const getVideoPublishUrl = () => {
        const publicBase = (import.meta.env.VITE_PUBLIC_ASSET_BASE_URL || '').trim();
        if (publicBase) {
            const normalized = publicBase.endsWith('/') ? publicBase : `${publicBase}/`;
            return new URL('demo_video_TTSV.mp4', normalized).toString();
        }
        return new URL('/demo_video_TTSV.mp4', window.location.origin).toString();
    };

    const publishToPlatform = async (platform) => {
        if (!editableDraft?.trim()) {
            setPublishError('Caption is empty. Generate or edit your draft first.');
            return;
        }

        if (publishMethod === 'composio' && platform === 'instagram' && instagramConnectionStatus !== true) {
            setPublishError('Connect Instagram in Composio before publishing.');
            return;
        }

        const candidateVideoUrl = isVideoFinished ? getVideoPublishUrl() : null;
        setPublishError(null);
        setPublishingPlatform(platform);

        try {
            const res = await fetch(`${API_BASE}/publish/social`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform,
                    caption: editableDraft,
                    videoUrl: candidateVideoUrl,
                    method: publishMethod,
                }),
            });

            const payload = await res.json();
            const normalized = {
                ok: Boolean(payload?.ok),
                message: payload?.message || (payload?.ok ? 'Published successfully.' : 'Publish failed.'),
                notes: Array.isArray(payload?.notes) ? payload.notes : [],
                post_url: payload?.post_url || null,
                post_id: payload?.post_id || null,
            };

            setPublishResults((prev) => ({ ...prev, [platform]: normalized }));
            if (!res.ok || !normalized.ok) {
                setPublishError(normalized.message);
            }
        } catch (err) {
            const message = err?.message || 'Failed to publish content.';
            setPublishResults((prev) => ({
                ...prev,
                [platform]: { ok: false, message, notes: [], post_url: null, post_id: null },
            }));
            setPublishError(message);
        } finally {
            setPublishingPlatform(null);
        }
    };

  const handleCopy = () => {
    if (!editableDraft) return;
    navigator.clipboard.writeText(editableDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generatePost = () => {
    if (!description || !goal) return;
    setIsGenerating(true);
    setAgentStep('starting');
    setAgentState({});
    setError(null);
    setIsFinished(false);
    setIsVideoFinished(false);
    setVideoProgress(0);
    setVideoPhase('');
    setVideoTimeline([]);
    setPublishResults({});
    setPublishError(null);
    setSelectedAvatar('avatar_4');
    
    const backendUrl = `${API_BASE}/agents/stream-post`;
    const url = new URL(backendUrl);
    url.searchParams.append('companyDescription', description);
    url.searchParams.append('socialGoal', goal);
    
    const eventSource = new EventSource(url.toString());
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.step === 'error') {
        setError(data.error);
        setIsGenerating(false);
        eventSource.close();
        return;
      }
      
      if (data.step === 'finished') {
        setIsFinished(true);
        setIsGenerating(false);
        eventSource.close();
        setAgentStep('done');
        return;
      }
      
      setAgentStep(data.step);
      if (data.state_update) {
                const sanitizedUpdate = { ...data.state_update };
                if (typeof sanitizedUpdate.research_data === 'string') {
                    sanitizedUpdate.research_data = sanitizeResearchData(sanitizedUpdate.research_data);
                }
                setAgentState(prev => ({ ...prev, ...sanitizedUpdate }));
      }
    };
    
    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      setError("Connection to agent backend failed.");
      setIsGenerating(false);
      eventSource.close();
    };
  };

    const steps = AGENT_STEPS;

  const getStepIndex = (stepId) => steps.findIndex(s => s.id === stepId);
  const currentStepIndex = agentStep === 'done' ? steps.length : getStepIndex(agentStep);
    const activeStepDescription = agentStep === 'done'
        ? 'Your post is ready for review, voiceover, video, and publishing.'
        : (steps.find((step) => step.id === agentStep)?.description || 'Preparing your post experience...');

  const generateAudio = async () => {
    if (!agentState.draft) return;
    try {
      setIsGeneratingAudio(true);
    const res = await fetch(`${API_BASE}/agents/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: agentState.draft })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to generate audio");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Audio Generation Failed: " + err.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const generateVideo = () => {
    if (!agentState.draft) return;
    setIsGeneratingVideo(true);
    setIsVideoFinished(false);
    setVideoProgress(4);
    setVideoPhase('Preparing your video experience...');
    setVideoTimeline(['Preparing your video experience...']);
    
    let step = 0;
    const interval = setInterval(() => {
        if (step < VIDEO_PHASES.length) {
            const phase = VIDEO_PHASES[step];
            setVideoPhase(phase.text);
            setVideoProgress(phase.progress);
            setVideoTimeline((prev) => [...prev, phase.text]);
            step++;
        } else {
            clearInterval(interval);
            setVideoProgress(100);
            setVideoPhase('Your AI avatar video is ready.');
            setIsGeneratingVideo(false);
            setIsVideoFinished(true);
        }
    }, 900);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 text-[#F0F0F0]">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-[#00F5FF] via-[#8B5CF6] to-[#FF3D6E] bg-clip-text text-transparent inline-block mb-4 tracking-tight pb-1 drop-shadow-lg" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>Multi-Agent Studio</h2>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">Create campaign-ready content in a guided flow, then publish in one click when you are happy with the result.</p>
      </div>

      {(!isGenerating && !isFinished) && (
        <div className="p-8 md:p-10 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] backdrop-blur-md relative overflow-hidden transition-all duration-300">
           <div className="space-y-8 relative z-10">
             <div>
               <label className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-gray-500 mb-3 ml-2">
                 <Target size={18} className="text-[#00F5FF]" /> What does your startup do?
               </label>
               <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#080808]/50 border border-white/10 focus:border-[#00F5FF]/50 focus:ring-4 focus:ring-[#00F5FF]/10 text-white px-5 py-4 rounded-2xl transition-all outline-none shadow-inner text-lg placeholder:text-gray-600"
                  placeholder="e.g. We build open-source CMS tools for creators..."
               />
             </div>

             <div>
               <label className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-gray-500 mb-3 ml-2">
                 <PenTool size={18} className="text-[#FF3D6E]" /> What is your objective?
               </label>
               <textarea 
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full bg-[#080808]/50 border border-white/10 focus:border-[#FF3D6E]/50 focus:ring-4 focus:ring-[#FF3D6E]/10 text-white px-5 py-4 rounded-2xl min-h-[140px] outline-none transition-all resize-none shadow-inner text-lg placeholder:text-gray-600"
                  placeholder="e.g. Write a viral Twitter thread announcing our new feature launch..."
               ></textarea>
             </div>
             
             {error && <p className="text-[#FF3D6E] text-sm ml-2 font-medium">{error}</p>}
             
             <button 
               onClick={generatePost}
               disabled={!description || !goal}
               className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#8B5CF6] to-[#FF3D6E] hover:from-[#8B5CF6]/90 hover:to-[#FF3D6E]/90 border border-white/10 disabled:opacity-50 text-white font-bold py-5 rounded-2xl shadow-[0_0_24px_rgba(255,61,110,0.4)] transition-all text-xl group transform hover:scale-[1.01] active:scale-95" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>
               <Zap size={24} fill="currentColor" className={(!description || !goal) ? "" : "group-hover:animate-pulse text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"} />
                             Create My Post
             </button>
           </div>
        </div>
      )}

      {(isGenerating || isFinished) && (
        <div className="space-y-6">
            <div className="p-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] flex items-center justify-between text-sm md:text-base font-medium overflow-x-auto">
                {steps.map((step, idx) => {
                    const isCompleted = currentStepIndex > idx;
                    const isActive = currentStepIndex === idx;
                    return (
                        <div key={step.id} className={`flex items-center gap-2 flex-shrink-0 ${isCompleted ? 'text-[#00F5FF]' : isActive ? 'text-[#8B5CF6] font-bold shadow-[0_0_8px_rgba(139,92,246,0.5)]' : 'text-gray-500'}`}>
                            {isCompleted ? <CheckCircle size={20} /> : isActive ? <Loader2 className="animate-spin text-[#8B5CF6]" size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-gray-600"></div>}
                            <span className="whitespace-nowrap">{step.label}</span>
                            {idx < steps.length - 1 && <ArrowRight size={16} className={`mx-3 ${isCompleted ? 'text-[#00F5FF]/50' : 'text-gray-600'}`} />}
                        </div>
                    );
                })}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0e0e0e]/70 px-5 py-4 text-sm text-gray-300 flex items-center gap-2">
                {isGenerating ? <Loader2 size={15} className="animate-spin text-[#8B5CF6]" /> : <CheckCircle size={15} className="text-emerald-300" />}
                <span>{activeStepDescription}</span>
            </div>

            {error && (
               <div className="p-4 bg-[#FF3D6E]/10 rounded-2xl border border-[#FF3D6E]/30 text-[#FF3D6E] font-medium backdrop-blur-md">
                  {error}
               </div>
            )}

            <div className="flex flex-col gap-6">
                    {/* Live Strategy Data */}
                    {(agentState.strategy || currentStepIndex >= getStepIndex('strategist')) && (
                        <div className="p-6 bg-[#8B5CF6]/5 backdrop-blur-md rounded-3xl border border-[#8B5CF6]/20 shadow-[0_8px_30px_rgba(0,0,0,0.2)] relative overflow-hidden">
                            {!agentState.strategy && <div className="absolute inset-0 bg-[#080808]/50 backdrop-blur-sm z-10 flex items-center justify-center text-[#8B5CF6] font-medium"><Loader2 className="animate-spin mr-2" size={18} /> Consulting Strategist...</div>}
                            <h3 className="font-bold text-white mb-3 flex items-center gap-2" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}><Zap size={18} className="text-[#8B5CF6]"/> Content Strategy</h3>
                            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {agentState.strategy || "Waiting for data..."}
                            </div>
                        </div>
                    )}

                    {/* Live Research Data */}
                    {(agentState.research_data || currentStepIndex >= getStepIndex('research')) && (
                        <div className="p-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] relative overflow-hidden">
                            {!agentState.research_data && <div className="absolute inset-0 bg-[#080808]/50 backdrop-blur-sm z-10 flex items-center justify-center text-[#00F5FF]/80 font-medium"><Loader2 className="animate-spin mr-2" size={18} /> Scraping the web...</div>}
                            <h3 className="font-bold text-white mb-3 flex items-center gap-2" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}><Target size={18} className="text-[#00F5FF]"/> Web Research Findings</h3>
                            <div className="text-sm text-gray-400 leading-relaxed max-h-[400px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#00F5FF transparent' }}>
                                {agentState.research_data ? (
                                     <ReactMarkdown 
                                       components={{
                                          h1: ({node, ...props}) => <h1 className="text-white font-bold text-lg mt-4 mb-2" {...props} />,
                                          h2: ({node, ...props}) => <h2 className="text-[#00F5FF] font-bold text-base mt-4 mb-2" {...props} />,
                                          h3: ({node, ...props}) => <h3 className="text-white font-semibold text-sm mt-3 mb-1" {...props} />,
                                          p: ({node, ...props}) => <p className="mb-3" {...props} />,
                                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                                          li: ({node, ...props}) => <li className="text-gray-300" {...props} />,
                                          strong: ({node, ...props}) => <strong className="text-white font-bold" {...props} />,
                                          a: ({node, ...props}) => <a className="text-[#8B5CF6] hover:underline" target="_blank" rel="noreferrer" {...props} />
                                       }}
                                     >
                                        {agentState.research_data}
                                     </ReactMarkdown>
                                ) : "Waiting for data..."}
                            </div>
                        </div>
                    )}

                    {/* Live Final Draft */}
                    {(agentState.draft || currentStepIndex >= getStepIndex('copywriter')) ? (
                        <div className="p-8 bg-gradient-to-br from-[#FF3D6E]/20 to-[#8B5CF6]/30 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-[0_0_40px_rgba(255,61,110,0.2)] text-white relative h-full">
                            {!agentState.draft && <div className="absolute inset-0 bg-[#080808]/80 backdrop-blur-xl z-10 flex items-center justify-center text-[#FF3D6E] font-medium rounded-[2rem]"><Loader2 className="animate-spin mr-2" size={18} /> Drafting Post Copy...</div>}
                            <div className="absolute top-4 right-4 bg-[#FF3D6E]/20 backdrop-blur border border-[#FF3D6E]/30 px-3 py-1 rounded-full text-xs font-bold text-white shadow-[0_0_12px_rgba(255,61,110,0.5)]">Copywriter Output</div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-white text-2xl drop-shadow-lg" style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>Final Draft</h3>
                                {agentState.draft && isFinished && (
                                    <button 
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                    >
                                        {copied ? <CheckCircle size={14} className="text-[#00F5FF]" /> : <Copy size={14} />}
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                )}
                            </div>
                            
                            {!agentState.draft ? (
                                <div className="text-white font-medium whitespace-pre-wrap leading-relaxed pb-6 text-lg">
                                    Waiting for copywriter...
                                </div>
                            ) : (
                                <textarea
                                    value={editableDraft}
                                    onChange={(e) => setEditableDraft(e.target.value)}
                                    className="w-full bg-[#080808]/40 border border-white/10 focus:border-[#FF3D6E]/50 focus:bg-[#080808]/80 text-white font-medium whitespace-pre-wrap leading-relaxed px-4 py-4 rounded-2xl text-[17px] outline-none resize-y min-h-[220px] shadow-inner font-sans mb-4 transition-all"
                                    placeholder="Your AI generated copy will appear here..."
                                />
                            )}
                            
                            {agentState.hashtags && agentState.hashtags.length > 0 && (
                                <div className="mb-6 pt-2 pb-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Hash size={14} className="text-[#00F5FF]"/> Generated Hashtags</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {agentState.hashtags.map((tag, i) => (
                                            <span key={i} className="bg-[#00F5FF]/10 text-[#00F5FF] border border-[#00F5FF]/20 px-3 py-1.5 rounded-xl text-sm font-bold shadow-sm hover:bg-[#00F5FF]/20 transition-colors cursor-pointer">
                                                {tag.startsWith('#') ? tag : `#${tag}`}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {agentState.draft && isFinished && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    {!audioUrl ? (
                                        <button 
                                            onClick={generateAudio}
                                            disabled={isGeneratingAudio}
                                            className="flex items-center gap-2 bg-[#8B5CF6]/40 hover:bg-[#8B5CF6]/60 border border-[#8B5CF6]/50 text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50 text-sm font-bold shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                                        >
                                            {isGeneratingAudio ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />} 
                                            {isGeneratingAudio ? 'Generating Voice...' : 'Listen to Draft'}
                                        </button>
                                    ) : (
                                        <div className="bg-black/50 backdrop-blur-md p-3 rounded-2xl border border-white/10 w-full flex items-center justify-between gap-4 shadow-inner">
                                            <audio ref={audioRef} controls src={audioUrl} className="w-full h-10 outline-none" autoPlay />
                                            <a 
                                                href={audioUrl} 
                                                download="draft_speech.wav"
                                                className="shrink-0 flex items-center justify-center bg-[#8B5CF6] hover:bg-[#8B5CF6]/80 text-white p-2.5 rounded-xl transition-colors shadow-[0_0_16px_rgba(139,92,246,0.6)]"
                                                title="Download Audio"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                            </a>
                                        </div>
                                    )}
                                    
                                    {/* Video section */}
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <div className="mb-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Select Avatar</p>
                                                <p className="text-[11px] text-gray-500">Default: Avatar 4</p>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                {AVATAR_OPTIONS.map((avatar) => {
                                                    const isActive = selectedAvatar === avatar.id;
                                                    return (
                                                        <button
                                                            key={avatar.id}
                                                            type="button"
                                                            onClick={() => setSelectedAvatar(avatar.id)}
                                                            className={`rounded-xl border p-2 transition-all text-left ${isActive ? 'border-[#00F5FF]/60 bg-[#00F5FF]/10 shadow-[0_0_10px_rgba(0,245,255,0.2)]' : 'border-white/10 bg-white/5 hover:border-white/25'}`}
                                                        >
                                                            <img
                                                                src={avatar.src}
                                                                alt={avatar.label}
                                                                onError={(e) => {
                                                                    if (avatar.id === 'avatar_1' && e.currentTarget.src.indexOf('avatar_1.png') !== -1) {
                                                                        e.currentTarget.src = '/avatar%20_1.png';
                                                                        return;
                                                                    }
                                                                    e.currentTarget.src = '/avatar_4.png';
                                                                }}
                                                                className="w-full h-24 object-contain rounded-md border border-white/10 bg-[#0f1119] p-1"
                                                            />
                                                            <p className={`text-[11px] mt-2 font-semibold ${isActive ? 'text-[#00F5FF]' : 'text-gray-300'}`}>{avatar.label}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-3">Current demo video is static and uses Avatar 4 output.</p>
                                        </div>

                                        {(!isGeneratingVideo && !isVideoFinished) && (
                                            <button 
                                                onClick={generateVideo}
                                                className="flex items-center w-full justify-center gap-2 bg-gradient-to-r from-[#00F5FF]/20 to-[#8B5CF6]/20 hover:from-[#00F5FF]/30 hover:to-[#8B5CF6]/30 text-white border border-[#00F5FF]/30 px-4 py-3 rounded-xl transition-all text-sm font-bold shadow-[0_0_16px_rgba(0,245,255,0.2)]"
                                            >
                                                <Video size={18} className="text-[#00F5FF]" /> Generate Video AI Avatar
                                            </button>
                                        )}

                                        {isGeneratingVideo && (
                                            <div className="bg-black/50 rounded-2xl p-4 border border-white/10 shadow-inner space-y-4">
                                                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-gray-400">
                                                    <span>Video Creation Progress</span>
                                                    <span className="text-[#00F5FF] font-semibold">{videoProgress}%</span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-[#00F5FF] to-[#8B5CF6] transition-all duration-500"
                                                        style={{ width: `${videoProgress}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-white">
                                                    <Loader2 size={14} className="animate-spin text-[#00F5FF]" />
                                                    <span>{videoPhase || 'Preparing your video...'}</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {videoTimeline.slice(-3).map((entry, i) => (
                                                        <div key={`${entry}-${i}`} className="text-xs text-gray-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                                                            {entry}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {isVideoFinished && (
                                            <div className="rounded-2xl overflow-hidden border border-white/20 shadow-[0_0_24px_rgba(0,245,255,0.3)] relative bg-black/50 p-2">
                                                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-white/90 border border-white/10">
                                                    <div className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.8)]"></div>
                                                    Generated Output
                                                </div>
                                                <div className="absolute top-4 right-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-semibold text-gray-200 border border-white/10">
                                                    Selected: {selectedAvatar.replace('_', ' ').toUpperCase()}
                                                </div>
                                                <video 
                                                    src="/demo_video_TTSV.mp4" 
                                                    controls 
                                                    autoPlay 
                                                    className="w-full rounded-xl object-cover"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {isVideoFinished && (
                                        <div className="mt-5 pt-5 border-t border-white/10">
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                                <div>
                                                    <h4 className="text-sm font-bold tracking-widest uppercase text-gray-300 flex items-center gap-2">
                                                        <Send size={14} className="text-[#00F5FF]" /> One-Click Distribution
                                                    </h4>
                                                    <p className="text-xs text-gray-400 mt-1">Publish your generated video + caption directly to social platforms.</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Method</label>
                                                    <select
                                                        value={publishMethod}
                                                        onChange={(e) => setPublishMethod(e.target.value)}
                                                        className="bg-black/40 border border-white/15 text-white text-xs rounded-lg px-3 py-2 outline-none"
                                                    >
                                                        <option value="raw_api">Raw APIs</option>
                                                        <option value="composio">Composio</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {publishOptions?.notes?.length > 0 && (
                                                <div className="mb-4 text-xs text-gray-400 bg-black/25 border border-white/10 rounded-xl p-3 space-y-1">
                                                    {publishOptions.notes.map((note, idx) => (
                                                        <p key={idx}>- {note}</p>
                                                    ))}
                                                </div>
                                            )}

                                            {publishMethod === 'composio' && (
                                                <div className="mb-4 rounded-xl border border-white/10 bg-black/25 p-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Instagram Connection</p>
                                                            {isCheckingInstagramConnection ? (
                                                                <p className="text-xs text-gray-300 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Checking Composio account status...</p>
                                                            ) : instagramConnectionStatus === true ? (
                                                                <p className="text-xs text-emerald-300 mt-1">Connected. You can publish to Instagram via Composio.</p>
                                                            ) : (
                                                                <p className="text-xs text-amber-300 mt-1">Not connected. Authorize Instagram account once to enable publishing.</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {instagramConnectionStatus !== true && (
                                                                <button
                                                                    onClick={connectInstagramWithComposio}
                                                                    disabled={isConnectingInstagram}
                                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-[#00F5FF]/35 bg-[#00F5FF]/10 text-[#00F5FF] hover:bg-[#00F5FF]/20 disabled:opacity-60"
                                                                >
                                                                    {isConnectingInstagram ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                                                                    {isConnectingInstagram ? 'Opening...' : 'Connect Instagram'}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={fetchInstagramConnectionStatus}
                                                                disabled={isCheckingInstagramConnection}
                                                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-60"
                                                            >
                                                                <RefreshCw size={13} className={isCheckingInstagramConnection ? 'animate-spin' : ''} />
                                                                Refresh
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {SOCIAL_PLATFORMS.map((platform) => {
                                                    const Icon = platform.icon;
                                                    const result = publishResults[platform.id];
                                                    const methodInfo = publishOptions?.platforms?.[platform.id]?.[publishMethod];
                                                    const composioInstagramBlocked = publishMethod === 'composio' && platform.id === 'instagram' && instagramConnectionStatus !== true;
                                                    const isReady = (methodInfo ? methodInfo.ready : true) && !composioInstagramBlocked;
                                                    const isLoading = publishingPlatform === platform.id;

                                                    return (
                                                        <div key={platform.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                                                            <button
                                                                onClick={() => publishToPlatform(platform.id)}
                                                                disabled={isLoading || publishingPlatform !== null || !isReady}
                                                                className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${platform.accent}`}
                                                            >
                                                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                                                                {isLoading ? `Publishing...` : `Publish to ${platform.label}`}
                                                            </button>

                                                            {!isReady && methodInfo?.missing?.length > 0 && (
                                                                <p className="text-[11px] text-amber-300 mt-2">Missing: {methodInfo.missing.join(', ')}</p>
                                                            )}

                                                            {!isReady && composioInstagramBlocked && (
                                                                <p className="text-[11px] text-amber-300 mt-2">Missing: Connect Instagram account in Composio</p>
                                                            )}

                                                            {result && (
                                                                <div className={`mt-2 text-xs rounded-lg border px-2 py-2 ${result.ok ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : 'text-rose-300 border-rose-400/30 bg-rose-500/10'}`}>
                                                                    <p className="font-semibold">{result.ok ? 'Success' : 'Failed'}: {result.message}</p>
                                                                    {result.notes?.map((note, idx) => (
                                                                        <p key={idx} className="mt-1">- {note}</p>
                                                                    ))}
                                                                    {result.post_url && (
                                                                        <a href={result.post_url} target="_blank" rel="noreferrer" className="inline-block mt-1 underline font-semibold">
                                                                            Open published post
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {publishError && (
                                                <p className="text-xs text-rose-300 mt-3">{publishError}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-8 bg-white/5 backdrop-blur-md rounded-[2rem] border border-dashed border-white/10 flex flex-col items-center justify-center min-h-[300px] text-gray-500">
                            <Loader2 className="animate-spin mb-4 text-gray-600" size={40} />
                            <p className="font-medium uppercase tracking-widest text-sm">Copywriter is waiting for strategy...</p>
                        </div>
                    )}
                </div>

            {isFinished && (
                <div className="flex justify-center pt-8">
                    <button 
                        onClick={() => {
                            setIsFinished(false);
                            setIsGenerating(false);
                            setAgentStep(null);
                            setAgentState({});
                            setDescription('');
                            setGoal('');
                            setAudioUrl(null);
                            setPublishResults({});
                            setPublishError(null);
                            setSelectedAvatar('avatar_4');
                        }}
                        className="px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-colors shadow-[0_0_16px_rgba(255,255,255,0.1)]"
                    >
                        Create Another Post
                    </button>
                </div>
            )}
        </div>
      )}
    </div>
  );
}
