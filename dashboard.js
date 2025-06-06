//import { Worker } from '@react-pdf-viewer/core';
//import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
//import { Viewer } from '@react-pdf-viewer/core';
//import '@react-pdf-viewer/core/lib/styles/index.css';
//import '@react-pdf-viewer/default-layout/lib/styles/index.css';

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors'); // Add this line
const fs = require('fs');

const app = express();
const port = 5000;

// Enable CORS
app.use(cors()); 
// Create a MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'faculty123@score',
    database: 'web',
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
});

app.post('/validateResponse', (req, res) => {
    const userId = req.query.userId; // Assuming 'userId' is sent in the request body
    console.log('Received validation request with id:', userId);

    const query = 'SELECT question FROM profile WHERE id = ?';

    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error executing the change password query:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        } else {
            console.log('Response validated');
            res.status(200).json({ message: "Response validated", result });
        }
    });
});


app.get('/getData', (req, res) => {
    const userId = req.query.userId;
    const criteriaLabelsParam = req.query.criteriaLabels;

    const criteriaLabels = criteriaLabelsParam ? criteriaLabelsParam.split(',') : ['c11', 'c12', 'c13', 'c14', 'c15', 'c16'];

    const criteriaQuery = 'SELECT * FROM criteria WHERE userId = ?'; 
    const targetQuery = 'SELECT * FROM target WHERE userId = ?'; 
    const awardQuery = 'SELECT * FROM awarded WHERE userId = ?'; 

    db.query(criteriaQuery, [userId],(err, criteriaResult) => {
        if (err) {
            console.error('Error executing the criteria query:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        db.query(awardQuery, [userId], (err, awardResult) => {
            if (err) {
                console.error('Error executing the target query:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

        db.query(targetQuery, [userId], (err, targetResult) => {
            if (err) {
                console.error('Error executing the target query:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            if (targetResult.length === 0) {
                res.status(404).send('User not present');
                return;
            }

            const yourScores = criteriaLabels.map((label) => criteriaResult[0][label]);
            const targetScores = criteriaLabels.map((label) => targetResult[0][label]);
            const awardScores = criteriaLabels.map((label) => awardResult[0][label]);


            const responseData = {
                criteriaLabels: criteriaLabels,
                yourScores: yourScores,
                targetScores: targetScores,
                awardScores: awardScores,
            };
            console.log('Query result:', responseData);
            res.json(responseData);
        });
    });
    });
});

app.get('/getStatsToP', (req, res) => {
    const criteriaLabelsParam = "CSE,ECE,AIML,EEE,IT,BSH"; // Example criteria labels
    console.log('Received request to getStatsToP');
    const criteriaLabels = criteriaLabelsParam ? criteriaLabelsParam.split(',') : ['CSE', 'ECE', 'AIML', 'EEE', 'IT', 'BSH'];

    // Initialize object to store counts for each department
    let departmentCounts = {};

    // Loop through each department
    criteriaLabels.forEach(dept => {
        // Initialize counts for criteria, target, and awarded for the current department
        let criteriaCount = 0;
        let targetCount = 0;
        let awardedCount = 0;

        // Count criteria entries for the current department
        db.query(`SELECT COUNT(*) AS cTotal FROM criteria WHERE userid IN (SELECT id FROM profile WHERE dept = ?) AND cTotal IS NOT NULL AND cTotal != 0`, [dept], (err, criteriaRows) => {
            if (err) throw err;
            criteriaCount = criteriaRows[0].cTotal;

            // Count target entries for the current department
            db.query(`SELECT COUNT(*) AS tTotal FROM target WHERE userid IN (SELECT id FROM profile WHERE dept = ?) AND tTotal != 0`, [dept], (err, targetRows) => {
                if (err) throw err;
                targetCount = targetRows[0].tTotal;

                // Count awarded entries for the current department
                db.query(`SELECT COUNT(*) AS aTotal FROM awarded WHERE userid IN (SELECT id FROM profile WHERE dept = ?) AND aTotal IS NOT NULL AND aTotal != 0`, [dept], (err, awardedRows) => {
                    if (err) throw err;
                    awardedCount = awardedRows[0].aTotal;

                    // Store the counts for the current department
                    departmentCounts[dept] = {
                        Criteria: criteriaCount,
                        Target: targetCount,
                        Awarded: awardedCount
                    };

                    // Check if all departments have been processed
                    if (Object.keys(departmentCounts).length === criteriaLabels.length) {
                        // Send the department counts as response
                        res.json(departmentCounts);
                    }
                });
            });
        });
    });
    console.log('Response sent to getStatsToP');
});

app.get('/getStatsToHoD', (req, res) => {
    const department = req.query.dept; // Get department name from query parameter
    console.log(`dept is ${department}`);
    if (!department) {
        return res.status(400).json({ error: 'Department parameter is required' });
    }

    console.log(`Received request to getStatsToHoD for department ${department}`);

    // Initialize counts for criteria, target, and awarded
    let criteriaCount = 0;
    let targetCount = 0;
    let awardedCount = 0;

    // Count criteria entries for the specified department
    db.query(`SELECT COUNT(*) AS cTotal FROM criteria WHERE userid IN (SELECT id FROM profile WHERE dept = ?) AND cTotal IS NOT NULL AND cTotal != 0`, [department], (err, criteriaRows) => {
        if (err) {
            console.error('Error counting criteria:', err);
            return res.status(500).json({ error: 'An error occurred while counting criteria' });
        }
        criteriaCount = criteriaRows[0].cTotal;

        // Count target entries for the specified department
        db.query(`SELECT COUNT(*) AS tTotal FROM target WHERE userid IN (SELECT id FROM profile WHERE dept = ?) AND tTotal != 0`, [department], (err, targetRows) => {
            if (err) {
                console.error('Error counting targets:', err);
                return res.status(500).json({ error: 'An error occurred while counting targets' });
            }
            targetCount = targetRows[0].tTotal;

            // Count awarded entries for the specified department
            db.query(`SELECT COUNT(*) AS aTotal FROM awarded WHERE userid IN (SELECT id FROM profile WHERE dept = ?) AND aTotal IS NOT NULL AND aTotal != 0`, [department], (err, awardedRows) => {
                if (err) {
                    console.error('Error counting awarded:', err);
                    return res.status(500).json({ error: 'An error occurred while counting awarded' });
                }
                awardedCount = awardedRows[0].aTotal;

                // Send the counts for the specified department as response
                const responseData = {
                    Criteria: criteriaCount,
                    Target: targetCount,
                    Awarded: awardedCount
                };

                console.log('Response sent to getStatsToHoD:', responseData); // Log the response data

                res.json(responseData);
            });
        });
    });
});

app.get('/getDataHOD', (req, res) => {
    const id = req.query.id; 
    console.log('Received request with id:', id);
  
    const query = 'SELECT * FROM profile WHERE id = ?';
    console.log('Executing query:', query);
  
    db.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error executing the criteria query:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      console.log('Query result:', result);
      res.json(result);
    });
});

app.get('/getPercentage', (req, res) => {
    const userId = req.query.userId;
    const columnName = req.query.columnName;
    console.log('Received request with userId and columnName:', userId, columnName);

    let cm, tm, am;

    if (columnName) {
        cm = columnName;
        tm = columnName;
        am = columnName;
    } else {
        cm = 'cTotal'; // Assuming 'cTotal' is the column name in your database
        tm = 'tTotal'; // Assuming 'tTotal' is the column name in your database
        am = 'aTotal';
    }

    const cQuery = 'SELECT ?? FROM criteria WHERE userId = ?';
    const tQuery = 'SELECT ?? FROM target WHERE userId = ?';
    const aQuery = 'SELECT ?? FROM awarded WHERE userId = ?';


    // Execute the queries
    db.query(aQuery, [am, userId], (aErr, aResult) => {
        if (aErr) {
            console.error('Error fetching cTotal:', aErr);
            return res.status(500).json({ error: 'Internal Server Error', message: aErr.message });
        }

        db.query(tQuery, [tm, userId], (tErr, tResult) => {
            if (tErr) {
                console.error('Error fetching tTotal:', tErr);
                return res.status(500).json({ error: 'Internal Server Error', message: tErr.message });
            }

            const aTotal = aResult.length > 0 ? aResult[0][am] : 0;
            const tTotal = tResult.length > 0 ? tResult[0][tm] : 0;
            console.log('awarded and target are ', aTotal, tTotal);
            let percentage = 100;
            if (tTotal !== 0) {
                percentage = (aTotal / tTotal) * 100;
            }

            res.json({ percentage: percentage });
        });
    });
});


app.get('/getProof', (req, res) => {
    const userId = req.query.userId;
    console.log('Received request with userId:', userId);

    if (!userId) {
        return res.status(400).json({ error: 'userId is a required parameter.' });
    }

    const selectQuery = 'SELECT userId, filename, filepath, columnName FROM files WHERE userId = ? ORDER BY columnName ASC';

    db.query(selectQuery, [userId], (err, results) => {
        if (err) {
            console.error('Error retrieving file information from the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'No files found for the provided userId and columnName.' });
        }
        console.log('Query result:', results);
        res.json({ files: results });
    });
});

app.get('/download', (req, res) => {
    const userId = req.query.userId;
    const filename = req.query.filename;

    console.log('Received download request with userId:', userId, 'and filename:', filename);

    if (!userId || !filename) {
        return res.status(400).json({ error: 'Both userId and filename are required parameters.' });
    }

    const selectQuery = 'SELECT filepath FROM files WHERE userId = ? AND filename = ?';

    db.query(selectQuery, [userId, filename], (err, results) => {
        if (err) {
            console.error('Error retrieving file information from the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'File not found for the provided userId and filename.' });
        }

        const filepath = results[0].filepath;
        console.log('the file is at', filepath);
        const fileStream = fs.createReadStream(filepath);

        fileStream.on('error', (err) => {
            console.error('Error reading file:', err);
            return res.status(500).json({ error: 'Internal server error' });
        });

        res.setHeader('Content-disposition', 'attachment; filename=' + filename);
        res.setHeader('Content-type', 'application/octet-stream');

        fileStream.pipe(res);

    });
});

app.post('/delete', (req, res) => { 
    const userId = req.body.userId;
    const filename = req.body.filename;

    console.log('Received delete request with userId:', userId, 'and filename:', filename);

    if (!userId || !filename) {
        return res.status(400).json({ error: 'Both userId and filename are required parameters.' });
    }

    const deleteQuery = 'delete from files where userId = ? AND filename = ?';

    db.query(deleteQuery, [userId, filename], (err, results) => {
        if (err) {
            console.error('Error deleting file information from the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.affectedRows === 0) { // Check affectedRows
            return res.status(404).json({ error: 'File not found for the provided userId and filename.' });
        }
        
        console.log('File deleted successfully!');
        res.status(200).json({ message: 'File deleted successfully' }); 
    });
});

app.get('/userValidation', (req, res) => {
    const userId = req.query.userId;
    console.log('Received request with id:', userId);
  
    const query = 'SELECT password, hod FROM users WHERE userId = ?';
    console.log('Executing query:', query);
  
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error executing the criteria query:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (result.length === 0) {
            console.log('No user found with userId:', userId);
            return res.status(404).json({ error: 'INVALID USER' });
        }

        const { password, hod } = result[0];
        console.log('Query result:', { password, hod });
        res.json({ password, hod });
    });
});

app.get('/getName', (req, res) => {
    const id = req.query.userId;
    console.log('Received request with id:', id);

    const query = 'SELECT name, dept FROM profile WHERE id = ?';

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error executing the query:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (result.length === 0) {
            console.log('No user found with id:', id);
            return res.status(404).json({ error: 'User not found' });
        }

        const name = result[0].name;
        const dept = result[0].dept;
        console.log('User name:', name);
        console.log('Department:', dept);
        res.json({ name, dept });
    });
});


app.post('/changePassword', (req, res) => {
    const userId = req.query.userId;
    const newPassword = req.query.newPassword;
    console.log('Received password change request with id:', userId);

    const query = 'UPDATE users SET password = ? WHERE userId = ?';

    db.query(query, [newPassword, userId], (err, result) => {
        if (err) {
            console.error('Error executing the change password query:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.status(200).json({ message: "Password changed successfully" });
            console.log('Password changed successfully');
        }
    });
});

app.get('/getDeptDetails', (req, res) => {
    const userId = req.query.userId;
    const filter = req.query.filter;

    console.log('Received request with id:', userId);

    const query = 'SELECT dept FROM profile WHERE id = ?';
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error executing the department query:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (result.length === 0) {
            console.log('No user found with userId:', userId);
            res.json({ error: "INVALID USER" });
            return;
        }

        const department = result[0].dept;
        console.log('User belongs to department:', department);

        // Now fetch all users belonging to the same department
        let orderColumn;
        let joinTable;
        if (filter === 'criteria') {
            orderColumn = 'cTotal';
            joinTable = 'criteria';
        } else if (filter === 'target') {
            orderColumn = 'tTotal';
            joinTable = 'target';
        } else if (filter === 'awarded') {
            orderColumn = 'aTotal';
            joinTable = 'awarded';
        } else {
            res.status(400).json({ error: 'Invalid filter parameter' });
            return;
        }

        const usersQuery = `
            SELECT p.id, p.name, ${orderColumn} as orderColumn
            FROM profile p
            JOIN ${joinTable} t ON p.id = t.userId
            WHERE p.dept = ?
            ORDER BY ${orderColumn} DESC
        `;
        
        db.query(usersQuery, [department], (err, usersResult) => {
            if (err) {
                console.error('Error fetching users from the same department:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            // Extracting ids, names, and orderColumns from the result
            const users = usersResult.map(user => ({
                id: user.id,
                name: user.name,
                orderColumn: user.orderColumn
            }));

            // Send department and users as response
            console.log('Response is ', { department, users });
            res.json({ department, users });
        });
    });
});

// app.get('/getDeptDetailsToP', (req, res) => {
//     const dept = req.query.dept;
//     const filter = req.query.filter;

//     console.log('Received request with dept:', dept);

//     // Define orderColumn based on the filter
//     let orderColumn;
//     let joinTable;
//     if (filter === 'criteria') {
//         orderColumn = 'cTotal';
//         joinTable = 'criteria';
//     } else if (filter === 'target') {
//         orderColumn = 'tTotal';
//         joinTable = 'target';
//     } else if (filter === 'awarded') {
//         orderColumn = 'aTotal';
//         joinTable = 'awarded';
//     } else {
//         res.status(400).json({ error: 'Invalid filter parameter' });
//         return;
//     }

//     const usersQuery = `
//         SELECT p.id, p.name, COALESCE(t.${orderColumn}, 0) as orderColumn
//         FROM profile p
//         LEFT JOIN ${joinTable} t ON p.id = t.userId
//         WHERE p.dept = ?
//         ORDER BY COALESCE(t.${orderColumn}, 0) DESC
//     `;

//     db.query(usersQuery, [dept], (err, usersResult) => {
//         if (err) {
//             console.error('Error fetching users from the same department:', err);
//             res.status(500).json({ error: 'Internal Server Error' });
//             return;
//         }

//         // Extracting ids, names, and orderColumns from the result
//         const users = usersResult.map(user => ({
//             id: user.id,
//             name: user.name,
//             orderColumn: user.orderColumn
//         }));

//         // Send department and users as response
//         console.log('Response is ', { dept, users });
//         res.json({ dept, users });
//     });
// });

app.get('/getDeptDetailsToP', (req, res) => {
    const dept = req.query.dept;
    const filter = req.query.filter;

    console.log('Received request with dept:', dept);

    // Define orderColumn and joinTable based on the filter
    let orderColumn;
    let joinTable;
    if (filter === 'criteria') {
        orderColumn = 'criteria.cTotal';
        joinTable = 'criteria';
    } else if (filter === 'target') {
        orderColumn = 'target.tTotal';
        joinTable = 'target';
    } else if (filter === 'awarded') {
        orderColumn = 'awarded.aTotal';
        joinTable = 'awarded';
    } else {
        res.status(400).json({ error: 'Invalid filter parameter' });
        return;
    }

    const usersQuery = `
        SELECT 
            p.id, 
            p.name, 
            COALESCE(criteria.cTotal, 0) as criteriaTotal,
            COALESCE(target.tTotal, 0) as targetTotal,
            COALESCE(awarded.aTotal, 0) as awardedTotal
        FROM profile p
        LEFT JOIN criteria ON p.id = criteria.userId
        LEFT JOIN target ON p.id = target.userId
        LEFT JOIN awarded ON p.id = awarded.userId
        WHERE p.dept = ?
        ORDER BY COALESCE(${orderColumn}, 0) DESC
    `;

    db.query(usersQuery, [dept], (err, usersResult) => {
        if (err) {
            console.error('Error fetching users from the same department:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // Extracting ids, names, and totals from the result
        const users = usersResult.map(user => ({
            id: user.id,
            name: user.name,
            criteriaTotal: user.criteriaTotal,
            targetTotal: user.targetTotal,
            awardedTotal: user.awardedTotal
        }));

        // Send department and users as response
        console.log('Response is ', { dept, users });
        res.json({ dept, users });
    });
});



app.get('/getDeptStats', (req, res) => {
    const dept = req.query.dept;
    const filter = req.query.filter;

    console.log('Received request with dept:', dept);

    let orderColumn;
    if (filter === 'criteria') {
        orderColumn = 'cTotal';
    } else if (filter === 'target') {
        orderColumn = 'tTotal';
    } else if (filter === 'awarded') {
        orderColumn = 'aTotal';
    } else {
        res.status(400).json({ error: 'Invalid filter parameter' });
        return;
    }

        const usersQuery = `
            SELECT p.name, t.tTotal, c.cTotal , a.aTotal
            FROM profile p
            JOIN target t ON p.id = t.userId
            JOIN criteria c ON p.id = c.userId
            JOIN awarded a ON p.id = a.userId
            WHERE p.dept = ?
            ORDER BY ${orderColumn} DESC
        `;

        db.query(usersQuery, [dept], (err, usersResult) => {
            if (err) {
                console.error('Error fetching users from the same department:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const users = usersResult.map(user => ({
                name: user.name,
                tTotal: user.tTotal,
                cTotal: user.cTotal,
                aTotal: user.aTotal,
            }));

            console.log('Response is ', { dept, users });
            res.json({ dept, users });
        });
});

app.post('/updateAwardScore', express.json(), (req, res) => {
    console.log('Received updateAwardScore request:', req.body);

    const { awardedScore, criteria, userId, filename } = req.body;

    if (!awardedScore || !criteria || !userId || !filename) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update awarded score
    const updateQuery = `UPDATE awarded SET  ${criteria} = ${criteria} + ? WHERE userId = ?`;
    db.query(updateQuery, [awardedScore, userId], (err, result) => {
        if (err) {
            console.error('Error updating awarded score in the database:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Duplicate entry' });
            }
            return res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }

        // Check if the user exists
        if (result.affectedRows === 0) {
            return res.status(404).send('User not found');
        }

        console.log('Awarded score updated successfully!');

        const updateFile = 'UPDATE files SET score = 1, marks = ? WHERE userId = ? AND filename = ?';
        db.query(updateFile, [awardedScore, userId, filename], (fileErr, fileResult) => {
            if (fileErr) {
                console.error('Error updating file score in the database:', fileErr);
                return res.status(500).json({ error: 'Internal Server Error', message: fileErr.message });
            }

            console.log('File score updated successfully!');
            res.json({ success: true, message: 'Awarded score and file score updated successfully!' });
        });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://FACULTY-SCORE:${port}`);
});