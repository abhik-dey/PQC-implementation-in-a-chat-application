const { Schema, model, models, Types } = require('mongoose');

const MessageSchema = new Schema({
  sender: { type: Types.ObjectId, ref: 'User', required: true },
  receiver: { type: Types.ObjectId, ref: 'User', required: true },
  
  // --- Fields for the RECEIVER (Tya) ---
  text: { type: String, required: true }, // Encrypted for Tya
  kem: { type: String, default: "" },     // Locked with Tya's Key
  
  // --- NEW: Fields for the SENDER (You) ---
  senderText: { type: String, default: "" }, // Encrypted for You
  senderKem: { type: String, default: "" },  // Locked with Your Key
  // ---------------------------------------

  iv: { type: String, default: "" }, // We can reuse the IV for simplicity
  timestamp: { type: Date, default: Date.now },
});

const Message = models.Message || model('Message', MessageSchema);
module.exports = Message;