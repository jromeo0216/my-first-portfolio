import { neon } from '@netlify/neon';
const databaseUrl = process.env.NETLIFY_DATABASE_URL;
const sql = neon(databaseUrl);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { vendorId } = JSON.parse(event.body);

    if (!vendorId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing vendorId' }) };
    }

    // Delete all buyers for this vendor
    await sql`
      DELETE FROM buyers WHERE vendor_id = ${vendorId}
    `;

    return { statusCode: 200, body: JSON.stringify({ message: 'Vendor orders cleared successfully' }) };
  } catch (error) {
    console.error('Error clearing vendor orders:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
}