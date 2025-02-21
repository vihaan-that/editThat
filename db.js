const Database = require('better-sqlite3');
const path = require('path');

let db;

function initializeDb() {
    if (!db) {
        db = new Database(path.join(__dirname, 'videos.db'), { verbose: console.log });
        db.pragma('journal_mode = WAL');
        
        // Create videos table if it doesn't exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                size INTEGER NOT NULL,
                duration FLOAT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
    return db;
}

function getDb() {
    return db || initializeDb();
}

module.exports = {
    initializeDb,
    getDb
};
