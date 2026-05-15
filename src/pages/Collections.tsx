import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Lock, ChevronRight, Folder } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import BottomNav from '@/components/BottomNav';
import { useAppContext } from '@/contexts/AppContext';
import { GIFS } from '@/data/gifs';
import { toast } from '@/components/ui/use-toast';

const Collections: React.FC = () => {
  const nav = useNavigate();
  const { collections, createCollection } = useAppContext();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCollection(newName.trim());
    toast({ title: 'Collection created', description: `"${newName}" is ready.` });
    setNewName('');
    setCreating(false);
  };

  const gifFor = (id: string) => GIFS.find(g => g.id === id) || GIFS[0];

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <button onClick={() => setCreating(true)} className="w-10 h-10 rounded-full glass border border-fuchsia-500/40 flex items-center justify-center neon-glow-purple/30">
            <Plus size={18} className="text-fuchsia-400" />
          </button>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mt-2">Collections</h1>
        <p className="text-zinc-400 text-sm sm:text-base mb-5">Organize your reactions, your way.</p>

        {creating && (
          <div className="glass-strong rounded-2xl p-3 border border-fuchsia-500/40 mb-4 flex gap-2">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Collection name"
              className="flex-1 bg-transparent outline-none text-white placeholder-zinc-500" />
            <button onClick={handleCreate} className="px-4 py-1.5 rounded-full bg-fuchsia-600 text-sm font-bold">Create</button>
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-full glass text-sm">Cancel</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {collections.map(c => {
            const previewIds = c.gifIds.length ? c.gifIds : GIFS.slice(0, 4).map(g => g.id);
            return (
              <button key={c.id} className="w-full glass-strong rounded-3xl p-4 border border-fuchsia-500/20 hover:border-fuchsia-500/60 transition flex items-center gap-4 group">
                <div className="grid grid-cols-2 gap-1 w-20 h-20 rounded-2xl overflow-hidden border border-fuchsia-500/30 group-hover:neon-glow-purple/40">
                  {previewIds.slice(0, 4).map(id => (
                    <img key={id} src={gifFor(id).image} className="w-full h-full object-cover" />
                  ))}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    {c.isPrivate && <Lock size={14} className="text-pink-400" />}
                  </div>
                  <p className="text-xs text-zinc-500">{c.gifIds.length} GIFs · Updated recently</p>
                  <div className="flex -space-x-1 mt-2">
                    <div className="w-2 h-2 rounded-full bg-fuchsia-500" />
                    <div className="w-2 h-2 rounded-full bg-pink-500" />
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-400" />
              </button>
            );
          })}
        </div>

        <button onClick={() => setCreating(true)} className="w-full mt-5 glass-strong rounded-2xl p-4 border border-dashed border-fuchsia-500/40 flex items-center justify-center gap-2 text-fuchsia-300 font-semibold">
          <Folder size={18} /> Create new collection
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Collections;
