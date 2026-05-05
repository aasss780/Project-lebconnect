"use strict";

const { query } = require("../config/db");
const { extractPdfTextFromBase64, extensionFromFileName } = require("../utils/cvExtract");
const { runCvKeywordAnalysis, buildProfileAugmentText } = require("../utils/cvKeywordAnalysis");

async function getMyCvAnalysis(req, res) {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates have saved CV analysis" });
    }
    const rows = await query(
      `SELECT cv_analysis, cv_analysis_updated_at FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    const raw = rows[0]?.cv_analysis;
    if (!raw || !String(raw).trim()) {
      return res.json({ saved: null });
    }
    try {
      const parsed = JSON.parse(String(raw));
      return res.json({
        saved: parsed,
        updatedAt: rows[0].cv_analysis_updated_at || null,
      });
    } catch {
      return res.json({ saved: null });
    }
  } catch (err) {
    console.error("[GET /api/cv/analysis/my]", err);
    res.status(500).json({ message: "Could not load CV analysis", error: err.message });
  }
}

async function clearMyCvAnalysis(req, res) {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await query(`UPDATE users SET cv_analysis = NULL, cv_analysis_updated_at = NULL WHERE id = ?`, [
      req.user.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/cv/analysis/my]", err);
    res.status(500).json({ message: "Could not clear analysis", error: err.message });
  }
}

async function analyzeCv(req, res) {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can use CV keyword analysis" });
    }

    const fileNameRaw =
      typeof req.body.fileName === "string" ? req.body.fileName.trim() : "";
    let cvPayload =
      typeof req.body.cv === "string"
        ? req.body.cv.trim()
        : typeof req.body.candidateCv === "string"
          ? req.body.candidateCv.trim()
          : "";

    let text = "";
    let extractionLimited = false;
    let extractionMessage = "";
    const hadFilePayload = Boolean(cvPayload);
    const ext = extensionFromFileName(fileNameRaw);

    if (cvPayload) {
      if (ext === "docx" || ext === "doc") {
        extractionLimited = true;
        extractionMessage =
          "DOC/DOCX is saved, but text was not extracted on the server. Analysis uses your profile fields (specialization, skills, bio, experience) plus the filename — not the full document.";
      } else {
        const pdf = await extractPdfTextFromBase64(cvPayload);
        text = String(pdf.text || "").trim();
        if (!text || text.length < 24) {
          extractionLimited = true;
          extractionMessage =
            "Could not read this CV automatically. Please upload a text-based PDF.";
          text = "";
        }
      }
    } else {
      extractionLimited = true;
      extractionMessage =
        "No CV file was sent with this request. Analysis uses your saved profile only — upload a PDF on My Profile for full text.";
    }

    const profileAugment = buildProfileAugmentText(req.user);
    const mergedText =
      text.length > 40
        ? `${text}\n${profileAugment}`
        : [text, fileNameRaw, profileAugment].filter(Boolean).join("\n");

    if (!hadFilePayload) {
      extractionLimited = true;
      if (!extractionMessage) {
        extractionMessage =
          "Upload your CV (PDF recommended) on My Profile to analyze document text.";
      }
    }

    const result = runCvKeywordAnalysis(mergedText, {
      extractionLimited,
      message: extractionMessage,
      fileName: fileNameRaw,
      profileUser: req.user,
    });

    if (extractionMessage) result.message = extractionMessage;

    const cvByteLen = Buffer.byteLength(cvPayload, "utf8");
    const fingerprint = `${cvByteLen}|${fileNameRaw || ""}`;
    try {
      const envelope = {
        result,
        meta: { fingerprint, analyzedAt: new Date().toISOString(), fileName: fileNameRaw || "" },
      };
      await query(
        `UPDATE users SET cv_analysis = ?, cv_analysis_updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(envelope), req.user.id]
      );
    } catch (persistErr) {
      console.warn("[analyzeCv] persistence skipped:", persistErr.message || persistErr);
    }

    res.json(result);
  } catch (err) {
    console.error("[POST /api/cv/analyze]", err);
    res.status(500).json({
      message: "CV keyword analysis failed",
      error: err.message,
    });
  }
}

module.exports = { analyzeCv, getMyCvAnalysis, clearMyCvAnalysis };
