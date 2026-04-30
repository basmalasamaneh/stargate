import { getSupabase } from "../config/supabase";
import type { AddToCartInput } from "../types/cart.types";
import { attachArtworkImageUrls } from "./artwork.service";

const getOrCreateCartId = async (userId: string) => {
  const supabase = getSupabase();
  let { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!cart) {
    const { data: newCart, error: createError } = await supabase
      .from("carts")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (createError) throw new Error("تعذر إنشاء سلة للمستخدم");
    return newCart.id;
  }
  return cart.id;
};

export const getCartByCartId = async (cartId: string) => {
  const supabase = getSupabase();

  console.log(`Fetching cart for cartId: ${cartId}`);

  // Get items in the cart
  const { data: items, error: itemsError } = await supabase
    .from("cart_items")
    .select(`
      id,
      quantity,
      artwork:artworks (
        id,
        title,
        price,
        quantity,
        artwork_images (filename, is_featured),
        users (artist_name, first_name, last_name, profile_image)
      )
    `)
    .eq("cart_id", cartId);

  if (itemsError) {
    console.error("Supabase Error fetching cart items:", itemsError);
    throw new Error(itemsError.message);
  }

  // Attach public URLs to artwork images
  const transformedItems = (items || []).map((item: any) => {
    if (item.artwork) {
      item.artwork = attachArtworkImageUrls(item.artwork);
      // For compatibility with the frontend's expectation of "images" key
      item.artwork.images = item.artwork.artwork_images;
    }
    return item;
  });

  return { cartId, items: transformedItems };
};

export const getCartByUserId = async (userId: string) => {
  const cartId = await getOrCreateCartId(userId);
  return getCartByCartId(cartId);
};

export const updateCartItemQuantity = async (cartId: string, itemId: string, quantity: number) => {
  const supabase = getSupabase();

  if (quantity < 1) {
    return removeItemFromCart(cartId, itemId);
  }

  // 1. Get the item to find its artwork_id
  const { data: item, error: itemError } = await supabase
    .from("cart_items")
    .select("artwork_id, cart_id")
    .eq("id", itemId)
    .single();

  if (itemError || !item) throw new Error("المنتج غير موجود في السلة");

  // 2. Check stock
  const { data: artwork, error: artworkError } = await supabase
    .from("artworks")
    .select("quantity")
    .eq("id", item.artwork_id)
    .single();

  if (artworkError || !artwork) throw new Error("العمل الفني غير موجود");

  if (quantity > artwork.quantity) {
    throw new Error(`عذراً، الكمية المتوفرة هي ${artwork.quantity} فقط`);
  }

  // 3. Update
  const { error: updateError } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", itemId);

  if (updateError) throw new Error(updateError.message);

  return getCartByCartId(cartId);
};

export const addItemToCart = async (cartId: string, input: AddToCartInput) => {
  const supabase = getSupabase();
  const { artworkId, quantity = 1 } = input;

  console.log(`Adding item to cart: cartId=${cartId}, artwork=${artworkId}, qty=${quantity}`);

  // 1. Check stock
  const { data: artwork } = await supabase
    .from("artworks")
    .select("quantity")
    .eq("id", artworkId)
    .single();

  if (!artwork) throw new Error("العمل الفني غير موجود");

  // 2. Check if item already exists
  const { data: existing, error: checkError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("artwork_id", artworkId)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking existing item:", checkError);
    throw new Error(checkError.message);
  }

  if (existing) {
    const newQuantity = existing.quantity + quantity;
    if (newQuantity > artwork.quantity) {
      throw new Error(`عذراً، الكمية المتوفرة هي ${artwork.quantity} فقط`);
    }
    // Update quantity
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: newQuantity })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    if (quantity > artwork.quantity) {
      throw new Error(`عذراً، الكمية المتوفرة هي ${artwork.quantity} فقط`);
    }
    // Insert new item
    const { error } = await supabase
      .from("cart_items")
      .insert({
        cart_id: cartId,
        artwork_id: artworkId,
        quantity
      });
    if (error) throw new Error(error.message);
  }

  return getCartByCartId(cartId);
};

export const removeItemFromCart = async (cartId: string, itemId: string) => {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  return getCartByCartId(cartId);
};

export const clearCart = async (userId: string) => {
  const supabase = getSupabase();
  const cartId = await getOrCreateCartId(userId);

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId);

  if (error) throw new Error(error.message);
};
