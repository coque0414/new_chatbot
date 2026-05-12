import mongoose from "mongoose"

const NsuSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  raidId: { type: String, required: true },
  selections: {
    type: Map,
    of: String,
  },
  createdAt: { type: Date, default: Date.now, expires: 600 },
})

NsuSessionSchema.index({ userId: 1, raidId: 1 }, { unique: true })

export default mongoose.models.NsuSession || mongoose.model("NsuSession", NsuSessionSchema)
