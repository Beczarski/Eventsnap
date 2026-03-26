export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          is_active: boolean;
          is_archived: boolean;
          location: string | null;
          logo_url: string | null;
          name: string;
          overlay_opacity: number;
          overlay_position: string;
        };
        Insert: {
          created_at?: string;
          date?: string;
          id?: string;
          is_active?: boolean;
          is_archived?: boolean;
          location?: string | null;
          logo_url?: string | null;
          name: string;
          overlay_opacity?: number;
          overlay_position?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          is_active?: boolean;
          is_archived?: boolean;
          location?: string | null;
          logo_url?: string | null;
          name?: string;
          overlay_opacity?: number;
          overlay_position?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          is_printed: boolean;
          is_shared: boolean;
          original_url: string;
          print_count: number;
          processed_url: string | null;
          share_token: string | null;
          shared_via: string[] | null;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          is_printed?: boolean;
          is_shared?: boolean;
          original_url: string;
          print_count?: number;
          processed_url?: string | null;
          share_token?: string | null;
          shared_via?: string[] | null;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          is_printed?: boolean;
          is_shared?: boolean;
          original_url?: string;
          print_count?: number;
          processed_url?: string | null;
          share_token?: string | null;
          shared_via?: string[] | null;
        };
        Relationships: [];
      };
      print_jobs: {
        Row: {
          copies: number;
          created_at: string;
          event_id: string;
          id: string;
          paper_size: string;
          photo_id: string;
          status: string;
        };
        Insert: {
          copies?: number;
          created_at?: string;
          event_id: string;
          id?: string;
          paper_size?: string;
          photo_id: string;
          status?: string;
        };
        Update: {
          copies?: number;
          created_at?: string;
          event_id?: string;
          id?: string;
          paper_size?: string;
          photo_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      shares: {
        Row: {
          created_at: string;
          id: string;
          photo_id: string;
          recipient: string | null;
          share_type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          photo_id: string;
          recipient?: string | null;
          share_type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          photo_id?: string;
          recipient?: string | null;
          share_type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type EventRow = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type PhotoRow = Database['public']['Tables']['photos']['Row'];
export type PhotoInsert = Database['public']['Tables']['photos']['Insert'];
export type PrintJobRow = Database['public']['Tables']['print_jobs']['Row'];
export type PrintJobInsert = Database['public']['Tables']['print_jobs']['Insert'];
export type ShareRow = Database['public']['Tables']['shares']['Row'];
export type ShareInsert = Database['public']['Tables']['shares']['Insert'];
