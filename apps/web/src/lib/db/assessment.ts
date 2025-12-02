import { supabase } from '$lib/supabase';

export interface AssessmentResults {
	domain_scores: Record<string, number>;
	ai_report: string;
	completed_at: string;
}

export async function getAssessmentResults(): Promise<AssessmentResults | null> {
	const { data, error } = await supabase
		.from('assessment_results')
		.select('domain_scores, ai_report, completed_at')
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			// No results found - user hasn't completed assessment
			return null;
		}
		throw error;
	}

	return data;
}
