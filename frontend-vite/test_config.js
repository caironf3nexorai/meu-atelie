import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://axtstqzxpelxbzwplufy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4dHN0cXp4cGVseGJ6d3BsdWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzQxMTUsImV4cCI6MjA4NzYxMDExNX0.EG4DJOFCu-BcQrzej4cnTnCtfwZYJ_cbj0WzGTmC0sQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    const { data, error } = await supabase.from('campaign_config').select('*');
    console.log('Data:', data);
    console.log('Error:', error);
}

test();
