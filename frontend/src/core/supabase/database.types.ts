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
      app_settings: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: string;
          organization_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: string;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      card_templates: {
        Row: {
          back_template: string;
          created_at: string;
          deleted_at: string | null;
          front_template: string;
          id: string;
          name: string;
          note_type_id: string;
          ord: number;
          organization_id: string | null;
          server_updated_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          back_template: string;
          created_at?: string;
          deleted_at?: string | null;
          front_template: string;
          id?: string;
          name: string;
          note_type_id: string;
          ord: number;
          organization_id?: string | null;
          server_updated_at?: string;
          updated_at?: string;
        };
        Update: {
          back_template?: string;
          created_at?: string;
          deleted_at?: string | null;
          front_template?: string;
          id?: string;
          name?: string;
          note_type_id?: string;
          ord?: number;
          organization_id?: string | null;
          server_updated_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_templates_note_type_id_fkey";
            columns: ["note_type_id"];
            isOneToOne: false;
            referencedRelation: "note_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cards: {
        Row: {
          created_at: string;
          deck_id: string;
          deleted_at: string | null;
          difficulty: number;
          due_at: string;
          fsrs_model: string;
          id: string;
          lapses: number;
          last_review_at: string | null;
          learning_step: number;
          note_id: string;
          organization_id: string;
          reps: number;
          scheduled_days: number;
          server_updated_at: string;
          stability: number;
          stability_fast: number;
          state: number;
          suspended: boolean;
          template_ord: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deck_id: string;
          deleted_at?: string | null;
          difficulty?: number;
          due_at?: string;
          fsrs_model?: string;
          id?: string;
          lapses?: number;
          last_review_at?: string | null;
          learning_step?: number;
          note_id: string;
          organization_id: string;
          reps?: number;
          scheduled_days?: number;
          server_updated_at?: string;
          stability?: number;
          stability_fast?: number;
          state?: number;
          suspended?: boolean;
          template_ord: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deck_id?: string;
          deleted_at?: string | null;
          difficulty?: number;
          due_at?: string;
          fsrs_model?: string;
          id?: string;
          lapses?: number;
          last_review_at?: string | null;
          learning_step?: number;
          note_id?: string;
          organization_id?: string;
          reps?: number;
          scheduled_days?: number;
          server_updated_at?: string;
          stability?: number;
          stability_fast?: number;
          state?: number;
          suspended?: boolean;
          template_ord?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cards_organization_id_deck_id_fkey";
            columns: ["organization_id", "deck_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "cards_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cards_organization_id_note_id_fkey";
            columns: ["organization_id", "note_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      consents: {
        Row: {
          created_at: string;
          granted: boolean;
          id: string;
          purpose: string;
          text_version: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted: boolean;
          id?: string;
          purpose: string;
          text_version: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          id?: string;
          purpose?: string;
          text_version?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      deck_configs: {
        Row: {
          answer_buttons: number;
          created_at: string;
          deleted_at: string | null;
          desired_retention: number;
          id: string;
          learning_steps: string[];
          maximum_interval: number;
          name: string;
          new_per_day: number;
          organization_id: string;
          relearning_steps: string[];
          reviews_per_day: number;
          server_updated_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          answer_buttons?: number;
          created_at?: string;
          deleted_at?: string | null;
          desired_retention?: number;
          id?: string;
          learning_steps?: string[];
          maximum_interval?: number;
          name: string;
          new_per_day?: number;
          organization_id: string;
          relearning_steps?: string[];
          reviews_per_day?: number;
          server_updated_at?: string;
          updated_at?: string;
        };
        Update: {
          answer_buttons?: number;
          created_at?: string;
          deleted_at?: string | null;
          desired_retention?: number;
          id?: string;
          learning_steps?: string[];
          maximum_interval?: number;
          name?: string;
          new_per_day?: number;
          organization_id?: string;
          relearning_steps?: string[];
          reviews_per_day?: number;
          server_updated_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deck_configs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      decks: {
        Row: {
          config_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          lang: string | null;
          name: string;
          organization_id: string;
          parent_id: string | null;
          position: number;
          server_updated_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          config_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          lang?: string | null;
          name: string;
          organization_id: string;
          parent_id?: string | null;
          position?: number;
          server_updated_at?: string;
          updated_at?: string;
        };
        Update: {
          config_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          lang?: string | null;
          name?: string;
          organization_id?: string;
          parent_id?: string | null;
          position?: number;
          server_updated_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decks_organization_id_config_id_fkey";
            columns: ["organization_id", "config_id"];
            isOneToOne: false;
            referencedRelation: "deck_configs";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "decks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decks_organization_id_parent_id_fkey";
            columns: ["organization_id", "parent_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          description: string | null;
          enabled: boolean;
          id: string;
          key: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_type_fields: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          field_key: string;
          id: string;
          name: string;
          note_type_id: string;
          ord: number;
          organization_id: string | null;
          server_updated_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          field_key: string;
          id?: string;
          name: string;
          note_type_id: string;
          ord: number;
          organization_id?: string | null;
          server_updated_at?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          field_key?: string;
          id?: string;
          name?: string;
          note_type_id?: string;
          ord?: number;
          organization_id?: string | null;
          server_updated_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_type_fields_note_type_id_fkey";
            columns: ["note_type_id"];
            isOneToOne: false;
            referencedRelation: "note_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "note_type_fields_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      note_types: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          key: string | null;
          kind: string;
          name: string;
          organization_id: string | null;
          server_updated_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          key?: string | null;
          kind?: string;
          name: string;
          organization_id?: string | null;
          server_updated_at?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          key?: string | null;
          kind?: string;
          name?: string;
          organization_id?: string | null;
          server_updated_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          created_at: string;
          deck_id: string;
          dedupe_key: string | null;
          deleted_at: string | null;
          external_guid: string | null;
          fields: NonNullable<Json>;
          id: string;
          lang: string | null;
          level: string | null;
          note_type_id: string;
          organization_id: string;
          server_updated_at: string;
          source: string | null;
          tags: string[];
          topic: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deck_id: string;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          external_guid?: string | null;
          fields?: NonNullable<Json>;
          id?: string;
          lang?: string | null;
          level?: string | null;
          note_type_id: string;
          organization_id: string;
          server_updated_at?: string;
          source?: string | null;
          tags?: string[];
          topic?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deck_id?: string;
          dedupe_key?: string | null;
          deleted_at?: string | null;
          external_guid?: string | null;
          fields?: NonNullable<Json>;
          id?: string;
          lang?: string | null;
          level?: string | null;
          note_type_id?: string;
          organization_id?: string;
          server_updated_at?: string;
          source?: string | null;
          tags?: string[];
          topic?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_note_type_id_fkey";
            columns: ["note_type_id"];
            isOneToOne: false;
            referencedRelation: "note_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_organization_id_deck_id_fkey";
            columns: ["organization_id", "deck_id"];
            isOneToOne: false;
            referencedRelation: "decks";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "notes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          key: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          key: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          active_organization_id: string | null;
          created_at: string;
          deletion_requested_at: string | null;
          display_name: string | null;
          id: string;
          locale: string;
          status: string;
          time_zone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active_organization_id?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          display_name?: string | null;
          id: string;
          locale?: string;
          status?: string;
          time_zone?: string;
          updated_at?: string;
        };
        Update: {
          active_organization_id?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          display_name?: string | null;
          id?: string;
          locale?: string;
          status?: string;
          time_zone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey";
            columns: ["active_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      review_logs: {
        Row: {
          card_id: string;
          created_at: string;
          difficulty: number;
          due_at: string;
          duration_ms: number | null;
          id: string;
          is_test: boolean;
          last_review_at: string | null;
          learning_step: number;
          organization_id: string;
          rating: number;
          reviewed_at: string;
          scheduled_days: number;
          server_updated_at: string;
          stability: number;
          stability_fast: number;
          state: number;
        };
        ComputedFields: never;
        Insert: {
          card_id: string;
          created_at?: string;
          difficulty: number;
          due_at: string;
          duration_ms?: number | null;
          id?: string;
          is_test?: boolean;
          last_review_at?: string | null;
          learning_step?: number;
          organization_id: string;
          rating: number;
          reviewed_at: string;
          scheduled_days: number;
          server_updated_at?: string;
          stability: number;
          stability_fast?: number;
          state: number;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          difficulty?: number;
          due_at?: string;
          duration_ms?: number | null;
          id?: string;
          is_test?: boolean;
          last_review_at?: string | null;
          learning_step?: number;
          organization_id?: string;
          rating?: number;
          reviewed_at?: string;
          scheduled_days?: number;
          server_updated_at?: string;
          stability?: number;
          stability_fast?: number;
          state?: number;
        };
        Relationships: [
          {
            foreignKeyName: "review_logs_organization_id_card_id_fkey";
            columns: ["organization_id", "card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "review_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          permission_id: string;
          role_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          created_at?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          key: string;
          name: string;
          organization_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key: string;
          name: string;
          organization_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key?: string;
          name?: string;
          organization_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      current_consents: {
        Row: {
          created_at: string;
          granted: boolean;
          purpose: string;
          text_version: string;
          user_id: string;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      cancel_account_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      request_account_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
