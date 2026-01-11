

export function getDBClient(db: D1Database) {
  return {
    createNewOrder: ({ 
      id, 
      stripe_checkout_id, 
      recipient_address, 
      send_date, 
      front_image_url, 
      back_image_url, 
      status
    }: Omit<Order, "stripe_payment_intent"|"sender_address"|"provider_order_id"|"reason"|"created_at"|"customer_email">) => {
      return db.prepare(`
        INSERT INTO orders (
          id, 
          stripe_checkout_id, 
          recipient_address, 
          send_date, 
          front_image_url, 
          back_image_url, 
          status, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
        RETURNING *;
      `)
      .bind(id, stripe_checkout_id, recipient_address, send_date, front_image_url, back_image_url, status)
      .first<Order>();
    },
    setOrderStatusAsPaidOrSkip: ({ orderId, email, paymentIntent }: {
      orderId: Order['id'],
      email: Order['customer_email'], 
      paymentIntent: Order['stripe_payment_intent'], 
    },
    ) => { 
      return db.prepare(`
        UPDATE orders 
        SET status = ?, customer_email = ?, stripe_payment_intent = ?
        WHERE id = ? AND status != 'paid'
        RETURNING *;
      `)
      .bind('paid', email, paymentIntent, orderId)
      .first<Order>();
    },
    setOrderAsConfirmedWithProviderId: ({ provider_order_id, order_id }: {
      provider_order_id: Order['provider_order_id'], 
      order_id: Order['id'],
    }) => {
      return db.prepare(`
        UPDATE orders 
        SET status = ?, provider_order_id = ?, recipient_address = ?, sender_address = ?
        WHERE id = ?;
      `)
      .bind(<Order['status']> 'confirmed', provider_order_id, null, null, order_id)
      .run();
    },
    setOrderFailedPayment: ({ orderId }: { orderId: Order['id'] }) => {
      return db.prepare(`
        UPDATE orders 
        SET status = ?, reason = ?
        WHERE id = ?;
      `)
      .bind(<Order['status']> 'cancelled', <Order['reason']> 'payment_fail', orderId)
      .run();
    },
    setOrderCancelled: ({ orderId, reason }: { orderId: Order['id'], reason: Order['reason'] }) => {
      return db.prepare(`
        UPDATE orders 
        SET status = ?, reason = ?
        WHERE id = ?;
      `)
      .bind(<Order['status']> 'cancelled', reason, orderId)
      .run();
    },
    setOrderCancelledFraud: ({ paymentIntent }: { paymentIntent: Order['stripe_payment_intent'] }) => {
      return db.prepare(`
        UPDATE orders 
        SET status = ?, reason = ?, recipient_address = ?, sender_address = ?
        WHERE stripe_payment_intent = ?;
      `)
      .bind(<Order['status']> 'cancelled', <Order['reason']> 'fraud_detected', null, null, paymentIntent)
      .run();
    },
    setOrderAsExpired: ({ orderId }: { orderId: Order['id'] }) => {
      return db.prepare(`
        UPDATE orders 
        SET status = ?, recipient_address = ?, sender_address = ?
        WHERE id = ?;
      `)
      .bind(<Order['status']> 'cancelled', null, null, orderId)
      .run();
    },
  }
}

// --- Types ---

export type Order = {
  id: string;
  stripe_checkout_id: string | null;
  stripe_payment_intent: string | null;
  provider_order_id: string | null;
  customer_email: string | null;
  recipient_address: string | null; // encrypted JSON string
  sender_address: string | null;
  send_date: string | null;
  front_image_url: string;
  back_image_url: string;
  reason?: 'system_error' | 'payment_fail' | 'fraud_detected';
  status: 'draft' | 'paid' | 'confirmed'  | 'sent' | 'cancelled';
  created_at?: string; // ISO timestamp, optional on insert
};
