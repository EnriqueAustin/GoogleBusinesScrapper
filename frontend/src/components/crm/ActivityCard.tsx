'use client';

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Phone, Mail, FileText, Users, Settings, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";

export interface Activity {
  id: string;
  leadId: number;
  type: 'call' | 'email' | 'note' | 'meeting' | 'system';
  outcome?: string;
  notes?: string;
  duration?: number;
  dueDate?: string;
  assignedTo?: string;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ActivityCard({ activity, onToggleDone }: { activity: Activity, onToggleDone?: (id: string, isDone: boolean) => void }) {
  const isSystem = activity.type === 'system';
  
  const getIcon = () => {
    switch(activity.type) {
      case 'call': return <Phone className="w-4 h-4 text-blue-500" />;
      case 'email': return <Mail className="w-4 h-4 text-orange-500" />;
      case 'note': return <FileText className="w-4 h-4 text-yellow-500" />;
      case 'meeting': return <Users className="w-4 h-4 text-green-500" />;
      case 'system': return <Settings className="w-4 h-4 text-gray-400" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    if (!outcome) return 'bg-gray-100 text-gray-800';
    const o = outcome.toLowerCase();
    if (o.includes('answered') || o.includes('interested')) return 'bg-green-100 text-green-800';
    if (o.includes('no answer') || o.includes('voicemail')) return 'bg-yellow-100 text-yellow-800';
    if (o.includes('not interested') || o.includes('wrong number')) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className={`relative pl-8 pb-6 last:pb-0 ${isSystem ? 'opacity-80' : ''}`}>
      {/* Timeline connector line */}
      <div className="absolute left-[15px] top-8 bottom-[-8px] w-[2px] bg-gray-200 last:hidden" />
      
      {/* Timeline dot/icon */}
      <div className="absolute left-0 top-1 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center z-10">
        {getIcon()}
      </div>

      <Card className={`shadow-sm border-gray-200 ${isSystem ? 'bg-gray-50' : 'bg-white'}`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm capitalize text-gray-900">
                {activity.type === 'call' && activity.outcome ? `${activity.type} - ${activity.outcome}` : activity.type}
              </span>
              {activity.outcome && activity.type !== 'call' && activity.type !== 'system' && (
                <Badge variant="secondary" className={getOutcomeColor(activity.outcome)}>
                  {activity.outcome}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {activity.duration && <span>{Math.round(activity.duration / 60)} min</span>}
              <span>{format(new Date(activity.createdAt), "MMM d, h:mm a")}</span>
            </div>
          </div>
          
          {activity.notes && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2 bg-gray-50 p-3 rounded-md border border-gray-100">
              {activity.notes}
            </p>
          )}

          {activity.dueDate && (
            <div className="mt-3 flex items-center gap-2">
              <button 
                onClick={() => onToggleDone && onToggleDone(activity.id, !activity.isDone)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  activity.isDone 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                {activity.isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                {activity.isDone ? 'Completed' : 'Due: ' + format(new Date(activity.dueDate), "MMM d")}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
