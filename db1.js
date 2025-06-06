const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dash = require('./dashboard.js')
const app = express();
const PORT = 4000;

app.use(cors());
//app.use('/favicon.ico', (req, res) => res.status(204));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'faculty123@score',
    database: 'web',
});

function formatDate(date){
  const pad = (n) => (n < 10 ? '0' + n : n);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${day}-${month}-${year} ${hours}-${minutes}-${seconds}`;
}

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.use(express.json()); // Add this line to parse JSON in requests

app.get('/:page', (req, res) => {
  const page = req.params.page || 'index.html';
  res.sendFile(path.join(__dirname, `public/${page}`));
});

app.post('/updateTotalScore', express.json(), (req, res) => {
  console.log('Received updateTotalScore request:', req.body);
  const totalScore = req.body.totalScore;
  const columnName = req.body.columnName;
  const userId = req.query.userId;

  const updateQuery = `UPDATE criteria SET ${columnName} = ${columnName} + ? WHERE userId = ?`;

  db.query(updateQuery, [totalScore, userId], (err, result) => {
    if (err) {
      console.error('Error updating total score in the database:', err);
      if (err.code === 'UNKNOWN_CODE_PLEASE_REPORT' && err.sqlMessage.includes('chk_' + columnName + '_max')) {
        return res.status(400).json({ error: 'Max score exceeded' });
      }
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }

    if (result.affectedRows === 0) {
      res.status(404).send('User not present');
      return;
    }

    console.log('Total score updated successfully!');
    res.json({ success: true, message: 'Total score updated successfully!' });
  });
});

app.post('/updateDetails', express.json(), (req, res) => {
  console.log('Received updateDetails request:', req.body);
  const id = req.body.idCell;
  const name = req.body.nameCell;
  const designation = req.body.designationCell;
  const academicExp = req.body.academicCell;
  const industryExp = req.body.industryCell;
  const dept =  req.body.deptCell;
  const totalExp = req.body.totalCell;
  const question = req.body.question;
  const qualification = req.body.qualification;


  const updateQuery = `
    UPDATE profile 
    SET name = ?, designation = ?, academicExp = ?, industryExp = ?, totalExp = ?, dept = ?, qualification = ?,  question = ?
    WHERE id = ?;
  `;

  
  
  db.query(updateQuery, [name, designation, academicExp, industryExp, totalExp, dept, qualification, question, id], (err, result) => {
    if (err) {
      console.error('Error updating details in the database:', err);
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
    console.log('Executing query:', updateQuery);

    console.log('Details updated successfully!');
    res.json({ success: true, message: 'Details updated successfully!' });
  });
});

app.delete('/delete', (req, res) => {
  const userId = req.query.userId;
  const oldFile = req.query.oldFile;
  const columnName = req.query.columnName;  // Get columnName from query parameters

  if (!userId || !oldFile || !columnName) {
    return res.status(400).send('Missing required query parameters.');
  }

  // Create the directory path for the user's files
  const userDir = path.join(__dirname, 'uploads', userId);

  // Delete the file from the database
  const deleteQuery = 'DELETE FROM files WHERE filename = ? AND userId = ? AND columnName = ?';
  db.query(deleteQuery, [oldFile, userId, columnName], (err) => {
    if (err) {
      console.error('Error deleting file from database:', err);
      return res.status(500).send('Error deleting file from database.');
    }

    // Delete the file from the filesystem
    const oldFilePath = path.join(userDir, oldFile);
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // Send success response
    res.send('File deleted successfully!');
  });
});


app.post('/edit', upload.array('certificates'), (req, res) => {
  const userId = req.query.userId;
  const oldFile = req.query.oldFile;
  const columnName = req.query.columnName;  // Get columnName from query parameters
  const uploadedFiles = req.files;

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  // Create the directory for the user's files if it doesn't exist
  const userDir = path.join(__dirname, 'uploads', userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Delete the old file from the database and filesystem
  const deleteQuery = 'DELETE FROM files WHERE filename = ? AND userId = ?';
  db.query(deleteQuery, [oldFile, userId], (err) => {
    if (err) {
      console.error('Error deleting file from database:', err);
      return res.sendStatus(500);
    }

    // Delete the old file from the filesystem
    const oldFilePath = path.join(userDir, oldFile);
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // Insert new files after deleting the old one
    const insertQuery = 'INSERT INTO files (filename, filepath, userId, columnName) VALUES (?, ?, ?, ?)';
    let hasError = false;

    uploadedFiles.forEach((file, index) => {
      const now = new Date();
      const formattedDate = formatDate(now);
      const extension = file.originalname.split('.').pop();
      const originalNameWithoutExtension = file.originalname.split('.')[0];
      const newFileName = `${columnName}_${originalNameWithoutExtension}_${formattedDate}.${extension}`;
      const targetPath = path.join(userDir, newFileName);

      // Rename and move the uploaded file
      fs.renameSync(file.path, targetPath);

      // Save file information to the database
      db.query(insertQuery, [newFileName, targetPath, userId, columnName], (err) => {
        if (err) {
          console.error('Error inserting file into the database:', err);
          hasError = true;
        }

        if (index === uploadedFiles.length - 1) {
          if (hasError) {
            return res.status(500).send('An error occurred while saving files.');
          }
          res.send('Files edited successfully!');
        }
      });
    });
  });
});

// app.post('/edit', upload.array('certificates'), (req, res) => {
//   const userId = req.query.userId;
//   const columnName = req.query.columnName;
//   const oldFile = req.query.oldFile;
//   const uploadedFiles = req.files;

//   if (!uploadedFiles || uploadedFiles.length === 0) {
//       return res.status(400).send('No files were uploaded.');
//   }

//   const deleteQuery = 'DELETE FROM files WHERE filename = ? AND userId = ? AND columnName = ?';

//   db.query(deleteQuery, [oldFile, userId, columnName], (err, result) => {
//       if (err) {
//           console.error('Error deleting file from database:', err);
//           return res.sendStatus(500);
//       }

//       // Proceed to insert new files after deleting the old one
//       const insertQuery = 'INSERT INTO files (filename, filepath, userId, columnName) VALUES (?, ?, ?, ?)';
     
//       uploadedFiles.forEach(file => {
//           const { originalname, path } = file;
//           db.query(insertQuery, [originalname, path, userId, columnName], (err, result) => {
//               if (err) {
//                   console.error('Error inserting file into the database:', err);
//                   return res.sendStatus(500);
//               }
//           });
//       });

//       res.send('Files edited successfully!');
//   });
// });



/*app.post('/uploadFiles', upload.array('certificates'), (req, res) => {
  const userId = req.query.userId;
  const columnName = req.query.columnName;
  const uploadedFiles = req.files;

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  // Save file information to the database
  const insertQuery = 'INSERT INTO files (filename, filepath, userId, columnName) VALUES (?, ?, ?, ?)';
  
  uploadedFiles.forEach(file => {
    const { originalname, path } = file;
    db.query(insertQuery, [originalname, path, userId, columnName], (err, result) => {
      if (err) {
        console.error('Error inserting file into the database:', err);
        return res.sendStatus(500);
      }
    });
  });

  res.send('Files uploaded successfully!');
});*/

app.post('/uploadFiles', upload.array('certificates'), (req, res) => {
  const userId = req.query.userId;
  const columnName = req.query.columnName;
  const uploadedFiles = req.files;

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  // Create the directory for the user's files if it doesn't exist
  const userDir = path.join(__dirname, 'uploads', userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const insertQuery = 'INSERT INTO files (filename, filepath, userId, columnName) VALUES (?, ?, ?, ?)';

  uploadedFiles.forEach(file => {
    // Get the current date in local time
    const now = new Date();
    const formattedDate = formatDate(now); // Use the custom format function
    const originalFileName = `${columnName}_${file.originalname.split('.')[0]}_${formattedDate}.${file.originalname.split('.').pop()}`;
    const targetPath = path.join(userDir, originalFileName);

    // Move file to the new target path with the modified name
    fs.renameSync(file.path, targetPath);

    // Save file information to the database
    db.query(insertQuery, [originalFileName, targetPath, userId, columnName], (err, result) => {
      if (err) {
        console.error('Error inserting file into the database:', err);
        if (err.sqlState === '45000') {
          return res.status(400).json({ error: 'Cannot upload files.' });
        }
        return res.sendStatus(500);
      }
    });
  });

  res.send('Files uploaded successfully!');
});


app.get('/download', (req, res) => {
  const fileId = req.query.fileId;
  if (!fileId) {
    return res.status(400).send('File ID is required.');
  }

  const selectQuery = 'SELECT * FROM files WHERE id = ?';
  
  db.query(selectQuery, [fileId], (err, result) => {
    if (err) {
      console.error('Error retrieving file from the database:', err);
      res.sendStatus(500);
    } else if (result.length === 0) {
      res.send('File not found.');
    } else {
      const { filename, filepath } = result[0];
      const fileStream = fs.createReadStream(filepath);

      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/octet-stream');

      fileStream.pipe(res);
    }
  });
});

app.post('/targetValues', express.json(), (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId parameter is missing' });
  }

  const checkUserQuery = `SELECT * FROM target WHERE userId = ? LIMIT 1`;
  db.query(checkUserQuery, [userId], (checkUserErr, checkUserResult) => {
    if (checkUserErr) {
      console.error('Error checking user:', checkUserErr);
      return res.status(500).json({ error: 'Internal Server Error', message: checkUserErr.message });
    }

    if (checkUserResult.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const userRow = checkUserResult[0];
    const columnKeys = Object.keys(userRow).filter(key => key !== 'userId');
    const nonZeroColumns = columnKeys.filter(key => userRow[key] !== null && userRow[key] !== 0);

    if (nonZeroColumns.length > 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Target cannot be edited' });
    }


    const values = req.body.values;
    const total = req.body.total;


    const maxValues = [65, 75, 70, 45, 45, 300];

    const c1 = Math.min(values[0] + values[1] + values[2] + values[3] + values[4] + values[5], maxValues[0]);
    const c2 = Math.min(values[6] + values[7] + values[8] + values[9] + values[10] + values[11] + values[12] + values[13] + values[14], maxValues[1]);
    const c3 = Math.min(values[15] + values[16] + values[17] + values[18] + values[19] + values[20] + values[21] + values[22] + values[23], maxValues[2]);
    const c4 = Math.min(values[24] + values[25] + values[26] + values[27] + values[28] + values[29], maxValues[3]);
    const c5 = Math.min(values[30] + values[31] + values[32] + values[33] + values[34], maxValues[4]);

    const tTotal = Math.min(c1 + c2 + c3 + c4 + c5, maxValues[5]);

    const updateQuery = `
      UPDATE target 
      SET 
          c11 = ?, c12 = ?, c13 = ?, c14 = ?, c15 = ?, c16 = ?,
          c21 = ?, c22 = ?, c23 = ?, c24 = ?, c25 = ?, c26 = ?, c27 = ?, c28 = ?, c29 = ?,
          c31 = ?, c32 = ?, c33 = ?, c34 = ?, c35 = ?, c36 = ?, c37 = ?, c38 = ?, c39 = ?,
          c41 = ?, c42 = ?, c43 = ?, c44 = ?, c45 = ?, c46 = ?,
          c51 = ?, c52 = ?, c53 = ?, c54 = ?, c55 = ?,
          c1 = ?, c2 = ?, c3 = ?, c4 = ?, c5 = ?, tTotal = ?
      WHERE userId = ?;
    `;

    const updateValues = [
      ...values,
      c1, c2, c3, c4, c5, tTotal,
      userId
    ];

    console.log("Values are", updateValues);

    db.query(updateQuery, updateValues, (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error updating target values:', updateErr);
        return res.status(500).json({ error: 'Internal Server Error', message: updateErr.message });
      }

      console.log('Values updated successfully in the target table!');
      res.json({ success: true, message: 'Values updated successfully in the target table!' });
    });
  });
});


app.post('/awardValues', express.json(), (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId parameter is missing' });
  }

  const checkUserQuery = `SELECT * FROM awarded WHERE userId = ? LIMIT 1`;
  db.query(checkUserQuery, [userId], (checkUserErr, checkUserResult) => {
    if (checkUserErr) {
      console.error('Error checking user:', checkUserErr);
      return res.status(500).json({ error: 'Internal Server Error', message: checkUserErr.message });
    }

    if (checkUserResult.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    // Check if any column other than userId is not null
    const userRow = checkUserResult[0];
    const columnKeys = Object.keys(userRow).filter(key => key !== 'userId');
    const nonZeroColumns = columnKeys.filter(key => userRow[key] !== null && userRow[key] !== 0);

    if (nonZeroColumns.length > 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Awarded cannot be edited' });
    }

    // Proceed to update the score if all conditions are met

    const values = req.body.values; // Assuming the request body contains an array of values
    const total = req.body.total; // Assuming the request body contains the grand total

    const maxValues = [65, 75, 70, 45, 45, 300];

    // Calculate sums for c1, c2, c3, c4, c5
    const c1 = Math.min(values[0] + values[1] + values[2] + values[3] + values[4] + values[5], maxValues[0]);
    const c2 = Math.min(values[6] + values[7] + values[8] + values[9] + values[10] + values[11] + values[12] + values[13] + values[14], maxValues[1]);
    const c3 = Math.min(values[15] + values[16] + values[17] + values[18] + values[19] + values[20] + values[21] + values[22] + values[23], maxValues[2]);
    const c4 = Math.min(values[24] + values[25] + values[26] + values[27] + values[28] + values[29], maxValues[3]);
    const c5 = Math.min(values[30] + values[31] + values[32] + values[33] + values[34], maxValues[4]);

    // Calculate cTotal, ensuring it doesn't exceed its max value
    const aTotal = Math.min(c1 + c2 + c3 + c4 + c5, maxValues[5]);

    // Construct the update query
    const updateQuery = `
      UPDATE awarded 
      SET 
          c11 = ?, c12 = ?, c13 = ?, c14 = ?, c15 = ?, c16 = ?,
          c21 = ?, c22 = ?, c23 = ?, c24 = ?, c25 = ?, c26 = ?, c27 = ?, c28 = ?, c29 = ?,
          c31 = ?, c32 = ?, c33 = ?, c34 = ?, c35 = ?, c36 = ?, c37 = ?, c38 = ?, c39 = ?,
          c41 = ?, c42 = ?, c43 = ?, c44 = ?, c45 = ?, c46 = ?,
          c51 = ?, c52 = ?, c53 = ?, c54 = ?, c55 = ?,
          c1 = ?, c2 = ?, c3 = ?, c4 = ?, c5 = ?, aTotal = ?
      WHERE userId = ?;
    `;

    const updateValues = [
      ...values,
      c1, c2, c3, c4, c5, aTotal,
      userId
    ];

    // Execute the update query
    db.query(updateQuery, updateValues, (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error updating awarded values:', updateErr);
        return res.status(500).json({ error: 'Internal Server Error', message: updateErr.message });
      }

      console.log('Values updated successfully in the awarded table!');
      res.json({ success: true, message: 'Values updated successfully in the awarded table!' });
    });
  });
});

app.post('/YourValues', express.json(), (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId parameter is missing' });
  }

  const checkUserQuery = `SELECT * FROM criteria WHERE userId = ? LIMIT 1`;
  db.query(checkUserQuery, [userId], (checkUserErr, checkUserResult) => {
    if (checkUserErr) {
      console.error('Error checking user:', checkUserErr);
      return res.status(500).json({ error: 'Internal Server Error', message: checkUserErr.message });
    }

    if (checkUserResult.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const userRow = checkUserResult[0];
    const columnKeys = Object.keys(userRow).filter(key => key !== 'userId');
    const nonZeroColumns = columnKeys.filter(key => userRow[key] !== null && userRow[key] !== 0);


    if (nonZeroColumns.length > 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Your marks cannot be edited' });
    }

    // Assuming the request body contains an array of values
    const values = req.body.values;

    // Define the maximum values for c1, c2, c3, c4, c5, cTotal
    const maxValues = [65, 75, 70, 45, 45, 300];

    // Calculate sums for c1, c2, c3, c4, c5
    const c1 = Math.min(values[0] + values[1] + values[2] + values[3] + values[4] + values[5], maxValues[0]);
    const c2 = Math.min(values[6] + values[7] + values[8] + values[9] + values[10] + values[11] + values[12] + values[13] + values[14], maxValues[1]);
    const c3 = Math.min(values[15] + values[16] + values[17] + values[18] + values[19] + values[20] + values[21] + values[22] + values[23], maxValues[2]);
    const c4 = Math.min(values[24] + values[25] + values[26] + values[27] + values[28] + values[29], maxValues[3]);
    const c5 = Math.min(values[30] + values[31] + values[32] + values[33] + values[34], maxValues[4]);

    // Calculate cTotal, ensuring it doesn't exceed its max value
    const cTotal = Math.min(c1 + c2 + c3 + c4 + c5, maxValues[5]);

    // Construct the update query
    const updateQuery = `
      UPDATE criteria 
      SET 
          c11 = ?, c12 = ?, c13 = ?, c14 = ?, c15 = ?, c16 = ?,
          c21 = ?, c22 = ?, c23 = ?, c24 = ?, c25 = ?, c26 = ?, c27 = ?, c28 = ?, c29 = ?,
          c31 = ?, c32 = ?, c33 = ?, c34 = ?, c35 = ?, c36 = ?, c37 = ?, c38 = ?, c39 = ?,
          c41 = ?, c42 = ?, c43 = ?, c44 = ?, c45 = ?, c46 = ?,
          c51 = ?, c52 = ?, c53 = ?, c54 = ?, c55 = ?,
          c1 = ?, c2 = ?, c3 = ?, c4 = ?, c5 = ?, cTotal = ?
      WHERE userId = ?;
    `;

    // Prepare the values array for the update query
    const updateValues = [
      ...values,
      c1, c2, c3, c4, c5, cTotal,
      userId
    ];

    // Execute the update query
    db.query(updateQuery, updateValues, (updateErr, updateResult) => {
      console.log("query is ", updateQuery);
      if (updateErr) {
        console.error('Error updating criteria values:', updateErr);
        return res.status(500).json({ error: 'Internal Server Error', message: updateErr.message });
      }

      console.log('Values updated successfully in the criteria table!');
      res.json({ success: true, message: 'Values updated successfully in the criteria table!' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://FACULTY-SCORE:${PORT}/`);
});