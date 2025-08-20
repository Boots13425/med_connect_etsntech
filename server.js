import express from 'express'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt'
import mysql from 'mysql2'
import bodyParser from 'body-parser';

const app = express()
const PORT = 3010;

// Middleware for parsing request bodies
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

//this is the commect for github
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

app.use(express.static(path.join(__dirname, "/public")))

//ENDPOINTS TO RENDER DIFFERENT PAGES
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/auth/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'))
})
app.get('/auth/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'))
})
//
app.get('/auth/phamacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'phamacy dashboard.html'))
})
app.get('/phama', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pharmacyprofile.html'))
})
//ESTABLISHING CONNECTION TO DATABASE
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'driversinformation'
})

db.connect((err) => {
    if (err) {
         console.error(err.sqlMessage)
        console.error('error connecting to database', err)
        return
    }
    console.log('successful connection to database')
})


//ENDPOINT TO CREATE A USER -- After signup, user is sent to login page
app.post('/auth/register', (req, res) => {
    const { username, email, password } = req.body

    const hashPassword = bcrypt.hashSync(password, 8)
    const sql = `INSERT INTO users (username, email, password) VALUES (?,?,?)`

    db.query(sql, [username, email, hashPassword], (err, result) => {
        if (err) {
            
            console.error(err.sqlMessage)
            return res.status(500).json({ message: 'Registration failed' })
        }
        console.log(`successful addition of ${username} users`)
        res.sendFile(path.join(__dirname, 'public', 'login.html'))
    })

})
app.post('/auth/phamacy', (req, res) => {
    const { username, email, password, pharmacyname, location } = req.body

    const hashPassword = bcrypt.hashSync(password, 8)
    const sql = `INSERT INTO signup (username, email, password, pharmacyname, location) VALUES (?,?,?,?,?)`

    db.query(sql, [username, email, hashPassword, pharmacyname, location], (err, result) => {
        if (err) {
            console.error(err.sqlMessage)
            return res.status(500).json({ message: 'Registration failed' })
        }
        // After successful signup, redirect to dashboard with location as query param
        res.redirect(`/pharmacy/dashboard?location=${encodeURIComponent(location)}`)
    })
})

//ENDPOINT TO LOGIN -- After Login, useer is sent to dashboard page
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body

    const sql = `SELECT * FROM users WHERE email = ?`

    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error('Database error:', err)
            return res.status(500).json({ message: 'Server error' })
        }

        if (result.length === 0) {
            return res.status(404).json({ message: 'Email not found' })
        }

        const user = result[0]
        const validPassword = bcrypt.compareSync(password, user.password)

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid password' })
        }

        // Login successful - redirect to dashboard
        // res.status(200).json({
        //     message: 'Login successful',
        //     redirect: '/dashboard.html',
        //     user: {
        //         id: user.id,
        //         username: user.username,
        //         email: user.email
        //     }
        // })
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
    })
})

app.get('/pharmacy/postdrug.html',(req, res) =>{
    res.sendFile(path.join(__dirname, 'public', 'postdrug.html'))
})

//ENDPOINT TO store a new drug in the db
app.post('/store/drug', (req, res) => {
    // Accept pharmacyname and location in addition to drug and price
    const { drug, price, pharmacyname, location} = req.body;

    // Adjust SQL to store all fields
    const sql = 'INSERT INTO newdrug (drug, price, pharmacyname, location) VALUES (?,?,?,?)';

    db.query(sql, [drug, price, pharmacyname, location], (err, result) => {
        if (err) {
            console.error('Error adding drug at server side', err);
            return res.status(500).send('error connecting to database');
        }
        console.log('drug successfully added');
        res.sendFile(path.join(__dirname, 'public', 'phamacy dashboard.html'));
    });
})

//to display the drugs on the pharmacy dashboard
app.get('/api/drugs', (req, res) => {
    // Return all columns needed for dashboard display
    const sql = 'SELECT drug, price, pharmacyname, location FROM newdrug';
    db.query(sql, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send('error selecting from database');
        }
        res.json(result);
    })
})
app.get('/pharmacy/dashboard', async (req, res) => {
    const location = req.query.location || 'Unknown Location'
    const fs = await import('fs/promises')
    const dashboardPath = path.join(__dirname, 'public', 'phamacy dashboard.html')
    try {
        const html = await fs.readFile(dashboardPath, 'utf8')
        const updatedHtml = html.replace(
            /Location:Yaounde-BIYEM ASSI/i,
            `Location:${location}`
        )
        res.send(updatedHtml)
    } catch (err) {
        res.status(500).send('Error loading dashboard')
    }
})

// API to get profile info
app.get('/api/profile', (req, res) => {
    db.query('SELECT about, available FROM profile WHERE id=1', (err, result) => {
        if (err) return res.status(500).json({});
        if (result.length === 0) return res.json({ about: '', available: '' });
        res.json(result[0]);
    });
});

// API to save profile info
app.post('/api/profile', (req, res) => {
    const { about, available } = req.body;
    const sql = `
        INSERT INTO profile (id, about, available)
        VALUES (1, ?, ?)
        ON DUPLICATE KEY UPDATE about = VALUES(about), available = VALUES(available)
    `;
    db.query(sql, [about, available], (err) => {
        if (err) return res.status(500).json({});
        res.json({ about, available });
    });
});

// API to get pharmacy info for dashboard cards
app.get('/api/pharmacyinfo', (req, res) => {
    const { pharmacyname, location } = req.query;
    if (!pharmacyname || !location) return res.json({ about: '', available: '' });
    // Find pharmacy id from signup table
    db.query(
        'SELECT id FROM signup WHERE pharmacyname = ? AND location = ? LIMIT 1',
        [pharmacyname, location],
        (err, result) => {
            if (err || result.length === 0) return res.json({ about: '', available: '' });
            const pharmacyId = result[0].id;
            db.query(
                'SELECT about, available FROM profile WHERE id = ? LIMIT 1',
                [pharmacyId],
                (err2, result2) => {
                    if (err2 || result2.length === 0) return res.json({ about: '', available: '' });
                    res.json(result2[0]);
                }
            );
        }
    );
});

// API to store payment/preorder info
app.post('/api/payment', (req, res) => {
    const { name, age, method, number } = req.body;
    if (!name || !age || !method || !number) {
        return res.status(400).json({ message: 'Missing fields' });
    }
    const sql = 'INSERT INTO payment (name, age, method, number) VALUES (?,?,?,?)';
    db.query(sql, [name, age, method, number], (err) => {
        if (err) {
            console.error('Error storing payment:', err);
            return res.status(500).json({ message: 'Failed to store payment' });
        }
        res.json({ message: 'Order placed' });
    });
});

// API to get all preorders from payment table
app.get('/api/preorders', (req, res) => {
    db.query('SELECT name, age FROM payment', (err, result) => {
        if (err) {
            console.error('Error fetching preorders:', err);
            return res.status(500).json([]);
        }
        res.json(result);
    });
});

app.listen(PORT, () => { console.log(`Server running on http://localhost:${PORT}`) })