"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Phone, PhoneIncoming, PhoneOff, Voicemail, Mail, StickyNote,
    Calendar, CheckCircle2, TrendingUp, AlertCircle, RefreshCw, BarChart, ExternalLink, MessageSquare, Briefcase
} from "lucide-react";
import {
    BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import Link from "next/link";

interface PipelineData {
    crmStatus: string;
    _count: { id: number };
    _sum: { estimatedValue: number | null };
}

interface ActivityData {
    type: string;
    _count: { id: number };
}

const CRM_STATUSES = [
    { key: "new", label: "New", color: "#94a3b8" },
    { key: "attempting", label: "Attempting", color: "#fbbf24" },
    { key: "connected", label: "Connected", color: "#60a5fa" },
    { key: "qualified", label: "Qualified", color: "#34d399" },
    { key: "closed_won", label: "Closed Won", color: "#c084fc" },
];

const ACTIVITY_COLORS: Record<string, string> = {
    call: "#3b82f6",
    email: "#8b5cf6",
    note: "#f59e0b",
    meeting: "#10b981",
};

export default function CRMAnalyticsPage() {
    const [pipeline, setPipeline] = useState<PipelineData[]>([]);
    const [activities, setActivities] = useState<ActivityData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get("http://localhost:3001/api/crm/analytics");
            setPipeline(data.pipelineValue);
            setActivities(data.activities);
        } catch (e) {
            console.error("Failed to fetch analytics", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Data Transformation for Charts
    const formattedPipeline = CRM_STATUSES.map(status => {
        const found = pipeline.find(p => p.crmStatus === status.key);
        return {
            name: status.label,
            count: found?._count.id || 0,
            value: found?._sum.estimatedValue || 0,
            fill: status.color,
        };
    });

    const totalPipelineValue = formattedPipeline.reduce((acc, curr) => acc + curr.value, 0);
    const totalQualifiedValue = formattedPipeline.find(f => f.name === "Qualified")?.value || 0;

    const formattedActivities = activities.map(a => ({
        name: a.type.charAt(0).toUpperCase() + a.type.slice(1),
        value: a._count.id,
        fill: ACTIVITY_COLORS[a.type] || "#cbd5e1",
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart className="h-7 w-7 text-primary" />
                        Sales Analytics
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Pipeline revenue metrics and team activity.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild size="sm">
                        <Link href="/crm">Back to Dialer</Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-primary" /> Total Pipeline Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">${totalPipelineValue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all active stages</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Qualified Pipeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-500">${totalQualifiedValue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Ready to close</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-amber-500" /> Total Activities
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{activities.reduce((acc, a) => acc + a._count.id, 0)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Calls, emails, meetings, notes</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Revenue Funnel */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Revenue by Stage</CardTitle>
                        <CardDescription>Estimated deal value aggregated by CRM lifecycle stage</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ReBarChart data={formattedPipeline} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tickFormatter={(val) => `$${val}`} width={80} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Pipeline Value']}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {formattedPipeline.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </ReBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Lead Volume Funnel */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Lead Volume by Stage</CardTitle>
                        <CardDescription>Number of active deals in each stage</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ReBarChart data={formattedPipeline} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    formatter={(value: number) => [value, 'Lead Count']}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {formattedPipeline.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </ReBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Activity Distribution */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Activity Distribution</CardTitle>
                        <CardDescription>Breakdown of sales efforts by channel</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        {formattedActivities.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={formattedActivities}
                                        cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {formattedActivities.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-muted-foreground text-sm">No activities logged yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
