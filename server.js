const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const flash = require("connect-flash");
const { PDFDocument } = require("pdf-lib");

const app = express();

app.use(express.static(path.join(__dirname)));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static("uploads"));
app.use(express.static("assets"));

app.use(
  session({
    secret: "pdf-upload-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

const safeDelete = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Failed to delete:", filePath, err);
    }
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

app.get("/", (req, res) => {
  res.render("index");
});

app.post(
  "/upload",
  upload.fields([
    { name: "pdf", maxCount: 1 },
    { name: "hospitalLogo", maxCount: 1 },
  ]),
  async (req, res) => {
    let uploadedPdf;
    let hospitalLogoFile;
    let outputPath;

    try {
      if (req.body.textName == "") {
        req.flash("error", "textName required");
      }
      if (!req.files || !req.files.pdf) {
        req.flash("error", "Please upload a PDF file");
      }

      uploadedPdf = req.files.pdf[0];
      hospitalLogoFile = req.files.hospitalLogo
        ? req.files.hospitalLogo[0]
        : null;

      const pdfPath = uploadedPdf.path;
      const originalFileName = path.parse(uploadedPdf.originalname).name;

      const existingPdfBytes = fs.readFileSync(pdfPath);
      const originalPdf = await PDFDocument.load(existingPdfBytes);

      let removePages = [];
      if (req.body.page) {
        removePages = req.body.page
          .split(",")
          .map((p) => parseInt(p.trim(), 10) - 1)
          .filter((p) => !isNaN(p));
      }

      const pdfDoc = await PDFDocument.create();
      const totalPages = originalPdf.getPageCount();

      const pagesToKeep = [];
      for (let i = 0; i < totalPages; i++) {
        if (!removePages.includes(i)) {
          pagesToKeep.push(i);
        }
      }

      if (pagesToKeep.length === 0) {
        throw new Error("All pages removed. At least one page must remain.");
      }

      const copiedPages = await pdfDoc.copyPages(originalPdf, pagesToKeep);
      copiedPages.forEach((p) => pdfDoc.addPage(p));

      const defaultLogoBytes = fs.readFileSync(
        path.join(__dirname, "assets/default_logo.png")
      );
      const defaultLogoImage = await pdfDoc.embedPng(defaultLogoBytes);

      let hospitalLogoImage = null;
      if (hospitalLogoFile) {
        const logoBytes = fs.readFileSync(hospitalLogoFile.path);
        hospitalLogoImage = await pdfDoc.embedPng(logoBytes);
      }
      const { mode, textName, HospitalName, education, refDoctor, serialNo } =
        req.body;
      const pages = pdfDoc.getPages();
      pages.forEach((page, index) => {
        const { width, height } = page.getSize();

        if (mode.includes("rx")) {
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
              page.drawText(textName, { x: rightX, y, size: 11 });
              y -= 15;
            }
            if (education) {
              page.drawText(education, { x: rightX, y, size: 9 });
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
              page.drawText(`Referral Doctor ${refDoctor}`, {
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
        } else {
          if (index === 0 || index == 1) {
            if (hospitalLogoImage) {
              const dims = hospitalLogoImage.scaleToFit(60, 60);
              const rightX = width - dims.width - 150;
              const topY = height;

              page.drawImage(hospitalLogoImage, {
                x: rightX + 10,
                y: topY - dims.height - 5,
                width: dims.width,
                height: dims.height,
              });

              let y = topY - 40;

              if (textName) {
                page.drawText(textName, { x: rightX + 70, y, size: 9 });
                y -= 15;
              }
              if (education) {
                page.drawText(education, { x: rightX + 80, y, size: 9 });
              }
            } else {
              let y = height - 25;
              const x = width - 200;

              if (HospitalName) {
                page.drawText(HospitalName, { x, y, size: 12 });
                y -= 15;
              }
              if (textName) {
                page.drawText(textName, { x, y, size: 9 });
                y -= 15;
              }
              if (education) {
                page.drawText(education, { x, y, size: 9 });
              }
            }
          }
        }
      });

      const modifiedPdf = await pdfDoc.save();
      outputPath = path.join("uploads", `${originalFileName}_final.pdf`);
      fs.writeFileSync(outputPath, modifiedPdf);

      res.download(outputPath, `${originalFileName}.pdf`, (err) => {
        if (err) console.error("Download error:", err);
        safeDelete(outputPath);
        safeDelete(uploadedPdf.path);
        safeDelete(hospitalLogoFile?.path);
      });
    } catch (err) {
      console.error("Processing error:", err);

      safeDelete(outputPath);
      safeDelete(uploadedPdf?.path);
      safeDelete(hospitalLogoFile?.path);

      req.flash(
        "error",
        err.message || "Something went wrong while processing the PDF"
      );
      return res.render("index");
    }
  }
);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
