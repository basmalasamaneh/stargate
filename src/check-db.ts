import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function checkSchema() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Checking 'users' table columns...");
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("*")
    .limit(1);

  if (userError) {
    console.error("Error accessing 'users' table:", userError.message);
  } else {
    const columns = Object.keys(userData[0] || {});
    console.log("'users' table columns:", columns.join(", ") || "(empty table)");
    
    const required = ["id", "email", "password", "otp_code", "otp_expires_at", "is_verified"];
    const missing = required.filter(col => !columns.includes(col));
    if (missing.length > 0 && userData.length > 0) {
      console.error("MISSING COLUMNS in 'users':", missing.join(", "));
    }
  }

  console.log("\nChecking 'carts' table...");
  const { error: cartError } = await supabase
    .from("carts")
    .select("id")
    .limit(1);

  if (cartError) {
    console.error("Error accessing 'carts' table:", cartError.message);
  } else {
    console.log("'carts' table is accessible.");
  }
}

checkSchema();
