import { neon } from '@netlify/neon';
const databaseUrl = process.env.NETLIFY_DATABASE_URL;
const sql = neon(databaseUrl);

export async function handler(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { fullName, account, itemName, itemPriceCash, itemPricePayday, itemPreorder } = JSON.parse(event.body);

        if (!fullName || !account) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Please enter the Vendor\'s Full Name and Account.' }) };
        }

        // Generate the unique vendor key (same logic as client-side)
        // Helper to get first N characters, with first letter uppercase, rest lowercase
        const formatPart = (str, length) => {
            const cleanedStr = str.replace(/[^a-zA-Z]/g, '');
            if (cleanedStr.length === 0) return '';
            const part = cleanedStr.substring(0, length);
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        };
        const firstTwoFullNameFormatted = formatPart(fullName.split(' ')[0] || '', 2);
        const firstTwoAccountFormatted = formatPart(account.split(' ')[0] || '', 2);
        const newVendorKey = `${firstTwoFullNameFormatted}${firstTwoAccountFormatted}`;

        // Check if vendor key already exists
        const existingVendor = await sql`SELECT id FROM vendors WHERE key = ${newVendorKey};`;
        if (existingVendor.length > 0) {
            return { statusCode: 409, body: JSON.stringify({ error: `A vendor with the key "${newVendorKey}" already exists.` }) };
        }

        // Use a transaction for atomicity: register vendor AND add initial item if present
        await sql.transaction(async (tx) => {
            // Register the new vendor
            await tx`
                INSERT INTO vendors (id, name, key)
                VALUES (${newVendorKey}, ${fullName}, ${newVendorKey});
            `;

            // Add the initial item if provided
            if (itemName) {
                // Generate item ID - same logic as client-side
                const generateItemId = (vendorId, itemName) => {
                    const sanitizedItem = itemName.replace(/[^a-zA-Z0-9]/g, '');
                    return `${vendorId}-${sanitizedItem}-${Date.now()}`;
                };
                const newItemId = generateItemId(newVendorKey, itemName);

                await tx`
                    INSERT INTO items (id, vendor_id, name, price_cash, price_payday, is_available, is_pre_order)
                    VALUES (${newItemId}, ${newVendorKey}, ${itemName}, ${itemPriceCash}, ${itemPricePayday}, TRUE, ${itemPreorder});
                `;
            }
        });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: 'Vendor registered successfully!', vendorKey: newVendorKey }),
        };
    } catch (error) {
        console.error("Database error in registerVendor:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to register vendor.", details: error.message }),
        };
    }
}