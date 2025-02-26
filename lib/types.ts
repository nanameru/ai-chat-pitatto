// Common Response type for API endpoints
export interface Response {
  id?: string;
  role?: 'assistant' | 'user' | 'system';
  content?: string;
  createdAt?: Date;
  [key: string]: any; // Allow additional properties
}

export interface XSearchResponse {
  [key: string]: any;
}
