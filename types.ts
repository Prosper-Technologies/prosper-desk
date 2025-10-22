export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          last_used_at: string | null
          name: string
          permissions: Json
          prefix: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          last_used_at?: string | null
          name: string
          permissions?: Json
          prefix: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          last_used_at?: string | null
          name?: string
          permissions?: Json
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          email_domains: string[]
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          portal_enabled: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          email_domains?: string[]
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          portal_enabled?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          email_domains?: string[]
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          portal_enabled?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          settings: Json | null
          size: Database["public"]["Enums"]["company_size"]
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          settings?: Json | null
          size: Database["public"]["Enums"]["company_size"]
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          settings?: Json | null
          size?: Database["public"]["Enums"]["company_size"]
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_portal_access: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_access_client_id_clients_id_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_access_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          company_id: string
          created_at: string
          gmail_thread_id: string
          id: string
          last_message_id: string | null
          participants: Json
          subject: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          gmail_thread_id: string
          id?: string
          last_message_id?: string | null
          participants?: Json
          subject: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          gmail_thread_id?: string
          id?: string
          last_message_id?: string | null
          participants?: Json
          subject?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_ticket_id_tickets_id_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_policies: {
        Row: {
          company_id: string
          created_at: string
          escalation_rules: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          escalation_rules: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          escalation_rules?: Json
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_policies_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_integration: {
        Row: {
          access_token: string | null
          auto_create_tickets: boolean
          auto_sync_enabled: boolean
          company_id: string
          created_at: string
          default_ticket_priority:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          email: string
          id: string
          is_active: boolean
          last_history_id: string | null
          last_sync_at: string | null
          refresh_token: string
          sync_frequency_minutes: number
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          auto_create_tickets?: boolean
          auto_sync_enabled?: boolean
          company_id: string
          created_at?: string
          default_ticket_priority?:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          email: string
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_sync_at?: string | null
          refresh_token: string
          sync_frequency_minutes?: number
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          auto_create_tickets?: boolean
          auto_sync_enabled?: boolean
          company_id?: string
          created_at?: string
          default_ticket_priority?:
            | Database["public"]["Enums"]["ticket_priority"]
            | null
          email?: string
          id?: string
          is_active?: boolean
          last_history_id?: string | null
          last_sync_at?: string | null
          refresh_token?: string
          sync_frequency_minutes?: number
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_integration_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_codes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          expires_at: string
          id: string
          invited_by_membership_id: string
          is_used: boolean
          role: Database["public"]["Enums"]["membership_role"]
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          expires_at: string
          id?: string
          invited_by_membership_id: string
          is_used?: boolean
          role: Database["public"]["Enums"]["membership_role"]
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invited_by_membership_id?: string
          is_used?: boolean
          role?: Database["public"]["Enums"]["membership_role"]
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_codes_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_invited_by_membership_id_memberships_id_fk"
            columns: ["invited_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_user_id_users_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          author_membership_id: string
          company_id: string
          content: string
          created_at: string
          id: string
          is_public: boolean
          is_published: boolean
          slug: string
          tags: Json | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_membership_id: string
          company_id: string
          content: string
          created_at?: string
          id?: string
          is_public?: boolean
          is_published?: boolean
          slug: string
          tags?: Json | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_membership_id?: string
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean
          is_published?: boolean
          slug?: string
          tags?: Json | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_author_membership_id_memberships_id_fk"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          joined_at: string
          role: Database["public"]["Enums"]["membership_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_users_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_time_minutes: number
          response_time_minutes: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_time_minutes: number
          response_time_minutes: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_time_minutes?: number
          response_time_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_client_id_clients_id_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_policies_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          attachments: Json | null
          company_id: string
          content: string
          created_at: string
          customer_portal_access_id: string | null
          id: string
          is_internal: boolean
          is_system: boolean
          membership_id: string | null
          parent_comment_id: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          company_id: string
          content: string
          created_at?: string
          customer_portal_access_id?: string | null
          id?: string
          is_internal?: boolean
          is_system?: boolean
          membership_id?: string | null
          parent_comment_id?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          company_id?: string
          content?: string
          created_at?: string
          customer_portal_access_id?: string | null
          id?: string
          is_internal?: boolean
          is_system?: boolean
          membership_id?: string | null
          parent_comment_id?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_customer_portal_access_id_customer_portal_acces"
            columns: ["customer_portal_access_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_membership_id_memberships_id_fk"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_parent_comment_id_ticket_comments_id_fk"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "ticket_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_tickets_id_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to_membership_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by_membership_id: string | null
          custom_fields: Json | null
          customer_email: string | null
          customer_name: string | null
          description: string
          escalation_level: number | null
          escalation_policy_id: string | null
          external_id: string | null
          external_type: string | null
          first_response_at: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          sla_policy_id: string | null
          sla_resolution_breach: boolean | null
          sla_response_breach: boolean | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags: Json | null
          updated_at: string
        }
        Insert: {
          assigned_to_membership_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by_membership_id?: string | null
          custom_fields?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          description: string
          escalation_level?: number | null
          escalation_policy_id?: string | null
          external_id?: string | null
          external_type?: string | null
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_policy_id?: string | null
          sla_resolution_breach?: boolean | null
          sla_response_breach?: boolean | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tags?: Json | null
          updated_at?: string
        }
        Update: {
          assigned_to_membership_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by_membership_id?: string | null
          custom_fields?: Json | null
          customer_email?: string | null
          customer_name?: string | null
          description?: string
          escalation_level?: number | null
          escalation_policy_id?: string | null
          external_id?: string | null
          external_type?: string | null
          first_response_at?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          sla_policy_id?: string | null
          sla_resolution_breach?: boolean | null
          sla_response_breach?: boolean | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tags?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_membership_id_memberships_id_fk"
            columns: ["assigned_to_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_clients_id_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_companies_id_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_created_by_membership_id_memberships_id_fk"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_escalation_policy_id_escalation_policies_id_fk"
            columns: ["escalation_policy_id"]
            isOneToOne: false
            referencedRelation: "escalation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_sla_policy_id_sla_policies_id_fk"
            columns: ["sla_policy_id"]
            isOneToOne: false
            referencedRelation: "sla_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          last_seen_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          last_seen_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          last_seen_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      company_size: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+"
      membership_role: "owner" | "admin" | "agent"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      company_size: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
      membership_role: ["owner", "admin", "agent"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const

