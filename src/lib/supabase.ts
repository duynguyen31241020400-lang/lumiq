import { createClient as _createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Database type definitions
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      users: {
        Relationships: [];
        Row: {
          id: string;
          email: string | null;
          created_at: string;
          scaffold_level: 1 | 2 | 3;
          total_sessions: number;
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string;
          scaffold_level?: 1 | 2 | 3;
          total_sessions?: number;
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string;
          scaffold_level?: 1 | 2 | 3;
          total_sessions?: number;
        };
      };

      sessions: {
        Relationships: [];
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          started_at: string;
          ended_at: string | null;
          total_triggers: number;
          dominant_error_type: string | null;
          summary_text: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          started_at?: string;
          ended_at?: string | null;
          total_triggers?: number;
          dominant_error_type?: string | null;
          summary_text?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          started_at?: string;
          ended_at?: string | null;
          total_triggers?: number;
          dominant_error_type?: string | null;
          summary_text?: string | null;
        };
      };

      code_snapshots: {
        Relationships: [];
        Row: {
          id: string;
          session_id: string;
          triggered_at: string;
          trigger_type: "newline" | "run";
          code_content: string | null;
          line_count: number | null;
          cursor_line: number | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          triggered_at?: string;
          trigger_type: "newline" | "run";
          code_content?: string | null;
          line_count?: number | null;
          cursor_line?: number | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          triggered_at?: string;
          trigger_type?: "newline" | "run";
          code_content?: string | null;
          line_count?: number | null;
          cursor_line?: number | null;
        };
      };

      events: {
        Relationships: [];
        Row: {
          id: string;
          snapshot_id: string | null;
          session_id: string;
          event_type: "keystroke" | "pause" | "click" | "delete";
          line_number: number | null;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_id?: string | null;
          session_id: string;
          event_type: "keystroke" | "pause" | "click" | "delete";
          line_number?: number | null;
          duration_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_id?: string | null;
          session_id?: string;
          event_type?: "keystroke" | "pause" | "click" | "delete";
          line_number?: number | null;
          duration_ms?: number | null;
          created_at?: string;
        };
      };

      feedback_log: {
        Relationships: [];
        Row: {
          id: string;
          session_id: string;
          snapshot_id: string | null;
          created_at: string;
          error_type: string | null;
          feedback_text: string | null;
          scaffold_level_at_time: number | null;
          was_helpful: boolean | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          snapshot_id?: string | null;
          created_at?: string;
          error_type?: string | null;
          feedback_text?: string | null;
          scaffold_level_at_time?: number | null;
          was_helpful?: boolean | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          snapshot_id?: string | null;
          created_at?: string;
          error_type?: string | null;
          feedback_text?: string | null;
          scaffold_level_at_time?: number | null;
          was_helpful?: boolean | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return _createClient<Database>(url, key);
}
