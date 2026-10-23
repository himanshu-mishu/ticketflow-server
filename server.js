
const express = require("express");
const dotenv = require("dotenv");
const { createPrismaClient } = require("./db");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());

// Health-check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Ticketflow API is running",
  });
});

async function startServer() {
  const prisma = await createPrismaClient();

  await prisma.$connect();

  // Make Prisma available to future route handlers
  app.locals.prisma = prisma;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Prisma connected to PostgreSQL");
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
