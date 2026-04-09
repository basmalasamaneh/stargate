import "dotenv/config";
import express, { Application } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth.routes";
import usersRouter from "./routes/users.routes";

const app: Application = express();

// Enable CORS for frontend
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

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

export default app;
