import { neon } from '@netlify/neon';
const databaseUrl = process.env.NETLIFY_DATABASE_URL;
const sql = neon(databaseUrl);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { vendorId, currentTab } = JSON.parse(event.body);

    if (!vendorId || !currentTab) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing vendorId or currentTab' }) };
    }

    // Update items for vendor where is_pre_order matches currentTab and set is_available = false
    const isPreOrderValue = currentTab === 'preorder' ? true : false;

    await sql`
      UPDATE items SET is_available = FALSE
      WHERE vendor_id = ${vendorId} AND is_pre_order = ${isPreOrderValue}
    `;

    return { statusCode: 200, body: JSON.stringify({ message: 'Vendor items marked as sold out successfully' }) };
  } catch (error) {
    console.error('Error marking items sold out:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
}