const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { PDFDocument, rgb } = require("pdf-lib");

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("uploads"));
app.use(express.static("assets"));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);

    const safeFileName = `${baseName}_${Date.now()}${ext}`;
    cb(null, safeFileName);
  },
});

const upload = multer({ storage });


app.get("/", (req, res) => res.render("index"));

app.post(
  "/upload",
  upload.fields([
    { name: "pdf", maxCount: 1 },
    { name: "hospitalLogo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
    const uploadedPdf = req.files["pdf"][0];
const pdfPath = uploadedPdf.path;


const originalFileName = path.parse(uploadedPdf.originalname).name;
      const hospitalLogoFile = req.files["hospitalLogo"]
        ? req.files["hospitalLogo"][0]
        : null;

      const existingPdfBytes = fs.readFileSync(pdfPath);
      const defaultLogoBytes = fs.readFileSync(
        path.join(__dirname, "assets/default_logo.png")
      );

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const defaultLogoImage = await pdfDoc.embedPng(defaultLogoBytes);

      let hospitalLogoImage = null;
      if (hospitalLogoFile) {
        const hospitalLogoBytes = fs.readFileSync(hospitalLogoFile.path);
        hospitalLogoImage = await pdfDoc.embedPng(hospitalLogoBytes);
      }
      const { textName, HospitalName, education, refDoctor, serialNo } =req.body;

      const pages = pdfDoc.getPages();

      pages.forEach((page, index) => {
        const { width, height } = page.getSize();
        const leftDims = defaultLogoImage.scaleToFit(100, 100);
        page.drawImage(defaultLogoImage, {
          x: 65,
          y: height - leftDims.height - 20,
          width: leftDims.width,
          height: leftDims.height,
        });
        if (hospitalLogoImage) {
          const dims = hospitalLogoImage.scaleToFit(60, 60);
          const rightX = width - dims.width - 100;
          const topY = height - 10;

          page.drawImage(hospitalLogoImage, {
            x: rightX,
            y: topY - dims.height,
            width: dims.width,
            height: dims.height,
          });

          let y = topY - dims.height - 20;

          if (textName) {
            page.drawText(textName, { x: rightX - 10, y, size: 11 });
            y -= 15;
          }

          if (education) {
            page.drawText(education, { x: rightX - 10, y, size: 9 });
          }
        } else {
          let y = height - 50;
          const x = width - 200;

          if (HospitalName) {
            page.drawText(HospitalName, { x, y, size: 12 });
            y -= 15;
          }
          if (textName) {
            page.drawText(textName, { x, y, size: 11 });
            y -= 15;
          }
          if (education) {
            page.drawText(education, { x, y, size: 9 });
          }
        }
        if (index === 0) {
           if (refDoctor) {
          page.drawText(`Referral Doctor  ${refDoctor}`, {
            x: 72,
            y: height - 211,
            size: 10,
          });
        }
          page.drawText("BeatX Lite", {
            x: 385,
            y: height - 211,
            size: 10,
          });

          if (serialNo) {
            page.drawText(serialNo, {
              x: 385,
              y: height - 225,
              size: 10,
            });
          }
        }
      });

      const modifiedPdf = await pdfDoc.save();
     const outputFileName = `${originalFileName}_final.pdf`;
      const outputPath = path.join("uploads", outputFileName);
   console.log("output ",outputFileName)
      fs.writeFileSync(outputPath, modifiedPdf);

      res.download(outputPath, `${originalFileName}.pdf`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Failed to process PDF.");
    }
  }
);

app.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
