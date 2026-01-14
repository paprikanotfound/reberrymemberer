

export function initDB(db: D1Database) {
  return {
    order: {
      createOrder: ({ 
        id, 
        stripe_checkout_id, 
        recipient_address, 
        send_date, 
        front_image_url, 
        back_image_url, 
        status
      }: Omit<Order, "stripe_payment_intent"|"provider_order_id"|"reason"|"updated_at"|"created_at"|"customer_email">) => {
        return db.prepare(`
          INSERT INTO orders (
            id, 
            stripe_checkout_id, 
            recipient_address, 
            send_date, 
            front_image_url, 
            back_image_url, 
            status, 
            updated_at,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
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
          SET 
            status = ?, 
            customer_email = ?, 
            stripe_payment_intent = ?,
            updated_at = strftime('%s', 'now')
          WHERE id = ? 
            AND status != 'paid'
          RETURNING *;
        `)
        .bind('paid', email, paymentIntent, orderId)
        .first<Order>();
      },
      updateOrderAsConfirmed: ({ 
        customer_email, 
        provider_order_id,
        order_id,
      }: {
        customer_email: Order['customer_email'], 
        provider_order_id: Order['provider_order_id'], 
        order_id: Order['id'],
      }) => {
        return db.prepare(`
          UPDATE orders 
          SET 
            status = ?, 
            customer_email = ?, 
            provider_order_id = ?, 
            recipient_address = ?, 
            updated_at = strftime('%s', 'now')
          WHERE id = ?;
        `)
        .bind(
          <Order['status']> 'confirmed', 
          customer_email,
          provider_order_id, 
          null, 
          order_id,
        )
        .run();
      },
      setOrderFailedPayment: ({ orderId }: { orderId: Order['id'] }) => {
        return db.prepare(`
          UPDATE orders 
          SET 
            status = ?, 
            reason = ?,
            updated_at = strftime('%s', 'now')
          WHERE id = ?;
        `)
        .bind(<Order['status']> 'cancelled', <Order['reason']> 'payment_fail', orderId)
        .run();
      },
      setOrderCancelled: ({ orderId, reason }: { orderId: Order['id'], reason: Order['reason'] }) => {
        return db.prepare(`
          UPDATE orders 
          SET 
            status = ?, 
            reason = ?,
            updated_at = strftime('%s', 'now')
          WHERE id = ?;
        `)
        .bind(
          <Order['status']> 'cancelled', 
          reason, 
          orderId,
        )
        .run();
      },
      setOrderCancelledFraud: ({ paymentIntent }: { paymentIntent: Order['stripe_payment_intent'] }) => {
        return db.prepare(`
          UPDATE orders 
          SET 
            status = ?, 
            reason = ?, 
            recipient_address = ?, 
            updated_at = strftime('%s', 'now')
          WHERE 
            stripe_payment_intent = ?;
        `)
        .bind(
          <Order['status']> 'cancelled', 
          <Order['reason']> 'fraud_detected', 
          null, 
          paymentIntent,
        )
        .run();
      },
      setOrderAsExpired: ({ orderId }: { orderId: Order['id'] }) => {
        return db.prepare(`
          UPDATE orders 
          SET 
            status = ?, 
            recipient_address = ?, 
            updated_at = strftime('%s', 'now')
          WHERE id = ?;
        `)
        .bind(
          <Order['status']> 'cancelled', 
          null, 
          null, 
          orderId,
        )
        .run();
      },
    }
  }
}

// --- Types ---

export type DBClient = ReturnType<typeof initDB>;

export type Order = {
  id: string;

  stripe_checkout_id: string;
  stripe_payment_intent: string | null;
  provider_order_id: string | null;
  customer_email: string | null;

  recipient_address: string;
  send_date: string | null;
  front_image_url: string;
  back_image_url: string;
  
  reason?: 'system_error' | 'payment_fail' | 'fraud_detected';
  status: 'draft' | 'paid' | 'confirmed'  | 'sent' | 'cancelled';

  updated_at: number;
  created_at: number;
};