import React, { useState, useEffect } from 'react';
import { Calendar, ExternalLink, Clock, PlayCircle } from 'lucide-react';

export function ContestCard({ contest }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isCoding, setIsCoding] = useState(false);

  useEffect(() => {
    function calculateTime() {
      const now = new Date().getTime();
      const start = new Date(contest.startTime).getTime();
      const end = new Date(contest.endTime).getTime();

      if (now >= start && now <= end) {
        setIsCoding(true);
        const diff = end - now;
        const hrs = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`Ends in ${hrs}h ${mins}m ${secs}s`);
      } else if (now < start) {
        setIsCoding(false);
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
          setTimeLeft(`In ${days}d ${hrs}h ${mins}m`);
        } else {
          setTimeLeft(`In ${hrs}h ${mins}m ${secs}s`);
        }
      } else {
        setTimeLeft('Finished');
      }
    }

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [contest]);

  const handleAddToCalendar = () => {
    const startDate = new Date(contest.startTime);
    const endDate = new Date(contest.endTime);

    // Format dates for Google Calendar ISO string without dashes/colons: YYYYMMDDTHHMMSSZ
    const formatGCalDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

    const startIso = formatGCalDate(startDate);
    const endIso = formatGCalDate(endDate);

    const title = `[${contest.platform}] ${contest.title}`;
    const details = `Competitive Programming Contest on ${contest.platform}.\nLink: ${contest.url}`;
    const location = contest.url;

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${startIso}/${endIso}&details=${encodeURIComponent(
      details
    )}&location=${encodeURIComponent(location)}`;

    window.open(gcalUrl, '_blank');
  };

  const getPlatformBadge = (platform) => {
    switch (platform.toLowerCase()) {
      case 'codeforces':
        return 'bg-blue-900/60 text-blue-300 border-blue-700';
      case 'leetcode':
        return 'bg-amber-900/60 text-amber-300 border-amber-700';
      case 'atcoder':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const formattedDate = new Date(contest.startTime).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const durationHours = (contest.durationSeconds / 3600).toFixed(1);

  return (
    <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-slate-600 transition-all shadow-md">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getPlatformBadge(
            contest.platform
          )}`}
        >
          {contest.platform}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {isCoding ? (
            <span className="flex items-center gap-1 text-emerald-400 font-bold animate-pulse">
              <PlayCircle className="w-3.5 h-3.5" />
              LIVE ({timeLeft})
            </span>
          ) : (
            <span className="flex items-center gap-1 text-indigo-400">
              <Clock className="w-3.5 h-3.5" />
              {timeLeft}
            </span>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-slate-100 text-sm leading-snug mb-2 line-clamp-2">
        {contest.title}
      </h3>

      <div className="text-xs text-slate-400 flex items-center justify-between mb-3">
        <span>Start: {formattedDate}</span>
        <span>Dur: {durationHours}h</span>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-700/60">
        <a
          href={contest.url}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Contest
        </a>
        <button
          onClick={handleAddToCalendar}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          title="Add event to Google Calendar"
        >
          <Calendar className="w-3.5 h-3.5" />
          Add to GCal
        </button>
      </div>
    </div>
  );
}
