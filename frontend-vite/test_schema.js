import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_APP_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_APP_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_schema_info'); // Might not exist
  console.log(data, error);
}

// better way via postgrest? We can query columns!
async function checkTable() {
    const res = await supabase.from('orders').select().limit(1);
    console.log(res);
}

checkTable();
