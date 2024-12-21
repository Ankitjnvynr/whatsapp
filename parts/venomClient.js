const venom = require('venom-bot');
const { getDb } = require('./db');

let client;

async function initializeVenom() {
    try {
        const db = getDb();
        const sessionCollection = db.collection('sessions');
        const sessionData = await sessionCollection.findOne({ session: 'whatsapp-session' });

        client = await venom.create({
            session: 'whatsapp-session', // Session name
            multidevice: true, // Enable multi-device support
            catchQR: async (base64Qr, asciiQR, attempts, urlCode) => {
                console.log('QR Code Generated:', asciiQR);

                // Save QR code to database
                const qrCollection = db.collection('qr_codes');
                await qrCollection.updateOne(
                    { session: 'whatsapp-session' },
                    { $set: { qrCode: base64Qr, generatedAt: new Date() } },
                    { upsert: true }
                );
            },
            sessionData: sessionData ? sessionData.sessionData : undefined, // Use stored session data if available
        });

        console.log('WhatsApp client is ready!');

        // Save session data in the database whenever it changes
        client.onStateChange((state) => {
            console.log(`Client state: ${state}`);
            if (state === 'CONNECTED') {
                client
                    .getSessionTokenBrowser()
                    .then((sessionToken) => {
                        sessionCollection.updateOne(
                            { session: 'whatsapp-session' },
                            { $set: { sessionData: sessionToken, updatedAt: new Date() } },
                            { upsert: true }
                        );
                        console.log('Session data saved to the database.');
                    })
                    .catch((err) => {
                        console.error('Error saving session data:', err);
                    });
            }
        });
    } catch (error) {
        console.error('Error initializing Venom:', error);
    }
}

function getClient() {
    if (!client) {
        throw new Error('WhatsApp client not initialized');
    }
    return client;
}

module.exports = { initializeVenom, getClient };
