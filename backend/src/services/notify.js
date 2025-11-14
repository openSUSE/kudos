// backend/src/services/notify.js
// Copyright © 2025–present Lubos Kocman and openSUSE contributors
// SPDX-License-Identifier: Apache-2.0

import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import Handlebars from "handlebars";

const templateCache = new Map();

function loadTemplate(name) {
  if (templateCache.has(name)) return templateCache.get(name);
  const filePath = path.resolve(`backend/src/templates/${name}.html`);
  const template = fs.readFileSync(filePath, "utf8");
  templateCache.set(name, template);
  return template;
}

function renderTemplate(base, content, context) {
  const contentTpl = Handlebars.compile(loadTemplate(content));
  const baseTpl = Handlebars.compile(loadTemplate(base));
  const html = baseTpl({
    ...context,
    content: contentTpl(context),
  });
  return html;
}

export async function sendNotification(prisma, {
  userId,
  message,
  subject,
  permalink,
  shareUrl,
  type = "info",
  template,  // e.g. "kudos_email" or "badge_email"
  context = {},
}) {
  const notification = await prisma.notification.create({
    data: { userId, message, type },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, username: true },
  });

  if (!user || !user.email) return notification;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "25"),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const html = renderTemplate("email_base", template || "default", {
    subject,
    ...context,
    permalink,
    shareUrl,
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || "openSUSE Portal <noreply@opensuse.org>",
    to: user.email,
    subject,
    html,
  });

  console.log(`📧 Email sent to ${user.email} (${template})`);
  return notification;
}