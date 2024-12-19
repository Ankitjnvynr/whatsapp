const express = require('express');
const venom = require('venom-bot');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files in the 'uploads' folder
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 } // 16 MB limit
});

// Start Venom Client
let client;
venom
    .create({
        session: 'whatsapp-session',
        multidevice: true, // Use multi-device support
    })
    .then((venomClient) => {
        client = venomClient;
        console.log('WhatsApp client is ready!');
    })
    .catch((err) => {
        console.error('Error starting venom-bot:', err);
    });

// Serve HTML for frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'siv.html'));
});

// API to send text messages
app.post('/api/send-message', async (req, res) => {
    const { number, message } = req.body;

    if (!client) {
        return res.status(503).json({ success: false, error: 'WhatsApp client is not ready yet.' });
    }

    if (!number || !message) {
        return res.status(400).json({ success: false, error: 'Number and message are required.' });
    }

    try {
        const chatId = `${number}@c.us`; // Format the number
        await client.sendText(chatId, message);
        res.status(200).json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message.' });
    }
});

// API to send media (including videos)
app.post('/api/send-media', upload.single('file'), async (req, res) => {
    const { number, caption } = req.body;

    if (!client) {
        return res.status(503).json({ success: false, error: 'WhatsApp client is not ready yet.' });
    }

    if (!number || !req.file) {
        return res.status(400).json({ success: false, error: 'Number and file are required.' });
    }

    const chatId = `${number}@c.us`;
    const filePath = req.file.path;

    try {
        // Send video with optional caption
        await client.sendFile(chatId, filePath, req.file.originalname, caption || '');
        res.status(200).json({ success: true, message: 'Media sent successfully!' });
    } catch (error) {
        console.error('Error sending media:', error);
        res.status(500).json({ success: false, error: 'Failed to send media.' });
    } finally {
        // Clean up the uploaded file
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting uploaded file:', err);
            }
        });
    }
});

// Start the Express server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
