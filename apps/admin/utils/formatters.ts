import type { TicketCategory } from "@/types/tickets";

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function getUserInitials(user: { name: string | null; email: string }): string {
  if (user.name) {
    const parts = user.name.trim().split(" ");
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return user.name[0].toUpperCase();
  }
  return user.email[0].toUpperCase();
}

export function getCategoryIcon(category: TicketCategory): string {
  const icons: Record<TicketCategory, string> = {
    BUG: "🐛",
    FEATURE: "✨",
    QUESTION: "❓",
    SUPPORT: "💬",
    OTHER: "📋",
  };
  return icons[category] || icons.OTHER;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}
