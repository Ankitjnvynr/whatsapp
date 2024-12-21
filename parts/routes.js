// routes.js - Handles Express routes
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const { getClient, initializeVenom } = require('./venomClient');
const { getDb } = require('./db');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 } // 16 MB limit
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('Created "uploads" directory');
}

// Text message route
router.post('/api/send-message', async (req, res) => {
    const { number, message } = req.body;

    try {
        const client = getClient();
        const chatId = `${number}@c.us`;
        await client.sendText(chatId, message);
        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

// Media route
router.post('/api/send-media', upload.single('file'), async (req, res) => {
    const { number, caption } = req.body;
    const filePath = req.file.path;

    try {
        const client = getClient();
        const chatId = `${number}@c.us`;
        await client.sendFile(chatId, filePath, req.file.originalname, caption || '');
        res.status(200).json({ success: true, message: 'Media sent successfully!' });
    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ success: false, error: 'Failed to send media.' });
    } finally {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });
    }
});

// Bulk messages
router.post('/api/send-bulk-messages', async (req, res) => {
    const { numbers, message } = req.body;

    try {
        const client = getClient();
        for (const number of numbers) {
            const chatId = `${number}@c.us`;
            try {
                await client.sendText(chatId, message);
            } catch (error) {
                console.warn(`Failed to send to ${number}:`, error);
            }
        }
        res.status(200).json({ success: true, message: 'Bulk messages processed successfully!' });
    } catch (error) {
        console.error('Error sending bulk messages:', error);
        res.status(500).json({ success: false, error: 'Failed to send bulk messages.' });
    }
});

// Get QR code route
router.get('/api/get-qr-code', async (req, res) => {
    try {
        const db = getDb();
        const qrCollection = db.collection('qr_codes');
        const qrCode = await qrCollection.findOne({ session: 'whatsapp-session' });

        if (qrCode && qrCode.qrCode) {
            res.status(200).json({ qrCode: qrCode.qrCode });
        } else {
            res.status(404).json({ error: 'QR code not found' });
        }
    } catch (error) {
        console.error('Error fetching QR code:', error);
        res.status(500).json({ error: 'Failed to fetch QR code' });
    }
});

// Schedule messages route
router.post('/api/schedule-message', (req, res) => {
    const { number, message, scheduledTime } = req.body;
    const scheduleDate = new Date(scheduledTime);

    if (isNaN(scheduleDate)) {
        return res.status(400).json({ success: false, error: 'Invalid scheduled time format.' });
    }

    schedule.scheduleJob(scheduleDate, async () => {
        try {
            const client = getClient();
            const chatId = `${number}@c.us`;
            await client.sendText(chatId, message);
        } catch (error) {
            console.error('Error sending scheduled message:', error);
        }
    });

    res.status(200).json({ success: true, message: 'Message scheduled successfully!' });
});

router.post('/api/logout', async (req, res) => {
    try {
        const db = getDb();
        const qrCollection = db.collection('qr_codes');
        const sessionCollection = db.collection('sessions'); // Assuming a sessions collection exists

        // Step 1: Delete QR code from the database
        const qrDeleteResult = await qrCollection.deleteOne({ session: 'whatsapp-session' });
        if (qrDeleteResult.deletedCount > 0) {
            console.log('QR code session deleted from the database.');
        } else {
            console.log('No QR code session found in the database to delete.');
        }

        // Step 2: Delete WhatsApp session data from the database
        const sessionDeleteResult = await sessionCollection.deleteOne({ session: 'whatsapp-session' });
        if (sessionDeleteResult.deletedCount > 0) {
            console.log('WhatsApp session data deleted from the database.');
        } else {
            console.log('No WhatsApp session data found in the database to delete.');
        }

        // Step 3: Get the Venom client instance
        const client = getClient();

        // Step 4: Logout from WhatsApp
        try {
            await client.logout();
            console.log('Logged out of WhatsApp.');
        } catch (logoutError) {
            console.error('Error during WhatsApp logout:', logoutError);
            throw new Error('Failed to logout from WhatsApp.');
        }

        // Step 5: Stop the Venom client instance
        try {
            await client.close();
            console.log('Venom client stopped.');
        } catch (closeError) {
            console.error('Error stopping Venom client:', closeError);
            throw new Error('Failed to stop Venom client.');
        }

        // Send success response
        res.status(200).json({
            success: true,
            message: 'Logged out successfully, session and tokens cleared from the database.',
        });
    } catch (error) {
        console.error('Error during logout:', error.message);

        // Respond with failure
        res.status(500).json({
            success: false,
            error: 'Failed to logout and clear session.',
            details: error.message,
        });
    }
});
// Generate new QR code route
router.post('/api/generate-new-qr', async (req, res) => {
    try {
        console.log('Generating new QR code...');
        await initializeVenom(); // Reinitialize the Venom client to generate a new QR code
        res.status(200).json({ success: true, message: 'New QR code generated successfully!' });
    } catch (error) {
        console.error('Error generating new QR code:', error);
        res.status(500).json({ success: false, error: 'Failed to generate new QR code.' });
    }
});

module.exports = router;
