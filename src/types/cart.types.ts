export interface Cart {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  artworkId: string;
  quantity: number;
  artwork?: any; // To include artwork details when fetching
  createdAt: string;
  updatedAt: string;
}

export interface AddToCartInput {
  artworkId: string;
  quantity?: number;
}
