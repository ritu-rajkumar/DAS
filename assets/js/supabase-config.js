(function configureSupabase() {
    'use strict';

    const projectUrl = 'https://imivigclrnkdtpgzvtex.supabase.co';
    const publishableKey = 'sb_publishable_DNrE-nXnCD_US3I_p6lPOg_PZqaVHXn';

    if (!window.supabase?.createClient) {
        console.error('Supabase client library did not load.');
        return;
    }

    window.dasSupabase = window.supabase.createClient(projectUrl, publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
})();
