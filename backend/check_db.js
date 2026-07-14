import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('members').select('id, telegram_username, wallet_address');
  console.log('Total members:', data.length);
  const counts = {};
  for(let m of data) {
     counts[m.telegram_username] = (counts[m.telegram_username] || 0) + 1;
  }
  for(let k in counts) {
     if(counts[k] > 1) console.log(k, counts[k]);
  }
}
run();
