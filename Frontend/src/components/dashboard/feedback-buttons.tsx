"use client";

import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChangeFeedback } from "@/lib/hooks/use-changes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FeedbackButtonsProps {
  changeId: string;
  currentFeedback?: boolean;
}

export function FeedbackButtons({ changeId, currentFeedback }: FeedbackButtonsProps) {
  const feedback = useChangeFeedback();

  const handleFeedback = async (helpful: boolean) => {
    try {
      await feedback.mutateAsync({ id: changeId, helpful });
      toast.success("Thanks for your feedback!");
    } catch {
      toast.error("Failed to submit feedback");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Was this analysis helpful?</span>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 w-8 p-0",
          currentFeedback === true && "text-significance-low"
        )}
        onClick={() => handleFeedback(true)}
        disabled={feedback.isPending}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 w-8 p-0",
          currentFeedback === false && "text-significance-high"
        )}
        onClick={() => handleFeedback(false)}
        disabled={feedback.isPending}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
