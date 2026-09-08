export interface Club {
  id: string;
  club_number: string;
  name: string;
  description: string | null;
  image_url: string | null;
  color: string | null;
  owner_id: string;
  require_passkey: boolean;
  invite_token?: string;
  member_count: number;
  message_count: number;
  created_at: string;
  membership_role?: string;
  last_message?: { id: string; body: string; kind: string; sender_name: string; created_at: string } | null;
  unread_count?: number;
}

export interface Member {
  id: string;
  club_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_color: string | null;
  } | null;
}

export interface DM {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_text: string;
  last_message_at: string;
  peer: {
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    avatar_color: string | null;
  } | null;
  peer_id: string;
  last_message?: { id: string; body: string; kind: string; sender_name: string; created_at: string } | null;
  unread_count?: number;
}

export interface Reaction {
  emoji: string;
  user_ids: string[];
}

export interface ChatMessage {
  id: string;
  club_id: string | null;
  conversation_id: string | null;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_color: string | null;
  sender_username: string | null;
  kind: 'text' | 'image' | 'video' | 'file' | 'voice';
  body: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  duration_sec: number | null;
  reply_to_id: string | null;
  reply_preview: { id: string; sender_name: string; body: string; kind: string } | null;
  reactions: Reaction[];
  created_at: string;
}
