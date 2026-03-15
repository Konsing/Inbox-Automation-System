import { Badge } from "@/components/ui/badge";
import type { Category, Priority, Sentiment } from "@/lib/types";

const CATEGORY_STYLES: Record<Category, string> = {
  refund: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  billing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  technical: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  general: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const SENTIMENT_STYLES: Record<Sentiment, string> = {
  positive: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  neutral: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  negative: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <Badge variant="secondary" className={CATEGORY_STYLES[category]}>
      {category}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="secondary" className={PRIORITY_STYLES[priority]}>
      {priority}
    </Badge>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <Badge variant="secondary" className={SENTIMENT_STYLES[sentiment]}>
      {sentiment}
    </Badge>
  );
}
