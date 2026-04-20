// Contact bridge conversation types

export type ConversationStatus = "open" | "closed" | "resolved";

export interface Conversation {
  id: string;
  alert_id: string | null;
  found_report_id: string | null;
  owner_id: string;
  finder_id: string | null;
  status: ConversationStatus;
  consent_shared: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
