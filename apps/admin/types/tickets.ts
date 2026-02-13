export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketCategory = "BUG" | "FEATURE" | "QUESTION" | "SUPPORT" | "OTHER";

export type Ticket = {
  id: string;
  ticketNumber: number;
  creatorId: string;
  creator: { id: string; name: string | null; email: string; image: string | null };
  assigneeId: string | null;
  assignee: { id: string; name: string | null; email: string; image: string | null } | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  _count?: { comments: number };
  // Detail view only
  comments?: TicketComment[];
};

export type TicketComment = {
  id: string;
  ticketId: string;
  authorId: string;
  author: { id: string; name: string | null; email: string; image: string | null };
  content: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TicketStats = {
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  myAssigned: number;
  myCreated: number;
  totalOpen: number;
};
