// app.js
const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

// Config S3 (MinIO)
const s3 = new AWS.S3({
  endpoint: "http://localhost:9000",
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
  s3ForcePathStyle: true,
  signatureVersion: "v4",
});

const BUCKET = "videos";

// Cria bucket se não existir
(async () => {
  try {
    await s3.createBucket({ Bucket: BUCKET }).promise();
    console.log("Bucket criado:", BUCKET);
  } catch (err) {
    if (err.code === "BucketAlreadyOwnedByYou") {
      console.log("Bucket já existe:", BUCKET);
    } else {
      console.error("Erro criando bucket:", err.message);
    }
  }
})();

// Serve arquivos estáticos (index.html em /public)
app.use(express.static(path.join(__dirname, "public")));

// Endpoint de upload
app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Envie um arquivo" });

  const stream = fs.createReadStream(file.path);
  const key = `${Date.now()}_${file.originalname}`;

  try {
    await s3.upload({
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: file.mimetype
    }).promise();

    const url = s3.getSignedUrl("getObject", {
      Bucket: BUCKET,
      Key: key,
      Expires: 60 * 60 // 1 hora
    });

    res.json({ key, url });
  } catch (err) {
    console.error("Erro upload:", err);
    res.status(500).json({ error: "Erro no upload" });
  } finally {
    // remove arquivo temporário
    fs.unlink(file.path, (e) => { if (e) console.warn("unlink:", e.message); });
  }
});

// opcional: rota para health
app.get("/health", (req, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server rodando: http://localhost:${PORT}`));
