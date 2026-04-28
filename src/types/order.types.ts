export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  artistId?: string | null;       // null for parent orders
  parentOrderId?: string | null;  // null for parent orders, set for children
  totalPrice: number;
  shippingAddress: string;
  shippingCity: string;
  shippingPhone: string;
  shippingName: string;
  shippingFee: number;            // only meaningful on parent orders
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  artist?: any;
  children?: Order[];             // populated on parent orders
}

export interface OrderItem {
  id: string;
  orderId: string;
  artworkId: string;
  price: number;
  quantity: number;
  artwork?: any;
}
