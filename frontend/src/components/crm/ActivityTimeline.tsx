'use client';

import React, { useState, useEffect } from 'react';
import ActivityCard, { Activity } from './ActivityCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export default function ActivityTimeline({ leadId, triggerRefresh }: { leadId: number, triggerRefresh?: number }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchActivities();
  }, [leadId, filterType, triggerRefresh]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/leads/${leadId}/activities?type=${filterType}`);
      if (!res.ok) throw new Error('Failed to fetch activities');
      const data = await res.json();
      setActivities(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDone = async (activityId: string, isDone: boolean) => {
    try {
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, isDone } : a));
      await fetch(`http://localhost:5000/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone })
      });
    } catch (error) {
      console.error('Failed to toggle done', error);
      fetchActivities(); // revert on fail
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="call">Calls</SelectItem>
            <SelectItem value="email">Emails</SelectItem>
            <SelectItem value="meeting">Meetings</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
            <SelectItem value="system">System Logs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative pt-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-gray-500 text-sm">No activities found.</p>
          </div>
        ) : (
          activities.map(activity => (
            <ActivityCard 
              key={activity.id} 
              activity={activity} 
              onToggleDone={handleToggleDone} 
            />
          ))
        )}
      </div>
    </div>
  );
}
