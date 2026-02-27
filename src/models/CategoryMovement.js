const mongoose = require('mongoose');

const CategoryMovementSchema = new mongoose.Schema({
  // Serial Reference
  serialNumberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SerialNumber',
    required: true,
    index: true
  },
  serialNumber: {
    type: String,
    required: true
  },

  // Bill Reference
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  voucherNumber: String,

  // Movement Type
  movementType: {
    type: String,
    enum: [
      'INITIAL_ENTRY',      // First time entered in system
      'CATEGORIZED',        // Moved from UNCATEGORIZED to a category
      'CATEGORY_CHANGE',    // Changed from one category to another
      'CONTEXT_UPDATE',     // Updated context fields (same category)
      'PAYMENT_UPDATE'      // Payment status changed
    ],
    required: true
  },

  // Category Change
  fromCategory: {
    type: String,
    enum: [
      'UNCATEGORIZED',
      'IN_STOCK',
      'SPU_PENDING',
      'SPU_CLEARED',
      'AMC',
      'OG',
      'RETURN',
      'RECEIVED_FOR_OTHERS',
      null
    ]
  },
  toCategory: {
    type: String,
    enum: [
      'UNCATEGORIZED',
      'IN_STOCK',
      'SPU_PENDING',
      'SPU_CLEARED',
      'AMC',
      'OG',
      'RETURN',
      'RECEIVED_FOR_OTHERS'
    ],
    required: true
  },

  // Context Snapshot (state at time of movement)
  contextSnapshot: {
    type: mongoose.Schema.Types.Mixed
  },

  // Reason/Notes
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },

  // Audit
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedByName: String,

  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false // We use our own timestamp field
});

// ===================
// INDEXES
// ===================
CategoryMovementSchema.index({ serialNumberId: 1, timestamp: -1 });
CategoryMovementSchema.index({ billId: 1 });
CategoryMovementSchema.index({ timestamp: -1 });
CategoryMovementSchema.index({ movementType: 1 });
CategoryMovementSchema.index({ toCategory: 1 });

// ===================
// STATICS
// ===================

// Create a movement record
CategoryMovementSchema.statics.createMovement = async function(data) {
  return await this.create({
    serialNumberId: data.serialNumberId,
    serialNumber: data.serialNumber,
    billId: data.billId,
    voucherNumber: data.voucherNumber,
    movementType: data.movementType,
    fromCategory: data.fromCategory,
    toCategory: data.toCategory,
    contextSnapshot: data.contextSnapshot,
    reason: data.reason,
    notes: data.notes,
    performedBy: data.performedBy,
    performedByName: data.performedByName,
    timestamp: new Date()
  });
};

// Get movement history for a serial
CategoryMovementSchema.statics.getHistory = async function(serialNumberId) {
  return await this.find({ serialNumberId })
    .sort({ timestamp: -1 })
    .populate('performedBy', 'fullName email');
};

module.exports = mongoose.model('CategoryMovement', CategoryMovementSchema);