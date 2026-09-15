import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle, Github, Server, Calendar, RefreshCw, Key } from 'lucide-react';

export function Settings() {
  const [backendUrl, setBackendUrl] = useState('http://localhost:5000');
  const [githubToken, setGithubToken] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [autoSync, setAutoSync] = useState(true);

  // Google Calendar Auto-Sync fields
  const [autoGCalSync, setAutoGCalSync] = useState(true);
  const [gcalAccessToken, setGcalAccessToken] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncingGCal, setIsSyncingGCal] = useState(false);

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
        ],
        (res) => {
          if (res.backendUrl) setBackendUrl(res.backendUrl);
          if (res.githubToken) setGithubToken(res.githubToken);
          if (res.githubOwner) setGithubOwner(res.githubOwner);
          if (res.githubRepo) setGithubRepo(res.githubRepo);
          if (res.autoSync !== undefined) setAutoSync(res.autoSync);
          if (res.autoGCalSync !== undefined) setAutoGCalSync(res.autoGCalSync);
          if (res.gcalAccessToken) setGcalAccessToken(res.gcalAccessToken);
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
      }
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    const payload = {
      backendUrl,
      githubToken,
      githubOwner,
      githubRepo,
      autoSync,
      autoGCalSync,
      gcalAccessToken,
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

  const handleGoogleAuth = () => {
    setIsAuthenticating(true);
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'AUTHENTICATE_GOOGLE_CALENDAR' }, (res) => {
        setIsAuthenticating(false);
        if (res?.success && res.token) {
          setGcalAccessToken(res.token);
          setStatus({ type: 'success', message: 'Google OAuth token retrieved successfully!' });
        } else {
          setStatus({
            type: 'error',
            message: res?.error || 'OAuth login requires client_id in manifest.json or Access Token override below.',
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
            message: `Auto-sync executed! Synced ${res.syncedCount || 0} new contests to Google Calendar.`,
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

  return (
    <form onSubmit={handleSave} className="space-y-4 text-xs">
      {/* Backend Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-sm">
          <Server className="w-4 h-4 text-indigo-400" />
          Backend API Configuration
        </div>
        <div>
          <label className="block text-slate-400 mb-1">Backend Server URL</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://localhost:5000"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            required
          />
        </div>
      </div>

      {/* Google Calendar Background Auto-Sync Section */}
      <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-sm">
          <Calendar className="w-4 h-4 text-sky-400" />
          Google Calendar Background Auto-Sync
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-300">Auto-Sync Contests to Google Calendar</span>
          <input
            type="checkbox"
            checked={autoGCalSync}
            onChange={(e) => setAutoGCalSync(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-sky-600 focus:ring-sky-500"
          />
        </div>

        <div className="pt-1 flex gap-2">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isAuthenticating}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-sky-700 hover:bg-sky-600 text-white font-medium rounded-lg transition disabled:opacity-50"
          >
            <Key className="w-3.5 h-3.5" />
            {isAuthenticating ? 'Authenticating...' : 'Connect Google Account'}
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

        <div>
          <label className="block text-slate-400 mb-1">Google OAuth Access Token (Optional Manual Override)</label>
          <input
            type="password"
            value={gcalAccessToken}
            onChange={(e) => setGcalAccessToken(e.target.value)}
            placeholder="ya29.a0..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
          />
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Used if Google OAuth Client ID is not configured in manifest.
          </span>
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
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Requires 'repo' scope permission
          </span>
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
            className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
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
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-md"
      >
        <Save className="w-4 h-4" />
        Save Settings
      </button>
    </form>
  );
}
