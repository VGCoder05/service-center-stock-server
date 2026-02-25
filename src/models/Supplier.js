const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  supplierCode: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [20, 'Supplier code cannot exceed 20 characters']
  },
  supplierName: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true,
    maxlength: [100, 'Supplier name cannot exceed 100 characters']
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: [100, 'Contact person name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
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
SupplierSchema.index({ supplierCode: 1 }, { unique: true });
SupplierSchema.index({ supplierName: 'text' });
SupplierSchema.index({ isActive: 1 });

// ===================
// VIRTUAL: Get bill count (for reference)
// ===================
SupplierSchema.virtual('billCount', {
  ref: 'Bill',
  localField: '_id',
  foreignField: 'supplierId',
  count: true
});

// Ensure virtuals are included in JSON
SupplierSchema.set('toJSON', { virtuals: true });
SupplierSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Supplier', SupplierSchema);