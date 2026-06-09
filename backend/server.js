const express = require("express");
const dotenv = require("dotenv");

dotenv.config();
require("./db"); 

const app = express();
app.use(express.json());
const jobsRoutes = require("./routes/jobs");
app.use("/", jobsRoutes);

const authRoutes = require ("./routes/auth");
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});
