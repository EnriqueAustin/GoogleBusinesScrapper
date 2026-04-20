'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isToday } from "date-fns";
import { Loader2, CheckCircle2, Circle, AlertCircle, Phone, Mail, FileText, Users, ExternalLink } from "lucide-react";
import Link from 'next/link';

interface Task {
  id: string;
  leadId: number;
  type: string;
  dueDate: string;
  isDone: boolean;
  notes: string;
  lead?: {
    id: number;
    name: string;
  };
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/crm/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDone = async (taskId: string, isDone: boolean) => {
    try {
      setTasks(prev => prev.filter(t => t.id !== taskId)); // Optimistic remove if done
      await fetch(`http://localhost:5000/api/activities/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone })
      });
      if (!isDone) fetchTasks(); // Re-fetch if marked undone
    } catch (error) {
      console.error(error);
      fetchTasks();
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'call': return <Phone className="w-4 h-4 text-blue-500" />;
      case 'email': return <Mail className="w-4 h-4 text-orange-500" />;
      case 'meeting': return <Users className="w-4 h-4 text-green-500" />;
      default: return <FileText className="w-4 h-4 text-yellow-500" />;
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Tasks</h1>
        <p className="text-gray-500 mt-2">Activities due today or overdue.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="text-gray-500 mt-1">You have no pending tasks for today.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => {
            const due = new Date(task.dueDate);
            const overdue = isPast(due) && !isToday(due);
            const today = isToday(due);

            return (
              <Card key={task.id} className={`transition-all hover:shadow-md ${overdue ? 'border-red-200 bg-red-50/30' : ''}`}>
                <CardContent className="p-4 sm:p-6 flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                  <button 
                    onClick={() => handleToggleDone(task.id, true)}
                    className="mt-1 sm:mt-0 flex-shrink-0 text-gray-400 hover:text-green-500 transition-colors"
                  >
                    <Circle className="w-6 h-6" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getIcon(task.type)}
                      <span className="font-semibold text-gray-900 capitalize">{task.type}</span>
                      {task.lead && (
                        <>
                          <span className="text-gray-400">•</span>
                          <Link href={`/crm/${task.lead.id}`} className="text-blue-600 hover:underline font-medium truncate flex items-center gap-1">
                            {task.lead.name}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </>
                      )}
                    </div>
                    {task.notes && (
                      <p className="text-sm text-gray-600 truncate">{task.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 sm:ml-auto flex-shrink-0">
                    {overdue && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </Badge>
                    )}
                    {today && (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">
                        Today
                      </Badge>
                    )}
                    <span className={`text-sm font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                      {format(due, "MMM d, h:mm a")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
