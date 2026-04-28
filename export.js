import fs from "fs";
import mongoose from "mongoose";

const MONGO_URI = "mongodb://localhost:27017/bloodapp";

await mongoose.connect(MONGO_URI);

const Turn = mongoose.model("turn", new mongoose.Schema({}, { strict: false }));

const data = await Turn.find();

fs.writeFileSync("turns.json", JSON.stringify(data, null, 2));

console.log("Export done");
process.exit();
