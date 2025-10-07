import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse";
import axios from "axios";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 5000;

app.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 1️⃣ Read uploaded file
    const pdfBuffer = fs.readFileSync(req.file.path);

    // 2️⃣ Extract text
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text || "";

    // 3️⃣ Gemini prompt
    const prompt = `
Analyze the following resume and respond ONLY with a JSON object with these fields:
- overallScore (0-100)
- atsScore (0-100)
- keywordsScore (0-100)
- readabilityScore (0-100)
- missingKeywords (array of strings)
- suggestions (array of objects with title and desc)
- aiAnalysis (string summary)

Resume:
${extractedText}
`;

    // 4️⃣ Send to Gemini API
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite-001:generateContent",
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      },
      { params: { key: GEMINI_API_KEY } }
    );

    // 5️⃣ Parse response JSON
    let analysisJson = {};
    try {
      const text = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysisJson = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { aiAnalysis: text };
    } catch (e) {
      analysisJson = { aiAnalysis: "Could not parse Gemini's response." };
    }

    res.json(analysisJson);
  } catch (error) {
    console.error("Error analyzing resume:", error.message);
    res.json({
      aiAnalysis: "Error occurred while analyzing the resume.",
    });
  } finally {
    // 6️⃣ Cleanup
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
    }
  }
});

app.get("/", (req, res) => {
  res.send("CV Analyzer Backend is running 🚀");
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
