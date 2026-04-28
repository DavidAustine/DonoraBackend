const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
})

const sendOTPEmail = async (to, otp) => {
    try {
        const info = await transporter.sendMail({
            from: `"Donora Blood" <${process.env.EMAIL_USER}>`,
            to,
            subject: "Your Password Reset OTP",
            text: `Hello,\n\nYour OTP is: ${otp}\nIt expires in 10 minutes.\n\nIf you didn’t request this, ignore this email.\n\n-Blood Donation App Team`
        })
        console.log("Email sent:", info.response)
    } catch (error) {
        console.error("Email sending error:", error.message)
        throw new Error("Could not send email")
    }
}

module.exports = {sendOTPEmail}