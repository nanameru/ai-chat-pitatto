export interface DBMessage {
  id: string;
  chat_id: string;
  content: string;
  role: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}
