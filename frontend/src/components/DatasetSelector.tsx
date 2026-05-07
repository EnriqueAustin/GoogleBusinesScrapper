"use client";

import { useState } from "react";
import { useDataset } from "@/lib/dataset-context";
import { Database, Plus, ChevronDown, Pencil, Trash2, Check, X } from "lucide-react";

export default function DatasetSelector() {
  const {
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    createDataset,
    renameDataset,
    deleteDataset,
    loading,
  } = useDataset();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  const activeDataset = datasets.find((d) => d.id === activeDatasetId);

  async function handleCreate() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const ds = await createDataset(newName.trim());
      setActiveDatasetId(ds.id);
      setNewName("");
      setCreating(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to create dataset");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim() || busy) return;
    setBusy(true);
    try {
      await renameDataset(id, editName.trim());
      setEditingId(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to rename dataset");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (busy) return;
    if (!confirm("Delete this dataset? All associated leads, jobs, and queries must be deleted first.")) return;
    setBusy(true);
    try {
      await deleteDataset(id);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Failed to delete dataset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background hover:bg-muted text-sm font-medium transition-colors"
      >
        <Database className="w-4 h-4 text-primary" />
        <span className="max-w-[140px] truncate">{activeDataset?.name || "Select Dataset"}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-72 bg-card border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Datasets</p>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {datasets.map((ds) => (
              <div key={ds.id} className="group flex items-center gap-1">
                {editingId === ds.id ? (
                  <div className="flex items-center gap-1 flex-1 px-2 py-1">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(ds.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-muted rounded px-2 py-1 text-sm outline-none border border-primary/30"
                    />
                    <button onClick={() => handleRename(ds.id)} className="p-1 hover:text-green-500"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setActiveDatasetId(ds.id); setOpen(false); }}
                      className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        ds.id === activeDatasetId
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{ds.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {ds._count?.leads ?? 0} leads
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => { setEditingId(ds.id); setEditName(ds.name); }}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {datasets.length > 1 && (
                      <button
                        onClick={() => handleDelete(ds.id)}
                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t p-2">
            {creating ? (
              <div className="flex items-center gap-1 px-1">
                <input
                  autoFocus
                  placeholder="Dataset name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                  className="flex-1 bg-muted rounded px-2 py-1.5 text-sm outline-none border border-primary/30"
                />
                <button onClick={handleCreate} disabled={busy} className="p-1.5 hover:text-green-500"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setCreating(false); setNewName(""); }} className="p-1.5 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
              >
                <Plus className="w-4 h-4" /> New Dataset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Click-outside to close */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
