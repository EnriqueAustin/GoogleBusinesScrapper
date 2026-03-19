"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { format, formatDistanceToNow, isToday, isBefore, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Calendar, Clock, Phone, Mail, CheckCircle2, AlertCircle, RefreshCw, ListTodo, ChevronRight, MapPin
} from "lucide-react";
import Link from "next/link";

interface TaskLead {
    id: number;
    name: string;
    category: string;
    city: string | null;
    phone: string | null;
    crmStatus: string;
    nextFollowUp: string;
    leadScore: number;
    callCount: number;
}

export default function CRMTasksPage() {
    const [tasks, setTasks] = useState<TaskLead[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get("http://localhost:3001/api/crm/tasks");
            setTasks(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Quick complete task (mark follow up as null for now, or push to tomorrow)
    const pushToTomorrow = async (id: number) => {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            await axios.patch(`http://localhost:3001/api/leads/${id}/crm`, { nextFollowUp: tomorrow.toISOString() });
            setTasks(t => t.filter(x => x.id !== id));
        } catch (e) { }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <ListTodo className="h-7 w-7 text-primary" />
                        Today's Tasks
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Your urgent follow-ups and scheduled calls.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild size="sm">
                        <Link href="/crm">Back to Dialer</Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchTasks} className="gap-1.5">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-24 text-muted-foreground">Loading tasks...</div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-24 border rounded-2xl bg-muted/10">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <h3 className="text-lg font-medium">Inbox Zero!</h3>
                    <p className="text-muted-foreground text-sm">You have no follow-ups due today.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tasks.map(task => {
                        const dateObj = new Date(task.nextFollowUp);
                        const isOverdue = isBefore(dateObj, startOfDay(new Date()));

                        return (
                            <Card key={task.id} className="overflow-hidden transition-all hover:border-primary/50 group">
                                <CardContent className="p-0 flex items-stretch">
                                    <div className={`w-2 shrink-0 ${isOverdue ? "bg-red-500" : "bg-amber-500"}`} />
                                    <div className="flex-1 p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-lg truncate">{task.name}</h3>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">{task.crmStatus}</Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{task.city || task.category}</span>
                                                </span>
                                                {task.phone && (
                                                    <span className="flex items-center gap-1.5 text-foreground font-medium">
                                                        <Phone className="h-3.5 w-3.5 text-emerald-500" /> {task.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-border">
                                            <div className="text-right flex-1 sm:flex-none">
                                                <p className={`text-xs font-semibold flex items-center sm:justify-end gap-1 ${isOverdue ? "text-red-400" : "text-amber-400"}`}>
                                                    {isOverdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                                                    {isOverdue ? "Overdue" : "Due Today"}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5 max-sm:text-left">
                                                    {format(dateObj, "MMM d, yyyy")}
                                                </p>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => pushToTomorrow(task.id)} className="text-xs h-8">
                                                    Snooze to Tmrw
                                                </Button>
                                                <Button size="sm" asChild className="h-8 gap-1 pl-3 pr-2 bg-primary text-primary-foreground hover:bg-primary/90">
                                                    <Link href={`/crm`}>
                                                        Open Dialer <ChevronRight className="h-3.5 w-3.5" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
