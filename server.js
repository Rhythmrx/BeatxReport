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

    try {
      if (!req.files || !req.files.pdf) {
        req.flash("error", "Please upload a PDF file");
        return res.redirect("/");
      }

      const uploadedPdf = req.files.pdf[0];
      const pdfPath = uploadedPdf.path;
      const originalFileName = path.parse(uploadedPdf.originalname).name;

      const hospitalLogoFile = req.files.hospitalLogo
        ? req.files.hospitalLogo[0]
        : null;

      const existingPdfBytes = fs.readFileSync(pdfPath);
      const defaultLogoBytes = fs.readFileSync(
        path.join(__dirname, "assets/default_logo.png")
      );

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const defaultLogoImage = await pdfDoc.embedPng(defaultLogoBytes);

      let hospitalLogoImage = null;
      if (hospitalLogoFile) {
        const logoBytes = fs.readFileSync(hospitalLogoFile.path);
        hospitalLogoImage = await pdfDoc.embedPng(logoBytes);
      }
      const {
        textName,
        HospitalName,
        education,
        refDoctor,
        serialNo,
      } = req.body;

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
            page.drawText(textName, { x: rightX , y, size: 11 });
            y -= 15;
          }
          if (education) {
            page.drawText(education, { x: rightX , y, size: 9 });
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
      });

      const modifiedPdf = await pdfDoc.save();
      const outputFileName = `${originalFileName}_final.pdf`;
      const outputPath = path.join("uploads", outputFileName);

      fs.writeFileSync(outputPath, modifiedPdf);

      req.flash("success", "PDF processed successfully!");
      res.download(outputPath, `${originalFileName}.pdf`);
    }catch (err) {
  console.error("error", err);
  req.flash("error", "Failed to process PDF. Please try again.");
  return res.redirect("/");
}

  }
);


app.listen(3000, () => {
  console.log(" Server running on http://localhost:3000");
});
