const venom = require('venom-bot');
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = "./public/uploads";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

// Multer setup
const upload = multer({ storage });

// Venom-bot setup with persistent session
let venomClient;
async function startVenom() {
    const sessionName = 'sessionName';
    const sessionFolder = path.join(__dirname, 'briway-sessions', sessionName);

    // Check if session is stored
    const isSessionStored = fs.existsSync(sessionFolder) && fs.readdirSync(sessionFolder).length > 0;
    console.log(`Session stored: ${isSessionStored}`);

    try {
        venomClient = await venom.create(
            sessionName,
            (base64Qr, asciiQR, attempts, urlCode) => {
                console.log('QR Code:');
                console.log(asciiQR); // Display QR code when needed
            },
            (statusSession, session) => {
                console.log('Status Session:', statusSession);
                console.log('Session name:', session);
            },
            {
                folderNameToken: 'tokens',
                mkdirFolderToken: path.join(__dirname, 'briway-sessions'),
                headless: !isSessionStored, // Start headless if session is stored
                multidevice: true
            }
        );

        console.log('Venom bot session started successfully');
    } catch (err) {
        console.error('Venom encountered an error:', err);
        throw err; // Propagate the error to handle it elsewhere if needed
    }
}

// Create Express app
const app = express();

// Set up EJS templating engine
app.set('view engine', 'ejs');

// Serve static files from the public directory
app.use('/public', express.static('public'));

// Parse form data
app.use(express.urlencoded({ extended: true }));

// Route for the homepage with the form
app.get('/', (req, res) => {
    res.render('index'); // Assuming 'index.ejs' is your template file
});

// Route to handle form submissions
app.post('/send', upload.single('image'), async (req, res) => {
    const number = req.body.number;
    const message = req.body.message;
    const imageUrl = req.file ? req.file.filename : null; // Get image path if uploaded
    const logs = [];

    try {
        // Check if venomClient is already initialized
        if (!venomClient) {
            logs.push('Starting Venom bot session...');
            await startVenom();
            logs.push('Venom bot session started.');
        }

        const chatId = `${number}@c.us`;

        // Send text message
        const textResult = await venomClient.sendText(chatId, message);
        logs.push(`Message sent to ${number}: ${JSON.stringify(textResult)}`);

        // Send image if uploaded
        let imageResult;
        if (imageUrl) {
            const imagePath = path.join(__dirname, 'public/uploads', imageUrl);
            imageResult = await venomClient.sendImage(chatId, imagePath, 'image.png', 'Image from website');
            logs.push(`Image sent to ${number}: ${JSON.stringify(imageResult)}`);
        }



        res.json({
            success: true,
            logs
        });
    } catch (err) {
        console.error('Error sending message:', err);
        logs.push(`Error sending message: ${err.message}`);
        res.status(500).json({
            success: false,
            logs
        });
    }
});


