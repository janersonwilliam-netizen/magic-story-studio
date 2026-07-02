import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://akyqmifpxordkwanpwyu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFreXFtaWZweG9yZGt3YW5wd3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Nzc1MDYsImV4cCI6MjA4NzU1MzUwNn0.RmtgoHJFOpMs-2ZEqvcEkzLeg5BMFInUmEkCrMj4A4g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPreferences() {
  console.log("Fetching user preferences...");
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*');

  if (error) {
    console.error("Error fetching preferences:", error);
  } else {
    console.log("Fetched user preferences:");
    console.log(JSON.stringify(data, null, 2));
  }
}

checkPreferences();
