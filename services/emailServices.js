const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (to, otp) => {
  try {
    const info = await transporter.sendMail({
      from: `"Donora Blood" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your Password Reset OTP",
      text: `Hello,\n\nYour OTP is: ${otp}\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email.\n\n-Donora Blood Team`,
    });
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("FULL EMAIL ERROR:", error);
    throw error;
  }
};

module.exports = { sendOTPEmail };
