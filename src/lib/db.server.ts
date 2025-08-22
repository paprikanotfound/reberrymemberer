
export type Order = {
  id: string;
  stripe_checkout_id: string | null;
  stripe_payment_intent: string | null;
  provider_order_id: string | null;
  customer_email: string | null;
  recipient_address: string; // encrypted JSON string
  sender_address: string | null;
  send_date: string | null;
  front_image_url: string;
  back_image_url: string;
  reason?: 'system_error' | 'payment_fail' | 'fraud_detected';
  status: 'draft' | 'paid' | 'confirmed'  | 'sent' | 'cancelled';
  created_at?: string; // ISO timestamp, optional on insert
};

export async function setOrderStatusPaid(
  db: D1Database, 
  email: Order['customer_email'], 
  paymentIntent: Order['stripe_payment_intent'], 
  id: Order['id'],
)  { 
  return db.prepare(`
    UPDATE orders 
    SET status = ?, customer_email = ?, stripe_payment_intent = ?
    WHERE id = ? AND status != 'paid'
    RETURNING *;
  `)
  .bind('paid', email, paymentIntent, id)
  .first<Order>();
}

export async function setOrderProviderId(
  db: D1Database, 
  provider_order_id: Order['provider_order_id'], 
  id: Order['id'],
)  { 
  return db.prepare(`
    UPDATE orders 
    SET status = 'confirmed', provider_order_id = ?
    WHERE id = ?;
  `)
  .bind(provider_order_id, id)
  .run();
}

export async function setOrderFailedPayment(db: D1Database, orderId: Order['id']) {
  return db.prepare(`
    UPDATE orders 
    SET status = ?, reason = ?
    WHERE id = ?;
  `)
  .bind(<Order['status']> 'cancelled', <Order['reason']> 'payment_fail', orderId)
  .run();
}

export async function setOrderRefundedError(db: D1Database, orderId: Order['id']) {
  return db.prepare(`
    UPDATE orders 
    SET status = ?, reason = ?
    WHERE id = ?;
  `)
  .bind(<Order['status']> 'cancelled', <Order['reason']> 'error', orderId)
  .run();
}

export async function setOrderCancelledFraud(db: D1Database, paymentIntent: Order['stripe_payment_intent']) {
  return db.prepare(`
    UPDATE orders 
    SET status = ?, reason = ?
    WHERE stripe_payment_intent = ?;
  `)
  .bind(<Order['status']> 'cancelled', <Order['reason']> 'fraud_detected', paymentIntent)
  .run();
}
