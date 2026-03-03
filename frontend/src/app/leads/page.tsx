"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Search, Star, Download, Eye, Zap } from "lucide-react";

interface Lead {
    id: string;
    name: string;
    query: string;
    category: string;
    address: string;
    website: string | null;
    phone: string | null;
    rating: string | null;
    reviewCount: string | null;
    hasWebsite: boolean;
    scrapedAt: string;
    websiteStatus: string | null;
    techStack: string | null;
    seoStatus: string | null;
    socials: string | null;
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterWebsite, setFilterWebsite] = useState<"all" | "yes" | "no">("all");
    const [minRating, setMinRating] = useState<string>("all");

    // Dialog state
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [enriching, setEnriching] = useState(false);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append("search", searchTerm);
            if (filterWebsite !== "all") params.append("hasWebsite", filterWebsite);
            if (minRating !== "all") params.append("minRating", minRating);

            const res = await axios.get(`http://localhost:3001/api/leads?${params.toString()}`);
            setLeads(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [filterWebsite, minRating]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLeads();
    };

    const handleExportCsv = () => {
        if (leads.length === 0) return;

        const headers = ['Name', 'Category', 'Address', 'Phone', 'Website', 'Has Website', 'Rating', 'Reviews', 'Website Status', 'Tech Stack', 'SEO Status', 'Social Links', 'Query', 'Scraped At'];
        const rows = leads.map(l => [
            l.name, l.category, l.address, l.phone, l.website,
            l.hasWebsite ? 'Yes' : 'No', l.rating, l.reviewCount,
            l.websiteStatus || '', l.techStack || '', l.seoStatus || '', l.socials || '',
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

    const handleEnrich = async () => {
        if (!selectedLead || !selectedLead.website) return;
        setEnriching(true);
        try {
            const res = await axios.post("http://localhost:3001/api/enrich", {
                website: selectedLead.website
            });

            // Update the lead in our local list and the modal
            const updated = res.data;
            setLeads(leads.map(l => l.id === updated.id ? updated : l));
            setSelectedLead(updated);
        } catch (err) {
            console.error("Enrichment failed", err);
            alert("Enrichment failed. Ensure the server is running and the website is accessible.");
        } finally {
            setEnriching(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Leads Database</h1>
                    <p className="text-muted-foreground">Browse, filter, and analyze scraped leads.</p>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search name, phone, category..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button type="submit" variant="secondary">Search</Button>
                </form>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <Button
                        variant={filterWebsite === "all" ? "default" : "outline"}
                        onClick={() => setFilterWebsite("all")}
                        size="sm"
                    >
                        All Leads
                    </Button>
                    <Button
                        variant={filterWebsite === "no" ? "default" : "outline"}
                        onClick={() => setFilterWebsite("no")}
                        size="sm"
                        className={filterWebsite === "no" ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600" : ""}
                    >
                        No Website (Prospects)
                    </Button>
                    <Button
                        variant={filterWebsite === "yes" ? "default" : "outline"}
                        onClick={() => setFilterWebsite("yes")}
                        size="sm"
                    >
                        Has Website
                    </Button>

                    <div className="h-4 w-px bg-border mx-2 hidden sm:block"></div>

                    <select
                        value={minRating}
                        onChange={(e) => setMinRating(e.target.value)}
                        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        <option value="all">Any Rating</option>
                        <option value="4.5">4.5+ ★</option>
                        <option value="4.0">4.0+ ★</option>
                        <option value="3.5">3.5+ ★</option>
                    </select>
                </div>

                <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
                    <Download className="h-4 w-4" /> Export CSV
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Business Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Loading leads...</TableCell>
                            </TableRow>
                        ) : leads.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No leads found.</TableCell>
                            </TableRow>
                        ) : (
                            leads.map((lead) => (
                                <TableRow key={lead.id}>
                                    <TableCell className="font-medium whitespace-nowrap max-w-[200px] truncate overflow-hidden" title={lead.name}>
                                        {lead.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-normal truncate max-w-[150px]">{lead.category}</Badge>
                                    </TableCell>
                                    <TableCell className="space-y-1">
                                        <div className="text-sm">{lead.phone !== "N/A" ? lead.phone : <span className="text-muted-foreground italic">No Phone</span>}</div>
                                        {lead.website && lead.website !== "None" ? (
                                            <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 w-fit">
                                                Visit Site <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>
                                        {lead.rating !== "N/A" ? (
                                            <div className="flex items-center gap-1 text-sm font-medium">
                                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {lead.rating}
                                            </div>
                                        ) : <span className="text-muted-foreground text-xs">N/A</span>}
                                    </TableCell>
                                    <TableCell>
                                        {lead.hasWebsite ? (
                                            <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 font-normal">Has Website</Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-amber-500/50 text-amber-500 font-normal">Prospect</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedLead(lead)}>
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>Showing {leads.length} leads</div>
                {loading && <div className="animate-pulse">Refreshing data...</div>}
            </div>

            <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedLead?.name}</DialogTitle>
                        <DialogDescription>{selectedLead?.category} • {selectedLead?.query}</DialogDescription>
                    </DialogHeader>

                    {selectedLead && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="text-right font-medium text-muted-foreground text-sm">Address</span>
                                <span className="col-span-3 text-sm">{selectedLead.address}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="text-right font-medium text-muted-foreground text-sm">Phone</span>
                                <span className="col-span-3 text-sm">{selectedLead.phone}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="text-right font-medium text-muted-foreground text-sm">Website</span>
                                <div className="col-span-3 flex items-center gap-2 text-sm">
                                    {selectedLead.website && selectedLead.website !== "None" ? (
                                        <a href={selectedLead.website} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                                            {selectedLead.website} <ExternalLink className="h-3 w-3" />
                                        </a>
                                    ) : (
                                        <Badge variant="secondary">No Website</Badge>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <span className="text-right font-medium text-muted-foreground text-sm">Rating</span>
                                <span className="col-span-3 text-sm flex items-center gap-1">
                                    {selectedLead.rating !== "N/A" ? <><Star className="w-4 h-4 text-amber-500 fill-amber-500" /> {selectedLead.rating} ({selectedLead.reviewCount} reviews)</> : 'N/A'}
                                </span>
                            </div>

                            <div className="my-2 border-t"></div>

                            <div className="grid grid-cols-4 items-start gap-4">
                                <span className="text-right font-medium text-muted-foreground text-sm mt-1">Tech Stack</span>
                                <span className="col-span-3 text-sm text-foreground/80">{selectedLead.techStack || "Not scanned"}</span>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <span className="text-right font-medium text-muted-foreground text-sm mt-1">SEO Issues</span>
                                <span className="col-span-3 text-sm text-foreground/80">{selectedLead.seoStatus || "Not scanned"}</span>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <span className="text-right font-medium text-muted-foreground text-sm mt-1">Social Media</span>
                                <span className="col-span-3 text-sm text-foreground/80">{selectedLead.socials || "None found"}</span>
                            </div>

                            {selectedLead.website && selectedLead.website !== "None" && (
                                <div className="flex justify-end mt-4">
                                    <Button onClick={handleEnrich} disabled={enriching} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                        {enriching ? <span className="animate-spin">🌀</span> : <Zap className="h-4 w-4" />}
                                        {enriching ? "Scanning Website..." : "Enrich Website Data"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
