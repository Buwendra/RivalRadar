"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useChangeNotes, useCreateChangeNote } from "@/lib/hooks/use-changes";
import { ApiClientError } from "@/lib/api/client";

interface ChangeNotesSectionProps {
  changeId: string;
}

function formatRelative(iso: string): string {
  try {
    return `${formatDistanceToNow(parseISO(iso))} ago`;
  } catch {
    return iso;
  }
}

export function ChangeNotesSection({ changeId }: ChangeNotesSectionProps) {
  const { data: notes = [], isLoading } = useChangeNotes(changeId);
  const createNote = useCreateChangeNote();
  const [draft, setDraft] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    try {
      await createNote.mutateAsync({ changeId, body });
      setDraft("");
      toast.success("Note added");
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Couldn't save note";
      toast.error(msg);
    }
  };

  return (
    <Card className="border-brand-700 bg-brand-900">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </h3>
          </div>
          {notes.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {notes.length}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No notes yet. Add context, follow-up actions, or anything you want to
            remember about this change.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="space-y-1 rounded-md border border-brand-700/60 bg-brand-950/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{n.authorName}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(n.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-2 pt-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note — context, follow-up, decisions…"
            rows={3}
            maxLength={2000}
            disabled={createNote.isPending}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/70">
              {draft.length}/2000
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={createNote.isPending || !draft.trim()}
            >
              {createNote.isPending && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              Add note
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
