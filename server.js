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
//const mongoURI =
//process.env.MONGO_URL || "mongodb://mongo:27017/campus_lost_found";

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
  isBlocked: { type: Boolean, default: false },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

const ValidityQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
});

const ClaimRequestSchema = new mongoose.Schema({
  answers: [{ type: String }],
  additionalInfo: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reviewedAt: { type: Date },
  rejectionReason: { type: String },
  contactInfo: {
    phone: { type: String },
    alternatePhone: { type: String },
    email: { type: String },
    meetingLocation: { type: String },
    meetingTime: { type: String },
    additionalNotes: { type: String },
  },
});

const InformRequestSchema = new mongoose.Schema({
  message: { type: String, required: true },
  image: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  informedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reviewedAt: { type: Date },
  rejectionReason: { type: String },
  contactInfo: {
    phone: { type: String },
    alternatePhone: { type: String },
    email: { type: String },
    meetingLocation: { type: String },
    meetingTime: { type: String },
    additionalNotes: { type: String },
  },
});

const ItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  image: { type: String },
  type: { type: String, enum: ["lost", "found"], required: true },
  validityQuestions: [ValidityQuestionSchema],
  claimRequests: [ClaimRequestSchema],
  informRequests: [InformRequestSchema],
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
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  tags: [{ type: String }],
  viewCount: { type: Number, default: 0 },
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
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
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
  messageType: {
    type: String,
    enum: ["text", "system", "contact_share"],
    default: "text",
  },
  attachments: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

const SuggestionSchema = new mongoose.Schema({
  content: { type: String, required: true },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  category: {
    type: String,
    enum: ["feature", "bug", "improvement", "other"],
    default: "other",
  },
  status: {
    type: String,
    enum: ["pending", "reviewed", "implemented", "rejected"],
    default: "pending",
  },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  adminResponse: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const ReportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    enum: ["user", "item", "comment", "message"],
    required: true,
  },
  reportedEntity: { type: mongoose.Schema.Types.ObjectId, required: true },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reason: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ["pending", "reviewed", "resolved", "dismissed"],
    default: "pending",
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  reviewedAt: { type: Date },
  actionTaken: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      "user_registered",
      "message_received",
      "claim_request_submitted",
      "claim_request_approved",
      "claim_request_rejected",
      "inform_request_submitted",
      "inform_request_approved",
      "inform_request_rejected",
      "item_posted",
      "item_claimed",
      "comment_added",
      "system",
      "reminder",
    ],
    required: true,
  },
  relatedEntity: { type: mongoose.Schema.Types.ObjectId },
  read: { type: Boolean, default: false },
  actionRequired: { type: Boolean, default: false },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Item = mongoose.model("Item", ItemSchema);
const Comment = mongoose.model("Comment", CommentSchema);
const Message = mongoose.model("Message", MessageSchema);
const Suggestion = mongoose.model("Suggestion", SuggestionSchema);
const Report = mongoose.model("Report", ReportSchema);
const Notification = mongoose.model("Notification", NotificationSchema);

// Helper Functions
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "your_jwt_secret", {
    expiresIn: "30d",
  });
};

// NEW: Notification Helper Function
const createNotification = async (
  recipient,
  title,
  message,
  type,
  relatedEntity = null,
  actionRequired = false
) => {
  try {
    const notification = new Notification({
      recipient,
      title,
      message,
      type,
      relatedEntity,
      actionRequired,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

// NEW: Enhanced OTP Verification Function
const verifyOTP = (inputOTP, storedOTP, otpExpires) => {
  // Check for master OTP if enabled
  if (process.env.OTP_DEFAULT === "TRUE" && inputOTP === "123456") {
    return true;
  }

  // Check regular OTP
  return storedOTP === inputOTP && new Date() <= otpExpires;
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

      // Create new user with idCardImage as initial profileImage
      const user = new User({
        firstName,
        lastName,
        email,
        phone,
        department,
        password: hashedPassword,
        idCardImage: req.file ? req.file.filename : "",
        profileImage: req.file ? req.file.filename : "",
        otp,
        otpExpires,
      });

      await user.save();

      // Log OTP to console immediately
      console.log(`OTP for ${email}: ${otp}`);

      // NEW: Create notification for user registration
      await createNotification(
        user._id,
        "Welcome to Campus Lost & Found!",
        `Welcome ${firstName}! Please verify your email to complete registration.`,
        "user_registered",
        user._id,
        true
      );

      res.status(201).json({
        success: true,
        message: "User registered successfully. Please verify your email.",
        userId: user._id,
        profileImage: user.profileImage
          ? `/uploads/${user.profileImage}`
          : `/uploads/${user.idCardImage}`,
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

    // NEW: Use enhanced OTP verification
    if (!verifyOTP(otp, user.otp, user.otpExpires)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(user._id);

    // NEW: Create notification for successful verification
    await createNotification(
      user._id,
      "Email Verified Successfully!",
      "Your email has been verified. You can now use all features of Campus Lost & Found.",
      "system",
      user._id
    );

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        department: user.department,
        profileImage: user.profileImage
          ? `/uploads/${user.profileImage}`
          : `/uploads/${user.idCardImage}`,
      },
    });
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
      profileImage: user.profileImage
        ? `/uploads/${user.profileImage}`
        : `/uploads/${user.idCardImage}`,
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

    // NEW: Use enhanced OTP verification
    if (!verifyOTP(otp, user.otp, user.otpExpires)) {
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
        profileImage: user.profileImage
          ? `/uploads/${user.profileImage}`
          : `/uploads/${user.idCardImage}`,
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

    // NEW: Use enhanced OTP verification
    if (!verifyOTP(otp, user.otp, user.otpExpires)) {
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

    // NEW: Create notification for password reset
    await createNotification(
      user._id,
      "Password Reset Successful",
      "Your password has been reset successfully. If this wasn't you, please contact support immediately.",
      "system",
      user._id
    );

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

    // Add full URL for profile image if it exists
    const userObj = user.toObject();
    if (userObj.profileImage) {
      userObj.profileImage = `/uploads/${userObj.profileImage}`;
    } else if (userObj.idCardImage) {
      userObj.profileImage = `/uploads/${userObj.idCardImage}`;
    }
    if (userObj.idCardImage) {
      userObj.idCardImage = `/uploads/${userObj.idCardImage}`;
    }

    res.status(200).json({ success: true, user: userObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Get total number of users endpoint
app.get("/api/users/total-count", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();

    res.status(200).json({
      success: true,
      totalUsers,
      message: `Total registered users: ${totalUsers}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/users/:id/profile-image", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Use idCardImage if profileImage is empty
    const imageName = user.profileImage || user.idCardImage;
    if (!imageName) {
      return res
        .status(404)
        .json({ success: false, message: "Profile image not found" });
    }

    const imagePath = path.join(__dirname, "uploads", imageName);

    // Check if file exists
    if (fs.existsSync(imagePath)) {
      return res.sendFile(imagePath);
    } else {
      return res
        .status(404)
        .json({ success: false, message: "Image file not found" });
    }
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
        // Delete old profile image if it exists and is different from idCardImage
        if (user.profileImage && user.profileImage !== user.idCardImage) {
          const oldImagePath = path.join(
            __dirname,
            "uploads",
            user.profileImage
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        user.profileImage = req.file.filename;
      }

      await user.save();

      // NEW: Create notification for profile update
      await createNotification(
        user._id,
        "Profile Updated",
        "Your profile has been updated successfully.",
        "system",
        user._id
      );

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
          profileImage: user.profileImage
            ? `/uploads/${user.profileImage}`
            : `/uploads/${user.idCardImage}`,
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

    // NEW: Create notification for password change
    await createNotification(
      user._id,
      "Password Changed",
      "Your password has been changed successfully. If this wasn't you, please contact support immediately.",
      "system",
      user._id
    );

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
      const { title, description, location, type, validityQuestions } =
        req.body;

      // Parse validityQuestions if it's a string
      let questions = [];
      if (validityQuestions && type === "found") {
        try {
          questions =
            typeof validityQuestions === "string"
              ? JSON.parse(validityQuestions)
              : validityQuestions;
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid validity questions format",
          });
        }
      }

      const item = new Item({
        title,
        description,
        location,
        image: req.file ? req.file.filename : null,
        type,
        validityQuestions: type === "found" ? questions : [], // Only for found items
        postedBy: req.user._id,
      });

      await item.save();

      // NEW: Create notification for item posted
      await createNotification(
        req.user._id,
        `${type.charAt(0).toUpperCase() + type.slice(1)} Item Posted`,
        `Your ${type} item "${title}" has been posted successfully and is now visible to other users.`,
        "item_posted",
        item._id
      );

      res.status(201).json({
        success: true,
        item: {
          ...item.toObject(),
          image: item.image ? `/uploads/${item.image}` : null,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// UPDATED: Filter out claimed items from search results
app.get("/api/items", authenticate, async (req, res) => {
  try {
    const { type, search, postedBy, claimedBy, status, includeReunited } =
      req.query;

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

    // NEW: Exclude reunited items from general search unless specifically requested
    if (includeReunited !== "true") {
      query.status = { $ne: "claimed" };
    }

    const items = await Item.find(query)
      .populate("postedBy", "firstName lastName department profileImage")
      .populate("claimedBy", "firstName lastName department profileImage")
      .sort({ createdAt: -1 });

    // Format image URLs and hide answers for non-owners
    const formattedItems = items.map((item) => {
      const itemObj = item.toObject();
      if (itemObj.image) {
        itemObj.image = `/uploads/${itemObj.image}`;
      }

      // Format profile images
      if (itemObj.postedBy && itemObj.postedBy.profileImage) {
        itemObj.postedBy.profileImage = `/uploads/${itemObj.postedBy.profileImage}`;
      }
      if (itemObj.claimedBy && itemObj.claimedBy.profileImage) {
        itemObj.claimedBy.profileImage = `/uploads/${itemObj.claimedBy.profileImage}`;
      }

      // Only show validity answers to the item owner or the claimant
      if (
        itemObj.postedBy._id.toString() !== req.user._id.toString() &&
        (!itemObj.claimedBy ||
          itemObj.claimedBy._id.toString() !== req.user._id.toString())
      ) {
        itemObj.validityQuestions = itemObj.validityQuestions.map((q) => ({
          question: q.question,
          answer: undefined,
        }));
      }

      return itemObj;
    });

    res.status(200).json({ success: true, items: formattedItems });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Specific endpoint for items successfully claimed by the current user
app.get("/api/items/my-claimed", authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Query for items successfully claimed by the current user
    const claimedItems = await Item.find({
      claimedBy: req.user._id,
      status: "claimed",
    })
      .populate("postedBy", "firstName lastName department profileImage")
      .populate("claimedBy", "firstName lastName department profileImage")
      .populate({
        path: "claimRequests.requestedBy",
        select: "firstName lastName department profileImage",
      })
      .populate({
        path: "informRequests.informedBy",
        select: "firstName lastName department profileImage",
      })
      .sort({ updatedAt: -1 }) // Sort by when they were claimed (updatedAt)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Item.countDocuments({
      claimedBy: req.user._id,
      status: "claimed",
    });

    // Format the items with additional claim information
    const formattedItems = claimedItems.map((item) => {
      const itemObj = item.toObject();

      // Format image URLs
      if (itemObj.image) {
        itemObj.image = `/uploads/${itemObj.image}`;
      }

      // Format profile images
      if (itemObj.postedBy && itemObj.postedBy.profileImage) {
        itemObj.postedBy.profileImage = `/uploads/${itemObj.postedBy.profileImage}`;
      }
      if (itemObj.claimedBy && itemObj.claimedBy.profileImage) {
        itemObj.claimedBy.profileImage = `/uploads/${itemObj.claimedBy.profileImage}`;
      }

      // Add claim details
      let claimDetails = {};

      if (itemObj.type === "found") {
        // For found items, find the approved claim request
        const approvedClaim = itemObj.claimRequests.find((request) => {
          const requestedById =
            request.requestedBy && request.requestedBy._id
              ? request.requestedBy._id.toString()
              : request.requestedBy.toString();
          return (
            request.status === "approved" &&
            requestedById === req.user._id.toString()
          );
        });
        if (approvedClaim) {
          claimDetails = {
            claimDate: approvedClaim.reviewedAt,
            claimType: "claim_approved",
            originalPoster: itemObj.postedBy,
            contactInfo: approvedClaim.contactInfo,
          };
        }
      } else if (itemObj.type === "lost") {
        // For lost items, find the approved inform request
        const approvedInform = itemObj.informRequests.find((request) => {
          const informedById =
            request.informedBy && request.informedBy._id
              ? request.informedBy._id.toString()
              : request.informedBy.toString();
          return (
            request.status === "approved" &&
            informedById === req.user._id.toString()
          );
        });
        if (approvedInform) {
          claimDetails = {
            claimDate: approvedInform.reviewedAt,
            claimType: "inform_approved",
            originalPoster: itemObj.postedBy,
            contactInfo: approvedInform.contactInfo,
          };
        }
      }

      // Show validity question answers since this user successfully claimed the item
      // Keep the answers visible for successfully claimed items

      return {
        ...itemObj,
        claimDetails,
      };
    });

    res.status(200).json({
      success: true,
      items: formattedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      message: `Found ${total} items successfully claimed by you`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Specific route for reunited log (all successfully reunited items in the system)
app.get("/api/items/reunited", authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Query for reunited items only (status: "claimed")
    const reunitedItems = await Item.find({ status: "claimed" })
      .populate("postedBy", "firstName lastName department profileImage")
      .populate("claimedBy", "firstName lastName department profileImage")
      .populate({
        path: "claimRequests.requestedBy",
        select: "firstName lastName department profileImage",
      })
      .populate({
        path: "informRequests.informedBy",
        select: "firstName lastName department profileImage",
      })
      .sort({ updatedAt: -1 }) // Sort by when they were reunited (updatedAt)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Item.countDocuments({ status: "claimed" });

    // Format the items with additional reunion information
    const formattedItems = reunitedItems.map((item) => {
      const itemObj = item.toObject();

      // Format image URLs
      if (itemObj.image) {
        itemObj.image = `/uploads/${itemObj.image}`;
      }

      // Format profile images
      if (itemObj.postedBy && itemObj.postedBy.profileImage) {
        itemObj.postedBy.profileImage = `/uploads/${itemObj.postedBy.profileImage}`;
      }
      if (itemObj.claimedBy && itemObj.claimedBy.profileImage) {
        itemObj.claimedBy.profileImage = `/uploads/${itemObj.claimedBy.profileImage}`;
      }

      // Add reunion details
      let reunionDetails = {};

      if (itemObj.type === "found") {
        // For found items, find the approved claim request
        const approvedClaim = itemObj.claimRequests.find(
          (request) => request.status === "approved"
        );
        if (approvedClaim) {
          reunionDetails = {
            reunionDate: approvedClaim.reviewedAt,
            reunionType: "claim_approved",
            finder: itemObj.postedBy,
            claimer: itemObj.claimedBy,
          };
        }
      } else if (itemObj.type === "lost") {
        // For lost items, find the approved inform request
        const approvedInform = itemObj.informRequests.find(
          (request) => request.status === "approved"
        );
        if (approvedInform) {
          reunionDetails = {
            reunionDate: approvedInform.reviewedAt,
            reunionType: "inform_approved",
            owner: itemObj.postedBy,
            finder: itemObj.claimedBy,
          };
        }
      }

      // Hide sensitive validity question answers for reunited items
      itemObj.validityQuestions = itemObj.validityQuestions.map((q) => ({
        question: q.question,
        answer: undefined,
      }));

      return {
        ...itemObj,
        reunionDetails,
      };
    });

    res.status(200).json({
      success: true,
      items: formattedItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
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

    // Increment view count
    item.viewCount += 1;
    await item.save();

    const itemObj = item.toObject();
    if (itemObj.image) {
      itemObj.image = `/uploads/${itemObj.image}`;
    }

    // Format profile images
    if (itemObj.postedBy && itemObj.postedBy.profileImage) {
      itemObj.postedBy.profileImage = `/uploads/${itemObj.postedBy.profileImage}`;
    }
    if (itemObj.claimedBy && itemObj.claimedBy.profileImage) {
      itemObj.claimedBy.profileImage = `/uploads/${itemObj.claimedBy.profileImage}`;
    }

    // Only show validity answers to the item owner or the claimant
    if (
      itemObj.postedBy._id.toString() !== req.user._id.toString() &&
      (!itemObj.claimedBy ||
        itemObj.claimedBy._id.toString() !== req.user._id.toString())
    ) {
      itemObj.validityQuestions = itemObj.validityQuestions.map((q) => ({
        question: q.question,
        answer: undefined,
      }));
    }

    res.status(200).json({ success: true, item: itemObj });
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
      const { title, description, location, validityQuestions } = req.body;

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

      // Parse validityQuestions if it's a string
      let questions = [];
      if (validityQuestions && item.type === "found") {
        try {
          questions =
            typeof validityQuestions === "string"
              ? JSON.parse(validityQuestions)
              : validityQuestions;
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: "Invalid validity questions format",
          });
        }
      }

      // Update item details
      item.title = title || item.title;
      item.description = description || item.description;
      item.location = location || item.location;
      if (item.type === "found") {
        item.validityQuestions =
          questions.length > 0 ? questions : item.validityQuestions;
      }

      if (req.file) {
        // Delete old image if exists
        if (item.image) {
          const oldImagePath = path.join(__dirname, "uploads", item.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        item.image = req.file.filename;
      }

      item.updatedAt = Date.now();
      await item.save();

      res.status(200).json({
        success: true,
        item: {
          ...item.toObject(),
          image: item.image ? `/uploads/${item.image}` : null,
        },
      });
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
      const imagePath = path.join(__dirname, "uploads", item.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
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

// Claim Request Routes (For Found Items) - UPDATED WITH DUPLICATE CHECK
app.post("/api/items/:id/claim-request", authenticate, async (req, res) => {
  try {
    const { answers, additionalInfo } = req.body;

    const item = await Item.findById(req.params.id).populate(
      "postedBy",
      "firstName lastName"
    );
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Check if this is a found item
    if (item.type !== "found") {
      return res.status(400).json({
        success: false,
        message: "Claim requests are only for found items",
      });
    }

    // Check if the item is already claimed or accepted
    if (item.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Item is already claimed by another user",
      });
    }

    // Check if the user is the owner of the item
    if (item.postedBy._id.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot claim your own item" });
    }

    // NEW: Check if the user already has a pending claim request for this item
    const existingClaimRequest = item.claimRequests.find(
      (request) =>
        request.requestedBy.toString() === req.user._id.toString() &&
        request.status === "pending"
    );

    if (existingClaimRequest) {
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending claim request for this item. Please wait for the owner to review your request.",
        warningType: "duplicate_claim",
      });
    }

    // Check if answers are provided for all questions
    if (!answers || answers.length !== item.validityQuestions.length) {
      return res.status(400).json({
        success: false,
        message: "Please provide answers to all validity questions",
        validityQuestions: item.validityQuestions.map((q) => q.question),
      });
    }

    // Create a new claim request
    const claimRequest = {
      answers: answers || [],
      additionalInfo: additionalInfo || "",
      status: "pending",
      requestedBy: req.user._id,
    };

    item.claimRequests.push(claimRequest);
    await item.save();

    // Create a notification message for the item owner
    const message = new Message({
      content: `${req.user.firstName} ${req.user.lastName} has submitted a claim request for your ${item.type} item "${item.title}". Please review the request.`,
      sender: req.user._id,
      receiver: item.postedBy._id,
    });
    await message.save();

    // NEW: Create notification for claim request submitted
    await createNotification(
      item.postedBy._id,
      "New Claim Request",
      `${req.user.firstName} ${req.user.lastName} has submitted a claim request for your found item "${item.title}".`,
      "claim_request_submitted",
      item._id,
      true
    );

    // NEW: Create notification for claimant
    await createNotification(
      req.user._id,
      "Claim Request Submitted",
      `Your claim request for the found item "${item.title}" has been submitted successfully. You will be notified when the owner reviews your request.`,
      "claim_request_submitted",
      item._id
    );

    res.status(200).json({
      success: true,
      message: "Claim request submitted successfully",
      item: {
        ...item.toObject(),
        image: item.image ? `/uploads/${item.image}` : null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Inform Request Routes (For Lost Items) - UPDATED WITH DUPLICATE CHECK
app.post(
  "/api/items/:id/inform-request",
  authenticate,
  upload.single("image"),
  async (req, res) => {
    try {
      const { message } = req.body;

      const item = await Item.findById(req.params.id).populate(
        "postedBy",
        "firstName lastName"
      );
      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found" });
      }

      // Check if this is a lost item
      if (item.type !== "lost") {
        return res.status(400).json({
          success: false,
          message: "Inform requests are only for lost items",
        });
      }

      // Check if the item is already claimed
      if (item.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "Item is already claimed by another user",
        });
      }

      // Check if the user is the owner of the item
      if (item.postedBy._id.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "You cannot inform about your own item",
        });
      }

      // NEW: Check if the user already has a pending inform request for this item
      const existingInformRequest = item.informRequests.find(
        (request) =>
          request.informedBy.toString() === req.user._id.toString() &&
          request.status === "pending"
      );

      if (existingInformRequest) {
        return res.status(400).json({
          success: false,
          message:
            "You already have a pending inform request for this item. Please wait for the owner to review your request.",
          warningType: "duplicate_inform",
        });
      }

      if (!message) {
        return res.status(400).json({
          success: false,
          message: "Please provide a message describing the found item",
        });
      }

      // Create a new inform request
      const informRequest = {
        message: message,
        image: req.file ? req.file.filename : null,
        status: "pending",
        informedBy: req.user._id,
      };

      item.informRequests.push(informRequest);
      await item.save();

      // Create a notification message for the item owner
      const notificationMessage = new Message({
        content: `${req.user.firstName} ${req.user.lastName} has informed you about finding your lost item "${item.title}". Please review their message and image if provided.`,
        sender: req.user._id,
        receiver: item.postedBy._id,
      });
      await notificationMessage.save();

      // NEW: Create notification for inform request submitted
      await createNotification(
        item.postedBy._id,
        "Someone Found Your Item!",
        `${req.user.firstName} ${req.user.lastName} has informed you about finding your lost item "${item.title}".`,
        "inform_request_submitted",
        item._id,
        true
      );

      // NEW: Create notification for informer
      await createNotification(
        req.user._id,
        "Inform Request Submitted",
        `Your inform request for the lost item "${item.title}" has been submitted successfully. You will be notified when the owner reviews your request.`,
        "inform_request_submitted",
        item._id
      );

      res.status(200).json({
        success: true,
        message: "Inform request submitted successfully",
        item: {
          ...item.toObject(),
          image: item.image ? `/uploads/${item.image}` : null,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

app.get("/api/items/:id/claim-requests", authenticate, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate(
        "claimRequests.requestedBy",
        "firstName lastName department profileImage"
      )
      .populate(
        "claimRequests.reviewedBy",
        "firstName lastName department profileImage"
      );

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Check if the user is the owner of the item
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view claim requests for this item",
      });
    }

    const itemObj = item.toObject();
    if (itemObj.image) {
      itemObj.image = `/uploads/${itemObj.image}`;
    }

    res.status(200).json({
      success: true,
      claimRequests: itemObj.claimRequests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Get inform requests for lost items
app.get("/api/items/:id/inform-requests", authenticate, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate(
        "informRequests.informedBy",
        "firstName lastName department profileImage"
      )
      .populate(
        "informRequests.reviewedBy",
        "firstName lastName department profileImage"
      );

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Check if the user is the owner of the item
    if (item.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view inform requests for this item",
      });
    }

    const itemObj = item.toObject();
    if (itemObj.image) {
      itemObj.image = `/uploads/${itemObj.image}`;
    }

    // Format inform request images
    const formattedInformRequests = itemObj.informRequests.map((request) => ({
      ...request,
      image: request.image ? `/uploads/${request.image}` : null,
    }));

    res.status(200).json({
      success: true,
      informRequests: formattedInformRequests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Approve claim request with contact information
app.post(
  "/api/items/:id/claim-requests/:requestId/approve",
  authenticate,
  async (req, res) => {
    try {
      const { contactInfo } = req.body;

      // Validate required contact information
      if (!contactInfo || !contactInfo.phone) {
        return res.status(400).json({
          success: false,
          message:
            "Contact phone number is required when approving a claim request",
        });
      }

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
          message: "Not authorized to approve claim requests for this item",
        });
      }

      const claimRequest = item.claimRequests.id(req.params.requestId);
      if (!claimRequest) {
        return res
          .status(404)
          .json({ success: false, message: "Claim request not found" });
      }

      // Update the claim request status and add contact information
      claimRequest.status = "approved";
      claimRequest.reviewedBy = req.user._id;
      claimRequest.reviewedAt = new Date();
      claimRequest.contactInfo = {
        phone: contactInfo.phone,
        alternatePhone: contactInfo.alternatePhone || "",
        email: contactInfo.email || req.user.email,
        meetingLocation: contactInfo.meetingLocation || "",
        meetingTime: contactInfo.meetingTime || "",
        additionalNotes: contactInfo.additionalNotes || "",
      };

      // Update the item status
      item.status = "claimed";
      item.claimedBy = claimRequest.requestedBy;

      await item.save();

      // Create a detailed notification message for the claimant with contact information
      const contactMessage = `Your claim request for the ${item.type} item "${
        item.title
      }" has been approved! 

Contact Information:
📞 Phone: ${contactInfo.phone}
${
  contactInfo.alternatePhone
    ? `📞 Alternate Phone: ${contactInfo.alternatePhone}\n`
    : ""
}
📧 Email: ${contactInfo.email || req.user.email}
${
  contactInfo.meetingLocation
    ? `📍 Meeting Location: ${contactInfo.meetingLocation}\n`
    : ""
}
${
  contactInfo.meetingTime ? `⏰ Meeting Time: ${contactInfo.meetingTime}\n` : ""
}
${
  contactInfo.additionalNotes
    ? `📝 Additional Notes: ${contactInfo.additionalNotes}\n`
    : ""
}

Please contact the owner to arrange pickup/return of your item.`;

      const message = new Message({
        content: contactMessage,
        sender: req.user._id,
        receiver: claimRequest.requestedBy,
        messageType: "contact_share",
      });
      await message.save();

      // NEW: Create notification for approved claim request
      await createNotification(
        claimRequest.requestedBy,
        "Claim Request Approved! 🎉",
        `Great news! Your claim request for "${item.title}" has been approved. Check your messages for contact details.`,
        "claim_request_approved",
        item._id,
        true
      );

      // NEW: Create notification for item claimed
      await createNotification(
        req.user._id,
        "Item Successfully Claimed",
        `Your found item "${item.title}" has been successfully claimed and contact information has been shared.`,
        "item_claimed",
        item._id
      );

      res.status(200).json({
        success: true,
        message:
          "Claim request approved successfully with contact information shared",
        item: {
          ...item.toObject(),
          image: item.image ? `/uploads/${item.image}` : null,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// NEW: Approve inform request with contact information
app.post(
  "/api/items/:id/inform-requests/:requestId/approve",
  authenticate,
  async (req, res) => {
    try {
      const { contactInfo } = req.body;

      // Validate required contact information
      if (!contactInfo || !contactInfo.phone) {
        return res.status(400).json({
          success: false,
          message:
            "Contact phone number is required when approving an inform request",
        });
      }

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
          message: "Not authorized to approve inform requests for this item",
        });
      }

      const informRequest = item.informRequests.id(req.params.requestId);
      if (!informRequest) {
        return res
          .status(404)
          .json({ success: false, message: "Inform request not found" });
      }

      // Update the inform request status and add contact information
      informRequest.status = "approved";
      informRequest.reviewedBy = req.user._id;
      informRequest.reviewedAt = new Date();
      informRequest.contactInfo = {
        phone: contactInfo.phone,
        alternatePhone: contactInfo.alternatePhone || "",
        email: contactInfo.email || req.user.email,
        meetingLocation: contactInfo.meetingLocation || "",
        meetingTime: contactInfo.meetingTime || "",
        additionalNotes: contactInfo.additionalNotes || "",
      };

      // Update the item status
      item.status = "claimed";
      item.claimedBy = informRequest.informedBy;

      await item.save();

      // Create a detailed notification message for the finder with contact information
      const contactMessage = `Your inform request for the lost item "${
        item.title
      }" has been approved! The owner confirmed this is their item.

Contact Information:
📞 Phone: ${contactInfo.phone}
${
  contactInfo.alternatePhone
    ? `📞 Alternate Phone: ${contactInfo.alternatePhone}\n`
    : ""
}
📧 Email: ${contactInfo.email || req.user.email}
${
  contactInfo.meetingLocation
    ? `📍 Meeting Location: ${contactInfo.meetingLocation}\n`
    : ""
}
${
  contactInfo.meetingTime ? `⏰ Meeting Time: ${contactInfo.meetingTime}\n` : ""
}
${
  contactInfo.additionalNotes
    ? `📝 Additional Notes: ${contactInfo.additionalNotes}\n`
    : ""
}

Please contact the owner to arrange returning their item.`;

      const message = new Message({
        content: contactMessage,
        sender: req.user._id,
        receiver: informRequest.informedBy,
        messageType: "contact_share",
      });
      await message.save();

      // NEW: Create notification for approved inform request
      await createNotification(
        informRequest.informedBy,
        "Inform Request Approved! 🎉",
        `Great news! The owner confirmed that "${item.title}" is their lost item. Check your messages for contact details.`,
        "inform_request_approved",
        item._id,
        true
      );

      // NEW: Create notification for item reunited
      await createNotification(
        req.user._id,
        "Item Successfully Reunited",
        `Your lost item "${item.title}" has been successfully reunited through the finder and contact information has been shared.`,
        "item_claimed",
        item._id
      );

      res.status(200).json({
        success: true,
        message:
          "Inform request approved successfully with contact information shared",
        item: {
          ...item.toObject(),
          image: item.image ? `/uploads/${item.image}` : null,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

app.post(
  "/api/items/:id/claim-requests/:requestId/reject",
  authenticate,
  async (req, res) => {
    try {
      const { rejectionReason } = req.body;

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
          message: "Not authorized to reject claim requests for this item",
        });
      }

      const claimRequest = item.claimRequests.id(req.params.requestId);
      if (!claimRequest) {
        return res
          .status(404)
          .json({ success: false, message: "Claim request not found" });
      }

      // Update the claim request status
      claimRequest.status = "rejected";
      claimRequest.reviewedBy = req.user._id;
      claimRequest.reviewedAt = new Date();
      claimRequest.rejectionReason = rejectionReason || "No reason provided";

      await item.save();

      // Create a notification message for the claimant
      const message = new Message({
        content: `Your claim request for the ${item.type} item "${
          item.title
        }" has been rejected. ${
          rejectionReason ? `Reason: ${rejectionReason}` : ""
        }`,
        sender: req.user._id,
        receiver: claimRequest.requestedBy,
      });
      await message.save();

      // NEW: Create notification for rejected claim request
      await createNotification(
        claimRequest.requestedBy,
        "Claim Request Rejected",
        `Your claim request for "${item.title}" has been rejected. ${
          rejectionReason ? `Reason: ${rejectionReason}` : ""
        }`,
        "claim_request_rejected",
        item._id
      );

      res.status(200).json({
        success: true,
        message: "Claim request rejected successfully",
        item: {
          ...item.toObject(),
          image: item.image ? `/uploads/${item.image}` : null,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// NEW: Reject inform request with reason
app.post(
  "/api/items/:id/inform-requests/:requestId/reject",
  authenticate,
  async (req, res) => {
    try {
      const { rejectionReason } = req.body;

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
          message: "Not authorized to reject inform requests for this item",
        });
      }

      const informRequest = item.informRequests.id(req.params.requestId);
      if (!informRequest) {
        return res
          .status(404)
          .json({ success: false, message: "Inform request not found" });
      }

      // Update the inform request status
      informRequest.status = "rejected";
      informRequest.reviewedBy = req.user._id;
      informRequest.reviewedAt = new Date();
      informRequest.rejectionReason = rejectionReason || "No reason provided";

      await item.save();

      // Create a notification message for the finder
      const message = new Message({
        content: `Your inform request for the lost item "${
          item.title
        }" has been rejected. ${
          rejectionReason ? `Reason: ${rejectionReason}` : ""
        }`,
        sender: req.user._id,
        receiver: informRequest.informedBy,
      });
      await message.save();

      // NEW: Create notification for rejected inform request
      await createNotification(
        informRequest.informedBy,
        "Inform Request Rejected",
        `Your inform request for "${item.title}" has been rejected. ${
          rejectionReason ? `Reason: ${rejectionReason}` : ""
        }`,
        "inform_request_rejected",
        item._id
      );

      res.status(200).json({
        success: true,
        message: "Inform request rejected successfully",
        item: {
          ...item.toObject(),
          image: item.image ? `/uploads/${item.image}` : null,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// NEW: Get rejection reason for claim requests
app.get(
  "/api/claim-requests/:requestId/rejection-reason",
  authenticate,
  async (req, res) => {
    try {
      const item = await Item.findOne({
        "claimRequests._id": req.params.requestId,
        $or: [
          { "claimRequests.requestedBy": req.user._id },
          { postedBy: req.user._id },
        ],
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Claim request not found or not authorized",
        });
      }

      const claimRequest = item.claimRequests.id(req.params.requestId);
      if (!claimRequest) {
        return res.status(404).json({
          success: false,
          message: "Claim request not found",
        });
      }

      if (claimRequest.status !== "rejected") {
        return res.status(400).json({
          success: false,
          message: "Claim request is not rejected",
        });
      }

      res.status(200).json({
        success: true,
        rejectionReason: claimRequest.rejectionReason || "No reason provided",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// NEW: Get rejection reason for inform requests
app.get(
  "/api/inform-requests/:requestId/rejection-reason",
  authenticate,
  async (req, res) => {
    try {
      const item = await Item.findOne({
        "informRequests._id": req.params.requestId,
        $or: [
          { "informRequests.informedBy": req.user._id },
          { postedBy: req.user._id },
        ],
      });

      if (!item) {
        return res.status(404).json({
          success: false,
          message: "Inform request not found or not authorized",
        });
      }

      const informRequest = item.informRequests.id(req.params.requestId);
      if (!informRequest) {
        return res.status(404).json({
          success: false,
          message: "Inform request not found",
        });
      }

      if (informRequest.status !== "rejected") {
        return res.status(400).json({
          success: false,
          message: "Inform request is not rejected",
        });
      }

      res.status(200).json({
        success: true,
        rejectionReason: informRequest.rejectionReason || "No reason provided",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Get contact information for approved claim requests (only for claimant)
app.get("/api/items/:id/contact-info", authenticate, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate("postedBy", "firstName lastName")
      .populate("claimedBy", "firstName lastName");

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    // Only the claimant can access contact information
    if (
      !item.claimedBy ||
      item.claimedBy._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view contact information",
      });
    }

    // Find the approved request for the current user (either claim or inform)
    let approvedRequest = null;
    let itemOwner = null;

    if (item.type === "found") {
      approvedRequest = item.claimRequests.find(
        (request) =>
          request.requestedBy.toString() === req.user._id.toString() &&
          request.status === "approved"
      );
    } else if (item.type === "lost") {
      approvedRequest = item.informRequests.find(
        (request) =>
          request.informedBy.toString() === req.user._id.toString() &&
          request.status === "approved"
      );
    }

    if (!approvedRequest || !approvedRequest.contactInfo) {
      return res.status(404).json({
        success: false,
        message: "Contact information not available",
      });
    }

    res.status(200).json({
      success: true,
      contactInfo: approvedRequest.contactInfo,
      itemOwner: {
        name: `${item.postedBy.firstName} ${item.postedBy.lastName}`,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Comment Routes
app.post("/api/items/:id/comments", authenticate, async (req, res) => {
  try {
    const { content } = req.body;

    const item = await Item.findById(req.params.id).populate(
      "postedBy",
      "firstName lastName"
    );
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

    // NEW: Create notification for comment added (if it's not the item owner commenting)
    if (item.postedBy._id.toString() !== req.user._id.toString()) {
      await createNotification(
        item.postedBy._id,
        "New Comment on Your Item",
        `${req.user.firstName} ${req.user.lastName} commented on your ${item.type} item "${item.title}".`,
        "comment_added",
        item._id
      );
    }

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

    // Format profile images
    const formattedComments = comments.map((comment) => {
      const commentObj = comment.toObject();
      if (commentObj.postedBy && commentObj.postedBy.profileImage) {
        commentObj.postedBy.profileImage = `/uploads/${commentObj.postedBy.profileImage}`;
      }
      return commentObj;
    });

    res.status(200).json({ success: true, comments: formattedComments });
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

// Comment Like/Unlike functionality
app.post("/api/comments/:id/like", authenticate, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const userId = req.user._id;
    const hasLiked = comment.likes.includes(userId);

    if (hasLiked) {
      // Unlike the comment
      comment.likes = comment.likes.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      // Like the comment
      comment.likes.push(userId);
    }

    await comment.save();

    res.status(200).json({
      success: true,
      message: hasLiked ? "Comment unliked" : "Comment liked",
      likesCount: comment.likes.length,
      hasLiked: !hasLiked,
    });
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

    // NEW: Create notification for message received
    await createNotification(
      receiver,
      "New Message",
      `${req.user.firstName} ${req.user.lastName} sent you a message.`,
      "message_received",
      message._id,
      true
    );

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

// Mark messages as read
app.put("/api/messages/mark-read", authenticate, async (req, res) => {
  try {
    const { messageIds } = req.body;

    await Message.updateMany(
      {
        _id: { $in: messageIds },
        receiver: req.user._id,
      },
      { read: true }
    );

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get unread message count
app.get("/api/messages/unread-count", authenticate, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      read: false,
    });

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
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
      .populate("postedBy", "firstName lastName department profileImage")
      .sort({ createdAt: -1 });

    // Format image URLs
    const formattedSuggestions = suggestions.map((suggestion) => {
      const suggestionObj = suggestion.toObject();
      if (suggestionObj.postedBy.profileImage) {
        suggestionObj.postedBy.profileImage = `/uploads/${suggestionObj.postedBy.profileImage}`;
      } else if (suggestionObj.postedBy.idCardImage) {
        suggestionObj.postedBy.profileImage = `/uploads/${suggestionObj.postedBy.idCardImage}`;
      }
      return suggestionObj;
    });

    res.status(200).json({ success: true, suggestions: formattedSuggestions });
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

// Vote on suggestions
app.post("/api/suggestions/:id/vote", authenticate, async (req, res) => {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res
        .status(404)
        .json({ success: false, message: "Suggestion not found" });
    }

    const userId = req.user._id;
    const hasVoted = suggestion.votes.includes(userId);

    if (hasVoted) {
      // Remove vote
      suggestion.votes = suggestion.votes.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      // Add vote
      suggestion.votes.push(userId);
    }

    await suggestion.save();

    res.status(200).json({
      success: true,
      message: hasVoted ? "Vote removed" : "Vote added",
      votesCount: suggestion.votes.length,
      hasVoted: !hasVoted,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Stats Routes - UPDATED TO HANDLE REUNITED COUNT PROPERLY
app.get("/api/stats", authenticate, async (req, res) => {
  try {
    // Count active lost items (items that haven't been claimed yet)
    const lostCount = await Item.countDocuments({
      type: "lost",
      status: "active",
    });

    // Count active found items (items that haven't been claimed yet)
    const foundCount = await Item.countDocuments({
      type: "found",
      status: "active",
    });

    // Count successfully reunited items (items that have been claimed)
    const reunitedCount = await Item.countDocuments({
      status: "claimed",
    });

    // NEW: Count items claimed by the current user
    const myClaimedCount = await Item.countDocuments({
      claimedBy: req.user._id,
      status: "claimed",
    });

    res.status(200).json({
      success: true,
      stats: {
        lostCount,
        foundCount,
        reunitedCount,
        myClaimedCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Advanced analytics routes for future admin dashboard
app.get("/api/analytics/overview", authenticate, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalItems = await Item.countDocuments();
    const totalComments = await Comment.countDocuments();
    const totalMessages = await Message.countDocuments();

    // Items by type
    const itemsByType = await Item.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    // Items by status
    const itemsByStatus = await Item.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Monthly registration trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userRegistrationTrend = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        totalUsers,
        totalItems,
        totalComments,
        totalMessages,
        itemsByType,
        itemsByStatus,
        userRegistrationTrend,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// User blocking and reporting functionality
app.post("/api/users/:id/block", authenticate, async (req, res) => {
  try {
    const userToBlock = req.params.id;

    if (userToBlock === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot block yourself",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user.blockedUsers.includes(userToBlock)) {
      user.blockedUsers.push(userToBlock);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: "User blocked successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/users/:id/unblock", authenticate, async (req, res) => {
  try {
    const userToUnblock = req.params.id;

    const user = await User.findById(req.user._id);
    user.blockedUsers = user.blockedUsers.filter(
      (id) => id.toString() !== userToUnblock
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/users/blocked", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "blockedUsers",
      "firstName lastName email department"
    );

    res.status(200).json({
      success: true,
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Reporting system
app.post("/api/reports", authenticate, async (req, res) => {
  try {
    const { reportType, reportedEntity, reason, description } = req.body;

    const report = new Report({
      reportType,
      reportedEntity,
      reportedBy: req.user._id,
      reason,
      description,
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/reports", authenticate, async (req, res) => {
  try {
    const { status, reportType } = req.query;
    let query = { reportedBy: req.user._id };

    if (status) query.status = status;
    if (reportType) query.reportType = reportType;

    const reports = await Report.find(query)
      .populate("reportedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, reports });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Enhanced Notification system routes
app.post("/api/notifications", authenticate, async (req, res) => {
  try {
    const { recipient, title, message, type, relatedEntity } = req.body;

    const notification = await createNotification(
      recipient,
      title,
      message,
      type,
      relatedEntity
    );

    res.status(201).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/notifications", authenticate, async (req, res) => {
  try {
    const { read, type } = req.query;
    let query = { recipient: req.user._id };

    if (read !== undefined) query.read = read === "true";
    if (type) query.type = type;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Get unread notifications count
app.get("/api/notifications/unread-count", authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/notifications/:id/read", authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: Mark all notifications as read
app.put("/api/notifications/mark-all-read", authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Bulk operations for future admin functionality
app.post("/api/admin/bulk-delete-items", authenticate, async (req, res) => {
  try {
    const { itemIds } = req.body;

    await Item.deleteMany({
      _id: { $in: itemIds },
      postedBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Items deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/admin/bulk-update-items", authenticate, async (req, res) => {
  try {
    const { itemIds, updateData } = req.body;

    // Only allow updating certain fields and only for own items
    const allowedUpdates = ["status", "priority", "tags"];
    const updates = {};

    Object.keys(updateData).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    await Item.updateMany(
      {
        _id: { $in: itemIds },
        postedBy: req.user._id,
      },
      updates
    );

    res.status(200).json({
      success: true,
      message: "Items updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Search and filter enhancements
app.get("/api/search/advanced", authenticate, async (req, res) => {
  try {
    const {
      query,
      type,
      location,
      dateFrom,
      dateTo,
      status,
      sortBy,
      sortOrder,
      page = 1,
      limit = 20,
      includeReunited,
    } = req.query;

    let searchQuery = {};

    if (query) {
      searchQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { tags: { $in: [new RegExp(query, "i")] } },
      ];
    }

    if (type) searchQuery.type = type;
    if (location) searchQuery.location = { $regex: location, $options: "i" };
    if (status) searchQuery.status = status;

    // NEW: Exclude reunited items from search unless specifically requested
    if (includeReunited !== "true") {
      searchQuery.status = { $ne: "claimed" };
    }

    if (dateFrom || dateTo) {
      searchQuery.createdAt = {};
      if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
    }

    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
    } else {
      sortOptions.createdAt = -1;
    }

    const skip = (page - 1) * limit;

    const items = await Item.find(searchQuery)
      .populate("postedBy", "firstName lastName department")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Item.countDocuments(searchQuery);

    res.status(200).json({
      success: true,
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Export data functionality for users
app.get("/api/export/my-data", authenticate, async (req, res) => {
  try {
    const { format = "json" } = req.query;

    const userData = await User.findById(req.user._id).select(
      "-password -otp -otpExpires"
    );
    const userItems = await Item.find({ postedBy: req.user._id });
    const userComments = await Comment.find({ postedBy: req.user._id });
    const userMessages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    });

    const exportData = {
      profile: userData,
      items: userItems,
      comments: userComments,
      messages: userMessages,
      exportDate: new Date().toISOString(),
    };

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=my-data.json");
      res.status(200).json(exportData);
    } else {
      // For future CSV export functionality
      res.status(400).json({
        success: false,
        message: "Only JSON format is currently supported",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Route for landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
