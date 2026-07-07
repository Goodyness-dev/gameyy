import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing Supabase connection...");
  console.log("URL:", supabaseUrl);
  console.log("Key starts with:", supabaseKey.substring(0, 10) + "...");
  
  const { data, error } = await supabase.from('groups').select('*').limit(1);
  if (error) {
    console.error("Select Error:", error);
  } else {
    console.log("Select Success. Rows:", data.length);
  }

  const { data: iData, error: iError } = await supabase.from('groups').insert([{
    name: 'Test',
    invite_code: 'TEST-' + Math.random(),
    created_by: 'test'
  }]).select().single();
  
  if (iError) {
    console.error("Insert Error:", iError);
  } else {
    console.log("Insert Success:", iData.id);
  }
}
test();
