import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DealCard from './DealCard';

export default function KanbanColumn({ column, leads, onLogCall }: { column: any, leads: any[], onLogCall?: (id: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    }
  });

  const totalValue = leads.reduce((sum, lead) => {
    const probability = lead.winProbability ?? column.winProbability;
    return sum + ((lead.dealValue || 0) * (probability / 100));
  }, 0);

  const formattedTotal = new Intl.NumberFormat('en-ZA', { 
    style: 'currency', currency: 'ZAR', maximumFractionDigits: 0
  }).format(totalValue);

  return (
    <div className="flex flex-col bg-muted/30 rounded-lg min-w-[280px] max-w-[280px] flex-shrink-0 border border-border">
      {/* Column Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
            <h3 className="font-semibold text-foreground text-sm">{column.name}</h3>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        <div className="text-emerald-600 font-bold text-sm">
          {formattedTotal}
        </div>
      </div>

      {/* Column Content */}
      <div 
        ref={setNodeRef}
        className={`flex-1 p-2 overflow-y-auto min-h-[150px] transition-colors ${isOver ? 'bg-muted/50' : ''}`}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <DealCard key={lead.id} lead={lead} onLogCall={onLogCall} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
