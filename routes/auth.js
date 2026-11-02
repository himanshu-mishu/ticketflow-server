const express = require("express");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const router = express.Router();
const authenticate = require("../middleware/authenticate");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    // 1. Validate the request
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.length > 254 || password.length > 1024) {
      return res.status(400).json({
        message: "Invalid email or password.",
      });
    }

    // 2. Ensure the JWT secret is configured
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        message: "Authentication is not configured.",
      });
    }

    // 3. Find the user
    const prisma = req.app.locals.prisma;

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Use a generic error to avoid revealing whether an email exists
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // 4. Verify the submitted password against its Argon2id hash
    const passwordIsValid = await argon2.verify(user.passwordHash, password);

    if (!passwordIsValid) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    // 5. Sign a short-lived JWT
    const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: "15m" });

    // 6. Set the JWT in an HTTP-only cookie
    res.cookie("ticketflow_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });

    // 7. Return safe user information
    return res.status(200).json({
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Unable to log in right now.",
    });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate required fields
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email, and password are required.",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Validate input lengths and email format
    if (normalizedName.length > 100) {
      return res.status(400).json({
        message: "Name must be 100 characters or fewer.",
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 1024) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    const prisma = req.app.locals.prisma;

    // 3. Check whether the email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    // 4. Hash the password; never store the plain-text password
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    // 5. Create the user
    // The database default assigns CUSTOMER to new users.
    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: "Account created successfully.",
      user,
    });
  } catch (error) {
    // Handle concurrent signup attempts for the same unique email.
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Signup error:", error);

    return res.status(500).json({
      message: "Unable to create your account right now.",
    });
  }
});

router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("ticketflow_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({
    message: "Logged out successfully.",
  });
});

module.exports = router;
