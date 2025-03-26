const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

const userSchema = new mongoose.Schema({
  patientId: { type: String, unique: true, required: true },
  username: String,
  password: String,
  role: String,
  age: Number,
  predictions: Object,
  messages: Array,
});
const User = mongoose.model("User", userSchema);

app.use(cors());
app.use(express.json());

const options = {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user
app.post("/create_user", async (req, res) => {
  try {
    const { username, password, role, age, patientId } = req.body;
    if (!username || !password || !role || !age || !patientId)
      return res.status(400).json({ error: "Missing values" });

    const existingUser = await User.findOne({ patientId });
    if (existingUser) return res.status(400).json({ error: "patientId already exists" });

    const newUser = new User({
      patientId,
      username,
      password,
      role,
      age,
      predictions: {},
      messages: [{
        role: "admin",
        text: "Hi! You Can chat with Doctor",
        time: new Intl.DateTimeFormat("en-IN", options).format(new Date()),
      }],
    });
    await newUser.save();
    res.status(201).json({ message: "User created successfully", user_id: newUser._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login user
app.post("/login", async (req, res) => {
  try {
    const { patientId, password } = req.body;
    if (!patientId || !password) return res.status(400).json({ error: "Missing username or password" });

    const user = await User.findOne({ patientId });
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid credentials" });

    res.status(200).json({ message: "Login successful", user, user_id: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("New user connected");

  socket.on("joinRoom", async (UserId) => {
    socket.join(UserId);
    console.log(`User joined room: ${UserId}`);
    try {
      const user = await User.findById(UserId);
      socket.emit("Joined", user ? user.messages : []);
    } catch (error) {
      console.error("Error fetching user messages:", error);
    }
  });

  socket.on("sendMessage", async ({ UserId, role, text, review = null, report = null }) => {
    try {
      const user = await User.findById(UserId);
      if (!user) return;

      let newMessage = review
        ? { role: "system", review, report, time: new Intl.DateTimeFormat("en-IN", options).format(new Date()) }
        : { role, text, time: new Intl.DateTimeFormat("en-IN", options).format(new Date()) };
      
      user.messages.push(newMessage);
      if (review) user.predictions = newMessage;
      await user.save();

      io.to(UserId).emit("receiveMessage", newMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
