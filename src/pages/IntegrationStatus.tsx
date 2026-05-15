import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import FwdLogo from '@/components/FwdLogo';
import { fwdConfig, supabase, isSupabaseConfigured } from '@/lib/supabase';

interface StatusItem {
  label: string;
  status: 'ok' | 'error' | 'warning' | 'checking';
  value?: string;
  hint?: string;
}

const StatusIcon: React.FC<{ status: StatusItem['status'] }> = ({ status }) => {
  switch (status) {
    case 'ok':
      return <CheckCircle2 size={16} className="text-emerald-400" />;
    case 'error':
      return <XCircle size={16} className="text-rose-400" />;
    case 'warning':
      return <AlertTriangle size={16} className="text-amber-400" />;
    case 'checking':
      return <Loader2 size={16} className="text-fuchsia-300 animate-spin" />;
  }
};

const maskValue = (val: string, showChars = 12): string => {
  if (!val) return 'not set';
  if (val.length <= showChars) return val;
  return val.slice(0, showChars) + '...';
};

const IntegrationStatus: React.FC = () => {
  const nav = useNavigate();
  const [checks, setChecks] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  const runChecks = async () => {
    setLoading(true);
    const results: StatusItem[] = [];

    // 1. Supabase URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    results.push({
      label: 'VITE_SUPABASE_URL',
      status: supabaseUrl ? 'ok' : 'error',
      value: supabaseUrl ? maskValue(supabaseUrl, 30) : 'not set',
      hint: supabaseUrl ? undefined : 'Required for auth, uploads, and picker key verification.',
    });

    // 2. Supabase Anon Key
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    results.push({
      label: 'VITE_SUPABASE_ANON_KEY',
      status: supabaseKey ? 'ok' : 'error',
      value: supabaseKey ? `starts with ${supabaseKey.slice(0, 10)}...` : 'not set',
      hint: supabaseKey ? undefined : 'Required for Supabase client initialization.',
    });

    // 3. FWD App URL
    const appUrl = import.meta.env.VITE_FWD_APP_URL;
    results.push({
      label: 'VITE_FWD_APP_URL',
      status: appUrl ? 'ok' : 'warning',
      value: appUrl || window.location.origin,
      hint: appUrl ? undefined : 'Using current origin as fallback.',
    });

    // 4. Allowed Origins
    const origins = fwdConfig.allowedParentOrigins;
    results.push({
      label: 'VITE_FWD_ALLOWED_PARENT_ORIGINS',
      status: origins.length > 0 ? 'ok' : 'warning',
      value: origins.length > 0 ? `${origins.length} configured` : 'none configured',
      hint: origins.length > 0 ? origins.slice(0, 3).join(', ') + (origins.length > 3 ? '...' : '') : 'Embed picker will block all external domains.',
    });

    // 5. Picker API Keys table
    if (isSupabaseConfigured) {
      results.push({ label: 'picker_api_keys table', status: 'checking', value: 'checking...' });
      setChecks([...results]);

      try {
        const { error } = await supabase.from('picker_api_keys').select('id').limit(1);
        results[results.length - 1] = {
          label: 'picker_api_keys table',
          status: error ? 'error' : 'ok',
          value: error ? 'not reachable' : 'reachable',
          hint: error ? error.message : undefined,
        };
      } catch (e: any) {
        results[results.length - 1] = {
          label: 'picker_api_keys table',
          status: 'error',
          value: 'error',
          hint: e?.message || 'Could not connect.',
        };
      }
    } else {
      results.push({
        label: 'picker_api_keys table',
        status: 'warning',
        value: 'skipped',
        hint: 'Supabase not configured.',
      });
    }

    // 6. fwd-uploads bucket
    if (isSupabaseConfigured) {
      results.push({ label: 'fwd-uploads bucket', status: 'checking', value: 'checking...' });
      setChecks([...results]);

      try {
        const { error } = await supabase.storage.from('fwd-uploads').list('', { limit: 1 });
        results[results.length - 1] = {
          label: 'fwd-uploads bucket',
          status: error ? 'warning' : 'ok',
          value: error ? 'not reachable or empty' : 'reachable',
          hint: error ? 'Bucket may not exist or RLS blocks listing.' : undefined,
        };
      } catch (e: any) {
        results[results.length - 1] = {
          label: 'fwd-uploads bucket',
          status: 'warning',
          value: 'unknown',
          hint: e?.message || 'Could not check bucket.',
        };
      }
    } else {
      results.push({
        label: 'fwd-uploads bucket',
        status: 'warning',
        value: 'skipped',
        hint: 'Supabase not configured.',
      });
    }

    // 7. verify-picker-key Edge Function
    if (isSupabaseConfigured) {
      results.push({ label: 'verify-picker-key function', status: 'checking', value: 'checking...' });
      setChecks([...results]);

      try {
        const resp = await fetch(`${fwdConfig.supabaseUrl}/functions/v1/verify-picker-key`, {
          method: 'OPTIONS',
          headers: { apikey: fwdConfig.supabaseAnonKey },
        });
        results[results.length - 1] = {
          label: 'verify-picker-key function',
          status: resp.ok || resp.status === 204 ? 'ok' : 'warning',
          value: resp.ok || resp.status === 204 ? 'reachable' : `status ${resp.status}`,
          hint: resp.ok || resp.status === 204 ? undefined : 'Function may not be deployed.',
        };
      } catch (e: any) {
        results[results.length - 1] = {
          label: 'verify-picker-key function',
          status: 'warning',
          value: 'not reachable',
          hint: 'Edge function may not be deployed yet.',
        };
      }
    } else {
      results.push({
        label: 'verify-picker-key function',
        status: 'warning',
        value: 'skipped',
        hint: 'Supabase not configured.',
      });
    }

    // 8. Embed picker route
    results.push({
      label: '/embed/picker route',
      status: 'ok',
      value: 'available',
      hint: `${fwdConfig.appUrl}/embed/picker`,
    });

    // 9. Integration demo
    results.push({
      label: '/demo route',
      status: 'ok',
      value: 'available',
      hint: 'postMessage demo for testing GIF selection.',
    });

    setChecks(results);
    setLoading(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const allOk = checks.every((c) => c.status === 'ok');
  const hasErrors = checks.some((c) => c.status === 'error');

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full glass flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <FwdLogo size="md" />
          <button onClick={runChecks} disabled={loading} className="w-10 h-10 rounded-full glass flex items-center justify-center disabled:opacity-50">
            <RefreshCw size={18} className={`text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-widest">INTEGRATION STATUS</h1>
          <p className="text-zinc-400 text-sm mt-1">Check FWD configuration and backend connectivity.</p>
        </div>

        {/* Summary banner */}
        <div className={`glass-strong rounded-2xl p-4 border mb-6 flex items-start gap-3 ${
          hasErrors ? 'border-rose-500/30' : allOk ? 'border-emerald-500/30' : 'border-amber-500/30'
        }`}>
          {hasErrors ? (
            <XCircle size={20} className="text-rose-400 mt-0.5 shrink-0" />
          ) : allOk ? (
            <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={20} className="text-amber-400 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-white font-bold text-sm">
              {hasErrors
                ? 'Some required items are missing.'
                : allOk
                ? 'All systems operational.'
                : 'Some optional items need attention.'}
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">
              {hasErrors
                ? 'Fix the errors below before deploying to production.'
                : allOk
                ? 'FWD is ready for production integration.'
                : 'FWD will work but some features may be limited.'}
            </p>
          </div>
        </div>

        {/* Status list */}
        <div className="space-y-2">
          {checks.map((item, i) => (
            <div key={i} className="glass rounded-xl p-3 border border-white/5 flex items-start gap-3">
              <StatusIcon status={item.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">{item.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.status === 'ok'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : item.status === 'error'
                      ? 'bg-rose-500/15 text-rose-300'
                      : item.status === 'warning'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-fuchsia-500/15 text-fuchsia-300'
                  }`}>
                    {item.value}
                  </span>
                </div>
                {item.hint && <p className="text-zinc-500 text-xs mt-0.5 truncate">{item.hint}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <a
            href="/embed/picker?key=demo&source=test&context=message&mode=compact"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-strong rounded-xl p-3 border border-fuchsia-500/20 flex items-center gap-2 text-sm text-fuchsia-300 hover:border-fuchsia-500/40 transition"
          >
            <ExternalLink size={14} />
            Test Embed Picker
          </a>
          <a
            href="/demo"
            className="glass-strong rounded-xl p-3 border border-cyan-500/20 flex items-center gap-2 text-sm text-cyan-300 hover:border-cyan-500/40 transition"
          >
            <ExternalLink size={14} />
            Integration Demo
          </a>
        </div>

        <p className="text-[11px] text-zinc-600 text-center mt-6">
          Secret values are never displayed. Only masked or status indicators are shown.
        </p>
      </div>
    </div>
  );
};

export default IntegrationStatus;
