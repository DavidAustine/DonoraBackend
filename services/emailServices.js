const nodemailer = require("nodemailer");

const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("EMAIL_USER or EMAIL_PASS environment variable is missing");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
};

const sendOTPEmail = async (to, otp) => {
  const transporter = createTransporter();

  // Verify SMTP connection before attempting to send — surfaces the real error
  await transporter.verify();

  await transporter.sendMail({
    from: `"Donora Blood" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your Password Reset OTP",
    text: `Hello,\n\nYour OTP is: ${otp}\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email.\n\n-Donora Blood Team`,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("OTP email sent to:", to);
  }
};

module.exports = { sendOTPEmail };
