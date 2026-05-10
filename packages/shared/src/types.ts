export type RuleMatchType = 'exact' | 'contains' | 'starts_with' | 'regex';

export type EventChannel = 'comment' | 'message';

export type ConversationStatus = 'open' | 'closed' | 'snoozed';

export interface FacebookWebhookEntry {
  id: string;
  time: number;
  changes?: FacebookChange[];
  messaging?: FacebookMessagingEvent[];
}

export interface FacebookChange {
  field: string;
  value: {
    item?: string;
    verb?: string;
    post_id?: string;
    comment_id?: string;
    parent_id?: string;
    sender_name?: string;
    sender_id?: string;
    message?: string;
    created_time?: number;
    from?: { id: string; name?: string };
  };
}

export interface FacebookMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
  };
  postback?: {
    title: string;
    payload: string;
  };
}

export interface FacebookWebhookPayload {
  object: 'page';
  entry: FacebookWebhookEntry[];
}
