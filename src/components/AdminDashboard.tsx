'use client';
import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Compass,
  Eye,
  Gamepad2,
  Layers,
  LogOut,
  RefreshCw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import SetupEditor from './SetupEditor';
import LogoMark from './LogoMark';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActiveRoomSummary, GameMatch } from '@/server/store/types';

type Tab = 'overview' | 'rooms' | 'matches' | 'setups';

export default function AdminDashboard({ email, onLogout }: { email?: string; onLogout?: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([]);
  const [recentMatches, setRecentMatches] = useState<GameMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setActiveRooms(json.activeRooms || []);
          setRecentMatches(json.recentMatches || []);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTimeAgo = (epochMs: number) => {
    const diff = Date.now() - epochMs;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const renderPlayerNames = (playerNames: Record<string, string | null> | string[]) => {
    if (Array.isArray(playerNames)) {
      return playerNames.length ? playerNames.join(', ') : 'Waiting for players';
    }
    const red = playerNames.red || 'Open';
    const silver = playerNames.silver || 'Open';
    return (
      <span className="flex items-center gap-1.5">
        <span className="font-semibold text-red-400">{red}</span>
        <span className="text-muted-foreground">vs</span>
        <span className="font-semibold text-slate-300">{silver}</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-card/80 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex items-center gap-3">
          <LogoMark size={28} />
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">Admin & Live Operations</h1>
            <p className="text-xs text-muted-foreground">Supabase PostgreSQL Live Rooms, Matches & PostHog Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={refreshing} className="gap-1.5 text-xs">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <ThemeToggle />

          {onLogout && (
            <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5 text-xs text-muted-foreground hover:text-destructive">
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          )}

          <a href="/" className="inline-flex items-center gap-1 text-xs font-medium text-laser hover:underline ml-2">
            <ArrowLeft size={14} /> Back to Game
          </a>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-border/60 bg-muted/20 px-4 md:px-8">
        <div className="flex gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setTab('overview')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === 'overview' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Activity size={14} /> Overview & PostHog
          </button>
          <button
            onClick={() => setTab('rooms')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === 'rooms' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Gamepad2 size={14} /> Live Rooms ({activeRooms.length})
          </button>
          <button
            onClick={() => setTab('matches')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === 'matches' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Trophy size={14} /> Match History ({recentMatches.length})
          </button>
          <button
            onClick={() => setTab('setups')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === 'setups' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Layers size={14} /> Board Setup Editor
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="p-4 md:p-8">
        {tab === 'setups' ? (
          <SetupEditor email={email} onLogout={onLogout} />
        ) : loading && activeRooms.length === 0 && recentMatches.length === 0 ? (
          <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">Loading operations data...</div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="border-border/70 bg-card/60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live Active Rooms</CardTitle>
                  <Activity className="h-4 w-4 text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl font-bold text-emerald-400">{activeRooms.length}</div>
                  <p className="text-xs text-muted-foreground">Ongoing games in Supabase</p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Matches Logged</CardTitle>
                  <Trophy className="h-4 w-4 text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl font-bold">{recentMatches.length}</div>
                  <p className="text-xs text-muted-foreground">Saved permanently in Supabase</p>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">PostHog Analytics</CardTitle>
                  <Compass className="h-4 w-4 text-laser" />
                </CardHeader>
                <CardContent>
                  <div className="font-display text-base font-bold text-laser flex items-center gap-1.5">
                    Session Replay & Funnels <Sparkles size={16} />
                  </div>
                  <p className="text-xs text-muted-foreground">Organic traffic, recordings & errors</p>
                </CardContent>
              </Card>
            </div>

            {/* TAB: OVERVIEW */}
            {tab === 'overview' && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* PostHog Card */}
                <Card className="glow-primary border-border/70 bg-card/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <Compass size={18} className="text-laser" /> PostHog Analytics & Session Replay
                    </CardTitle>
                    <CardDescription>Watch user gameplay sessions, debug client errors, and inspect organic traffic funnels</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      PostHog is integrated client-side. It automatically captures visitor session recordings, console errors, pageviews, and organic referrers (Reddit, Twitter, Google, etc.).
                    </p>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2 text-xs">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" /> What to look for in PostHog:
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><strong>Session Replay</strong>: Watch player cursor movements & board clicks.</li>
                        <li><strong>Web Analytics</strong>: See top referrers, devices, and countries.</li>
                        <li><strong>Error Tracking</strong>: Inspect client exceptions linked to recordings.</li>
                      </ul>
                    </div>
                    <a
                      href="https://us.posthog.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow"
                    >
                      Open PostHog Dashboard <ArrowUpRight size={14} />
                    </a>
                  </CardContent>
                </Card>

                {/* Quick Live Rooms Preview */}
                <Card className="border-border/70 bg-card/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-base">
                      <Gamepad2 size={18} className="text-emerald-400" /> Active Live Rooms
                    </CardTitle>
                    <CardDescription>Live games currently open in Supabase</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeRooms.length > 0 ? (
                      <div className="space-y-2.5">
                        {activeRooms.slice(0, 5).map((room) => (
                          <div key={room.code} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-laser">{room.code}</span>
                              <span className="capitalize text-muted-foreground">{room.gameSlug}</span>
                              <span>{renderPlayerNames(room.playerNames)}</span>
                            </div>
                            <a
                              href={`/games/${room.gameSlug}?room=${room.code}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
                            >
                              <Eye size={12} /> Spectate
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground">No live rooms active right now.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: LIVE ROOMS */}
            {tab === 'rooms' && (
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <Gamepad2 size={18} className="text-laser" /> Active Live Rooms Monitor
                  </CardTitle>
                  <CardDescription>Rooms currently active or created in the last 2 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeRooms.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border/60 text-muted-foreground">
                            <th className="pb-2 font-semibold">Room Code</th>
                            <th className="pb-2 font-semibold">Game</th>
                            <th className="pb-2 font-semibold">Players</th>
                            <th className="pb-2 font-semibold">Type</th>
                            <th className="pb-2 font-semibold">Status</th>
                            <th className="pb-2 font-semibold">Last Active</th>
                            <th className="pb-2 text-right font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {activeRooms.map((room) => (
                            <tr key={room.code} className="hover:bg-muted/30">
                              <td className="py-3 font-mono font-bold text-laser tracking-wider">{room.code}</td>
                              <td className="py-3 capitalize">
                                <span className="inline-block rounded bg-primary/20 px-2 py-0.5 font-medium text-primary text-[11px]">
                                  {room.gameSlug}
                                </span>
                              </td>
                              <td className="py-3">{renderPlayerNames(room.playerNames)}</td>
                              <td className="py-3">
                                {room.isBot ? (
                                  <span className="inline-flex items-center gap-1 text-amber-400">
                                    <Bot size={13} /> Bot ({room.botDifficulty || 'Standard'})
                                  </span>
                                ) : room.isRanked ? (
                                  <span className="inline-flex items-center gap-1 text-purple-400 font-medium">Ranked 1v1</span>
                                ) : (
                                  <span className="text-muted-foreground">Casual PvP</span>
                                )}
                              </td>
                              <td className="py-3 capitalize">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    room.status === 'in_progress'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : room.status === 'finished'
                                      ? 'bg-muted text-muted-foreground'
                                      : 'bg-amber-500/20 text-amber-400'
                                  }`}
                                >
                                  {room.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 text-muted-foreground">{formatTimeAgo(room.updatedAt)}</td>
                              <td className="py-3 text-right">
                                <a
                                  href={`/games/${room.gameSlug}?room=${room.code}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground hover:bg-secondary/80"
                                >
                                  <Eye size={12} /> Spectate
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">No live rooms active right now. Start a new game to see it live here!</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TAB: MATCH HISTORY */}
            {tab === 'matches' && (
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <Trophy size={18} className="text-amber-400" /> Permanent Match History
                  </CardTitle>
                  <CardDescription>Recently completed games logged to Supabase PostgreSQL</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentMatches.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border/60 text-muted-foreground">
                            <th className="pb-2 font-semibold">Date & Time</th>
                            <th className="pb-2 font-semibold">Game</th>
                            <th className="pb-2 font-semibold">Players</th>
                            <th className="pb-2 font-semibold">Winner</th>
                            <th className="pb-2 font-semibold">Moves / Turns</th>
                            <th className="pb-2 font-semibold">Duration</th>
                            <th className="pb-2 font-semibold">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {recentMatches.map((m) => (
                            <tr key={m.id} className="hover:bg-muted/30">
                              <td className="py-3 text-muted-foreground font-mono text-[11px]">
                                {new Date(m.endedAt).toLocaleDateString()} {new Date(m.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-3">
                                <span className="inline-block rounded bg-primary/20 px-2 py-0.5 font-medium text-primary text-[11px] capitalize">
                                  {m.gameSlug}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className="font-medium">{m.player1Name || 'Player 1'}</span>
                                <span className="mx-1 text-muted-foreground">vs</span>
                                <span className="font-medium">{m.player2Name || (m.isBot ? `Bot (${m.botDifficulty})` : 'Player 2')}</span>
                              </td>
                              <td className="py-3">
                                {m.winnerName ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                                    <Trophy size={12} /> {m.winnerName}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Draw / None</span>
                                )}
                              </td>
                              <td className="py-3 font-mono">{m.movesCount}</td>
                              <td className="py-3 font-mono text-muted-foreground">{formatDuration(m.durationSeconds)}</td>
                              <td className="py-3 capitalize">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                                    m.status === 'completed'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : m.status === 'forfeit'
                                      ? 'bg-red-500/20 text-red-400'
                                      : 'bg-amber-500/20 text-amber-400'
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-sm text-muted-foreground">No matches completed yet. When games end, they are logged permanently in Supabase.</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
