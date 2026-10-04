import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle, Github, Server, Calendar, RefreshCw, Key, Trash2, Filter, Monitor, Cloud } from 'lucide-react';

const AVAILABLE_PLATFORMS = [
  { id: 'Codeforces', label: 'Codeforces' },
  { id: 'LeetCode', label: 'LeetCode' },
  { id: 'AtCoder', label: 'AtCoder' },
  { id: 'CodeChef', label: 'CodeChef' },
  { id: 'Google', label: 'Google CP' },
  { id: 'HackerCup', label: 'Meta / HackerCup' },
];

export function Settings() {
  const [backendUrl, setBackendUrl] = useState('http://localhost:5000');
  const [githubToken, setGithubToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [autoSync, setAutoSync] = useState(true);

  // Google Calendar Auto-Sync fields
  const [autoGCalSync, setAutoGCalSync] = useState(true);
  const [gcalAccessToken, setGcalAccessToken] = useState('');
  const [disabledPlatforms, setDisabledPlatforms] = useState([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncingGCal, setIsSyncingGCal] = useState(false);
  const [isPurgingGCal, setIsPurgingGCal] = useState(false);

  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(
        [
          'backendUrl',
          'githubToken',
          'githubOwner',
          'githubRepo',
          'autoSync',
          'autoGCalSync',
          'gcalAccessToken',
          'disabledPlatforms',
        ],
        (res) => {
          if (res.backendUrl) setBackendUrl(res.backendUrl);
          if (res.githubToken) setGithubToken(res.githubToken);
          if (res.githubOwner) setGithubOwner(res.githubOwner);
          if (res.githubRepo) setGithubRepo(res.githubRepo);
          if (res.autoSync !== undefined) setAutoSync(res.autoSync);
          if (res.autoGCalSync !== undefined) setAutoGCalSync(res.autoGCalSync);
          if (res.gcalAccessToken) setGcalAccessToken(res.gcalAccessToken);
          if (Array.isArray(res.disabledPlatforms)) setDisabledPlatforms(res.disabledPlatforms);
        }
      );
    } else {
      const saved = localStorage.getItem('cp_sync_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBackendUrl(parsed.backendUrl || 'http://localhost:5000');
        setGithubToken(parsed.githubToken || '');
        setGithubOwner(parsed.githubOwner || '');
        setGithubRepo(parsed.githubRepo || '');
        setAutoSync(parsed.autoSync ?? true);
        setAutoGCalSync(parsed.autoGCalSync ?? true);
        setGcalAccessToken(parsed.gcalAccessToken || '');
        setDisabledPlatforms(parsed.disabledPlatforms || []);
      }
    }
  }, []);

  const handleSave = (e) => {
    if (e) e.preventDefault();
    const payload = {
      backendUrl,
      githubToken,
      githubOwner,
      githubRepo,
      autoSync,
      autoGCalSync,
      gcalAccessToken,
      disabledPlatforms,
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set(payload, () => {
        setStatus({ type: 'success', message: 'Settings saved successfully!' });
        setTimeout(() => setStatus(null), 3000);
      });
    } else {
      localStorage.setItem('cp_sync_settings', JSON.stringify(payload));
      setStatus({ type: 'success', message: 'Settings saved (local mode)!' });
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const setPresetBackend = (url) => {
    setBackendUrl(url);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ backendUrl: url });
    }
    setStatus({ type: 'success', message: `Server URL updated to: ${url}` });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleGoogleAuth = () => {
    setIsAuthenticating(true);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'AUTHENTICATE_GOOGLE_CALENDAR' }, (res) => {
        setIsAuthenticating(false);
        if (res?.success && res.token) {
          setGcalAccessToken(res.token);
          setStatus({ type: 'success', message: 'Google Account connected successfully!' });
        } else {
          setStatus({
            type: 'error',
            message: res?.error || 'OAuth login failed. Use Access Token override below if needed.',
          });
        }
        setTimeout(() => setStatus(null), 4000);
      });
    } else {
      setIsAuthenticating(false);
      setStatus({ type: 'error', message: 'Chrome runtime not available.' });
    }
  };

  const handleForceCalendarSync = () => {
    setIsSyncingGCal(true);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'FORCE_CALENDAR_SYNC' }, (res) => {
        setIsSyncingGCal(false);
        if (res?.success) {
          setStatus({
            type: 'success',
            message: `Calendar sync complete! Injected ${res.syncedCount || 0} new contests.`,
          });
        } else {
          setStatus({ type: 'error', message: res?.error || 'Calendar sync failed.' });
        }
        setTimeout(() => setStatus(null), 4000);
      });
    } else {
      setIsSyncingGCal(false);
    }
  };

  const handlePurgeCalendarEvents = () => {
    if (!window.confirm('Are you sure you want to delete ALL extension-added contest events from your Google Calendar?')) {
      return;
    }
    setIsPurgingGCal(true);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'PURGE_CALENDAR_EVENTS' }, (res) => {
        setIsPurgingGCal(false);
        if (res?.success) {
          setStatus({
            type: 'success',
            message: `Purge complete! Deleted ${res.deletedCount || 0} contest events from Google Calendar.`,
          });
        } else {
          setStatus({ type: 'error', message: res?.error || 'Calendar purge failed.' });
        }
        setTimeout(() => setStatus(null), 5000);
      });
    } else {
      setIsPurgingGCal(false);
    }
  };

  const togglePlatform = (platformId) => {
    setDisabledPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId]
    );
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 text-xs">
      {/* Backend Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-sm">
          <Server className="w-4 h-4 text-indigo-400" />
          Backend API Server Config
        </div>

        {/* Quick Presets */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPresetBackend('http://localhost:5000')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg border text-[11px] font-medium transition ${
              backendUrl.includes('localhost')
                ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200 font-semibold'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-indigo-400" />
            Local Server (5000)
          </button>

          <button
            type="button"
            onClick={() => setPresetBackend('https://cp-schedule-extension.onrender.com')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg border text-[11px] font-medium transition ${
              backendUrl.includes('onrender.com')
                ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200 font-semibold'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            Cloud Server (Render)
          </button>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Custom Server URL</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://localhost:5000"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
            required
          />
        </div>
      </div>

      {/* Google Calendar Auto-Sync Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-sm">
          <Calendar className="w-4 h-4 text-sky-400" />
          Google Calendar Sync Settings
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-medium">Auto-Sync Contests to Google Calendar</span>
          <input
            type="checkbox"
            checked={autoGCalSync}
            onChange={(e) => setAutoGCalSync(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
        </div>

        {/* Platform Selection Filter */}
        <div className="pt-2 border-t border-slate-700/60">
          <div className="flex items-center gap-1 text-slate-400 mb-2 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            <span>Platforms to Sync to Calendar:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_PLATFORMS.map((p) => {
              const isEnabled = !disabledPlatforms.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center justify-between p-2 rounded-lg border text-[11px] font-medium transition ${
                    isEnabled
                      ? 'bg-sky-950/40 border-sky-600/60 text-sky-200'
                      : 'bg-slate-900/60 border-slate-700 text-slate-500 line-through'
                  }`}
                >
                  <span>{p.label}</span>
                  <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-sky-400' : 'bg-slate-600'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* OAuth and Action Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isAuthenticating}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-sky-700 hover:bg-sky-600 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              <Key className="w-3.5 h-3.5" />
              {isAuthenticating ? 'Connecting...' : 'Connect Google Account'}
            </button>

            <button
              type="button"
              onClick={handleForceCalendarSync}
              disabled={isSyncingGCal}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition disabled:opacity-50"
              title="Trigger Immediate Calendar Sync"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGCal ? 'animate-spin text-sky-400' : ''}`} />
              Sync Now
            </button>
          </div>

          {/* Purge Calendar Events Button */}
          <button
            type="button"
            onClick={handlePurgeCalendarEvents}
            disabled={isPurgingGCal}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 font-medium rounded-lg transition disabled:opacity-50"
            title="Delete all extension-created events from Google Calendar"
          >
            <Trash2 className={`w-3.5 h-3.5 ${isPurgingGCal ? 'animate-spin text-rose-400' : ''}`} />
            {isPurgingGCal ? 'Purging Google Calendar Events...' : 'Purge Synced GCal Events'}
          </button>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Google Access Token (Optional Manual Override)</label>
          <input
            type="password"
            value={gcalAccessToken}
            onChange={(e) => setGcalAccessToken(e.target.value)}
            placeholder="ya29.a0..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
          />
        </div>
      </div>

      {/* GitHub Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-sm">
          <Github className="w-4 h-4 text-emerald-400" />
          Git-Sync Repository Config
        </div>

        <div>
          <label className="block text-slate-400 mb-1">GitHub Personal Access Token</label>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-slate-400 mb-1">GitHub Owner/User</label>
            <input
              type="text"
              value={githubOwner}
              onChange={(e) => setGithubOwner(e.target.value)}
              placeholder="octocat"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Repository Name</label>
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="cp-solutions"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-slate-300">Auto-Sync Code on Accepted</span>
          <input
            type="checkbox"
            checked={autoSync}
            onChange={(e) => setAutoSync(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {status && (
        <div
          className={`p-2.5 rounded-lg flex items-center gap-2 ${
            status.type === 'success'
              ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
              : 'bg-rose-900/50 text-rose-300 border border-rose-700'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="text-[11px] leading-tight">{status.message}</span>
        </div>
      )}

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-md cursor-pointer"
      >
        <Save className="w-4 h-4" />
        Save Settings
      </button>
    </form>
  );
}
