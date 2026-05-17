import React, { useEffect, useState } from 'react';
import { Search, FolderOpen, Plus, ChevronLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import FwdMediaPlayer from '@/components/FwdMediaPlayer';
import { Gif, useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';

interface Pack {
  id: string;
  name: string;
  items: Gif[];
}

export interface FwdLibraryPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: Gif) => void;
  title?: string;
}

type TabId = 'all' | 'created' | 'saved' | 'packs';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'created', label: 'Created' },
  { id: 'saved', label: 'Saved' },
  { id: 'packs', label: 'Packs' },
];

const dbRowToGif = (g: any): Gif => ({
  id: g.id,
  title: g.title || 'Untitled',
  image: g.gif_url || g.media_url || '',
  still_url: g.still_url || g.thumbnail_url || undefined,
  mp4_url: g.mp4_url || undefined,
  webm_url: g.webm_url || undefined,
  tags: g.tags || [],
  category: g.category || 'Reactions',
  mood: g.mood || undefined,
  user_id: g.owner_user_id,
  caption: g.caption || undefined,
  source_video_url: g.source_video_url || undefined,
  media_type: g.media_type || undefined,
  is_animated: g.is_animated ?? true,
  visibility: g.visibility,
});

const filterGifs = (gifs: Gif[], query: string): Gif[] => {
  const q = query.toLowerCase().trim();
  if (!q) return gifs;
  return gifs.filter(g =>
    [g.title, g.caption || '', g.category, g.mood || '', ...(g.tags || [])]
      .join(' ')
      .toLowerCase()
      .includes(q)
  );
};

const GifGrid: React.FC<{ gifs: Gif[]; onSelect: (g: Gif) => void }> = ({ gifs, onSelect }) => (
  <div className="grid grid-cols-3 gap-2">
    {gifs.map(g => (
      <button
        key={g.id}
        onClick={() => onSelect(g)}
        className="relative aspect-square rounded-xl overflow-hidden border border-fuchsia-500/20 hover:border-fuchsia-500 hover:scale-[1.03] transition"
      >
        <FwdMediaPlayer
          mp4Url={g.mp4_url}
          webmUrl={g.webm_url}
          gifUrl={g.image}
          posterUrl={g.still_url}
          sourceVideoUrl={g.source_video_url}
          mediaType={g.media_type}
          isAnimated={g.is_animated}
          title={g.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        <p className="absolute bottom-1 left-1 right-1 text-[9px] font-bold text-white truncate leading-tight">
          {g.title}
        </p>
      </button>
    ))}
  </div>
);

const FwdLibraryPicker: React.FC<FwdLibraryPickerProps> = ({
  open,
  onClose,
  onSelect,
  title = 'Pick a FWD',
}) => {
  const { savedLibrary, userGifs } = useAppContext();
  const { user } = useAuth();

  const [tab, setTab] = useState<TabId>('all');
  const [query, setQuery] = useState('');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [activePack, setActivePack] = useState<Pack | null>(null);
  const [newPackName, setNewPackName] = useState('');
  const [creatingPack, setCreatingPack] = useState(false);
  const [packsLoading, setPacksLoading] = useState(false);

  // Deduplicated full library (created + saved, no duplicates)
  const allGifs = [...userGifs, ...savedLibrary].filter(
    (g, i, arr) => g.image && arr.findIndex(x => x.id === g.id) === i
  );
  const savedOnlyGifs = savedLibrary.filter(g => g.user_id !== user?.id);

  // Tabs resolve to their source array
  const sourceGifs = (): Gif[] => {
    if (tab === 'created') return userGifs;
    if (tab === 'saved') return savedOnlyGifs;
    if (tab === 'packs') return activePack ? activePack.items : [];
    return allGifs;
  };

  const visibleGifs = filterGifs(sourceGifs(), query);

  // Load packs when the packs tab becomes active
  useEffect(() => {
    if (open && user && tab === 'packs' && packs.length === 0 && !packsLoading) {
      loadPacks();
    }
  }, [open, user, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset state when picker closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setTab('all');
      setActivePack(null);
      setNewPackName('');
    }
  }, [open]);

  const loadPacks = async () => {
    if (!user) return;
    setPacksLoading(true);
    const { data: packRows } = await supabase
      .from('fwd_library_packs')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (!packRows || packRows.length === 0) {
      setPacks([]);
      setPacksLoading(false);
      return;
    }

    const packIds = packRows.map((p: any) => p.id);
    const { data: itemRows } = await supabase
      .from('fwd_library_pack_items')
      .select('pack_id, gif_id, position, fwd_gifs(*)')
      .in('pack_id', packIds)
      .order('position', { ascending: true });

    const loaded: Pack[] = packRows.map((p: any) => ({
      id: p.id,
      name: p.name,
      items: (itemRows || [])
        .filter((r: any) => r.pack_id === p.id)
        .map((r: any) => r.fwd_gifs ? dbRowToGif(r.fwd_gifs) : null)
        .filter(Boolean) as Gif[],
    }));

    setPacks(loaded);
    setPacksLoading(false);
  };

  const createPack = async () => {
    if (!user || !newPackName.trim()) return;
    setCreatingPack(true);
    const { data, error } = await supabase
      .from('fwd_library_packs')
      .insert({ user_id: user.id, name: newPackName.trim() })
      .select()
      .single();
    setCreatingPack(false);
    if (error || !data) {
      toast({ title: 'Could not create pack', variant: 'destructive' });
      return;
    }
    const pack: Pack = { id: data.id, name: data.name, items: [] };
    setPacks(prev => [...prev, pack]);
    setActivePack(pack);
    setNewPackName('');
    toast({ title: `Pack "${data.name}" created` });
  };

  const handleSelect = (gif: Gif) => {
    onSelect(gif);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] bg-zinc-950 border-t border-fuchsia-500/30 rounded-t-3xl p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-5 pt-5 pb-0 shrink-0">
          <SheetTitle className="text-white font-black tracking-wider pr-8">{title}</SheetTitle>
          <p className="text-xs text-zinc-500">Save once. Use anywhere.</p>
        </SheetHeader>

        {/* Search */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="glass rounded-xl px-3 py-2.5 border border-fuchsia-500/25 flex items-center gap-2">
            <Search size={15} className="text-zinc-400 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search your library…"
              className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-5 pb-3 shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setActivePack(null); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                tab === t.id
                  ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border-transparent'
                  : 'glass border-white/10 text-zinc-300 hover:border-fuchsia-500/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {tab === 'packs' ? (
            <PacksPanel
              packs={packs}
              activePack={activePack}
              query={query}
              loading={packsLoading}
              newPackName={newPackName}
              creatingPack={creatingPack}
              onSetActivePack={setActivePack}
              onNewPackNameChange={setNewPackName}
              onCreatePack={createPack}
              onSelect={handleSelect}
            />
          ) : (
            <EmptyOrGrid gifs={visibleGifs} tab={tab} query={query} onSelect={handleSelect} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ---- Sub-components ----

interface PacksPanelProps {
  packs: Pack[];
  activePack: Pack | null;
  query: string;
  loading: boolean;
  newPackName: string;
  creatingPack: boolean;
  onSetActivePack: (p: Pack | null) => void;
  onNewPackNameChange: (v: string) => void;
  onCreatePack: () => void;
  onSelect: (g: Gif) => void;
}

const PacksPanel: React.FC<PacksPanelProps> = ({
  packs, activePack, query, loading, newPackName, creatingPack,
  onSetActivePack, onNewPackNameChange, onCreatePack, onSelect,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass rounded-2xl aspect-square animate-pulse" />
        ))}
      </div>
    );
  }

  if (activePack) {
    const items = filterGifs(activePack.items, query);
    return (
      <>
        <button
          onClick={() => onSetActivePack(null)}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white mb-3 transition"
        >
          <ChevronLeft size={14} /> Back to Packs
        </button>
        <h4 className="text-sm font-black text-white mb-3">{activePack.name}</h4>
        {items.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen size={28} className="mx-auto text-zinc-700 mb-2" />
            <p className="text-zinc-500 text-sm">
              {query ? 'No matches.' : 'This pack is empty.'}
            </p>
          </div>
        ) : (
          <GifGrid gifs={items} onSelect={onSelect} />
        )}
      </>
    );
  }

  return (
    <>
      {packs.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {packs.map(p => (
            <button
              key={p.id}
              onClick={() => onSetActivePack(p)}
              className="glass-strong rounded-2xl p-3 border border-fuchsia-500/20 hover:border-fuchsia-500/50 text-left transition"
            >
              <div className="grid grid-cols-2 gap-0.5 w-full aspect-square rounded-lg overflow-hidden bg-black/40 mb-2">
                {p.items.slice(0, 4).map((g, i) => (
                  <div key={g.id + i} className="overflow-hidden">
                    <FwdMediaPlayer
                      gifUrl={g.image}
                      posterUrl={g.still_url}
                      mp4Url={g.mp4_url}
                      webmUrl={g.webm_url}
                      mediaType={g.media_type}
                      isAnimated={g.is_animated}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {p.items.length === 0 && (
                  <div className="col-span-2 row-span-2 flex items-center justify-center text-zinc-700 text-xs">Empty</div>
                )}
              </div>
              <div className="text-white font-bold text-sm truncate">{p.name}</div>
              <div className="text-zinc-500 text-xs">{p.items.length} FWD{p.items.length === 1 ? '' : 's'}</div>
            </button>
          ))}
        </div>
      )}

      {/* Create pack */}
      <div className="glass rounded-xl p-3 border border-fuchsia-500/20">
        <p className="text-xs font-bold text-white mb-2">New Pack</p>
        <div className="flex gap-2">
          <input
            value={newPackName}
            onChange={e => onNewPackNameChange(e.target.value.slice(0, 80))}
            onKeyDown={e => { if (e.key === 'Enter') onCreatePack(); }}
            placeholder="Pack name…"
            className="flex-1 bg-black/40 border border-fuchsia-500/25 rounded-lg px-3 py-2 text-sm text-white outline-none"
          />
          <button
            onClick={onCreatePack}
            disabled={creatingPack || !newPackName.trim()}
            className="px-3 rounded-lg bg-fuchsia-600 text-white text-sm font-bold disabled:opacity-50 flex items-center"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </>
  );
};

const EmptyOrGrid: React.FC<{
  gifs: Gif[];
  tab: TabId;
  query: string;
  onSelect: (g: Gif) => void;
}> = ({ gifs, tab, query, onSelect }) => {
  if (gifs.length === 0) {
    const emptyMsg =
      query ? 'No matches found.' :
      tab === 'created' ? "You haven't created any GIFs yet." :
      tab === 'saved' ? 'No saved GIFs yet.' :
      'Your library is empty. Save or create a GIF to get started.';
    return (
      <div className="text-center py-12">
        <FolderOpen size={32} className="mx-auto text-zinc-700 mb-2" />
        <p className="text-zinc-500 text-sm">{emptyMsg}</p>
      </div>
    );
  }
  return <GifGrid gifs={gifs} onSelect={onSelect} />;
};

export default FwdLibraryPicker;
