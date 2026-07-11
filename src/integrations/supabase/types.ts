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
      coupon_redemptions: {
        Row: {
          coupon_id: string
          discount_amount: number
          id: string
          order_id: string | null
          phone: string | null
          redeemed_at: string
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          discount_amount: number
          id?: string
          order_id?: string | null
          phone?: string | null
          redeemed_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          discount_amount?: number
          id?: string
          order_id?: string | null
          phone?: string | null
          redeemed_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_targets: {
        Row: {
          coupon_id: string
          created_at: string
          target_id: string
          target_type: Database["public"]["Enums"]["coupon_target_type"]
        }
        Insert: {
          coupon_id: string
          created_at?: string
          target_id: string
          target_type: Database["public"]["Enums"]["coupon_target_type"]
        }
        Update: {
          coupon_id?: string
          created_at?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["coupon_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "coupon_targets_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applies_to: Database["public"]["Enums"]["coupon_applies_to"]
          cap_amount: number | null
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          ends_at: string | null
          exclude_shipping: boolean
          id: string
          is_active: boolean
          max_uses_per_customer: number | null
          max_uses_total: number | null
          min_spend: number
          name: string
          scope: Database["public"]["Enums"]["coupon_scope"]
          stackable: boolean
          starts_at: string | null
          updated_at: string
          uses_count: number
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["coupon_applies_to"]
          cap_amount?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          ends_at?: string | null
          exclude_shipping?: boolean
          id?: string
          is_active?: boolean
          max_uses_per_customer?: number | null
          max_uses_total?: number | null
          min_spend?: number
          name: string
          scope?: Database["public"]["Enums"]["coupon_scope"]
          stackable?: boolean
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["coupon_applies_to"]
          cap_amount?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          ends_at?: string | null
          exclude_shipping?: boolean
          id?: string
          is_active?: boolean
          max_uses_per_customer?: number | null
          max_uses_total?: number | null
          min_spend?: number
          name?: string
          scope?: Database["public"]["Enums"]["coupon_scope"]
          stackable?: boolean
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          category: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          is_system: boolean
          key: string | null
          name: string
          subject: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body_html: string
          category?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          key?: string | null
          name: string
          subject: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body_html?: string
          category?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          key?: string | null
          name?: string
          subject?: string
          updated_at?: string
          variables?: Json
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
      lms_courses: {
        Row: {
          compare_at_price_bdt: number | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          id: string
          is_active: boolean
          media_items: Json
          meta_description: string | null
          meta_title: string | null
          price_bdt: number
          semester_id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          compare_at_price_bdt?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          media_items?: Json
          meta_description?: string | null
          meta_title?: string | null
          price_bdt?: number
          semester_id: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          compare_at_price_bdt?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          media_items?: Json
          meta_description?: string | null
          meta_title?: string | null
          price_bdt?: number
          semester_id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "lms_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_courses_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "lms_semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_departments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lms_enrollments: {
        Row: {
          course_id: string
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          order_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "lms_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_lessons: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          is_free: boolean
          module_id: string
          sort_order: number
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_provider: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_free?: boolean
          module_id: string
          sort_order?: number
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_provider?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_free?: boolean
          module_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_provider?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "lms_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          sort_order: number
          subject_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          subject_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          subject_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_modules_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "lms_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_semesters: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lms_subject_departments: {
        Row: {
          category_id: string
          subject_id: string
        }
        Insert: {
          category_id: string
          subject_id: string
        }
        Update: {
          category_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_subject_departments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lms_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_subject_departments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "lms_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_subject_instructors: {
        Row: {
          assigned_at: string
          instructor_user_id: string
          role: string
          subject_id: string
        }
        Insert: {
          assigned_at?: string
          instructor_user_id: string
          role?: string
          subject_id: string
        }
        Update: {
          assigned_at?: string
          instructor_user_id?: string
          role?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_subject_instructors_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "lms_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_subject_placements: {
        Row: {
          created_at: string
          department_id: string
          id: string
          semester_id: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          semester_id: string
          subject_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          semester_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_subject_placements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "lms_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_subject_placements_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "lms_semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_subject_placements_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "lms_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_subject_semesters: {
        Row: {
          category_id: string
          subject_id: string
        }
        Insert: {
          category_id: string
          subject_id: string
        }
        Update: {
          category_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_subject_semesters_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lms_semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_subject_semesters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "lms_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_subjects: {
        Row: {
          code: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_email_deliveries: {
        Row: {
          attempt_no: number
          bounce_type: string | null
          bounced_at: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          error_reason: string | null
          from_email: string | null
          id: string
          kind: string
          next_retry_at: string | null
          opened_at: string | null
          order_id: string
          provider_payload: Json | null
          resend_email_id: string | null
          sender_user_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject: string | null
          to_email: string
          updated_at: string
        }
        Insert: {
          attempt_no?: number
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_reason?: string | null
          from_email?: string | null
          id?: string
          kind?: string
          next_retry_at?: string | null
          opened_at?: string | null
          order_id: string
          provider_payload?: Json | null
          resend_email_id?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string | null
          to_email: string
          updated_at?: string
        }
        Update: {
          attempt_no?: number
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error_reason?: string | null
          from_email?: string | null
          id?: string
          kind?: string
          next_retry_at?: string | null
          opened_at?: string | null
          order_id?: string
          provider_payload?: Json | null
          resend_email_id?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string | null
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_email_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      order_sms_deliveries: {
        Row: {
          body: string
          created_at: string
          error_reason: string | null
          id: string
          is_unicode: boolean
          kind: string
          order_id: string
          provider_response: string | null
          provider_status: number | null
          sender_user_id: string | null
          sms_count: number
          status: string
          to_phone: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          error_reason?: string | null
          id?: string
          is_unicode?: boolean
          kind?: string
          order_id: string
          provider_response?: string | null
          provider_status?: number | null
          sender_user_id?: string | null
          sms_count?: number
          status?: string
          to_phone: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          error_reason?: string | null
          id?: string
          is_unicode?: boolean
          kind?: string
          order_id?: string
          provider_response?: string | null
          provider_status?: number | null
          sender_user_id?: string | null
          sms_count?: number
          status?: string
          to_phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_sms_deliveries_order_id_fkey"
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
          created_by_user_id: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_type: number
          device_fingerprint: string | null
          digital_attempt_count: number
          digital_delivered_at: string | null
          digital_last_error: string | null
          digital_locked_until: string | null
          digital_next_retry_at: string | null
          digital_status: Database["public"]["Enums"]["digital_fulfillment_status"]
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
          physical_status: Database["public"]["Enums"]["physical_fulfillment_status"]
          shipping_bdt: number
          source: string
          source_detail: string | null
          status: string
          steadfast_consignment_id: string | null
          steadfast_delivery_status: string | null
          steadfast_last_error: string | null
          steadfast_retry_count: number
          steadfast_status: string | null
          steadfast_status_updated_at: string | null
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
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_type?: number
          device_fingerprint?: string | null
          digital_attempt_count?: number
          digital_delivered_at?: string | null
          digital_last_error?: string | null
          digital_locked_until?: string | null
          digital_next_retry_at?: string | null
          digital_status?: Database["public"]["Enums"]["digital_fulfillment_status"]
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
          physical_status?: Database["public"]["Enums"]["physical_fulfillment_status"]
          shipping_bdt?: number
          source?: string
          source_detail?: string | null
          status?: string
          steadfast_consignment_id?: string | null
          steadfast_delivery_status?: string | null
          steadfast_last_error?: string | null
          steadfast_retry_count?: number
          steadfast_status?: string | null
          steadfast_status_updated_at?: string | null
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
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_type?: number
          device_fingerprint?: string | null
          digital_attempt_count?: number
          digital_delivered_at?: string | null
          digital_last_error?: string | null
          digital_locked_until?: string | null
          digital_next_retry_at?: string | null
          digital_status?: Database["public"]["Enums"]["digital_fulfillment_status"]
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
          physical_status?: Database["public"]["Enums"]["physical_fulfillment_status"]
          shipping_bdt?: number
          source?: string
          source_detail?: string | null
          status?: string
          steadfast_consignment_id?: string | null
          steadfast_delivery_status?: string | null
          steadfast_last_error?: string | null
          steadfast_retry_count?: number
          steadfast_status?: string | null
          steadfast_status_updated_at?: string | null
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
          ebook_file_url: string | null
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
          ebook_file_url?: string | null
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
          ebook_file_url?: string | null
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
      sms_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          is_system: boolean
          key: string | null
          name: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          key?: string | null
          name: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          key?: string | null
          name?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      steadfast_status_events: {
        Row: {
          consignment_id: string | null
          created_at: string
          id: string
          invoice: string | null
          order_id: string | null
          raw: Json
          received_at: string
          status: string
          tracking_code: string | null
        }
        Insert: {
          consignment_id?: string | null
          created_at?: string
          id?: string
          invoice?: string | null
          order_id?: string | null
          raw?: Json
          received_at?: string
          status: string
          tracking_code?: string | null
        }
        Update: {
          consignment_id?: string | null
          created_at?: string
          id?: string
          invoice?: string | null
          order_id?: string | null
          raw?: Json
          received_at?: string
          status?: string
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "steadfast_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      has_course_access: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
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
      initialize_order_fulfillment: {
        Args: { _order_id: string }
        Returns: undefined
      }
      next_order_no: { Args: never; Returns: string }
      recompute_order_status: {
        Args: { _order_id: string }
        Returns: undefined
      }
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
      validate_coupon: {
        Args: {
          _category_ids: string[]
          _code: string
          _phone: string
          _product_ids: string[]
          _scope?: Database["public"]["Enums"]["coupon_scope"]
          _subtotal: number
          _user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "student" | "employee" | "instructor" | "super_admin"
      coupon_applies_to:
        | "all"
        | "products"
        | "categories"
        | "courses"
        | "customers"
      coupon_discount_type: "percent" | "flat"
      coupon_scope: "shop" | "course" | "special"
      coupon_target_type: "product" | "category" | "course" | "customer"
      digital_fulfillment_status:
        | "not_applicable"
        | "pending"
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "failed"
        | "delayed"
        | "manual_review"
      email_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "delayed"
        | "failed"
        | "opened"
        | "clicked"
        | "scheduled"
      physical_fulfillment_status:
        | "not_applicable"
        | "pending"
        | "ready_to_ship"
        | "shipped"
        | "delivered"
        | "returned"
        | "hold"
        | "cancelled"
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
      coupon_applies_to: [
        "all",
        "products",
        "categories",
        "courses",
        "customers",
      ],
      coupon_discount_type: ["percent", "flat"],
      coupon_scope: ["shop", "course", "special"],
      coupon_target_type: ["product", "category", "course", "customer"],
      digital_fulfillment_status: [
        "not_applicable",
        "pending",
        "queued",
        "sent",
        "delivered",
        "bounced",
        "failed",
        "delayed",
        "manual_review",
      ],
      email_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "delayed",
        "failed",
        "opened",
        "clicked",
        "scheduled",
      ],
      physical_fulfillment_status: [
        "not_applicable",
        "pending",
        "ready_to_ship",
        "shipped",
        "delivered",
        "returned",
        "hold",
        "cancelled",
      ],
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
