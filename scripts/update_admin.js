const Database = require('better-sqlite3');
const db = new Database('data/belote.db');

try {
    const update = db.prepare("UPDATE users SET role = 'admin' WHERE email = 'pruvost.pierre59@gmail.com'").run();
    console.log('Admin Update:', update);

    const del = db.prepare("DELETE FROM users WHERE username = 'TestUser'").run();
    console.log('Delete TestUser:', del);
} catch (e) {
    console.error(e);
}
