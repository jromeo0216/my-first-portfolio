import { neon } from '@netlify/neon';
const databaseUrl = process.env.NETLIFY_DATABASE_URL;
const sql = neon(databaseUrl);

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { vendorId, marketplaceData } = JSON.parse(event.body);

        // --- Important: Implement robust validation and authorization here ---
        // Ensure that only the logged-in vendor (or superadmin) can modify their own data.
        // This example assumes `vendorId` is passed, but you should derive it from a secure session/token.

        if (!vendorId || !marketplaceData || !marketplaceData.vendors[vendorId]) {
            return { statusCode: 400, body: 'Invalid request payload.' };
        }

        const vendorToUpdate = marketplaceData.vendors[vendorId];

        // Start a transaction for atomicity
        await sql.transaction(async (tx) => {
            // 1. Update Vendor Name (if necessary, though not in your current `saveVendorChanges`)
            await tx`
                UPDATE vendors
                SET name = ${vendorToUpdate.name}
                WHERE id = ${vendorId};
            `;

            // 2. Delete existing items for the vendor and re-insert (simpler, but less efficient for large lists)
            // Or, more efficiently: compare existing items with new items and do UPSERTs/deletes.
            await tx`
                DELETE FROM items WHERE vendor_id = ${vendorId};
            `;

            const itemInsertPromises = Object.values(vendorToUpdate.items).map(item =>
                tx`
                    INSERT INTO items (id, vendor_id, name, price_cash, price_payday, is_available, is_pre_order)
                    VALUES (${item.id}, ${vendorId}, ${item.name}, ${item.priceCash}, ${item.pricePayday}, ${item.isAvailable}, ${item.isPreOrder});
                `
            );
            await Promise.all(itemInsertPromises);

            // 3. Clear and re-insert buyers (or implement more granular updates)
            await tx`
                DELETE FROM buyers WHERE vendor_id = ${vendorId};
            `;

            const buyerInsertPromises = vendorToUpdate.buyers.map(buyer =>
                tx`
                    INSERT INTO buyers (vendor_id, buyer_name, order_account, buyer_note, item_name, payment_method, order_date, order_time, is_pre_order)
                    VALUES (
                        ${vendorId},
                        ${buyer.buyerName},
                        ${buyer.orderAccount},
                        ${buyer.buyerNote},
                        ${buyer.itemName},
                        ${buyer.paymentMethod},
                        ${buyer.date},
                        ${buyer.time},
                        ${buyer.isPreOrder}
                    );
                `
            );
            await Promise.all(buyerInsertPromises);
        });


        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: 'Marketplace data saved successfully!' }),
        };
    } catch (error) {
        console.error("Database save error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to save marketplace data." }),
        };
    }
}