const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

router.post(
  "/transcribe",
  (req, res, next) => {
    upload.single("audio")(req, res, (err) => {
      if (err) {
        console.log("Multer error:", err);
        return res.status(400).json({
          error: "File upload failed",
          detail: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file received" });
    }

    const filePath = req.file.path;

    try {
      const form = new FormData();
      form.append("file", fs.createReadStream(filePath), {
        filename: "recording.m4a",
      });
      form.append("model", "whisper-1");

      console.log("OPENAI KEY EXISTS:", !!process.env.OPENAI_SECRET_KEY);
      const stats = fs.statSync(filePath);
      console.log("FILE SIZE:", stats.size);
      const response = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        form,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_SECRET_KEY}`,
            ...form.getHeaders(),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      );

      res.json({ text: response.data.text });
    } catch (err) {
      console.log("FULL WHISPER ERROR:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });

      return res.status(500).json({
        error: "Transcription failed",
        detail: err.response?.data || err.message,
      });
    } finally {
      fs.unlink(filePath, () => {});
    }
  },
);

module.exports = router;
