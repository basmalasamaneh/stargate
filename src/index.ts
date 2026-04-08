import express, { Application } from "express";
import swaggerUi from "swagger-ui-express";     
import YAML from "yamljs";                        
import healthRouter from "./routes/health";
import app from "./app";

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});