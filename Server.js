const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE,
                char_type VARCHAR(20),
                gold INT DEFAULT 1000,
                diamonds INT DEFAULT 0,
                city VARCHAR(50) DEFAULT 'مدينة البداية'
            );
        `);
    } catch (err) { console.error(err); }
}
initDB();

const CLASSES = {
    'warrior': { name: 'المحارب (سيوف)', skills: ['ضربة السيف'] },
    'mage': { name: 'الساحر (سحر)', skills: ['كرة النار'] },
    'elf': { name: 'الإلف (سهام وسحر)', skills: ['الشفاء سحر'] }
};

let activePlayers = {};

io.on('connection', (socket) => {
    socket.on('join_game', async ({ username, charType }) => {
        try {
            let res = await pool.query('SELECT * FROM players WHERE username = \$1', [username]);
            let player = res.rows[0];
            if (!player) {
                const insert = await pool.query('INSERT INTO players (username, char_type) VALUES (\$1, \$2) RETURNING *', [username, charType]);
                player = insert.rows[0];
            }
            activePlayers[socket.id] = player;
            activePlayers[socket.id].skills = CLASSES[player.char_type].skills;
            socket.emit('game_state', activePlayers[socket.id]);
        } catch (err) { console.error(err); }
    });

    socket.on('send_chat', (msg) => {
        const p = activePlayers[socket.id];
        if (p) io.emit('chat_message', { sender: p.username, text: msg });
    });

    socket.on('use_skill', () => {
        const p = activePlayers[socket.id];
        if (p) io.emit('chat_message', { sender: 'النظام', text: `⚔️ اللاعب [${p.username}] استخدم مهارة قتالية في ${p.city}!` });
    });
});

app.use(express.static('public'));
server.listen(PORT, () => console.log('Game Running'));
