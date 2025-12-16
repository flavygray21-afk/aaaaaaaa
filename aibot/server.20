import express from "express";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => {
  res.send("AI BOT IS RUNNING SUCCESSFULLY :rocket:");
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
