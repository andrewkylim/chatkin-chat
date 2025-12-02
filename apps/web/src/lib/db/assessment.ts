import { supabase } from '$lib/supabase';

export interface AssessmentResults {
	domain_scores: Record<string, number>;
	ai_report: string;
	completed_at: string;
	profile_summary?: string;
}

export async function getAssessmentResults(): Promise<AssessmentResults | null> {
	// Fetch assessment results
	const { data: assessmentData, error: assessmentError } = await supabase
		.from('assessment_results')
		.select('domain_scores, ai_report, completed_at')
		.single();

	if (assessmentError) {
		if (assessmentError.code === 'PGRST116') {
			// No results found - user hasn't completed assessment
			return null;
		}
		throw assessmentError;
	}

	// Fetch profile summary
	const { data: profileData, error: _profileError } = await supabase
		.from('user_profiles')
		.select('profile_summary')
		.single();

	// Merge the data (profile_summary might not exist yet)
	return {
		...assessmentData,
		profile_summary: profileData?.profile_summary || undefined
	};
}
