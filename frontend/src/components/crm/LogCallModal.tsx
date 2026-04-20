'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneCall, Play, Square, Loader2 } from "lucide-react";

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: number;
  onLogged: () => void;
}

export default function LogCallModal({ isOpen, onClose, leadId, onLogged }: LogCallModalProps) {
  const [type, setType] = useState('call');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Timer state
  const [isTiming, setIsTiming] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTiming) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTiming]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setType('call');
      setOutcome('');
      setNotes('');
      setDueDate('');
      setSeconds(0);
      setIsTiming(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!outcome && type === 'call') return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          outcome: outcome || undefined,
          notes,
          duration: seconds > 0 ? seconds : undefined,
          dueDate: dueDate || undefined
        })
      });
      
      if (!res.ok) throw new Error('Failed to log activity');
      
      onLogged();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PhoneCall className="w-5 h-5 text-blue-600" />
            Log Activity
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Activity Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {type === 'call' && (
              <div className="space-y-2">
                <Label>Outcome <span className="text-red-500">*</span></Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Answered">Answered</SelectItem>
                    <SelectItem value="Voicemail">Voicemail</SelectItem>
                    <SelectItem value="No Answer">No Answer</SelectItem>
                    <SelectItem value="Left Message">Left Message</SelectItem>
                    <SelectItem value="Interested">Interested</SelectItem>
                    <SelectItem value="Not Interested">Not Interested</SelectItem>
                    <SelectItem value="Wrong Number">Wrong Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {type !== 'call' && (
              <div className="space-y-2">
                <Label>Outcome (Optional)</Label>
                <input 
                  type="text" 
                  value={outcome} 
                  onChange={e => setOutcome(e.target.value)}
                  placeholder="e.g. Sent Demo"
                  className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                />
              </div>
            )}
          </div>

          {type === 'call' && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Call Timer: <span className="text-lg font-mono tracking-wider">{formatTime(seconds)}</span>
              </div>
              <div className="flex gap-2">
                {!isTiming ? (
                  <Button size="sm" variant="outline" className="bg-white" onClick={() => setIsTiming(true)}>
                    <Play className="w-4 h-4 mr-1 text-green-600" /> Start
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="bg-red-50 hover:bg-red-100" onClick={() => setIsTiming(false)}>
                    <Square className="w-4 h-4 mr-1 text-red-600" /> Stop
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              placeholder="What was discussed?" 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-28 resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Follow-up Task (Due Date)</Label>
            <input 
              type="datetime-local" 
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || (type === 'call' && !outcome)}>
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
