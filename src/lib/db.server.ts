
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

  const createNewOrder = (
    id: Order['id'],
    sessionId: Order['stripe_checkout_id'],
    recipient: Order['recipient_address'],
    sender: Order['sender_address'],
    sendDate: Order['send_date'],
    front: Order['front_image_url'],
    back: Order['back_image_url'],
    status: Order['status'],
  ) => {
    return db.prepare(`
      INSERT INTO orders (
        id, stripe_checkout_id, 
        recipient_address, sender_address, send_date, 
        front_image_url, back_image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *;
      `
    )
    .bind(id, sessionId, recipient, sender, sendDate, front, back, status)
    .first<Order>();
  }

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

  const setOrderAsConfirmedWithProviderId = (
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
    createNewOrder,
    setOrderStatusAsPaidOrSkip,
    setOrderAsConfirmedWithProviderId,
    setOrderFailedPayment,
    setOrderCancelled,
    setOrderCancelledFraud,
    setOrderAsExpired
  }
}


