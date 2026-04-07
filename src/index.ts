import express, { Application } from "express";
import swaggerUi from "swagger-ui-express";     
import YAML from "yamljs";                        
import healthRouter from "./routes/health";

const app: Application = express();
const PORT = 3001;

app.use(express.json());

const swaggerDocument = YAML.load("./swagger.yaml"); 
app.get("/", (req, res) => {
  res.json({ message: "SERVER is running" });
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));  

app.use("/api", healthRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);  
});