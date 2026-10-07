const wa = require('../config/whatsapp');

const money = (n) => `${Number(n).toLocaleString('en-PK')} PKR`;

/** Builds the admin notification text for a new order. */
const buildOrderMessage = (order) => {
  const items = order.items.map((i) => `- ${i.name} x${i.quantity} — ${money(i.price * i.quantity)}`).join('\n');
  return [
    '*New Darazify Order*',
    '',
    `Order ID: ${order.orderId}`,
    `Customer Name: ${order.customer.name}`,
    `Phone: ${order.customer.phone}`,
    `Email: ${order.customer.email}`,
    `Address: ${order.customer.address}`,
    `City: ${order.customer.city}`,
    '',
    'Items:',
    items,
    '',
    `Total Amount: ${money(order.total)}`,
    `Order Status: ${order.status}`,
  ].join('\n');
};

/**
 * Sends the order to the admin via the WhatsApp Cloud API (Meta).
 * Uses a template if WHATSAPP_TEMPLATE_NAME is set, otherwise a plain text message.
 * Returns true on success. Never throws (an order must not fail because of WhatsApp).
 */
const sendOrderWhatsApp = async (order) => {
  if (!wa.isConfigured()) {
    console.warn('[WhatsApp] Not configured — skipping notification.');
    return false;
  }
  const text = buildOrderMessage(order);
  const payload = wa.templateName
    ? {
        messaging_product: 'whatsapp',
        to: wa.adminNumber,
        type: 'template',
        template: {
          name: wa.templateName,
          language: { code: wa.templateLang },
          // Template parameters cannot contain newlines.
          components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\*/g, '').replace(/\n+/g, ' | ') }] }],
        },
      }
    : { messaging_product: 'whatsapp', to: wa.adminNumber, type: 'text', text: { preview_url: false, body: text } };

  try {
    const res = await fetch(wa.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wa.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error('[WhatsApp] Failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[WhatsApp] Error:', err.message);
    return false;
  }
};

module.exports = { sendOrderWhatsApp, buildOrderMessage };
