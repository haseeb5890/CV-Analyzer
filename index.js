require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(cors());
const upload = multer({ dest: "uploads/" });

const GEMINI_API_KEY = "AIzaSyBnrYnphnBrc5A3NUa-OojjK0QL7cCFBss"; // Replace with your actual key
const PORT = process.env.PORT;

app.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    // 1. Read the uploaded PDF file
    const pdfBuffer = fs.readFileSync(req.file.path);

    // 2. Extract text from PDF
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text;

    // 3. Compose a prompt for Gemini to return JSON with scores and suggestions
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

    // 4. Send extracted text to Gemini
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite-001:generateContent",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        params: { key: GEMINI_API_KEY },
      }
    );

    // 5. Parse Gemini's JSON response from the text
    let analysisJson = {};
    try {
      // Try to extract JSON from Gemini's response text
      const text = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysisJson = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { aiAnalysis: text };
    } catch (e) {
      analysisJson = { aiAnalysis: "Could not parse Gemini's response." };
    }

    res.json(analysisJson);

    // 6. Clean up uploaded file
    fs.unlinkSync(req.file.path);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res.json({
      aiAnalysis:
        "Mocked analysis: This resume demonstrates strong skills and experience.",
    });
  }
});

app.listen(PORT, () => console.log("Backend running on port", PORT));
