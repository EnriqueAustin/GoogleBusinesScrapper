import { useEffect, useState, useRef } from 'react';
import { DndContext, closestCorners, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import DealCard from './DealCard';
import { apiGet, apiPost } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Search, MapPin } from 'lucide-react';
import LogCallModal from './LogCallModal';

export default function KanbanBoard({ pipelineId }: { pipelineId: string }) {
  const [columns, setColumns] = useState<any[]>([]);
  const [activeCard, setActiveCard] = useState<any | null>(null);
  const [selectedLeadIdForCall, setSelectedLeadIdForCall] = useState<number | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Drag to scroll refs and state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useEffect(() => {
    fetchColumns();
  }, [pipelineId]);

  const fetchColumns = async () => {
    try {
      const data = await apiGet(`/api/crm/kanban?pipelineId=${pipelineId}`);
      setColumns(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragStart = (event: any) => {
    const { active } = event;
    const allCards = columns.flatMap(col => col.leads);
    setActiveCard(allCards.find(card => card.id === active.id));
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const sourceColId = active.data.current?.sortable?.containerId;
    const destColId = over.data.current?.type === 'Column' ? over.id : over.data.current?.sortable?.containerId || over.id;

    if (sourceColId !== destColId) {
      setColumns(prevCols => {
        const sourceColIndex = prevCols.findIndex(c => c.id === sourceColId);
        const destColIndex = prevCols.findIndex(c => c.id === destColId);
        
        if (sourceColIndex < 0 || destColIndex < 0) return prevCols;

        const newCols = [...prevCols];
        const cardIndex = newCols[sourceColIndex].leads.findIndex((l: any) => l.id === active.id);
        const [movedCard] = newCols[sourceColIndex].leads.splice(cardIndex, 1);
        newCols[destColIndex].leads.push(movedCard);
        return newCols;
      });

      try {
        await apiPost(`/api/leads/${active.id}/stage`, { pipelineId, stageId: destColId });
      } catch (e) {
        console.error("Failed to move stage", e);
        fetchColumns();
      }
    }
    setActiveCard(null);
  };

  // --- Drag to Scroll Handlers ---
  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    const target = e.target as HTMLElement;
    // Do not start drag-to-scroll if the user is clicking on a DealCard or its children
    if (target.closest('.deal-card')) return;

    setIsDraggingBoard(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleBoardMouseLeave = () => {
    setIsDraggingBoard(false);
  };

  const handleBoardMouseUp = () => {
    setIsDraggingBoard(false);
  };

  const handleBoardMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingBoard || !scrollRef.current) return;
    e.preventDefault(); // Prevent text selection while dragging
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // --- Filtering Logic ---
  const filteredColumns = columns.map(col => {
    let filteredLeads = col.leads || [];
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filteredLeads = filteredLeads.filter((l: any) => 
        (l.name && l.name.toLowerCase().includes(lowerSearch)) ||
        (l.category && l.category.toLowerCase().includes(lowerSearch)) ||
        (l.website && l.website.toLowerCase().includes(lowerSearch))
      );
    }

    if (locationFilter) {
      const lowerLoc = locationFilter.toLowerCase();
      filteredLeads = filteredLeads.filter((l: any) => 
        (l.city && l.city.toLowerCase().includes(lowerLoc)) ||
        (l.address && l.address.toLowerCase().includes(lowerLoc))
      );
    }

    return {
      ...col,
      leads: filteredLeads
    };
  });

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-card p-3 rounded-lg border border-border">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search leads by name, category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Filter by city or location..." 
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="text-sm font-medium text-muted-foreground ml-auto pr-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
          {filteredColumns.reduce((acc, col) => acc + col.leads.length, 0)} leads shown
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div 
          ref={scrollRef}
          onMouseDown={handleBoardMouseDown}
          onMouseLeave={handleBoardMouseLeave}
          onMouseUp={handleBoardMouseUp}
          onMouseMove={handleBoardMouseMove}
          className={`flex gap-4 h-[calc(100%-60px)] overflow-x-auto pb-4 items-start ${isDraggingBoard ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        >
          {filteredColumns.map((col) => (
            <KanbanColumn 
              key={col.id} 
              column={col} 
              leads={col.leads || []} 
              onLogCall={(leadId) => setSelectedLeadIdForCall(leadId)} 
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard ? <DealCard lead={activeCard} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <LogCallModal 
        isOpen={selectedLeadIdForCall !== null}
        onClose={() => setSelectedLeadIdForCall(null)}
        leadId={selectedLeadIdForCall || 0}
        onLogged={() => {
          setSelectedLeadIdForCall(null);
          fetchColumns();
        }}
      />
    </div>
  );
}
