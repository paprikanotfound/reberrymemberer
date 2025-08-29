
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

export function createOrderQueries(db: D1Database) {

  /**
   * update order status to paid, only if status != 'paid' to check prevent double processing
   * 
   * @param email 
   * @param paymentIntent 
   * @param id 
   * @returns 
   */
  const setOrderStatusAsPaidOrSkip = (
    email: Order['customer_email'], 
    paymentIntent: Order['stripe_payment_intent'], 
    id: Order['id'],
  ) => { 
    return db.prepare(`
      UPDATE orders 
      SET status = ?, customer_email = ?, stripe_payment_intent = ?
      WHERE id = ? AND status != 'paid'
      RETURNING *;
    `)
    .bind('paid', email, paymentIntent, id)
    .first<Order>();
  }

  /**
   * Update order status to confirmed, set provider order_id, clear address details
   * @param provider_order_id 
   * @param id 
   * @returns 
   */
  const setOrderAsConfirmedAndProviderId = (
    provider_order_id: Order['provider_order_id'], 
    id: Order['id'],
  ) => {
    return db.prepare(`
      UPDATE orders 
      SET status = ?, provider_order_id = ?, recipient_address = ?, sender_address = ?
      WHERE id = ?;
    `)
    .bind(<Order['status']> 'confirmed', provider_order_id, null, null, id)
    .run();
  }

  const setOrderFailedPayment = (orderId: Order['id']) => {
    return db.prepare(`
      UPDATE orders 
      SET status = ?, reason = ?
      WHERE id = ?;
    `)
    .bind(<Order['status']> 'cancelled', <Order['reason']> 'payment_fail', orderId)
    .run();
  }

  const setOrderCancelled = (orderId: Order['id'], reason: Order['reason']) => {
    return db.prepare(`
      UPDATE orders 
      SET status = ?, reason = ?
      WHERE id = ?;
    `)
    .bind(<Order['status']> 'cancelled', reason, orderId)
    .run();
  }

  const setOrderCancelledFraud = (paymentIntent: Order['stripe_payment_intent']) => {
    return db.prepare(`
      UPDATE orders 
      SET status = ?, reason = ?, recipient_address = ?, sender_address = ?
      WHERE stripe_payment_intent = ?;
    `)
    .bind(<Order['status']> 'cancelled', <Order['reason']> 'fraud_detected', null, null, paymentIntent)
    .run();
  }

  const setOrderAsExpired = (orderId: string) => {
    return db.prepare(`
        UPDATE orders 
        SET status = ?, recipient_address = ?, sender_address = ?
        WHERE id = ?;
      `)
      .bind(<Order['status']> 'cancelled', null, null, orderId)
      .run();
  }

  return {
    setOrderStatusAsPaidOrSkip,
    setOrderAsConfirmedAndProviderId,
    setOrderFailedPayment,
    setOrderCancelled,
    setOrderCancelledFraud,
    setOrderAsExpired
  }
}


