require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const crypto = require("crypto");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// MongoDB Connection
mongoose
  .connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/campus_lost_found",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Models
const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (v) {
        return /^(\d{10}@student\.bup\.edu\.bd|.+@bup\.edu\.bd)$/.test(v);
      },
      message: (props) => `${props.value} is not a valid university email!`,
    },
  },
  phone: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^01\d{9}$/.test(v);
      },
      message: (props) =>
        `${props.value} is not a valid Bangladeshi phone number!`,
    },
  },
  department: { type: String, required: true },
  password: { type: String, required: true },
  idCardImage: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  profileImage: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const ItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  image: { type: String },
  type: { type: String, enum: ["lost", "found"], required: true },
  validityQuestion: { type: String },
  validityAnswer: { type: String },
  status: {
    type: String,
    enum: ["active", "claimed", "accepted", "rejected"],
    default: "active",
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const CommentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  item: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const MessageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const SuggestionSchema = new mongoose.Schema({
  content: { type: String, required: true },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Item = mongoose.model("Item", ItemSchema);
const Comment = mongoose.model("Comment", CommentSchema);
const Message = mongoose.model("Message", MessageSchema);
const Suggestion = mongoose.model("Suggestion", SuggestionSchema);

// Helper Functions
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "your_jwt_secret", {
    expiresIn: "30d",
  });
};

const authenticate = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized to access this route" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your_jwt_secret"
    );
    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "No user found with this id" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized to access this route" });
  }
};

// Routes

// Auth Routes
app.post(
  "/api/auth/register",
  upload.single("idCardImage"),
  async (req, res) => {
    try {
      const { firstName, lastName, email, phone, department, password } =
        req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ success: false, message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate OTP
      const otp = generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Create new user
      const user = new User({
        firstName,
        lastName,
        email,
        phone,
        department,
        password: hashedPassword,
        idCardImage: req.file ? req.file.path : "",
        profileImage: "",
        otp,
        otpExpires,
      });

      await user.save();

      // Log OTP to console immediately
      console.log(`OTP for ${email}: ${otp}`);

      res.status(201).json({
        success: true,
        message: "User registered successfully. Please verify your email.",
        userId: user._id,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

app.post("/api/auth/verify", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ success: false, message: "User already verified" });
    }

    if (user.otp !== otp || new Date() > user.otpExpires) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/auth/resend-otp", async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Log OTP to console immediately
    console.log(`New OTP for ${user.email}: ${otp}`);

    res.status(200).json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.isVerified) {
      return res
        .status(401)
        .json({ success: false, message: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Generate OTP for login
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Log OTP to console immediately
    console.log(`Login OTP for ${email}: ${otp}`);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      userId: user._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/auth/verify-login", async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.otp !== otp || new Date() > user.otpExpires) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        department: user.department,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Log OTP to console immediately
    console.log(`Password reset OTP for ${email}: ${otp}`);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
      userId: user._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { userId, otp, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.otp !== otp || new Date() > user.otpExpires) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// User Routes
app.get("/api/users/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -otp -otpExpires"
    );
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put(
  "/api/users/me",
  authenticate,
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const { firstName, lastName, phone, department, currentPassword } =
        req.body;

      const user = await User.findById(req.user._id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Current password is incorrect" });
      }

      // Update user details
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.phone = phone || user.phone;
      user.department = department || user.department;

      if (req.file) {
        // Delete old profile image if it exists and is not the same as ID card image
        if (user.profileImage && user.profileImage !== user.idCardImage) {
          fs.unlinkSync(path.join(__dirname, user.profileImage));
        }
        user.profileImage = req.file.path;
      }

      await user.save();

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          department: user.department,
          profileImage: user.profileImage,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

app.put("/api/users/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Item Routes
app.post(
  "/api/items",
  authenticate,
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        location,
        type,
        validityQuestion,
        validityAnswer,
      } = req.body;

      const item = new Item({
        title,
        description,
        location,
        image: req.file ? req.file.path : null,
        type,
        validityQuestion,
        validityAnswer,
        postedBy: req.user._id,
      });

      await item.save();

      res.status(201).json({ success: true, item });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

app.get("/api/items", authenticate, async (req, res) => {
  try {
    const { type, search, postedBy, claimedBy, status } = req.query;

    let query = {};
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    if (postedBy === "me") {
      query.postedBy = req.user._id;
    }
    if (claimedBy === "me") {
      query.claimedBy = req.user._id;
    }
    if (status) {
      query.status = status;
    }

    const items = await Item.find(query)
      .populate("postedBy", "firstName lastName department profileImage")
      .populate("claimedBy", "firstName lastName department profileImage")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/items/:id", authenticate, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate("postedBy", "firstName lastName department profileImage")
      .populate("claimedBy", "firstName lastName department profileImage");

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Only show validity answer to the item owner or the claimant
    if (
      item.postedBy._id.toString() !== req.user._id.toString() &&
      (!item.claimedBy ||
        item.claimedBy._id.toString() !== req.user._id.toString())
    ) {
      item.validityAnswer = undefined;
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put(
  "/api/items/:id",
  authenticate,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, description, location, validityQuestion, validityAnswer } =
        req.body;

      const item = await Item.findById(req.params.id);
      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }

      // Check if the user is the owner of the item
      if (item.postedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this item",
        });
      }

      // Update item details
      item.title = title || item.title;
      item.description = description || item.description;
      item.location = location || item.location;
      item.validityQuestion = validityQuestion || item.validityQuestion;
      item.validityAnswer = validityAnswer || item.validityAnswer;

      if (req.file) {
        // Delete old image if exists
        if (item.image) {
          fs.unlinkSync(path.join(__dirname, item.image));
        }
        item.image = req.file.path;
      }

      item.updatedAt = Date.now();
      await item.save();

      res.status(200).json({ success: true, item });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

app.delete("/api/items/:id", authenticate, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Check if the user is the owner of the item
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this item",
      });
    }

    // Delete image if exists
    if (item.image) {
      fs.unlinkSync(path.join(__dirname, item.image));
    }

    // Delete all comments associated with this item
    await Comment.deleteMany({ item: item._id });

    await item.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/items/:id/claim", authenticate, async (req, res) => {
  try {
    const { validityAnswer } = req.body;

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Check if the item is already claimed or accepted
    if (item.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Item is already claimed by another user",
      });
    }

    // Check if the user is the owner of the item
    if (item.postedBy.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot claim your own item" });
    }

    // For found items, verify validity answer
    if (item.type === "found") {
      if (!validityAnswer) {
        return res.status(400).json({
          success: false,
          message: "Please provide an answer to the validity question",
          validityQuestion: item.validityQuestion,
        });
      }

      if (item.validityAnswer !== validityAnswer) {
        return res.status(400).json({
          success: false,
          message: "Invalid answer to the validity question",
          validityQuestion: item.validityQuestion,
        });
      }
    }

    item.status = "claimed";
    item.claimedBy = req.user._id;
    await item.save();

    // Create a notification message for the item owner
    const message = new Message({
      content: `${req.user.firstName} ${req.user.lastName} has claimed your ${item.type} item "${item.title}". Please review the claim.`,
      sender: req.user._id,
      receiver: item.postedBy,
    });
    await message.save();

    res
      .status(200)
      .json({ success: true, message: "Item claimed successfully", item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/items/:id/accept-claim", authenticate, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Check if the user is the owner of the item
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to accept this claim",
      });
    }

    // Check if the item is claimed
    if (item.status !== "claimed") {
      return res
        .status(400)
        .json({ success: false, message: "Item is not claimed" });
    }

    item.status = "accepted";
    await item.save();

    // Create a notification message for the claimant
    const message = new Message({
      content: `Your claim for the ${item.type} item "${item.title}" has been accepted. Please contact the owner to retrieve your item.`,
      sender: req.user._id,
      receiver: item.claimedBy,
    });
    await message.save();

    res
      .status(200)
      .json({ success: true, message: "Claim accepted successfully", item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/items/:id/reject-claim", authenticate, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Check if the user is the owner of the item
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reject this claim",
      });
    }

    // Check if the item is claimed
    if (item.status !== "claimed") {
      return res
        .status(400)
        .json({ success: false, message: "Item is not claimed" });
    }

    const claimantId = item.claimedBy;
    item.status = "active";
    item.claimedBy = undefined;
    await item.save();

    // Create a notification message for the claimant
    const message = new Message({
      content: `Your claim for the ${item.type} item "${item.title}" has been rejected.`,
      sender: req.user._id,
      receiver: claimantId,
    });
    await message.save();

    res
      .status(200)
      .json({ success: true, message: "Claim rejected successfully", item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Comment Routes
app.post("/api/items/:id/comments", authenticate, async (req, res) => {
  try {
    const { content } = req.body;

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const comment = new Comment({
      content,
      postedBy: req.user._id,
      item: item._id,
    });

    await comment.save();

    res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/items/:id/comments", authenticate, async (req, res) => {
  try {
    const comments = await Comment.find({ item: req.params.id })
      .populate("postedBy", "firstName lastName department profileImage")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/comments", authenticate, async (req, res) => {
  try {
    const { postedBy } = req.query;
    let query = {};

    if (postedBy === "me") {
      query.postedBy = req.user._id;
    }

    const comments = await Comment.find(query)
      .populate("postedBy", "firstName lastName department profileImage")
      .populate("item", "title")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/comments/:id", authenticate, async (req, res) => {
  try {
    const { content } = req.body;

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    // Check if the user is the owner of the comment
    if (comment.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this comment",
      });
    }

    comment.content = content || comment.content;
    comment.updatedAt = Date.now();
    await comment.save();

    res.status(200).json({ success: true, comment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/comments/:id", authenticate, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    // Check if the user is the owner of the comment or the item owner
    const item = await Item.findById(comment.item);
    if (
      comment.postedBy.toString() !== req.user._id.toString() &&
      (!item || item.postedBy.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this comment",
      });
    }

    await comment.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Message Routes
app.post("/api/messages", authenticate, async (req, res) => {
  try {
    const { receiver, content } = req.body;

    // Check if receiver exists
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res
        .status(404)
        .json({ success: false, message: "Receiver not found" });
    }

    const message = new Message({
      content,
      sender: req.user._id,
      receiver,
    });

    await message.save();

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/messages", authenticate, async (req, res) => {
  try {
    const { userId } = req.query;

    let query;
    if (userId) {
      // Get messages between current user and specified user
      query = {
        $or: [
          { sender: req.user._id, receiver: userId },
          { sender: userId, receiver: req.user._id },
        ],
      };
    } else {
      // Get all messages for current user
      query = {
        $or: [{ sender: req.user._id }, { receiver: req.user._id }],
      };
    }

    const messages = await Message.find(query)
      .populate("sender", "firstName lastName department profileImage")
      .populate("receiver", "firstName lastName department profileImage")
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Suggestion Routes
app.post("/api/suggestions", authenticate, async (req, res) => {
  try {
    const { content } = req.body;

    const suggestion = new Suggestion({
      content,
      postedBy: req.user._id,
    });

    await suggestion.save();

    res.status(201).json({ success: true, suggestion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/suggestions", authenticate, async (req, res) => {
  try {
    const { postedBy } = req.query;
    let query = {};

    if (postedBy === "me") {
      query.postedBy = req.user._id;
    }

    const suggestions = await Suggestion.find(query)
      .populate("postedBy", "firstName lastName department")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, suggestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/suggestions/:id", authenticate, async (req, res) => {
  try {
    const { content } = req.body;

    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res
        .status(404)
        .json({ success: false, message: "Suggestion not found" });
    }

    // Check if the user is the owner of the suggestion
    if (suggestion.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this suggestion",
      });
    }

    suggestion.content = content || suggestion.content;
    await suggestion.save();

    res.status(200).json({ success: true, suggestion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/suggestions/:id", authenticate, async (req, res) => {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res
        .status(404)
        .json({ success: false, message: "Suggestion not found" });
    }

    // Check if the user is the owner of the suggestion
    if (suggestion.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this suggestion",
      });
    }

    await suggestion.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Suggestion deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Stats Routes
app.get("/api/stats", authenticate, async (req, res) => {
  try {
    const lostCount = await Item.countDocuments({
      type: "lost",
      status: "active",
    });
    const foundCount = await Item.countDocuments({
      type: "found",
      status: "active",
    });
    const claimedCount = await Item.countDocuments({ status: "accepted" });

    res.status(200).json({
      success: true,
      stats: {
        lostCount,
        foundCount,
        claimedCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
