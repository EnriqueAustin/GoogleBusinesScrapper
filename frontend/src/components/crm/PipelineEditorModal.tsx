import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PipelineEditorModal({ isOpen, onClose, pipelineId }: { isOpen: boolean, onClose: () => void, pipelineId: string | null }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Pipeline</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-muted-foreground text-sm">Pipeline configuration (Stages, probability, names) will be added here in Phase 2.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
