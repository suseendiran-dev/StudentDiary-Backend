const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

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

// Sample data
const sampleUsers = [
  {
    email: 'teacher1@example.com',
    password: 'password123',
    role: 'teacher',
    name: 'Rajesh Kumar',
    additionalInfo: 'Professor of Computer Science',
    degree: 'MCA',
    department: 'Computer Science'
  },
  {
    email: 'teacher2@example.com',
    password: 'password123',
    role: 'teacher',
    name: 'Priya Sharma',
    additionalInfo: 'Assistant Professor of Mathematics',
    degree: 'MSc',
    department: 'Maths'
  },
  {
    email: 'student1@example.com',
    password: 'password123',
    role: 'student',
    name: 'Arun Patel',
    additionalInfo: 'Enrolled in 2023',
    degree: 'BCA',
    department: 'Computer Science'
  },
  {
    email: 'student2@example.com',
    password: 'password123',
    role: 'student',
    name: 'Sneha Reddy',
    additionalInfo: 'Enrolled in 2023',
    degree: 'BCA',
    department: 'Computer Science'
  },
  {
    email: 'student3@example.com',
    password: 'password123',
    role: 'student',
    name: 'Karthik Nair',
    additionalInfo: 'Enrolled in 2023',
    degree: 'BSc',
    department: 'Maths'
  },
  {
    email: 'alumni1@example.com',
    password: 'password123',
    role: 'alumni',
    name: 'Vikram Singh',
    additionalInfo: 'Graduated in 2020, Software Engineer at Google',
    degree: 'MCA',
    department: 'Computer Science'
  },
  {
    email: 'alumni2@example.com',
    password: 'password123',
    role: 'alumni',
    name: 'Anjali Gupta',
    additionalInfo: 'Graduated in 2019, Data Scientist at Amazon',
    degree: 'MSc',
    department: 'Maths'
  }
];

const sampleSubjects = [
  {
    title: 'Data Structures and Algorithms',
    degree: 'BCA',
    department: 'Computer Science',
    units: [
      {
        title: 'Introduction to Data Structures',
        sections: [
          {
            title: 'Arrays and Linked Lists',
            content: 'Arrays are fixed-size data structures, while linked lists are dynamic. Arrays provide O(1) access time but fixed size, whereas linked lists allow dynamic sizing but O(n) access time.',
            files: []
          },
          {
            title: 'Stacks and Queues',
            content: 'Stacks follow LIFO principle, queues follow FIFO. Both are fundamental data structures used in various algorithms.',
            files: []
          }
        ]
      },
      {
        title: 'Advanced Algorithms',
        sections: [
          {
            title: 'Sorting Algorithms',
            content: 'Common sorting algorithms include QuickSort, MergeSort, BubbleSort, etc. Each has different time and space complexities.',
            files: []
          },
          {
            title: 'Graph Algorithms',
            content: 'Graph traversal algorithms like DFS and BFS, shortest path algorithms like Dijkstra and Bellman-Ford.',
            files: []
          }
        ]
      }
    ]
  },
  {
    title: 'Calculus and Differential Equations',
    degree: 'BSc',
    department: 'Maths',
    units: [
      {
        title: 'Limits and Continuity',
        sections: [
          {
            title: 'Introduction to Limits',
            content: 'Limits describe the behavior of a function as its input approaches a certain value.',
            files: []
          },
          {
            title: 'Continuity',
            content: 'A function is continuous if it is defined at a point and its limit equals the function value at that point.',
            files: []
          }
        ]
      },
      {
        title: 'Differential Equations',
        sections: [
          {
            title: 'First Order DE',
            content: 'First order differential equations can be solved using various methods like separation of variables.',
            files: []
          },
          {
            title: 'Second Order DE',
            content: 'Second order differential equations are more complex and may require different solution techniques.',
            files: []
          }
        ]
      }
    ]
  }
];

const sampleAcademicCalendar = [
  { day: 'Monday', date: '2025-10-28', description: 'First day of semester' },
  { day: 'Tuesday', date: '2025-10-29', description: 'Orientation program' },
  { day: 'Wednesday', date: '2025-10-30', description: 'Classes begin' },
  { day: 'Thursday', date: '2025-10-31', description: 'Library orientation' },
  { day: 'Friday', date: '2025-11-01', description: 'Sports day' },
  { day: 'Monday', date: '2025-11-04', description: 'Mid-term exam preparation' },
  { day: 'Tuesday', date: '2025-11-05', description: 'Guest lecture on AI' },
  { day: 'Wednesday', date: '2025-11-06', description: 'Project submission deadline' },
  { day: 'Thursday', date: '2025-11-07', description: 'Cultural fest' },
  { day: 'Friday', date: '2025-11-08', description: 'Holiday' }
];

const sampleTasks = [
  {
    text: 'Complete DSA assignment',
    category: 'Academic',
    priority: 'High',
    dueDate: new Date('2025-11-15'),
    completed: false
  },
  {
    text: 'Prepare for mid-term exams',
    category: 'Academic',
    priority: 'High',
    dueDate: new Date('2025-11-20'),
    completed: false
  },
  {
    text: 'Submit project report',
    category: 'Academic',
    priority: 'Medium',
    dueDate: new Date('2025-11-10'),
    completed: true
  },
  {
    text: 'Attend career counseling session',
    category: 'Career',
    priority: 'Low',
    dueDate: new Date('2025-11-25'),
    completed: false
  },
  {
    text: 'Update resume',
    category: 'Career',
    priority: 'Medium',
    dueDate: new Date('2025-12-01'),
    completed: false
  }
];

// Seeder function
const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Subject.deleteMany({});
    await Assignment.deleteMany({});
    await Grade.deleteMany({});
    await Message.deleteMany({});
    await AlumniMessage.deleteMany({});
    await AcademicCalendar.deleteMany({});
    await Task.deleteMany({});

    console.log('Existing data cleared');

    // Hash passwords and create users
    const hashedUsers = await Promise.all(
      sampleUsers.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10)
      }))
    );

    const createdUsers = await User.insertMany(hashedUsers);
    console.log('Users seeded');

    // Create subjects with creator references
    const teacher1 = createdUsers.find(u => u.email === 'teacher1@example.com');
    const teacher2 = createdUsers.find(u => u.email === 'teacher2@example.com');

    const subjectsWithCreators = sampleSubjects.map((subject, index) => ({
      ...subject,
      creator: index === 0 ? teacher1._id : teacher2._id
    }));

    const createdSubjects = await Subject.insertMany(subjectsWithCreators);
    console.log('Subjects seeded');

    // Create assignments
    const assignments = [
      {
        title: 'Implement Stack using Arrays',
        description: 'Write a program to implement stack operations using arrays in C++',
        dueDate: new Date('2025-11-15'),
        subject: createdSubjects[0]._id,
        creator: teacher1._id
      },
      {
        title: 'Graph Traversal Problem',
        description: 'Solve the shortest path problem using Dijkstra\'s algorithm',
        dueDate: new Date('2025-11-20'),
        subject: createdSubjects[0]._id,
        creator: teacher1._id
      },
      {
        title: 'Differential Equations Assignment',
        description: 'Solve the given system of differential equations',
        dueDate: new Date('2025-11-18'),
        subject: createdSubjects[1]._id,
        creator: teacher2._id
      }
    ];

    const createdAssignments = await Assignment.insertMany(assignments);
    console.log('Assignments seeded');

    // Create grades
    const students = createdUsers.filter(u => u.role === 'student');
    const grades = [];

    students.forEach(student => {
      createdSubjects.forEach(subject => {
        grades.push({
          student: student._id,
          subject: subject._id,
          cycleTest1: Math.floor(Math.random() * 20) + 5, // Random score between 5-25
          cycleTest2: Math.floor(Math.random() * 20) + 5,
          assignments: Math.floor(Math.random() * 10) + 5  // Random score between 5-15
        });
      });
    });

    await Grade.insertMany(grades);
    console.log('Grades seeded');

    // Create messages
    const messages = [
      {
        text: 'Welcome to the Data Structures class! Please check the syllabus.',
        sender: teacher1._id,
        subject: createdSubjects[0]._id
      },
      {
        text: 'When is the next assignment due?',
        sender: students[0]._id,
        subject: createdSubjects[0]._id
      },
      {
        text: 'The assignment is due next Friday. Good luck!',
        sender: teacher1._id,
        subject: createdSubjects[0]._id
      },
      {
        text: 'Can you explain the concept of limits again?',
        sender: students[2]._id,
        subject: createdSubjects[1]._id
      },
      {
        text: 'Sure, I\'ll schedule a doubt clearing session tomorrow.',
        sender: teacher2._id,
        subject: createdSubjects[1]._id
      }
    ];

    await Message.insertMany(messages);
    console.log('Messages seeded');

    // Create alumni messages
    const alumni = createdUsers.filter(u => u.role === 'alumni');
    const alumniMessages = [
      {
        text: 'Hi everyone! I\'m working at Google now. The skills I learned here really helped.',
        sender: alumni[0]._id,
        degree: 'MCA',
        department: 'Computer Science'
      },
      {
        text: 'Great to hear from you! What advice would you give to current students?',
        sender: students[0]._id,
        degree: 'BCA',
        department: 'Computer Science'
      },
      {
        text: 'Focus on building projects and gaining practical experience. Theory is important but practice makes perfect.',
        sender: alumni[0]._id,
        degree: 'MCA',
        department: 'Computer Science'
      },
      {
        text: 'Hello Math alumni! I\'m doing data science at Amazon. Mathematics is everywhere in tech!',
        sender: alumni[1]._id,
        degree: 'MSc',
        department: 'Maths'
      }
    ];

    await AlumniMessage.insertMany(alumniMessages);
    console.log('Alumni messages seeded');

    // Create academic calendar
    await AcademicCalendar.insertMany(sampleAcademicCalendar);
    console.log('Academic calendar seeded');

    // Create tasks with creator references
    const tasksWithCreators = sampleTasks.map(task => ({
      ...task,
      creator: students[0]._id // Assign tasks to first student
    }));

    await Task.insertMany(tasksWithCreators);
    console.log('Tasks seeded');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run seeder
connectDB().then(() => {
  seedDatabase();
});