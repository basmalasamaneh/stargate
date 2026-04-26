import "dotenv/config";
import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import multer from "multer";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth.routes";
import usersRouter from "./routes/users.routes";
import artworkRouter from "./routes/artwork.routes";
import artistRouter from './routes/artist.routes'
import cartRouter from "./routes/cart.routes";
import orderRouter from "./routes/order.routes";
const app: Application = express();

// Enable CORS for frontend
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan("dev"));
}
app.use(express.json());

const swaggerPath = path.resolve(__dirname, "../swagger.yaml");
const swaggerDocument = YAML.load(swaggerPath);
if (process.env.NODE_ENV !== "production") {
  console.log("Loaded swagger paths: ", Object.keys((swaggerDocument as any).paths));
}

app.get("/", (req, res) => {
  res.json({ message: "SERVER is running" });
});

if (process.env.NODE_ENV !== "production") {
  app.get("/api-docs.json", (_req, res) => {
    res.json(swaggerDocument);
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use('/api/v1/artists', artistRouter);
app.use("/api/v1/artworks", artworkRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/orders", orderRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ status: "error", message: "حجم الصورة كبير جداً. الحد الأقصى 5MB لكل صورة" });
      return;
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ status: "error", message: "الحد الأقصى لعدد الصور هو 3" });
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
