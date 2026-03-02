// backend/src/middleware/adminOrBotAuth.js
// SPDX-License-Identifier: Apache-2.0

export function adminOrBotAuth(prisma) {
  return async function (req, res, next) {
    // 1. Check for a logged-in admin user from the session
    // Assumes a previous middleware populates req.currentUser from the session
    if (req.currentUser && req.currentUser.role === 'ADMIN') {
      return next();
    }

    // 2. If not an admin, check for a bot token in the Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      // Ensure the token is a non-empty string
      if (token) {
        const bot = await prisma.user.findFirst({
          where: { role: "BOT", botSecret: token },
        });

        if (bot) {
          // Attach bot user to request for downstream use if needed
          req.botUser = bot;
          return next();
        }
      }
    }

    // 3. If neither an admin nor a valid bot, deny access
    return res.status(403).json({ error: "Forbidden: Admin or Bot access required" });
  };
}
