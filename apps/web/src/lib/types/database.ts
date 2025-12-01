/**
 * Database type definitions for Supabase tables
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			assessment_questions: {
				Row: {
					id: string;
					domain: string;
					question_text: string;
					question_type: 'scale' | 'emoji_scale' | 'multiple_choice' | 'open_ended';
					options: Json | null;
					scale_min: number | null;
					scale_max: number | null;
					scale_min_label: string | null;
					scale_max_label: string | null;
					weight: number;
					position: number;
					created_at: string;
				};
				Insert: Omit<Database['public']['Tables']['assessment_questions']['Row'], 'id' | 'created_at'>;
				Update: Partial<Database['public']['Tables']['assessment_questions']['Insert']>;
			};
			assessment_responses: {
				Row: {
					id: string;
					user_id: string;
					question_id: string;
					response_value: string | null;
					response_text: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: Omit<
					Database['public']['Tables']['assessment_responses']['Row'],
					'id' | 'created_at'
				>;
				Update: Partial<Database['public']['Tables']['assessment_responses']['Insert']>;
			};
			assessment_results: {
				Row: {
					id: string;
					user_id: string;
					domain_scores: Json;
					ai_report: string;
					completed_at: string;
					updated_at: string;
				};
				Insert: Omit<
					Database['public']['Tables']['assessment_results']['Row'],
					'id' | 'completed_at'
				>;
				Update: Partial<Database['public']['Tables']['assessment_results']['Insert']>;
			};
			user_profiles: {
				Row: {
					id: string;
					user_id: string;
					has_completed_questionnaire: boolean;
					profile_summary: string | null;
					communication_tone: string | null;
					focus_areas: string[] | null;
					last_profile_update: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'id' | 'created_at'>;
				Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
			};
		};
	};
}
