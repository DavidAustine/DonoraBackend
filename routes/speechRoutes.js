const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders(),
        },
      },
    );

    res.json({ text: response.data.text });
  } catch (err) {
    console.log("Whisper error:", err.response?.data || err.message);
    res.status(500).json({
      error: "Transcription failed",
      detail: err.response?.data || err.message, // remove this line after debugging
    });
  } finally {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
  }
});

module.exports = router;
