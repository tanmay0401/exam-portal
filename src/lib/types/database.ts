export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "student";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type CorrectOption = "A" | "B" | "C" | "D";
export type ExamStatus = "draft" | "published" | "closed";
export type AttemptStatus = "in_progress" | "submitted" | "graded";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subjects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      questions: {
        Row: {
          id: string;
          subject_id: string;
          question_text: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: CorrectOption;
          difficulty: QuestionDifficulty;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          question_text: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: CorrectOption;
          difficulty?: QuestionDifficulty;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          question_text?: string;
          option_a?: string;
          option_b?: string;
          option_c?: string;
          option_d?: string;
          correct_option?: CorrectOption;
          difficulty?: QuestionDifficulty;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      exams: {
        Row: {
          id: string;
          title: string;
          subject_id: string | null;
          total_questions: number;
          marks_per_question: number;
          negative_marks: number;
          max_marks: number;
          duration_minutes: number;
          batch_count: number;
          allow_question_reuse: boolean;
          status: ExamStatus;
          is_dry_run: boolean;
          selected_batch_id: string | null;
          published_at: string | null;
          exam_link_token: string | null;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subject_id?: string | null;
          total_questions: number;
          marks_per_question?: number;
          negative_marks?: number;
          duration_minutes: number;
          batch_count?: number;
          allow_question_reuse?: boolean;
          status?: ExamStatus;
          is_dry_run?: boolean;
          selected_batch_id?: string | null;
          published_at?: string | null;
          exam_link_token?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subject_id?: string | null;
          total_questions?: number;
          marks_per_question?: number;
          negative_marks?: number;
          duration_minutes?: number;
          batch_count?: number;
          allow_question_reuse?: boolean;
          status?: ExamStatus;
          is_dry_run?: boolean;
          selected_batch_id?: string | null;
          published_at?: string | null;
          exam_link_token?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exams_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exams_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      exam_batches: {
        Row: {
          id: string;
          exam_id: string;
          batch_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          batch_number: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          exam_id?: string;
          batch_number?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_batches_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          }
        ];
      };
      exam_batch_questions: {
        Row: {
          id: string;
          batch_id: string;
          question_id: string;
          question_order: number;
        };
        Insert: {
          id?: string;
          batch_id: string;
          question_id: string;
          question_order: number;
        };
        Update: {
          id?: string;
          batch_id?: string;
          question_id?: string;
          question_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "exam_batch_questions_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "exam_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_batch_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
      exam_attempts: {
        Row: {
          id: string;
          exam_id: string;
          student_id: string;
          batch_id: string | null;
          started_at: string;
          submitted_at: string | null;
          is_auto_submitted: boolean;
          is_dry_run: boolean;
          score: number | null;
          total_correct: number;
          total_incorrect: number;
          total_unanswered: number;
          status: AttemptStatus;
          proctor_log: Json;
        };
        Insert: {
          id?: string;
          exam_id: string;
          student_id: string;
          batch_id?: string | null;
          started_at?: string;
          submitted_at?: string | null;
          is_auto_submitted?: boolean;
          is_dry_run?: boolean;
          score?: number | null;
          total_correct?: number;
          total_incorrect?: number;
          total_unanswered?: number;
          status?: AttemptStatus;
          proctor_log?: Json;
        };
        Update: {
          id?: string;
          exam_id?: string;
          student_id?: string;
          batch_id?: string | null;
          started_at?: string;
          submitted_at?: string | null;
          is_auto_submitted?: boolean;
          is_dry_run?: boolean;
          score?: number | null;
          total_correct?: number;
          total_incorrect?: number;
          total_unanswered?: number;
          status?: AttemptStatus;
          proctor_log?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_attempts_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "exam_batches";
            referencedColumns: ["id"];
          }
        ];
      };
      exam_responses: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          question_order: number;
          selected_option: string | null;
          is_marked_for_review: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          question_order: number;
          selected_option?: string | null;
          is_marked_for_review?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          question_order?: number;
          selected_option?: string | null;
          is_marked_for_review?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_responses_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "exam_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_responses_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      question_difficulty: QuestionDifficulty;
      correct_option: CorrectOption;
      exam_status: ExamStatus;
      attempt_status: AttemptStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Profile = Tables<"profiles">;
export type Subject = Tables<"subjects">;
export type Question = Tables<"questions">;
export type Exam = Tables<"exams">;
export type ExamBatch = Tables<"exam_batches">;
export type ExamBatchQuestion = Tables<"exam_batch_questions">;
export type ExamAttempt = Tables<"exam_attempts">;
export type ExamResponse = Tables<"exam_responses">;
