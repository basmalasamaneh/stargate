import "dotenv/config";
import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import multer from "multer";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth.routes";
import usersRouter from "./routes/users.routes";
import artworkRouter from "./routes/artwork.routes";

const app: Application = express();

// Enable CORS for frontend
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use("/images", express.static(path.resolve(__dirname, "../images")));

const swaggerPath = path.resolve(__dirname, "../swagger.yaml");
const swaggerDocument = YAML.load(swaggerPath);
if (process.env.NODE_ENV !== "production") {
  console.log("Loaded swagger paths: ", Object.keys((swaggerDocument as any).paths));
}

app.get("/", (req, res) => {
  res.json({ message: "SERVER is running" });
});

app.get("/api-docs.json", (req, res) => {
  res.json(swaggerDocument);
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/artworks", artworkRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ status: "error", message: "حجم الصورة كبير جداً. الحد الأقصى 5MB لكل صورة" });
      return;
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ status: "error", message: "الحد الأقصى لعدد الصور هو 5" });
      return;
    }

    res.status(400).json({ status: "error", message: "حدث خطأ أثناء رفع الصور" });
    return;
  }

  if (err instanceof Error && err.message) {
    res.status(400).json({ status: "error", message: err.message });
    return;
  }

  res.status(500).json({ status: "error", message: "حدث خطأ داخلي في الخادم" });
});

export default app;
