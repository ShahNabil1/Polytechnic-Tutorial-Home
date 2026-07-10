export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blocked_identifiers: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          kind: string
          reason: string | null
          value: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          kind: string
          reason?: string | null
          value: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          reason?: string | null
          value?: string
        }
        Relationships: []
      }
      incomplete_checkouts: {
        Row: {
          address_line: string | null
          attempt_count: number
          attempts: Json
          cart: Json
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string
          district: string | null
          division: string | null
          first_attempt_at: string
          id: string
          last_attempt_at: string
          last_fingerprint: string | null
          last_ip: unknown
          last_outcome: string
          last_user_agent: string | null
          shipping_bdt: number
          signature: string
          subtotal_bdt: number
          thana: string | null
          total_bdt: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_line?: string | null
          attempt_count?: number
          attempts?: Json
          cart?: Json
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone: string
          district?: string | null
          division?: string | null
          first_attempt_at?: string
          id?: string
          last_attempt_at?: string
          last_fingerprint?: string | null
          last_ip?: unknown
          last_outcome?: string
          last_user_agent?: string | null
          shipping_bdt?: number
          signature: string
          subtotal_bdt?: number
          thana?: string | null
          total_bdt?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_line?: string | null
          attempt_count?: number
          attempts?: Json
          cart?: Json
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string
          district?: string | null
          division?: string | null
          first_attempt_at?: string
          id?: string
          last_attempt_at?: string
          last_fingerprint?: string | null
          last_ip?: unknown
          last_outcome?: string
          last_user_agent?: string | null
          shipping_bdt?: number
          signature?: string
          subtotal_bdt?: number
          thana?: string | null
          total_bdt?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      internal_profiles: {
        Row: {
          address: string | null
          bank_details: Json | null
          created_at: string
          cv_r2_key: string | null
          departments: string[]
          display_id: string
          first_login_completed: boolean
          is_active: boolean
          job_role: string | null
          mfa_enrolled: boolean
          nid_number: string | null
          subjects: string[]
          updated_at: string
          user_id: string
          workplace: string | null
        }
        Insert: {
          address?: string | null
          bank_details?: Json | null
          created_at?: string
          cv_r2_key?: string | null
          departments?: string[]
          display_id: string
          first_login_completed?: boolean
          is_active?: boolean
          job_role?: string | null
          mfa_enrolled?: boolean
          nid_number?: string | null
          subjects?: string[]
          updated_at?: string
          user_id: string
          workplace?: string | null
        }
        Update: {
          address?: string | null
          bank_details?: Json | null
          created_at?: string
          cv_r2_key?: string | null
          departments?: string[]
          display_id?: string
          first_login_completed?: boolean
          is_active?: boolean
          job_role?: string | null
          mfa_enrolled?: boolean
          nid_number?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string
          workplace?: string | null
        }
        Relationships: []
      }
      order_internal_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_internal_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          bundle_id: string | null
          created_at: string
          id: string
          image_url: string | null
          is_bundle: boolean
          item_type: string
          line_total: number
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          title: string
          unit_price: number
        }
        Insert: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_bundle?: boolean
          item_type?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title: string
          unit_price?: number
        }
        Update: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_bundle?: boolean
          item_type?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_line: string | null
          alternative_phone: string | null
          cod_amount: number
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_type: number
          device_fingerprint: string | null
          discount_bdt: number
          district: string | null
          division: string | null
          full_address: string | null
          has_physical: boolean
          id: string
          idempotency_key: string | null
          ip: unknown
          item_description: string | null
          note: string | null
          order_no: string
          order_type: string
          payment_method: string | null
          payment_status: string
          shipping_bdt: number
          status: string
          steadfast_consignment_id: string | null
          steadfast_status: string | null
          steadfast_synced_at: string | null
          steadfast_tracking_code: string | null
          subtotal_bdt: number
          thana: string | null
          total_bdt: number
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          address_line?: string | null
          alternative_phone?: string | null
          cod_amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_type?: number
          device_fingerprint?: string | null
          discount_bdt?: number
          district?: string | null
          division?: string | null
          full_address?: string | null
          has_physical?: boolean
          id?: string
          idempotency_key?: string | null
          ip?: unknown
          item_description?: string | null
          note?: string | null
          order_no: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          shipping_bdt?: number
          status?: string
          steadfast_consignment_id?: string | null
          steadfast_status?: string | null
          steadfast_synced_at?: string | null
          steadfast_tracking_code?: string | null
          subtotal_bdt?: number
          thana?: string | null
          total_bdt?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          address_line?: string | null
          alternative_phone?: string | null
          cod_amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_type?: number
          device_fingerprint?: string | null
          discount_bdt?: number
          district?: string | null
          division?: string | null
          full_address?: string | null
          has_physical?: boolean
          id?: string
          idempotency_key?: string | null
          ip?: unknown
          item_description?: string | null
          note?: string | null
          order_no?: string
          order_type?: string
          payment_method?: string | null
          payment_status?: string
          shipping_bdt?: number
          status?: string
          steadfast_consignment_id?: string | null
          steadfast_status?: string | null
          steadfast_synced_at?: string | null
          steadfast_tracking_code?: string | null
          subtotal_bdt?: number
          thana?: string | null
          total_bdt?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      product_bundle_items: {
        Row: {
          bundle_id: string
          product_id: string
          quantity: number
          sort_order: number
        }
        Insert: {
          bundle_id: string
          product_id: string
          quantity?: number
          sort_order?: number
        }
        Update: {
          bundle_id?: string
          product_id?: string
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "product_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bundles: {
        Row: {
          compare_price: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          images: Json
          is_active: boolean
          is_featured: boolean
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          price: number
          sku: string
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          compare_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          images?: Json
          is_active?: boolean
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          price?: number
          sku: string
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          compare_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          images?: Json
          is_active?: boolean
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          price?: number
          sku?: string
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["product_category_kind"]
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["product_category_kind"]
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_category_kind"]
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_subcategories: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_subcategories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          compare_price: number | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          images: Json
          is_active: boolean
          is_featured: boolean
          is_online_book: boolean
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          price: number
          product_type_id: string
          sku: string | null
          slug: string
          stock: number | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          compare_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          images?: Json
          is_active?: boolean
          is_featured?: boolean
          is_online_book?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          price?: number
          product_type_id: string
          sku?: string | null
          slug: string
          stock?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          compare_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          images?: Json
          is_active?: boolean
          is_featured?: boolean
          is_online_book?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          price?: number
          product_type_id?: string
          sku?: string | null
          slug?: string
          stock?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          board_roll: string | null
          created_at: string
          current_semester: Database["public"]["Enums"]["semester_level"] | null
          department_name: string | null
          email: string | null
          full_name: string | null
          id: string
          institute_name: string | null
          phone: string | null
          phone_verified: boolean
          registration_no: string | null
          student_id: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          board_roll?: string | null
          created_at?: string
          current_semester?:
            | Database["public"]["Enums"]["semester_level"]
            | null
          department_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          institute_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          registration_no?: string | null
          student_id?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          board_roll?: string | null
          created_at?: string
          current_semester?:
            | Database["public"]["Enums"]["semester_level"]
            | null
          department_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          institute_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          registration_no?: string | null
          student_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_label: string | null
          device_type: string | null
          id: string
          ip: string | null
          last_seen_at: string
          latitude: number | null
          longitude: number | null
          os: string | null
          region: string | null
          session_token_hash: string
          timezone: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_label?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          region?: string | null
          session_token_hash: string
          timezone?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_label?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          region?: string | null
          session_token_hash?: string
          timezone?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          phone: string | null
          purpose: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at: string
          id?: string
          phone?: string | null
          purpose: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string | null
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          phone: string | null
          public_key: string
          transports: string[]
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          phone?: string | null
          public_key: string
          transports?: string[]
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          phone?: string | null
          public_key?: string
          transports?: string[]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_passkey_auth_session: {
        Args: {
          _ip: string
          _refresh_token_counter: number
          _refresh_token_hmac_key: string
          _user_agent: string
          _user_id: string
        }
        Returns: string
      }
      generate_internal_display_id: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: string
      }
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_order_no: { Args: never; Returns: string }
      record_incomplete_attempt: {
        Args: {
          _address_line: string
          _cart: Json
          _customer_email: string
          _customer_name: string
          _customer_phone: string
          _district: string
          _division: string
          _fingerprint: string
          _gateway_ref: string
          _ip: string
          _outcome: string
          _shipping: number
          _signature: string
          _subtotal: number
          _thana: string
          _total: number
          _user_agent: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "student" | "employee" | "instructor" | "super_admin"
      product_category_kind: "product_type" | "department" | "semester"
      semester_level:
        | "1st"
        | "2nd"
        | "3rd"
        | "4th"
        | "5th"
        | "6th"
        | "7th"
        | "8th"
        | "graduated"
        | "probation"
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
  public: {
    Enums: {
      app_role: ["student", "employee", "instructor", "super_admin"],
      product_category_kind: ["product_type", "department", "semester"],
      semester_level: [
        "1st",
        "2nd",
        "3rd",
        "4th",
        "5th",
        "6th",
        "7th",
        "8th",
        "graduated",
        "probation",
      ],
    },
  },
} as const
