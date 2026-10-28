
const express = require("express");
const argon2 = require("argon2");

const router = express.Router();

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

module.exports = router;
