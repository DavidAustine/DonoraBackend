const { Resend } = require("resend");

const sendOTPEmail = async (to, otp) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is missing");
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Donora Blood <onboarding@resend.dev>",
    to,
    subject: "Your Password Reset OTP",
    text: `Hello,\n\nYour OTP is: ${otp}\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email.\n\n-Donora Blood Team`,
  });

  if (error) {
    throw new Error(`Email service error: ${error.message}`);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("OTP email sent to:", to);
  }
};

module.exports = { sendOTPEmail };
