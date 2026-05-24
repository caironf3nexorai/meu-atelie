import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, 'frontend-vite/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
        id, full_name, email,
        partner_commissions (id, amount, status),
        coupons (id, code, discount_value)
    `)
    .eq('is_partner', true)
    .limit(1);

  console.log('Error:', error);
  console.log('Data:', data);
}

testQuery();
