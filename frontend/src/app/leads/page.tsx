"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { format, formatDistanceToNow } from "date-fns";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ExternalLink, Search, Star, Download, Eye, Zap, Trash2,
    ArrowUpDown, ArrowUp, ArrowDown, Filter, Upload, Copy, RefreshCw,
    History, ChevronDown, ChevronUp, X, Pencil, Check, MapPin,
} from "lucide-react";

interface Lead {
    id: number;
    name: string;
    query: string;
    category: string;
    address: string;
    city: string | null;
    website: string | null;
    phone: string | null;
    rating: number | null;
    reviewCount: number | null;
    hasWebsite: boolean;
    scrapedAt: string;
    websiteStatus: string | null;
    techStack: string | null;
    seoStatus: string | null;
    socials: string | null;
    emails: string | null;
    leadScore: number;
    notes: string | null;
    tags: string | null;
    customFields: Record<string, string> | null;
}

interface AuditLog {
    id: number;
    action: string;
    field: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
}

type SortDir = "asc" | "desc";

export default function LeadsPage() {
    // Data
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);

    // Search & Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterWebsite, setFilterWebsite] = useState<"all" | "yes" | "no">("all");
    const [minRating, setMinRating] = useState<string>("all");
    const [cityFilter, setCityFilter] = useState("");
    const [minReviews, setMinReviews] = useState("");
    const [maxReviews, setMaxReviews] = useState("");
    const [minScore, setMinScore] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);

    // Sorting
    const [sortBy, setSortBy] = useState("scrapedAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLeads, setTotalLeads] = useState(0);

    // Selection & Bulk
    const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
    const [bulkActioning, setBulkActioning] = useState(false);

    // Detail Modal
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [enriching, setEnriching] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Inline Editing
    const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
    const [editValue, setEditValue] = useState("");
    const editInputRef = useRef<HTMLInputElement>(null);

    // Import
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    // ── Data Fetching ──────────────────────────────────────────────────

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append("search", searchTerm);
            if (filterWebsite !== "all") params.append("hasWebsite", filterWebsite);
            if (minRating !== "all") params.append("minRating", minRating);
            if (cityFilter) params.append("city", cityFilter);
            if (minReviews) params.append("minReviews", minReviews);
            if (maxReviews) params.append("maxReviews", maxReviews);
            if (minScore) params.append("minScore", minScore);
            if (categoryFilter) params.append("category", categoryFilter);
            params.append("sortBy", sortBy);
            params.append("sortDir", sortDir);
            params.append("page", page.toString());
            params.append("limit", "50");

            const res = await axios.get(`http://localhost:3001/api/leads?${params.toString()}`);
            setLeads(res.data.data);
            setTotalPages(res.data.pagination.totalPages);
            setTotalLeads(res.data.pagination.total);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterWebsite, minRating, cityFilter, minReviews, maxReviews, minScore, categoryFilter, sortBy, sortDir, page]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    useEffect(() => {
        axios.get("http://localhost:3001/api/leads/categories").then(r => setCategories(r.data)).catch(() => { });
    }, []);

    // ── Sorting ──────────────────────────────────────────────────────

    const handleSort = (col: string) => {
        if (sortBy === col) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortBy(col);
            setSortDir("desc");
        }
        setPage(1);
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortBy !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
        return sortDir === "asc"
            ? <ArrowUp className="ml-1 h-3 w-3 text-primary" />
            : <ArrowDown className="ml-1 h-3 w-3 text-primary" />;
    };

    // ── Selection ────────────────────────────────────────────────────

    const toggleSelectAll = () => {
        if (selectedLeadIds.size === leads.length && leads.length > 0) setSelectedLeadIds(new Set());
        else setSelectedLeadIds(new Set(leads.map(l => l.id)));
    };
    const toggleSelectLead = (id: number) => {
        const s = new Set(selectedLeadIds);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedLeadIds(s);
    };

    // ── Bulk Actions ─────────────────────────────────────────────────

    const handleBulkDelete = async () => {
        if (selectedLeadIds.size === 0) return;
        if (!confirm(`Delete ${selectedLeadIds.size} leads?`)) return;
        setBulkActioning(true);
        try {
            await axios.delete("http://localhost:3001/api/leads/bulk", { data: { ids: Array.from(selectedLeadIds) } });
            setSelectedLeadIds(new Set());
            fetchLeads();
        } catch { alert("Failed to delete leads"); }
        finally { setBulkActioning(false); }
    };

    const handleBulkEnrich = async () => {
        const toEnrich = leads.filter(l => selectedLeadIds.has(l.id) && l.hasWebsite);
        if (toEnrich.length === 0) { alert("No websites to enrich."); return; }
        if (!confirm(`Queue enrichment for ${toEnrich.length} websites?`)) return;
        setBulkActioning(true);
        try {
            await axios.post("http://localhost:3001/api/enrich/bulk", { websites: toEnrich.map(l => l.website) });
            alert(`Queued ${toEnrich.length} for enrichment.`);
            setSelectedLeadIds(new Set());
        } catch { alert("Failed to enrich"); }
        finally { setBulkActioning(false); }
    };

    // ── Inline Editing ───────────────────────────────────────────────

    const startEdit = (id: number, field: string, currentValue: string) => {
        setEditingCell({ id, field });
        setEditValue(currentValue || "");
        setTimeout(() => editInputRef.current?.focus(), 50);
    };

    const saveEdit = async () => {
        if (!editingCell) return;
        try {
            const res = await axios.patch(`http://localhost:3001/api/leads/${editingCell.id}`, {
                [editingCell.field]: editValue,
            });
            setLeads(leads.map(l => l.id === editingCell.id ? res.data : l));
            if (selectedLead?.id === editingCell.id) setSelectedLead(res.data);
        } catch { alert("Failed to save edit"); }
        setEditingCell(null);
    };

    const cancelEdit = () => setEditingCell(null);

    // ── Single Enrich ────────────────────────────────────────────────

    const handleEnrich = async () => {
        if (!selectedLead?.website) return;
        setEnriching(true);
        try {
            const res = await axios.post("http://localhost:3001/api/enrich", { website: selectedLead.website });
            setLeads(leads.map(l => l.id === res.data.id ? res.data : l));
            setSelectedLead(res.data);
        } catch { alert("Enrichment failed."); }
        finally { setEnriching(false); }
    };

    // ── Audit Logs ───────────────────────────────────────────────────

    const fetchAuditLogs = async (leadId: number) => {
        try {
            const res = await axios.get(`http://localhost:3001/api/leads/${leadId}/logs`);
            setAuditLogs(res.data);
        } catch { setAuditLogs([]); }
    };

    const openLeadDetail = (lead: Lead) => {
        setSelectedLead(lead);
        setShowHistory(false);
        fetchAuditLogs(lead.id);
    };

    // ── CSV Import ───────────────────────────────────────────────────

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await axios.post("http://localhost:3001/api/leads/import", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            alert(`Import complete!\n• Imported: ${res.data.imported}\n• Duplicates skipped: ${res.data.duplicatesSkipped}\n• Errors: ${res.data.errors}`);
            fetchLeads();
        } catch { alert("Failed to import CSV"); }
        finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };

    // ── Dedup & Score ────────────────────────────────────────────────

    const handleDedup = async () => {
        if (!confirm("Scan for and merge duplicate leads?")) return;
        try {
            const res = await axios.post("http://localhost:3001/api/leads/deduplicate");
            alert(res.data.message);
            fetchLeads();
        } catch { alert("Deduplication failed"); }
    };

    const handleRecalcScores = async () => {
        try {
            const res = await axios.post("http://localhost:3001/api/leads/score", {});
            alert(res.data.message);
            fetchLeads();
        } catch { alert("Score recalculation failed"); }
    };

    // ── CSV Export ────────────────────────────────────────────────────

    const handleExportCsv = () => {
        if (leads.length === 0) return;
        const headers = ['Name', 'Category', 'City', 'Address', 'Phone', 'Website', 'Has Website', 'Rating', 'Reviews', 'Lead Score', 'Notes', 'Tags', 'Website Status', 'Tech Stack', 'SEO Status', 'Emails', 'Social Links', 'Query', 'Scraped At'];
        const rows = leads.map(l => [
            l.name, l.category, l.city, l.address, l.phone, l.website,
            l.hasWebsite ? 'Yes' : 'No', l.rating, l.reviewCount, l.leadScore,
            l.notes || '', l.tags || '',
            l.websiteStatus || '', l.techStack || '', l.seoStatus || '', l.emails || '', l.socials || '',
            l.query, l.scrapedAt
        ]);
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `leads_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // ── Reset Filters ────────────────────────────────────────────────

    const resetFilters = () => {
        setSearchTerm(""); setFilterWebsite("all"); setMinRating("all");
        setCityFilter(""); setMinReviews(""); setMaxReviews("");
        setMinScore(""); setCategoryFilter(""); setPage(1);
    };

    // ── Score Badge ──────────────────────────────────────────────────

    const ScoreBadge = ({ score }: { score: number }) => {
        const color = score >= 70 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
            : score >= 40 ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-red-500/20 text-red-400 border-red-500/40";
        return <Badge variant="outline" className={`${color} font-mono text-xs`}>{score}</Badge>;
    };

    // ── Editable Cell ────────────────────────────────────────────────

    const EditableCell = ({ lead, field, value }: { lead: Lead; field: string; value: string }) => {
        const isEditing = editingCell?.id === lead.id && editingCell?.field === field;
        if (isEditing) {
            return (
                <div className="flex items-center gap-1">
                    <Input ref={editInputRef} value={editValue} onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="h-7 text-xs w-full" />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit}><Check className="h-3 w-3 text-emerald-500" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}><X className="h-3 w-3" /></Button>
                </div>
            );
        }
        return (
            <div className="group flex items-center gap-1 cursor-pointer" onDoubleClick={() => startEdit(lead.id, field, value)}>
                <span className="truncate">{value || <span className="text-muted-foreground italic">—</span>}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            </div>
        );
    };

    // ── RENDER ────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Leads Database</h1>
                    <p className="text-muted-foreground text-sm">Browse, filter, sort, and manage scraped leads.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input type="file" ref={fileInputRef} accept=".csv" onChange={handleImport} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-1.5">
                        <Upload className="h-3.5 w-3.5" /> {importing ? "Importing..." : "Import CSV"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" /> Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDedup} className="gap-1.5">
                        <Copy className="h-3.5 w-3.5" /> Deduplicate
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRecalcScores} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Rescore
                    </Button>
                </div>
            </div>

            {/* Search + Quick Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={e => { e.preventDefault(); setPage(1); fetchLeads(); }} className="flex gap-2 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="search" placeholder="Search name, phone, city, query..." className="pl-8"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <Button type="submit" variant="secondary" size="sm">Search</Button>
                </form>
                <div className="flex gap-2 items-center flex-wrap">
                    <Button variant={filterWebsite === "all" ? "default" : "outline"} size="sm"
                        onClick={() => { setFilterWebsite("all"); setPage(1); }}>All</Button>
                    <Button variant={filterWebsite === "no" ? "default" : "outline"} size="sm"
                        className={filterWebsite === "no" ? "bg-amber-600 hover:bg-amber-700 border-amber-600" : ""}
                        onClick={() => { setFilterWebsite("no"); setPage(1); }}>Prospects</Button>
                    <Button variant={filterWebsite === "yes" ? "default" : "outline"} size="sm"
                        onClick={() => { setFilterWebsite("yes"); setPage(1); }}>Has Website</Button>
                    <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
                    <select value={minRating} onChange={e => { setMinRating(e.target.value); setPage(1); }}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="all">Any Rating</option>
                        <option value="4.5">4.5+ ★</option>
                        <option value="4.0">4.0+ ★</option>
                        <option value="3.5">3.5+ ★</option>
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className="gap-1 text-xs">
                        <Filter className="h-3.5 w-3.5" /> Filters
                        {showAdvancedFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
                <Card className="border-dashed">
                    <CardContent className="pt-4 pb-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">City</label>
                                <Input value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="e.g. Chicago" className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Category</label>
                                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                                    className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                                    <option value="">All Categories</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Reviews (min - max)</label>
                                <div className="flex gap-1">
                                    <Input type="number" value={minReviews} onChange={e => setMinReviews(e.target.value)} placeholder="0" className="h-8 text-xs" />
                                    <Input type="number" value={maxReviews} onChange={e => setMaxReviews(e.target.value)} placeholder="∞" className="h-8 text-xs" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Min Lead Score</label>
                                <Input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} placeholder="0" className="h-8 text-xs" />
                            </div>
                            <div className="flex items-end gap-1">
                                <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => { setPage(1); fetchLeads(); }}>Apply</Button>
                                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>Reset</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bulk Actions Bar */}
            {selectedLeadIds.size > 0 && (
                <div className="bg-muted border p-2.5 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">{selectedLeadIds.size} selected</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleBulkEnrich} disabled={bulkActioning} className="gap-1.5 text-xs">
                            <Zap className="h-3.5 w-3.5 text-indigo-500" /> Enrich
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkActioning} className="gap-1.5 text-xs">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="rounded-md border bg-card overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[36px]">
                                <Checkbox checked={leads.length > 0 && selectedLeadIds.size === leads.length}
                                    onCheckedChange={toggleSelectAll} aria-label="Select all" />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                                <span className="flex items-center">Name <SortIcon col="name" /></span>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("category")}>
                                <span className="flex items-center">Category <SortIcon col="category" /></span>
                            </TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("rating")}>
                                <span className="flex items-center">Rating <SortIcon col="rating" /></span>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort("reviewCount")}>
                                <span className="flex items-center">Reviews <SortIcon col="reviewCount" /></span>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("leadScore")}>
                                <span className="flex items-center">Score <SortIcon col="leadScore" /></span>
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={9} className="h-24 text-center">Loading leads...</TableCell></TableRow>
                        ) : leads.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="h-24 text-center">No leads found.</TableCell></TableRow>
                        ) : (
                            leads.map(lead => (
                                <TableRow key={lead.id} data-state={selectedLeadIds.has(lead.id) ? "selected" : undefined}>
                                    <TableCell>
                                        <Checkbox checked={selectedLeadIds.has(lead.id)} onCheckedChange={() => toggleSelectLead(lead.id)} />
                                    </TableCell>
                                    <TableCell className="font-medium max-w-[180px]">
                                        <EditableCell lead={lead} field="name" value={lead.name} />
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal truncate max-w-[120px] text-xs">{lead.category || "—"}</Badge>
                                    </TableCell>
                                    <TableCell className="space-y-0.5 text-xs">
                                        <EditableCell lead={lead} field="phone" value={lead.phone || ""} />
                                        {lead.website && lead.website !== "None" && (
                                            <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 w-fit text-xs">
                                                Site <ExternalLink className="h-2.5 w-2.5" />
                                            </a>
                                        )}
                                        {lead.emails && (
                                            <span className="text-emerald-500 truncate block max-w-[160px]" title={lead.emails}>{lead.emails.split(',')[0].trim()}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {lead.rating ? (
                                            <div className="flex items-center gap-1 text-xs font-medium">
                                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {lead.rating}
                                            </div>
                                        ) : <span className="text-muted-foreground text-xs">—</span>}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                        {lead.reviewCount ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        <ScoreBadge score={lead.leadScore} />
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {lead.hasWebsite ? (
                                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 font-normal text-xs">Web</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-amber-500/50 text-amber-500 font-normal text-xs">Prospect</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openLeadDetail(lead)}>
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-muted-foreground">
                <span>Showing {(page - 1) * 50 + (leads.length > 0 ? 1 : 0)} – {(page - 1) * 50 + leads.length} of {totalLeads}</span>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>Previous</Button>
                    <span className="text-foreground font-medium text-xs">Page {page} / {Math.max(1, totalPages)}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Next</Button>
                </div>
            </div>

            {/* ── Lead Detail Modal ──────────────────────────────────── */}
            <Dialog open={!!selectedLead} onOpenChange={open => !open && setSelectedLead(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedLead?.name}
                            <ScoreBadge score={selectedLead?.leadScore ?? 0} />
                        </DialogTitle>
                        <DialogDescription>{selectedLead?.category} • {selectedLead?.city || selectedLead?.address} • {selectedLead?.query}</DialogDescription>
                    </DialogHeader>

                    {selectedLead && (
                        <div className="space-y-4">
                            {/* Tab Toggle */}
                            <div className="flex gap-2 border-b pb-2">
                                <Button variant={!showHistory ? "default" : "ghost"} size="sm" onClick={() => setShowHistory(false)}>Details</Button>
                                <Button variant={showHistory ? "default" : "ghost"} size="sm" onClick={() => setShowHistory(true)} className="gap-1">
                                    <History className="h-3.5 w-3.5" /> History ({auditLogs.length})
                                </Button>
                            </div>

                            {!showHistory ? (
                                <div className="grid gap-3">
                                    <div className="grid grid-cols-4 items-center gap-3">
                                        <span className="text-right font-medium text-muted-foreground text-sm">Address</span>
                                        <div className="col-span-3 text-sm flex items-center gap-2">
                                            <span>{selectedLead.address || "—"}</span>
                                            {selectedLead.address && selectedLead.address !== "N/A" && (
                                                <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" asChild>
                                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedLead.name} ${selectedLead.address}`)}`} target="_blank" rel="noreferrer" title="Open in Google Maps">
                                                        <MapPin className="h-3 w-3 text-blue-500" />
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {[
                                        ["City", selectedLead.city],
                                        ["Phone", selectedLead.phone],
                                    ].map(([label, val]) => (
                                        <div key={label as string} className="grid grid-cols-4 items-center gap-3">
                                            <span className="text-right font-medium text-muted-foreground text-sm">{label}</span>
                                            <span className="col-span-3 text-sm">{val || "—"}</span>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-4 items-center gap-3">
                                        <span className="text-right font-medium text-muted-foreground text-sm">Website</span>
                                        <div className="col-span-3 text-sm">
                                            {selectedLead.website && selectedLead.website !== "None" ? (
                                                <a href={selectedLead.website} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                                                    {selectedLead.website} <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ) : <Badge variant="secondary">No Website</Badge>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 items-center gap-3">
                                        <span className="text-right font-medium text-muted-foreground text-sm">Rating</span>
                                        <span className="col-span-3 text-sm flex items-center gap-1">
                                            {selectedLead.rating ? <><Star className="w-4 h-4 text-amber-500 fill-amber-500" /> {selectedLead.rating} ({selectedLead.reviewCount ?? 0} reviews)</> : "—"}
                                        </span>
                                    </div>

                                    <div className="border-t pt-3 grid gap-3">
                                        <div className="grid grid-cols-4 items-start gap-3">
                                            <span className="text-right font-medium text-muted-foreground text-sm">Notes</span>
                                            <div className="col-span-3">
                                                <EditableCell lead={selectedLead} field="notes" value={selectedLead.notes || ""} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 items-start gap-3">
                                            <span className="text-right font-medium text-muted-foreground text-sm">Tags</span>
                                            <div className="col-span-3">
                                                <EditableCell lead={selectedLead} field="tags" value={selectedLead.tags || ""} />
                                            </div>
                                        </div>
                                        {[
                                            ["Tech Stack", selectedLead.techStack],
                                            ["SEO Status", selectedLead.seoStatus],
                                            ["Emails", selectedLead.emails],
                                            ["Socials", selectedLead.socials],
                                        ].map(([label, val]) => (
                                            <div key={label as string} className="grid grid-cols-4 items-start gap-3">
                                                <span className="text-right font-medium text-muted-foreground text-sm">{label}</span>
                                                <span className="col-span-3 text-sm text-foreground/80">{val || "Not scanned"}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedLead.website && selectedLead.website !== "None" && (
                                        <div className="flex justify-end pt-2">
                                            <Button onClick={handleEnrich} disabled={enriching} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                                {enriching ? <span className="animate-spin">🌀</span> : <Zap className="h-4 w-4" />}
                                                {enriching ? "Scanning..." : "Enrich Website"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* History Tab */
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {auditLogs.length === 0 ? (
                                        <p className="text-center text-muted-foreground text-sm py-8">No activity recorded yet.</p>
                                    ) : (
                                        auditLogs.map(log => (
                                            <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-md bg-muted/40 text-xs">
                                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                                                <div className="flex-1">
                                                    <div className="flex justify-between">
                                                        <span className="font-medium capitalize">{log.action}</span>
                                                        <span className="text-muted-foreground">
                                                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    {log.field && (
                                                        <div className="mt-1 text-muted-foreground">
                                                            <span className="font-mono">{log.field}</span>
                                                            {log.oldValue && <span>: <span className="line-through text-red-400">{log.oldValue}</span></span>}
                                                            {log.newValue && <span> → <span className="text-emerald-400">{log.newValue}</span></span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
