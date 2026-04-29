const User = require("../model/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendOTPEmail } = require("../services/emailServices");
const DonorProfile = require("../model/DonorProfile");

const handleLogin = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const foundUser = await User.findOne({ email });
    if (!foundUser) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, foundUser.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const accessToken = jwt.sign(
      {
        UserInfo: {
          id: foundUser._id,
          email: foundUser.email,
          role: foundUser.role,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "15m" },
    );

    const refreshToken = jwt.sign(
      { id: foundUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "1d" },
    );

    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    foundUser.refreshToken = hashedRefreshToken;
    await foundUser.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: foundUser._id,
        email: foundUser.email,
        role: foundUser.role,
        firstname: foundUser.firstname,
        surname: foundUser.surname,
        bloodType: foundUser.bloodType,
      },
    });
  } catch (err) {
    next(err);
  }
};

const handleRegister = async (req, res, next) => {
  const {
    firstname,
    surname,
    email,
    password,
    role,
    age,
    bloodType,
    name,
    phone,
    lng,
    lat,
  } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const allowedRoles = ["patient", "donor", "bloodbank"];
  const userRole = role || "user";

  if (!allowedRoles.includes(userRole) && userRole !== "user") {
    return res.status(403).json({ message: "Invalid role selection" });
  }
  if (userRole === "donor" || userRole === "patient") {
    if (!firstname || !surname || !age || !bloodType) {
      return res.status(400).json({
        message: "Complete personal details required.",
      });
    }
  }

  if (userRole === "bloodbank") {
    if (!name || !phone || !lng || !lat) {
      return res.status(400).json({
        message: "Blood bank name, phone and location required.",
      });
    }
  }

  const duplicate = await User.findOne({ email }).exec();
  if (duplicate) return res.status(409).json({ message: "User exists" });

  try {
    const hashedpwd = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password: hashedpwd,
      firstname: userRole === "bloodbank" ? undefined : firstname,
      surname: userRole === "bloodbank" ? undefined : surname,
      role: userRole,
      age: userRole === "bloodbank" ? undefined : age,
      bloodType: userRole === "bloodbank" ? undefined : bloodType,
    });
    if (userRole === "bloodbank") {
      const longitude = Number(lng);
      const latitude = Number(lat);

      if (isNaN(longitude) || isNaN(latitude)) {
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      const BloodBank = require("../model/BloodBank");

      await BloodBank.create({
        user: newUser._id,
        name,
        phone,
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      });
    }

    if (userRole === "donor") {
      await DonorProfile.create({
        user: newUser._id,
        availabilityStatus: true,
      });
    }

    const accessToken = jwt.sign(
      {
        UserInfo: {
          email: newUser.email,
          id: newUser._id,
          role: newUser.role,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "15m" },
    );

    const refreshToken = jwt.sign(
      { id: newUser._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "1d" },
    );

    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    newUser.refreshToken = hashedRefreshToken;
    await newUser.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        firstname: newUser.firstname,
        surname: newUser.surname,
        bloodType: newUser.bloodType,
      },
    });
  } catch (err) {
    next(err);
  }
};

const handleLogOut = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204);

  const refreshToken = cookies.jwt;

  const hashedRefreshToken = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const foundUser = await User.findOne({
    refreshToken: hashedRefreshToken,
  }).exec();

  if (foundUser) {
    foundUser.refreshToken = "";
    await foundUser.save();
  }

  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
  });

  res.sendStatus(204);
};

const handleDeleteUser = async (req, res) => {
  const userID = req.user.id;

  const deletedUser = await User.findByIdAndDelete(userID);

  if (!deletedUser) {
    return res.sendStatus(404);
  }

  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
  });

  res.sendStatus(204);
};

const handleForgotPassword = async (req, res, next) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    user.resetPasswordToken = hashedOTP;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendOTPEmail(email, otp);

    if (process.env.NODE_ENV !== "production") console.log("OTP:", otp);

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    next(err);
  }
};

const handleResetPassword = async (req, res, next) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    if (user.resetPasswordToken !== hashedOTP) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    next(err);
  }
};

const handleVerifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const hashedOTP = crypto.createHash("sha256").update(otp).digest("hex");

    if (user.resetPasswordToken !== hashedOTP) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    res.json({ message: "OTP verified" });
  } catch (err) {
    next(err);
  }
};

const handleRefresh = async (req, res, next) => {
  const refreshToken = req.cookies?.jwt || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const foundUser = await User.findById(decoded.id);

    if (!foundUser) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    if (foundUser.refreshToken !== hashedToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      {
        UserInfo: {
          id: foundUser._id,
          email: foundUser.email,
          role: foundUser.role,
          firstname: foundUser.firstname,
          surname: foundUser.surname,
          bloodType: foundUser.bloodType,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  handleLogin,
  handleRefresh,
  handleRegister,
  handleLogOut,
  handleDeleteUser,
  handleForgotPassword,
  handleResetPassword,
  handleVerifyOTP,
};
