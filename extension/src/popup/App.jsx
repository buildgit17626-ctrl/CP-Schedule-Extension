import React, { useState, useEffect } from 'react';
import { ContestCard } from './components/ContestCard.jsx';
import { Settings } from './components/Settings.jsx';
import { Calendar, Settings as SettingsIcon, RefreshCw, Code2, AlertTriangle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('contests'); // 'contests' | 'settings'
  const [selectedPlatform, setSelectedPlatform] = useState('ALL');
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendUrl, setBackendUrl] = useState('http://localhost:5000');

  useEffect(() => {
    // Read backend URL from storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['backendUrl'], (res) => {
        if (res.backendUrl) {
          setBackendUrl(res.backendUrl);
          fetchContests(res.backendUrl);
        } else {
          fetchContests('https://cp-schedule-extension.onrender.com');
        }
      });
    } else {
      fetchContests('https://cp-schedule-extension.onrender.com');
    }
  }, []);

  const fetchContests = async (baseUrl = backendUrl) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/api/v1/contests`);
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setContests(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch contests');
      }
    } catch (err) {
      console.error('Failed to load contests:', err);
      setError(err.message || 'Cannot connect to Custom Contest Backend API');
    } finally {
      setLoading(false);
    }
  };

  const filteredContests = contests.filter((c) => {
    if (selectedPlatform === 'ALL') return true;
    return c.platform.toUpperCase() === selectedPlatform.toUpperCase();
  });
  const visibleContests = activeTab === 'unstop'
    ? contests.filter((contest) => contest.platform === 'Unstop')
    : activeTab === 'kattis'
      ? contests.filter((contest) => contest.platform === 'Kattis')
    : filteredContests;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 p-4">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-100 leading-none">CP Sync Ecosystem</h1>
            <span className="text-[10px] text-slate-400">Contest Schedule & Git Solution Sync</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setActiveTab('contests')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
              activeTab === 'contests'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Contests
          </button>
          <button
            onClick={() => setActiveTab('unstop')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
              activeTab === 'unstop'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Unstop
          </button>
          <button
            onClick={() => setActiveTab('kattis')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
              activeTab === 'kattis'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Kattis
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-2 py-1 text-xs font-medium rounded-md transition flex items-center gap-1 ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Tab: Contests */}
      {(activeTab === 'contests' || activeTab === 'unstop' || activeTab === 'kattis') && (
        <div className="flex-1 flex flex-col space-y-3">
          {activeTab === 'unstop' && (
            <div className="text-xs text-slate-400">Competitive programming contests from Unstop</div>
          )}
          {activeTab === 'kattis' && (
            <div className="text-xs text-slate-400">Open Kattis contests</div>
          )}
          {/* Controls bar */}
          {activeTab === 'contests' && <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-800/70 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto max-w-[320px] scrollbar-none">
              {['ALL', 'Codeforces', 'LeetCode', 'CodeChef', 'HackerCup', 'Meta', 'Google'].map((pf) => (
                <button
                  key={pf}
                  onClick={() => setSelectedPlatform(pf)}
                  className={`px-2 py-0.5 rounded font-medium transition text-[11px] whitespace-nowrap ${
                    selectedPlatform === pf
                      ? 'bg-slate-700 text-slate-100 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pf}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchContests()}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50 shrink-0"
              title="Refresh Schedule"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>}

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Backend Unreachable</p>
                <p className="text-[11px] text-rose-400/90">{error}</p>
                <button
                  onClick={() => fetchContests()}
                  className="mt-2 px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 rounded font-medium text-[11px] transition"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {/* Contest Cards List */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
            {loading && contests.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading upcoming contests...
              </div>
            ) : visibleContests.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 bg-slate-800/40 rounded-xl border border-slate-800">
                No upcoming contests found for {activeTab === 'unstop' ? 'Unstop' : activeTab === 'kattis' ? 'Kattis' : selectedPlatform}.
              </div>
            ) : (
              visibleContests.map((contest) => (
                <ContestCard key={`${contest.platform}_${contest.contestId}`} contest={contest} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && <Settings />}

      {/* Footer status bar */}
      <footer className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
        <span>CP-Sync Ecosystem v1.2.2</span>
        <span className="flex items-center gap-1 text-emerald-500 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Git-Sync Active
        </span>
      </footer>
    </div>
  );
}
