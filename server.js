require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use("/api/speech", require("./routes/speechRoutes"));
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/bloodbank", require("./routes/bloodBankRoutes"));
app.use("/api/chat/direct", require("./routes/directChatRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/donors", require("./routes/donorRoutes"));
app.use("/api/match", require("./routes/matchRoutes"));
app.use("/api/requests", require("./routes/requestRoutes"));
app.use("/api/sos", require("./routes/sosRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));

const errorHandler = require("./middleware/errorMiddleware");
app.use(errorHandler);

mongoose.connection.once("open", () => {
  console.log("Connected to MongoDB");

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  const io = require("socket.io")(httpServer, {
    cors: { origin: "*" },
  });

  app.set("io", io);

  const jwt = require("jsonwebtoken");
  const notify = require("./utils/notify");

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.user = decoded.UserInfo;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(socket.user.id);
    console.log("User connected:", socket.user.id);

    socket.on("joinMatch", (matchId) => {
      socket.join(matchId);
    });

    socket.on("joinDirectThread", (threadId) => {
      socket.join(`direct_${threadId}`);
    });

    socket.on("sendMessage", async ({ matchId, message }) => {
      const Match = require("./model/Match");
      const ChatMessage = require("./model/ChatMessage");

      const match = await Match.findById(matchId);
      if (!match) return;
      if (!match.participants.some((p) => p.toString() === socket.user.id))
        return;

      const newMessage = await ChatMessage.create({
        match: matchId,
        sender: socket.user.id,
        message,
      });

      await newMessage.populate("sender", "firstname surname");

      io.to(matchId).emit("newMessage", newMessage);

      const receiverId = match.participants.find(
        (p) => p.toString() !== socket.user.id,
      );
      if (receiverId) {
        const senderName =
          `${newMessage.sender?.firstname || ""} ${newMessage.sender?.surname || ""}`.trim() ||
          "Someone";

        io.to(receiverId.toString()).emit("unreadMessage", {
          matchId,
          senderId: socket.user.id,
          senderName,
          preview: message.slice(0, 80),
        });

        await notify(
          io,
          receiverId,
          "message",
          `New message from ${senderName}`,
          message.slice(0, 80),
          matchId,
        );
      }
    });

    socket.on("sendDirectMessage", async ({ threadId, message }) => {
      const DirectConversation = require("./model/DirectConversation");
      const ChatMessage = require("./model/ChatMessage");

      const thread = await DirectConversation.findById(threadId);
      if (!thread) return;
      if (!thread.participants.some((p) => p.toString() === socket.user.id))
        return;

      const newMessage = await ChatMessage.create({
        match: threadId,
        sender: socket.user.id,
        message,
      });

      await newMessage.populate("sender", "firstname surname");

      await DirectConversation.findByIdAndUpdate(threadId, {
        lastMessage: { message, createdAt: newMessage.createdAt },
        updatedAt: new Date(),
      });

      io.to(`direct_${threadId}`).emit("newMessage", newMessage);

      const receiverId = thread.participants.find(
        (p) => p.toString() !== socket.user.id,
      );
      if (receiverId) {
        const senderName =
          `${newMessage.sender?.firstname || ""} ${newMessage.sender?.surname || ""}`.trim() ||
          "Someone";

        io.to(receiverId.toString()).emit("unreadMessage", {
          matchId: threadId,
          senderId: socket.user.id,
          senderName,
          preview: message.slice(0, 80),
        });

        await notify(
          io,
          receiverId,
          "message",
          `New message from ${senderName}`,
          message.slice(0, 80),
          threadId,
        );
      }
    });

    socket.on("updateLocation", async ({ lng, lat }) => {
      const User = require("./model/User");
      if (!lng || !lat) return;
      await User.findByIdAndUpdate(socket.user.id, {
        $set: {
          location: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
        },
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.user.id);
    });
  });
});
