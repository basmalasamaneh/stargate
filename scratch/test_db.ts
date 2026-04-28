import "dotenv/config";
import { getSupabase } from "../src/config/supabase";

async function test() {
  const supabase = getSupabase();
  console.log("Testing Supabase connection...");
  
  const { data: carts, error: cartsError } = await supabase.from("carts").select("id").limit(1);
  if (cartsError) {
    console.error("Carts table error:", cartsError.message);
  } else {
    console.log("Carts table exists.");
  }

  const { data: items, error: itemsError } = await supabase.from("cart_items").select("id").limit(1);
  if (itemsError) {
    console.error("Cart Items table error:", itemsError.message);
  } else {
    console.log("Cart Items table exists.");
  }
}

test();
