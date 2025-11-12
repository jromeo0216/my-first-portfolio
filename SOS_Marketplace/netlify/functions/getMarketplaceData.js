import { neon } from '@netlify/neon';
const databaseUrl = process.env.NETLIFY_DATABASE_URL;
const sql = neon(databaseUrl);

export async function handler(event, context) {
    try {
        // 1. Fetch all vendors
        const vendorsRaw = await sql`SELECT id, name, key FROM vendors;`;

        // 2. Fetch all items and group them by vendor_id
        const itemsRaw = await sql`
            SELECT id, vendor_id, name, price_cash, price_payday, is_available, is_pre_order
            FROM items;
        `;
        const itemsByVendor = itemsRaw.reduce((acc, item) => {
            if (!acc[item.vendor_id]) {
                acc[item.vendor_id] = {};
            }
            // Format item keys to match your JS object structure (e.g., camelCase for prices)
            acc[item.vendor_id][item.id] = {
                id: item.id,
                name: item.name,
                priceCash: item.price_cash,
                pricePayday: item.price_payday,
                isAvailable: item.is_available,
                isPreOrder: item.is_pre_order
            };
            return acc;
        }, {});

        // 3. Fetch all buyers (orders) and group them by vendor_id
        const buyersRaw = await sql`
            SELECT vendor_id, buyer_name, order_account, buyer_note, item_name, payment_method, order_date, order_time, is_pre_order
            FROM buyers;
        `;
        const buyersByVendor = buyersRaw.reduce((acc, buyer) => {
            if (!acc[buyer.vendor_id]) {
                acc[buyer.vendor_id] = [];
            }
            // Format buyer keys to match your JS object structure
            acc[buyer.vendor_id].push({
                buyerName: buyer.buyer_name,
                orderAccount: buyer.order_account,
                buyerNote: buyer.buyer_note,
                itemName: buyer.item_name,
                paymentMethod: buyer.payment_method,
                date: buyer.order_date,
                time: buyer.order_time,
                isPreOrder: buyer.is_pre_order
            });
            return acc;
        }, {});

        // 4. Combine all fetched data into the marketplaceData structure
        const formattedVendors = {};
        vendorsRaw.forEach(vendor => {
            formattedVendors[vendor.key] = { // Use vendor.key as the top-level key
                name: vendor.name,
                key: vendor.key, // Store the key itself within the object
                items: itemsByVendor[vendor.id] || {}, // Use vendor.id to link items
                buyers: buyersByVendor[vendor.id] || [] // Use vendor.id to link buyers
            };
        });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // IMPORTANT for local testing; restrict in production!
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                vendors: formattedVendors,
                lastUpdatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
                // You could store lastUpdatedDate in DB too, but for now derive it.
            }),
        };
    } catch (error) {
        console.error("Database error in getMarketplaceData:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to fetch marketplace data.", details: error.message }),
        };
    }
}