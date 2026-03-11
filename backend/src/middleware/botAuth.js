export function botAuth(prisma) {
  return async function (req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing bot token" });
    }

    const token = authHeader.split(" ")[1];

    // Ensure the token is a non-empty string
    if (!token) {
      return res.status(401).json({ error: "Missing bot token" });
    }

    const bot = await prisma.user.findFirst({
      where: { role: "BOT", botSecret: token },
    });

    if (!bot) return res.status(403).json({ error: "Invalid bot token" });

    req.botUser = bot;
    next();
  };
}

export function optionalBotAuth(prisma) {
  return async function (req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return next();
    }

    const bot = await prisma.user.findFirst({
      where: { role: "BOT", botSecret: token },
    });

    if (bot) {
      req.botUser = bot;
    }
    
    next();
  };
}
