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
          source: string;
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
          source?: string;
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
          source?: string;
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
      canon_cameras: {
        Row: {
          id: string;
          event_id: string;
          model: string;
          ip_address: string;
          nickname: string | null;
          last_connected: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          model: string;
          ip_address: string;
          nickname?: string | null;
          last_connected?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          model?: string;
          ip_address?: string;
          nickname?: string | null;
          last_connected?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      email_settings: {
        Row: {
          id: string;
          smtp_server: string;
          smtp_port: number;
          encryption: string;
          username: string;
          password: string;
          sender_name: string;
          reply_to: string | null;
          email_subject_template: string;
          email_body_template: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          smtp_server?: string;
          smtp_port?: number;
          encryption?: string;
          username?: string;
          password?: string;
          sender_name?: string;
          reply_to?: string | null;
          email_subject_template?: string;
          email_body_template?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          smtp_server?: string;
          smtp_port?: number;
          encryption?: string;
          username?: string;
          password?: string;
          sender_name?: string;
          reply_to?: string | null;
          email_subject_template?: string;
          email_body_template?: string;
          created_at?: string | null;
          updated_at?: string | null;
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
export type CanonCameraRow = Database['public']['Tables']['canon_cameras']['Row'];
export type CanonCameraInsert = Database['public']['Tables']['canon_cameras']['Insert'];
export type EmailSettingsRow = Database['public']['Tables']['email_settings']['Row'];
export type EmailSettingsUpdate = Database['public']['Tables']['email_settings']['Update'];

export type PhotoSource = 'ipad_camera' | 'canon_import' | 'photos_library';
export type EncryptionType = 'ssl' | 'tls' | 'starttls' | 'none';
