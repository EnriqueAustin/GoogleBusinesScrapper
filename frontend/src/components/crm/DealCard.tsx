import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Clock, AlertCircle } from 'lucide-react';

export default function DealCard({ lead, isOverlay, onLogCall }: { lead: any, isOverlay?: boolean, onLogCall?: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: lead.id,
    data: { ...lead }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isOverlay ? 0.8 : 1,
    zIndex: isOverlay ? 100 : 1,
  };

  // Rotting logic: if updated > 14 days ago, mark stale
  const daysSinceUpdate = (new Date().getTime() - new Date(lead.updatedAt).getTime()) / (1000 * 3600 * 24);
  const isStale = daysSinceUpdate > 14;

  const formattedValue = new Intl.NumberFormat('en-ZA', { 
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0
  }).format(lead.dealValue || 0);

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`deal-card p-3 mb-3 cursor-grab hover:shadow-md transition-all group ${isStale ? 'bg-orange-500/10 border-orange-500/30' : 'bg-card'}`}
    >
      <div className="font-semibold text-foreground text-sm mb-1 truncate" title={lead.name}>{lead.name}</div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-emerald-600 font-bold text-sm">{formattedValue}</div>
        <button 
          onPointerDown={(e) => {
            e.stopPropagation(); // prevent drag
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onLogCall) onLogCall(lead.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-medium px-2 py-1 rounded"
        >
          + Log Call
        </button>
      </div>
      
      <div className="flex justify-between items-center text-[10px]">
        {lead.nextFollowUp ? (
          <Badge variant="outline" className="text-muted-foreground font-normal px-1.5 py-0">
            <Clock className="w-3 h-3 mr-1" />
            {formatDistanceToNow(new Date(lead.nextFollowUp), { addSuffix: true })}
          </Badge>
        ) : (
          <span className="text-muted-foreground/70">No task</span>
        )}
        
        {isStale && (
          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600 text-[10px] px-1.5 py-0 h-4">
            <AlertCircle className="w-3 h-3 mr-1" /> Stale
          </Badge>
        )}
      </div>
    </Card>
  );
}
