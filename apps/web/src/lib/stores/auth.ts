import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		session: null,
		loading: true
	});

	return {
		subscribe,
		initialize: async () => {
			// Get initial session
			const { data: { session } } = await supabase.auth.getSession();

			set({
				user: session?.user ?? null,
				session: session ?? null,
				loading: false
			});

			// Listen for auth changes
			supabase.auth.onAuthStateChange((_event, session) => {
				set({
					user: session?.user ?? null,
					session: session ?? null,
					loading: false
				});
			});
		},
		signOut: async () => {
			await supabase.auth.signOut();
			set({ user: null, session: null, loading: false });
		}
	};
}

export const auth = createAuthStore();
