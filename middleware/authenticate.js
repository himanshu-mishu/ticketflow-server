const jwt = require("jsonwebtoken");

async function authenticate(req, res, next) {
  try {
    // Read the JWT from the HTTP-only cookie
    const token = req.cookies?.ticketflow_token;
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is not configured.");
      return res.status(500).json({
        message: "Authentication is not configured.",
      });
    }

    // Check whether the request contains a token
    if (!token) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // Verify the token's signature and expiry
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string") {
      return res.status(401).json({
        message: "Invalid or expired authentication token.",
      });
    }

    // Fetch the user associated with the token
    const user = await req.app.locals.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired authentication token.",
      });
    }

    // Make the authenticated user available to the route
    req.user = user;

    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: "Invalid or expired authentication token.",
      });
    }

    console.error("Authentication error:", error);
    return res.status(500).json({
      message: "Unable to authenticate request.",
    });
  }
}

module.exports = authenticate;
