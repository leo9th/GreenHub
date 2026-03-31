import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kuawbbgopeyqorwkotms.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1YXdiYmdvcGV5cW9yd2tvdG1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTI2MjUsImV4cCI6MjA5MDA4ODYyNX0.EkzG6Gk4VNEwyFIpTCDV5Ug4uGY2TNwXbMiH6DJSZ4E';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  const email = `tester${Date.now()}@example.com`;
  const password = "Password123!";
  
  console.log("1. Signing up", email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: "Test User",
        phone: "08000000000",
        role: "buyer",
        state: "Lagos",
        lga: "Ikeja",
        address: "Test Address"
      }
    }
  });
  
  if (signUpError) {
    console.error("=> SIGNUP ERROR:", signUpError.message);
    return;
  }
  console.log("=> SIGNUP SUCCESS:", signUpData.user?.id);
  
  console.log("2. Attempting to login without verifying email...");
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (signInError) {
    console.error("=> LOGIN ERROR:", signInError.message);
  } else {
    console.log("=> LOGIN SUCCESS!");
  }
}

runTest();
