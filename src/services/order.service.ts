import { getSupabase } from "../config/supabase";
import { OrderStatus } from "../types/order.types";
import { clearCart } from "./cart.service";
import { attachArtworkImageUrls } from "./artwork.service";
import { toProfileImagePublicUrl } from "./profile-image-storage.service";

export const createOrderFromCart = async (userId: string, shippingDetails: {
  address: string,
  city: string,
  phone: string,
  name: string,
  shippingFee: number
}) => {
  const supabase = getSupabase();

  // 1. Get cart items with artwork details (to know artist_id and price)
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!cart) throw new Error("السلة غير موجودة");

  const { data: items, error: itemsError } = await supabase
    .from("cart_items")
    .select(`
      artwork_id,
      quantity,
      artwork:artworks (
        id,
        price,
        artist_id
      )
    `)
    .eq("cart_id", cart.id);

  if (itemsError || !items || items.length === 0) {
    throw new Error("السلة فارغة");
  }

  // 2. Group items by artist_id
  const ordersByArtist: Record<string, any[]> = {};
  items.forEach((item: any) => {
    const artistId = item.artwork.artist_id;
    if (!ordersByArtist[artistId]) ordersByArtist[artistId] = [];
    ordersByArtist[artistId].push(item);
  });

  // Check stock for all items before creating any orders
  for (const item of items as any[]) {
    const { data: artwork } = await supabase
      .from("artworks")
      .select("quantity, title")
      .eq("id", item.artwork_id)
      .single();

    if (!artwork || artwork.quantity < item.quantity) {
      throw new Error(`عذراً، الكمية المطلوبة من "${artwork?.title || 'العمل'}" غير متوفرة حالياً`);
    }
  }

  // 3. Create Parent Order (no artist_id, no parent_order_id)
  const grandTotal = items.reduce((sum: number, item: any) => sum + (item.artwork.price * item.quantity), 0) + (shippingDetails.shippingFee || 0);

  const { data: parentOrder, error: parentError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      artist_id: null,
      parent_order_id: null,
      total_price: grandTotal,
      shipping_fee: shippingDetails.shippingFee || 0,
      shipping_address: shippingDetails.address,
      shipping_city: shippingDetails.city,
      shipping_phone: shippingDetails.phone,
      shipping_name: shippingDetails.name,
      status: 'pending'
    })
    .select()
    .single();

  if (parentError) throw new Error(parentError.message);

  const createdOrders: any[] = [];

  // 4. Create a child order for each artist
  for (const artistId in ordersByArtist) {
    const artistItems = ordersByArtist[artistId]!;
    const itemsPrice = artistItems.reduce((sum: number, item: any) => sum + (item.artwork.price * item.quantity), 0);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        artist_id: artistId,
        parent_order_id: parentOrder.id, // Link to Parent
        total_price: itemsPrice,
        shipping_fee: 0, // Shipping fee is on the parent
        shipping_address: shippingDetails.address,
        shipping_city: shippingDetails.city,
        shipping_phone: shippingDetails.phone,
        shipping_name: shippingDetails.name,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    // Create order items
    const orderItemsData = artistItems.map(item => ({
      order_id: order.id,
      artwork_id: item.artwork_id,
      price: item.artwork.price,
      quantity: item.quantity
    }));

    const { error: itemsInsertError } = await supabase
      .from("order_items")
      .insert(orderItemsData);

    if (itemsInsertError) throw new Error(itemsInsertError.message);

    // Decrease inventory
    for (const item of artistItems) {
      const { data: artwork } = await supabase
        .from("artworks")
        .select("quantity")
        .eq("id", item.artwork_id)
        .single();

      if (artwork) {
        const newQty = Math.max(0, artwork.quantity - item.quantity);
        await supabase.from("artworks").update({ quantity: newQty }).eq("id", item.artwork_id);
      }
    }

    createdOrders.push(order);
  }

  // 5. Clear cart
  await clearCart(userId);

  return { parentOrder, orders: createdOrders };
};

export const createOrder = async (orderData: {
  userId: string,
  artistId: string,
  items: Array<{ artwork_id: string, quantity: number, price: number }>,
  shipping_details: {
    address: string,
    city: string,
    phone: string,
    name: string,
    shipping_fee: number
  }
}) => {
  const supabase = getSupabase();

  // Check stock before creating manual order
  for (const item of orderData.items) {
    const { data: artwork } = await supabase
      .from("artworks")
      .select("quantity, title")
      .eq("id", item.artwork_id)
      .single();

    if (!artwork || artwork.quantity < item.quantity) {
      throw new Error(`عذراً، الكمية المطلوبة من "${artwork?.title || 'العمل'}" غير متوفرة حالياً`);
    }
  }

  const itemsPrice = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalPrice = itemsPrice + (orderData.shipping_details.shipping_fee || 0);

  // 1. Create Parent Order
  const { data: parentOrder, error: parentError } = await supabase
    .from("orders")
    .insert({
      user_id: orderData.userId,
      artist_id: null,
      parent_order_id: null,
      total_price: totalPrice,
      shipping_fee: orderData.shipping_details.shipping_fee || 0,
      shipping_address: orderData.shipping_details.address,
      shipping_city: orderData.shipping_details.city,
      shipping_phone: orderData.shipping_details.phone,
      shipping_name: orderData.shipping_details.name,
      status: 'pending'
    })
    .select()
    .single();

  if (parentError) throw new Error(parentError.message);

  // 2. Create Child Order for the artist
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: orderData.userId,
      artist_id: orderData.artistId,
      parent_order_id: parentOrder.id,
      total_price: itemsPrice,
      shipping_fee: 0,
      shipping_address: orderData.shipping_details.address,
      shipping_city: orderData.shipping_details.city,
      shipping_phone: orderData.shipping_details.phone,
      shipping_name: orderData.shipping_details.name,
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) throw new Error(orderError.message);

  // 3. Create order items
  const orderItemsData = orderData.items.map(item => ({
    order_id: order.id,
    artwork_id: item.artwork_id,
    price: item.price,
    quantity: item.quantity
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItemsData);

  if (itemsError) throw new Error(itemsError.message);

  // Decrease inventory
  for (const item of orderData.items) {
    const { data: artwork } = await supabase
      .from("artworks")
      .select("quantity")
      .eq("id", item.artwork_id)
      .single();

    if (artwork) {
      const newQty = Math.max(0, artwork.quantity - item.quantity);
      await supabase.from("artworks").update({ quantity: newQty }).eq("id", item.artwork_id);
    }
  }

  return order;
};

export const getArtistOrders = async (artistId: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      user:users!orders_user_id_fkey (id, first_name, last_name, email, profile_image),
      items:order_items (
        id,
        quantity,
        price,
        artwork:artworks (
          id, 
          title,
          artwork_images (filename, is_featured)
        )
      )
    `)
    .eq("artist_id", artistId)
    .not("parent_order_id", "is", null) // Only child orders (exclude parent rows)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Transform images and profile URLs
  return (data || []).map((order: any) => ({
    ...order,
    user: order.user ? {
      ...order.user,
      profile_image: order.user.profile_image ? toProfileImagePublicUrl(order.user.profile_image) : null
    } : null,
    items: (order.items || []).map((item: any) => {
      if (item.artwork) {
        item.artwork = attachArtworkImageUrls(item.artwork);
      }
      return item;
    })
  }));
};

export const getUserOrders = async (userId: string) => {
  const supabase = getSupabase();

  // Fetch parent orders with their child orders (self-join via parent_order_id)
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      children:orders!parent_order_id (
        *,
        artist:users!orders_artist_id_fkey (id, artist_name, first_name, last_name, profile_image),
        items:order_items (
          id,
          quantity,
          price,
          artwork:artworks (
            id, 
            title,
            artwork_images (filename, is_featured)
          )
        )
      )
    `)
    .eq("user_id", userId)
    .is("parent_order_id", null) // Only parent orders
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  // Calculate dynamic parent status based on child orders
  const calculateParentStatus = (children: any[]) => {
    if (!children || children.length === 0) return 'pending';

    const allCancelledOrRejected = children.every(o => o.status === 'cancelled' || o.status === 'rejected');
    if (allCancelledOrRejected) return 'cancelled';

    const validOrders = children.filter(o => o.status !== 'cancelled' && o.status !== 'rejected');
    if (validOrders.length === 0) return 'cancelled';

    const allDelivered = validOrders.every(o => o.status === 'delivered');
    if (allDelivered) return 'completed';

    const allShippedOrDelivered = validOrders.every(o => o.status === 'shipped' || o.status === 'delivered');
    if (allShippedOrDelivered) return 'shipped';

    const anyShippedOrDelivered = validOrders.some(o => o.status === 'shipped' || o.status === 'delivered');
    if (anyShippedOrDelivered) return 'partially_shipped';

    const anyProcessing = validOrders.some(o => o.status === 'approved' || o.status === 'preparing');
    if (anyProcessing) return 'processing';

    return 'pending';
  };

  // Transform data for frontend
  return (data || []).map((group: any) => ({
    ...group,
    parent_status: calculateParentStatus(group.children),
    children: (group.children || []).map((order: any) => ({
      ...order,
      artist: order.artist ? {
        ...order.artist,
        profile_image: order.artist.profile_image ? toProfileImagePublicUrl(order.artist.profile_image) : null
      } : null,
      items: (order.items || []).map((item: any) => {
        if (item.artwork) {
          item.artwork = attachArtworkImageUrls(item.artwork);
        }
        return item;
      })
    }))
  }));
};

export const updateOrderStatus = async (orderId: string, userId: string, role: string, newStatus: OrderStatus) => {
  const supabase = getSupabase();

  // 1. Get current order to check permissions
  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) throw new Error("الطلب غير موجود");

  // 2. Relationship check
  const isBuyer = order.user_id === userId;
  const isSeller = order.artist_id === userId;

  if (!isBuyer && !isSeller) {
    throw new Error("ليس لديك صلاحية لتعديل هذا الطلب");
  }

  // 3. Workflow rules
  // Only the Seller (Artist) can approve/reject/prepare/ship
  const artistStatuses: OrderStatus[] = ['approved', 'rejected', 'preparing', 'shipped'];
  if (artistStatuses.includes(newStatus)) {
    if (!isSeller) {
      throw new Error("فقط الفنان صاحب العمل يمكنه تغيير الحالة لهذه المرحلة");
    }
  }

  // User can only cancel or mark as delivered
  if (newStatus === 'cancelled') {
    if (!isBuyer) {
      throw new Error("فقط المشتري يمكنه إلغاء الطلب");
    }
    
    // Check if cancellation is allowed (only before shipping)
    const forbiddenForCancellation: OrderStatus[] = ['shipped', 'delivered'];
    if (forbiddenForCancellation.includes(order.status)) {
      throw new Error("لا يمكن إلغاء الطلب بعد شحنه");
    }
  }

  if (newStatus === 'delivered') {
    if (!isBuyer) {
      throw new Error("فقط المشتري يمكنه تأكيد استلام الطلب");
    }
  }

  // 4. Update
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  // 5. Special logic for rejection or cancellation: Move items back to cart and restore inventory
  const restorationStatuses: OrderStatus[] = ['rejected', 'cancelled'];
  if (restorationStatuses.includes(newStatus) && !restorationStatuses.includes(order.status)) {
    try {
      const { data: items } = await supabase
        .from("order_items")
        .select("artwork_id, quantity")
        .eq("order_id", orderId);

      if (items && items.length > 0) {
        const cartService = require("./cart.service");
        const cartData = await cartService.getCartByUserId(order.user_id);
        const cartId = cartData.cartId;

        for (const item of items) {
          // Restore inventory
          const { data: artwork } = await supabase
            .from("artworks")
            .select("quantity")
            .eq("id", item.artwork_id)
            .single();

          if (artwork) {
            await supabase
              .from("artworks")
              .update({ quantity: artwork.quantity + item.quantity })
              .eq("id", item.artwork_id);
          }

          await cartService.addItemToCart(cartId, { artworkId: item.artwork_id, quantity: item.quantity });
        }
      }
    } catch (err) {
      console.error("Error moving items back to cart on rejection:", err);
    }
  }

  return updated;
};
