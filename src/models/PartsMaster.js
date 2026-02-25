const mongoose = require('mongoose');

const PartsMasterSchema = new mongoose.Schema({
  partCode: {
    type: String,
    required: [true, 'Part code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [30, 'Part code cannot exceed 30 characters']
  },
  partName: {
    type: String,
    required: [true, 'Part name is required'],
    trim: true,
    maxlength: [150, 'Part name cannot exceed 150 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    trim: true,
    maxlength: [50, 'Category cannot exceed 50 characters']
  },
  unit: {
    type: String,
    enum: {
      values: ['Pcs', 'Kg', 'Meter', 'Box', 'Set', 'Pair', 'Unit'],
      message: 'Invalid unit type'
    },
    default: 'Pcs'
  },
  reorderPoint: {
    type: Number,
    default: 0,
    min: [0, 'Reorder point cannot be negative']
  },
  avgUnitPrice: {
    type: Number,
    default: 0,
    min: [0, 'Average unit price cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ===================
// INDEXES
// ===================
PartsMasterSchema.index({ partCode: 1 }, { unique: true });
PartsMasterSchema.index({ partName: 'text', description: 'text' });
PartsMasterSchema.index({ category: 1 });
PartsMasterSchema.index({ isActive: 1 });

// ===================
// VIRTUAL: Get serial count
// ===================
PartsMasterSchema.virtual('serialCount', {
  ref: 'SerialNumber',
  localField: '_id',
  foreignField: 'partId',
  count: true
});

// Ensure virtuals are included in JSON
PartsMasterSchema.set('toJSON', { virtuals: true });
PartsMasterSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PartsMaster', PartsMasterSchema);