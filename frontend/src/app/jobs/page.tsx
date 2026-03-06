"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, RotateCw, Trash2, XCircle, AlertTriangle } from "lucide-react";

interface Job {
    id: string;
    query: string;
    status: "waiting" | "active" | "completed" | "failed" | "stalled";
    resultsCount: number;
    durationMs: number | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
}

export default function JobsPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [newQuery, setNewQuery] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const fetchJobs = async () => {
        try {
            const res = await axios.get("http://localhost:3001/api/jobs");
            setJobs(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
        // Poll every 5 seconds for live updates
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleStartJob = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuery.trim()) return;

        setSubmitting(true);
        try {
            const queries = newQuery.split('\n').filter(q => q.trim().length > 0);
            await axios.post("http://localhost:3001/api/jobs/batch", { queries });
            setNewQuery("");
            await fetchJobs();
        } catch (err) {
            console.error("Failed to start jobs", err);
            alert("Failed to start jobs. Is the API running?");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = async (id: string) => {
        try {
            await axios.post(`http://localhost:3001/api/jobs/${id}/cancel`);
            fetchJobs();
        } catch (err) {
            console.error(err);
            alert("Failed to cancel job");
        }
    };

    const handleRetry = async (id: string) => {
        try {
            await axios.post(`http://localhost:3001/api/jobs/${id}/retry`);
            fetchJobs();
        } catch (err) {
            console.error(err);
            alert("Failed to retry job");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this job?")) return;
        try {
            await axios.delete(`http://localhost:3001/api/jobs/${id}`);
            fetchJobs();
        } catch (err) {
            console.error(err);
            alert("Failed to delete job");
        }
    };

    const handleClearHistory = async () => {
        if (!confirm("Delete all completed, failed, and stalled jobs?")) return;
        try {
            await axios.delete("http://localhost:3001/api/jobs/clear");
            fetchJobs();
        } catch (err) {
            console.error(err);
            alert("Failed to clear history");
        }
    };

    const handleRequeueAllStalled = async () => {
        if (!confirm("Re-queue all stalled jobs?")) return;
        try {
            await axios.post("http://localhost:3001/api/jobs/requeue-stalled");
            fetchJobs();
        } catch (err) {
            console.error(err);
            alert("Failed to re-queue stalled jobs");
        }
    };

    const getStatusBadge = (status: Job["status"]) => {
        switch (status) {
            case "completed":
                return <Badge className="bg-emerald-500 hover:bg-emerald-600">Completed</Badge>;
            case "active":
                return <Badge className="bg-blue-500 hover:bg-blue-600 animate-pulse">Running</Badge>;
            case "failed":
                return <Badge variant="destructive">Failed</Badge>;
            case "stalled":
                return <Badge className="bg-amber-500 hover:bg-amber-600">Stalled</Badge>;
            default:
                return <Badge variant="secondary">Waiting in Queue</Badge>;
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Job Queue</h1>
                    <p className="text-muted-foreground">Manage background scraping workers.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Start New Scrape</CardTitle>
                    <CardDescription>
                        Enter a search query to dispatch to the background worker (e.g., "roofers in Chicago").
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleStartJob} className="flex flex-col gap-3">
                        <textarea
                            placeholder="Enter search queries (one per line)...&#10;e.g. roofers in Chicago&#10;plumbers in New York"
                            value={newQuery}
                            onChange={(e) => setNewQuery(e.target.value)}
                            className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={submitting}
                        />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={submitting || !newQuery.trim()}>
                                {submitting ? (
                                    <RotateCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                )}
                                Dispatch Job{newQuery.includes('\n') ? 's' : ''}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">Recent Jobs</h2>
                    <div className="flex gap-2 ml-auto">
                        {jobs.some(j => j.status === 'stalled') && (
                            <Button variant="outline" size="sm" onClick={handleRequeueAllStalled} className="text-amber-600 hover:text-amber-700 hover:bg-amber-600/10">
                                <RotateCw className="w-4 h-4 mr-2" /> Re-queue All Stalled
                            </Button>
                        )}
                        {jobs.some(j => j.status === 'completed' || j.status === 'failed' || j.status === 'stalled') && (
                            <Button variant="outline" size="sm" onClick={handleClearHistory} className="text-muted-foreground hover:text-foreground">
                                <Trash2 className="w-4 h-4 mr-2" /> Clear History
                            </Button>
                        )}
                    </div>
                </div>

                {loading && jobs.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">Loading queue...</div>
                ) : jobs.length === 0 ? (
                    <div className="text-center py-10 border rounded-lg bg-muted/40 text-muted-foreground">
                        No jobs found in the database.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {jobs.map((job) => (
                            <Card key={job.id} className="overflow-hidden">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg">{job.query}</h3>
                                            {getStatusBadge(job.status)}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Dispatched {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:items-end gap-1 text-sm bg-muted/50 p-3 rounded-md w-full sm:w-auto">
                                        <div className="flex justify-between sm:justify-end w-full gap-4">
                                            <span className="text-muted-foreground">Leads Scraped:</span>
                                            <span className="font-medium">{job.resultsCount}</span>
                                        </div>
                                        <div className="flex justify-between sm:justify-end w-full gap-4">
                                            <span className="text-muted-foreground">Duration:</span>
                                            <span className="font-medium">
                                                {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : "---"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex sm:flex-col gap-2 mt-4 sm:mt-0 justify-end w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0">
                                        {(job.status === "waiting" || job.status === "active") && (
                                            <Button variant="ghost" size="sm" onClick={() => handleCancel(job.id)} className="text-amber-600 hover:text-amber-700 hover:bg-amber-600/10 w-full sm:w-auto">
                                                <XCircle className="w-4 h-4 mr-2" /> Cancel
                                            </Button>
                                        )}
                                        {(job.status === "failed" || job.status === "completed" || job.status === "stalled") && (
                                            <Button variant="ghost" size="sm" onClick={() => handleRetry(job.id)} className="w-full sm:w-auto">
                                                <RotateCw className="w-4 h-4 mr-2" /> {job.status === "stalled" ? "Re-queue" : "Retry"}
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(job.id)} className="text-destructive hover:bg-destructive/10 w-full sm:w-auto">
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </Button>
                                    </div>
                                </div>
                                {job.status === "active" && (
                                    <div className="h-1 w-full bg-secondary overflow-hidden">
                                        <div className="h-full bg-blue-500 w-1/3 animate-[slide_2s_ease-in-out_infinite]"
                                            style={{ animation: 'slide 2s infinite linear alternate' }}></div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes slide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}} />
        </div>
    );
}
