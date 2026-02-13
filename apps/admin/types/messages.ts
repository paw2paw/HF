export type Message = {
  id: string;
  senderId: string;
  sender: { id: string; name: string | null; email: string; image: string | null };
  recipientId: string;
  recipient: { id: string; name: string | null; email: string; image: string | null };
  subject: string | null;
  content: string;
  readAt: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { replies: number };
  // Thread data (only when fetching single message)
  parent?: Message;
  replies?: Message[];
};

export type MessageType = "inbox" | "sent";
