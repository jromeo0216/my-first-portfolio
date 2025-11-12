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

    // Delete vendor (items and buyers cascade)
    await sql`
      DELETE FROM vendors WHERE id = ${vendorId}
    `;

    return { statusCode: 200, body: JSON.stringify({ message: `Vendor ${vendorId} deleted successfully` }) };
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
}