"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Phone, PhoneCall, PhoneMissed, PhoneOff, PhoneIncoming,
    Star, ExternalLink, MapPin, ChevronLeft, ChevronRight,
    Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp,
    Calendar, MessageSquare, RefreshCw, Target, Zap, X,
    Users, Trophy, Ban, Activity, ArrowRight, Voicemail,
    ThumbsUp, ThumbsDown, SkipForward, Filter, StickyNote,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
    id: number;
    name: string;
    category: string;
    address: string;
    city: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    reviewCount: number | null;
    leadScore: number;
    crmStatus: string;
    callCount: number;
    lastCalledAt: string | null;
    nextFollowUp: string | null;
    qualificationNotes: string | null;
    emails: string | null;
    notes: string | null;
    hasWebsite: boolean;
    estimatedValue: number | null;
    websitePainPoints: string | null;
}

interface CallLog {
    id: number;
    type: string;
    outcome: string;
    notes: string | null;
    duration: number | null;
    createdAt: string;
}

interface CrmStats {
    new: number;
    attempting: number;
    connected: number;
    qualified: number;
    disqualified: number;
    closed_won: number;
    closed_lost: number;
    totalCalls: number;
    followUpsDueToday: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CRM_STATUSES: { key: string; label: string; color: string; bg: string; border: string; icon: React.ElementType }[] = [
    { key: "new", label: "New", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30", icon: Users },
    { key: "attempting", label: "Attempting", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Phone },
    { key: "connected", label: "Connected", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: PhoneIncoming },
    { key: "qualified", label: "Qualified", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2 },
    { key: "closed_won", label: "Closed Won", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: Trophy },
    { key: "disqualified", label: "Disqualified", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: Ban },
    { key: "closed_lost", label: "Closed Lost", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/30", icon: XCircle },
];

const CALL_OUTCOMES: { key: string; label: string; icon: React.ElementType; color: string; suggestedStatus?: string }[] = [
    { key: "answered", label: "Answered", icon: PhoneCall, color: "text-emerald-400", suggestedStatus: "connected" },
    { key: "interested", label: "Interested!", icon: ThumbsUp, color: "text-blue-400", suggestedStatus: "qualified" },
    { key: "callback", label: "Callback Requested", icon: PhoneIncoming, color: "text-amber-400", suggestedStatus: "attempting" },
    { key: "voicemail", label: "Left Voicemail", icon: Voicemail, color: "text-indigo-400", suggestedStatus: "attempting" },
    { key: "no_answer", label: "No Answer", icon: PhoneOff, color: "text-zinc-400", suggestedStatus: "attempting" },
    { key: "not_interested", label: "Not Interested", icon: ThumbsDown, color: "text-red-400", suggestedStatus: "disqualified" },
    { key: "left_message", label: "Left Message", icon: MessageSquare, color: "text-sky-400", suggestedStatus: "attempting" },
];

const API = "http://localhost:3001/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getStatusInfo(key: string) {
    return CRM_STATUSES.find(s => s.key === key) ?? CRM_STATUSES[0];
}

function getOutcomeInfo(key: string) {
    return CALL_OUTCOMES.find(o => o.key === key);
}

function ScoreBadge({ score }: { score: number }) {
    const cls = score >= 70 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
        : score >= 40 ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
            : "bg-red-500/20 text-red-400 border-red-500/40";
    return <Badge variant="outline" className={`${cls} font-mono text-xs`}>{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
    const info = getStatusInfo(status);
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${info.bg} ${info.color} ${info.border}`}>
            <info.icon className="h-3 w-3" />
            {info.label}
        </span>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CRMPage() {
    const [stats, setStats] = useState<CrmStats | null>(null);
    const [queue, setQueue] = useState<Lead[]>([]);
    const [queueIdx, setQueueIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [queueFilter, setQueueFilter] = useState("all");
    const [minScore, setMinScore] = useState("0");
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [showCallModal, setShowCallModal] = useState(false);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const [savingCall, setSavingCall] = useState(false);

    // Call modal state
    const [callOutcome, setCallOutcome] = useState("");
    const [callNotes, setCallNotes] = useState("");
    const [callDuration, setCallDuration] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");
    const [qualNotes, setQualNotes] = useState("");
    const [overrideStatus, setOverrideStatus] = useState("");
    const [activityType, setActivityType] = useState("call");
    const [estimatedValue, setEstimatedValue] = useState("");

    const currentLead = queue[queueIdx] ?? null;

    // ── Fetch ────────────────────────────────────────────────────────────────

    const fetchStats = useCallback(async () => {
        try {
            const r = await axios.get(`${API}/crm/stats`);
            setStats(r.data);
        } catch { /* ignore */ }
    }, []);

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status: queueFilter, minScore, limit: "100" });
            const r = await axios.get(`${API}/crm/queue?${params}`);
            setQueue(r.data);
            setQueueIdx(0);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [queueFilter, minScore]);

    const fetchCallLogs = useCallback(async (leadId: number) => {
        try {
            const r = await axios.get(`${API}/leads/${leadId}/calls`);
            setCallLogs(r.data);
        } catch { setCallLogs([]); }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { fetchQueue(); }, [fetchQueue]);
    useEffect(() => {
        if (currentLead) {
            setQualNotes(currentLead.qualificationNotes || "");
            fetchCallLogs(currentLead.id);
            setShowHistoryPanel(false);
        }
    }, [currentLead, fetchCallLogs]);

    // ── Actions ──────────────────────────────────────────────────────────────

    const updateCrmStatus = async (leadId: number, crmStatus: string, extra?: object) => {
        try {
            const updated = await axios.patch(`${API}/leads/${leadId}/crm`, { crmStatus, ...extra });
            setQueue(q => q.map(l => l.id === leadId ? { ...l, ...updated.data } : l));
            fetchStats();
        } catch { alert("Failed to update status"); }
    };

    const saveQualNotes = async () => {
        if (!currentLead) return;
        try {
            await axios.patch(`${API}/leads/${currentLead.id}/crm`, { qualificationNotes: qualNotes });
            setQueue(q => q.map(l => l.id === currentLead.id ? { ...l, qualificationNotes: qualNotes } : l));
        } catch { /* silent */ }
    };

    const openCallModal = () => {
        const out = CALL_OUTCOMES.find(o => o.suggestedStatus === currentLead?.crmStatus);
        setCallOutcome("");
        setCallNotes("");
        setCallDuration("");
        setFollowUpDate("");
        setActivityType("call");
        setEstimatedValue(currentLead?.estimatedValue ? currentLead.estimatedValue.toString() : "");
        setOverrideStatus(currentLead?.crmStatus || "attempting");
        setShowCallModal(true);
    };

    const handleOutcomeSelect = (key: string) => {
        setCallOutcome(key);
        const info = getOutcomeInfo(key);
        if (info?.suggestedStatus) setOverrideStatus(info.suggestedStatus);
    };

    const submitCall = async () => {
        if (!currentLead || !callOutcome) return;
        setSavingCall(true);
        try {
            await axios.post(`${API}/leads/${currentLead.id}/calls`, {
                type: activityType,
                outcome: callOutcome,
                notes: callNotes || null,
                duration: callDuration ? parseInt(callDuration) * 60 : null,
                crmStatus: overrideStatus,
            });

            const patchData: any = {};
            if (followUpDate) patchData.nextFollowUp = followUpDate;
            if (qualNotes !== currentLead.qualificationNotes) patchData.qualificationNotes = qualNotes;
            if (estimatedValue !== (currentLead.estimatedValue?.toString() || "")) {
                patchData.estimatedValue = estimatedValue ? parseFloat(estimatedValue) : null;
            }

            if (Object.keys(patchData).length > 0) {
                await axios.patch(`${API}/leads/${currentLead.id}/crm`, patchData);
            }

            // Refresh current lead in queue
            setQueue(q => q.map(l => l.id === currentLead.id ? {
                ...l,
                crmStatus: overrideStatus,
                callCount: activityType === 'call' ? l.callCount + 1 : l.callCount,
                lastCalledAt: new Date().toISOString(),
                nextFollowUp: patchData.nextFollowUp || l.nextFollowUp,
                qualificationNotes: patchData.qualificationNotes || l.qualificationNotes,
                estimatedValue: patchData.estimatedValue !== undefined ? patchData.estimatedValue : l.estimatedValue,
            } : l));
            fetchCallLogs(currentLead.id);
            fetchStats();
            setShowCallModal(false);
            // Auto-advance to next lead
            setQueueIdx(i => Math.min(i + 1, queue.length - 1));
        } catch { alert("Failed to log call"); }
        finally { setSavingCall(false); }
    };

    const handleSkip = () => setQueueIdx(i => Math.min(i + 1, queue.length - 1));
    const handlePrev = () => setQueueIdx(i => Math.max(i - 1, 0));

    const handleQuickStatus = async (status: string) => {
        if (!currentLead) return;
        await updateCrmStatus(currentLead.id, status);
        if (status === "disqualified" || status === "closed_won" || status === "closed_lost") {
            setQueueIdx(i => Math.min(i + 1, queue.length - 1));
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const totalActive = stats ? (stats.new + stats.attempting + stats.connected + stats.qualified) : 0;

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <PhoneCall className="h-7 w-7 text-primary" />
                        Sales CRM
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Qualify leads, log calls, and track your pipeline — powered by Apollo.io + Close CRM style workflow.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchQueue(); }} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
            </div>

            {/* ── Pipeline Stats Bar ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {CRM_STATUSES.map(({ key, label, color, bg, border, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setQueueFilter(key === queueFilter ? "all" : key)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center cursor-pointer hover:scale-105 active:scale-95 ${bg} ${border} ${queueFilter === key ? "ring-2 ring-primary/60 scale-105" : ""}`}
                    >
                        <Icon className={`h-5 w-5 ${color} mb-1`} />
                        <span className={`text-xl font-bold ${color}`}>{stats?.[key as keyof CrmStats] ?? "—"}</span>
                        <span className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</span>
                    </button>
                ))}
                <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-primary/20 bg-primary/5 text-center">
                    <Activity className="h-5 w-5 text-primary mb-1" />
                    <span className="text-xl font-bold text-primary">{stats?.totalCalls ?? "—"}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">Total Calls</span>
                </div>
            </div>

            {/* Follow-ups Due Banner */}
            {stats && stats.followUpsDueToday > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>{stats.followUpsDueToday} follow-up{stats.followUpsDueToday > 1 ? "s" : ""} due today!</span>
                    <Button size="sm" variant="outline" className="ml-auto border-amber-500/40 text-amber-400 hover:bg-amber-500/20 h-7 text-xs"
                        onClick={() => setQueueFilter("all")}>
                        View Queue
                    </Button>
                </div>
            )}

            {/* Main Grid: Dialer + Pipeline */}
            <div className="grid lg:grid-cols-5 gap-6">

                {/* ── Dialer Panel ──────────────────────────────────────────── */}
                <div className="lg:col-span-3 space-y-4">

                    {/* Queue Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Filter className="h-3.5 w-3.5" /> Queue:
                        </div>
                        <div className="flex gap-1 flex-wrap">
                            {["all", "new", "attempting", "connected", "qualified"].map(s => (
                                <Button key={s} size="sm" variant={queueFilter === s ? "default" : "outline"}
                                    className="h-7 text-xs capitalize"
                                    onClick={() => setQueueFilter(s)}>
                                    {s === "all" ? "All Active" : s}
                                </Button>
                            ))}
                        </div>
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Min Score:</span>
                            <Input type="number" value={minScore} onChange={e => setMinScore(e.target.value)}
                                className="h-7 w-14 text-xs" placeholder="0" />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {queue.length > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{queueIdx + 1} of {queue.length} leads</span>
                                <span>{Math.round(((queueIdx) / queue.length) * 100)}% through queue</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-500"
                                    style={{ width: `${((queueIdx) / Math.max(queue.length - 1, 1)) * 100}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Lead Card */}
                    {loading ? (
                        <div className="rounded-2xl border bg-card p-12 flex items-center justify-center text-muted-foreground">
                            <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading queue...
                        </div>
                    ) : !currentLead ? (
                        <div className="rounded-2xl border bg-card p-12 text-center space-y-3">
                            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                            <p className="font-semibold">Queue complete!</p>
                            <p className="text-sm text-muted-foreground">No more leads in this filter. Change the queue filter or rescore to reprioritize.</p>
                            <Button size="sm" onClick={fetchQueue} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Reload Queue</Button>
                        </div>
                    ) : (
                        <div className="rounded-2xl border bg-card overflow-hidden">
                            {/* Status bar */}
                            <div className={`px-5 py-2 border-b ${getStatusInfo(currentLead.crmStatus).bg} ${getStatusInfo(currentLead.crmStatus).border} flex items-center justify-between`}>
                                <StatusBadge status={currentLead.crmStatus} />
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {currentLead.callCount > 0 && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> {currentLead.callCount} call{currentLead.callCount !== 1 ? "s" : ""}
                                        </span>
                                    )}
                                    {currentLead.lastCalledAt && (
                                        <span>Last: {formatDistanceToNow(new Date(currentLead.lastCalledAt), { addSuffix: true })}</span>
                                    )}
                                </div>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Name + Score */}
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-bold">{currentLead.name}</h2>
                                        <p className="text-sm text-muted-foreground">{currentLead.category}</p>
                                    </div>
                                    <ScoreBadge score={currentLead.leadScore} />
                                </div>

                                {/* Contact Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    {currentLead.phone && (
                                        <a href={`tel:${currentLead.phone}`}
                                            className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors group">
                                            <PhoneCall className="h-5 w-5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-emerald-300/70">Phone</p>
                                                <p className="text-sm font-medium truncate">{currentLead.phone}</p>
                                            </div>
                                        </a>
                                    )}
                                    {currentLead.website && currentLead.website !== "None" && (
                                        <a href={currentLead.website} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors">
                                            <ExternalLink className="h-5 w-5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-blue-300/70">Website</p>
                                                <p className="text-sm font-medium truncate">{currentLead.website.replace(/^https?:\/\//, "")}</p>
                                            </div>
                                        </a>
                                    )}
                                    {currentLead.emails && (
                                        <a href={`mailto:${currentLead.emails.split(",")[0].trim()}`}
                                            className="flex items-center gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 transition-colors">
                                            <MessageSquare className="h-5 w-5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-violet-300/70">Email</p>
                                                <p className="text-sm font-medium truncate">{currentLead.emails.split(",")[0].trim()}</p>
                                            </div>
                                        </a>
                                    )}
                                    {(currentLead.city || currentLead.address) && (
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentLead.name} ${currentLead.address || currentLead.city}`)}`}
                                            target="_blank" rel="noreferrer"
                                            className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors">
                                            <MapPin className="h-5 w-5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs text-amber-300/70">Location</p>
                                                <p className="text-sm font-medium truncate">{currentLead.city || currentLead.address}</p>
                                            </div>
                                        </a>
                                    )}
                                </div>

                                {/* Rating */}
                                {currentLead.rating && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                        <span className="text-foreground font-medium">{currentLead.rating}</span>
                                        {currentLead.reviewCount && <span>({currentLead.reviewCount} reviews)</span>}
                                    </div>
                                )}

                                {/* Next Follow-up */}
                                {currentLead.nextFollowUp && (
                                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${isToday(new Date(currentLead.nextFollowUp)) ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : isBefore(new Date(currentLead.nextFollowUp), startOfDay(new Date())) ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-muted border-border text-muted-foreground"}`}>
                                        <Clock className="h-3.5 w-3.5" />
                                        Follow-up: {format(new Date(currentLead.nextFollowUp), "MMM d, yyyy")}
                                        {isToday(new Date(currentLead.nextFollowUp)) && <span className="ml-1 font-bold">TODAY</span>}
                                    </div>
                                )}

                                {/* Qualification Notes */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <StickyNote className="h-3 w-3" /> Qualification Notes
                                    </label>
                                    <textarea
                                        value={qualNotes}
                                        onChange={e => setQualNotes(e.target.value)}
                                        onBlur={saveQualNotes}
                                        placeholder="What did you find out about this lead? Pain points, budget, decision maker..."
                                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs min-h-[72px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground/50"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-1">
                                    <Button onClick={openCallModal}
                                        className="flex-1 bg-primary hover:bg-primary/90 gap-2 font-semibold text-sm h-11">
                                        <Phone className="h-4 w-4" /> Log a Call
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowHistoryPanel(v => !v)} className="gap-1.5 h-11 text-xs">
                                        <Activity className="h-4 w-4" />
                                        <span className="hidden sm:inline">History</span>
                                        {callLogs.length > 0 && (
                                            <span className="ml-1 rounded-full bg-primary/20 text-primary text-[10px] w-4 h-4 flex items-center justify-center font-bold">{callLogs.length}</span>
                                        )}
                                    </Button>
                                </div>

                                {/* Quick Status Buttons */}
                                <div className="border-t pt-3 space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Quick Actions</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            { key: "qualified", label: "✓ Qualified", cls: "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20" },
                                            { key: "closed_won", label: "🏆 Won!", cls: "border-purple-500/40 text-purple-400 hover:bg-purple-500/20" },
                                            { key: "disqualified", label: "✗ Disqualify", cls: "border-red-500/40 text-red-400 hover:bg-red-500/20" },
                                            { key: "closed_lost", label: "Lost", cls: "border-zinc-500/40 text-zinc-400 hover:bg-zinc-500/20" },
                                        ].map(({ key, label, cls }) => (
                                            <Button key={key} size="sm" variant="outline"
                                                className={`h-7 text-xs ${cls}`}
                                                onClick={() => handleQuickStatus(key)}>
                                                {label}
                                            </Button>
                                        ))}
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground ml-auto gap-1" onClick={handleSkip}>
                                            Skip <SkipForward className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation */}
                            <div className="border-t px-5 py-3 flex items-center justify-between bg-muted/20">
                                <Button variant="ghost" size="sm" onClick={handlePrev} disabled={queueIdx === 0} className="gap-1 text-xs">
                                    <ChevronLeft className="h-4 w-4" /> Previous
                                </Button>
                                <span className="text-xs text-muted-foreground font-mono">{queueIdx + 1} / {queue.length}</span>
                                <Button variant="ghost" size="sm" onClick={handleSkip} disabled={queueIdx >= queue.length - 1} className="gap-1 text-xs">
                                    Next <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Call History Panel */}
                    {showHistoryPanel && currentLead && (
                        <div className="rounded-xl border bg-card p-4 space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" /> Call History — {currentLead.name}
                            </h3>
                            {callLogs.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-4 text-center">No calls logged yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {callLogs.map(log => {
                                        const outInfo = getOutcomeInfo(log.outcome);
                                        return (
                                            <div key={log.id} className="flex gap-3 p-2.5 rounded-lg bg-muted/40 text-xs">
                                                {outInfo && <outInfo.icon className={`h-4 w-4 ${outInfo.color} shrink-0 mt-0.5`} />}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between gap-2">
                                                        <span className={`font-medium capitalize ${outInfo?.color}`}>{outInfo?.label ?? log.outcome}</span>
                                                        <span className="text-muted-foreground shrink-0">
                                                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    {log.notes && <p className="text-muted-foreground mt-0.5 truncate">{log.notes}</p>}
                                                    {log.duration && <p className="text-muted-foreground">{Math.floor(log.duration / 60)}m {log.duration % 60}s</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Pipeline Funnel + Leaderboard ─────────────────────────── */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Pipeline Funnel */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" /> Sales Pipeline
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {[
                                { key: "new", label: "New Leads", prob: 5 },
                                { key: "attempting", label: "Attempting Contact", prob: 15 },
                                { key: "connected", label: "Connected", prob: 35 },
                                { key: "qualified", label: "Qualified", prob: 65 },
                                { key: "closed_won", label: "Closed Won", prob: 100 },
                            ].map(({ key, label, prob }) => {
                                const info = getStatusInfo(key);
                                const count = stats?.[key as keyof CrmStats] ?? 0;
                                const maxCount = Math.max(
                                    stats?.new ?? 0, stats?.attempting ?? 0, stats?.connected ?? 0,
                                    stats?.qualified ?? 0, stats?.closed_won ?? 0, 1
                                );
                                return (
                                    <div key={key} className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className={`font-medium ${info.color}`}>{label}</span>
                                            <span className="text-muted-foreground font-mono">{count} • {prob}%</span>
                                        </div>
                                        <div className="h-6 bg-muted rounded-md overflow-hidden relative">
                                            <div
                                                className={`h-full rounded-md transition-all duration-700 ${info.bg} border-r-2 ${info.border}`}
                                                style={{ width: `${(Number(count) / maxCount) * 100}%` }}
                                            />
                                            <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold ${info.color}`}>
                                                {count}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* Quick Stats */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-400" /> Today's Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-xs text-muted-foreground">Total Calls Made</span>
                                <span className="text-sm font-bold text-primary">{stats?.totalCalls ?? 0}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-xs text-muted-foreground">Follow-ups Due</span>
                                <span className={`text-sm font-bold ${(stats?.followUpsDueToday ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                                    {stats?.followUpsDueToday ?? 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-xs text-muted-foreground">Active Leads</span>
                                <span className="text-sm font-bold">{totalActive}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-xs text-muted-foreground">Closed Won</span>
                                <span className="text-sm font-bold text-purple-400">{stats?.closed_won ?? 0}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Queue List Preview */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-400" /> Queue Preview
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                            {queue.slice(0, 20).map((lead, idx) => (
                                <button key={lead.id} onClick={() => setQueueIdx(idx)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${idx === queueIdx ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"}`}>
                                    <span className="text-muted-foreground font-mono w-5 shrink-0">{idx + 1}</span>
                                    <span className="flex-1 truncate font-medium">{lead.name}</span>
                                    <StatusBadge status={lead.crmStatus} />
                                </button>
                            ))}
                            {queue.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-4">No leads in queue.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Call Logger Modal ─────────────────────────────────────────── */}
            <Dialog open={showCallModal} onOpenChange={open => !open && setShowCallModal(false)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" />
                            Log Activity — {currentLead?.name}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-1">
                        {/* Activity Type Selector */}
                        <div className="flex bg-muted p-1 rounded-lg">
                            {["call", "email", "note"].map((type) => (
                                <button key={type} onClick={() => setActivityType(type)}
                                    className={`flex-1 text-xs py-1.5 capitalize rounded-md transition-colors ${activityType === type ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                                    {type}
                                </button>
                            ))}
                        </div>

                        {/* Outcome Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Activity Outcome *</label>
                            <div className="grid grid-cols-2 gap-2">
                                {CALL_OUTCOMES.map(({ key, label, icon: Icon, color }) => (
                                    <button key={key}
                                        onClick={() => handleOutcomeSelect(key)}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all text-left ${callOutcome === key
                                            ? `border-primary bg-primary/10 ${color} font-medium ring-1 ring-primary/40`
                                            : "border-border hover:border-primary/30 hover:bg-muted/50"
                                            }`}>
                                        <Icon className={`h-4 w-4 shrink-0 ${callOutcome === key ? color : "text-muted-foreground"}`} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Update Status */}
                        {callOutcome && (
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">Update Lead Status To</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {CRM_STATUSES.filter(s => !["closed_won", "closed_lost"].includes(s.key)).map(({ key, label, color, bg, border }) => (
                                        <button key={key}
                                            onClick={() => setOverrideStatus(key)}
                                            className={`px-2.5 py-1 rounded-full text-xs border transition-all ${overrideStatus === key ? `${bg} ${color} ${border} font-medium ring-1 ring-primary/30` : "border-border text-muted-foreground hover:border-primary/30"}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Call Notes</label>
                            <textarea
                                value={callNotes}
                                onChange={e => setCallNotes(e.target.value)}
                                placeholder="What was discussed? Key objections, interest level, next steps..."
                                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm min-h-[80px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>

                        {/* Duration + Follow-up */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                                <Input type="number" value={callDuration} onChange={e => setCallDuration(e.target.value)}
                                    placeholder="e.g. 5" className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Follow-up Date
                                </label>
                                <Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
                                    className="h-8 text-sm" />
                            </div>
                        </div>

                        {/* Deal Revenue */}
                        {(overrideStatus === "qualified" || overrideStatus === "connected" || overrideStatus === "closed_won") && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-emerald-500 font-bold flex items-center gap-1">
                                    <Target className="h-3 w-3" /> Estimated Deal Value ($)
                                </label>
                                <Input type="number" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)}
                                    placeholder="e.g. 2500" className="h-8 text-sm border-emerald-500/30 bg-emerald-500/5 focus-visible:ring-emerald-500" />
                            </div>
                        )}

                        {/* Qual notes */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <StickyNote className="h-3 w-3" /> Update Qualification Notes
                            </label>
                            <textarea
                                value={qualNotes}
                                onChange={e => setQualNotes(e.target.value)}
                                placeholder="Append qualification intel..."
                                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs min-h-[52px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={() => setShowCallModal(false)}>Cancel</Button>
                            <Button onClick={submitCall} disabled={!callOutcome || savingCall}
                                className="gap-2 bg-primary hover:bg-primary/90">
                                {savingCall ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="h-4 w-4" /> Save & Next Lead</>}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
