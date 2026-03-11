import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axtstqzxpelxbzwplufy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4dHN0cXp4cGVseGJ6d3BsdWZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMzQxMTUsImV4cCI6MjA4NzYxMDExNX0.EG4DJOFCu-BcQrzej4cnTnCtfwZYJ_cbj0WzGTmC0sQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data } = await supabase.from('plan_config').select('*');
    console.log("Plan Config Data:", data);
}

check();
