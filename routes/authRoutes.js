const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");
const verifyJWT = require("../middleware/authMiddleware");

router.post("/register", authController.handleRegister);
router.post("/login", authController.handleLogin);
router.post("/refresh", authController.handleRefresh);
router.post("/logout", authController.handleLogOut);
router.delete("/delete", verifyJWT, authController.handleDeleteUser);
router.post("/forgot-password", authController.handleForgotPassword);
router.post("/reset-password", authController.handleResetPassword);
router.post("/verify-otp", authController.handleVerifyOTP);

module.exports = router;
