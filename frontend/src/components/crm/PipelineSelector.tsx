import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export default function PipelineSelector({ pipelines, activeId, onChange, onEdit }: any) {
  if (!pipelines || pipelines.length === 0) return <div>Loading pipelines...</div>;
  
  return (
    <div className="flex items-center gap-2">
      <Select value={activeId} onValueChange={onChange}>
        <SelectTrigger className="w-[250px] font-semibold text-lg bg-background border-border">
          <SelectValue placeholder="Select a pipeline" />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((p: any) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" onClick={onEdit} title="Edit Pipeline">
        <Settings className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
