export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          attendance_date: string;
          class_name: string;
          created_at: string;
          id: string;
          marked_by: string | null;
          section: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          attendance_date: string;
          class_name: string;
          created_at?: string;
          id?: string;
          marked_by?: string | null;
          section: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          attendance_date?: string;
          class_name?: string;
          created_at?: string;
          id?: string;
          marked_by?: string | null;
          section?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          details: Json | null;
          entity: string;
          entity_id: string | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          details?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          details?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      daily_expenses: {
        Row: {
          budget: number;
          created_at: string;
          created_by: string | null;
          credits_saved: number;
          dal_cost: number;
          dal_kg: number;
          dal_rate: number;
          expense_date: string;
          fuel_cost: number;
          id: string;
          masala_cost: number;
          misc_cost: number;
          misc_note: string | null;
          present_count: number;
          rice_kg: number;
          total_expense: number;
          updated_at: string;
          veg_cost: number;
          veg_kg: number;
          veg_rate: number;
        };
        Insert: {
          budget?: number;
          created_at?: string;
          created_by?: string | null;
          credits_saved?: number;
          dal_cost?: number;
          dal_kg?: number;
          dal_rate?: number;
          expense_date: string;
          fuel_cost?: number;
          id?: string;
          masala_cost?: number;
          misc_cost?: number;
          misc_note?: string | null;
          present_count?: number;
          rice_kg?: number;
          total_expense?: number;
          updated_at?: string;
          veg_cost?: number;
          veg_kg?: number;
          veg_rate?: number;
        };
        Update: {
          budget?: number;
          created_at?: string;
          created_by?: string | null;
          credits_saved?: number;
          dal_cost?: number;
          dal_kg?: number;
          dal_rate?: number;
          expense_date?: string;
          fuel_cost?: number;
          id?: string;
          masala_cost?: number;
          misc_cost?: number;
          misc_note?: string | null;
          present_count?: number;
          rice_kg?: number;
          total_expense?: number;
          updated_at?: string;
          veg_cost?: number;
          veg_kg?: number;
          veg_rate?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          academic_year: string;
          budget_per_student: number;
          created_at: string;
          dal_per_student_g: number;
          fuel_per_student: number;
          id: boolean;
          logo_url: string | null;
          masala_per_student: number;
          rice_per_student_g: number;
          school_name: string;
          updated_at: string;
          veg_per_student_g: number;
        };
        Insert: {
          academic_year?: string;
          budget_per_student?: number;
          created_at?: string;
          dal_per_student_g?: number;
          fuel_per_student?: number;
          id?: boolean;
          logo_url?: string | null;
          masala_per_student?: number;
          rice_per_student_g?: number;
          school_name?: string;
          updated_at?: string;
          veg_per_student_g?: number;
        };
        Update: {
          academic_year?: string;
          budget_per_student?: number;
          created_at?: string;
          dal_per_student_g?: number;
          fuel_per_student?: number;
          id?: boolean;
          logo_url?: string | null;
          masala_per_student?: number;
          rice_per_student_g?: number;
          school_name?: string;
          updated_at?: string;
          veg_per_student_g?: number;
        };
        Relationships: [];
      };
      students: {
        Row: {
          address: string | null;
          admission_no: string;
          class_name: string;
          created_at: string;
          created_by: string | null;
          dob: string | null;
          father_name: string | null;
          gender: Database["public"]["Enums"]["gender_type"];
          id: string;
          mobile: string | null;
          mother_name: string | null;
          name: string;
          roll_no: string | null;
          section: string;
          status: Database["public"]["Enums"]["student_status"];
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          admission_no: string;
          class_name: string;
          created_at?: string;
          created_by?: string | null;
          dob?: string | null;
          father_name?: string | null;
          gender?: Database["public"]["Enums"]["gender_type"];
          id?: string;
          mobile?: string | null;
          mother_name?: string | null;
          name: string;
          roll_no?: string | null;
          section?: string;
          status?: Database["public"]["Enums"]["student_status"];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          admission_no?: string;
          class_name?: string;
          created_at?: string;
          created_by?: string | null;
          dob?: string | null;
          father_name?: string | null;
          gender?: Database["public"]["Enums"]["gender_type"];
          id?: string;
          mobile?: string | null;
          mother_name?: string | null;
          name?: string;
          roll_no?: string | null;
          section?: string;
          status?: Database["public"]["Enums"]["student_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "staff";
      attendance_status: "present" | "absent";
      gender_type: "male" | "female" | "other";
      student_status: "active" | "inactive" | "transferred";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      attendance_status: ["present", "absent"],
      gender_type: ["male", "female", "other"],
      student_status: ["active", "inactive", "transferred"],
    },
  },
} as const;
