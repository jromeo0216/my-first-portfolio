import { neon } from '@netlify/neon';
const databaseUrl = process.env.NETLIFY_DATABASE_URL;
const sql = neon(databaseUrl);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { vendorId, buyerName, orderAccount, buyerNote, itemName, paymentMethod, orderDate, orderTime, isPreOrder } = JSON.parse(event.body);

    if (!vendorId || !buyerName || !orderAccount || !itemName || !paymentMethod || !orderDate || !orderTime) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    await sql`
      INSERT INTO buyers (vendor_id, buyer_name, order_account, buyer_note, item_name, payment_method, order_date, order_time, is_pre_order)
      VALUES (${vendorId}, ${buyerName}, ${orderAccount}, ${buyerNote}, ${itemName}, ${paymentMethod}, ${orderDate}, ${orderTime}, ${isPreOrder})
    `;

    return { statusCode: 200, body: JSON.stringify({ message: 'Order placed successfully' }) };
  } catch (error) {
    console.error('Error placing order:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
}