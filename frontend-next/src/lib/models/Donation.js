import mongoose from "mongoose"

const DonationSchema = new mongoose.Schema({
  discordId:    { type: String, required: true },
  discordName:  { type: String, required: true },
  senderName:   { type: String, required: true },
  amount:       { type: Number, required: true },
  message:      { type: String, default: "" },
  status:       { type: String, enum: ["pending", "confirmed"], default: "pending" },
  confirmedAt:  { type: Date, default: null },
}, { timestamps: true })

export default mongoose.models.Donation
  || mongoose.model("Donation", DonationSchema)
