import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, RefreshCw, Save, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext, Gif } from '@/contexts/AppContext';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { toast } from '@/components/ui/use-toast';
import { resolveFwdMedia } from '@/lib/fwdMedia';

const MOODS = ['Funny', 'Savage', 'Flirty', 'Dramatic', 'Petty', 'Shocked', 'Celebration', 'Vibes'];
const STYLES = ['Clean', 'Meme', 'Neon', 'Cinematic', 'Reaction Cam'];

const RemixStudio: React.FC = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { createUserGif, createPost } = useAppContext();
  
  const [originalGif, setOriginalGif] = useState<Gif | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState('Funny');
  const [style, setStyle] = useState('Clean');
  
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancel = false;
    const loadOriginal = async () => {
      if (!id) return;
      const { data } = await supabase.from('fwd_gifs').select('*, fwd_profiles!owner_user_id(display_name, username)').eq('id', id).maybeSingle();
      if (cancel) return;
      if (data) {
        const media = resolveFwdMedia(data);
        const resolvedGif: Gif = {
          id: data.id,
          title: data.title || 'Untitled',
          image: media.animatedUrl || '',
          still_url: media.thumbnailUrl || undefined,
          tags: data.tags || [],
          category: data.category || 'Reactions',
          user_id: data.owner_user_id,
          caption: data.caption,
          visibility: data.visibility,
          mp4_url: media.mp4Url,
          webm_url: media.webmUrl,
          source_video_url: media.sourceVideoUrl,
          media_type: data.media_type,
          is_animated: data.is_animated ?? media.isLikelyAnimated,
          provider: data.provider,
          provider_gif_id: data.provider_gif_id,
        };
        // Quick hack to attach original creator profile to the Gif object for display
        (resolvedGif as any).original_profile = data.fwd_profiles;
        setOriginalGif(resolvedGif);
      }
      setLoading(false);
    };
    loadOriginal();
    return () => { cancel = true; };
  }, [id]);

  const generateIdeas = async () => {
    if (!originalGif) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/remix-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: mood.toLowerCase(),
          context: originalGif.title + ' ' + (originalGif.caption || ''),
        })
      });
      const data = await res.json();
      if (data.ideas) {
        setAiIdeas(data.ideas);
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Could not fetch ideas', variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async (postToFeed = false) => {
    if (!user) {
      toast({ title: 'Sign in to save', description: 'Create an account to save your remix.' });
      nav('/login');
      return;
    }
    if (!originalGif) return;
    
    setSaving(true);
    try {
      // 1. Create the new GIF record referencing the original
      const remixed = await createUserGif({
        title: `Remix: ${originalGif.title}`,
        image: originalGif.image,
        still_url: originalGif.still_url,
        tags: originalGif.tags,
        category: originalGif.category,
        mood: mood,
        caption: caption, // We store the text overlay logic here as metadata for Phase 1
        isPublic: postToFeed,
        allow_reuse: true,
        allow_download: true,
        source_type: 'remix',
        source_video_url: originalGif.source_video_url,
        media_type: originalGif.media_type,
        is_animated: originalGif.is_animated,
        remixed_from_gif_id: originalGif.id,
        remixed_from_user_id: originalGif.user_id,
        remix_caption: caption,
        remix_style: style,
        remix_mood: mood,
        is_remix: true,
      });

      if (!remixed) throw new Error('Failed to create remix GIF record');

      // 2. Post to feed if requested
      if (postToFeed) {
        const post = await createPost(remixed.id, caption);
        if (!post) throw new Error('Failed to post to feed');
        toast({ title: 'Remix posted to feed!' });
        nav('/feed');
      } else {
        toast({ title: 'Remix saved privately!' });
        nav(`/profile`);
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error saving remix', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading...</div>;
  if (!originalGif) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">GIF not found</div>;

  const originalCreatorName = (originalGif as any).original_profile?.display_name || (originalGif as any).original_profile?.username || 'Unknown';

  return (
    <div className="min-h-screen pb-safe bg-black page-content flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button onClick={() => nav(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-black tracking-wider text-white">REMIX STUDIO</h1>
          <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-widest">Remix of @{originalCreatorName}</p>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto max-w-md mx-auto w-full p-4 flex flex-col gap-5">
        
        {/* Preview Area */}
        <div className="relative rounded-3xl overflow-hidden border-2 border-fuchsia-500/40 glass-strong shadow-2xl shadow-fuchsia-900/20 w-full max-w-[300px] mx-auto aspect-[4/5] flex items-center justify-center">
           <FwdMediaPlayer
            mp4Url={originalGif.mp4_url}
            webmUrl={originalGif.webm_url}
            gifUrl={originalGif.image}
            posterUrl={originalGif.still_url}
            isAnimated={originalGif.is_animated}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Simulated Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
             {caption && (
               <div className={`text-center mb-4 ${
                 style === 'Meme' ? 'font-black uppercase text-2xl text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] [text-shadow:-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000,2px_2px_0_#000]' :
                 style === 'Neon' ? 'font-bold text-xl text-fuchsia-400 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]' :
                 'font-bold text-lg text-white drop-shadow-md'
               }`}>
                 {caption}
               </div>
             )}
          </div>
          <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-[9px] font-bold text-white/80 uppercase tracking-widest border border-white/20">
            Remix preview
          </div>
        </div>

        {/* Input area */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Caption Overlay</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add your spin..."
              className="w-full bg-zinc-900/50 border border-fuchsia-500/30 rounded-2xl p-4 text-white placeholder-zinc-500 focus:border-fuchsia-500 outline-none resize-none h-24 transition-colors"
            />
          </div>

          {/* AI Helper */}
          <div className="glass rounded-2xl border border-cyan-500/30 p-3">
             <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-1.5 text-cyan-400">
                 <Sparkles size={14} />
                 <span className="text-[11px] font-bold uppercase tracking-widest">AI Ideas</span>
               </div>
               <button 
                onClick={generateIdeas} 
                disabled={aiLoading}
                className="text-[10px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-3 py-1.5 rounded-full font-bold transition flex items-center gap-1"
               >
                 <RefreshCw size={10} className={aiLoading ? 'animate-spin' : ''} />
                 Generate
               </button>
             </div>
             {aiIdeas.length > 0 ? (
               <div className="flex flex-col gap-2">
                 {aiIdeas.map((idea, i) => (
                   <button 
                    key={i} 
                    onClick={() => setCaption(idea)}
                    className="text-left text-sm text-zinc-300 bg-white/5 hover:bg-white/10 rounded-xl px-3 py-2 transition"
                   >
                     {idea}
                   </button>
                 ))}
               </div>
             ) : (
               <p className="text-xs text-zinc-500 text-center py-2">Tap generate for creative ideas based on your mood.</p>
             )}
          </div>

          {/* Mood Selector */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Remix Mood</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {MOODS.map(m => (
                <button
                  key={m}
                  onClick={() => { setMood(m); setAiIdeas([]); }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    mood === m 
                      ? 'bg-fuchsia-500 border-fuchsia-400 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]' 
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:border-fuchsia-500/30'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Style Selector */}
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-2 block">Text Style</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                    style === s 
                      ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.5)]' 
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:border-cyan-500/30'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 bg-black/80 backdrop-blur-lg border-t border-white/10 flex gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="flex-1 py-3.5 rounded-2xl glass border border-white/20 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition btn-press disabled:opacity-50"
        >
          <Save size={16} /> Save Private
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !user}
          className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-black neon-glow-pink flex items-center justify-center gap-2 btn-press disabled:opacity-50 animate-gradient-flow"
        >
          <Send size={16} /> Post to Feed
        </button>
      </div>
    </div>
  );
};

export default RemixStudio;
