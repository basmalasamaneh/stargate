export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderGroup {
  id: string;
  userId: string;
  totalPrice: number;
  status: OrderStatus;
  shippingAddress: string;
  shippingCity: string;
  shippingPhone: string;
  shippingName: string;
  shippingFee: number;
  createdAt: string;
  updatedAt: string;
  orders?: Order[];
}

export interface Order {
  id: string;
  userId: string;
  artistId: string;
  groupId?: string;
  totalPrice: number;
  shippingAddress: string;
  shippingCity: string;
  shippingPhone: string;
  shippingName: string;
  shippingFee: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  artist?: any;
}

export interface OrderItem {
  id: string;
  orderId: string;
  artworkId: string;
  price: number;
  quantity: number;
  artwork?: any;
}
