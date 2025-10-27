const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI;
const connectWithRetry = () => {
  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    // Add these options:
    retryWrites: true,
    w: 'majority',
    ssl: true,
    authSource: 'admin',
  })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
      console.error('Could not connect to MongoDB:', err);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// User model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['teacher', 'student', 'alumni'] },
  name: String,
  additionalInfo: String,
  degree: String,
  department: String,
});

const User = mongoose.model('User', userSchema);

// Subject model
const subjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  degree: { type: String, required: true },
  department: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  units: [{
    title: String,
    sections: [{
      title: String,
      content: String,
      files: [{ name: String, url: String }]
    }]
  }]
});

const Subject = mongoose.model('Subject', subjectSchema);

// Assignment model
const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  file: { name: String, url: String },
  submissions: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    file: { name: String, url: String },
    submittedAt: { type: Date, default: Date.now }
  }]
});

const Assignment = mongoose.model('Assignment', assignmentSchema);


// Grade model
const gradeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  cycleTest1: { type: Number, default: 0 },
  cycleTest2: { type: Number, default: 0 },
  assignments: { type: Number, default: 0 },
});

const Grade = mongoose.model('Grade', gradeSchema);


// Message model
const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

// Alumni message model
const alumniMessageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  degree: { type: String, required: true },
  department: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const AlumniMessage = mongoose.model('AlumniMessage', alumniMessageSchema);

// Academic calendar model
const academicCalendarSchema = new mongoose.Schema({
  day: String,
  date: String,
  description: String,
});

const AcademicCalendar = mongoose.model('AcademicCalendar', academicCalendarSchema);

// Task model
const taskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: String, required: true },
  dueDate: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notificationSent: { type: Boolean, default: false }
});

const Task = mongoose.model('Task', taskSchema);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Signup route
app.post('/api/auth/signup', [
  body('email').isEmail().withMessage('Please enter a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('role').isIn(['teacher', 'student', 'alumni']).withMessage('Role must be either teacher, student, or alumni'),
  body('name').notEmpty().withMessage('Name is required'),
  body('degree').notEmpty().withMessage('Degree is required'),
  body('department').notEmpty().withMessage('Department is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, role, name, additionalInfo, degree, department } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      password: hashedPassword,
      role,
      name,
      additionalInfo,
      degree,
      department,
    });

    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ token, role: user.role, name: user.name });
  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).json({ message: 'Error signing up', error: 'An unexpected error occurred' });
  }
});

// Login route
app.post('/api/auth/login', [
  body('email').isEmail().withMessage('Please enter a valid email address'),
  body('password').exists().withMessage('Password is required'),
  body('role').exists().withMessage('Role is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, role } = req.body;
    console.log('Login attempt for email:', email, 'with role:', role);
    
    const user = await User.findOne({ email });

    if (!user) {
      console.log('User not found for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if the provided role matches the user's actual role
    if (user.role !== role) {
      console.log('Role mismatch. User role:', user.role, 'Attempted role:', role);
      return res.status(403).json({ 
        message: `Access denied. Please login with your assigned role as ${user.role}.`
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful for email:', email);
    res.json({ token, role: user.role, name: user.name });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// New routes for subject management
app.post('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const { title, degree, department } = req.body;

    // Validate required fields
    if (!title || !degree || !department) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const subject = new Subject({
      title,
      degree,
      department,
      creator: req.user.userId
    });

    const savedSubject = await subject.save();
    res.status(201).json(savedSubject);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ message: 'Error creating subject' });
  }
});

// Update the subjects route for students
app.get('/api/subjects/student', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const subjects = await Subject.find({ degree: user.degree, department: user.department });
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Error fetching subjects' });
  }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

app.get('/api/subjects/:role', authenticateToken, async (req, res) => {
  try {
    let subjects;
    if (req.params.role === 'teacher') {
      subjects = await Subject.find({ creator: req.user.userId });
    } else if (req.params.role === 'student') {
      subjects = await Subject.find();
    } else {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Error fetching subjects' });
  }
});

app.put('/api/subjects/:subjectId/units', authenticateToken, async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { units } = req.body;
    const subject = await Subject.findOneAndUpdate(
      { _id: subjectId, creator: req.user.userId },
      { $set: { units } },
      { new: true }
    );
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found or you do not have permission to update it' });
    }
    res.json(subject);
  } catch (error) {
    console.error('Error updating units:', error);
    res.status(500).json({ message: 'Error updating units', error: 'An unexpected error occurred' });
  }
});

// File upload route (you'll need to implement file storage, e.g., using multer)
// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

// Add this to your existing server.js
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/api/files/${req.file.filename}`;
    res.json({
      message: 'File uploaded successfully',
      url: fileUrl,
      name: req.file.originalname
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Add a route to serve files
app.get('/api/files/:filename', authenticateToken, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadDir, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

// Assignment routes
app.post('/api/assignments/:subjectId', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    const subjectId = req.params.subjectId;

    const assignment = new Assignment({
      title,
      description,
      dueDate,
      subject: subjectId,
      creator: req.user.userId,
    });

    if (req.file) {
      assignment.file = {
        name: req.file.originalname,
        url: `/api/files/${req.file.filename}`
      };
    }

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ message: 'Error creating assignment' });
  }
});

app.get('/api/assignments/:subjectId', authenticateToken, async (req, res) => {
  try {
    const assignments = await Assignment.find({ subject: req.params.subjectId });
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ message: 'Error fetching assignments' });
  }
});

app.post('/api/assignments/:assignmentId/submit', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const submission = {
      student: req.user.userId,
      file: {
        name: req.file.originalname,
        url: `/api/files/${req.file.filename}`
      }
    };

    assignment.submissions.push(submission);
    await assignment.save();

    res.status(201).json({ message: 'Assignment submitted successfully' });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({ message: 'Error submitting assignment' });
  }
});

// Routes for grade management
app.get('/api/subjects/:role', authenticateToken, async (req, res) => {
  try {
    let subjects;
    if (req.params.role === 'teacher') {
      subjects = await Subject.find({ creator: req.user.userId });
    } else if (req.params.role === 'student') {
      const grades = await Grade.find({ student: req.user.userId }).populate('subject');
      subjects = grades.map(grade => grade.subject);
    } else {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Error fetching subjects' });
  }
});

// Update the grades route

app.get('/api/students', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const students = await User.find({ role: 'student' }).select('_id name');
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Error fetching students' });
  }
});


// Route to get students for a specific subject
app.get('/api/students/:subjectId', authenticateToken, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    const students = await User.find({
      role: 'student',
      degree: subject.degree,
      department: subject.department
    }).select('_id name');

    // Fetch grades for each student
    const studentsWithGrades = await Promise.all(students.map(async (student) => {
      const grade = await Grade.findOne({ student: student._id, subject: subject._id });
      return {
        ...student.toObject(),
        grades: grade ? grade.toObject() : null
      };
    }));

    res.json(studentsWithGrades);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Error fetching students' });
  }
});

// Route to submit grades
app.post('/api/grades', authenticateToken, async (req, res) => {
  try {
    const { student, subject, cycleTest1, cycleTest2, assignments } = req.body;

    let grade = await Grade.findOne({ student, subject });
    if (grade) {
      grade.cycleTest1 = cycleTest1;
      grade.cycleTest2 = cycleTest2;
      grade.assignments = assignments;
    } else {
      grade = new Grade({
        student,
        subject,
        cycleTest1,
        cycleTest2,
        assignments
      });
    }

    await grade.save();
    res.status(201).json(grade);
  } catch (error) {
    console.error('Error submitting grades:', error);
    res.status(500).json({ message: 'Error submitting grades' });
  }
});

// Route to get grades for a student
app.get('/api/grades/:subjectId', authenticateToken, async (req, res) => {
  try {
    const grades = await Grade.find({
      student: req.user.userId,
      subject: req.params.subjectId
    }).populate('subject', 'title');
    res.json(grades);
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ message: 'Error fetching grades' });
  }
});


// Route to get subjects for a user
app.get('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    let subjects;
    if (user.role === 'teacher') {
      subjects = await Subject.find({ creator: user._id });
    } else {
      subjects = await Subject.find({ degree: user.degree, department: user.department });
    }
    res.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ message: 'Error fetching subjects' });
  }
});

// Route to get messages for a subject
app.get('/api/messages/:subjectId', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ subject: req.params.subjectId })
      .populate('sender', 'name role')
      .sort('createdAt');
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Route to post a new message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { text, subjectId } = req.body;
    const message = new Message({
      text,
      sender: req.user.userId,
      subject: subjectId,
    });
    await message.save();
    const populatedMessage = await Message.findById(message._id).populate('sender', 'name role');
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error posting message:', error);
    res.status(500).json({ message: 'Error posting message' });
  }
});

// Route to get alumni messages
app.get('/api/alumni-messages', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const messages = await AlumniMessage.find({ degree: user.degree, department: user.department })
      .populate('sender', 'name role')
      .sort('createdAt');
    res.json(messages);
  } catch (error) {
    console.error('Error fetching alumni messages:', error);
    res.status(500).json({ message: 'Error fetching alumni messages' });
  }
});

// Route to post a new alumni message
app.post('/api/alumni-messages', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const user = await User.findById(req.user.userId);
    const message = new AlumniMessage({
      text,
      sender: req.user.userId,
      degree: user.degree,
      department: user.department,
    });
    await message.save();
    const populatedMessage = await AlumniMessage.findById(message._id).populate('sender', 'name role');
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error posting alumni message:', error);
    res.status(500).json({ message: 'Error posting alumni message' });
  }
});

// Fetch all calendar entries
app.get('/api/academic-calendar', authenticateToken, async (req, res) => {
  try {
    const entries = await AcademicCalendar.find();
    res.json(entries);
  } catch (error) {
    console.error('Error fetching calendar entries:', error);
    res.status(500).json({ message: 'Error fetching calendar entries' });
  }
});

// Add a new calendar entry
app.post('/api/academic-calendar', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const newEntry = new AcademicCalendar(req.body);
    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (error) {
    console.error('Error adding calendar entry:', error);
    res.status(500).json({ message: 'Error adding calendar entry' });
  }
});

// Update a specific calendar entry
app.put('/api/academic-calendar/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const updatedEntry = await AcademicCalendar.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedEntry) {
      return res.status(404).json({ message: 'Calendar entry not found' });
    }
    res.json(updatedEntry);
  } catch (error) {
    console.error('Error updating calendar entry:', error);
    res.status(500).json({ message: 'Error updating calendar entry' });
  }
});

// Remove a specific calendar entry
app.delete('/api/academic-calendar/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const deletedEntry = await AcademicCalendar.findByIdAndDelete(req.params.id);
    if (!deletedEntry) {
      return res.status(404).json({ message: 'Calendar entry not found' });
    }
    res.json({ message: 'Calendar entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting calendar entry:', error);
    res.status(500).json({ message: 'Error deleting calendar entry' });
  }
});

app.post('/api/academic-calendar/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    let calendarData;
    try {
      calendarData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({ message: 'Invalid JSON file' });
    }

    // Validate and format dates
    calendarData = calendarData.map(entry => {
      const [day, month, year] = entry.date.split('.');
      const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      return {
        ...entry,
        date: formattedDate
      };
    });

    await AcademicCalendar.deleteMany({});
    const newEntries = await AcademicCalendar.insertMany(calendarData);

    res.status(201).json(newEntries);
  } catch (error) {
    console.error('Error uploading calendar:', error);
    res.status(500).json({ message: 'Error uploading calendar', error: error.message });
  } finally {
    if (req.file) {
      fs.unlinkSync(req.file.path); 
    }
  }
});

// Task routes
app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { text, category, priority, dueDate } = req.body;
    const task = new Task({
      text,
      category,
      priority,
      dueDate,
      creator: req.user.userId
    });
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Error creating task' });
  }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ creator: req.user.userId });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

app.put('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, creator: req.user.userId },
      req.body,
      { new: true }
    );
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Error updating task' });
  }
});

app.delete('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.taskId,
      creator: req.user.userId
    });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Error deleting task' });
  }
});

// Notification check endpoint
app.get('/api/tasks/check-deadlines', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const tasks = await Task.find({
      creator: req.user.userId,
      completed: false,
      notificationSent: false,
      dueDate: { $gt: now, $lt: oneDayFromNow }
    });
    
    await Task.updateMany(
      { _id: { $in: tasks.map(task => task._id) } },
      { notificationSent: true }
    );
    
    res.json(tasks);
  } catch (error) {
    console.error('Error checking deadlines:', error);
    res.status(500).json({ message: 'Error checking deadlines' });
  }
});


// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
