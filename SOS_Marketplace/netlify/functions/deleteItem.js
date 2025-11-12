import { neon } from '@netlify/neon';
const databaseUrl = process.env.NETLIFY_DATABASE_URL;
const sql = neon(databaseUrl);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { itemId, vendorId } = JSON.parse(event.body);

    if (!itemId || !vendorId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing itemId or vendorId' }) };
    }

    // Delete item only if it belongs to the vendor
    const result = await sql`
      DELETE FROM items WHERE id = ${itemId} AND vendor_id = ${vendorId}
    `;

    return { statusCode: 200, body: JSON.stringify({ message: 'Item deleted successfully' }) };
  } catch (error) {
    console.error('Error deleting item:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
}