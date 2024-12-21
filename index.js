// index.js - Main entry point
const express = require('express');
const { connectDb } = require('./parts/db');
const { initializeVenom } = require('./parts/venomClient');
const routes = require('./parts/routes');

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(__dirname + '/public'));

// Serve "siv.html" as the default homepage
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/siv.html', (err) => {
        if (err) {
            console.error('Error serving siv.html:', err);
            res.status(500).send('Error loading the homepage.');
        }
    });
});

// API Routes
app.use('/', routes);

// Initialize and Start the Server
(async () => {
    try {
        console.log('Connecting to database...');
        await connectDb();
        console.log('Database connected successfully.');

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
        
        console.log('Initializing Venom client...');
        await initializeVenom();
        console.log('Venom client initialized successfully.');

    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1); // Exit the process if critical error occurs
    }
})();
